import {
  NUTRIENT_KEYS,
  foodInputNutrientsSchema,
  makeNutrients,
  unknownNutrients,
  type Nutrients,
} from '@jfood/core';

const KJ_PER_KCAL = 4.184;
const REQUEST_TIMEOUT_MS = 12_000;

export interface ProductData {
  barcode: string;
  name: string;
  brand: string | null;
  per100g: Nutrients;
  /** True when some nutrient could not be read and was left as unknown. */
  incomplete: boolean;
}

/**
 * Digits of an EAN-8, UPC-A, EAN-13 or ITF-14 code, or null when it is not one.
 * A UPC-A (12 digits) is the same product as the EAN-13 with a leading zero, so
 * it is stored as the 13-digit form: scanning one product with either reader
 * must always find the same food.
 */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12) {
    return `0${digits}`;
  }
  return [8, 13, 14].includes(digits.length) ? digits : null;
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Main nutrients: when any of these is unknown the product is "incomplete". */
const MAIN_KEYS = ['caloriesKcal', 'proteinGrams', 'carbohydrateGrams', 'fatGrams'] as const;

/**
 * Keeps every value that is plausible on its own and drops (sets to unknown)
 * only the ones that are not, so one bad number from the community data does
 * not discard the others. When the macros add up to more than 100 g per
 * 100 g, none of the three (nor the sugars they contain) can be trusted, but
 * the calories, fibre and salt are kept.
 */
export function keepPlausibleNutrients(candidate: Nutrients): Nutrients {
  const kept = unknownNutrients();
  for (const key of NUTRIENT_KEYS) {
    const value = candidate[key];
    if (
      value !== null &&
      foodInputNutrientsSchema.safeParse({ ...unknownNutrients(), [key]: value }).success
    ) {
      kept[key] = value;
    }
  }

  // Sugars are part of the carbohydrates: if they contradict them, drop the sugars.
  if (!foodInputNutrientsSchema.safeParse(kept).success) {
    kept.sugarsGrams = null;
  }
  // Macros that add up to more than the food weighs cannot be trusted.
  if (!foodInputNutrientsSchema.safeParse(kept).success) {
    kept.proteinGrams = null;
    kept.carbohydrateGrams = null;
    kept.fatGrams = null;
    kept.sugarsGrams = null;
  }
  return kept;
}

/**
 * Converts an Open Food Facts response into app data. Values are only used
 * when they pass the same input rules as a food typed by hand; anything
 * missing or implausible stays unknown (null), never zero.
 */
export function mapOpenFoodFactsProduct(
  json: unknown,
  barcode: string,
): ProductData | null {
  if (typeof json !== 'object' || json === null) return null;
  const { status, product } = json as { status?: unknown; product?: unknown };
  if (status === 0 || status === 'product_not_found') return null;
  if (typeof product !== 'object' || product === null) return null;

  const data = product as Record<string, unknown>;
  const name =
    readText(data.product_name_es) ??
    readText(data.product_name) ??
    readText(data.generic_name);
  if (!name) return null;

  const nutriments =
    typeof data.nutriments === 'object' && data.nutriments !== null
      ? (data.nutriments as Record<string, unknown>)
      : {};

  const kilojoules = readNumber(nutriments['energy_100g']);
  const sodium = readNumber(nutriments['sodium_100g']);
  const candidate = makeNutrients({
    caloriesKcal:
      readNumber(nutriments['energy-kcal_100g']) ??
      (kilojoules === null ? null : Math.round(kilojoules / KJ_PER_KCAL)),
    proteinGrams: readNumber(nutriments['proteins_100g']),
    carbohydrateGrams: readNumber(nutriments['carbohydrates_100g']),
    fatGrams: readNumber(nutriments['fat_100g']),
    fiberGrams: readNumber(nutriments['fiber_100g']),
    sugarsGrams: readNumber(nutriments['sugars_100g']),
    // Salt = sodium × 2.5, for the products that only declare sodium.
    saltGrams:
      readNumber(nutriments['salt_100g']) ??
      (sodium === null ? null : Math.round(sodium * 2.5 * 100) / 100),
  });

  const per100g = keepPlausibleNutrients(candidate);

  const brand = readText(data.brands)?.split(',')[0]?.trim() ?? null;

  return {
    barcode,
    name: name.slice(0, 120),
    brand: brand ? brand.slice(0, 80) : null,
    per100g,
    incomplete: MAIN_KEYS.some((key) => per100g[key] === null),
  };
}

/**
 * Looks a product up in Open Food Facts (public API, no key). Returns null when
 * the product does not exist; throws on network errors.
 */
export async function fetchProduct(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProductData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,product_name_es,generic_name,brands,nutriments`,
      {
        headers: { 'User-Agent': 'JfooD/0.1 (Android nutrition tracker)' },
        signal: controller.signal,
      },
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error('El servicio de productos no responde.');

    return mapOpenFoodFactsProduct(await response.json(), barcode);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La búsqueda del producto ha tardado demasiado.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
