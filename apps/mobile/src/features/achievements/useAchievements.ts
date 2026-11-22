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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        try {
          const [stats, waterGoalDays, seen] = await Promise.all([
            getAchievementStats(database),
            countWaterGoalDays(database, goalMl),
            getSetting(database, SEEN_KEY),
          ]);
          if (cancelled) return;

          const list = evaluateAchievements(stats, toLocalDate(new Date()), waterGoalDays);
          setAchievements(list);
          setFresh(detectNewAchievements(list, parseSeenIds(seen)));
        } catch {
          // Achievements are a bonus: no list is better than an error.
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [database, goalMl]),
  );

  const markSeen = useCallback(async () => {
    const unlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
    setFresh([]);
    try {
      await setSetting(database, SEEN_KEY, JSON.stringify(unlocked));
    } catch {
      // Worst case they are celebrated again next time.
    }
  }, [achievements, database]);

  return { achievements, fresh, markSeen };
}
