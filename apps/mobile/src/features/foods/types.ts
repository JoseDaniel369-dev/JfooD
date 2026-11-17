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
}
