# JfooD — Architecture, decisions and project status

**Status (November 2026):** feature-complete and ready to distribute as two APKs (stable and experimental). The phase-by-phase development log that used to live in this file is available in the git history.

For setup, features and commands see [`README.md`](README.md). For building and installing the APKs see [`RELEASE.md`](RELEASE.md).

---

## 1. Goal

A personal, offline-first nutrition app for Android built with React Native, Expo and TypeScript. A Node.js backend is used **only** for AI food recognition with Gemini; the core features need no account and no cloud service.

Monorepo with npm workspaces:

- `apps/mobile`: Expo SDK 58 app (Expo Router, Expo SQLite).
- `apps/api`: Fastify API with validated configuration and centralized error handling.
- `packages/core`: nutrition engine and Zod contracts shared by the app and the API.

## 2. Engineering principles

1. **Keep dependencies minimal.** Expo packages are installed with `npx expo install` so versions stay SDK-compatible.
2. **Nutrition logic lives in `packages/core`.** It is pure, unit-tested and shared.
3. **Unknown is not zero.** Missing nutrient values stay `null` and are reported ("≥ X kcal · N without data"), never silently counted as 0.
4. **Gemini never returns nutrients.** The recognition contract only allows name, estimated grams and confidence. Every result goes through a mandatory review step and is matched against the local catalog (exact or prefix match only) before it is saved.
5. **Secrets stay on the backend.** The Gemini key is never exposed through `EXPO_PUBLIC_*` variables.
6. **Every change is verified:** tests, TypeScript, ESLint, API/core build, Android bundle export and `expo-doctor` (see section 6).

## 3. Delivery phases (summary)

| Phase | Result |
|---|---|
| 0 — Foundation | Monorepo, Expo Router app, SQLite migrations, diary read model, `GET /health`, nutrition engine |
| 1 — Diary and catalog | Step-by-step "add food" flow, local catalog, favorites, recents, editing and moving entries |
| 2 — Profile and goals | Personal data and calorie/macro goals (Mifflin-St Jeor, TDEE) |
| 3 — Progress | Weight log, 7-day average and change, chart |
| 4 / 4.5 — Planner and polish | Day planner with copy-to-diary, unified design system |
| 5 — Gemini scanner | `POST /recognize`, camera/gallery capture, review screen, catalog matching, manual fallback |
| 6 — Release | Render Free deployment, rate limiting, two EAS Build profiles (stable offline / experimental with scanner) |
| 7 and R — Refresh and redesign | Dark mode, streaks, water tracking, catalog management, onboarding, haptics, animated UI |
| 2.0 | Achievements, weekly summary, local reminders, recipes and servings, backup/restore, text logging, barcode scanner |
| Large catalog | ~34,000 foods (USDA FoodData Central and Open Food Facts) as a read-only SQLite file |
| Audits | Several rounds fixing correctness, accessibility, security and build issues, with regression tests |

## 4. Architecture

### Mobile app (`apps/mobile`)

- `src/app/`: Expo Router screens (tabs: Home, Diary, Plan, Progress, Profile; plus scanner, add-food modal, food detail, onboarding).
- `src/features/`: feature modules (diary, foods, scanner, progress, profile, stats, water, reminders, recipes, achievements…), each with its hooks, types and utilities.
- `src/data/sqlite/`: versioned migrations and repositories (diary, goals, profile, foods, settings, stats, water…). Repositories are tested against real SQLite (`node:sqlite`).
- `src/components/`: shared UI (`Screen`, `Card`, `Button`, `ConfirmDialog`, `ActionSheet`, `DayNavigator`, `Toast`, `TextField`, `CalorieHero`…).
- `src/theme/`: light/dark tokens, `ThemeProvider`, typography and spacing.
- `src/config/api.ts`: backend URL resolution (`EXPO_PUBLIC_API_URL` in production, Metro host in development).

### API (`apps/api`)

- `src/app.ts`: Fastify setup, routes, 404 handler and error boundary.
- `src/config/env.ts`: environment validation with Zod (a blank variable counts as unset).
- `src/features/recognition/`: `POST /recognize` (photo) and `POST /parse-meal` (text), Gemini client with timeout and tolerant parsing, daily budgets (global and per IP) and the optional `x-app-token` check.

### Core (`packages/core`)

- `nutrition/nutrients.ts`: per-gram calculation and sums with `null` propagation.
- `nutrition/goals.ts`: age, BMR (Mifflin-St Jeor), TDEE and macro goals.
- `nutrition/bmi.ts`: BMI and categories.
- `schemas/recognition.ts`: Zod contracts for recognition (no nutrients allowed).

## 5. Data model

- `foods`: local catalog (`source`: `user`, `seed`, `open_food_facts`, …), macros per 100 g, favorite flag.
- `diary_meals` / `diary_entries`: one meal per date and type; entries store a **snapshot** of the food name and per-100 g values so later catalog edits never change history.
- `plan_entries`: planned food per day, same snapshot approach.
- `user_profile`, `nutrition_goals` (history with `effective_from`), `weight_logs`, `app_settings` (key/value), `water_logs`.
- The large catalog is a separate read-only SQLite file attached as `catalog`; a food is copied into `foods` only when the user uses it.

Dates are `YYYY-MM-DD` text, validated by the repositories. A database with a newer `user_version` than the app is never opened.

## 6. Verification checklist

```sh
npm test
npm run typecheck
npm run lint
npm run build

cd apps/mobile
npx expo export --platform android --output-dir dist --clear
npx expo-doctor
```

The same checks run in CI (`.github/workflows/ci.yml`) on every push and pull request.

## 7. Useful commands

```sh
npm install                 # install dependencies
npm run start:mobile        # build core and start Expo
npm run start:api           # start the backend in development mode
npm run build               # build core and API
npm test                    # tests of all workspaces
npm run typecheck           # TypeScript in all workspaces
npm run lint                # ESLint

cd apps/mobile
npx eas-cli@latest build --profile estable        # stable APK (offline)
npx eas-cli@latest build --profile experimental   # experimental APK (Gemini)
# Remember to set EXPO_PUBLIC_API_URL in eas.json to your Render URL.
```

## 8. Possible next steps

- English localization of the app interface.
- Optional cloud sync (the app is intentionally local-only today).
