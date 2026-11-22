import { gramsSchema } from '@jfood/core';

import { parseSpanishNumber } from '../../foods/utils/parseNumber';
import type { RecognizedFoodMatch } from '../types';

/** Parses a typed amount ("12,5") and returns it only when it is a valid portion. */
export function parseGrams(text: string): number | null {
  const value = parseSpanishNumber(text, { thousands: true });
  if (value === null) {
    return null;
  }
  const parsed = gramsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Message for an invalid amount, or null when the text is a valid portion. */
export function describeGramsError(text: string): string | null {
  const value = parseSpanishNumber(text, { thousands: true });
  if (value === null) {
    return 'Introduce una cantidad en gramos.';
  }
  if (value <= 0) {
    return 'La cantidad debe ser mayor que 0.';
  }
  return parseGrams(text) === null ? 'Máximo 100.000 g.' : null;
}

/** Sets the grams of ONE result, found by id (never by position). */
export function setMatchGrams(
  matches: readonly RecognizedFoodMatch[],
  id: string,
  grams: number,
): RecognizedFoodMatch[] {
  return matches.map((match) => (match.id === id ? { ...match, grams } : match));
}

/** Removes ONE result by id; the others keep their own amounts. */
export function removeMatch(
  matches: readonly RecognizedFoodMatch[],
  id: string,
): RecognizedFoodMatch[] {
  return matches.filter((match) => match.id !== id);
}
