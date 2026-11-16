# Plan: Correcciones segunda auditoría post-Fase 7

Estado: implementado.
Alcance aprobado: arreglos 1 + 2 + 3 (toast de error, feedback de agua, rate limit).

## Contexto

La primera auditoría ya fue corregida (hero cards en dark, racha real, objetivo de agua sincronizado, etc.). Esta segunda auditoría encontró un error nuevo introducido por aquella corrección y dos mejoras menores.

---

## 1. Toast de error ilegible en modo oscuro (REGRESIÓN de la corrección anterior)

Problema: en `Toast.tsx` el texto y el icono se fijaron a `#FFFFFF` para ambas variantes. El fondo del toast de error es `colors.danger` (`#F87171` en dark), por lo que blanco sobre rojo claro ≈ 2.5:1 (no cumple AA). El toast de éxito está bien (su fondo usa el token `toastSuccess`, diseñado para blanco).

Archivo: `apps/mobile/src/components/Toast.tsx`

Cambios:

1. Icono (línea ~112): en lugar de `color="#FFFFFF"` fijo, usar:
   ```tsx
   color={toast.variant === 'error' ? colors.onDanger : '#FFFFFF'}
   ```
2. Texto (`styles.toastText`, línea ~160): el color debe depender de la variante. Como es un StyleSheet, mover el color fuera:
   ```tsx
   <Text style={[styles.toastText, toast.variant === 'error' && styles.toastTextError]}>
     {toast.message}
   </Text>
   ```
   y en `createStyles`:
   ```ts
   toastText: {
     ...typography.body,
     color: '#FFFFFF',
     flexShrink: 1,
     fontWeight: '700',
   },
   toastTextError: {
     color: colors.onDanger,
   },
   ```
   (En light, `onDanger` es `#FFFFFF`; en dark es `#450A0A` sobre `#F87171`, ambos AA.)

3. Test de regresión en `apps/mobile/test/theme/tokens.test.ts`: ya existe el test `accent and danger text tokens have sufficient contrast` que comprueba `onDanger` vs `danger` en ambas paletas. No hace falta añadir nada, pero verificar que el test siga pasando. Opcional: añadir assert de que el toast de éxito usa `toastSuccess` con blanco (ya existe test `toast success background meets AA contrast with white in both themes`).

## 2. Agua: feedback si falla el registro

Problema: `handleAddWater` en Inicio ignora el resultado de `water.add()`; si falla (p. ej. CHECK `amount_ml > 0` en BD, error de SQLite), el usuario no ve nada.

Archivo: `apps/mobile/src/app/(tabs)/index.tsx` (función `handleAddWater`, líneas ~106-115)

Cambio:

```tsx
const handleAddWater = async (amountMl: number) => {
  const previousTotal = water.day?.totalMl ?? 0;
  const added = await water.add(amountMl);
  if (added) {
    hapticSuccess();
    if (previousTotal < waterGoal && previousTotal + amountMl >= waterGoal) {
      showToast('¡Objetivo de agua conseguido!');
    }
  } else {
    showToast('No se ha podido registrar el agua.', 'error');
  }
};
```

(Verificar que `showToast` esté en el scope; ya lo está en HomeScreen.)

## 3. Excluir `/health` del rate limit (opcional, aprobado)

Problema: `@fastify/rate-limit` se registra globalmente (10 req/min por IP), incluyendo `/health` (ping de UptimeRobot). Impacto real mínimo, pero es más limpio excluirla.

Archivo: `apps/api/src/app.ts`

Cambio:

```ts
app.register(rateLimit, {
  max: 10,
  timeWindow: '1 minute',
  allowList: (_request) => _request.url === '/health',
});
```

o con la opción `allowList: ['127.0.0.1']` si se prefiere, pero la exclusión por URL de `/health` es la correcta aquí (UptimeRobot llama desde IPs externas).

Nota: verificar la firma de `allowList` de `@fastify/rate-limit` en la versión instalada (`apps/api/package.json`). Si la opción se llama distinto en esta versión (p. ej. `allowList` es función/array), ajustar. Tests existentes en `apps/api/test/` deben seguir pasando.

## Verificación final

Desde la raíz del monorepo:

```powershell
npm test            # incluye los tests de contraste de tokens
npm run typecheck
npm run lint
npm run build
cd apps\mobile
npx expo export --platform android
npx expo-doctor
```

Opcional tras tocar la API: revisar que `apps/api/test/recognize.test.ts` siga en verde.

## Fuera de alcance (menores conocidos, no aprobados)

- useFonts sin fallback (spinner infinito si fallan las fuentes).
- Flash de tema al arrancar antes de leer la preferencia.
- Guardar perfil sobrescribe el `weight_log` de hoy.
- Carrera en la búsqueda con debounce.
- Tooltip del gráfico desalineado por padding.
- Periodos del gráfico (7/30/Todo) vs plan (7/14/30/90).

## Estado anterior (ya implementado en sesiones previas)

- Fase 7 completa (modo oscuro, racha, agua, catálogo, BMI, gráfico, onboarding, haptics/toasts).
- Primera auditoría corregida: tokens `onHero`/`toastSuccess`, racha con `INNER JOIN diary_entries`, hook `useWaterGoal`, `parseWaterGoal` con separadores, haptics con catch, toast de error en onboarding, límite 50 en match del escáner, kcal NULL en semana.
- Todos los checks en verde (49 tests móvil + 13 API + 20 core, typecheck, lint, build, export, expo-doctor).
