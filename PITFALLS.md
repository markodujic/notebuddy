# notebuddy â€“ Pitfalls & Lessons Learned

> Wichtige Fallstricke und Learnings beim Aufbau der notebuddy-App mit Expo SDK 56, react-native-audio-api und React Native. Stand: 2026-06-28.

---

## 1. âš ï¸ EAS Build: `npm ci` schlÃ¤gt mit Windows Lock-File fehl

**Pitfall:** Die `package-lock.json`, die auf Windows (npm 10/11) generiert wird, enthÃ¤lt plattformspezifische Dependency-Versionen (z.B. `@emnapi/core`), die nicht mit der macOS CI-Umgebung von EAS kompatibel sind. `npm ci` verlangt exakte Ãœbereinstimmung und schlÃ¤gt fehl.

**Fehlermeldung:**
```
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: @emnapi/core@1.11.1 from lock file
```

**LÃ¶sung:** `.easignore` mit `package-lock.json` erstellen. Dadurch nutzt EAS `npm install` statt `npm ci`, was plattformspezifische Dependencies zur Laufzeit auflÃ¶st.

```bash
echo "package-lock.json" > .easignore
```

**SchlÃ¼ssel-Learning:** Lock-Files sind **plattformabhÃ¤ngig**. Was auf Windows funktioniert, kann auf macOS CI scheitern, besonders bei optionalen Dependencies wie `@emnapi/*`.

---

## 2. âš ï¸ Audio-Session-Konfiguration zwingend erforderlich

**Pitfall:** `recorder.start()` von `react-native-audio-api` schlÃ¤gt nicht fehl, liefert aber **stillschweigend keine Audio-Buffer**, wenn die Audio-Session nicht konfiguriert ist.

**Symptom:** Alle Logs zeigen Erfolg:
```
[AudioEngine] Permission granted: true
[AudioEngine] Stream started, isStreaming: true
```
Aber `[AudioEngine] Buffer received` erscheint **nie**.

**LÃ¶sung:** Vor `recorder.start()` muss `AudioManager.setAudioSessionOptions` aufgerufen werden:
```ts
AudioManager.setAudioSessionOptions({
  iosCategory: 'playAndRecord',  // â­ Kritisch!
  iosMode: 'measurement',
  iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
  iosNotifyOthersOnDeactivation: true,
});
recorder.start();
```

**SchlÃ¼ssel-Learning:** Ohne `iosCategory: 'playAndRecord'` wird das Mikrofon nicht aktiviert, selbst wenn der Recorder lÃ¤uft.

---

## 3. âš ï¸ Mikrofon-Berechtigungen erfordern Dev-App Neubau

**Pitfall:** Das HinzufÃ¼gen von `NSMicrophoneUsageDescription` zur `app.json` aktualisiert nicht automatisch die installierte Dev-App. Die Info.plist wird zur Build-Zeit generiert.

**Symptom:** Kein Mikrofon-Berechtigungsdialog, `requestRecordingPermissionsAsync()` gibt fÃ¤lschlicherweise `granted: true` zurÃ¼ck (Dev-Client-Verhalten), aber keine Audio-Daten.

**LÃ¶sung:** Dev-App neu bauen:
```bash
npx expo prebuild --clean
npx expo run:ios   # oder run:android
# oder EAS Build
eas build --profile development --platform ios
```

**SchlÃ¼ssel-Learning:** Native Berechtigungen (Info.plist, AndroidManifest.xml) sind **Build-Zeit-Konfiguration**. Code-Ã„nderungen (JS-Bundle) reichen nicht aus.

---

## 4. âš ï¸ Stability-Tracking: JEDEN Ton tracken

**Pitfall:** Die intuitive Annahme ist, die StabilitÃ¤t nur fÃ¼r die **korrekte** Note zu tracken. Die alte App trackt jedoch die StabilitÃ¤t von **jedem** gehaltenen Ton und prÃ¼ft erst danach die Korrektheit.

