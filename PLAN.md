# JfooD — Plan de desarrollo y traspaso

**Última actualización:** 12 de noviembre de 2026
**Estado:** Fases 0, 1, 2, 3, 4, 4.5, 5 y 6 completadas. La app está lista para compilar y distribuir dos APKs: una versión estable 100 % offline y una versión experimental con reconocimiento por Gemini.

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

6. **Correcciones de la auditoría (12 de noviembre de 2026)**
7. **Correcciones post-Fase 5 (auditoría del escáner)**
   - URL del backend en móvil: se deriva de `Constants.expoConfig.hostUri` en desarrollo en lugar de `localhost`, haciendo que el escáner funcione en dispositivo físico y emulador.
   - Límite de cuerpo de Fastify aumentado a 10 MiB para evitar que fotos reales sean rechazadas con `413`.
   - Se conserva el objeto `Food` completo del catálogo local al añadir una coincidencia, en lugar de reconstruirlo con macros nulos.
   - Matching del escáner restringido a coincidencia exacta o prefijo (`manzana` → `manzana golden`, pero no `zumo de manzana` ni `manzanilla`).
   - El input de gramos en la pantalla de revisión ya no revierte al valor anterior al confirmar.
   - "Probar otra foto" en resultados vacíos vuelve al paso de cámara en lugar de salir del escáner.
   - Llamada a Gemini con timeout de 30 s y tolerancia a fences markdown; errores de red devuelven `502` en lugar de `500`.
   - **Recarga al cambiar de día:** `useDiaryDay` y `usePlanDay` ahora recargan el día cuando cambia la fecha seleccionada (navegación Anterior/Hoy/Siguiente y cambio de día con la app abierta). Antes solo se recargaba al enfocar la pantalla, mostrando datos de otro día con la fecha nueva.
   - **Fecha de nacimiento futura rechazada:** `birthDateSchema` en `packages/core` valida que la fecha no sea futura (evita objetivos calculados con edad 0).
   - **Ventana del gráfico de 7 días:** `progress.tsx` usa aritmética de cadenas de fecha (`addDays`) en lugar de `new Date(...)`, que desplazaba la ventana en zonas horarias detrás de UTC.
   - **Error al eliminar peso visible:** la pantalla de Progreso muestra un aviso si falla la eliminación de un registro (antes se ignoraba en silencio).
   - **Versiones parche de Expo actualizadas** con `npx expo install --fix` (expo, expo-constants, expo-linking, expo-router, expo-sqlite, expo-status-bar) y se añadió el plugin `expo-status-bar` a `app.json`.

### 3.3 Verificación del estado actual

- Pruebas superadas en los tres paquetes (API, móvil, core).
- TypeScript sin errores en los tres paquetes.
- ESLint sin errores.
- Bundle Android exportado correctamente.
- Expo Doctor sin incidencias.
- Configuración de despliegue lista: Render Free + UptimeRobot, rate limiting en `/recognize`, y dos perfiles de EAS Build (`estable` y `experimental`).

---

## 4. Arquitectura y archivos clave

### Aplicación móvil

- `apps/mobile/src/app/_layout.tsx`: proveedor SQLite, migración y Stack raíz.
- `apps/mobile/src/app/(tabs)/_layout.tsx`: navegación por pestañas y área segura inferior.
- `apps/mobile/src/app/(tabs)/index.tsx`: resumen del día, macronutrientes y accesos.
- `apps/mobile/src/app/(tabs)/diary.tsx`: diario del día y comidas.
- `apps/mobile/src/app/(tabs)/profile.tsx`: formulario de datos personales y objetivos calculados.
- `apps/mobile/src/app/(tabs)/planner.tsx`, `progress.tsx`: estados informativos pendientes.
- `apps/mobile/src/app/scanner.tsx`: escáner con captura, análisis y revisión de alimentos.
- `apps/mobile/src/app/diary/add-food.tsx`: modal paso a paso para añadir alimentos al diario; acepta `name` prellenado desde el escáner.
- `apps/mobile/src/features/scanner/`: tipos, API, hook de image picker y utilidad de coincidencia con el catálogo local.
- `apps/mobile/src/config/api.ts`: resolución de la URL del backend para desarrollo.
- `apps/mobile/src/features/diary/`: tipos, hook de día, utilidades de fecha, lista de comidas y modal de edición de gramos.
- `apps/mobile/src/features/foods/`: tipos, normalización de nombres y utilidades del catálogo local.
- `apps/mobile/src/features/progress/`: repositorio, hook, utilidades de tendencia y pantalla de progreso.
- `apps/mobile/src/features/profile/`: formulario, hook y tipos del perfil de usuario.
- `apps/mobile/src/data/sqlite/migrations/`: migraciones versionadas.
- `apps/mobile/src/data/sqlite/repositories/`: `diaryRepository.ts`, `goalsRepository.ts`, `profileRepository.ts` e `id.ts` (generador de ids locales).
- `apps/mobile/src/components/`: `Screen`, `Card`, `ProgressBar`, estados de carga y error.
- `apps/mobile/src/theme/index.ts`: colores, espaciados y radios.

