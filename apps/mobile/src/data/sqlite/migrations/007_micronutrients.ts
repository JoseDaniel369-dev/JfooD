const TABLES = ['foods', 'diary_entries', 'plan_entries'] as const;
const COLUMNS = ['fiber_grams', 'sugars_grams', 'salt_grams'] as const;

/**
 * Fibre, sugars and salt per 100 g (foods) or per 100 g snapshot (entries).
 * Additive: every existing row keeps working, with the new values NULL, which
 * means "unknown" (never zero).
 */
export const micronutrientsMigration = TABLES.flatMap((table) =>
  COLUMNS.map(
    (column) =>
      `ALTER TABLE ${table} ADD COLUMN ${column} REAL CHECK (${column} IS NULL OR ${column} >= 0);`,
  ),
).join('\n');