**Warum?** Der User kÃ¶nnte eine falsche Note halten und das Feedback soll sofort kommen (nach Stability), nicht erst wenn er die richtige Note findet.

**Falsch:**
```ts
const isMatch = matchesNote(frequency, targetMidi, tolerance);
const result = stability.update(detectedMidi, isMatch, timestamp);
```

**Richtig:**
```ts
const result = stability.update(detectedMidi, true, timestamp); // immer true!
if (result.isStable) {
  const isCorrect = matchesNote(frequency, targetMidi, tolerance);
  // jetzt erst correctness prÃ¼fen
}
```

---

## 5. âš ï¸ NativeTabs: Verschachtelte Routen nicht automatisch erkannt

**Pitfall:** Expo Router mit `NativeTabs` erwartet jede Route als Tab-Trigger. Verschachtelte Routen wie `/mode/note-to-piano` werden nicht automatisch gefunden.

**Symptom:** Auf eine Mode-Card tippen â†’ nichts passiert.

**LÃ¶sung:** Route als Top-Level (`src/app/note-to-piano.tsx`) und als Tab-Trigger registrieren:
```tsx
<NativeTabs.Trigger name="note-to-piano">
  <NativeTabs.Trigger.Label>Ãœben</NativeTabs.Trigger.Label>
  ...
</NativeTabs.Trigger>
```

---

## 6. âš ï¸ `AudioRecorder.onAudioReady` Callback

**Pitfall:** Die `onAudioReady` Methode von `react-native-audio-api` liefert nur dann Audio-Buffer, wenn die Audio-Session korreriert konfiguriert ist. Wenn keine Buffer ankommen, liegt das Problem **nicht** am Callback, sondern an der fehlenden Audio-Session-Konfiguration oder an fehlenden Berechtigungen.

**SchlÃ¼ssel-Learning:** Erst Audio-Session (`AudioManager.setAudioSessionOptions`) und Berechtigungen prÃ¼fen, bevor man den Callback-Mechanismus verdÃ¤chtigt.

---

## 7. âš ï¸ Skia API Unterschiede

**Pitfall:** Skia React Native hat eine leicht andere API als Web-SVG.

| Web SVG | Skia RN |
|---|---|
| `strokeLinecap` | `strokeCap` |
| `<Path d="...">` | `<Path path="...">` |
| CSS `transform` | `transform` prop |

**LÃ¶sung:** Skia Props aus TypeScript-Fehlern ableiten oder `node_modules/@shopify/react-native-skia` Type Definitions prÃ¼fen.

---

## 8. âš ï¸ Reanimated SharedValue nicht als React-Child

**Pitfall:** `useSharedValue()` gibt ein `SharedValue<T>` zurÃ¼ck, das **nicht** als React-Child (`{value}`) gerendert werden kann.

**Falsch:**
```tsx
const opacity = useSharedValue(0);
return <View>{opacity}</View>; // TypeError!
```

**Richtig:** SharedValue in `useAnimatedStyle` oder `useAnimatedProps` verwenden, oder mit `.value` lesen:
```tsx
const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
return <Animated.View style={style} />;
```

---

## 9. âš ï¸ Volume-Normalisierung

**Pitfall:** RMS-Werte mÃ¼ssen normalisiert werden, aber die Skalierung ist nicht intuitiv.

**Alt (Svelte):** `smoothedRms / 0.15`
**Falsch (RN):** `rms * 10`

Der Faktor `0.15` ist empirisch bestimmt und ergibt Werte von 0â€“1 fÃ¼r normale SprachlautstÃ¤rke. `* 10` Ã¼bersteuert bei leisen Signalen.

---

## 10. âš ï¸ Silence Gate vor jedem Pitch

**Pitfall:** Nach einer erfolgreichen Antwort "hÃ¤ngt" der letzte Ton im Buffer und kann die nÃ¤chste Aufgabe sofort (fÃ¤lschlicherweise) beantworten.

