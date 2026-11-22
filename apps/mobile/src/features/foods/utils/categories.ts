import { SEED_CATALOG } from '@/data/seed/seedCatalog';

export interface FoodCategory {
  name: string;
  emoji: string;
  /** Ids of the catalog foods of this category, in catalog order. */
  ids: string[];
}

const CATEGORY_EMOJIS: Record<string, string> = {
  Frutas: '🍎',
  'Verduras y hortalizas': '🥦',
  Legumbres: '🫘',
  'Cereales, pan y pasta': '🍞',
  'Carnes y embutidos': '🍗',
  'Pescados y mariscos': '🐟',
  'Huevos y lácteos': '🥚',
  'Grasas, frutos secos y salsas': '🥜',
  Bebidas: '🥤',
  'Dulces y snacks': '🍫',
  'Platos preparados': '🍲',
};

/** The categories of the base catalog, in the order they were written. */
export function buildFoodCategories(
  catalog: readonly { id: string; category: string }[] = SEED_CATALOG,
): FoodCategory[] {
  const byName = new Map<string, FoodCategory>();

  for (const food of catalog) {
    let category = byName.get(food.category);
    if (!category) {
      category = { name: food.category, emoji: CATEGORY_EMOJIS[food.category] ?? '🍽️', ids: [] };
      byName.set(food.category, category);
    }
    category.ids.push(food.id);
  }

  return [...byName.values()];
}

export const FOOD_CATEGORIES = buildFoodCategories();
