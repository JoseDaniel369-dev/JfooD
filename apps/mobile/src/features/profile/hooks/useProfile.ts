import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import type { NutritionGoals } from '@jfood/core';

import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import {
  getProfileFormData,
  saveProfile,
  type ProfileFormData,
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

  const load = useCallback(async () => {
    setState({ profile: null, goals: null, error: null, loading: true });

    try {
      const profile = await getProfileFormData(database);
      let goals: NutritionGoals | null = null;

      if (profile) {
        const latest = await getLatestGoals(database, toLocalDate(new Date()));
        goals = latest.goals;
      }

      setState({ profile, goals, error: null, loading: false });
    } catch {
      setState({ profile: null, goals: null, error: LOAD_ERROR, loading: false });
    }
  }, [database]);

  const update = useCallback(
    async (data: ProfileFormData): Promise<NutritionGoals | null> => {
      setSaving(true);

      try {
        const goals = await saveProfile(database, data);
        setState({ profile: data, goals, error: null, loading: false });
        return goals;
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : SAVE_ERROR;
        setState((current) => ({ ...current, error: message }));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [database],
  );

  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasLoaded.current) {
        return;
      }
      hasLoaded.current = true;
      void load();
    }, [load]),
  );

  return { ...state, saving, load, update };
}
