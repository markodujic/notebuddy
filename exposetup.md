# notebuddy – Setup & Dev-Build (iOS EAS)

> Schnellreferenz für Setup, Cache-Reset und Dev-Build. Vollständige Anleitung + Stolperfallen: `REANIMATED-WORKLETS-SETUP.md`, `PITFALLS.md`.

## Ersteinrichtung

```bash
npx create-expo-app@latest
npm install -g eas-cli
eas login
eas init                # /richtiges Verzeichnis benutzen
eas build:configure
```

## `.npmrc` (Pflicht – einmalig anlegen)

Verhindert, dass `npm install` / `expo install` lokal UND in der EAS-Cloud am
`react@19.2.3` ↔ `react-dom@19.2.7` peer-Konflikt (ERESOLVE) scheitern.

```ini
# .npmrc (Projekt-Root, committen!)
legacy-peer-deps=true
```

## iOS EAS Dev-Build (Standard-Workflow)

```bash
# 1. Pre-Flight-Check (reanimated + worklets Versionen)
npm run verify:reanimated

# 2. Bei nativen Änderungen: neu bauen (kein OTA!)
eas build --profile development --platform ios
```

EAS macht in der Cloud ein frisches `npm install` (per `.npmrc` ohne peer-Konflikte).
`package-lock.json` wird via `.easignore` ignoriert, damit EAS `npm install` statt `npm ci`
nutzt (Windows-Lockfile-Bug, siehe `PITFALLS.md #1`).

## Bei kaputter Installation / Build-Problemen

Nur bei `Invalid Version`- oder `Cannot find module`-Fehlern nötig
(siehe `PITFALLS.md #14`/`#15`):

```bash
rmdir /s /q node_modules
del package-lock.json
rmdir /s /q .expo
npm cache clean --force
npm install
npm run verify:reanimated
eas build --profile development --platform ios
```

## `rnworklets/rnworklets.h file not found` (iOS-Only)

Kein Patch nötig — die Ursache ist ein **veraltetes reanimated/worklets-Paar**.
Upgrade auf `reanimated ^4.5.0` ↔ `worklets ^0.10.0` → siehe `PITFALLS.md #18`
(✅ verifiziert 2026-06-28).

## Dev-Client starten

```bash
npx expo start --dev-client
```
