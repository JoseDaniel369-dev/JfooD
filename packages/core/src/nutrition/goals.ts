import { z } from 'zod';

export const MIFFLIN_VARIANTS = ['male', 'female'] as const;
export const ACTIVITY_LEVELS = [
  'sedentary',
  'light',
  'moderate',
  'high',
  'very_high',
] as const;

export const mifflinVariantSchema = z.enum(MIFFLIN_VARIANTS);
export const activityLevelSchema = z.enum(ACTIVITY_LEVELS);

export type MifflinVariant = z.infer<typeof mifflinVariantSchema>;
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isRealCalendarDate(value), {
    message: 'Fecha de nacimiento no válida.',
  });

function isRealCalendarDate(value: string): boolean {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const userProfileSchema = z.object({
  weightKg: z.number().positive().max(300),
  heightCm: z.number().positive().max(300),
  birthDate: birthDateSchema,
  variant: mifflinVariantSchema,
  activityLevel: activityLevelSchema,
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export interface NutritionGoals {
  caloriesKcal: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

/**
 * Calculates full years between a birth date (YYYY-MM-DD) and a reference date.
 * Uses UTC to avoid timezone surprises near midnight.
 */
export function calculateAge(
  birthDate: string,
  asOf: Date = new Date(),
): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) {
    return 0;
  }

  const birth = new Date(Date.UTC(year, month - 1, day));
  const reference = new Date(
    Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()),
  );

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = reference.getUTCDate() - birth.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return Math.max(0, age);
}

interface BmrInput {
  weightKg: number;
  heightCm: number;
  age: number;
  variant: MifflinVariant;
}

/**
 * Mifflin-St Jeor basal metabolic rate.
 */
export function calculateBmr({
  weightKg,
  heightCm,
  age,
  variant,
}: BmrInput): number {
  const validatedAge = Math.max(0, age);
  const base = 10 * weightKg + 6.25 * heightCm - 5 * validatedAge;
  return variant === 'male' ? base + 5 : base - 161;
}

/**
 * Total daily energy expenditure from BMR and activity level.
 */
export function calculateTdee(
  bmr: number,
  activityLevel: ActivityLevel,
): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

interface NutritionGoalsInput {
  weightKg: number;
  tdee: number;
}

const PROTEIN_PER_KG = 1.6;
const FAT_RATIO = 0.25;
const KCAL_PER_PROTEIN_GRAM = 4;
const KCAL_PER_CARB_GRAM = 4;
const KCAL_PER_FAT_GRAM = 9;

/**
 * Splits TDEE into macros:
 * - Protein: 1.6 g per kg of body weight.
 * - Fat: 25 % of total calories.
 * - Carbohydrates: remaining calories.
 */
export function calculateNutritionGoals({
  weightKg,
  tdee,
}: NutritionGoalsInput): NutritionGoals {
  const caloriesKcal = Math.round(tdee);
  const proteinGrams = Math.round(weightKg * PROTEIN_PER_KG);
  const fatGrams = Math.round((tdee * FAT_RATIO) / KCAL_PER_FAT_GRAM);

  const proteinKcal = proteinGrams * KCAL_PER_PROTEIN_GRAM;
  const fatKcal = fatGrams * KCAL_PER_FAT_GRAM;
  const remainingKcal = Math.max(0, tdee - proteinKcal - fatKcal);
  const carbohydrateGrams = Math.round(remainingKcal / KCAL_PER_CARB_GRAM);

  return {
    caloriesKcal,
    proteinGrams,
    carbohydrateGrams,
    fatGrams,
  };
}
