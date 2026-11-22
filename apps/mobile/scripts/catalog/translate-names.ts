/**
 * Translates the USDA food names (and their portions) into Spanish, once, with
 * Gemini, and keeps the result in scripts/catalog/translations.json so the
 * catalog can be rebuilt later without a key.
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/translate-names.ts [--limit N]
 *
 * It reads GEMINI_API_KEY from apps/api/.env. The key is used only here: it is
 * never shipped in the app, and only food names and portion texts are sent.
 * Resumable: foods already translated are skipped, so an interrupted run (or a
 * rate limit) just continues the next time.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { EXTRACTED_PATH, type UsdaRecord } from './build-usda';

export const CATEGORY_NAMES = [
  'Frutas',
  'Verduras y hortalizas',
  'Legumbres',
  'Cereales, pan y pasta',
  'Carnes y embutidos',
  'Pescados y mariscos',
  'Huevos y lácteos',
  'Grasas, frutos secos y salsas',
  'Bebidas',
  'Dulces y snacks',
  'Platos preparados',
] as const;

export type CategoryName = (typeof CATEGORY_NAMES)[number];

export const TRANSLATIONS_PATH = fileURLToPath(new URL('./translations.json', import.meta.url));

export interface Translation {
  name: string;
  category: (typeof CATEGORY_NAMES)[number];
  skip: boolean;
  /** Spanish label per input portion, in the same order; "" drops that portion. */
  portions: string[];
}

const BATCH_SIZE = 50;
/** Batches asked at the same time. */
const CONCURRENCY = Number(process.env.CATALOG_CONCURRENCY) || 2;
const PAUSE_MS = 1000;

const answerSchema = z.array(
  z.object({
    id: z.number(),
    name: z.string().min(1).max(120),
    category: z.enum(CATEGORY_NAMES),
    skip: z.boolean(),
    portions: z.array(z.string()),
  }),
);

function buildPrompt(batch: { id: number; name: string; portions: string[] }[]): string {
  return [
    'Traduce al español de España alimentos de la base de datos USDA para una app de diario de comidas.',
    'Devuelve SOLO un array JSON (sin markdown) con un objeto por alimento de entrada, en el mismo orden:',
    '{"id": number, "name": string, "category": string, "skip": boolean, "portions": string[]}',
    '',
    'Reglas:',
    '- "name": nombre natural, como lo diría una persona en España al hacer la compra o cocinar ("Pechuga de pollo cocida", "Arroz blanco hervido"). Conserva siempre el estado o preparación (crudo, cocido, hervido, asado, frito, a la plancha, enlatado, congelado, seco) y la variedad relevante, porque dos entradas distintas no pueden quedar con el mismo nombre. Elimina ruido técnico ("NFS", "all types", "commercial", "USDA", "separable lean only" se traduce como "solo magro").',
    '- Primera letra en mayúscula, resto en minúscula salvo nombres propios. Máximo 80 caracteres. Sin comillas ni nombres en inglés.',
    `- "category": exactamente una de: ${CATEGORY_NAMES.map((c) => `"${c}"`).join(', ')}. Zumos y refrescos van a "Bebidas"; bollería, galletas y tartas a "Dulces y snacks"; pan a "Cereales, pan y pasta"; sopas, guisos y comidas hechas a "Platos preparados".`,
    '- "skip": true si es un producto de una marca o cadena estadounidense concreta (McDonald\'s, Kraft, Campbell\'s…), un alimento imposible de encontrar en España (animales exóticos o de caza poco comunes, alimentos tradicionales de nativos americanos), una fórmula infantil, o si el nombre original es demasiado ambiguo para traducirlo con sentido. En caso de duda, false.',
    '- "portions": un texto por cada porción de entrada, en el mismo orden y con la misma cantidad de elementos. Traduce unidades (cup → taza, tbsp → cucharada, tsp → cucharadita, slice → rebanada o loncha, piece → trozo, medium → mediano/a, large → grande, small → pequeño/a, fl oz → "" ). Ejemplo: "1 cup, chopped" → "1 taza, troceada". Devuelve "" si la porción no es útil (solo oz, lb o fl oz, o cantidades absurdas).',
    '',
    'Alimentos:',
    JSON.stringify(batch),
  ].join('\n');
}