### API

- `apps/api/src/app.ts`: creación de Fastify, `/health`, `/recognize`, 404 y manejo de errores.
- `apps/api/src/server.ts`: carga de `.env` y arranque.
- `apps/api/src/config/env.ts`: validación de entorno con Zod.
- `apps/api/src/features/recognition/`: servicio de llamada a Gemini y ruta `POST /recognize`.

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

### Fase 1 — Diario completo y catálogo local ✅ COMPLETADA

**Objetivo:** que el usuario pueda registrar, editar y eliminar alimentos reales en su diario sin conexión.

**Decisiones de diseño aprobadas:**

- Flujo de añadir alimento: **modal paso a paso** en la ruta `diary/add-food`.
- Catálogo local: **solo crear alimentos y marcarlos como favoritos**. Editar o borrar alimentos del catálogo queda fuera de esta fase.

#### Tarea 1 — Catálogo de alimentos (lectura/escritura)

Archivos nuevos:

- `apps/mobile/src/features/foods/utils/normalize.ts`
  - Normalizar nombres: minúsculas, sin tildes (`á→a`, `é→e`, …), `ñ→n`, espacios colapsados y recortados.
- `apps/mobile/src/features/foods/types.ts`
  - Tipos `Food`, `FoodInput`, `CreateFoodInput`, etc.
- `apps/mobile/src/data/sqlite/repositories/foodRepository.ts`
  - `createFood(database, input)` → inserta con `source = 'user'`, macros por 100 g (pueden ser `null`) y `is_favorite = false`.
  - `searchFoods(database, query, limit)` → búsqueda por `normalized_name` usando `LIKE`, ordenada por favoritos primero y nombre.
  - `getRecentFoods(database, limit)` → alimentos usados recientemente a partir de `diary_entries.created_at`.
  - `getFavoriteFoods(database, limit)` → alimentos marcados como favoritos.
  - `toggleFavorite(database, foodId)` → cambia `is_favorite`.
- Tests de normalización en `apps/mobile/test/foods/normalize.test.ts`.

#### Tarea 2 — Repositorio del diario (escritura)

Ampliar `apps/mobile/src/data/sqlite/repositories/diaryRepository.ts`:

- `ensureMeal(database, localDate, mealType)` → `INSERT OR IGNORE` en `diary_meals` (la restricción única `(local_date, meal_type)` lo hace atómico).
- `addEntry(database, { localDate, mealType, food, grams })` → asegura la comida + inserta entrada con **snapshot** de nombre y macros por 100 g.
- `updateEntryGrams(database, entryId, grams)` → actualiza gramos de una entrada existente.
- `moveEntry(database, entryId, targetLocalDate, targetMealType)` → mueve entrada a otra comida, asegurando la comida destino.
- `deleteEntry(database, entryId)` → elimina la entrada.
- Validaciones con `gramsSchema` y `nutrientsPer100gSchema` de `@jfood/core`.

#### Tarea 3 — Interfaz de usuario

- `apps/mobile/src/app/(tabs)/diary.tsx` y componentes de `MealList`:
  - Botón "+" en cada comida y CTA en comidas vacías para añadir alimento.
  - Al tocar una entrada existente: opciones para **editar gramos**, **mover de comida** o **eliminar** (con confirmación).
- `apps/mobile/src/app/diary/add-food.tsx` (modal paso a paso):
  1. **Paso de búsqueda:** campo de texto + lista de resultados + secciones "Favoritos" y "Recientes".
  2. **Paso de creación:** botón "Crear alimento" que abre formulario con nombre, marca opcional y macros por 100 g.
  3. **Paso de cantidad:** al seleccionar o crear un alimento, elegir gramos y comida destino, luego "Añadir".
