/**
 * Builds src/data/seed/foods.json, the catalog every new install starts with.
 *
 *   node apps/mobile/scripts/build-seed-catalog.mjs <carpeta-USDA-SR-Legacy-csv>
 *
 * The folder is the unzipped "SR Legacy" CSV download of USDA FoodData Central
 * (https://fdc.nal.usda.gov/download-datasets), which is public domain (CC0).
 * It is NOT stored in the repository: only the generated JSON is.
 *
 * Every food comes from scripts/seed/*.mjs as [name, fdcId, servings] (values
 * read from USDA) or [name, null, servings, reference] (own reference values).
 * Each row is checked with the same schema the app uses for typed foods, so an
 * impossible value fails the build instead of reaching a phone.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { foodInputNutrientsSchema, makeNutrients } from '@jfood/core';

const here = dirname(fileURLToPath(import.meta.url));
const usdaDir = process.argv[2];
if (!usdaDir) {
  console.error('Uso: node scripts/build-seed-catalog.mjs <carpeta-USDA-SR-Legacy-csv>');
  process.exit(1);
}

const CATEGORIES = [
  'fruits',
  'vegetables',
  'legumes',
  'cereals',
  'meats',
  'fish',
  'dairy',
  'fats-nuts-sauces',
  'beverages',
  'sweets',
  'dishes',
];

const NUTRIENT_IDS = { 1008: 'kcal', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber', 2000: 'sugars', 1093: 'sodium' };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function loadUsda() {
  const foods = new Map();
  for (const [id, , description] of parseCsv(readFileSync(join(usdaDir, 'food.csv'), 'utf8')).slice(1)) {
    foods.set(id, { description, n: {} });
  }
  for (const r of parseCsv(readFileSync(join(usdaDir, 'food_nutrient.csv'), 'utf8')).slice(1)) {
    const key = NUTRIENT_IDS[r[2]];
    const food = foods.get(r[1]);
    if (key && food) food.n[key] = Number(r[3]);
  }
  return foods;
}

/** Same rules as src/features/foods/utils/normalize.ts. */
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}

const round = (value, digits) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const orNull = (value, digits) => (value === undefined || Number.isNaN(value) ? null : round(value, digits));

const usda = loadUsda();
const catalog = [];
const ids = new Set();
const names = new Set();
const problems = [];

for (const file of CATEGORIES) {
  const { category, foods } = await import(`./seed/${file}.mjs`);

  for (const [name, fdcId, servings, reference] of foods) {
    let values;
    let source;

    if (fdcId === null) {
      if (!reference) {
        problems.push(`${name}: sin fdcId ni valores de referencia`);
        continue;
      }
      values = {
        caloriesKcal: reference.kcal,
        proteinGrams: reference.protein,
        carbohydrateGrams: reference.carbs,
        fatGrams: reference.fat,
        fiberGrams: reference.fiber ?? null,
        sugarsGrams: reference.sugars ?? null,
        saltGrams: reference.salt ?? null,
      };
      source = 'reference';
    } else {
      const row = usda.get(String(fdcId));
      if (!row) {
        problems.push(`${name}: fdcId ${fdcId} no existe en USDA`);
        continue;
      }
      const n = row.n;
      if (n.kcal === undefined) {
        problems.push(`${name}: USDA ${fdcId} no tiene calorías`);
        continue;
      }
      values = {
        caloriesKcal: round(n.kcal, 0),
        proteinGrams: orNull(n.protein, 2),
        carbohydrateGrams: orNull(n.carbs, 2),
        fatGrams: orNull(n.fat, 2),
        fiberGrams: orNull(n.fiber, 2),
        sugarsGrams: orNull(n.sugars, 2),
        // Salt = sodium (mg) × 2.5 / 1000, in grams.
        saltGrams: n.sodium === undefined ? null : round((n.sodium * 2.5) / 1000, 2),
      };
      source = 'usda';
    }

    // Sugars cannot exceed the carbohydrates; USDA rounds each one apart.
    if (
      values.sugarsGrams !== null &&
      values.carbohydrateGrams !== null &&
      values.sugarsGrams > values.carbohydrateGrams
    ) {
      values.sugarsGrams = values.carbohydrateGrams;
    }

    const checked = foodInputNutrientsSchema.safeParse(makeNutrients(values));
    if (!checked.success) {
      problems.push(`${name}: ${checked.error.issues.map((i) => i.message).join(' ')}`);
      continue;
    }

    const normalized = normalizeName(name);
    const id = `seed-${normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    if (ids.has(id) || names.has(normalized)) {
      problems.push(`${name}: nombre o id repetido (${id})`);
      continue;
    }
    ids.add(id);
    names.add(normalized);

    catalog.push({
      id,
      name,
      category,
      source,
      ...(fdcId === null ? {} : { fdcId }),
      ...values,
      servings: servings.map(([label, grams]) => ({ label, grams })),
    });
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problema(s):`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

const outPath = join(here, '..', 'src', 'data', 'seed', 'foods.json');
writeFileSync(outPath, `${JSON.stringify(catalog, null, 1)}\n`);
const fromUsda = catalog.filter((food) => food.source === 'usda').length;
console.log(`${catalog.length} alimentos (${fromUsda} de USDA, ${catalog.length - fromUsda} de referencia) → ${outPath}`);
