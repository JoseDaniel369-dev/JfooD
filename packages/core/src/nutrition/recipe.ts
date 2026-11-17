import { gramsSchema, nutrientsPer100gSchema, type Nutrients } from './nutrients.js';

export interface RecipeIngredient {
  /** Nutrients per 100 g of the ingredient (null = unknown). */
  per100g: Nutrients;
  grams: number;
}

export interface RecipeResult {
  /** Weight the nutrients are divided by: the final weight, or the sum of the ingredients. */
  totalGrams: number;
  per100g: Nutrients;
}

const NUTRIENT_KEYS = [
  'caloriesKcal',
  'proteinGrams',
  'carbohydrateGrams',
  'fatGrams',
] as const;

/**
 * Nutrients per 100 g of a recipe made from ingredients.
 *
 * `finalWeightGrams` is the weight of the cooked dish (water lost or gained
 * while cooking). A nutrient is unknown (null) when ANY ingredient lacks it:
 * unknown never counts as zero.
 */
export function computeRecipe(
  ingredients: readonly RecipeIngredient[],
  finalWeightGrams?: number,
): RecipeResult {
  if (ingredients.length === 0) {
    throw new Error('La receta necesita al menos un ingrediente.');
  }

  const validated = ingredients.map((ingredient) => ({
    per100g: nutrientsPer100gSchema.parse(ingredient.per100g),
    grams: gramsSchema.parse(ingredient.grams),
  }));

  const ingredientsGrams = validated.reduce((sum, item) => sum + item.grams, 0);
  const totalGrams =
    finalWeightGrams === undefined
      ? ingredientsGrams
      : gramsSchema.parse(finalWeightGrams);

  const per100g = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const values = validated.map((item) => item.per100g[key]);
    per100g[key] = values.includes(null)
      ? null
      : round(
          (validated.reduce(
            (sum, item) => sum + ((item.per100g[key] ?? 0) * item.grams) / 100,
            0,
          ) /
            totalGrams) *
            100,
        );
  }

  return { totalGrams: round(totalGrams), per100g };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
