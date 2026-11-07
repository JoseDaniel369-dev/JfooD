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

Planificador y escáner siguen mostrando estados informativos hasta sus respectivas fases; no simulan funciones todavía no implementadas.

La barra de pestañas respeta el área segura del sistema en Android: usa una altura numérica explícita (`56 + inset inferior`) y un suelo de 64 dp para la zona de navegación, evitando que la barra del sistema se solape con los iconos o etiquetas incluso en dispositivos que infrarreportan el inset inferior. En SDK 58 la navegación Android es siempre edge-to-edge, por lo que también se configura `expo-navigation-bar` para mantener el contraste de los botones del sistema. La fecha del diario se mantiene al día al volver a primer plano y al cambiar el día con la aplicación abierta. Mientras no exista configuración en Perfil, la pantalla de Inicio señala que los objetivos son provisionales.

El motor ya calcula nutrientes por gramos y conserva los valores desconocidos como `null`. El contrato de reconocimiento admite únicamente nombre, gramos estimados y confianza, nunca valores nutricionales generados por Gemini.

El plan por fases, el estado detallado y las instrucciones para retomar el desarrollo en una sesión nueva están en [`PLAN.md`](PLAN.md).

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

El endpoint `GET /health` no necesita clave de Gemini y una `GEMINI_API_KEY` vacía se interpreta como no configurada, de modo que la API arranca sin ella. Cuando se implemente el escáner, copia `.env.example` como `apps/api/.env` y configura `GEMINI_API_KEY` solo en el backend. Nunca uses variables `EXPO_PUBLIC_*` para secretos.

## Comprobaciones

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Diagnóstico adicional de la app:

```sh
npm exec -w @jfood/mobile -- expo-doctor
```

## Modelo de datos

La migración `001_initial` crea alimentos, comidas y entradas del diario, perfil, objetivos y registros de peso. Las entradas guardan un snapshot del alimento y de sus nutrientes por 100 g para que cambios posteriores del catálogo no alteren el historial.

Los objetivos iniciales de la interfaz son provisionales (2000 kcal) hasta completar su configuración en Perfil, y la pantalla de Inicio lo indica explícitamente. Todos los datos se almacenan localmente en `jfood.db`.
