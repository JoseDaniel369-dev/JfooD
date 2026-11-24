# How to build the JfooD APKs

This guide takes you from "the code is ready" to "I have two `.apk` files installed on my phone". Follow the steps in order. Everything marked with 🔑 needs something only you have (accounts and keys).

| APK | What it is | Needs |
|---|---|---|
| **stable** (`JfooD`) | 100 % offline: diary, catalog, reminders, progress. No camera or scanner. | Only an Expo account |
| **experimental** (`JfooD Experimental`) | Same, plus photo scanner, text logging and barcode scanner. | Expo account + the API deployed on Render + a Gemini key |

They can live on the same phone because they have different `applicationId`s (`com.jfood.app` and `com.jfood.app.experimental`). If you only want the stable one, skip steps 2 and 4.

---

## 1. Check that everything is green

From the repository root:

```sh
npm ci
npm run release:check
```

It runs, and stops at the first failure: tests (API, mobile, core), `typecheck`, `lint`, API and core build, Android bundle export and `expo-doctor`. If anything fails, do not continue.

## 2. 🔑 Deploy the API on Render (experimental only)

1. Push the repository to GitHub.
2. In [Render](https://render.com): **New → Blueprint** and choose the repository. It reads `render.yaml` and creates the `jfood-api` service (free plan, production start `node dist/server.js`).
3. In the service's **Environment** panel, set the two values that `render.yaml` intentionally leaves empty:
   - `GEMINI_API_KEY`: your key from <https://aistudio.google.com/apikey>.
   - `APP_TOKEN`: a long random string that you make up (for example 40 characters). **Write it down**: you need it in step 4.
4. Wait for the deploy to finish and check that `https://YOUR-SERVICE.onrender.com/health` answers with `"status":"ok"`.
5. Optional but recommended: a free [UptimeRobot](https://uptimerobot.com) monitor that pings `/health` every 5 minutes, to avoid the ~1 minute cold start of the free plan.

> Local test of the same API in production mode: `npm run start:api:prod` (with an `apps/api/.env` based on `apps/api/.env.example`).

## 3. 🔑 Expo project (EAS)

```sh
cd apps/mobile
npx eas-cli@latest login        # your expo.dev account
npx eas-cli@latest init         # creates the project and shows its projectId
```

Because the app configuration is a script (`app.config.js`), `eas init` cannot write the identifier for you if it does not recognize it: **paste it by hand** into the `EAS_PROJECT_ID` constant at the top of `apps/mobile/app.config.js`. It is not a secret; it can be committed.

## 4. 🔑 API URL and token (experimental only)

From the repository root:

```sh
npm run release:set-api-url -- https://YOUR-SERVICE.onrender.com
```

It checks that the URL is HTTPS and writes it into the `experimental` profile of `apps/mobile/eas.json` (the build refuses to run with the placeholder `TU_API`).

Then the token (the same `APP_TOKEN` as on Render). Each build profile uses its own EAS environment (`estable` → `production`, `experimental` → `preview`), so the token only reaches the experimental build:

```sh
cd apps/mobile
npx eas-cli@latest env:set --name EXPO_PUBLIC_APP_TOKEN --value "THE_SAME_APP_TOKEN" --environment preview --visibility plaintext
```

The token travels inside the APK (anyone with the APK can read it), so it only stops casual traffic: what really protects your Gemini quota are the API's daily limits. If your version of `eas-cli` offers `--visibility sensitive`, you can use it (`npx eas-cli@latest env:set --help`); **do not** use `secret` with `EXPO_PUBLIC_` variables.

## 5. Build

```sh
cd apps/mobile
npx eas-cli@latest build -p android --profile estable
npx eas-cli@latest build -p android --profile experimental
```

- It builds in the EAS cloud (on Windows you cannot build Android locally with EAS). Each build takes about 10–20 minutes in the free queue.
- When it finishes, EAS shows a download link for each `.apk`.
- The internal version number (`versionCode`) is managed by EAS and goes up by itself on every build.
- The first time it will ask whether to generate a *keystore* (the app signature): answer yes and **do not lose it** (EAS stores it for you in your account).

## 6. Install

- **From the phone:** open the EAS link, download the `.apk` and allow "install apps from unknown sources" for the browser.
- **From the PC with `adb`:** `adb install JfooD.apk`.

## 7. Check on the phone

This is the only thing that cannot be verified without a device. Try it with the **stable** build (and points 8–9 with the experimental one). The app interface is in Spanish; the labels below are given in English with the Spanish text in quotes when it helps.

1. **First launch:** new icon and splash screen; 4-step onboarding (name, data, reminders, goals with confetti). The app must open in no more than a few seconds: it copies the large catalog the first time.
   - **Large catalog:** Add food → search "yogur natural", "pan de molde", "pechuga de pollo", "hacendado": they appear with brand, calories and macros without typing anything. Pick one and add it to the diary; it must then appear in "Recientes". Also try the "Catálogo" tab (category chips, "Ver más alimentos") and mark one as a favorite.
   - If Profile → About shows "El catálogo ampliado no se ha podido cargar" (the extended catalog could not be loaded), note it down with the phone model (the app keeps working with the 338 basic foods).
2. **Keyboard in sheets:** Add food → tap one → tap the grams field. The "Add" button must be fully visible above the keyboard, also on a small phone. Repeat with "Otra…" (other) in water and with your name in Profile.
3. **Gestures:** in the Diary, swipe an entry left (deletes, with Undo) and right (duplicates).
4. **Reminders:** Profile → Reminders → enable one with the time set 2 minutes ahead. The notification must arrive and, when tapped, open the right screen. Log that meal before the time and check that it does **not** arrive.
5. **Copy to another day** (copy icon next to a meal in the Diary) and **Duplicate as mine** (food detail from the catalog): the original does not change.
6. **Progress → Macros** with a few logged days; **Water → Otra…**.
7. **Dark mode** (Profile → Appearance) and the system "reduce motion" setting: no broken screens or unreadable text.
8. **Backup:** Profile → Your data → export; restore in the other APK and check that reminders, name and catalog are still there.
9. **Experimental only:** photo scanner, text ("2 huevos y un café") and barcode scanner. The first request after a while can take up to ~1 minute (the free API "falls asleep"). From the Planner, "Add food" → "Scan" must save to the **plan**, not to the diary.
10. **Visual refresh (November 2026):**
    - **Tab bar:** the system buttons must not cover the labels and the bar must not be too tall. If something overlaps, raise `MIN_BOTTOM_INSET` in `apps/mobile/src/components/AppTabBar.tsx`.
    - **Keyboard:** open a low field in Progress (weight), Recipe and Profile (height): it must be fully visible above the keyboard.
    - **Startup:** no flicker between the splash screen and the app, in light and dark.
    - **Weight chart** (Progress → Weight, with 2+ entries): drag a finger to see each day; vertical scrolling of the screen must keep working.
    - **Double tap:** "Copy to diary" in the Planner and "Repeat yesterday" on Home must copy only once.

### Things that are normal

- On Android 12+ notifications can arrive **a few minutes late**: the app deliberately does not request the "exact alarms" permission, to avoid adding special permissions.
- Reminders are scheduled for the next 7 days every time you open the app: if you go more than a week without opening it, they stop arriving until you open it.
- The stable APK does not show the scanner or barcodes; that is expected.

## 8. If something fails

| Symptom | What to look at |
|---|---|
| The build fails with "TU_API" or "HTTPS" | Repeat step 4 (`release:set-api-url`). |
| `eas build` says there is no project | Paste the `projectId` into `EAS_PROJECT_ID` (step 3). |
| The scanner answers "not authorized" | The EAS `EXPO_PUBLIC_APP_TOKEN` does not match Render's `APP_TOKEN`; rebuild the experimental APK after fixing it. |
| The scanner says "El reconocimiento no está configurado en este servidor" (recognition is not configured on this server) | `GEMINI_API_KEY` is empty on the server. Set it in the Render **Environment** panel (key name `GEMINI_API_KEY`, value = your Gemini key) and wait for the deploy to be **Live**. No rebuild needed. |
| The scanner says "service busy" | It is the Gemini free-tier limit: wait, or raise `RECOGNIZE_DAILY_LIMIT` on Render. |
| The sheet button is hidden by the keyboard | Note it down with the phone model: plan B is to replace the keyboard calculation with `react-native-keyboard-controller`. |
| Notifications do not arrive | Phone settings → Apps → JfooD → Notifications (enabled) and "no battery restrictions". Profile shows a warning if the permission is denied. |
