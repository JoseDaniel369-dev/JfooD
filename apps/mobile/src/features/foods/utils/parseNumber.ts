export interface OptionalNumber {
  /** The number, or null when the field was left empty. */
  value: number | null;
  /** False when text was typed that is not a number. */
  valid: boolean;
}

/**
 * Reads a number typed in a form field: accepts a decimal comma ("12,5"),
 * ignores spaces, and treats an empty field as "unknown" (never as zero).
 */
export function parseOptionalNumber(text: string): OptionalNumber {
  const normalized = text.replace(',', '.').trim();
  if (normalized === '') {
    return { value: null, valid: true };
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? { value: parsed, valid: true } : { value: null, valid: false };
}
