/**
 * Writes scripts/catalog/translation-review.md: the most basic ~300 USDA foods
 * (shortest English names, a fair share per category) with their Spanish name
 * and category, so a person can read them in a few minutes and spot bad ones.
 * Fix a bad one by editing its entry in translations.json, then rebuild.
 *
 *   npm exec -w @jfood/mobile -- tsx scripts/catalog/review-translations.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EXTRACTED_PATH, type UsdaRecord } from './build-usda';
import { TRANSLATIONS_PATH, type Translation } from './translate-names';

const PER_CATEGORY = 28;
const OUTPUT = fileURLToPath(new URL('./translation-review.md', import.meta.url));

function main(): void {
  const records = JSON.parse(readFileSync(EXTRACTED_PATH, 'utf8')) as UsdaRecord[];
  const translations = JSON.parse(readFileSync(TRANSLATIONS_PATH, 'utf8')) as Record<string, Translation>;

  const byCategory = new Map<string, { en: string; es: string; id: number }[]>();
  for (const record of records) {
    const translation = translations[String(record.fdcId)];
    if (!translation || translation.skip) continue;
    const list = byCategory.get(translation.category) ?? [];
    list.push({ en: record.description, es: translation.name, id: record.fdcId });
    byCategory.set(translation.category, list);
  }

  const lines = [
    '# Revisión de traducciones (USDA → español)',
    '',
    'Los alimentos más básicos de cada categoría. Si alguno está mal, corrige su entrada en `translations.json` (clave = id de USDA) y reconstruye con `npm run catalog:assemble`.',
    '',
  ];
  for (const [category, list] of [...byCategory].sort()) {
    lines.push(`## ${category}`, '', '| USDA | Español |', '|---|---|');
    for (const item of list.sort((a, b) => a.en.length - b.en.length).slice(0, PER_CATEGORY)) {
      lines.push(`| ${item.en} (${item.id}) | ${item.es} |`);
    }
    lines.push('');
  }
  writeFileSync(OUTPUT, lines.join('\n'));
  console.log(`Lista de revisión → ${OUTPUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
