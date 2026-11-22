/**
 * Filters the Open Food Facts dump (see fetch-off.ts) down to the products sold
 * in Spain that are worth having in the app, and writes
 * .catalog-cache/off-spain.json for assemble-catalog.ts.
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/build-off.ts [--max 28000]
 *
 * Open Food Facts is crowd-sourced: a product is kept only if its name, calories
 * and macros are present and agree with each other (4·P + 4·C + 9·F ≈ kcal).
 * Contains data from Open Food Facts, available under the Open Database License.
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

import { OFF_DUMP_PATH } from './fetch-off';
import { OFF_PATH } from './assemble-catalog';
import { type CategoryName } from './translate-names';
import type { CatalogInput } from './writeCatalog';
import { normalizeName } from '../../src/features/foods/utils/normalize';

const COLUMNS = [
  'code',
  'product_name',
  'brands',
  'categories_tags',
  'countries_tags',
  'serving_quantity',
  'pnns_groups_1',
  'pnns_groups_2',
  'unique_scans_n',
  'energy-kcal_100g',
  'energy_100g',
  'fat_100g',
  'carbohydrates_100g',
  'sugars_100g',
  'fiber_100g',
  'proteins_100g',
  'salt_100g',
] as const;

export type OffRow = Record<(typeof COLUMNS)[number], string>;

const toNumber = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value: number | null, digits = 2): number | null =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/** The Spanish category of a product from Open Food Facts' own food groups, or null when unknown. */
export function categoryForOff(pnns1: string, pnns2: string): CategoryName | null {
  const group2 = pnns2.trim().toLowerCase();
  const group1 = pnns1.trim().toLowerCase();

  const byGroup2: Record<string, CategoryName> = {
    fruits: 'Frutas',
    'dried fruits': 'Frutas',
    vegetables: 'Verduras y hortalizas',
    potatoes: 'Verduras y hortalizas',
    legumes: 'Legumbres',
    nuts: 'Grasas, frutos secos y salsas',
    'fats': 'Grasas, frutos secos y salsas',
    'dressings and sauces': 'Grasas, frutos secos y salsas',
    bread: 'Cereales, pan y pasta',
    'breakfast cereals': 'Cereales, pan y pasta',
    cereals: 'Cereales, pan y pasta',
    'milk and yogurt': 'Huevos y lácteos',
    cheese: 'Huevos y lácteos',
    eggs: 'Huevos y lácteos',
    'dairy desserts': 'Huevos y lácteos',
    'ice cream': 'Dulces y snacks',
    meat: 'Carnes y embutidos',
    'processed meat': 'Carnes y embutidos',
    poultry: 'Carnes y embutidos',
    'fish and seafood': 'Pescados y mariscos',
    fish: 'Pescados y mariscos',
    'one-dish meals': 'Platos preparados',
    'pizza pies and quiche': 'Platos preparados',
    sandwiches: 'Platos preparados',
    soups: 'Platos preparados',
    'sweets': 'Dulces y snacks',
    'chocolate products': 'Dulces y snacks',
    'biscuits and cakes': 'Dulces y snacks',
    pastries: 'Dulces y snacks',
    appetizers: 'Dulces y snacks',
    'salty and fatty products': 'Dulces y snacks',
    'non-sugared beverages': 'Bebidas',
    'sweetened beverages': 'Bebidas',
    'artificially sweetened beverages': 'Bebidas',
    'alcoholic beverages': 'Bebidas',
    'fruit juices': 'Bebidas',
    'fruit nectars': 'Bebidas',
    'plant-based milk substitutes': 'Bebidas',
    'waters and flavored waters': 'Bebidas',
    'teas and herbal teas and coffees': 'Bebidas',
  };
  if (byGroup2[group2]) return byGroup2[group2];

  const byGroup1: Record<string, CategoryName> = {
    'fruits and vegetables': 'Verduras y hortalizas',
    'cereals and potatoes': 'Cereales, pan y pasta',
    'milk and dairy products': 'Huevos y lácteos',
    'fish meat eggs': 'Carnes y embutidos',
    'sugary snacks': 'Dulces y snacks',
    'salty snacks': 'Dulces y snacks',
    beverages: 'Bebidas',
    'fat and sauces': 'Grasas, frutos secos y salsas',
    'composite foods': 'Platos preparados',
  };
  return byGroup1[group1] ?? null;
}

