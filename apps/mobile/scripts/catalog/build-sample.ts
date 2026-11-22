/**
 * A tiny catalog for development and tests. Real catalogs come from
 * assemble-catalog.ts; this keeps the app buildable before they exist.
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/build-sample.ts
 */
import { fileURLToPath } from 'node:url';

import { writeCatalog, writeCatalogVersionFile, type CatalogInput } from './writeCatalog';

const food = (
  id: string,
  name: string,
  category: string,
  kcal: number,
  p: number,
  c: number,
  f: number,
  extra: Partial<CatalogInput> = {},
): CatalogInput => ({
  id,
  name,
  category,
  source: 'seed',
  caloriesKcal: kcal,
  proteinGrams: p,
  carbohydrateGrams: c,
  fatGrams: f,
  fiberGrams: null,
  sugarsGrams: null,
  saltGrams: null,
  ...extra,
});

export const SAMPLE_FOODS: CatalogInput[] = [
  food('usda-sample-1', 'Pechuga de pavo cocida', 'Carnes y embutidos', 135, 29.9, 0, 1.0, {
    servings: [{ label: '1 filete', grams: 120 }],
  }),
  food('usda-sample-2', 'Calabacín crudo', 'Verduras y hortalizas', 17, 1.2, 3.1, 0.3, { fiberGrams: 1 }),
  food('off-8480000000011', 'Yogur natural', 'Huevos y lácteos', 61, 3.5, 4.7, 3.3, {
    source: 'open_food_facts',
    brand: 'Hacendado',
    barcode: '8480000000011',
    popularity: 900,
    servings: [{ label: '1 yogur', grams: 125 }],
  }),
  food('off-8410000000022', 'Yogur natural', 'Huevos y lácteos', 70, 4, 5.2, 3.8, {
    source: 'open_food_facts',
    brand: 'Danone',
    barcode: '8410000000022',
    popularity: 700,
    servings: [{ label: '1 yogur', grams: 125 }],
  }),
  food('off-8410000000033', 'Pan de molde integral', 'Cereales, pan y pasta', 245, 9.5, 40, 4.2, {
    source: 'open_food_facts',
    brand: 'Bimbo',
    barcode: '8410000000033',
    popularity: 500,
    fiberGrams: 6,
    servings: [{ label: '1 rebanada', grams: 28 }],
  }),
  food('off-8410000000044', 'Galletas María', 'Dulces y snacks', 440, 7, 74, 12, {
    source: 'open_food_facts',
    brand: 'Marbú',
    barcode: '8410000000044',
    popularity: 300,
    sugarsGrams: 20,
    saltGrams: 0.6,
  }),
  food('off-8410000000055', 'Atún claro en aceite de oliva', 'Pescados y mariscos', 190, 26, 0, 9, {
    source: 'open_food_facts',
    brand: 'Calvo',
    barcode: '8410000000055',
    popularity: 400,
    saltGrams: 1.1,
  }),
  food('off-8410000000066', 'Leche semidesnatada', 'Huevos y lácteos', 46, 3.2, 4.8, 1.6, {
    source: 'open_food_facts',
    brand: 'Pascual',
    barcode: '8410000000066',
    popularity: 800,
    servings: [{ label: '1 vaso', grams: 250 }],
  }),
];

function main(): void {
  const meta = {
    version: 1,
    counts: { muestra: SAMPLE_FOODS.length },
    builtAt: new Date().toISOString(),
  };
  const catalogPath = fileURLToPath(new URL('../../assets/catalog/catalog.db', import.meta.url));
  const versionPath = fileURLToPath(new URL('../../src/data/catalog/catalogVersion.ts', import.meta.url));
  writeCatalog(SAMPLE_FOODS, catalogPath, meta);
  writeCatalogVersionFile(versionPath, meta);
  console.log(`Catálogo de muestra: ${SAMPLE_FOODS.length} alimentos → ${catalogPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
