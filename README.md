# JfooD

Aplicación móvil personal de nutrición, offline-first, desarrollada con React Native, Expo y TypeScript. El backend de Node.js se reserva para el reconocimiento de alimentos con Gemini; las funciones básicas no requieren cuenta ni servicio cloud.

## Estructura

- `apps/mobile`: aplicación Expo SDK 58, Expo Router y Expo SQLite. Las rutas están en `src/app/`.
- `apps/api`: API Fastify con configuración validada y errores centralizados.
- `packages/core`: motor nutricional y contratos Zod compartidos.

## Estado actual

La base inicial incluye navegación por las cinco secciones, identidad visual, migración SQLite, lectura del resumen diario desde la base local y endpoint de salud del backend. La pantalla de Perfil permite configurar datos personales y calcular objetivos nutricionales reales con la ecuación de Mifflin-St Jeor.

La Fase 1 añade el diario completo y el catálogo local offline: se pueden crear alimentos, marcarlos como favoritos, buscar en el catálogo, consultar recientes y añadir entradas al diario con un modal paso a paso. Las entradas se pueden editar en gramos, mover entre comidas y eliminar con confirmación.

La Fase 3 convierte la pantalla de Progreso en un registro de peso funcional: permite añadir, editar y eliminar registros por fecha, muestra el cambio respecto al peso anterior y la media de los últimos 7 días, y mantiene todo el historial localmente.

La Fase 4 implementa el planificador (navegación día a día, sin vista de semana todavía): permite añadir alimentos del catálogo local a cualquier día, editar gramos, mover entradas entre comidas, eliminarlas y copiar un día planificado completo al diario. Todo se guarda localmente y funciona sin conexión.

La Fase 4.5 refina la interfaz y la experiencia de interacción: sistema de diseño unificado con `Button`, `ActionSheet`, `ConfirmDialog`, `EmptyState`, `DayNavigator` y `SectionHeader`; navegación de días en el Diario; totales y macros visibles en el Plan; accesos rápidos y comidas pulsables en Inicio; selector de fecha nativo y mini-gráfico de tendencia en Progreso; resumen de objetivos y formulario por secciones en Perfil.

La Fase 5 implementa el escáner con Gemini: endpoint `POST /recognize` en el backend que recibe una imagen base64, llama a la API de Gemini y devuelve solo nombre, gramos estimados y confianza; pantalla de escáner con captura de cámara o selección de galería (`expo-image-picker`), preview, análisis, revisión de resultados, edición de gramos, selección de comida destino y añadido al diario; resolución de alimentos reconocidos contra el catálogo local (solo coincidencia exacta o prefijo), creación automática como alimento de usuario cuando no hay coincidencia, y fallback manual para introducir los datos nutricionales. La clave de Gemini se mantiene únicamente en el backend.

La Fase 6 prepara la app para producción a coste cero:

- La API se despliega en **Render Free**; el modelo por defecto es `gemini-3.5-flash-lite` (2.5-flash está deprecado) y `/recognize` tiene rate limiting (10 req/min por IP).
- La URL del backend en producción se inyecta en build mediante `EXPO_PUBLIC_API_URL`.
- Se generan **dos APKs** desde el mismo código con EAS Build:
  - **estable**: 100 % offline, sin escáner; funciona sin red.
  - **experimental**: con escáner por Gemini apuntando a la API pública.
- Ambas APKs pueden convivir en el mismo móvil porque tienen `applicationId` distinto.

La Fase 7 ("JfooD Refresh") renueva la interfaz y añade funciones de usuario antes del lanzamiento:

- **Modo oscuro** automático y persistente con tokens light/dark.
- **Refresh visual:** paleta verde esmeralda + naranja, tipografía Nunito, gradientes, sombras y componentes unificados.
- **Racha y estadísticas:** anillo de racha, barras semanales y resumen de adherencia en Inicio.
- **Registro de agua:** tarjeta rápida en Inicio y objetivo configurable en Perfil.
- **Gestión del catálogo:** edición y eliminación de alimentos locales con aviso de uso.
- **Progreso mejorado:** gráfico de línea por periodos (7/14/30/90 días) e IMC.
- **Onboarding:** flujo de primer arranque de 3 pasos.
- **Haptics y toasts:** feedback táctil y mensajes contextuales.

Tras la Fase 7 se aplicó un **rediseño animado e intuitivo** con la API `Animated` nativa (sin nuevas dependencias): transiciones suaves entre pantallas, entrada escalonada de tarjetas, barras y anillos animados, botones con escala al pulsar, swipe para cambiar de día en Diario y Planificador, FAB flotante para añadir alimentos, empty states accionables y feedback visual de errores (shake).

