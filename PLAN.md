# JfooD — Plan de desarrollo y traspaso

**Última actualización:** 6 de noviembre de 2026
**Estado:** Fase 0 completada. Correcciones urgentes aplicadas (barra de navegación, repositorio Git). Fase 2 (perfil y objetivos) implementada. Fase 1 (diario completo y catálogo local) sigue pendiente.

Este documento es la referencia para retomar el proyecto en una sesión nueva y para ejecutar las fases en orden. Antes de tocar código, la sesión entrante debe leer también `README.md` y `apps/mobile/AGENTS.md`.

---

## 1. Objetivo del proyecto

Aplicación móvil personal de nutrición, offline-first, para Android, desarrollada con React Native, Expo y TypeScript. El backend de Node.js se reserva únicamente para el reconocimiento de alimentos con Gemini; las funciones básicas no requieren cuenta ni servicio cloud.

Monorepo con npm workspaces:

- `apps/mobile`: aplicación Expo SDK 58, Expo Router y Expo SQLite.
- `apps/api`: API Fastify con configuración validada y errores centralizados.
- `packages/core`: motor nutricional y contratos Zod compartidos.

---

## 2. Reglas de trabajo acordadas

1. No añadir dependencias innecesarias. Para paquetes de Expo, usar `npx expo install`.
2. No implementar funciones fuera de la fase acordada.
3. Corregir solo problemas reales, sin romper funcionalidad que ya funciona.
4. Antes de cerrar una fase: ejecutar pruebas, TypeScript, ESLint y las comprobaciones de Expo; verificar el bundle Android.
5. Cada fase termina con un resumen y una revisión del usuario antes de avanzar a la siguiente.
6. No realizar operaciones Git (commit, ramas, fusiones, eliminación de `.git`) sin aprobación explícita.
7. Mantener `README.md` y este `PLAN.md` actualizados cuando cambie el estado.
8. La lógica nutricional vive en `packages/core`. Gemini nunca devuelve nutrientes: solo nombre, gramos estimados y confianza.

---

## 3. Estado actual

### 3.1 Base completada (Fase 0)

- Monorepo con workspaces y scripts raíz de test, typecheck, lint, build y arranque.
- App Expo SDK 58 con Expo Router (rutas tipadas) y Expo SQLite.
- Migración `001_initial` con WAL y claves foráneas activadas.
- Lectura del diario desde SQLite: fecha local, comidas, entradas, totales y objetivos.
- Pantallas de Inicio y Diario conectadas a datos reales.
- Navegación por cinco secciones: Inicio, Diario, Plan, Progreso y Perfil.
- Pantalla de escáner y secciones pendientes con estados informativos; no simulan funciones futuras.
- API Fastify con `GET /health`, manejador de 404 y frontera de errores.
- Motor nutricional: cálculo por gramos, suma con propagación de `null` y contratos Zod de reconocimiento.
- Documentación base en `README.md`.

### 3.2 Correcciones aplicadas

1. **Barra inferior y área segura en Android** (`apps/mobile/src/app/(tabs)/_layout.tsx` y `apps/mobile/app.json`)
   - Se usa una altura numérica explícita (`49 + inset inferior`) para asegurar que el navegador realmente reserve el espacio necesario; `height: undefined` no funciona porque React Native ignora los valores `undefined` al aplanar estilos.
   - `paddingBottom: Math.max(insets.bottom, 64)` reserva el inset real cuando el sistema lo informa, y usa un suelo de 64 dp para dispositivos con navegación por gestos o barras de navegación más altas que reportan `insets.bottom = 0` o lo infrarreportan.
   - Se añade `expo-navigation-bar` para mantener el estilo oscuro de los botones de la barra del sistema sobre el fondo claro de la app.

2. **Fecha del diario siempre actualizada** (`apps/mobile/src/features/diary/hooks/useDiaryDay.ts`)
   - Se refresca al volver a primer plano (`AppState`) y cada 60 segundos mientras la app está abierta.
   - Al cambiar la fecha local se vuelve a consultar el diario correspondiente.

