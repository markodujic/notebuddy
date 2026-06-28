# Reanimated + Worklets – Setup & Dev-Build (offizieller Weg)

> Prüfliste für die native Integration von `react-native-reanimated` + `react-native-worklets`
> in notebuddy (Expo SDK 56 / RN 0.85). **Offiziell, keine Patches.** Stand: 2026-06-28.

## Offizielle Quellen

- Expo: https://docs.expo.dev/versions/v56.0.0/sdk/reanimated/
- Reanimated: https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started
- Worklets: https://docs.swmansion.com/react-native-worklets/docs/fundamentals/getting-started

## Kompatibles Versions-Paar (automatisch via `expo install`)

| Paket | Version | Hinweis |
|---|---|---|
| `react-native-reanimated` | `^4.5.0` | — |
| `react-native-worklets` | `^0.10.0` | RN-Range `0.83 – 0.86` ✓ |
| `react-native` | `0.85.3` | Expo SDK 56 |

`reanimated@4.5.0` fordert per `peerDependencies` `react-native-worklets: 0.10.x`; beide Releases
geben `react-native: 0.83 – 0.86` an, passen also zu RN 0.85.3 (Expo SDK 56). Diese Versionen
setzt `npx expo install` automatisch (Voraussetzung: `.npmrc` mit `legacy-peer-deps=true`, siehe Schritt 1.5).

## Wichtige Erkenntnis: Keine Patches nötig

Eine frühere Version dieser Doku beschrieb einen `scripts/patch-worklets.js`-Postinstall-Patch,
der einen angeblichen `rnworklets.h`-Bug fixen sollte. **Das war ein Irrweg**:

- Keine der offiziellen Docs erwähnt diesen Bug.
- Auf GitHub gibt es **kein Issue** zu "rnworklets.h file not found".
- Der Fehler trat nur wegen einer **kaputten `node_modules`-Installation** auf
  (pngjs unvollständig / npm `Invalid Version`-Bug – siehe `PITFALLS.md #14`/`#15`).

**Die Lösung ist eine saubere Neuinstallation, kein Patchen von Abhängigkeiten.**

## Vorgehensweise – Schritt für Schritt

### 0. ⚠️ `expo`-Basiselement in `package.json` prüfen (Root-Cause-Guard)

Bevor irgendetwas anderes gemacht wird: Das `expo`-Basiselement muss auf **SDK 56** stehen.
Ein Tippfehler `"expo": "^46.0.21"` (statt `~56.0.x`) erzeugt kein New-Architecture-Codegen-Projekt
(siehe `PITFALLS.md #17` als historische Diagnose). **Achtung:** das ist nur *ein* möglicher Grund
für `rnworklets/rnworklets.h file not found` — die häufigste Ursache ist ein **veraltetes
reanimated/worklets-Paar**, siehe `PITFALLS.md #18` (✅ 2026-06-28 bestätigt: Upgrade auf
`reanimated ^4.5.0` ↔ `worklets ^0.10.0` hat den Build repariert).

```jsonc
// package.json – KORREKT:
"expo": "~56.0.0"     // ← Tilde + SDK-Minor
```

Schnell-Check:
```bash
node -p "require('expo/package.json').version"   # → muss 56.x sein
```
Der Verify-Check (Schritt 3) prüft das automatisch mit (Schritt [0/5]).

### 1. `.npmrc` mit `legacy-peer-deps=true` (Pflicht vor `npm install`)

Ohne `.npmrc` bricht `npm install` / `expo install` am `react@19.2.3` ↔ `react-dom@19.2.7`
peer-Konflikt (ERESOLVE) — und der EAS-Cloud-Build scheitert schon vor dem eigentlichen Build.

```ini
# .npmrc (Projekt-Root, committen!)
legacy-peer-deps=true
```

### 1. Bei kaputter Installation: vollständiger Reset

(siehe `PITFALLS.md #15` für Details, nur nötig bei `Invalid Version`- oder `Cannot find module`-Fehlern)

```bash
cd d:\notebuddy
rmdir /s /q node_modules
del package-lock.json
rmdir /s /q .expo
npm cache clean --force
```

### 2. Offiziell installieren

```bash
npx expo install react-native-reanimated react-native-worklets
```

`expo install` wählt automatisch die kompatiblen Versionen. Das reanimated/worklets-Babel-Plugin
wird von `babel-preset-expo` automatisch konfiguriert (Expo SDK 50+) – **keine `babel.config.js` nötig.**

### 3. Verify-Check

```bash
npm run verify:reanimated
```

Prüft: Pakete vorhanden · Versions-Paar · reanimatED's eigene Build-Validierung
(`validate-worklets-build.js`, die auch während des EAS-Builds läuft) · codegenConfig original.

Ausgabe muss lauten: `✅ Alles ok`.

### 4. Dev-Build erstellen (nativ → kein OTA!)

```bash
npx expo prebuild --clean
eas build --profile development --platform ios
```

## EAS iOS Dev-Build (Standard-Workflow)

```bash
npm run verify:reanimated            # Pre-Flight-Check (muss grün sein)
eas build --profile development --platform ios
```

EAS macht in der Cloud ein frisches `npm install` (lockfile wird via `.easignore` ignoriert,
siehe `PITFALLS.md #1`) und `prebuild`. **Keine Postinstall-Hooks nötig.**

Dev-Client verbinden:
```bash
npx expo start --dev-client
```

## Was der Verify-Check prüft (`scripts/verify-reanimated-worklets.js`)

0. **`expo`-Basiselement auf SDK 56** (`~56.0.x` in package.json + installiert) – Root-Cause-Guard.
1. reanimated + worklets installiert.
2. Versions-Paar kompatibel (dynamisch geprüft gegen reanimateds `peerDependencies` — Beispiel: `4.5.x` ↔ `0.10.x`).
3. reanimatED's eigene `validate-worklets-build.js` bestanden (läuft auch im EAS-Build).
4. `codegenConfig.name === "rnworklets"` (Original – nicht verändern!).

> Tritt trotzdem `rnworklets.h file not found` auf, liegt das an einem **veralteten Paar**,
> nicht an fehlendem Patch → `PITFALLS.md #18` (Upgrade auf `reanimated ^4.5.0` ↔ `worklets ^0.10.0`, ✅ 2026-06-28 verifiziert).

---

*Zuletzt aktualisiert: 2026-06-28*
