/**
 * Runs the app's real search (foodRepository.searchFoods) over the bundled
 * catalog.db and prints the top results with their timing. For eyeballing the
 * ranking after a rebuild:
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/try-search.ts pollo "yogur natural" arroz
 */
import { fileURLToPath } from 'node:url';

import { CATALOG_SCHEMA } from '../../src/data/catalog/catalogSchema';
import { markCatalogAttached } from '../../src/data/catalog/catalogState';
import { searchFoods } from '../../src/data/sqlite/repositories/foodRepository';
import { createMigratedDatabase } from '../../test/helpers/sqliteAdapter';

async function main(): Promise<void> {
  const queries = process.argv.slice(2);
  const db = await createMigratedDatabase();
  const path = fileURLToPath(new URL('../../assets/catalog/catalog.db', import.meta.url));
  db.raw.exec(`ATTACH DATABASE '${path.replace(/'/g, "''")}' AS ${CATALOG_SCHEMA}`);
  markCatalogAttached(db);

  for (const query of queries.length > 0 ? queries : ['pollo', 'yogur natural', 'arroz', 'hacendado', 'leche']) {
    const started = performance.now();
    const results = await searchFoods(db.asSqlite(), query, 12);
    const ms = performance.now() - started;
    console.log(`\n"${query}" (${ms.toFixed(0)} ms)`);
    for (const food of results) {
      console.log(
        `  ${food.name}${food.brand ? ` · ${food.brand}` : ''} — ${food.caloriesKcal} kcal, P${food.proteinGrams} C${food.carbohydrateGrams} G${food.fatGrams}  [${food.id}]`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
