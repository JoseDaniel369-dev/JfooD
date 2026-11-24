# JfooD

Personal, **offline-first nutrition app** for Android, built with React Native, Expo and TypeScript. Track your meals, plan your week, follow your weight and log food from a photo, a text description or a barcode. Everything works without an account or a cloud service; a small Node.js backend is used only for AI food recognition with Gemini.

> **Completely free.** No subscription, no ads, no account and no paywalled features.

> The app interface is in Spanish (it targets Spanish-speaking users and a Spanish food catalog). Code, tests and documentation are in English.

## Why JfooD?

Most nutrition apps lock their core features (barcode scanning, meal planning, AI food recognition) behind a subscription. JfooD includes all of them for free:

- Works fully **offline**: your data stays on your phone.
- **No account** and no tracking: the app has no ads, analytics or payment code.
- The only online feature (AI food recognition) runs on a free-tier stack (Render Free + Gemini free tier), so it costs nothing to use. Because of that tier it has daily limits per user.

## Highlights

- **Offline-first:** all data lives in a local SQLite database (`jfood.db`). No sign-up, no server needed for the core features.
- **Food diary and planner:** meals, quantities in grams or servings, favorites, recents, recipes stored as foods, copy a day to another day, weekly view.
- **Large food catalog:** ~340 basic foods plus tens of thousands of items (USDA FoodData Central and Open Food Facts) shipped as a read-only SQLite file and attached to the user database.
- **AI food recognition:** photo or text → Gemini → a strict, validated contract (name, estimated grams, confidence). Gemini never produces nutrition values; every result goes through a mandatory review step and the local catalog.
- **Barcode scanner** backed by the local catalog first and Open Food Facts as a fallback.
- **Progress:** weight log and chart, 30-day calories vs. goal, BMI, streaks, achievements and a weekly summary.
- **Local reminders** (meals, water, weigh-in, weekly summary) scheduled on the device, with no server involved.
- **Backup and restore:** versioned JSON export; restore is atomic, so an invalid file changes nothing.
- **Quality:** 400+ automated tests (including real SQLite migrations and repositories), strict TypeScript, ESLint and CI on every push.

## Tech stack

| Area | Technologies |
|---|---|
| Mobile | React Native 0.88, Expo SDK 58, Expo Router, Expo SQLite, Reanimated, Gesture Handler |
| Backend | Node.js 22, Fastify, Zod-validated configuration, centralized error handling, rate limiting |
| Shared | TypeScript monorepo (npm workspaces), `@jfood/core` with the nutrition engine and Zod contracts |
| AI | Google Gemini (`gemini-3.5-flash-lite`), called only from the backend |
| Delivery | EAS Build (two APKs), Render (API), GitHub Actions (CI) |

## Repository structure

- `apps/mobile`: Expo app (SDK 58, Expo Router, Expo SQLite). Routes live in `src/app/`.
- `apps/api`: Fastify API with validated configuration and centralized errors.
- `packages/core`: nutrition engine and Zod contracts shared by the app and the API.

## Architecture notes

- **Unknown is not zero.** The engine computes nutrients per gram and keeps unknown values as `null`. `sumNutrientsKnown` returns the known total and how many values are missing, so the UI shows "≥ X kcal · N without data" instead of a wrong number.
- **Diary and plan entries store a snapshot** of the food and its nutrients per 100 g, so later catalog changes never rewrite history.
- **The large catalog** is a read-only SQLite file (`apps/mobile/assets/catalog/catalog.db`) copied on first launch and attached (`ATTACH`) to the user database as `catalog`. Search merges user foods and catalog with a single ordering (favorites, prefix matches, popularity, shortest name). A food is copied into `foods` only when the user uses it, so diary, plan, favorites and backups work the same way.
- **Dates** are stored as `YYYY-MM-DD` text and validated by the repositories. A database whose `user_version` is newer than the app's is not opened, which prevents corrupting data when an older build is installed.
- **The Gemini key stays on the backend.** Never use `EXPO_PUBLIC_*` variables for secrets.
- **Migrations:** `001_initial` (foods, meals, diary entries, profile, goals, weight), `002_plan`, `003_settings`, `004_water`, and later ones for the catalog, serving sizes, recipes and micronutrients. All data is stored locally in `jfood.db`.

## Features in detail

### Diary, search and planner

- Add food with a search box and tabs (Recent, Favorites, Most used, Catalog by category), plus a quantity sheet with servings, preview and "Add and continue".
- Entries can be edited (grams), moved between meals, deleted with **Undo**, duplicated and copied to another day.
- **Servings and recipes:** each food can have servings ("1 unit = 60 g"); a recipe combines foods and is saved as one more food.
- **Planner:** weekly strip with each day's calories, and day-to-day duplication. The central "+" button gives quick access to add food, scan, plan and log weight.
- **Fiber, sugars and salt** are stored per food and per entry (unknown = `NULL`, never zero). Daily references are derived from the calorie goal.

