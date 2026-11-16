# Plan: Correcciones de auditoría Fase 7 (críticas + medias)

Estado: aprobado por el usuario (alcance "Críticas + medias"). Listo para ejecutar.

## 1. Contraste de hero cards en modo oscuro (CRÍTICO)

Problema: `Card variant="hero"` usa `heroGradient` fijo verde oscuro, pero su texto usa `colors.textOnPrimary` que en dark es `#052E21` (casi invisible sobre el gradiente).

- `apps/mobile/src/theme/tokens.ts`
  - Añadir a la interfaz `ThemeColors` (después de `textOnPrimary`): `onHero: string;` y `toastSuccess: string;`
  - `lightColors`: `onHero: '#FFFFFF',` y `toastSuccess: '#047857',`
  - `darkColors`: `onHero: '#FFFFFF',` y `toastSuccess: '#0E3A2C',`

- Sustituir `colors.textOnPrimary` → `colors.onHero` SOLO dentro de hero cards:
  - `src/app/(tabs)/index.tsx` líneas 452, 464, 470, 480, 485, 490, 503, 509, 514 (cardLabel, calorieValue, calorieGoal, calorieFooterLabel, calorieFooterValue, goalNotice, streakValue, streakLabel, streakHint). NO tocar línea 122 (icono sobre `colors.primary`).
  - `src/app/(tabs)/diary.tsx` líneas 276, 288, 294, 304, 309, 314.
  - `src/app/(tabs)/profile.tsx` líneas 251, 270, 275, 280 (GoalsSummary). NO tocar 138 (botón seleccionado sobre primary). Cambiar `color="#FFFFFF"` (líneas ~201 y 206 en GoalItem de GoalsSummary) por `color={colors.onHero}`.
  - `src/app/onboarding.tsx` líneas 287, 294, 300, 316 (goals card). NO tocar línea 82. Cambiar `color="#FFFFFF"` en los tres `<GoalChip ...>` (líneas ~159-169) por `color={colors.onHero}`.

- Test en `apps/mobile/test/theme/tokens.test.ts`: nuevo test "hero text meets AA contrast against the hero gradient": para `onHero` de ambas paletas vs ambos colores de `heroGradient`, ratio ≥ 4.5 (función de luminancia ya existente en el archivo de test).

## 2. Racha cuenta días sin entradas (CRÍTICO)

- `apps/mobile/src/data/sqlite/repositories/statsRepository.ts`
  - Cambiar la query `loggedDates`:
    ```sql
    SELECT DISTINCT meal.local_date
    FROM diary_meals AS meal
    INNER JOIN diary_entries AS entry ON entry.meal_id = meal.id
    ORDER BY meal.local_date
    ```

## 3. Objetivo de agua sincronizado (CRÍTICO)

- Nuevo `apps/mobile/src/features/water/hooks/useWaterGoal.ts`:
  - `useWaterGoal()`: `useSQLiteContext()`, estado `goalMl` inicial `DEFAULT_WATER_GOAL_ML`, `useFocusEffect` que lee `getSetting(database, 'water_goal_ml')` (Number > 0 o default), y `setGoalMl(ml)` que persiste con `setSetting` y actualiza estado (catch silencioso, devuelve boolean éxito). Exporta `{ goalMl, setGoalMl }`.
- `src/app/(tabs)/index.tsx`:
  - Eliminar `useState(DEFAULT_WATER_GOAL_ML)` + el `useEffect` que lee `water_goal_ml` (líneas 43-63). Usar `const { goalMl: waterGoal } = useWaterGoal();`
  - Quitar imports ya innecesarios (`useState` si deja de usarse, `DEFAULT_WATER_GOAL_ML`, `getSetting`). Mantener `useEffect` import si se usa en otro sitio (comprobar; si no, quitarlo).
