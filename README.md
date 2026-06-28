# notebuddy 👋

Ear-training / note-learning app built with **Expo SDK 56** (React Native 0.85), Reanimated 4, Skia, and `react-native-audio-api` for live pitch detection. Ported from a Svelte reference app.

## Tech stack

- **Expo SDK 56** · React Native 0.85 · React 19 · TypeScript
- **Audio:** `react-native-audio-api` (recording + autocorrelation pitch detection), `expo-speech-recognition`
- **Graphics/Animation:** `@shopify/react-native-skia`, `react-native-reanimated` 4, `react-native-worklets`, `react-native-svg`, `vexflow`
- **State:** `zustand` · **Persistenz:** `expo-sqlite`
- **Routing:** `expo-router` (NativeTabs)

## Setup

```bash
npx expo install react-native-reanimated react-native-worklets   # native Animation-Libs (offiziell)
npm install
```

> Reanimated + Worklets brauchen einen **Dev-Build** (nicht Expo Go). Keine Patches/Postinstall-Hooks
> nötig – siehe `REANIMATED-WORKLETS-SETUP.md` und `PITFALLS.md #18` (veraltetes Paar = häufigste Build-Fehlerursache; `.npmrc` mit `legacy-peer-deps=true` wird benötigt).

## Development

```bash
npx expo start --dev-client
```

You need a **development build** (native audio/skia/speech modules can't run in Expo Go).

### iOS EAS Dev-Build (standard workflow)

```bash
node ./scripts/verify-reanimated-worklets.js     # Pre-Flight-Check (must be green)
eas build --profile development --platform ios
```

## Project docs

| File | Content |
|------|---------|
| `architecture.md` | Target architecture (audio ⇄ graphics decoupling) |
| `PLAN.md` | Implementation plan & phases |
| `PITFALLS.md` | Known pitfalls & lessons learned |
| `DEBUGGING` | Debugging log of past issues |
| `REANIMATED-WORKLETS-SETUP.md` | Reanimated + Worklets setup & dev-build checklist |

## Troubleshooting build / install issues

- `npm install` / `expo install` fail with `ERESOLVE could not resolve` (react/react-dom) → create `.npmrc` with `legacy-peer-deps=true` → `PITFALLS.md #18`
- `expo config --json` / `prebuild` crash (`pngjs/lib/png.js` missing) → `PITFALLS.md #14`
- `npm install` fails with `Invalid Version:` → delete `package-lock.json` too → `PITFALLS.md #15`
- `rnworklets/rnworklets.h file not found` (iOS) → upgrade to `reanimated ^4.5.0` ↔ `worklets ^0.10.0` → `PITFALLS.md #18` (✅ verifiziert 2026-06-28)
- Reanimated/Worklets setup → **offizieller Weg, keine Patches**: `REANIMATED-WORKLETS-SETUP.md` / `PITFALLS.md #18`

Verify-Check: `npm run verify:reanimated`.

## Get a fresh project

```bash
npm run reset-project
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Router](https://docs.expo.dev/router/introduction)