### Goals and progress

- **Goals:** Mifflin-St Jeor equation; maintain, lose or gain at 0.25–1 kg per week, never below 1200 kcal.
- **Progress:** weight log with a draggable chart, 30-day calories vs. goal, **achievements** (confetti the first time they unlock) and a **weekly summary** compared with the previous week.
- **Local reminders** (Profile → Reminders): breakfast, lunch, dinner, water, weigh-in and weekly summary. Everything is off by default and the notification permission is requested when the first one is enabled. The next 3 days are scheduled on the device, rescheduled when the app opens and when food or weight is logged, and **reminders skip what you already did today**.
- **Profile and onboarding:** avatar with your initial, editable name, appearance (light/dark), backup, and an "About" screen with data sources. First launch is a 4-step flow: name, data, reminders and goals.

### Interface

- Emerald + orange palette, a single Nunito type scale, shared components (`TextField`, `CalorieHero`, bottom sheets for all panels), dark mode with its own gradient, Ionicons for actions and emoji only for food.
- Animated rings and bars (Reanimated), gestures (draggable bottom sheets, swipe rows to delete with Undo or duplicate), and a custom tab bar. "Reduce motion" is respected.
- The tab bar respects the Android system insets (explicit numeric height and a minimum bottom area), and `expo-navigation-bar` keeps the system buttons readable in edge-to-edge mode.

### Text logging

Besides photos, the scanner accepts a description ("2 eggs and a coffee with milk"). `POST /parse-meal` returns the same strict contract as `/recognize` (name, estimated grams and confidence, never nutrients), shares the daily Gemini budget and treats the text as data, not as instructions. Every result goes through the mandatory review and the local catalog before it is saved.

### Barcode and product data

