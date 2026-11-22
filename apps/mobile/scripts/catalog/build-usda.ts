/**
 * Reads USDA SR Legacy (see fetch-usda.ts) and writes .catalog-cache/usda-extracted.json:
 * one record per useful generic food, with its nutrients per 100 g and up to
 * three raw portions. Names are still English here; translate-names.ts adds Spanish.
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/build-usda.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CACHE_DIR, findUsdaCsvDir } from './fetch-usda';

/** What SR Legacy gives per 100 g. Energy falls back to the Atwater values when 1008 is missing. */
const NUTRIENT = {
  kcal: 1008,
  kcalAtwaterSpecific: 2048,
  kcalAtwaterGeneral: 2047,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  sugars: 2000,
  sodium: 1093,
} as const;

/** USDA categories that are not useful for a Spanish person's food log. */
const SKIPPED_CATEGORIES = new Set([
  2, // Spices and herbs
  3, // Baby foods
  24, // American Indian / Alaska Native foods
]);

export interface UsdaRecord {
  fdcId: number;
  description: string;
  categoryId: number;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugars: number | null;
  sodiumMg: number | null;
  /** "1 cup, chopped" and its weight, in USDA's order. */
  portions: { text: string; grams: number }[];
}

export const EXTRACTED_PATH = join(CACHE_DIR, 'usda-extracted.json');

/** One CSV line into fields (quotes, doubled quotes). USDA files have no embedded newlines. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      fields.push(cell);
      cell = '';
    } else {
      cell += c;
    }
  }
  fields.push(cell);
  return fields;
}

function readCsv(path: string): string[][] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line !== '')
    .map(parseCsvLine);
}

const number = (value: string | undefined): number | null => {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Cleans a USDA description: drops the boilerplate in parentheses that adds nothing for a person. */
export function cleanDescription(description: string): string {
  return description
    .replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, '')
    .replace(/\s*\(Includes? [^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Beef/lamb entries exist once per USDA grade; the "all grades" one is enough. */
function isGradeVariant(description: string, categoryId: number): boolean {
  return (categoryId === 13 || categoryId === 17) && /\b(choice|select|prime)\b/i.test(description);
}

export function extractUsda(dir: string): UsdaRecord[] {
  const foods = readCsv(join(dir, 'food.csv'));
  const units = new Map(readCsv(join(dir, 'measure_unit.csv')).map((row) => [row[0]!, row[1]!]));

  const nutrients = new Map<number, Map<number, number>>();
  const wanted = new Set<number>(Object.values(NUTRIENT));
  for (const row of readCsv(join(dir, 'food_nutrient.csv'))) {
    const nutrientId = Number(row[2]);
    if (!wanted.has(nutrientId)) continue;
    const fdcId = Number(row[1]);
    const amount = number(row[3]);
    if (amount === null) continue;
    let perFood = nutrients.get(fdcId);
    if (!perFood) {
      perFood = new Map();
      nutrients.set(fdcId, perFood);
    }
    perFood.set(nutrientId, amount);
  }

  const portions = new Map<number, { seq: number; text: string; grams: number }[]>();
  for (const row of readCsv(join(dir, 'food_portion.csv'))) {
    const fdcId = Number(row[1]);
    const grams = number(row[7]);
    if (grams === null || grams <= 0 || grams > 2000) continue;
    const unit = units.get(row[4] ?? '') ?? '';
    const text = [row[3], unit, row[5], row[6]]
      .map((part) => (part ?? '').trim())
      .filter((part) => part !== '' && part !== 'undetermined')
      .join(' ')
      .replace(/\s+/g, ' ');
    if (text === '') continue;
    const list = portions.get(fdcId) ?? [];
    list.push({ seq: number(row[2]) ?? 99, text, grams });
    portions.set(fdcId, list);
  }

  const records: UsdaRecord[] = [];
  for (const row of foods) {
    const fdcId = Number(row[0]);
    const categoryId = Number(row[3]);
    const description = cleanDescription(row[2] ?? '');
    if (SKIPPED_CATEGORIES.has(categoryId) || description === '' || /UPC:/i.test(description)) continue;
    if (isGradeVariant(description, categoryId)) continue;

    const n = nutrients.get(fdcId);
    if (!n) continue;
    const kcal = n.get(NUTRIENT.kcal) ?? n.get(NUTRIENT.kcalAtwaterSpecific) ?? n.get(NUTRIENT.kcalAtwaterGeneral);
    if (kcal === undefined) continue;

    const seen = new Set<number>();
    const foodPortions = (portions.get(fdcId) ?? [])
      .sort((a, b) => a.seq - b.seq)
      .filter((portion) => (seen.has(portion.grams) ? false : (seen.add(portion.grams), true)))
      .slice(0, 3)
      .map(({ text, grams }) => ({ text, grams }));

    records.push({
      fdcId,
      description,
      categoryId,
      kcal,
      protein: n.get(NUTRIENT.protein) ?? null,
      carbs: n.get(NUTRIENT.carbs) ?? null,
      fat: n.get(NUTRIENT.fat) ?? null,
      fiber: n.get(NUTRIENT.fiber) ?? null,
      sugars: n.get(NUTRIENT.sugars) ?? null,
      sodiumMg: n.get(NUTRIENT.sodium) ?? null,
      portions: foodPortions,
    });
  }
  return records;
}

function main(): void {
  const dir = findUsdaCsvDir();
  if (!dir) {
    throw new Error('Falta la descarga de USDA. Ejecuta antes: tsx scripts/catalog/fetch-usda.ts');
  }
  const records = extractUsda(dir);
  writeFileSync(EXTRACTED_PATH, JSON.stringify(records));

  const byCategory = new Map<number, number>();
  for (const record of records) byCategory.set(record.categoryId, (byCategory.get(record.categoryId) ?? 0) + 1);
  console.log(`USDA: ${records.length} alimentos útiles → ${EXTRACTED_PATH}`);
  console.log('Por categoría USDA:', Object.fromEntries([...byCategory].sort((a, b) => a[0] - b[0])));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
