/**
 * Normalizes a food name for searching and indexing.
 *
 * Rules:
 * - Lowercase.
 * - Remove diacritics (á → a, é → e, …).
 * - Replace ñ with n.
 * - Collapse multiple spaces into one.
 * - Trim leading/trailing whitespace.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}
