/**
 * Schema of the bundled food catalog: a read-only SQLite file that ships inside
 * the app and is ATTACHed to the person's database as `catalog`.
 *
 * The build script and the tests create it from this same SQL, so the file the
 * app reads and the file the tests read can never drift apart.
 */

/** File name of the catalog in the app's database folder. */
export const CATALOG_FILE = 'catalog.db';

/** Name the catalog is attached under: queries read `catalog.foods`. */
export const CATALOG_SCHEMA = 'catalog';

/** Where a catalog food comes from. USDA and the hand-written references are `seed`. */
export type CatalogSource = 'seed' | 'open_food_facts';

/** One row of `catalog.foods`. Every catalog food has calories: that is the point of it. */
export interface CatalogFoodRow {
  id: string;
  name: string;
  normalized_name: string;
  /** Normalized name + brand, what a search looks into. */
  search_text: string;
  brand: string | null;
  barcode: string | null;
  category: string;
  source: CatalogSource;
  /** Higher = more people eat it (scans in Open Food Facts). Orders equal matches. */
  popularity: number;
  calories_kcal: number;
  protein_grams: number | null;
  carbohydrate_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  sugars_grams: number | null;
  salt_grams: number | null;
}

export interface CatalogServingRow {
  food_id: string;
  label: string;
  grams: number;
}

/**
 * The CREATE statements. Pass `schema` ("catalog") to create the tables inside an
 * attached database (tests); leave it out to build the standalone file.
 */
export function catalogSchemaSql(schema?: string): string {
  const s = schema ? `${schema}.` : '';
  return `
    CREATE TABLE ${s}foods (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      search_text TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      category TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('seed', 'open_food_facts')),
      popularity INTEGER NOT NULL DEFAULT 0,
      calories_kcal REAL NOT NULL CHECK (calories_kcal >= 0),
      protein_grams REAL CHECK (protein_grams IS NULL OR protein_grams >= 0),
      carbohydrate_grams REAL CHECK (carbohydrate_grams IS NULL OR carbohydrate_grams >= 0),
      fat_grams REAL CHECK (fat_grams IS NULL OR fat_grams >= 0),
      fiber_grams REAL CHECK (fiber_grams IS NULL OR fiber_grams >= 0),
      sugars_grams REAL CHECK (sugars_grams IS NULL OR sugars_grams >= 0),
      salt_grams REAL CHECK (salt_grams IS NULL OR salt_grams >= 0)
    ) WITHOUT ROWID;

    CREATE TABLE ${s}servings (
      food_id TEXT NOT NULL,
      label TEXT NOT NULL,
      grams REAL NOT NULL CHECK (grams > 0),
      PRIMARY KEY (food_id, label)
    ) WITHOUT ROWID;

    CREATE TABLE ${s}meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    ) WITHOUT ROWID;

    CREATE INDEX ${s}idx_catalog_barcode ON foods (barcode) WHERE barcode IS NOT NULL;
    CREATE INDEX ${s}idx_catalog_category ON foods (category, popularity DESC);
  `;
}