// Words that only another language uses ("au", "mit", "with", "senza"…). Words that exist in
// Spanish too (con, de, la, bio, extra) are left out on purpose.
const FOREIGN_WORDS = new Set([
  // French
  'au', 'aux', 'du', 'des', 'et', 'pour', 'sans', 'avec', 'le', 'les', 'une', 'chocolat', 'noir', 'melange',
  'gout', 'ble', 'fromage', 'lait', 'saveur', 'biscuits', 'gateau', 'poulet', 'noix', 'farine', 'sucre',
  // German
  'mit', 'ohne', 'und', 'der', 'die', 'das', 'fur', 'zucker', 'mehl', 'kase', 'milch', 'brot', 'geschmack',
  // English
  'with', 'and', 'the', 'of', 'free', 'sugar', 'flavour', 'flavor', 'chocolate', 'cheese', 'milk', 'bread', 'butter',
  'chicken', 'original', 'pure', 'organic', 'fine', 'dark', 'roasted', 'peanut', 'almond',
  // Italian / Portuguese
  'senza', 'di', 'il', 'alla', 'della', 'com', 'sem', 'do', 'dos', 'queijo', 'pao', 'leite',
]);

const SPANISH_WORDS = new Set([
  'de', 'con', 'sin', 'y', 'el', 'la', 'los', 'las', 'del', 'al', 'para', 'en', 'natural', 'integral', 'cereales',
  'leche', 'queso', 'pan', 'jamon', 'pollo', 'atun', 'aceite', 'galletas', 'yogur', 'azucar', 'chocolate', 'receta',
]);

/** Characters of French/German names that Spanish and Catalan do not use. */
const FOREIGN_LETTERS = /[ßäöüêûùœôâîïë]/i;

const STOPWORDS = new Set([
  'de', 'del', 'con', 'sin', 'y', 'e', 'o', 'el', 'la', 'los', 'las', 'al', 'a', 'un', 'una', 'para', 'por', 'en',
  'bio', 'extra', 'light', 'zero', 'mini', 'maxi', 'pack', 'natural', 'premium', 'gran', 'mas', 'tipo', 'estilo',
]);

/** The words of a list of Spanish food names: what "a Spanish product name" is made of. */
export function buildSpanishVocabulary(names: readonly string[]): Set<string> {
  const vocabulary = new Set<string>();
  for (const name of names) {
    for (const word of normalizeName(name).split(' ')) {
      if (word.length > 1) vocabulary.add(word);
    }
  }
  return vocabulary;
}

/**
 * Does the name read as Spanish? With a vocabulary (from the translated USDA
 * names and the built-in foods) at least half of its words must be known, or a
 * third when the product is sold only in Spain; a single brand-like word
 * ("Nutella") and names made of the brand itself ("Coca-Cola") pass.
 */
export function looksSpanish(
  name: string,
  brand: string | null,
  onlySpain: boolean,
  vocabulary?: ReadonlySet<string>,
): boolean {
  if (FOREIGN_LETTERS.test(name)) return false;
  if (!vocabulary || vocabulary.size === 0) return looksSpanishEnough(name);

  const brandWords = new Set(normalizeName(brand ?? '').split(' '));
  const words = normalizeName(name)
    .split(' ')
    .filter((word) => word.length > 1 && !/^\d+$/.test(word));
  if (words.length <= 1) return true;

  const known = words.filter((word) => vocabulary.has(word) || STOPWORDS.has(word) || brandWords.has(word)).length;
  return known / words.length >= (onlySpain ? 0.34 : 0.5);
}

