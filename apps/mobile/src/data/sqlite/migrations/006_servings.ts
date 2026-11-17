/** Named portions per food ("1 unidad" = 60 g). Additive: no existing table changes. */
export const servingsMigration = `
  CREATE TABLE food_servings (
    id TEXT PRIMARY KEY NOT NULL,
    food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
    grams REAL NOT NULL CHECK (grams > 0 AND grams <= 100000),
    created_at TEXT NOT NULL,
    UNIQUE (food_id, label)
  );

  CREATE INDEX idx_food_servings_food ON food_servings(food_id);
`;