Tras el rediseño se hizo una revisión de calidad que corrigió: carrera entre toasts, doble cierre de diálogos/modales, búsqueda con resultados obsoletos, guardado atómico en el escáner, onboarding robusto contra fallo de escritura del flag, rollover de medianoche en agua, errores visibles al eliminar alimentos, rate limit que excluye query strings en `/health`, peticiones cancelables del escáner, periodos completos en el gráfico de peso (7/14/30/90 días) y mejoras de accesibilidad en campos de texto.

Una segunda auditoría post-Fase R corrigió: cierre fantasma de `ActionSheet`/`ConfirmDialog` al reabrir durante la animación de salida, timeout en el cliente de reconocimiento para evitar análisis colgados, gate de carga del tema para eliminar el flash de tema claro al arrancar, feedback de error si falla la persistencia del tema, `accessibilityLabel` en el input de agua, caption de error en la tarjeta de agua y SQL simplificado en `getRecentFoods`.

La app deriva automáticamente la URL del backend en desarrollo a partir de la IP que sirve el bundle de Metro (`Constants.expoConfig.hostUri`), por lo que el escáner funciona en dispositivo físico y emulador sin configuración adicional.

La barra de pestañas respeta el área segura del sistema en Android: usa una altura numérica explícita (`56 + inset inferior`) y un suelo de 64 dp para la zona de navegación, evitando que la barra del sistema se solape con los iconos o etiquetas incluso en dispositivos que infrarreportan el inset inferior. En SDK 58 la navegación Android es siempre edge-to-edge, por lo que también se configura `expo-navigation-bar` para mantener el contraste de los botones del sistema. La fecha del diario se mantiene al día al volver a primer plano y al cambiar el día con la aplicación abierta. Mientras no exista configuración en Perfil, la pantalla de Inicio señala que los objetivos son provisionales.

**Auditoría integral (noviembre de 2026).** Se corrigieron: sobrescritura del peso de hoy al guardar el Perfil con datos obsoletos, "Recientes" que devolvía una sola fila, rate limit de `/recognize` que nunca se aplicaba (rutas registradas antes del plugin) y que no distinguía clientes tras el proxy de Render, totales del día anulados por un alimento sin calorías (ahora "≥ X kcal · N sin datos" con edición de los valores de la entrada), rangos absurdos de peso/altura/edad, macros físicamente imposibles al crear alimentos, fechas inválidas o futuras, clave de Gemini en la URL, petición/respuesta de `/recognize` sin contrato Zod, permisos de cámara/micrófono innecesarios y falta de aviso de privacidad del escáner. Se añadieron tests de la capa SQLite (`node:sqlite`), de la API y de la configuración de build, y CI.

El motor ya calcula nutrientes por gramos y conserva los valores desconocidos como `null`; para mostrarlos, `sumNutrientsKnown` devuelve el total conocido y cuántos valores faltan (nunca se cuentan como cero). El contrato de reconocimiento admite únicamente nombre, gramos estimados y confianza, nunca valores nutricionales generados por Gemini.

El plan por fases, el estado detallado y las instrucciones para retomar el desarrollo en una sesión nueva están en [`PLAN.md`](PLAN.md).

## Datos del usuario, objetivos y recetas

- **Copia de seguridad:** Perfil → «Tus datos» exporta un JSON versionado y restaura desde un archivo. La restauración es atómica: si algo no es válido, no se cambia nada.
- **Objetivo de peso:** mantener, perder o ganar con un ritmo de 0,25 a 1 kg por semana; las calorías nunca bajan de 1200 kcal.
- **Raciones y recetas:** cada alimento puede tener raciones ("1 unidad = 60 g"); una receta combina alimentos y se guarda como un alimento más.
- **Planificador:** tira semanal con las calorías de cada día y duplicado del día al siguiente. El botón central «+» de la barra da acceso rápido a añadir comida, escanear, planificar y registrar peso.

## Registro por texto

Además de la foto, el escáner admite describir la comida ("2 huevos y un café con leche"). `POST /parse-meal` devuelve el mismo contrato estricto que `/recognize` (nombre, gramos estimados y confianza, nunca nutrientes), comparte el límite diario de Gemini y trata el texto como datos, no como instrucciones. Todo resultado pasa por la revisión obligatoria y por el catálogo local antes de guardarse.

## Código de barras y datos de productos