/**
 * Open Food Facts sorts by scans from everywhere, so a French cereal bar can top
 * the list. A name is rejected when it has clearly more words of another language
 * than of Spanish; a single brand-like word ("Nutella", "Colines") passes.
 */
export function looksSpanishEnough(name: string): boolean {
  if (FOREIGN_LETTERS.test(name)) return false;

  const words = normalizeName(name).split(' ').filter((word) => word !== '');
  const foreign = words.filter((word) => FOREIGN_WORDS.has(word)).length;
  const spanish = words.filter((word) => SPANISH_WORDS.has(word)).length;
  return foreign <= spanish;
}

/** "YOGUR NATURAL 500 g" → "Yogur natural". Null when nothing sensible is left. */
export function cleanProductName(raw: string): string | null {
  let name = raw
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–,]?\s*\d+([.,]\d+)?\s?(g|gr|kg|ml|cl|l|ud|uds|x\s?\d+)\b.*$/i, '')
    .trim();
  if (name.length < 3 || name.length > 80 || !/[a-zA-ZÀ-ÿ]/.test(name)) return null;
  if (/https?:|www\./i.test(name)) return null;

  const letters = name.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    name = name.toLowerCase();
  }
  return name.charAt(0).toLocaleUpperCase('es') + name.slice(1);
}

function cleanBrand(raw: string): string | null {
  const first = raw.split(',')[0]?.replace(/\s+/g, ' ').trim() ?? '';
  if (first.length < 2 || first.length > 40) return null;
  const letters = first.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  const text = letters.length > 3 && letters === letters.toUpperCase() ? first.toLowerCase() : first;
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}

/**
 * One product → a catalog food, or null when it fails any quality rule: not sold
 * in Spain, no name, no calories or macros, or numbers that contradict each other.
 */
export function offProductToCatalog(row: OffRow, vocabulary?: ReadonlySet<string>): CatalogInput | null {
  if (!row.countries_tags.split(',').some((tag) => tag.trim() === 'en:spain')) return null;

  const code = row.code.trim();
  if (!/^\d{8,14}$/.test(code)) return null;

  const name = cleanProductName(row.product_name);
  if (!name) return null;

  // The name must read as Spanish (the scan counts we sort by come from every country).
  const onlySpain = row.countries_tags.split(',').every((tag) => tag.trim() === 'en:spain');
  const brand = cleanBrand(row.brands);
  if (!looksSpanish(name, brand, onlySpain, vocabulary)) return null;

  const category = categoryForOff(row.pnns_groups_1, row.pnns_groups_2);
  if (!category) return null;

  const protein = toNumber(row['proteins_100g']);
  const carbs = toNumber(row['carbohydrates_100g']);
  const fat = toNumber(row['fat_100g']);
  if (protein === null || carbs === null || fat === null) return null;
  if ([protein, carbs, fat].some((value) => value < 0 || value > 100)) return null;
  if (protein + carbs + fat > 100.5) return null;

  let kcal = toNumber(row['energy-kcal_100g']);
  if (kcal === null) {
    const kilojoules = toNumber(row['energy_100g']);
    kcal = kilojoules === null ? null : kilojoules / 4.184;
  }
  if (kcal === null || kcal < 0 || kcal > 900) return null;

  // The calories must agree with the macros (alcohol and polyols leave room): otherwise one of them is a typo.
  const expected = 4 * protein + 4 * carbs + 9 * fat;
  if (Math.abs(kcal - expected) > Math.max(60, 0.4 * expected)) return null;

  const sugarsRaw = toNumber(row['sugars_100g']);
  const fiberRaw = toNumber(row['fiber_100g']);
  const saltRaw = toNumber(row['salt_100g']);
  const serving = toNumber(row['serving_quantity']);

  return {
    id: `off-${code}`,
    name,
    brand,
    barcode: code,
    category,
    source: 'open_food_facts',
    popularity: Math.max(0, Math.round(toNumber(row['unique_scans_n']) ?? 0)),
    caloriesKcal: Math.round(kcal),
    proteinGrams: round(protein),
    carbohydrateGrams: round(carbs),
    fatGrams: round(fat),
    fiberGrams: fiberRaw !== null && fiberRaw >= 0 && fiberRaw <= 100 ? round(fiberRaw) : null,
    // Sugars are part of the carbohydrates: a larger value is a typo.
    sugarsGrams: sugarsRaw !== null && sugarsRaw >= 0 && sugarsRaw <= carbs + 0.5 ? round(Math.min(sugarsRaw, carbs)) : null,
    saltGrams: saltRaw !== null && saltRaw >= 0 && saltRaw <= 100 ? round(saltRaw) : null,
    servings: serving !== null && serving >= 5 && serving <= 1500 ? [{ label: '1 ración', grams: round(serving, 1)! }] : [],
  };
}

