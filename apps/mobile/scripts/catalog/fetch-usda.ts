/**
 * Downloads USDA FoodData Central "SR Legacy" (public domain, CC0) into
 * .catalog-cache/usda (ignored by git) and unzips it.
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/fetch-usda.ts
 *
 * SR Legacy is the final, frozen release of USDA's reference database (7,793
 * foods): generic foods such as "Apples, raw, with skin". Source and licence:
 * https://fdc.nal.usda.gov/download-datasets
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_SR_LEGACY = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip';

export const CACHE_DIR = fileURLToPath(new URL('../../../../.catalog-cache/', import.meta.url));
export const USDA_DIR = join(CACHE_DIR, 'usda');

/** The folder that holds food.csv, whatever the zip nested it under. */
export function findUsdaCsvDir(root = USDA_DIR): string | null {
  if (!existsSync(root)) return null;
  if (existsSync(join(root, 'food.csv'))) return root;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findUsdaCsvDir(join(root, entry.name));
      if (found) return found;
    }
  }
  return null;
}

async function main(): Promise<void> {
  if (findUsdaCsvDir()) {
    console.log('USDA SR Legacy ya está descargado en', USDA_DIR);
    return;
  }

  mkdirSync(USDA_DIR, { recursive: true });
  const zipPath = join(CACHE_DIR, 'sr_legacy.zip');

  console.log('Descargando USDA SR Legacy (~6 MB)…');
  const response = await fetch(URL_SR_LEGACY);
  if (!response.ok) {
    throw new Error(`USDA respondió ${response.status}`);
  }
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

  console.log('Descomprimiendo…');
  const result =
    process.platform === 'win32'
      ? spawnSync(
          'powershell',
          ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${USDA_DIR}' -Force`],
          { stdio: 'inherit' },
        )
      : spawnSync('unzip', ['-o', '-q', zipPath, '-d', USDA_DIR], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('No se ha podido descomprimir el zip.');
  }

  console.log('Listo:', findUsdaCsvDir());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
