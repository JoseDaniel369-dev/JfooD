import type { AchievementStats } from '@/data/sqlite/repositories/summaryRepository';
import { startOfWeek } from '@/features/diary/utils/date';
import { computeStreak } from '@/features/stats/utils/streak';

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** Amount needed to unlock it. */
  target: number;
  /** Amount reached so far (can be above the target). */
  current: number;
  unlocked: boolean;
  /** `current / target`, between 0 and 1. */
  progress: number;
}

interface Definition {
  id: string;
  emoji: string;
  title: string;
  description: string;
  target: number;
  measure: (figures: Figures) => number;
}

interface Figures {
  totalEntries: number;
  bestStreak: number;
  daysWithAllMeals: number;
  distinctFoods: number;
  recipes: number;
  weighedWeeks: number;
  waterGoalDays: number;
}

const DEFINITIONS: readonly Definition[] = [
  { id: 'first-entry', emoji: '🌱', title: 'Primer paso', description: 'Registra tu primera comida', target: 1, measure: (f) => f.totalEntries },
  { id: 'streak-3', emoji: '🔥', title: 'Calentando motores', description: '3 días seguidos registrando', target: 3, measure: (f) => f.bestStreak },
  { id: 'streak-7', emoji: '⚡', title: 'Semana redonda', description: '7 días seguidos registrando', target: 7, measure: (f) => f.bestStreak },
  { id: 'streak-30', emoji: '🏆', title: 'Imparable', description: '30 días seguidos registrando', target: 30, measure: (f) => f.bestStreak },
  { id: 'entries-100', emoji: '💯', title: 'Cien registros', description: 'Registra 100 alimentos', target: 100, measure: (f) => f.totalEntries },
  { id: 'all-meals', emoji: '🍽️', title: 'Día completo', description: 'Desayuno, comida, merienda y cena en un mismo día', target: 1, measure: (f) => f.daysWithAllMeals },
  { id: 'variety-30', emoji: '🥗', title: 'Dieta variada', description: 'Registra 30 alimentos distintos', target: 30, measure: (f) => f.distinctFoods },
  { id: 'water-7', emoji: '💧', title: 'Bien hidratado', description: 'Cumple tu objetivo de agua 7 días', target: 7, measure: (f) => f.waterGoalDays },
  { id: 'weigh-4', emoji: '⚖️', title: 'Constancia en la báscula', description: 'Pésate en 4 semanas distintas', target: 4, measure: (f) => f.weighedWeeks },
  { id: 'first-recipe', emoji: '👩‍🍳', title: 'Chef en casa', description: 'Crea tu primera receta', target: 1, measure: (f) => f.recipes },
];

/** Number of different calendar weeks (Monday to Sunday) that have a weight log. */
export function countWeighedWeeks(weightDates: readonly string[]): number {
  return new Set(weightDates.map((date) => startOfWeek(date))).size;
}

/**
 * Every achievement with its progress. Pure: the same history always gives
 * the same result, so unlocks never depend on when the screen was opened.
 */
export function evaluateAchievements(
  stats: AchievementStats,
  today: string,
  waterGoalDays: number,
): Achievement[] {
  const figures: Figures = {
    totalEntries: stats.totalEntries,
    bestStreak: computeStreak(stats.loggedDates, today).best,
    daysWithAllMeals: stats.daysWithAllMeals,
    distinctFoods: stats.distinctFoods,
    recipes: stats.recipes,
    weighedWeeks: countWeighedWeeks(stats.weightDates),
    waterGoalDays,
  };

  return DEFINITIONS.map((definition) => {
    const current = definition.measure(figures);
    return {
      id: definition.id,
      emoji: definition.emoji,
      title: definition.title,
      description: definition.description,
      target: definition.target,
      current,
      unlocked: current >= definition.target,
      progress: Math.min(1, Math.max(0, current / definition.target)),
    };
  });
}

/** The unlocked achievements the person has not been told about yet. */
export function detectNewAchievements(
  achievements: readonly Achievement[],
  seenIds: readonly string[],
): Achievement[] {
  const seen = new Set(seenIds);
  return achievements.filter((achievement) => achievement.unlocked && !seen.has(achievement.id));
}

/** Reads the stored list of seen ids; anything unexpected counts as "none seen". */
export function parseSeenIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The ids to store after celebrating: everything seen before plus what is
 * unlocked now. Never shrinks, so an achievement that is lost (a deleted
 * recipe) and earned again is not celebrated a second time.
 */
export function mergeSeenIds(
  previouslySeen: readonly string[],
  achievements: readonly Achievement[],
): string[] {
  const merged = new Set(previouslySeen);
  for (const achievement of achievements) {
    if (achievement.unlocked) {
      merged.add(achievement.id);
    }
  }
  return [...merged];
}
