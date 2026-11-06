export const initialMigration = `
  CREATE TABLE foods (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT,
    source TEXT NOT NULL CHECK (source IN ('bedca', 'open_food_facts', 'user', 'seed')),
    external_id TEXT,
    calories_kcal REAL CHECK (calories_kcal IS NULL OR calories_kcal >= 0),
    protein_grams REAL CHECK (protein_grams IS NULL OR protein_grams >= 0),
    carbohydrate_grams REAL CHECK (carbohydrate_grams IS NULL OR carbohydrate_grams >= 0),
    fat_grams REAL CHECK (fat_grams IS NULL OR fat_grams >= 0),
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    cached_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (source, external_id)
  );

  CREATE INDEX idx_foods_normalized_name ON foods(normalized_name);
  CREATE INDEX idx_foods_favorite ON foods(is_favorite) WHERE is_favorite = 1;
  CREATE UNIQUE INDEX idx_foods_barcode ON foods(barcode) WHERE barcode IS NOT NULL;

  CREATE TABLE diary_meals (
    id TEXT PRIMARY KEY NOT NULL,
    local_date TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
    created_at TEXT NOT NULL,
    UNIQUE (local_date, meal_type)
  );

  CREATE TABLE diary_entries (
    id TEXT PRIMARY KEY NOT NULL,
    meal_id TEXT NOT NULL REFERENCES diary_meals(id) ON DELETE CASCADE,
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

  CREATE INDEX idx_diary_meals_date ON diary_meals(local_date);
  CREATE INDEX idx_diary_entries_meal ON diary_entries(meal_id);
  CREATE INDEX idx_diary_entries_food ON diary_entries(food_id);

  CREATE TABLE user_profile (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    height_cm REAL CHECK (height_cm IS NULL OR height_cm > 0),
    birth_date TEXT,
    mifflin_variant TEXT CHECK (mifflin_variant IS NULL OR mifflin_variant IN ('male', 'female')),
    activity_level TEXT CHECK (activity_level IS NULL OR activity_level IN ('sedentary', 'light', 'moderate', 'high', 'very_high')),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE nutrition_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    effective_from TEXT NOT NULL,
    calories_kcal REAL NOT NULL CHECK (calories_kcal > 0),
    protein_grams REAL NOT NULL CHECK (protein_grams >= 0),
    carbohydrate_grams REAL NOT NULL CHECK (carbohydrate_grams >= 0),
    fat_grams REAL NOT NULL CHECK (fat_grams >= 0),
    created_at TEXT NOT NULL
  );

  CREATE INDEX idx_nutrition_goals_effective_from ON nutrition_goals(effective_from);

  CREATE TABLE weight_logs (
    id TEXT PRIMARY KEY NOT NULL,
    local_date TEXT NOT NULL,
    weight_kg REAL NOT NULL CHECK (weight_kg > 0),
    note TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (local_date)
  );

  CREATE INDEX idx_weight_logs_date ON weight_logs(local_date);
`;
