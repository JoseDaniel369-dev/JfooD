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

export type RecognizedFood = z.infer<typeof recognizedFoodSchema>;
export type FoodRecognition = z.infer<typeof foodRecognitionSchema>;