/** Words of the Spanish food names the project already has (translations + built-in foods). */
function loadVocabulary(): Set<string> {
  const names: string[] = [];
  const translations = fileURLToPath(new URL('./translations.json', import.meta.url));
  if (existsSync(translations)) {
    const parsed = JSON.parse(readFileSync(translations, 'utf8')) as Record<string, { name: string; skip: boolean }>;
    for (const item of Object.values(parsed)) if (!item.skip) names.push(item.name);
  }
  const builtIn = fileURLToPath(new URL('../../src/data/seed/foods.json', import.meta.url));
  for (const food of JSON.parse(readFileSync(builtIn, 'utf8')) as { name: string }[]) names.push(food.name);
  return buildSpanishVocabulary(names);
}

async function main(): Promise<void> {
  if (!existsSync(OFF_DUMP_PATH)) {
    throw new Error('Falta el volcado. Ejecuta antes: tsx scripts/catalog/fetch-off.ts');
  }
  const maxArgument = process.argv.indexOf('--max');
  const max = maxArgument > 0 ? Number(process.argv[maxArgument + 1]) : 28_000;

  const vocabulary = loadVocabulary();
  console.log(`Vocabulario español: ${vocabulary.size} palabras.`);

  const lines = createInterface({ input: createReadStream(OFF_DUMP_PATH).pipe(createGunzip()), crlfDelay: Infinity });
  let index: Map<string, number> | null = null;
  let scanned = 0;
  let spain = 0;
  const kept = new Map<string, CatalogInput>(); // by normalized name + brand: the most scanned wins

  for await (const line of lines) {
    const fields = line.split('\t');
    if (!index) {
      index = new Map(fields.map((name, position) => [name, position]));
      const missing = COLUMNS.filter((column) => !index!.has(column));
      if (missing.length > 0) throw new Error(`El volcado no tiene las columnas: ${missing.join(', ')}`);
      continue;
    }

    scanned += 1;
    if (scanned % 500_000 === 0) console.log(`  ${scanned} productos leídos, ${spain} en España, ${kept.size} válidos`);

    const row = {} as OffRow;
    for (const column of COLUMNS) row[column] = fields[index.get(column)!] ?? '';
    if (!row.countries_tags.includes('en:spain')) continue;
    spain += 1;

    const food = offProductToCatalog(row, vocabulary);
    if (!food) continue;
    // Scans come from every country: a name that still reads as foreign is ranked tenth as high.
    if (!looksSpanishEnough(food.name)) food.popularity = Math.floor((food.popularity ?? 0) / 10);

    const key = normalizeName(`${food.name} ${food.brand ?? ''}`);
    const existing = kept.get(key);
    if (!existing || (food.popularity ?? 0) > (existing.popularity ?? 0)) kept.set(key, food);
  }

  const best = [...kept.values()]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.id.localeCompare(b.id))
    .slice(0, max);
  writeFileSync(OFF_PATH, JSON.stringify(best));
  console.log(`Open Food Facts: ${scanned} leídos · ${spain} en España · ${kept.size} válidos · ${best.length} guardados → ${OFF_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
