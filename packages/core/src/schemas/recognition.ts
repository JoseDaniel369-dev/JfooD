import { z } from 'zod';

/**
 * Gemini may identify foods and estimate portions, never provide nutrients.
 * Strict objects reject accidental nutritional fields in model responses.
 */
export const recognizedFoodSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    estimatedGrams: z.number().positive().max(10_000),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

export const foodRecognitionSchema = z
  .object({
    foods: z.array(recognizedFoodSchema).max(30),
    warnings: z.array(z.string().trim().min(1).max(300)).max(10),
  })
  .strict();

/** Largest accepted base64 payload (about 6 MB of image). */
export const MAX_IMAGE_BASE64_CHARS = 8_000_000;

const IMAGE_DATA_URI_PREFIX =
  /^data:image\/(?:jpeg|jpg|png|webp|heic|heif);base64,/i;
const BASE64_BODY = /^[A-Za-z0-9+/\s]+={0,2}\s*$/;

/**
 * Body of POST /recognize: one image, either a data URI of a common image type
 * or raw base64. Anything else is rejected before it is sent to Gemini.
 */
export const recognizeRequestSchema = z.object({
  image: z
    .string()
    .min(4)
    .max(MAX_IMAGE_BASE64_CHARS)
    .refine(
      (value) => {
        const prefix = IMAGE_DATA_URI_PREFIX.exec(value)?.[0];
        if (prefix) {
          return BASE64_BODY.test(value.slice(prefix.length));
        }
        return !value.startsWith('data:') && BASE64_BODY.test(value);
      },
      { message: 'La imagen debe ser JPEG, PNG o WebP en base64.' },
    ),
});

export type RecognizeRequest = z.infer<typeof recognizeRequestSchema>;

export const MAX_MEAL_TEXT_CHARS = 500;

/** Body of POST /parse-meal: a free-text description of what was eaten. */
export const parseMealRequestSchema = z.object({
  text: z.string().trim().min(2).max(MAX_MEAL_TEXT_CHARS),
});

export type ParseMealRequest = z.infer<typeof parseMealRequestSchema>;

export type RecognizedFood = z.infer<typeof recognizedFoodSchema>;
export type FoodRecognition = z.infer<typeof foodRecognitionSchema>;

/**
 * Keys that would carry nutrition facts. A model answer containing any of them is
 * refused as a whole: nutrients must never come from the model.
 */
const NUTRIENT_KEY = /kcal|calor|energ|nutri|prote|carb|hidrat|\bfat|grasa|lipid|fib|sugar|az[uú]car|\bsalt|sodi/i;

function hasNutrientKey(value: object): boolean {
  return Object.keys(value).some((key) => NUTRIENT_KEY.test(key));
}

/**
 * Reads what the model answered, forgiving harmless slips so one odd field does
 * not throw away a whole good answer:
 * - a missing/invalid `confidence` becomes null, a missing `warnings` becomes [];
 * - unknown harmless keys (e.g. "unit") are dropped;
 * - a food with no usable name or a non-positive weight is skipped, and a
 *   warning says some foods could not be read.
 * Anything that carries nutrition keys, or does not have a `foods` array, is
 * refused (null). The result always satisfies the strict `foodRecognitionSchema`.
 */
export function parseRecognitionResponse(raw: unknown): FoodRecognition | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  if (hasNutrientKey(raw)) return null;

  const { foods: rawFoods, warnings: rawWarnings } = raw as Record<string, unknown>;
  if (!Array.isArray(rawFoods)) return null;

  const foods: RecognizedFood[] = [];
  let skipped = 0;

  for (const item of rawFoods) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      skipped += 1;
      continue;
    }
    if (hasNutrientKey(item)) return null;

    const { name, estimatedGrams, confidence } = item as Record<string, unknown>;
    const cleanName = typeof name === 'string' ? name.trim().slice(0, 120) : '';
    const grams =
      typeof estimatedGrams === 'number' && Number.isFinite(estimatedGrams)
        ? Math.min(estimatedGrams, 10_000)
        : 0;

    if (cleanName === '' || grams <= 0) {
      skipped += 1;
      continue;
    }

    foods.push({
      name: cleanName,
      estimatedGrams: grams,
      confidence:
        typeof confidence === 'number' && Number.isFinite(confidence)
          ? Math.min(Math.max(confidence, 0), 1)
          : null,
    });
  }

  const warnings = (Array.isArray(rawWarnings) ? rawWarnings : [])
    .filter((warning): warning is string => typeof warning === 'string')
    .map((warning) => warning.trim().slice(0, 300))
    .filter((warning) => warning !== '')
    .slice(0, 9);

  if (skipped > 0) {
    warnings.push('Algunos alimentos no se han podido interpretar.');
  }

  const parsed = foodRecognitionSchema.safeParse({ foods: foods.slice(0, 30), warnings });
  return parsed.success ? parsed.data : null;
}