La variante experimental puede escanear códigos de barras (EAN/UPC). El producto se busca primero en la base local y, si no está, en [Open Food Facts](https://world.openfoodfacts.org) (API pública, sin clave); solo se guardan nombre, marca y calorías/macros por 100 g, y cualquier valor ausente o inverosímil queda como desconocido. Los datos de Open Food Facts están bajo licencia [ODbL](https://opendatacommons.org/licenses/odbl/): se muestra la atribución en la pantalla del escáner. La variante estable no declara permisos de cámara.

## Requisitos

- Node.js 22.13 o superior.
- Un dispositivo Android o un emulador configurado para ejecutar la app.

## Instalación y desarrollo

```sh
npm install
npm run start:mobile
```

Ejecuta Expo siempre desde `apps/mobile`, o usa `npm run start:mobile` desde la raíz. No ejecutes `npx expo start` en la raíz del monorepo: la raíz no es un proyecto Expo y se usaría la entrada por defecto `expo/AppEntry.js`, que falla con `Unable to resolve "../../App"`.

Para el backend:

```sh
npm run start:api
```

El endpoint `GET /health` no necesita clave de Gemini y una `GEMINI_API_KEY` vacía se interpreta como no configurada, de modo que la API arranca sin ella. Crea `apps/api/.env` (ignorado por git) con estas variables y configura `GEMINI_API_KEY` solo en el backend. Nunca uses variables `EXPO_PUBLIC_*` para secretos.

```sh
GEMINI_API_KEY=            # obligatoria para /recognize
GEMINI_MODEL=gemini-3.5-flash-lite
API_HOST=0.0.0.0
API_PORT=3000              # PORT tiene prioridad (Render)
RECOGNIZE_DAILY_LIMIT=300  # llamadas a Gemini por día UTC para todos los usuarios
TRUST_PROXY_HOPS=          # proxies de confianza; por defecto 1 en Render (variable RENDER) y 0 en local
```

## Despliegue y builds de distribución

### API en Render Free

1. Crea un servicio web en [Render](https://render.com) desde tu repositorio de GitHub.
2. Selecciona el directorio raíz y el comando de arranque: `npm run start:api`.
3. Añade una variable de entorno `GEMINI_API_KEY` con tu clave de Gemini. Render define `RENDER`, por lo que la API confía en 1 proxy para obtener la IP real del cliente (rate limit de 10 req/min por IP); si pones otro proxy delante (p. ej. Cloudflare), ajusta `TRUST_PROXY_HOPS`.
4. Render inyecta `PORT` automáticamente; el servidor lo usa como fallback de `API_PORT`.
5. Para evitar el cold start de ~1 min, crea un monitor gratuito en [UptimeRobot](https://uptimerobot.com) que haga ping a `https://TU_API.onrender.com/health` cada 5 min.

### Builds de la app con EAS

Edita `apps/mobile/eas.json` y reemplaza `https://TU_API.onrender.com` por la URL real de tu API (la build falla si queda el valor de ejemplo o si la URL no es HTTPS):

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://TU_API.onrender.com"
}
```

Genera las APKs:

```sh
cd apps/mobile
npx eas-cli@latest build --profile estable        # APK 100 % offline
npx eas-cli@latest build --profile experimental   # APK con escáner Gemini
```

La variante estable no declara permisos de cámara ni fotos; ninguna variante pide micrófono. La primera vez que se usa el escáner se muestra un aviso explicando que la foto se envía a Google (Gemini).

Ambos perfiles usan `distribution: internal` y generan un APK que puedes compartir directamente por sideload. La versión experimental se instala como `JfooD Experimental` (`com.jfood.app.experimental`) para que no sobrescriba la estable.

### Variables de entorno del móvil

- `EXPO_PUBLIC_API_URL`: URL pública y HTTPS de la API. Si no está definida, la app funciona en modo offline (versión estable).
- En desarrollo, sin esta variable, la app usa `Constants.expoConfig.hostUri` para conectar con tu máquina.

## Comprobaciones

```sh
npm test
npm run typecheck   # fuentes y tests de los tres paquetes
npm run lint
npm run build
npx expo export --platform android
```

`npm test` ejecuta las migraciones reales sobre SQLite en memoria (`apps/mobile/test/helpers/sqliteAdapter.ts`, basado en `node:sqlite`) para probar los repositorios. Si cambias dependencias o `packages/core`, ejecuta `npm ci`: `@jfood/core` se consume desde `dist` y un `dist` antiguo rompe la app. El workflow `.github/workflows/ci.yml` repite todas estas comprobaciones.

Diagnóstico adicional de la app:

```sh
npm exec -w @jfood/mobile -- expo-doctor
```

## Modelo de datos

La migración `001_initial` crea alimentos, comidas y entradas del diario, perfil, objetivos y registros de peso. La migración `002_plan` añade la tabla `plan_entries`; `003_settings` añade `app_settings` para preferencias (tema, onboarding visto, objetivo de agua); `004_water` añade `water_logs`. Las entradas del diario y del plan guardan un snapshot del alimento y de sus nutrientes por 100 g para que cambios posteriores del catálogo no alteren el historial.

Las fechas se guardan como texto `YYYY-MM-DD`; los repositorios las validan y no admiten pesos con fecha futura. Una base de datos con `user_version` mayor que el de la app no se abre (evita corromper datos al instalar una build antigua).

Los objetivos iniciales de la interfaz son provisionales (2000 kcal) hasta completar su configuración en Perfil, y la pantalla de Inicio lo indica explícitamente. Todos los datos se almacenan localmente en `jfood.db`.