3. **Objetivos provisionales señalizados**
   - `DiaryDay.goalsAreDefault` indica si se están usando los objetivos por defecto.
   - Inicio muestra: «Objetivos provisionales: no calculados con tus datos personales.»

4. **Clave de Gemini vacía tolerada** (`apps/api/src/config/env.ts`)
   - `GEMINI_API_KEY=` o solo espacios se interpreta como ausencia de configuración.
   - La API arranca y `/health` funciona sin Gemini.

5. **Pruebas de regresión añadidas**
   - `apps/mobile/test/date.test.ts`: fecha local y formato español sin conversión UTC.
   - `apps/api/test/env.test.ts`: configuración sin clave, con clave vacía y con clave válida.

### 3.3 Verificación del estado actual

- 21/21 pruebas superadas (5 API, 2 móvil, 14 core).
- TypeScript sin errores en los tres paquetes.
- ESLint sin errores.
- Bundle Android exportado correctamente.
- Expo Doctor: 20/20 comprobaciones.

---

## 4. Arquitectura y archivos clave

### Aplicación móvil

- `apps/mobile/src/app/_layout.tsx`: proveedor SQLite, migración y Stack raíz.
- `apps/mobile/src/app/(tabs)/_layout.tsx`: navegación por pestañas y área segura inferior.
- `apps/mobile/src/app/(tabs)/index.tsx`: resumen del día, macronutrientes y accesos.
- `apps/mobile/src/app/(tabs)/diary.tsx`: diario del día y comidas.
- `apps/mobile/src/app/(tabs)/profile.tsx`: formulario de datos personales y objetivos calculados.
- `apps/mobile/src/app/(tabs)/planner.tsx`, `progress.tsx`: estados informativos pendientes.
- `apps/mobile/src/app/scanner.tsx`: entrada al futuro escáner.
- `apps/mobile/src/features/diary/`: tipos, hook de día, utilidades de fecha y lista de comidas.
- `apps/mobile/src/features/profile/`: formulario, hook y tipos del perfil de usuario.
- `apps/mobile/src/data/sqlite/migrations/`: migraciones versionadas.
- `apps/mobile/src/data/sqlite/repositories/`: `diaryRepository.ts`, `goalsRepository.ts`, `profileRepository.ts` e `id.ts` (generador de ids locales).
- `apps/mobile/src/components/`: `Screen`, `Card`, `ProgressBar`, estados de carga y error.
- `apps/mobile/src/theme/index.ts`: colores, espaciados y radios.

### API

- `apps/api/src/app.ts`: creación de Fastify, `/health`, 404 y manejo de errores.
- `apps/api/src/server.ts`: carga de `.env` y arranque.
- `apps/api/src/config/env.ts`: validación de entorno con Zod.

### Núcleo

- `packages/core/src/nutrition/nutrients.ts`: `calculateNutrients`, `sumNutrients`, `Nutrients`.
- `packages/core/src/nutrition/goals.ts`: cálculo de edad, BMR (Mifflin-St Jeor), TDEE, objetivos de macronutrientes y esquemas Zod del perfil.
- `packages/core/src/schemas/recognition.ts`: contratos de reconocimiento sin nutrientes.

---

## 5. Modelo de datos (migración `001_initial`)

- `foods`: catálogo local. Campos principales: `name`, `normalized_name`, `brand`, `barcode`, `source` (`bedca`, `open_food_facts`, `user`, `seed`), `external_id`, macros por 100 g, `is_favorite`.
- `diary_meals`: una fila por fecha y tipo de comida (`breakfast`, `lunch`, `snack`, `dinner`). Restricción única `(local_date, meal_type)`.
- `diary_entries`: entrada del diario con `food_id` opcional, snapshot del nombre y de los valores por 100 g, y gramos consumidos. `ON DELETE CASCADE` desde la comida y `SET NULL` desde el alimento.
- `user_profile`: fila única (`id = 1`) con altura, fecha de nacimiento, variante Mifflin y nivel de actividad.
- `nutrition_goals`: historial de objetivos con `effective_from`; se usa el más reciente aplicable a la fecha.
- `weight_logs`: un registro por fecha con peso y nota opcional.

