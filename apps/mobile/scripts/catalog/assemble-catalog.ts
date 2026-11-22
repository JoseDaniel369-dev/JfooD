/**
 * Builds the real catalog: apps/mobile/assets/catalog/catalog.db and
 * src/data/catalog/catalogVersion.ts.
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/assemble-catalog.ts
 *
 * Inputs (each step is run once and cached; see npm run catalog:build):
 *   - .catalog-cache/usda-extracted.json   (build-usda.ts)
 *   - scripts/catalog/translations.json    (translate-names.ts, versioned)
 *   - .catalog-cache/off-spain.json        (build-off.ts, optional until the Open Food Facts step)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CACHE_DIR } from './fetch-usda';
import { EXTRACTED_PATH, type UsdaRecord } from './build-usda';
import { CATEGORY_NAMES, TRANSLATIONS_PATH, type Translation } from './translate-names';
import {
  toCatalogRow,
  writeCatalog,
  writeCatalogVersionFile,
  type CatalogInput,
} from './writeCatalog';
import { normalizeName } from '../../src/features/foods/utils/normalize';

export const OFF_PATH = join(CACHE_DIR, 'off-spain.json');
const CATALOG_PATH = fileURLToPath(new URL('../../assets/catalog/catalog.db', import.meta.url));
const VERSION_PATH = fileURLToPath(new URL('../../src/data/catalog/catalogVersion.ts', import.meta.url));
const SEED_FOODS_PATH = fileURLToPath(new URL('../../src/data/seed/foods.json', import.meta.url));

/** Popularity given to the generic USDA foods (Open Food Facts uses scan counts, mostly 1-20). */
const GENERIC_POPULARITY = 50;

const round = (value: number | null, digits = 2): number | null =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/** A portion label that is worth showing: short, no inches, no USDA boilerplate. */
export function usablePortionLabel(label: string): boolean {
  return (
    label.length > 0 &&
    label.length <= 40 &&
    !/["”]|NLEA|peso medio|aprox|agrupad/i.test(label) &&
    !/\b(oz|lb)\b/i.test(label)
  );
}

/** First letter upper case, the rest as written. */
function capitalize(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
  return trimmed.charAt(0).toLocaleUpperCase('es') + trimmed.slice(1);
}

export function usdaToCatalog(record: UsdaRecord, translation: Translation): CatalogInput {
  const carbs = round(record.carbs);
  const sugars = round(record.sugars);
  const servings: { label: string; grams: number }[] = [];
  record.portions.forEach((portion, index) => {
    const label = translation.portions[index]?.trim() ?? '';
    if (usablePortionLabel(label)) {
      servings.push({ label, grams: round(portion.grams, 1) ?? portion.grams });
    }
  });

  return {
    id: `usda-${record.fdcId}`,
    name: capitalize(translation.name).slice(0, 80),
    category: translation.category,
    source: 'seed',
    // Above the long tail of rarely scanned products, below the popular ones: a generic
    // "arroz" or "pollo" should show the plain food before an obscure brand.
    popularity: GENERIC_POPULARITY,
    caloriesKcal: round(record.kcal, 0) ?? 0,
    proteinGrams: round(record.protein),
    carbohydrateGrams: carbs,
    fatGrams: round(record.fat),
    fiberGrams: round(record.fiber),
    // Sugars cannot exceed carbohydrates (rounding noise in USDA data).
    sugarsGrams: sugars !== null && carbs !== null ? Math.min(sugars, carbs) : sugars,
    saltGrams: record.sodiumMg === null ? null : round((record.sodiumMg * 2.5) / 1000),
    servings,
  };
}

interface Report {
  kept: number;
  skippedByTranslation: number;
  untranslated: number;
  invalid: string[];
  duplicates: number;
  builtIn: number;
}

/** USDA foods with a usable translation, validated, without repeated names. */
export function buildUsdaFoods(
  records: readonly UsdaRecord[],
  translations: Record<string, Translation>,
  takenNames: ReadonlySet<string>,
): { foods: CatalogInput[]; report: Report } {
  const report: Report = { kept: 0, skippedByTranslation: 0, untranslated: 0, invalid: [], duplicates: 0, builtIn: 0 };
  const names = new Set(takenNames);
  const foods: CatalogInput[] = [];

  for (const record of [...records].sort((a, b) => a.fdcId - b.fdcId)) {
    const translation = translations[String(record.fdcId)];
    if (!translation) {
      report.untranslated += 1;
      continue;
    }
    if (translation.skip) {
      report.skippedByTranslation += 1;
      continue;
    }

    const food = usdaToCatalog(record, translation);
    let normalized: string;
    try {
      normalized = toCatalogRow(food).normalized_name; // throws on anything the app would refuse
    } catch (error) {
      report.invalid.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    if (takenNames.has(normalized)) {
      report.builtIn += 1;
      continue;
    }
    if (names.has(normalized)) {
      report.duplicates += 1;
      continue;
    }
    names.add(normalized);
    foods.push(food);
    report.kept += 1;
  }

  return { foods, report };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function main(): void {
  if (!existsSync(EXTRACTED_PATH) || !existsSync(TRANSLATIONS_PATH)) {
    throw new Error('Faltan los datos de USDA o sus traducciones (build-usda.ts y translate-names.ts).');
  }

  // The 338 hand-written foods already live in the app: the catalog never repeats them.
  const builtInNames = new Set(
    loadJson<{ name: string }[]>(SEED_FOODS_PATH).map((food) => normalizeName(food.name)),
  );

  const usda = buildUsdaFoods(
    loadJson<UsdaRecord[]>(EXTRACTED_PATH),
    loadJson<Record<string, Translation>>(TRANSLATIONS_PATH),
    builtInNames,
  );

  const all: CatalogInput[] = [...usda.foods];
  const counts: Record<string, number> = { usda: usda.foods.length };

  if (existsSync(OFF_PATH)) {
    const taken = new Set(all.map((food) => normalizeName(food.name)));
    const off = loadJson<CatalogInput[]>(OFF_PATH).filter((food) => {
      // The same product name and brand is one product.
      const key = normalizeName(`${food.name} ${food.brand ?? ''}`);
      if (taken.has(key)) return false;
      taken.add(key);
      return true;
    });
    all.push(...off);
    counts.off = off.length;
  }

  const meta = { version: Math.floor(Date.now() / 1000), counts, builtAt: new Date().toISOString() };
  writeCatalog(all, CATALOG_PATH, meta);
  writeCatalogVersionFile(VERSION_PATH, meta);

  const byCategory = new Map<string, number>();
  for (const food of all) byCategory.set(food.category, (byCategory.get(food.category) ?? 0) + 1);

  console.log(`Catálogo: ${all.length} alimentos → ${CATALOG_PATH}`);
  console.log('Fuentes:', counts);
  console.log('Por categoría:', Object.fromEntries([...byCategory].sort((a, b) => b[1] - a[1])));
  console.log(
    `USDA: ${usda.report.kept} usados · ${usda.report.skippedByTranslation} descartados (marca/exótico) · ` +
      `${usda.report.duplicates} nombres repetidos · ${usda.report.builtIn} ya en la app · ` +
      `${usda.report.untranslated} sin traducir · ${usda.report.invalid.length} inválidos`,
  );
  for (const problem of usda.report.invalid.slice(0, 10)) console.log('  inválido:', problem);

  const unknown = [...byCategory.keys()].filter((name) => !(CATEGORY_NAMES as readonly string[]).includes(name));
  if (unknown.length > 0) throw new Error(`Categorías desconocidas: ${unknown.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