**LÃ¶sung:** ~50ms Stille erforderlich, bevor ein neuer Pitch akzeptiert wird (`SILENCE_GATE_FRAMES = 3` Frames). Der Gate wird bei jeder neuen Frage zurÃ¼ckgesetzt.

---

## 11. âš ï¸ `eas.json` node-Feld Format

**Pitfall:** Das `node` Feld in `eas.json` Build-Profilen akzeptiert keine nackten Versionsnummern wie `20`.

**Fehlermeldung:**
```
"build.development.node" failed custom validation because 20 is not a valid version
```

**LÃ¶sung:** Entweder das Feld weglassen (EAS nutzt Default) oder einen semver-String wie `"20.0.0"` verwenden. Am einfachsten: weglassen.

---

## 12. âš ï¸ Font require() Pfad

**Pitfall:** Der `@/` Path-Alias funktioniert nicht zuverlÃ¤ssig fÃ¼r `require()` von Asset-Dateien in Metro.

**Falsch:**
```ts
require('@/assets/fonts/Bravura.otf')
```

**Richtig:**
```ts
require('../../assets/fonts/Bravura.otf')
```

---

## 13. â›” SUPERSEDED â€“ react-native-worklets stale Header Import (`rnworklets.h`) â†’ siehe #18

> **âš ï¸ Veraltet.** Der hier beschriebene Postinstall-Patch (`scripts/patch-worklets.js`) war ein Irrweg und **existiert im Projekt nicht**. Echte Ursache und LÃ¶sung: **#18** (veraltetes reanimated/worklets-Paar). Dieser Eintrag bleibt nur als Lerngeschichte.

**Pitfall:** `react-native-worklets@0.8.x` hat einen Bug in `WorkletsModule.h` (Zeile 5): Ein veralteter Import `#import <rnworklets/rnworklets.h>` verweist auf eine Header-Datei, die nicht existiert (Relikt aus Reanimated v3). Der iOS-Build bricht mit folgendem Fehler ab:

```
'rnworklets/rnworklets.h' file not found
```

**Wichtig:** Dies ist **keine** Versions-InkompatibilitÃ¤t! `reanimated@4.3.1` und `worklets@0.8.3` sind laut `npx expo install --check` die korrekten, kompatiblen Versionen. Der Import ist einfach funktional unnÃ¶tig, da `WorkletsModuleProxy.h` (Zeile 7) alle nÃ¶tigen Typen liefert.

**LÃ¶sung:** Postinstall-Patch (`scripts/patch-worklets.js`) entfernt die fehlerhafte Import-Zeile automatisch nach `npm install`. Der Patch ist idempotent und lÃ¤uft auch bei EAS-Builds (da diese `npm install` ausfÃ¼hren).

```bash
# package.json
"scripts": {
  "postinstall": "node ./scripts/patch-worklets.js"
}
```

**âš ï¸ Warnung:** Keinesfalls `react-native-worklets` auf `0.9.x` oder hÃ¶her upgraden, wÃ¤hrend `reanimated` auf `4.3.1` bleibt. `worklets@0.9.x` verursacht schwerwiegende TurboModule/Codegen-Build-Fehler (`NativeWorkletsModuleSpec` nicht gefunden, etc.). Die Versionen mÃ¼ssen als Paar gemeinsam aktualisiert werden.

**âš ï¸ WICHTIG (korrigiert 2026-06-27):** Der Patch darf **nur** den stale Import entfernen â€“ sonst nichts! Insbesondere `codegenConfig.name` MUSS `"rnworklets"` (Original) bleiben. Der Codegen-Spec-Name `NativeWorkletsModuleSpec` wird aus der Spec-Datei `NativeWorkletsModule.ts` abgeleitet, **nicht** aus `codegenConfig.name`. Eine frÃ¼here Patch-Version Ã¤nderte `codegenConfig.name` â†’ `"WorkletsModule"` â€“ das bricht die Codegenâ†”Pod-VerknÃ¼pfung und fÃ¼hrt zu `cannot find protocol declaration for 'NativeWorkletsModuleSpec'`. Ebenso dÃ¼rfen die Source-Referenzen auf `NativeWorkletsModuleSpec` nicht umbenannt werden. Die aktuelle `scripts/patch-worklets.js` macht nur das eine nÃ¶tige: stale Import weg.

