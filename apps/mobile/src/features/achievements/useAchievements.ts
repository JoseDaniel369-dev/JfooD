import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import {
  getSetting,
  setSetting,
} from '@/data/sqlite/repositories/settingsRepository';
import {
  countWaterGoalDays,
  getAchievementStats,
} from '@/data/sqlite/repositories/summaryRepository';
import { toLocalDate } from '@/features/diary/utils/date';
import { useWaterGoal } from '@/features/water/hooks/useWaterGoal';

import {
  detectNewAchievements,
  evaluateAchievements,
  mergeSeenIds,
  parseSeenIds,
  type Achievement,
} from './achievements';

const SEEN_KEY = 'achievements_seen';

/**
 * Every achievement with its progress, plus the ones unlocked since the person
 * was last told (`fresh`). Call `markSeen` after celebrating so they are not
 * celebrated twice.
 */
export function useAchievements() {
  const database = useSQLiteContext();
  const { goalMl } = useWaterGoal();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [fresh, setFresh] = useState<Achievement[]>([]);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const [stats, waterGoalDays, seen] = await Promise.all([
          getAchievementStats(database),
          countWaterGoalDays(database, goalMl),
          getSetting(database, SEEN_KEY),
        ]);
        if (isCancelled()) return;

        const list = evaluateAchievements(stats, toLocalDate(new Date()), waterGoalDays);
        setAchievements(list);
        setFresh(detectNewAchievements(list, parseSeenIds(seen)));
      } catch {
        // Achievements are a bonus: no list is better than an error.
      }
    },
    [database, goalMl],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  /** Re-reads the progress after something that can unlock one (a copied meal, the water goal). */
  const reload = useCallback(() => load(), [load]);

  const markSeen = useCallback(async () => {
    setFresh([]);
    try {
      const stored = parseSeenIds(await getSetting(database, SEEN_KEY));
      await setSetting(database, SEEN_KEY, JSON.stringify(mergeSeenIds(stored, achievements)));
    } catch {
      // Worst case they are celebrated again next time.
    }
  }, [achievements, database]);

  return { achievements, fresh, markSeen, reload };
}
