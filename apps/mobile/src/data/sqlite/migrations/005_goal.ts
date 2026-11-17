/** Adds the weight goal to the profile. Existing rows keep "maintain". */
export const goalMigration = `
  ALTER TABLE user_profile
    ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'maintain'
    CHECK (goal_type IN ('maintain', 'lose', 'gain'));

  ALTER TABLE user_profile
    ADD COLUMN weekly_rate_kg REAL NOT NULL DEFAULT 0
    CHECK (weekly_rate_kg >= 0 AND weekly_rate_kg <= 1);
`;