Los objetivos por defecto (2000 kcal) se usan solo mientras no exista una fila aplicable en `nutrition_goals`.

---

## 6. Fases

### Fase 0 — Base inicial ✅ COMPLETADA

Scaffolding, navegación, SQLite, lectura del diario, motor nutricional, API de salud, calidad y documentación.

### Fase 1 — Diario completo y catálogo local ⬅ SIGUIENTE

**Objetivo:** que el usuario pueda registrar, editar y eliminar alimentos reales en su diario sin conexión.

Alcance:

- Repositorio de alimentos:
  - Alta manual de alimento con nombre, marca opcional y macros por 100 g.
  - Normalización del nombre para búsqueda.
  - Búsqueda local por nombre, favoritos y alimentos usados recientemente.
- Repositorio del diario (escritura):
  - Asegurar la comida del día (`local_date` + `meal_type`).
  - Añadir entrada con alimento y gramos, guardando el snapshot por 100 g.
  - Editar gramos, mover de comida y eliminar entrada.
- Interfaz:
  - Flujo de añadir alimento: buscar o crear → elegir gramos y comida → confirmar.
  - Acciones de editar y eliminar desde la lista de comidas.
  - Validación con los esquemas de `@jfood/core` y estados vacíos/errores claros.
  - Recarga del diario tras cada mutación (sin depender solo del intervalo de fecha).
- Pruebas:
  - Lógica pura de normalización, validación y cálculo.
  - Verificación manual del flujo completo en dispositivo/emulador.

Fuera de alcance: escáner, códigos de barras, importación BEDCA/Open Food Facts, sincronización o cuentas.

Criterios de aceptación:

- Añadir, editar y eliminar entradas actualiza totales y comidas inmediatamente.
- Los datos persisten tras cerrar y reabrir la app.
- No se requiere red ni clave de Gemini.
- Todas las comprobaciones de calidad en verde.

### Fase 2 — Perfil y objetivos ✅ COMPLETADA

**Objetivo:** que el usuario configure sus datos personales y la app calcule objetivos nutricionales reales, sustituyendo los provisionales de 2000 kcal.

Alcance implementado:

- Motor en `packages/core` (`src/nutrition/goals.ts`):
  - Cálculo de edad a partir de `birthDate`.
  - Ecuación Mifflin-St Jeor para ambas variantes.
  - TDEE con multiplicadores por nivel de actividad.
  - Reparto de macros: proteína 1,6 g/kg, grasa 25 % de las kcal, resto en carbohidratos.
  - Esquemas Zod compartidos y tests de regresión.
- Datos en móvil:
  - `profileRepository`: leer perfil + peso más reciente; guardar perfil, objetivos y primer `weight_log` en una transacción.
  - `goalsRepository`: lectura de objetivos aplicables a una fecha, con objetivos por defecto como fallback.
  - Refactor de `diaryRepository` para reutilizar `goalsRepository`.
- Interfaz:
  - Pantalla Perfil con formulario (peso, altura, fecha de nacimiento, sexo, actividad) y validación Zod.
  - Recarga del diario al volver a Inicio (`useFocusEffect` en `useDiaryDay`) para reflejar los nuevos objetivos.
  - Desaparición del aviso de objetivos provisionales tras guardar.
- Decisiones aplicadas:
  - Peso actual capturado en Fase 2 y guardado como primer `weight_log`.
  - Reparto de macros: 1,6 g/kg de proteína, 25 % grasa, resto carbohidratos.
- Pruebas: lógica pura de objetivos testeada; comprobaciones de calidad en verde.

### Fase 3 — Progreso (propuesta)

- Registro y edición de peso por fecha.
- Historial y tendencia local, sin nube.
- Evitar dependencias de gráficos si no son imprescindibles.

### Fase 4 — Planificador (propuesta)

