import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getProfileFormData,
  saveProfile,
  type ProfileFormData,
} from '../../src/data/sqlite/repositories/profileRepository';
import { upsertWeightLog } from '../../src/data/sqlite/repositories/weightRepository';
import { toLocalDate } from '../../src/features/diary/utils/date';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

const today = toLocalDate(new Date());

const profile: ProfileFormData = {
  weightKg: 70,
  heightCm: 175,
  birthDate: '1990-06-15',
  variant: 'male',
  activityLevel: 'moderate',
    goalType: 'maintain',
    weeklyRateKg: 0,
};

async function todaysWeight(db: Awaited<ReturnType<typeof createMigratedDatabase>>) {
  return db.getFirstAsync<{ weight_kg: number; note: string | null }>(
    'SELECT weight_kg, note FROM weight_logs WHERE local_date = ?',
    today,
  );
}

test('first save creates the initial weight log and goals', async () => {
  const db = await createMigratedDatabase();
  const goals = await saveProfile(db.asSqlite(), profile);

  assert.equal((await todaysWeight(db))?.weight_kg, 70);
  assert.ok(goals.caloriesKcal > 0);
  assert.equal((await getProfileFormData(db.asSqlite()))?.weightKg, 70);
});

test('saving an unchanged form never overwrites a newer weight logged today', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  await saveProfile(sqlite, profile);

  // The user logs 69.0 kg from the Progress tab, with a note.
  await upsertWeightLog(sqlite, { localDate: today, weightKg: 69, note: 'tras entrenar' });

  // The Profile form still shows the stale 70 kg it loaded earlier.
  const goals = await saveProfile(
    sqlite,
    { ...profile, activityLevel: 'high' },
    { loadedWeightKg: 70 },
  );

  const weight = await todaysWeight(db);
  assert.equal(weight?.weight_kg, 69);
  assert.equal(weight?.note, 'tras entrenar');
  // Goals are computed with the real, current weight (69 kg → 110 g protein).
  assert.equal(goals.proteinGrams, Math.round(69 * 1.6));
});

test('changing the weight in the form updates today’s log', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  await saveProfile(sqlite, profile);

  await saveProfile(sqlite, { ...profile, weightKg: 68 }, { loadedWeightKg: 70 });

  assert.equal((await todaysWeight(db))?.weight_kg, 68);
});

test('without a loaded weight (onboarding) the typed weight is stored', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  await upsertWeightLog(sqlite, { localDate: today, weightKg: 71 });

  await saveProfile(sqlite, { ...profile, weightKg: 72 });

  assert.equal((await todaysWeight(db))?.weight_kg, 72);
});

test('weight logs reject future and malformed dates', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();

  await assert.rejects(
    () => upsertWeightLog(sqlite, { localDate: '2999-01-01', weightKg: 70 }),
    /fecha futura/,
  );
  await assert.rejects(
    () => upsertWeightLog(sqlite, { localDate: 'garbage', weightKg: 70 }),
    /fecha no es válida/,
  );
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM weight_logs');
  assert.equal(count?.c, 0);
});

test('the weight goal is stored, lowers the calorie target and survives a reload', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();

  const maintain = await saveProfile(sqlite, profile);
  const lose = await saveProfile(sqlite, { ...profile, goalType: 'lose', weeklyRateKg: 0.5 }, { loadedWeightKg: 70 });

  assert.equal(maintain.caloriesKcal - lose.caloriesKcal, 550);
  const stored = await getProfileFormData(sqlite);
  assert.equal(stored?.goalType, 'lose');
  assert.equal(stored?.weeklyRateKg, 0.5);

  // Going back to maintenance stores a zero rate.
  await saveProfile(sqlite, { ...profile, goalType: 'maintain', weeklyRateKg: 0.75 }, { loadedWeightKg: 70 });
  assert.equal((await getProfileFormData(sqlite))?.weeklyRateKg, 0);
});

test('a database created before the goal existed migrates with "maintain"', async () => {
  const { TestDatabase } = await import('../helpers/sqliteAdapter');
  const { migrateDatabase } = await import('../../src/data/sqlite/migrate');
  const { initialMigration } = await import('../../src/data/sqlite/migrations/001_initial');
  const { planMigration } = await import('../../src/data/sqlite/migrations/002_plan');
  const { settingsMigration } = await import('../../src/data/sqlite/migrations/003_settings');
  const { waterMigration } = await import('../../src/data/sqlite/migrations/004_water');

  const old = new TestDatabase();
  for (const sql of [initialMigration, planMigration, settingsMigration, waterMigration]) {
    await old.execAsync(sql);
  }
  await old.execAsync('PRAGMA user_version = 4');
  await old.execAsync(`INSERT INTO user_profile (id, height_cm, birth_date, mifflin_variant, activity_level, updated_at)
    VALUES (1, 175, '1990-06-15', 'male', 'moderate', '2026-11-01T00:00:00.000Z')`);

  await migrateDatabase(old.asSqlite());

  const row = await old.getFirstAsync<{ goal_type: string; weekly_rate_kg: number }>(
    'SELECT goal_type, weekly_rate_kg FROM user_profile',
  );
  assert.deepEqual(row, { goal_type: 'maintain', weekly_rate_kg: 0 });
});
