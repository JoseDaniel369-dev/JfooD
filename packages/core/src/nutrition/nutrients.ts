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
 * Limits for nutrition values typed by a person (creating or editing a food).
 * They apply to INPUT only: stored rows are never re-validated against them,
 * so tightening these limits can never make historical days unreadable.
 */
export const FOOD_INPUT_LIMITS = {
  maxCaloriesKcalPer100g: 950,
  maxMacroGramsPer100g: 100,
  /** protein + carbohydrates + fat cannot exceed 100 g of food (small tolerance). */
  maxMacroSumGramsPer100g: 102,
} as const;

export const foodInputNutrientsSchema = nutrientsPer100gSchema.superRefine(
  (value, context) => {
    if (
      value.caloriesKcal !== null &&
      value.caloriesKcal > FOOD_INPUT_LIMITS.maxCaloriesKcalPer100g
    ) {
      context.addIssue({
        code: 'custom',
        path: ['caloriesKcal'],
        message: 'Las calorías por 100 g no pueden superar 950 kcal.',
      });
    }

    for (const key of ['proteinGrams', 'carbohydrateGrams', 'fatGrams'] as const) {
      const grams = value[key];
      if (grams !== null && grams > FOOD_INPUT_LIMITS.maxMacroGramsPer100g) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Un macronutriente no puede superar 100 g por cada 100 g.',
        });
      }
    }

    const macroSum =
      (value.proteinGrams ?? 0) +
      (value.carbohydrateGrams ?? 0) +
      (value.fatGrams ?? 0);
    if (macroSum > FOOD_INPUT_LIMITS.maxMacroSumGramsPer100g) {
      context.addIssue({
        code: 'custom',
        path: [],
        message:
          'Proteínas + carbohidratos + grasas no pueden superar 100 g por cada 100 g.',
      });
    }
  },
);

/** Sum of the known values of one nutrient, keeping track of unknown ones. */
export interface PartialNutrient {
  /** Sum of the values that are known. Never includes unknown values as zero. */
  knownTotal: number;
  /** How many items had no value for this nutrient. */
  unknownCount: number;
  /** True when every item had a value, so knownTotal is the real total. */
  complete: boolean;
}

export type PartialNutrients = {
  [Key in keyof Nutrients]: PartialNutrient;
};

/**
 * Adds nutrients reporting what is known and how much is missing, so the UI
 * can say "at least X kcal, 2 foods without data" instead of hiding the day.
 * Use `sumNutrients` when a strict total (null if anything is unknown) is needed.
 */
export function sumNutrientsKnown(items: readonly Nutrients[]): PartialNutrients {
  return {
    caloriesKcal: partialNutrient(items.map((item) => item.caloriesKcal)),
    proteinGrams: partialNutrient(items.map((item) => item.proteinGrams)),
    carbohydrateGrams: partialNutrient(
      items.map((item) => item.carbohydrateGrams),
    ),
    fatGrams: partialNutrient(items.map((item) => item.fatGrams)),
  };
}

function partialNutrient(values: readonly (number | null)[]): PartialNutrient {
  let knownTotal = 0;
  let unknownCount = 0;

  for (const value of values) {
    if (value === null) {
      unknownCount += 1;
    } else {
      knownTotal += value;
    }
  }

  return { knownTotal, unknownCount, complete: unknownCount === 0 };
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
