/**
 * Downloads the Open Food Facts product dump (CSV, gzip, ~1.5 GB) into
 * .catalog-cache/off.csv.gz (ignored by git).
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/fetch-off.ts
 *
 * Open Food Facts data is under the Open Database License (ODbL): the app credits
 * it in Perfil → Acerca de. https://world.openfoodfacts.org/data
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { CACHE_DIR } from './fetch-usda';

const URL_DUMP = 'https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/en.openfoodfacts.org.products.csv.gz';

export const OFF_DUMP_PATH = join(CACHE_DIR, 'off.csv.gz');

async function main(): Promise<void> {
  mkdirSync(CACHE_DIR, { recursive: true });

  const head = await fetch(URL_DUMP, { method: 'HEAD' });
  const expected = Number(head.headers.get('content-length') ?? 0);
  if (existsSync(OFF_DUMP_PATH) && expected > 0 && statSync(OFF_DUMP_PATH).size === expected) {
    console.log('El volcado de Open Food Facts ya está descargado.');
    return;
  }

  console.log(`Descargando Open Food Facts (${Math.round(expected / 1e6)} MB)…`);
  const response = await fetch(URL_DUMP);
  if (!response.ok || !response.body) {
    throw new Error(`Open Food Facts respondió ${response.status}`);
  }

  let received = 0;
  let nextReport = 0;
  const source = Readable.fromWeb(response.body as never);
  source.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (received >= nextReport) {
      console.log(`  ${Math.round(received / 1e6)} / ${Math.round(expected / 1e6)} MB`);
      nextReport += 200e6;
    }
  });
  await pipeline(source, createWriteStream(OFF_DUMP_PATH));

  if (expected > 0 && statSync(OFF_DUMP_PATH).size !== expected) {
    throw new Error('La descarga quedó incompleta. Vuelve a ejecutar el script.');
  }
  console.log('Listo:', OFF_DUMP_PATH);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
