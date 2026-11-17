import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateAge,
  calculateBmr,
  calculateNutritionGoals,
  calculateTdee,
  userProfileSchema,
} from '../src/nutrition/goals.js';

test('calculates age in full years', () => {
  const asOf = new Date(2026, 9, 5); // 5 Oct 2026

  assert.equal(calculateAge('1990-01-01', asOf), 36);
  assert.equal(calculateAge('1990-10-05', asOf), 36);
  assert.equal(calculateAge('1990-10-06', asOf), 35);
  assert.equal(calculateAge('2026-10-04', asOf), 0);
});

test('rejects invalid birth dates in schema', () => {
  const result = userProfileSchema.safeParse({
    weightKg: 70,
    heightCm: 175,
    birthDate: 'not-a-date',
    variant: 'male',
    activityLevel: 'moderate',
  });

  assert.equal(result.success, false);
});

test('rejects impossible calendar dates', () => {
  const result = userProfileSchema.safeParse({
    weightKg: 70,
    heightCm: 175,
    birthDate: '1990-02-31',
    variant: 'male',
    activityLevel: 'moderate',
  });

  assert.equal(result.success, false);
});

test('rejects future birth dates', () => {
  const result = userProfileSchema.safeParse({
    weightKg: 70,
    heightCm: 175,
    birthDate: '2999-01-01',
    variant: 'male',
    activityLevel: 'moderate',
  });

  assert.equal(result.success, false);
});

test('calculates Mifflin-St Jeor BMR for a male', () => {
  // 30 years, 70 kg, 175 cm, male => 10*70 + 6.25*175 - 5*30 + 5 = 1 648.75
  const bmr = calculateBmr({
    weightKg: 70,
    heightCm: 175,
    age: 30,
    variant: 'male',
  });

  assert.equal(Math.round(bmr), 1649);
});

test('calculates Mifflin-St Jeor BMR for a female', () => {
  // 30 years, 60 kg, 165 cm, female => 10*60 + 6.25*165 - 5*30 - 161 = 1 320.25
  const bmr = calculateBmr({
    weightKg: 60,
    heightCm: 165,
    age: 30,
    variant: 'female',
  });

  assert.equal(Math.round(bmr), 1320);
});

test('calculates TDEE from activity level', () => {
  const bmr = 1500;

  assert.equal(calculateTdee(bmr, 'sedentary'), 1800);
  assert.equal(calculateTdee(bmr, 'light'), 2062.5);
  assert.equal(calculateTdee(bmr, 'moderate'), 2325);
  assert.equal(calculateTdee(bmr, 'high'), 2587.5);
  assert.equal(calculateTdee(bmr, 'very_high'), 2850);
});

test('splits TDEE into macros using 1.6 g/kg protein and 25% fat', () => {
  const goals = calculateNutritionGoals({ weightKg: 70, tdee: 2000 });

  assert.equal(goals.caloriesKcal, 2000);
  assert.equal(goals.proteinGrams, 112); // 70 * 1.6 = 112
  assert.equal(goals.fatGrams, 56); // 2000 * 0.25 / 9 = 55.5… → 56

  const proteinKcal = goals.proteinGrams * 4;
  const fatKcal = goals.fatGrams * 9;
  const carbKcal = goals.carbohydrateGrams * 4;

  // Carbohydrates fill the remaining calories.
  assert.ok(carbKcal >= 0);
  assert.ok(Math.abs(proteinKcal + fatKcal + carbKcal - 2000) <= 6);
});

test('validates a complete user profile', () => {
  const profile = userProfileSchema.parse({
    weightKg: 70,
    heightCm: 175,
    birthDate: '1990-06-15',
    variant: 'male',
    activityLevel: 'moderate',
  });

  assert.equal(profile.weightKg, 70);
  assert.equal(profile.variant, 'male');
});

test('rejects implausible weight, height and age instead of producing absurd goals', () => {
  const base = {
    weightKg: 70,
    heightCm: 175,
    birthDate: '1990-06-15',
    variant: 'female' as const,
    activityLevel: 'sedentary' as const,
  };

  assert.equal(userProfileSchema.safeParse({ ...base, weightKg: 1 }).success, false);
  assert.equal(userProfileSchema.safeParse({ ...base, weightKg: 24.9 }).success, false);
  assert.equal(userProfileSchema.safeParse({ ...base, heightCm: 1 }).success, false);
  assert.equal(userProfileSchema.safeParse({ ...base, heightCm: 251 }).success, false);
  assert.equal(userProfileSchema.safeParse({ ...base, birthDate: '1900-01-01' }).success, false);
  assert.equal(userProfileSchema.safeParse({ ...base, birthDate: '2026-01-01' }).success, false);
  assert.equal(userProfileSchema.safeParse(base).success, true);
});

test('calorie goals are never below the safety floor', () => {
  const goals = calculateNutritionGoals({ weightKg: 25, tdee: 150 });
  assert.equal(goals.caloriesKcal, 1200);
  assert.ok(goals.carbohydrateGrams >= 0 && goals.fatGrams >= 0);

  const negative = calculateNutritionGoals({ weightKg: 1, tdee: -750 });
  assert.equal(negative.caloriesKcal, 1200);
  assert.ok(negative.fatGrams > 0);
});
