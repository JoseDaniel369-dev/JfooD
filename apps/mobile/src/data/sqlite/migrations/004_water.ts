export const waterMigration = `
  CREATE TABLE water_logs (
    id TEXT PRIMARY KEY NOT NULL,
    local_date TEXT NOT NULL,
    amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
    created_at TEXT NOT NULL
  );

  CREATE INDEX idx_water_logs_date ON water_logs(local_date);
`;
