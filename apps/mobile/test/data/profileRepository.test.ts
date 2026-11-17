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
