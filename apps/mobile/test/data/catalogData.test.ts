import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { foodInputNutrientsSchema, makeNutrients } from '@jfood/core';

import { CATEGORY_NAMES } from '../../scripts/catalog/translate-names';
import {
  CATALOG_BUILT_AT,
  CATALOG_COUNTS,
  CATALOG_VERSION,
} from '../../src/data/catalog/catalogVersion';
import { FOOD_CATEGORIES } from '../../src/features/foods/utils/categories';

/**
 * Checks on the REAL bundled catalog (assets/catalog/catalog.db), whatever it
 * currently holds. Size thresholds apply only to the sources it was built from.
 */
const database = new DatabaseSync(new URL('../../assets/catalog/catalog.db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), {
  readOnly: true,
});

interface Row {
  id: string;
  name: string;
  normalized_name: string;
  brand: string | null;
  barcode: string | null;
  category: string;
  source: string;
  popularity: number;
  calories_kcal: number;
  protein_grams: number | null;
  carbohydrate_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  sugars_grams: number | null;
  salt_grams: number | null;
}

const rows = database.prepare('SELECT * FROM foods').all() as unknown as Row[];

test('the catalog file and the version the app reads are the same build', () => {
  const meta = Object.fromEntries(
    (database.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map((m) => [m.key, m.value]),
  );
  assert.equal(Number(meta.version), CATALOG_VERSION);
  assert.equal((database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, CATALOG_VERSION);
  assert.equal(meta.built_at, CATALOG_BUILT_AT);
  assert.deepEqual(JSON.parse(meta.counts ?? '{}'), CATALOG_COUNTS);
});

test('the catalog is as big as the sources it was built from say', () => {
  const counts = CATALOG_COUNTS as Record<string, number>;
  assert.ok(rows.length > 0);
  if (counts.usda !== undefined) assert.ok(counts.usda >= 3000, `USDA foods: ${counts.usda}`);
  if (counts.off !== undefined) assert.ok(counts.off >= 10_000, `Open Food Facts products: ${counts.off}`);
  assert.equal(rows.length, Object.values(counts).reduce((sum, n) => sum + n, 0));
});

test('every food has calories and passes the same validation as a food typed by a person', () => {
  const problems: string[] = [];
  for (const row of rows) {
    const checked = foodInputNutrientsSchema.safeParse(
      makeNutrients({
        caloriesKcal: row.calories_kcal,
        proteinGrams: row.protein_grams,
        carbohydrateGrams: row.carbohydrate_grams,
        fatGrams: row.fat_grams,
        fiberGrams: row.fiber_grams,
        sugarsGrams: row.sugars_grams,
        saltGrams: row.salt_grams,
      }),
    );
    if (!checked.success || typeof row.calories_kcal !== 'number') problems.push(`${row.id} ${row.name}`);
  }
  assert.deepEqual(problems.slice(0, 5), []);
});

test('ids are stable and never collide with the 338 built-in foods; barcodes match their ids', () => {
  const ids = new Set<string>();
  for (const row of rows) {
    assert.match(row.id, /^(usda-\d+|off-\d{8,14})$/, row.id);
    assert.ok(!ids.has(row.id), `duplicate id ${row.id}`);
    ids.add(row.id);
    if (row.id.startsWith('off-')) {
      assert.equal(row.barcode, row.id.slice(4));
      assert.equal(row.source, 'open_food_facts');
    } else {
      assert.equal(row.barcode, null);
      assert.equal(row.source, 'seed');
    }
  }
});

test('no two foods share a name and brand', () => {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const row of rows) {
    const key = `${row.normalized_name}|${(row.brand ?? '').toLowerCase()}`;
    if (seen.has(key)) repeated.push(`${row.name} (${row.brand ?? '—'})`);
    seen.add(key);
  }
  assert.deepEqual(repeated.slice(0, 5), []);
});

test('every category is one the app knows, with its emoji', () => {
  const known = new Set<string>(CATEGORY_NAMES);
  const withEmoji = new Set(FOOD_CATEGORIES.map((c) => c.name));
  for (const row of rows) {
    assert.ok(known.has(row.category), `unknown category ${row.category}`);
    assert.ok(withEmoji.has(row.category), `no emoji for ${row.category}`);
  }
});

test('calories agree with 4·protein + 4·carbohydrates + 9·fat for at least 95 % of the foods', () => {
  let checked = 0;
  let off = 0;
  for (const row of rows) {
    if (row.protein_grams === null || row.carbohydrate_grams === null || row.fat_grams === null) continue;
    checked += 1;
    const expected = 4 * row.protein_grams + 4 * row.carbohydrate_grams + 9 * row.fat_grams;
    // Alcohol, polyols and fibre leave room; beyond this the numbers contradict each other.
    if (Math.abs(row.calories_kcal - expected) > Math.max(60, 0.4 * expected)) off += 1;
  }
  assert.ok(checked === 0 || off / checked <= 0.05, `${off} of ${checked} foods do not add up`);
});

test('portions are short, sensible weights of known foods', () => {
  const ids = new Set(rows.map((row) => row.id));
  const servings = database.prepare('SELECT food_id, label, grams FROM servings').all() as {
    food_id: string;
    label: string;
    grams: number;
  }[];
  for (const serving of servings) {
    assert.ok(ids.has(serving.food_id), `portion of an unknown food ${serving.food_id}`);
    assert.ok(serving.label.length > 0 && serving.label.length <= 40, serving.label);
    assert.ok(serving.grams > 0 && serving.grams <= 5000, `${serving.label}: ${serving.grams}`);
  }
});

test('a search over the whole catalog answers quickly', () => {
  const search = database.prepare(
    `SELECT id FROM foods WHERE search_text LIKE ? AND search_text LIKE ? ORDER BY popularity DESC LIMIT 40`,
  );
  const started = performance.now();
  for (const [a, b] of [['%pollo%', '%%'], ['%yogur%', '%natural%'], ['%hacendado%', '%%'], ['%pan%', '%molde%']] as const) {
    search.all(a, b);
  }
  const perSearch = (performance.now() - started) / 4;
  // A laptop does this in a few milliseconds; a phone is slower, so the bar is generous.
  assert.ok(perSearch < 250, `${perSearch.toFixed(0)} ms per search`);
});