The experimental variant can scan barcodes (EAN/UPC). The product is looked up in the local database first and then in [Open Food Facts](https://world.openfoodfacts.org) (public API, no key). Only name, brand and calories/macros per 100 g are stored, and any missing or implausible value stays unknown. Open Food Facts data is under the [ODbL](https://opendatacommons.org/licenses/odbl/) license and the attribution is shown in the scanner screen. The stable variant declares no camera permission.

### Food catalog and data sources

- **Basic catalog:** every install includes ~340 common foods in Spanish with typical servings (1 apple, 1 slice of bread…), marked `source = 'seed'` and not editable. They are loaded when the database opens (`initializeDatabase`) and refreshed only when `SEED_VERSION` increases; user foods are never touched. To regenerate them, edit `apps/mobile/scripts/seed/*.mjs` and run `node apps/mobile/scripts/build-seed-catalog.mjs <USDA-SR-Legacy-CSV-folder>`.
- **Large catalog (tens of thousands of foods, already with calories and macros):** see the architecture notes above. If it cannot be loaded, the app keeps working with the user's foods and the basic ones.
- **Where the data comes from:** generic foods from [USDA FoodData Central](https://fdc.nal.usda.gov/) (SR Legacy, public domain CC0), with names translated into Spanish with Gemini once (`scripts/catalog/translations.json`, versioned); and supermarket products from [Open Food Facts](https://world.openfoodfacts.org/) sold in Spain ([ODbL](https://opendatacommons.org/licenses/odbl/1-0/), credited in Profile → About), sorted by popularity and filtered (Spanish name, calories and macros present and consistent with each other).
- **Rebuild the large catalog:** `npm run catalog:build` downloads USDA (6 MB) and the Open Food Facts dump (~1.5 GB, once, into `.catalog-cache/`, ignored by git), translates what is pending (needs `GEMINI_API_KEY` in `apps/api/.env`; only food names are sent) and rewrites `catalog.db` and `src/data/catalog/catalogVersion.ts`. With the translations already done, `npm run catalog:assemble` is enough. `scripts/catalog/translation-review.md` lists the ~300 most basic foods so their names can be reviewed.
- **Icons and splash:** `node apps/mobile/scripts/generate-brand-assets.mjs` regenerates every brand image from a single SVG glyph.

## API protection

Optional backend variables (Render) so that nobody can burn the Gemini quota:

- `APP_TOKEN`: shared secret; when set, `/recognize` and `/parse-meal` require the `x-app-token` header. The app sends it when built with `EXPO_PUBLIC_APP_TOKEN` set to the same value (for example in the `env` block of the `experimental` profile in `eas.json`). It ships inside the APK, so it only stops casual traffic.
- `RECOGNIZE_DAILY_LIMIT_PER_IP` (default 40): analyses per day per IP, on top of the global cap `RECOGNIZE_DAILY_LIMIT` (300). Calls that fail on Gemini's side do not consume quota.
- If Gemini answers 429/503, the API replies `503 UPSTREAM_BUSY` and the app shows "service busy".

## Requirements

- Node.js 22.13 or newer.
- An Android device or an emulator configured to run the app.

## Getting started

```sh
npm install
npm run start:mobile
```

Always run Expo from `apps/mobile`, or use `npm run start:mobile` from the root. Do not run `npx expo start` in the monorepo root: the root is not an Expo project and the default entry `expo/AppEntry.js` would be used, which fails with `Unable to resolve "../../App"`.

For the backend:

```sh
npm run start:api
```

`GET /health` does not need a Gemini key, and an empty `GEMINI_API_KEY` is treated as not configured, so the API starts without it. Create `apps/api/.env` (ignored by git) with these variables and set `GEMINI_API_KEY` only on the backend. Never use `EXPO_PUBLIC_*` variables for secrets.

```sh
GEMINI_API_KEY=            # required for /recognize
GEMINI_MODEL=gemini-3.5-flash-lite
API_HOST=0.0.0.0
API_PORT=3000              # PORT takes priority (Render)
RECOGNIZE_DAILY_LIMIT=300  # Gemini calls per UTC day for all users
TRUST_PROXY_HOPS=          # trusted proxies; defaults to 1 on Render (RENDER variable) and 0 locally
```

## Deployment and distribution builds

> **Full step-by-step guide: [`RELEASE.md`](RELEASE.md)** (deployment, EAS, installation and the on-device checklist).

### API on Render Free

The repository includes a *blueprint* (`render.yaml`): in Render choose **New → Blueprint** and select the repository. It creates the service with `npm ci && npm run build` and starts it in production mode with `npm run start -w @jfood/api` (`node dist/server.js`). **Do not use `npm run start:api`**: it is the development mode (`tsx watch`).

1. In the Render dashboard, set `GEMINI_API_KEY` (your Gemini key) and `APP_TOKEN` (the secret shared with the app). The other variables already come from the blueprint.
2. Render sets `RENDER`, so the API trusts 1 proxy to get the real client IP (rate limit of 10 req/min per IP). If you put another proxy in front (for example Cloudflare), adjust `TRUST_PROXY_HOPS`.
3. Render injects `PORT` automatically; the server uses it instead of `API_PORT`.
4. To avoid the ~1 minute cold start, create a free [UptimeRobot](https://uptimerobot.com) monitor that pings `https://YOUR_API.onrender.com/health` every 5 minutes.

### App builds with EAS

Write the real URL of your API into `apps/mobile/eas.json` with `npm run release:set-api-url -- https://your-api.onrender.com` (the build fails if the placeholder `TU_API` is left or if the URL is not HTTPS). Before building, `npm run release:check` runs every check.

Build the APKs:

```sh
cd apps/mobile
npx eas-cli@latest build --profile estable        # 100 % offline APK
npx eas-cli@latest build --profile experimental   # APK with the Gemini scanner
```

The app version is `0.2.0`; EAS manages `versionCode` (`appVersionSource: remote` + `autoIncrement`), so each build adds one. You must sign in once with `npx eas-cli@latest login` before building. If you use `APP_TOKEN` on the API, set the same value as an EAS variable in the `preview` environment (`npx eas-cli@latest env:set --name EXPO_PUBLIC_APP_TOKEN --value … --environment preview --visibility plaintext`) instead of writing it in `eas.json`, which is committed. Each profile uses its own environment (`estable` → `production`, `experimental` → `preview`), so the token only reaches the experimental build. Because `app.config.js` is a script, paste the `projectId` shown by `eas init` into `EAS_PROJECT_ID`.

The stable variant declares no camera or photo permissions (they are also blocked in the Android manifest); neither variant asks for the microphone. The first time the scanner is used, a notice explains that the photo is sent to Google (Gemini).

Both profiles use `distribution: internal` and produce an APK that can be shared directly by sideloading. The experimental version installs as `JfooD Experimental` (`com.jfood.app.experimental`) so it does not overwrite the stable one.

### Mobile environment variables

- `EXPO_PUBLIC_API_URL`: public HTTPS URL of the API. If it is not defined, the app works in offline mode (stable version).
- In development, without this variable, the app uses `Constants.expoConfig.hostUri` to reach your machine.

## Checks

```sh
npm test
npm run typecheck   # sources and tests of the three packages
npm run lint
npm run build
npx expo export --platform android
```

`npm test` runs the real migrations on in-memory SQLite (`apps/mobile/test/helpers/sqliteAdapter.ts`, based on `node:sqlite`) to test the repositories. If you change dependencies or `packages/core`, run `npm ci`: `@jfood/core` is consumed from `dist` and a stale `dist` breaks the app. The workflow `.github/workflows/ci.yml` repeats all these checks.

Additional app diagnostics:

```sh
npm exec -w @jfood/mobile -- expo-doctor
```

## Project history

The project was built in phases (diary and catalog, weight tracking, planner, Gemini scanner, production release, visual refresh, "JfooD 2.0" with achievements and reminders, and several audits that fixed correctness, accessibility and security issues). The architecture, engineering principles, data model and a summary of the phases are in [`PLAN.md`](PLAN.md).
