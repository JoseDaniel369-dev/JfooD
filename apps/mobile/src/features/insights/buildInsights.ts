import type { NutritionGoals, PartialNutrients, SecondaryTargets } from '@jfood/core';

import type { MealType } from '@/features/diary/types';

export type InsightTone = 'success' | 'warning' | 'info';

export type InsightKind =
  | 'goal-reached'
  | 'over-goal'
  | 'streak-at-risk'
  | 'missing-meal'
  | 'protein'
  | 'water'
  | 'fiber'
  | 'start-day';

export interface Insight {
  kind: InsightKind;
  tone: InsightTone;
  emoji: string;
  title: string;
  message: string;
}

export interface InsightInput {
  /** Local hour, 0-23. */
  hour: number;
  goals: NutritionGoals;
  targets: SecondaryTargets;
  consumed: Pick<PartialNutrients, 'caloriesKcal' | 'proteinGrams' | 'fiberGrams'>;
  /** Entries logged today per meal. */
  mealEntries: Readonly<Record<MealType, number>>;
  waterMl: number;
  waterGoalMl: number;
  /** Days in a row with entries, counting today if it already has some. */
  streakDays: number;
}

/** A meal is "missing" once the day has moved past this hour without it. */
const MEAL_DEADLINES: readonly { meal: MealType; hour: number; label: string }[] = [
  { meal: 'breakfast', hour: 11, label: 'el desayuno' },
  { meal: 'lunch', hour: 16, label: 'la comida' },
  { meal: 'dinner', hour: 22, label: 'la cena' },
];

/** At most this many tips are shown, most important first. */
export const MAX_INSIGHTS = 3;

/**
 * What is worth telling the person right now, most important first. Pure: the
 * same day and hour always give the same tips. Tips about missing data never
 * treat "unknown" as zero: a nutrient nobody knows about is not "short".
 */
export function buildInsights(input: InsightInput): Insight[] {
  const { hour, goals, targets, consumed, mealEntries, waterMl, waterGoalMl, streakDays } = input;
  const totalEntries = Object.values(mealEntries).reduce((sum, count) => sum + count, 0);
  const kcal = consumed.caloriesKcal;
  const insights: Insight[] = [];

  // 1. The day is done and on target.
  if (kcal.complete && totalEntries > 0 && hour >= 18) {
    const ratio = kcal.knownTotal / goals.caloriesKcal;
    if (ratio >= 0.9 && ratio <= 1.1) {
      insights.push({
        kind: 'goal-reached',
        tone: 'success',
        emoji: '🎯',
        title: '¡Objetivo del día cumplido!',
        message: `Llevas ${Math.round(kcal.knownTotal)} de ${Math.round(goals.caloriesKcal)} kcal. Así da gusto.`,
      });
    }
  }

  // 2. Certainly over the goal (the known part alone already exceeds it).
  if (kcal.knownTotal > goals.caloriesKcal * 1.1) {
    const extra = Math.round(kcal.knownTotal - goals.caloriesKcal);
    insights.push({
      kind: 'over-goal',
      tone: 'warning',
      emoji: '⚖️',
      title: `Te has pasado ${extra} kcal`,
      message: 'No pasa nada: un día no define nada. Mañana vuelves a tu ritmo.',
    });
  }

  // 3. The streak is about to break.
  if (streakDays > 0 && totalEntries === 0 && hour >= 19) {
    insights.push({
      kind: 'streak-at-risk',
      tone: 'warning',
      emoji: '🔥',
      title: `Tu racha de ${streakDays} ${streakDays === 1 ? 'día' : 'días'} está en juego`,
      message: 'Registra algo hoy para mantenerla.',
    });
  }

  // 4. A meal that should be in by now is not.
  for (const { meal, hour: deadline, label } of MEAL_DEADLINES) {
    if (hour >= deadline && mealEntries[meal] === 0 && totalEntries > 0) {
      insights.push({
        kind: 'missing-meal',
        tone: 'info',
        emoji: '🍽️',
        title: `Aún no has registrado ${label}`,
        message: 'Añádelo ahora mientras te acuerdas.',
      });
      break;
    }
  }

  // 5. Protein is well behind late in the day.
  const protein = consumed.proteinGrams;
  // Only when every entry has its protein: unknown protein is not "zero protein".
  if (
    hour >= 17 &&
    totalEntries > 0 &&
    protein.complete &&
    protein.knownTotal < goals.proteinGrams * 0.6
  ) {
    const missing = Math.round(goals.proteinGrams - protein.knownTotal);
    insights.push({
      kind: 'protein',
      tone: 'info',
      emoji: '💪',
      title: `Te faltan ${missing} g de proteína`,
      message: 'Huevos, yogur griego, legumbres o pollo te ayudan a llegar.',
    });
  }

  // 6. Water.
  if (waterGoalMl > 0 && waterMl >= waterGoalMl) {
    insights.push({
      kind: 'water',
      tone: 'success',
      emoji: '💧',
      title: '¡Objetivo de agua conseguido!',
      message: `${Math.round(waterMl)} ml hoy. Tu cuerpo lo agradece.`,
    });
  } else if (waterGoalMl > 0 && hour >= 16 && waterMl < waterGoalMl * 0.5) {
    insights.push({
      kind: 'water',
      tone: 'info',
      emoji: '💧',
      title: 'Bebe un poco de agua',
      message: `Llevas ${Math.round(waterMl)} de ${Math.round(waterGoalMl)} ml.`,
    });
  }

  // 7. Fibre, only judged when something about it is known.
  const fiber = consumed.fiberGrams;
  if (hour >= 20 && totalEntries > 0 && fiber.knownTotal > 0 && fiber.knownTotal < targets.fiberGrams * 0.5) {
    insights.push({
      kind: 'fiber',
      tone: 'info',
      emoji: '🥦',
      title: 'Poca fibra hoy',
      message: 'Suma verdura, fruta, legumbres o cereales integrales.',
    });
  }

  // 8. Empty morning: a friendly nudge.
  if (totalEntries === 0 && hour < 11) {
    insights.push({
      kind: 'start-day',
      tone: 'info',
      emoji: '☀️',
      title: 'Empieza el día con buen pie',
      message: 'Registra tu desayuno y llevarás la cuenta desde el primer momento.',
    });
  }

  return insights.slice(0, MAX_INSIGHTS);
}