**Pre-Flight-Check:** Vor jedem Dev-Build `node ./scripts/verify-reanimated-worklets.js` ausfÃ¼hren (prÃ¼ft Versionen + stale-Import-Patch + dass `codegenConfig.name` original ist). Siehe `REANIMATED-WORKLETS-SETUP.md`.

**SchlÃ¼ssel-Learning:** Postinstall-Patches sind ein gÃ¤ngiges und zuverlÃ¤ssiges Muster in der React-Native-Welt, um Bugs in nativen Dependencies zu umgehen, ohne auf offizielle Fixes zu warten.

---

## 14. âš ï¸ `pngjs` unvollstÃ¤ndig installiert â†’ `expo config` / `prebuild` crash

**Pitfall:** `expo config --json` (und damit `expo prebuild`) bricht ab:
```
PluginError: Cannot find module '.../node_modules/pngjs/lib/png.js'.
Error: Cannot find module '.../node_modules/pngjs/lib/png.js'. Please verify that the package.json has a valid "main" entry
```

**Ursache:** `pngjs@3.4.0` (transitiv Ã¼ber `expo-splash-screen â†’ @expo/image-utils â†’ parse-png`) wird nur teilweise entpackt: der Ordner existiert, aber das `lib/`-Verzeichnis fehlt. Die `package.json` referenziert `"main": "./lib/png.js"`, die Datei gibt es aber nicht. Passiert bei abgebrochenen `npm install`-LÃ¤ufen (groÃŸe native Tarballs brauchen lang).

