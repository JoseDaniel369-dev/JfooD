import { CATALOG_SCHEMA, catalogSchemaSql } from '../../src/data/catalog/catalogSchema';
import { markCatalogAttached } from '../../src/data/catalog/catalogState';
import { toCatalogRow, type CatalogInput } from '../../scripts/catalog/writeCatalog';
import type { TestDatabase } from './sqliteAdapter';

/**
 * Attaches an in-memory catalog (same schema as the real file) to a test
 * database and marks it attached, like attachCatalog does in the app.
 */
export async function attachTestCatalog(db: TestDatabase, foods: readonly CatalogInput[]): Promise<void> {
  db.raw.exec(`ATTACH DATABASE ':memory:' AS ${CATALOG_SCHEMA}`);
  db.raw.exec(catalogSchemaSql(CATALOG_SCHEMA));

  const insertFood = db.raw.prepare(
    `INSERT INTO ${CATALOG_SCHEMA}.foods (id, name, normalized_name, search_text, brand, barcode, category, source,
       popularity, calories_kcal, protein_grams, carbohydrate_grams, fat_grams, fiber_grams, sugars_grams, salt_grams)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertServing = db.raw.prepare(
    `INSERT INTO ${CATALOG_SCHEMA}.servings (food_id, label, grams) VALUES (?, ?, ?)`,
  );

  for (const food of foods) {
    const row = toCatalogRow(food);
    insertFood.run(
      row.id, row.name, row.normalized_name, row.search_text, row.brand, row.barcode, row.category, row.source,
      row.popularity, row.calories_kcal, row.protein_grams, row.carbohydrate_grams, row.fat_grams,
      row.fiber_grams, row.sugars_grams, row.salt_grams,
    );
    for (const serving of food.servings ?? []) {
      insertServing.run(row.id, serving.label, serving.grams);
    }
  }

  markCatalogAttached(db);
}
