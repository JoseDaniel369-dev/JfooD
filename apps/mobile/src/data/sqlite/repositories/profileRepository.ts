import type { SQLiteDatabase } from 'expo-sqlite';

import {
  calculateAge,
  calculateBmr,
  calculateNutritionGoals,
  calculateTdee,
  userProfileSchema,
  type NutritionGoals,
  type UserProfile,
} from '@jfood/core';

import { generateId } from '@/data/sqlite/utils/id';
import { toLocalDate } from '@/features/diary/utils/date';

export type ProfileFormData = UserProfile;

interface ProfileRow {
  height_cm: number;
  birth_date: string;
  mifflin_variant: 'male' | 'female';
  activity_level:
    | 'sedentary'
    | 'light'
    | 'moderate'
    | 'high'
    | 'very_high';
  goal_type: 'maintain' | 'lose' | 'gain';
  weekly_rate_kg: number;
  updated_at: string;
}

interface WeightRow {
  weight_kg: number;
}

export async function getProfileFormData(
  database: SQLiteDatabase,
): Promise<ProfileFormData | null> {
  const [profileRow, weightRow] = await Promise.all([
    database.getFirstAsync<ProfileRow>(
      `SELECT height_cm, birth_date, mifflin_variant, activity_level,
              goal_type, weekly_rate_kg, updated_at
       FROM user_profile
       WHERE id = 1`,
    ),
    database.getFirstAsync<WeightRow>(
      `SELECT weight_kg
       FROM weight_logs
       ORDER BY local_date DESC, created_at DESC
       LIMIT 1`,
    ),
  ]);

  if (!profileRow || !weightRow) {
    return null;
  }

  return {
    weightKg: weightRow.weight_kg,
    heightCm: profileRow.height_cm,
    birthDate: profileRow.birth_date,
    variant: profileRow.mifflin_variant,
    activityLevel: profileRow.activity_level,
    goalType: profileRow.goal_type,
    weeklyRateKg: profileRow.weekly_rate_kg,
  };
}

export interface SaveProfileOptions {
  /**
   * Weight that the form displayed when it was loaded. When the submitted
   * weight equals it, the user did not edit the field, so the stored weight
   * logs are left untouched and goals use the latest real weight instead of
   * a possibly stale form value.
   */
  loadedWeightKg?: number | null;
}

const WEIGHT_EPSILON_KG = 0.005;

export async function saveProfile(
  database: SQLiteDatabase,
  formData: ProfileFormData,
  options: SaveProfileOptions = {},
): Promise<NutritionGoals> {
  const profile = userProfileSchema.parse(formData);
  const age = calculateAge(profile.birthDate);
  const now = new Date().toISOString();
  const today = toLocalDate(new Date());
  const weightUntouched =
    options.loadedWeightKg !== undefined &&
    options.loadedWeightKg !== null &&
    Math.abs(options.loadedWeightKg - profile.weightKg) < WEIGHT_EPSILON_KG;

  let goals: NutritionGoals | null = null;

  await database.withTransactionAsync(async () => {
    let effectiveWeightKg = profile.weightKg;
    let writeWeight = true;

    if (weightUntouched) {
      const latest = await database.getFirstAsync<WeightRow>(
        `SELECT weight_kg
         FROM weight_logs
         WHERE local_date <= ?
         ORDER BY local_date DESC, created_at DESC
         LIMIT 1`,
        [today],
      );

      if (latest) {
        effectiveWeightKg = latest.weight_kg;
        writeWeight = false;
      }
    }

    const bmr = calculateBmr({ ...profile, weightKg: effectiveWeightKg, age });
    const tdee = calculateTdee(bmr, profile.activityLevel);
    goals = calculateNutritionGoals({
      weightKg: effectiveWeightKg,
      tdee,
      goalType: profile.goalType,
      weeklyRateKg: profile.weeklyRateKg,
    });

    await database.runAsync(
      `INSERT INTO user_profile (id, height_cm, birth_date, mifflin_variant, activity_level, goal_type, weekly_rate_kg, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         height_cm = excluded.height_cm,
         birth_date = excluded.birth_date,
         mifflin_variant = excluded.mifflin_variant,
         activity_level = excluded.activity_level,
         goal_type = excluded.goal_type,
         weekly_rate_kg = excluded.weekly_rate_kg,
         updated_at = excluded.updated_at`,
      [
        profile.heightCm,
        profile.birthDate,
        profile.variant,
        profile.activityLevel,
        profile.goalType,
        profile.goalType === 'maintain' ? 0 : profile.weeklyRateKg,
        now,
      ],
    );

    await database.runAsync(
      `INSERT INTO nutrition_goals (effective_from, calories_kcal, protein_grams, carbohydrate_grams, fat_grams, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        today,
        goals.caloriesKcal,
        goals.proteinGrams,
        goals.carbohydrateGrams,
        goals.fatGrams,
        now,
      ],
    );

    if (writeWeight) {
      await database.runAsync(
        `INSERT INTO weight_logs (id, local_date, weight_kg, note, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(local_date) DO UPDATE SET
           weight_kg = excluded.weight_kg`,
        [generateId(), today, profile.weightKg, null, now],
      );
    }
  });

  if (!goals) {
    throw new Error('No se han podido calcular los objetivos.');
  }

  return goals;
}