- `src/app/(tabs)/profile.tsx`:
  - Usar `useWaterGoal()`; borrar `useState(String(DEFAULT_WATER_GOAL_ML))` y `handleWaterGoalChange` actual: input con estado local `draft` (`useState<string | null>(null)`), `value={draft ?? String(goalMl)}`, `onChangeText={setDraft}`; guardar: `parseWaterGoal(draft ?? String(goalMl))`, si null → toast error; si ok → `await setGoalMl(parsed)`, `setDraft(null)`, toast éxito/error según resultado.
  - Quitar imports no usados (`DEFAULT_WATER_GOAL_ML` sigue usándose como fallback del hook no de la pantalla; ajustar imports).
  - Opcional (menor, incluir): quitar la doble persistencia del tema: `handleThemeChange` solo debe llamar `setPreference(value)` (ThemeProvider ya guarda). Eliminar `setSetting(database,'theme',...)` y el import de `setSetting` si queda sin uso.

## 4. Toast de éxito en dark (MEDIA)

- `src/components/Toast.tsx`:
  - `styles.toastSuccess` → `backgroundColor: colors.toastSuccess`.
  - Icono (línea 112) y texto: usar `'#FFFFFF'` fijo (el texto ya es `#FFFFFF`); cambiar icono `color={colors.textOnPrimary}` → `color="#FFFFFF"`.
- Test en `test/theme/tokens.test.ts`: "toast success background meets AA contrast with white in both themes" (blanco vs `toastSuccess` de cada paleta ≥ 4.5).

## 5. Agua tras medianoche (MEDIA)

- `src/features/water/hooks/useWaterDay.ts`:
  - Añadir patrón `initialLoadDone` como en `useDiaryDay`: `useEffect(() => { if (!initialLoadDone.current) { initialLoadDone.current = true; return; } void reload(); }, [localDate, reload]);`

## 6. parseWaterGoal con separadores (MEDIA)

- `src/features/water/utils/goal.ts`:
  - Nueva normalización: si `value` contiene `,` → quitar `.` (miles) y `,` → `.`; si solo contiene `.` y coincide con `/^\d{1,3}(\.\d{3})+$/` → quitar `.` (miles); en otro caso dejar el `.` como decimal. Resto igual (round + clamp).
- Tests en `apps/mobile/test/water/goal.test.ts`:
  - Mantener existentes. Añadir: `parseWaterGoal('2.500') === 2500`, `parseWaterGoal('2.5') === 250` (clamp mínimo), `parseWaterGoal('1.250') === 1250`.

## 7. Haptics: capturar rechazos (MEDIA)

- `src/features/haptics/haptics.ts`: `safeRun`:
  ```ts
  function safeRun(action: () => Promise<void>): void {
    try {
      action().catch(() => {});
    } catch {
      // ignore
    }
  }
  ```

## 8. Onboarding: error al guardar perfil visible (MEDIA)

- `src/app/onboarding.tsx`:
  - Importar `useToast`; en `handleProfileSubmit` envolver en try/catch: catch → `showToast('No se ha podido guardar tu perfil.', 'error')`; mantener `finally` con `setSaving(false)`.

## 9. Escáner: match exacto desplazado (MEDIA)

- `src/features/scanner/utils/matchFood.ts`: `searchFoods(database, normalized, 10)` → `searchFoods(database, normalized, 50)`.

## 10. Semana con kcal NULL coherentes (MEDIA)

- `src/data/sqlite/repositories/statsRepository.ts` (query de week):
  ```sql
  SELECT meal.local_date,
         CASE WHEN COUNT(entry.calories_kcal) = COUNT(*)
              THEN SUM(entry.calories_kcal * entry.grams / 100.0)
              ELSE NULL END AS kcal
  FROM diary_entries AS entry
  INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
  WHERE meal.local_date >= ?
  GROUP BY meal.local_date
  ```

## Verificación final

1. `npm test` (raíz) — todos los tests nuevos incluidos.
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. `cd apps/mobile && npx expo export --platform android`
6. Opcional: `npx expo-doctor`.

## No tocar en esta tanda (menores, fuera de alcance acordado)

- useFonts sin fallback, flash de tema al arrancar, weight_log sobrescrito al guardar perfil, carrera debounce búsqueda, tooltip del gráfico, periodos 7/14/30/90.