/** Translating needs no long reasoning: switching it off is several times faster. Dropped if the model refuses it. */
let reasoningOff = true;

async function askGemini(apiKey: string, model: string, prompt: string): Promise<unknown> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          ...(reasoningOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 400 && reasoningOff) {
      reasoningOff = false; // some models do not accept the setting: ask again without it
      return askGemini(apiKey, model, prompt);
    }
    const error = new Error(`Gemini ${response.status}: ${body.slice(0, 160)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Translates one batch, retrying with a growing pause on rate limits and bad answers. */
async function translateBatch(
  apiKey: string,
  model: string,
  records: UsdaRecord[],
): Promise<Map<number, Translation>> {
  const input = records.map((record) => ({
    id: record.fdcId,
    name: record.description,
    portions: record.portions.map((portion) => portion.text),
  }));

  let lastError: unknown;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const answer = answerSchema.parse(await askGemini(apiKey, model, buildPrompt(input)));
      const byId = new Map(answer.map((item) => [item.id, item]));
      const result = new Map<number, Translation>();
      for (const record of records) {
        const item = byId.get(record.fdcId);
        if (!item) continue; // not answered: asked again next run
        // A wrong number of portion labels cannot be matched to their weights: keep the
        // name (the valuable part) and drop the portions of that food.
        const portions =
          item.portions.length === record.portions.length
            ? item.portions.map((label) => label.trim())
            : record.portions.map(() => '');
        result.set(record.fdcId, { name: item.name.trim(), category: item.category, skip: item.skip, portions });
      }
      return result;
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      await sleep((status === 429 || status === 503 ? 30_000 : 3_000) * attempt);
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const envPath = fileURLToPath(new URL('../../../api/.env', import.meta.url));
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY (apps/api/.env). Solo se usa para este script.');
  }
  // Not GEMINI_MODEL (that is the API's cheap model): translating names is worth a better one.
  const model = process.env.CATALOG_TRANSLATION_MODEL?.trim() || 'gemini-3.5-flash';

  const limitArgument = process.argv.indexOf('--limit');
  const limit = limitArgument > 0 ? Number(process.argv[limitArgument + 1]) : Infinity;

  const records = JSON.parse(readFileSync(EXTRACTED_PATH, 'utf8')) as UsdaRecord[];
  const done: Record<string, Translation> = existsSync(TRANSLATIONS_PATH)
    ? (JSON.parse(readFileSync(TRANSLATIONS_PATH, 'utf8')) as Record<string, Translation>)
    : {};

  const pending = records.filter((record) => !done[String(record.fdcId)]).slice(0, limit);
  console.log(`${records.length} alimentos, ${Object.keys(done).length} traducidos, ${pending.length} por traducir (modelo ${model}).`);

  let translated = 0;
  const wave = BATCH_SIZE * CONCURRENCY;
  for (let start = 0; start < pending.length; start += wave) {
    const batches: UsdaRecord[][] = [];
    for (let offset = start; offset < Math.min(start + wave, pending.length); offset += BATCH_SIZE) {
      batches.push(pending.slice(offset, offset + BATCH_SIZE));
    }

    const results = await Promise.allSettled(batches.map((batch) => translateBatch(apiKey, model, batch)));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const [id, translation] of result.value) {
          done[String(id)] = translation;
          translated += 1;
        }
      } else {
        console.error(`Un lote falló: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
      }
    }
    // Saved after every wave: a stop never loses work.
    writeFileSync(TRANSLATIONS_PATH, `${JSON.stringify(done)}\n`);
    console.log(`  ${Math.min(start + wave, pending.length)}/${pending.length}`);
    await sleep(PAUSE_MS);
  }

  const missing = records.filter((record) => !done[String(record.fdcId)]).length;
  console.log(`Traducidos ahora: ${translated}. Pendientes: ${missing}${missing ? ' (vuelve a ejecutar el script)' : ''}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
