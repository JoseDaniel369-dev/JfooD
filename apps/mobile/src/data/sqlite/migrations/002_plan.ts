export const planMigration = `
  CREATE TABLE plan_entries (
    id TEXT PRIMARY KEY NOT NULL,
    local_date TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
    food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
    food_name TEXT NOT NULL,
    grams REAL NOT NULL CHECK (grams > 0),
    calories_kcal REAL CHECK (calories_kcal IS NULL OR calories_kcal >= 0),
    protein_grams REAL CHECK (protein_grams IS NULL OR protein_grams >= 0),
    carbohydrate_grams REAL CHECK (carbohydrate_grams IS NULL OR carbohydrate_grams >= 0),
    fat_grams REAL CHECK (fat_grams IS NULL OR fat_grams >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX idx_plan_entries_date ON plan_entries(local_date);
  CREATE INDEX idx_plan_entries_food ON plan_entries(food_id);
`;
