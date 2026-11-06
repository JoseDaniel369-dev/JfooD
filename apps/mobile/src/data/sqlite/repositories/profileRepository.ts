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
      `SELECT height_cm, birth_date, mifflin_variant, activity_level, updated_at
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
  };
}

export async function saveProfile(
  database: SQLiteDatabase,
  formData: ProfileFormData,
): Promise<NutritionGoals> {
  const profile = userProfileSchema.parse(formData);
  const age = calculateAge(profile.birthDate);
  const bmr = calculateBmr({ ...profile, age });
  const tdee = calculateTdee(bmr, profile.activityLevel);
  const goals = calculateNutritionGoals({
    weightKg: profile.weightKg,
    tdee,
  });
  const now = new Date().toISOString();
  const today = toLocalDate(new Date());

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO user_profile (id, height_cm, birth_date, mifflin_variant, activity_level, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         height_cm = excluded.height_cm,
         birth_date = excluded.birth_date,
         mifflin_variant = excluded.mifflin_variant,
         activity_level = excluded.activity_level,
         updated_at = excluded.updated_at`,
      [
        profile.heightCm,
        profile.birthDate,
        profile.variant,
        profile.activityLevel,
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

    await database.runAsync(
      `INSERT INTO weight_logs (id, local_date, weight_kg, note, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(local_date) DO UPDATE SET
         weight_kg = excluded.weight_kg`,
      [generateId(), today, profile.weightKg, null, now],
    );
  });

  return goals;
}