- `apps/mobile/src/features/diary/hooks/useDiaryDay.ts`:
  - Añadir una versión silenciosa de `reload` para usar tras mutaciones sin mostrar spinner.
- Estados vacíos y de error claros; todos los textos en español.

#### Tarea 4 — Pruebas, calidad y cierre

- Tests de lógica pura: normalización, validación de gramos, cálculo de nutrientes.
- Verificación manual completa en dispositivo/emulador:
  - Añadir alimento a cada comida.
  - Editar gramos.
  - Mover entre comidas.
  - Eliminar entrada.
  - Persistencia tras cerrar y abrir la app.
- Checklist completo de calidad:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npx expo-doctor`
  - `npx expo export --platform android`
- Actualizar `README.md` y `PLAN.md` con el estado final de la Fase 1.

**Fuera de alcance:** escáner, códigos de barras, importación BEDCA/Open Food Facts, editar/borrar alimentos del catálogo, sincronización o cuentas.

**Criterios de aceptación:**

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

### Fase 3 — Progreso ✅ COMPLETADA

**Objetivo:** registrar y consultar la evolución del peso de forma local, sin nube ni dependencias de gráficos.

Alcance implementado:

- Repositorio `weightRepository.ts`: lectura, upsert por fecha (aprovechando la restricción única de `weight_logs`) y eliminación de registros.
- Utilidades de tendencia en `features/progress/utils/trend.ts`: cambio respecto al registro anterior y media móvil de los últimos 7 días calendario.
- Hook `useWeightLogs`: carga al enfocar la pantalla, guardado y borrado con recarga automática.
- Pantalla `progress.tsx`: resumen con peso actual, cambio y tendencia; formulario para añadir/editar peso, nota opcional y fecha editable; historial con selección para editar y eliminación con confirmación; estados vacíos y de error en español.
- Tests de regresión para las utilidades de tendencia.
- Sin dependencias nuevas: todo se resuelve con componentes y utilidades existentes.

### Fase 4 — Planificador semanal ✅ COMPLETADA

**Objetivo:** que el usuario planifique comidas con alimentos de su catálogo local y pueda copiar un día planificado al diario, todo offline.

**Decisiones de diseño aprobadas:**

- Navegación de días con controles «Anterior / Hoy / Siguiente» y fecha formateada. Sin librería de calendario.
- Datos separados del diario: tabla `plan_entries` creada con la migración `002_plan`. El plan y el diario pueden divergir.
- Snapshot de nombre y macros por 100 g en cada entrada del plan, igual que en el diario, para que cambios en el catálogo no alteren planes pasados.
- Copiar al diario: botón por día con confirmación; copia todas las entradas del plan de esa fecha al diario sin borrar el plan.
- Modal de añadir reutilizado: `diary/add-food` acepta el parámetro `target=plan` y, en ese modo, escribe en el plan en lugar del diario.

#### Tarea 1 — Migración y repositorio del plan

Archivos nuevos:

- `apps/mobile/src/data/sqlite/migrations/002_plan.ts`
  - Crea `plan_entries` con clave foránea opcional a `foods`, fecha, tipo de comida, nombre del alimento, gramos y snapshot de macros por 100 g.
  - Índices por fecha y por alimento.
- `apps/mobile/src/data/sqlite/repositories/planRepository.ts`
  - `getPlanDay(database, localDate)` → día del plan con entradas y resumen por comida.
  - `addPlanEntry(database, { localDate, mealType, food, grams })` → inserta entrada con snapshot de macros.
  - `updatePlanEntryGrams(database, entryId, grams)`.
  - `movePlanEntry(database, entryId, targetLocalDate, targetMealType)`.
  - `deletePlanEntry(database, entryId)`.
  - `copyPlanToDiary(database, localDate)` → dentro de una transacción, copia cada entrada del plan al diario usando `addEntry`.
  - Validaciones con `gramsSchema` y `nutrientsPer100gSchema` de `@jfood/core`.

#### Tarea 2 — Hook y modal de añadir

- `apps/mobile/src/features/plan/hooks/usePlanDay.ts`
  - Fecha local controlada por la pantalla; recarga al enfocar; refresco silencioso tras mutaciones.
- `apps/mobile/src/app/diary/add-food.tsx`
  - Lee el parámetro `target` (`'diary'` por defecto o `'plan'`).
  - En modo `plan` usa `addPlanEntry`; en modo `diary` mantiene el comportamiento actual con `addEntry`.

#### Tarea 3 — Interfaz del planificador

- `apps/mobile/src/app/(tabs)/planner.tsx` reemplaza el `FeaturePlaceholder`:
  - Cabecera con navegación de días (Anterior, Hoy, Siguiente) y fecha formateada.
  - `MealList` variante `detailed` con las comidas del plan.
  - Acciones por entrada: editar gramos, mover de comida, eliminar con confirmación.
  - Botón «Copiar al diario» con confirmación; notifica al completar.
  - Estados vacíos y de error en español.

#### Tarea 4 — Pruebas, calidad y cierre

- Tests de utilidades de fecha puras (`addDays`) en `apps/mobile/test/date.test.ts`.
- Verificación manual:
  - Añadir alimentos al plan de varias comidas.
  - Editar gramos, mover entre comidas y eliminar.
  - Copiar el día al diario y comprobar totales.
  - Persistencia tras cerrar y abrir la app.
- Checklist completo de calidad.
- Actualizar `README.md` y `PLAN.md`.

**Fuera de alcance:** plantillas o planes recurrentes, semanas predefinidas, sincronización o cuentas, compartir planes, exportar.

**Criterios de aceptación:**

- Añadir, editar y eliminar entradas del plan actualiza la vista inmediatamente.
- Los datos del plan persisten tras cerrar y reabrir la app.
- Copiar un día al diario duplica las entradas sin borrar el plan.
- No se requiere red ni clave de Gemini.
- Todas las comprobaciones de calidad en verde.

### Fase 4.5 — Refinamiento visual y de interacción ✅ COMPLETADA

**Objetivo:** transformar la app de prototipo funcional a producto pulido, manteniendo la lógica de datos intacta.

**Decisiones de diseño aprobadas:**

- Upgrade antes de la Fase 5 para que el escáner herede un sistema de diseño estable.
- Alcance: toda la app (Diario, Plan, Inicio, Progreso, Perfil).
- Dependencias del ecosistema Expo permitidas: `react-native-svg` (gráfico de tendencia) y `@react-native-community/datetimepicker` (selector de fecha), instaladas con `npx expo install`.
- Diario con navegación de días Anterior/Hoy/Siguiente, igual que el Plan.

#### Tarea 0 — Sistema de diseño

- `apps/mobile/src/theme/index.ts` ampliado con `shadows` y `typography`.
- Componentes reutilizables:
  - `Button` (variantes primary/secondary/danger/ghost, icono, loading, escala al pulsar).
  - `ActionSheet` (bottom sheet propio, reemplaza `Alert` de opciones).
  - `ConfirmDialog` (diálogo de confirmación coherente).
  - `EmptyState` (icono + título + mensaje + acción).
  - `DayNavigator` (Anterior/Hoy/Siguiente + Volver a hoy).
  - `SectionHeader` (título + caption + acción opcional).
- `Card` con sombra sutil.

#### Tarea 1 — Diario

- `useDiaryDay` permite fecha controlable y refresca "hoy" automáticamente.
- `diary.tsx`: navegación de días, tarjeta de kcal con progreso, `ActionSheet` para entradas, macros P/C/G por alimento.
- `MealList` mejora filas de entradas, muestra macros y permite pulsar comidas del resumen.

#### Tarea 2 — Planificador

- `planner.tsx`: `DayNavigator`, totales del día planificado (kcal + macros), `EmptyState` para días vacíos, "Copiar al diario" con `ConfirmDialog`.

#### Tarea 3 — Inicio

- Comidas del resumen pulsables (abren añadir alimento para esa comida).
- Accesos rápidos: Peso, Planificar, Escanear.

#### Tarea 4 — Progreso

- Selector de fecha nativo en lugar del input `AAAA-MM-DD`.
- Mini-gráfico de barras de los últimos 7 días con `react-native-svg`.
- Historial sin scroll anidado; confirmación con `ConfirmDialog`.

#### Tarea 5 — Perfil

- Formulario agrupado en secciones con `SectionHeader` y `Button`.
- `useProfile` expone los objetivos calculados.
- Tarjeta resumen de objetivos diarios tras guardar.

#### Tarea 6 — Coherencia global

- `add-food.tsx` y `scanner.tsx` usan `Button` y componentes unificados.
- Estados vacíos consistentes.
- Revisión de accesibilidad (tamaños táctiles, labels).

#### Tarea 7 — Cierre

- Checklist completo de calidad.
- Actualizar `README.md` y `PLAN.md`.

**Fuera de alcance:** nuevas funciones, cambios en modelo de datos o lógica nutricional.

**Criterios de aceptación:**

- Toda la app comparte el mismo sistema de botones, diálogos y tarjetas.
- Diario y Plan permiten navegar días y gestionar entradas de forma coherente.
- Progreso usa selector de fecha nativo y muestra tendencia visual.
- Perfil muestra objetivos tras guardar.
- Todas las comprobaciones de calidad en verde.

### Fase 5 — Escáner con Gemini ✅ COMPLETADA

**Objetivo:** permitir al usuario fotografiar su comida, recibir una identificación asistida por Gemini y añadir los alimentos reconocidos al diario tras revisión.

**Decisiones de diseño aprobadas:**

- La clave de Gemini vive únicamente en el backend; la app solo envía la imagen.
- Gemini devuelve únicamente nombre, gramos estimados y confianza; los nutrientes se toman del catálogo local o quedan como desconocidos.
- Flujo de revisión obligatorio: el usuario confirma o corrige gramos y comida destino antes de guardar.
- Si no hay coincidencia en el catálogo local, el alimento se crea como alimento de usuario con macros desconocidos; se ofrece un fallback manual para introducir los datos nutricionales.
- La URL del backend en desarrollo se deriva automáticamente de `Constants.expoConfig.hostUri` para funcionar en dispositivo físico y emulador.

#### Tarea 1 — Endpoint de reconocimiento

Archivos nuevos:

- `apps/api/src/features/recognition/service.ts`
  - `recognizeFood({ apiKey, model, imageBase64 })` llama a la API REST de Gemini (`v1beta/models/{model}:generateContent`).
  - Prompt estricto que fuerza JSON con `foods` y `warnings`.
  - Parseo y validación con `foodRecognitionSchema` de `@jfood/core`.
  - Manejo de errores de red y respuestas malformadas.
- `apps/api/src/features/recognition/route.ts`
  - Ruta `POST /recognize`.
  - Devuelve 503 si `GEMINI_API_KEY` no está configurado.
  - Devuelve 400 si falta la imagen.
  - Devuelve 502 si Gemini falla o la respuesta no valida.

Modificaciones:

- `apps/api/src/app.ts`: recibe `environment` opcional y registra la ruta `/recognize` cuando está presente.
- `apps/api/src/server.ts`: pasa el entorno cargado a `buildApp`.

Tests:

- `apps/api/test/recognize.test.ts`: respuesta exitosa, Gemini no configurado, payload inválido, errores de Gemini y respuesta malformada (mock de `fetch` global).

#### Tarea 2 — Captura y selección de imagen

Dependencia añadida con `npx expo install`:

- `expo-image-picker` (~58.0.10).

Configuración:

- Plugin añadido a `apps/mobile/app.json` con mensajes de permiso en español para cámara y galería.

Archivos nuevos:

- `apps/mobile/src/features/scanner/hooks/useImagePicker.ts`
  - `launchCamera()` y `launchLibrary()` con solicitud de permisos.
  - Opciones: edición, aspecto 4:3, calidad 0.8, `base64: true`.
  - Devuelve URI, imagen base64 con prefijo `data:{mimeType};base64,` y dimensiones.
- `apps/mobile/src/features/scanner/types.ts`
  - Tipos `RecognizedFood`, `RecognitionResult`, `RecognizedFoodMatch`.
- `apps/mobile/src/config/api.ts`
  - `buildApiBaseUrl(hostUri)` construye la URL a partir de la IP de desarrollo.
  - `getApiBaseUrl()` obtiene `hostUri` de `expo-constants` en la app; en tests o entornos sin módulo nativo cae a `localhost`.
- `apps/mobile/src/features/scanner/api/recognize.ts`
  - `recognizeImage(imageBase64)` hace `POST` a la URL resuelta por `getApiBaseUrl()`.
  - Parseo defensivo de errores y respuestas inesperadas.
- `apps/mobile/src/features/scanner/utils/matchFood.ts`
  - `selectFoodMatch(foods, recognizedName)` función pura: exacta o prefijo (`manzana` → `manzana golden`, no `zumo de manzana` ni `manzanilla`).
  - `findLocalFoodMatch(database, recognized)` busca en el catálogo local y delega en `selectFoodMatch`.

Tests:

- `apps/mobile/test/scanner/recognize.test.ts`: respuesta exitosa, error con mensaje del servidor y respuesta inesperada.

#### Tarea 3 — Pantalla de escáner y revisión

`apps/mobile/src/app/scanner.tsx` reemplaza el estado informativo:

- Paso inicial: botones "Hacer foto" y "Elegir de galería" con aviso sobre cantidades aproximadas.
- Paso preview: muestra la imagen y botón "Analizar".
- Paso analizando: indicador de carga.
- Paso resultados:
  - Lista de alimentos reconocidos con nombre, coincidencia local, gramos editables, confianza y advertencias.
  - Selector de comida destino (Desayuno, Almuerzo, Merienda, Cena).
  - Botón "Añadir al diario".
  - Si un alimento no coincide con el catálogo local, se muestra un icono para crearlo manualmente (abre `diary/add-food` con el nombre prellenado).
- Paso error: mensaje descriptivo, botón "Intentar de nuevo" y fallback "Crear alimento manualmente".

#### Tarea 4 — Integración con catálogo local y diario

- Para cada alimento reconocido se busca en el catálogo local.
- Si hay coincidencia: se usa el alimento existente con los gramos revisados.
- Si no hay coincidencia: se crea un alimento de usuario con macros `null` y se añade al diario.
- Todos los alimentos se guardan en la comida destino seleccionada.

#### Tarea 5 — Pruebas, calidad y cierre

- Tests nuevos en backend y frontend.
- Checklist completo de calidad en verde.
- `README.md` y `PLAN.md` actualizados.

**Fuera de alcance:** edición de alimentos del catálogo, importación de bases de datos externas, códigos de barras, sincronización o cuentas.

**Criterios de aceptación:**

- El backend responde `POST /recognize` validando la imagen y la respuesta de Gemini.
- La app puede capturar o seleccionar una imagen y enviarla al backend.
- Los resultados muestran nombre, gramos estimados y confianza; nunca nutrientes generados por Gemini.
- Los alimentos reconocidos se resuelven contra el catálogo local (solo exacta/prefijo) o se crean como alimento de usuario.
- El fallback manual permite introducir datos nutricionales si la red o Gemini fallan.
- El escáner funciona en dispositivo físico y emulador sin hardcodear `localhost`.
- Todas las comprobaciones de calidad en verde.

### Fase 6 — Pulido y release ✅ COMPLETADA

**Objetivo:** preparar la app para distribución a un pequeño grupo sin costes de hosting ni tiendas, con dos versiones: una 100 % offline y otra con reconocimiento por Gemini.

**Decisiones de diseño aprobadas:**

- Hosting: **Render Free** (HTTPS automático, sin tarjeta). Su cold start se mitiga con **UptimeRobot** (plan free, ping cada 5 min), que mantiene el servicio despierto.
- Modelo de Gemini: `gemini-3.5-flash-lite` (2.5-flash está deprecado y se redirige automáticamente). La capa gratuita ofrece ~500 peticiones/día, suficiente para unos pocos usuarios.
- Rate limiting: `@fastify/rate-limit` en `/recognize` (10 req/min por IP) para proteger la cuota gratuita de Gemini.
- La URL del backend en producción se inyecta en build mediante `EXPO_PUBLIC_API_URL`. En desarrollo sigue derivándose de `Constants.expoConfig.hostUri`.
- Dos versiones desde el mismo código:
  - **Estable** (`eas build --profile estable`): sin `EXPO_PUBLIC_API_URL`, el escáner no aparece en Inicio y, si se accede a la ruta, muestra un modo manual offline. Funciona sin red "sí o sí".
  - **Experimental** (`eas build --profile experimental`): con `EXPO_PUBLIC_API_URL`, flujo completo de foto → API → Gemini. Tiene su propio `applicationId` (`com.jfood.app.experimental`) para poder convivir en el mismo móvil que la estable.
- Distribución: APK generado por **EAS Build** (plan free) con `distribution: internal`, compartido por sideload (WhatsApp, Drive, correo…). Sin Google Play ni tasa de 25 $.

#### Tarea 1 — Backend de producción

Archivos modificados:

- `apps/api/src/config/env.ts`
  - `GEMINI_MODEL` por defecto = `gemini-3.5-flash-lite`.
  - Se acepta `PORT` como alternativa a `API_PORT` (Render inyecta `PORT`).
- `apps/api/src/server.ts`
  - Usa `PORT ?? API_PORT` al arrancar.
- `apps/api/src/app.ts`
  - Registra `@fastify/rate-limit` globalmente: 10 req/min por IP.
- `apps/api/.env.example`
  - Actualizado al nuevo modelo y con `PORT` comentado.

Tests actualizados:

- `apps/api/test/env.test.ts`: valores por defecto, `PORT` sobre `API_PORT`.

#### Tarea 2 — Móvil: URL de producción y modo offline

Archivos modificados:

- `apps/mobile/src/config/api.ts`
  - `getApiBaseUrl()` prioriza `EXPO_PUBLIC_API_URL`.
  - `isScannerEnabled()` devuelve `true` si hay `EXPO_PUBLIC_API_URL` o estamos en desarrollo (`__DEV__`).
- `apps/mobile/src/app/scanner.tsx`
  - Cuando el escáner está deshabilitado muestra un modo manual en lugar de los botones de cámara/galería.
- `apps/mobile/src/app/(tabs)/index.tsx`
  - Oculta el acceso rápido "Escanear" en la versión estable.

Tests actualizados:

- `apps/mobile/test/scanner/apiUrl.test.ts`: cubre `EXPO_PUBLIC_API_URL`, trailing slash, `isScannerEnabled`.

#### Tarea 3 — Builds EAS con dos perfiles

Archivos nuevos:

- `apps/mobile/eas.json`
  - Perfiles `estable` y `experimental`, ambos generando APK interno.
  - `experimental` incluye `EXPO_PUBLIC_API_URL` (placeholder a reemplazar por la URL real de Render).
- `apps/mobile/app.config.js`
  - Reemplaza `app.json` para poder cambiar dinámicamente `name`, `android.package` e `ios.bundleIdentifier` según `EXPO_PUBLIC_API_URL`.
  - Versión experimental: `JfooD Experimental` + `com.jfood.app.experimental`.

Archivo eliminado:

- `apps/mobile/app.json` (sustituido por `app.config.js`).

#### Tarea 4 — Documentación y cierre

- `README.md`: sección de despliegue y builds EAS.
- `PLAN.md`: estado de la Fase 6 y referencias a los archivos clave.
- Checklist de calidad en verde.

**Fuera de alcance:** publicación en Google Play, autenticación de usuarios, backend de sincronización, base de datos remota, logs centralizados, notificaciones push.

**Criterios de aceptación:**

- La API arranca en Render Free leyendo `PORT` y protege `/recognize` con rate limiting.
- La APK estable funciona completamente offline y no muestra el acceso al escáner.
- La APK experimental apunta a la API pública y mantiene el flujo de reconocimiento con Gemini.
- Ambas APKs pueden instalarse en el mismo dispositivo.
- Todas las comprobaciones de calidad en verde.

---

## 7. Decisiones pendientes

1. **Repositorio Git:** ✅ RESUELTO. Se eliminó el `.git` anidado de `apps/mobile` y el código de la app móvil se incorporó como archivos normales del repositorio raíz.
2. **Alcance de la Fase 1:** ✅ RESUELTO. Flujo modal paso a paso (`diary/add-food`); catálogo local con crear alimento + favorito; edición del diario mediante gramos, mover y eliminar entrada.
3. **Hosting y despliegue:** ✅ RESUELTO. Render Free + UptimeRobot para la API; EAS Build con perfiles `estable` y `experimental` para las APKs.
4. **Datos de alimentos:** ✅ RESUELTO. La Fase 1 trabaja solo con alimentos creados por el usuario. La importación desde BEDCA/Open Food Facts queda para una fase posterior.
5. **Peso y objetivos:** ✅ RESUELTO. El peso actual se captura en Perfil (Fase 2) y se registra como el primer `weight_log`, desbloqueando el cálculo de Mifflin-St Jeor y preparando la Fase 3.

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
   con las comprobaciones del documento. La Fase 6 ya está completada;
   prioriza mantenimiento, corrección de bugs o nuevas funciones tras
   revisar el despliegue actual.

   No hagas operaciones Git sin mi aprobación. No añadas dependencias
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

cd apps/mobile
npx eas-cli@latest build --profile estable        # APK estable (offline)
npx eas-cli@latest build --profile experimental   # APK experimental (Gemini)
# Recuerda reemplazar EXPO_PUBLIC_API_URL en eas.json por tu URL de Render.
```
