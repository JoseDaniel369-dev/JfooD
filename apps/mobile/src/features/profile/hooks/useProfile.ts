import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import type { NutritionGoals } from '@jfood/core';

import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import {
  getProfileFormData,
  saveProfile,
  type ProfileFormData,
  type SaveProfileOptions,
} from '@/data/sqlite/repositories/profileRepository';
import { toLocalDate } from '@/features/diary/utils/date';

interface ProfileState {
  profile: ProfileFormData | null;
  goals: NutritionGoals | null;
  error: string | null;
  loading: boolean;
}

const LOAD_ERROR = 'No se ha podido cargar el perfil.';
const SAVE_ERROR = 'No se ha podido guardar el perfil.';

export function useProfile() {
  const database = useSQLiteContext();
  const [state, setState] = useState<ProfileState>({
    profile: null,
    goals: null,
    error: null,
    loading: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setState({ profile: null, goals: null, error: null, loading: true });
    }

    try {
      const profile = await getProfileFormData(database);
      let goals: NutritionGoals | null = null;

      if (profile) {
        const latest = await getLatestGoals(database, toLocalDate(new Date()));
        goals = latest.goals;
      }

      setState({ profile, goals, error: null, loading: false });
    } catch {
      setState((current) =>
        silent
          ? { ...current, error: LOAD_ERROR }
          : { profile: null, goals: null, error: LOAD_ERROR, loading: false },
      );
    }
  }, [database]);

  const update = useCallback(
    async (
      data: ProfileFormData,
      options?: SaveProfileOptions,
    ): Promise<NutritionGoals | null> => {
      setSaving(true);

      try {
        const goals = await saveProfile(database, data, options);
        // Re-read from the database: the stored weight may differ from the
        // form when it was edited elsewhere (e.g. the Progress tab).
        await load(true);
        return goals;
      } catch {
        setState((current) => ({ ...current, error: SAVE_ERROR }));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [database, load],
  );

  const hasLoaded = useRef(false);

  // First focus shows the loading state; later focuses refresh silently so
  // data edited in other tabs (weight, height) is never shown stale.
  useFocusEffect(
    useCallback(() => {
      const silent = hasLoaded.current;
      hasLoaded.current = true;
      void load(silent);
    }, [load]),
  );

  return { ...state, saving, load, update };
}
