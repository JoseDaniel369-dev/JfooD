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

export type RecognizedFood = z.infer<typeof recognizedFoodSchema>;
export type FoodRecognition = z.infer<typeof foodRecognitionSchema>;
