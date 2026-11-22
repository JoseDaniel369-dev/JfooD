import { makeNutrients, type Nutrients } from '@jfood/core';

export type FoodSource = 'bedca' | 'open_food_facts' | 'user' | 'seed';

export interface Food {
  id: string;
  name: string;
  normalizedName: string;
  brand: string | null;
  barcode: string | null;
  source: FoodSource;
  externalId: string | null;
  caloriesKcal: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarsGrams: number | null;
  saltGrams: number | null;
  isFavorite: boolean;
  cachedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Foods the person may edit or delete (their own and ones imported from a barcode). */
export function isEditableSource(source: FoodSource): boolean {
  return source === 'user' || source === 'open_food_facts';
}

export interface CreateFoodInput {
  name: string;
  /** Barcode of a packaged product (digits only). */
  barcode?: string | null;
  source?: FoodSource;
  externalId?: string | null;
  brand?: string | null;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
  fiberGrams?: number | null;
  sugarsGrams?: number | null;
  saltGrams?: number | null;
}

/** The nutrients per 100 g of a food, as the engine expects them. */
export function foodNutrients(food: Pick<Food, 'caloriesKcal' | 'proteinGrams' | 'carbohydrateGrams' | 'fatGrams' | 'fiberGrams' | 'sugarsGrams' | 'saltGrams'>): Nutrients {
  return makeNutrients({
    caloriesKcal: food.caloriesKcal,
    proteinGrams: food.proteinGrams,
    carbohydrateGrams: food.carbohydrateGrams,
    fatGrams: food.fatGrams,
    fiberGrams: food.fiberGrams,
    sugarsGrams: food.sugarsGrams,
    saltGrams: food.saltGrams,
  });
}