- Plan semanal basado en el catálogo local.
- Copiar un día planificado al diario.
- Sin sincronización ni cuentas.

### Fase 5 — Escáner con Gemini (propuesta)

- Endpoint de reconocimiento en `apps/api` con la clave solo en el backend.
- La respuesta se valida con `foodRecognitionSchema`: nombre, gramos estimados y confianza; nunca nutrientes.
- Captura o selección de imagen en la app, pantalla de revisión y confirmación.
- Los alimentos reconocidos se resuelven contra el catálogo local o se crean como alimento de usuario.
- Fallback manual si la red o Gemini fallan.

### Fase 6 — Pulido y release (propuesta)

- Accesibilidad, estados vacíos y de error, rendimiento.
- Pruebas manuales en dispositivo.
- Iconos, splash y build de distribución si se decide publicar.

Las fases 2 a 6 son una propuesta de orden, no un alcance cerrado. Deben planificarse y aprobarse una a una.

---

## 7. Decisiones pendientes

1. **Repositorio Git:** ✅ RESUELTO. Se eliminó el `.git` anidado de `apps/mobile` y el código de la app móvil se incorporó como archivos normales del repositorio raíz.
2. **Alcance de la Fase 1:** confirmar el flujo exacto de alta manual, edición y búsqueda antes de implementar.
3. **Datos de alimentos:** la Fase 1 trabaja solo con alimentos creados por el usuario. La importación desde BEDCA/Open Food Facts queda para una fase posterior.
4. **Peso y objetivos:** ✅ RESUELTO. El peso actual se captura en Perfil (Fase 2) y se registra como el primer `weight_log`, desbloqueando el cálculo de Mifflin-St Jeor y preparando la Fase 3.

---

## 8. Cómo retomar en una sesión nueva

1. Abrir una terminal en la raíz del proyecto y ejecutar:

   ```powershell
   cd C:\Users\josed\Downloads\JfooD
   opencode
   ```

2. Crear una sesión nueva con `Ctrl+X` y `N`, o con `/new`. El contexto empieza en 0 %.
3. Elegir modelo/agente con `/models` y `/agents`.
4. Pegar este prompt de arranque:

   ```text
   Estoy retomando JfooD en una sesión nueva. Antes de hacer nada, lee
   PLAN.md, README.md y apps/mobile/AGENTS.md. Confirma el estado real
   con las comprobaciones del documento y propón el plan detallado de
   la Fase 1 (diario completo y catálogo local).

   No hagas operaciones Git sin mi aprobación. No avances a la Fase 2
   hasta que revise y apruebe la Fase 1. No añadas dependencias
   innecesarias ni funciones fuera del alcance acordado.
   ```

5. La sesión anterior no se pierde: se puede recuperar con `Ctrl+X` y `L`, `/sessions` o `Ctrl+O`.

---

## 9. Checklist de cierre de fase

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Verificación adicional de la app:

```sh
cd apps/mobile
npx expo export --platform android --output-dir dist --clear
npx expo-doctor
```

Antes de dar una fase por terminada:

- [ ] Comportamiento implementado y probado en dispositivo o emulador.
- [ ] Pruebas nuevas o actualizadas para la lógica añadida.
- [ ] `npm test` en verde.
- [ ] `npm run typecheck` en verde.
- [ ] `npm run lint` en verde.
- [ ] Bundle Android generado sin errores.
- [ ] Expo Doctor sin incidencias.
- [ ] `README.md` y `PLAN.md` actualizados.
- [ ] Resumen de cambios y verificación compartido con el usuario.
- [ ] Revisión y aprobación antes de avanzar.

---

## 10. Comandos útiles

```sh
npm install                 # instalar dependencias
npm run start:mobile        # compilar core y arrancar Expo
npm run start:api           # arrancar el backend en modo desarrollo
npm run build               # compilar core y API
npm test                    # pruebas de todos los workspaces
npm run typecheck           # TypeScript en todos los workspaces
npm run lint                # ESLint de la app móvil
```
