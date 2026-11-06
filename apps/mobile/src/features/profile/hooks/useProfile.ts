import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import type { NutritionGoals } from '@jfood/core';

import {
  getProfileFormData,
  saveProfile,
  type ProfileFormData,
} from '@/data/sqlite/repositories/profileRepository';

interface ProfileState {
  profile: ProfileFormData | null;
  error: string | null;
  loading: boolean;
}

const LOAD_ERROR = 'No se ha podido cargar el perfil.';
const SAVE_ERROR = 'No se ha podido guardar el perfil.';

export function useProfile() {
  const database = useSQLiteContext();
  const [state, setState] = useState<ProfileState>({
    profile: null,
    error: null,
    loading: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setState({ profile: null, error: null, loading: true });

    try {
      const profile = await getProfileFormData(database);
      setState({ profile, error: null, loading: false });
    } catch {
      setState({ profile: null, error: LOAD_ERROR, loading: false });
    }
  }, [database]);

  const update = useCallback(
    async (data: ProfileFormData): Promise<NutritionGoals | null> => {
      setSaving(true);

      try {
        const goals = await saveProfile(database, data);
        setState((current) => ({
          ...current,
          profile: data,
          error: null,
        }));
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
