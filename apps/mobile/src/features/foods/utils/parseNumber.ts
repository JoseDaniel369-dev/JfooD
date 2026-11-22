export interface OptionalNumber {
  /** The number, or null when the field was left empty. */
  value: number | null;
  /** False when text was typed that is not a number. */
  valid: boolean;
}

interface SpanishNumberOptions {
  /**
   * Read "1.500" as 1500 (a Spanish thousands separator). Turn it on for big
   * amounts (grams of a portion, millilitres); leave it off for values that
   * are always small, such as the grams of fat per 100 g, where "2.500" means 2.5.
   */
  thousands?: boolean;
}

/**
 * Reads a number typed the Spanish way: "12,5", "1.500" (with `thousands`),
 * "0,75". Only digits, one decimal separator and an optional leading minus are
 * accepted, so "1e3", "0x10" or "Infinity" are not numbers. Returns null when the
 * text is empty or not a number.
 */
export function parseSpanishNumber(
  text: string,
  { thousands = false }: SpanishNumberOptions = {},
): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || !/^-?[\d.,]+$/.test(trimmed)) {
    return null;
  }

  const negative = trimmed.startsWith('-');
  const digits = negative ? trimmed.slice(1) : trimmed;

  let normalized: string;
  if (digits.includes(',')) {
    // The comma is the decimal separator; the points before it are thousands.
    if (digits.split(',').length !== 2) return null;
    const [integerPart = '', decimalPart = ''] = digits.split(',');
    const integer = thousands ? integerPart.replace(/\./g, '') : integerPart;
    normalized = `${integer}.${decimalPart}`;
  } else if (thousands && /^[1-9]\d{0,2}(\.\d{3})+$/.test(digits)) {
    normalized = digits.replace(/\./g, '');
  } else {
    normalized = digits;
  }

  if (!/^(\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/**
 * Reads a number typed in a form field: accepts a decimal comma ("12,5"),
 * ignores spaces, and treats an empty field as "unknown" (never as zero).
 */
export function parseOptionalNumber(text: string): OptionalNumber {
  if (text.trim() === '') {
    return { value: null, valid: true };
  }

  const parsed = parseSpanishNumber(text);
  return parsed === null ? { value: null, valid: false } : { value: parsed, valid: true };
}