**LÃ¶sung:** VollstÃ¤ndiger Reset und saubere Neuinstallation (siehe `REANIMATED-WORKLETS-SETUP.md` Schritt 1â€“2). Ein einzelnes `npm install pngjs` reicht **nicht**, weil dann der npm-`Invalid Version`-Bug (siehe #15) zuschlagen kann.

**SchlÃ¼ssel-Learning:** â€žOrdner existiert" â‰  â€žPaket vollstÃ¤ndig". Bei `Cannot find module .../lib/...`-Fehlern immer den ganzen `node_modules`-Zustand misstrauen, wenn die Installation vorher abgebrochen wurde.

---

## 15. âš ï¸ npm `Invalid Version:` Bug â†’ `npm install` bricht komplett ab

**Pitfall:** `npm install` bricht mit einem kryptischen TypeError ab:
```
npm error Invalid Version:
TypeError: Invalid Version:  at new SemVer ... at Node.canDedupe ... at PlaceDep.pruneDedupable
```

**Ursache:** Bekannter **npm v11-Bug** in der semver-Deduplizierung. Tritt auf, wenn der Zustand zwischen `node_modules` und `package-lock.json` inkonsistent ist (typischerweise nach abgebrochenen/teilweisen Installationen). Ein verschachteltes Paket hat eine leere/falsche `version` und npms `canDedupe` crasht beim Vergleich.

**Wichtig:** Ein simples `npm install` repariert das **nicht** â€“ der Fehler kehrt bei jedem Aufruf zurÃ¼ck, weil npm den kaputten Lockfile-State immer wieder einliest.

**LÃ¶sung:** VollstÃ¤ndiger Reset **inklusive `package-lock.json`**:
```bash
rmdir /s /q node_modules
del package-lock.json      # âš ï¸ zwingend â€“ nur das lÃ¶st den Dedupe-Bug
npm cache clean --force
npm install
```
Ein neuer, konsistenter Lockfile wird danach automatisch erzeugt. (FÃ¼r EAS irrelevant: `package-lock.json` wird via `.easignore` ignoriert, siehe #1.)

**SchlÃ¼ssel-Learning:** Bei `Invalid Version:` (leerer String nach dem Doppelpunkt) nicht an den Paketversionen herumdoktern â€“ die Ursache ist ein korrupter Lockfile-Zustand, nicht eine falsche Versionsspezifikation.

---

## 16. âš ï¸ SUPERSEDED â€“ worklets/reanimated setup (Ursache war nicht â€žkaputte Installationâ€œ) â†’ siehe #18

> **âš ï¸ Veraltet.** Die These â€žder `rnworklets.h`-Fehler kam nur von einer kaputten Installation (#14/#15)â€œ stimmt **nicht**. Beweis: nach jedem sauberen Reset trat der Fehler reproduzierbar wieder auf, weil die Ursache ein **veraltetes Versions-Paar** war. Echte Ursache + LÃ¶sung: **#18**. Der Grundsatz â€žoffiziell, keine Patchesâ€œ bleibt aber richtig.

**Update 2026-06-27 (korrigiert):** Der in #13 beschriebene Worklets-Patch (`scripts/patch-worklets.js`) war **Ã¼berflÃ¼ssig**. Weder die offizielle Reanimated-Doku (docs.swmansion.com), die Worklets-Doku, noch die Expo-Doku erwÃ¤hnen einen `rnworklets.h`-Bug. Auf GitHub gibt es **kein Issue** zu "rnworklets.h file not found". Der Fehler trat damals nur wegen der **kaputten Installation** (#14 pngjs / #15 Invalid-Version) auf, nicht weil der offizielle Release einen Bug hÃ¤tte.

**Offizieller Weg (ausschlieÃŸlich):**
```bash
npx expo install react-native-reanimated react-native-worklets   # korrekte Versionen automatisch
npx expo prebuild                                                 # native Code neu generieren
```
- **Kein Patch**, keine `postinstall`-Hooks, keine `codegenConfig`-Manipulation.
- `babel-preset-expo` konfiguriert das reanimated/worklets-Babel-Plugin **automatisch** (Expo SDK 50+).
- Versions-Paar automatisch passend: reanimated 4.3.x â†” worklets 0.8.x â†” RN 0.85 (Expo SDK 56).

**Verify-Check (ohne Patch-Bezug):**
```bash
npm run verify:reanimated   # prÃ¼ft Versionen + reanimatED's eigene Build-Validierung
```

**âš ï¸ Lektion:** #13â€“#15 (der Patch-Ansatz) war ein Irrweg. Bei kaputter Installation immer erst **vollstÃ¤ndigen Reset** (#15) + offizielles `expo install`, statt Quelldateien von AbhÃ¤ngigkeiten zu patchen. Siehe `REANIMATED-WORKLETS-SETUP.md`.

> **Korrektur 2026-06-28:** â€žKaputte Installation" war nicht die Wurzel â€“ siehe **#17**. Die echte Ursache des `rnworklets.h file not found` war ein falsches `expo`-Basiselement (`^46.0.21` statt `~56.0.x`). Der Reset â€žhalf" nur zufÃ¤llig, falls zwischendurch mal `expo install` lief. Erst #17 behebt das dauerhaft.

---

## 17. âš ï¸ SUPERSEDED â€“ â€žexpo-Basiselement falschâ€œ â†’ siehe #18

> **âš ï¸ Veraltet / widerlegt.** Die These â€ž`expo: ^46.0.21` ist die Ursacheâ€œ trifft auf diesen Zustand **nicht** zu: die `package.json` stand korrekt auf `"expo": "~56.0.0"` (installiert `expo@56.0.12`) â€” und der Build brach **trotzdem**. Der `expo`-Check im Verify-Skript bleibt als Guard nÃ¼tzlich, war hier aber nicht die Ursache. Echte Ursache + LÃ¶sung: **#18**.

**Pitfall:** Der iOS-Dev-Build (EAS / `expo run:ios`) bricht reproduzierbar ab:
```
node_modules/react-native-worklets/apple/worklets/apple/WorkletsModule.h:5:9
> #import <rnworklets/rnworklets.h>
          ^ 'rnworklets/rnworklets.h' file not found
```

**Ursache:** In der `package.json` stand `"expo": "^46.0.21"` statt `"expo": "~56.0.x"` (Tippfehler `46` â†” `56`). `expo@46` = **Expo SDK 46 (2022, React Native 0.69)** â€“ eine Zeit **vor** der New Architecture / Codegen. Beim `npx expo prebuild` lÃ¤uft dann die **expo@46-CLI**, die ein iOS-Projekt nach **RN-0.69-Schema** erzeugt â€“ **ohne** New-Architecture-Codegen. React Natives Codegen generiert daher den Header `rnworklets.h` (entsteht aus `codegenConfig.name: "rnworklets"` in `react-native-worklets/package.json`) **nie** â†’ beim Kompilieren von `WorkletsModule.h` â†’ *file not found*.

**Warum der Verify-Check das nicht fand:** `scripts/verify-reanimated-worklets.js` prÃ¼fte nur reanimated/worklets, nicht das `expo`-Basiselement. **Warum der Reset nie half:** jeder Reset installierte `expo@46` neu â€“ das Problem war in der `package.json` gepinnt, nicht im `node_modules`-Zustand.

**Diagnose (eindeutig):**
```bash
node -p "require('expo/package.json').version"      # muss 56.x sein; 46.x = Bug
```
Hinweis: alle `expo-*`-Module waren korrekt auf `~56.0.x`, nur das Basiselement `expo` war falsch.

**LÃ¶sung:**
1. `package.json`: `"expo": "~56.0.0"` setzen (Tilde + SDK-Minor).
2. VollstÃ¤ndiger Reset (siehe `REANIMATED-WORKLETS-SETUP.md` Schritt 1) â€“ nÃ¶tig, weil `node_modules` die falsche `expo@46` enthÃ¤lt.
3. `npm install` â€“ installiert `expo@56.x`.
4. `npm run verify:reanimated` â€“ prÃ¼ft jetzt **auch** das `expo`-Basiselement (Schritt [0/5]).

**âš ï¸ Lektion:** Ein reproduzierbarer Build-Fehler ist **nie** â€žnur kaputte Installation" â€“ es gibt immer eine Ursache. Bei Codegen-Fehlern (`*.h file not found` fÃ¼r Codegen-Header) immer die **`expo`- und `react-native`-Hauptversion** in `package.json` gegen das SDK prÃ¼fen, nicht nur die betroffene Bibliothek.

## 18. â­ ECHTE (finale) Ursache: `rnworklets.h file not found` = veraltetes reanimated/worklets-Paar

**Pitfall:** Der iOS-Dev-Build (EAS / `expo run:ios`) bricht reproduzierbar ab:

```
node_modules/react-native-worklets/apple/worklets/apple/WorkletsModule.h:5:9
> #import <rnworklets/rnworklets.h>
          ^ 'rnworklets/rnworklets.h' file not found
```

**Warum #13 / #16 / #17 die Ursache verfehlten:** Weder ein fehlender Patch (#13) noch eine â€žkaputte Installation" (#16) noch ein falsches `expo`-Basiselement (#17). Beweis: die `package.json` stand korrekt auf `"expo": "~56.0.0"` (installiert `expo@56.0.12`) â€” und der Build brach **trotzdem** ab. Die #17-Diagnose (`expo@46`) war fÃ¼r diesen Zustand falsch.

**Echte Ursache:** `rnworklets/rnworklets.h` ist ein **vom RN-Codegen generierter Spec-Header** (entsteht aus `codegenConfig.name: "rnworklets"`). Das installierte Paar `react-native-reanimated@4.3.1` + `react-native-worklets@0.8.3` (Stand Sep 2025) war 9 Monate alt; deren Codegen-/Podspec-Pipeline erzeugte den Header bei `expo prebuild` nicht zuverlÃ¤ssig. In den aktuellen Releases ist das gefixt.

**Diagnose:** Versionslage gegen die neuesten kompatiblen Releases prÃ¼fen:

```bash
node -p "require('react-native-reanimated/package.json').version"   # war 4.3.1 â†’ latest 4.5.0
node -p "require('react-native-worklets/package.json').version"    # war 0.8.3 â†’ latest 0.10.0
```

Beide Releases fordern explizit `react-native: 0.83 â€“ 0.86`, passen also zu Expo SDK 56 (RN 0.85.3). `reanimated@4.5.0` fordert per `peerDependencies` `react-native-worklets: 0.10.x`.

**LÃ¶sung (offiziell, keine Patches, kein Codegen-Eingriff):**

1. `package.json`: `react-native-reanimated` â†’ `^4.5.0`, `react-native-worklets` â†’ `^0.10.0`.
2. `.npmrc` (neu, Projekt-Root) mit `legacy-peer-deps=true` anlegen â€” sonst bricht `npm install` / `expo install` an einem `react@19.2.3` â†” `react-dom@19.2.7` peer-Konflikt (ERESOLVE), und der EAS-Cloud-Build scheitert schon vor dem eigentlichen Build.
3. `npm install`.
4. `npm run verify:reanimated` â†’ `âœ… Alles ok` (prÃ¼ft das Paar jetzt **dynamisch** aus reanimateds `peerDependencies`, siehe `scripts/verify-reanimated-worklets.js`).
5. Dev-Build: `eas build --profile development --platform ios` (nativ â†’ kein OTA).

**âš ï¸ Lektion:** Bei Codegen-Fehlern (`*.h file not found` fÃ¼r einen Codegen-Header wie `rnworklets.h`) als erstes die **Version der Codegen-Libs** gegen die neuesten kompatiblen Releases prÃ¼fen â€” nicht die `expo`-Hauptversion, nicht Quelldateien patchen. Ein veraltetes Paar ist die wahrscheinlichste Ursache; ein Upgrade auf das aktuelle Release behebt Codegen-Pipeline-Regressionen ohne Eingriff in Dependencies.

---

*Zuletzt aktualisiert: 2026-08-31*

## #19 â€“ Skia-Offscreen-Picture-API: abweichende Methodennamen (2026-08-31)

**Symptom:** `tsc` schlÃ¤gt fehl beim Aufbau eines `SkPicture` Ã¼ber `Skia.PictureRecorder`.

**Ursache:** Die RN-Skia-Typen weichen von CanvasKit-Gewohnheiten ab:

- `finishRecording()` existiert nicht â†’ korrekt: **`finishRecordingAsPicture()`**.
- `canvas.drawLine(p1, p2, paint)` gibt es nicht â†’ korrekt:
  **`canvas.drawLine(x0, y0, x1, y1, paint)`** (5 Argumente).
- Radialer Shader: **`Skia.Shader.MakeRadialGradient(center, radius, colors,
  positions, mode)`** â€“ nicht `Skia.Shaders.â€¦` / `Shader.RadialGradient`.
- `LinearGradient`-`colors`-Prop verlangt mutable `Color[]` â€“ ein `as const`
  (readonly) Token-Objekt schlÃ¤gt fehl â†’ Tokens als
  `Record<string, string[]>` typisieren.

**LÃ¶sung:** Immer die `.d.ts` unter
`node_modules/@shopify/react-native-skia/lib/typescript/src/skia/types/`
 konsultieren. VollstÃ¤ndiges Beispiel: `useParchmentPicture()` in
`src/components/staff/staff-view.tsx`, Doku in `docs/ui-polish-roadmap.md`.
