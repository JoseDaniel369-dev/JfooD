import { z } from 'zod';

export const nullableNutrientSchema = z.number().min(0).nullable();

export const nutrientsPer100gSchema = z
  .object({
    caloriesKcal: nullableNutrientSchema,
    proteinGrams: nullableNutrientSchema,
    carbohydrateGrams: nullableNutrientSchema,
    fatGrams: nullableNutrientSchema,
  })
  .strict();

export const gramsSchema = z.number().positive().max(100_000);

export type Nutrients = z.infer<typeof nutrientsPer100gSchema>;

/** Calculates consumed nutrients from values expressed per 100 grams. */
export function calculateNutrients(per100g: Nutrients, grams: number): Nutrients {
  const nutrients = nutrientsPer100gSchema.parse(per100g);
  const validGrams = gramsSchema.parse(grams);

  return {
    caloriesKcal: scaleNutrient(nutrients.caloriesKcal, validGrams),
    proteinGrams: scaleNutrient(nutrients.proteinGrams, validGrams),
    carbohydrateGrams: scaleNutrient(nutrients.carbohydrateGrams, validGrams),
    fatGrams: scaleNutrient(nutrients.fatGrams, validGrams),
  };
}

/**
 * Adds nutrients without treating missing data as zero.
 * A total is null when any of its components is unknown.
 */
export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  return {
    caloriesKcal: sumNutrient(items.map((item) => item.caloriesKcal)),
    proteinGrams: sumNutrient(items.map((item) => item.proteinGrams)),
    carbohydrateGrams: sumNutrient(
      items.map((item) => item.carbohydrateGrams),
    ),
    fatGrams: sumNutrient(items.map((item) => item.fatGrams)),
  };
}

function scaleNutrient(value: number | null, grams: number): number | null {
  return value === null ? null : (value * grams) / 100;
}

function sumNutrient(values: readonly (number | null)[]): number | null {
  return values.includes(null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}
