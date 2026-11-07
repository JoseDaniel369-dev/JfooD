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

export interface CreateFoodInput {
  name: string;
  brand?: string | null;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
}
