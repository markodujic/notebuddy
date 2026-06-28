# notebuddy – Pitfalls & Lessons Learned

> Wichtige Fallstricke und Learnings beim Aufbau der notebuddy-App mit Expo SDK 56, react-native-audio-api und React Native. Stand: 2026-06-28.

---

## 1. ⚠️ EAS Build: `npm ci` schlägt mit Windows Lock-File fehl

**Pitfall:** Die `package-lock.json`, die auf Windows (npm 10/11) generiert wird, enthält plattformspezifische Dependency-Versionen (z.B. `@emnapi/core`), die nicht mit der macOS CI-Umgebung von EAS kompatibel sind. `npm ci` verlangt exakte Übereinstimmung und schlägt fehl.

**Fehlermeldung:**
```
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: @emnapi/core@1.11.1 from lock file
```

**Lösung:** `.easignore` mit `package-lock.json` erstellen. Dadurch nutzt EAS `npm install` statt `npm ci`, was plattformspezifische Dependencies zur Laufzeit auflöst.

```bash
echo "package-lock.json" > .easignore
```

**Schlüssel-Learning:** Lock-Files sind **plattformabhängig**. Was auf Windows funktioniert, kann auf macOS CI scheitern, besonders bei optionalen Dependencies wie `@emnapi/*`.

---

## 2. ⚠️ Audio-Session-Konfiguration zwingend erforderlich

**Pitfall:** `recorder.start()` von `react-native-audio-api` schlägt nicht fehl, liefert aber **stillschweigend keine Audio-Buffer**, wenn die Audio-Session nicht konfiguriert ist.

**Symptom:** Alle Logs zeigen Erfolg:
```
[AudioEngine] Permission granted: true
[AudioEngine] Stream started, isStreaming: true
```
Aber `[AudioEngine] Buffer received` erscheint **nie**.

**Lösung:** Vor `recorder.start()` muss `AudioManager.setAudioSessionOptions` aufgerufen werden:
```ts
AudioManager.setAudioSessionOptions({
  iosCategory: 'playAndRecord',  // ⭐ Kritisch!
  iosMode: 'measurement',
  iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
  iosNotifyOthersOnDeactivation: true,
});
recorder.start();
```

**Schlüssel-Learning:** Ohne `iosCategory: 'playAndRecord'` wird das Mikrofon nicht aktiviert, selbst wenn der Recorder läuft.

---

## 3. ⚠️ Mikrofon-Berechtigungen erfordern Dev-App Neubau

**Pitfall:** Das Hinzufügen von `NSMicrophoneUsageDescription` zur `app.json` aktualisiert nicht automatisch die installierte Dev-App. Die Info.plist wird zur Build-Zeit generiert.

**Symptom:** Kein Mikrofon-Berechtigungsdialog, `requestRecordingPermissionsAsync()` gibt fälschlicherweise `granted: true` zurück (Dev-Client-Verhalten), aber keine Audio-Daten.

**Lösung:** Dev-App neu bauen:
```bash
npx expo prebuild --clean
npx expo run:ios   # oder run:android
# oder EAS Build
eas build --profile development --platform ios
```

**Schlüssel-Learning:** Native Berechtigungen (Info.plist, AndroidManifest.xml) sind **Build-Zeit-Konfiguration**. Code-Änderungen (JS-Bundle) reichen nicht aus.

---

## 4. ⚠️ Stability-Tracking: JEDEN Ton tracken

**Pitfall:** Die intuitive Annahme ist, die Stabilität nur für die **korrekte** Note zu tracken. Die alte App trackt jedoch die Stabilität von **jedem** gehaltenen Ton und prüft erst danach die Korrektheit.

**Warum?** Der User könnte eine falsche Note halten und das Feedback soll sofort kommen (nach Stability), nicht erst wenn er die richtige Note findet.

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
  // jetzt erst correctness prüfen
}
```

---

## 5. ⚠️ NativeTabs: Verschachtelte Routen nicht automatisch erkannt

**Pitfall:** Expo Router mit `NativeTabs` erwartet jede Route als Tab-Trigger. Verschachtelte Routen wie `/mode/note-to-piano` werden nicht automatisch gefunden.

**Symptom:** Auf eine Mode-Card tippen → nichts passiert.

**Lösung:** Route als Top-Level (`src/app/note-to-piano.tsx`) und als Tab-Trigger registrieren:
```tsx
<NativeTabs.Trigger name="note-to-piano">
  <NativeTabs.Trigger.Label>Üben</NativeTabs.Trigger.Label>
  ...
</NativeTabs.Trigger>
```

---

## 6. ⚠️ `AudioRecorder.onAudioReady` Callback

**Pitfall:** Die `onAudioReady` Methode von `react-native-audio-api` liefert nur dann Audio-Buffer, wenn die Audio-Session korreriert konfiguriert ist. Wenn keine Buffer ankommen, liegt das Problem **nicht** am Callback, sondern an der fehlenden Audio-Session-Konfiguration oder an fehlenden Berechtigungen.

**Schlüssel-Learning:** Erst Audio-Session (`AudioManager.setAudioSessionOptions`) und Berechtigungen prüfen, bevor man den Callback-Mechanismus verdächtigt.

---

## 7. ⚠️ Skia API Unterschiede

**Pitfall:** Skia React Native hat eine leicht andere API als Web-SVG.

| Web SVG | Skia RN |
|---|---|
| `strokeLinecap` | `strokeCap` |
| `<Path d="...">` | `<Path path="...">` |
| CSS `transform` | `transform` prop |

**Lösung:** Skia Props aus TypeScript-Fehlern ableiten oder `node_modules/@shopify/react-native-skia` Type Definitions prüfen.

---

## 8. ⚠️ Reanimated SharedValue nicht als React-Child

**Pitfall:** `useSharedValue()` gibt ein `SharedValue<T>` zurück, das **nicht** als React-Child (`{value}`) gerendert werden kann.

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

## 9. ⚠️ Volume-Normalisierung

**Pitfall:** RMS-Werte müssen normalisiert werden, aber die Skalierung ist nicht intuitiv.

**Alt (Svelte):** `smoothedRms / 0.15`
**Falsch (RN):** `rms * 10`

Der Faktor `0.15` ist empirisch bestimmt und ergibt Werte von 0–1 für normale Sprachlautstärke. `* 10` übersteuert bei leisen Signalen.

---

## 10. ⚠️ Silence Gate vor jedem Pitch

**Pitfall:** Nach einer erfolgreichen Antwort "hängt" der letzte Ton im Buffer und kann die nächste Aufgabe sofort (fälschlicherweise) beantworten.

**Lösung:** ~50ms Stille erforderlich, bevor ein neuer Pitch akzeptiert wird (`SILENCE_GATE_FRAMES = 3` Frames). Der Gate wird bei jeder neuen Frage zurückgesetzt.

---

## 11. ⚠️ `eas.json` node-Feld Format

**Pitfall:** Das `node` Feld in `eas.json` Build-Profilen akzeptiert keine nackten Versionsnummern wie `20`.

**Fehlermeldung:**
```
"build.development.node" failed custom validation because 20 is not a valid version
```

**Lösung:** Entweder das Feld weglassen (EAS nutzt Default) oder einen semver-String wie `"20.0.0"` verwenden. Am einfachsten: weglassen.

---

## 12. ⚠️ Font require() Pfad

**Pitfall:** Der `@/` Path-Alias funktioniert nicht zuverlässig für `require()` von Asset-Dateien in Metro.

**Falsch:**
```ts
require('@/assets/fonts/Bravura.otf')
```

**Richtig:**
```ts
require('../../assets/fonts/Bravura.otf')
```

---

## 13. ⛔ SUPERSEDED – react-native-worklets stale Header Import (`rnworklets.h`) → siehe #18

> **⚠️ Veraltet.** Der hier beschriebene Postinstall-Patch (`scripts/patch-worklets.js`) war ein Irrweg und **existiert im Projekt nicht**. Echte Ursache und Lösung: **#18** (veraltetes reanimated/worklets-Paar). Dieser Eintrag bleibt nur als Lerngeschichte.

**Pitfall:** `react-native-worklets@0.8.x` hat einen Bug in `WorkletsModule.h` (Zeile 5): Ein veralteter Import `#import <rnworklets/rnworklets.h>` verweist auf eine Header-Datei, die nicht existiert (Relikt aus Reanimated v3). Der iOS-Build bricht mit folgendem Fehler ab:

```
'rnworklets/rnworklets.h' file not found
```

**Wichtig:** Dies ist **keine** Versions-Inkompatibilität! `reanimated@4.3.1` und `worklets@0.8.3` sind laut `npx expo install --check` die korrekten, kompatiblen Versionen. Der Import ist einfach funktional unnötig, da `WorkletsModuleProxy.h` (Zeile 7) alle nötigen Typen liefert.

**Lösung:** Postinstall-Patch (`scripts/patch-worklets.js`) entfernt die fehlerhafte Import-Zeile automatisch nach `npm install`. Der Patch ist idempotent und läuft auch bei EAS-Builds (da diese `npm install` ausführen).

```bash
# package.json
"scripts": {
  "postinstall": "node ./scripts/patch-worklets.js"
}
```

**⚠️ Warnung:** Keinesfalls `react-native-worklets` auf `0.9.x` oder höher upgraden, während `reanimated` auf `4.3.1` bleibt. `worklets@0.9.x` verursacht schwerwiegende TurboModule/Codegen-Build-Fehler (`NativeWorkletsModuleSpec` nicht gefunden, etc.). Die Versionen müssen als Paar gemeinsam aktualisiert werden.

**⚠️ WICHTIG (korrigiert 2026-06-27):** Der Patch darf **nur** den stale Import entfernen – sonst nichts! Insbesondere `codegenConfig.name` MUSS `"rnworklets"` (Original) bleiben. Der Codegen-Spec-Name `NativeWorkletsModuleSpec` wird aus der Spec-Datei `NativeWorkletsModule.ts` abgeleitet, **nicht** aus `codegenConfig.name`. Eine frühere Patch-Version änderte `codegenConfig.name` → `"WorkletsModule"` – das bricht die Codegen↔Pod-Verknüpfung und führt zu `cannot find protocol declaration for 'NativeWorkletsModuleSpec'`. Ebenso dürfen die Source-Referenzen auf `NativeWorkletsModuleSpec` nicht umbenannt werden. Die aktuelle `scripts/patch-worklets.js` macht nur das eine nötige: stale Import weg.

**Pre-Flight-Check:** Vor jedem Dev-Build `node ./scripts/verify-reanimated-worklets.js` ausführen (prüft Versionen + stale-Import-Patch + dass `codegenConfig.name` original ist). Siehe `REANIMATED-WORKLETS-SETUP.md`.

**Schlüssel-Learning:** Postinstall-Patches sind ein gängiges und zuverlässiges Muster in der React-Native-Welt, um Bugs in nativen Dependencies zu umgehen, ohne auf offizielle Fixes zu warten.

---

## 14. ⚠️ `pngjs` unvollständig installiert → `expo config` / `prebuild` crash

**Pitfall:** `expo config --json` (und damit `expo prebuild`) bricht ab:
```
PluginError: Cannot find module '.../node_modules/pngjs/lib/png.js'.
Error: Cannot find module '.../node_modules/pngjs/lib/png.js'. Please verify that the package.json has a valid "main" entry
```

**Ursache:** `pngjs@3.4.0` (transitiv über `expo-splash-screen → @expo/image-utils → parse-png`) wird nur teilweise entpackt: der Ordner existiert, aber das `lib/`-Verzeichnis fehlt. Die `package.json` referenziert `"main": "./lib/png.js"`, die Datei gibt es aber nicht. Passiert bei abgebrochenen `npm install`-Läufen (große native Tarballs brauchen lang).

**Lösung:** Vollständiger Reset und saubere Neuinstallation (siehe `REANIMATED-WORKLETS-SETUP.md` Schritt 1–2). Ein einzelnes `npm install pngjs` reicht **nicht**, weil dann der npm-`Invalid Version`-Bug (siehe #15) zuschlagen kann.

**Schlüssel-Learning:** „Ordner existiert" ≠ „Paket vollständig". Bei `Cannot find module .../lib/...`-Fehlern immer den ganzen `node_modules`-Zustand misstrauen, wenn die Installation vorher abgebrochen wurde.

---

## 15. ⚠️ npm `Invalid Version:` Bug → `npm install` bricht komplett ab

**Pitfall:** `npm install` bricht mit einem kryptischen TypeError ab:
```
npm error Invalid Version:
TypeError: Invalid Version:  at new SemVer ... at Node.canDedupe ... at PlaceDep.pruneDedupable
```

**Ursache:** Bekannter **npm v11-Bug** in der semver-Deduplizierung. Tritt auf, wenn der Zustand zwischen `node_modules` und `package-lock.json` inkonsistent ist (typischerweise nach abgebrochenen/teilweisen Installationen). Ein verschachteltes Paket hat eine leere/falsche `version` und npms `canDedupe` crasht beim Vergleich.

**Wichtig:** Ein simples `npm install` repariert das **nicht** – der Fehler kehrt bei jedem Aufruf zurück, weil npm den kaputten Lockfile-State immer wieder einliest.

**Lösung:** Vollständiger Reset **inklusive `package-lock.json`**:
```bash
rmdir /s /q node_modules
del package-lock.json      # ⚠️ zwingend – nur das löst den Dedupe-Bug
npm cache clean --force
npm install
```
Ein neuer, konsistenter Lockfile wird danach automatisch erzeugt. (Für EAS irrelevant: `package-lock.json` wird via `.easignore` ignoriert, siehe #1.)

**Schlüssel-Learning:** Bei `Invalid Version:` (leerer String nach dem Doppelpunkt) nicht an den Paketversionen herumdoktern – die Ursache ist ein korrupter Lockfile-Zustand, nicht eine falsche Versionsspezifikation.

---

## 16. ⚠️ SUPERSEDED – worklets/reanimated setup (Ursache war nicht „kaputte Installation“) → siehe #18

> **⚠️ Veraltet.** Die These „der `rnworklets.h`-Fehler kam nur von einer kaputten Installation (#14/#15)“ stimmt **nicht**. Beweis: nach jedem sauberen Reset trat der Fehler reproduzierbar wieder auf, weil die Ursache ein **veraltetes Versions-Paar** war. Echte Ursache + Lösung: **#18**. Der Grundsatz „offiziell, keine Patches“ bleibt aber richtig.

**Update 2026-06-27 (korrigiert):** Der in #13 beschriebene Worklets-Patch (`scripts/patch-worklets.js`) war **überflüssig**. Weder die offizielle Reanimated-Doku (docs.swmansion.com), die Worklets-Doku, noch die Expo-Doku erwähnen einen `rnworklets.h`-Bug. Auf GitHub gibt es **kein Issue** zu "rnworklets.h file not found". Der Fehler trat damals nur wegen der **kaputten Installation** (#14 pngjs / #15 Invalid-Version) auf, nicht weil der offizielle Release einen Bug hätte.

**Offizieller Weg (ausschließlich):**
```bash
npx expo install react-native-reanimated react-native-worklets   # korrekte Versionen automatisch
npx expo prebuild                                                 # native Code neu generieren
```
- **Kein Patch**, keine `postinstall`-Hooks, keine `codegenConfig`-Manipulation.
- `babel-preset-expo` konfiguriert das reanimated/worklets-Babel-Plugin **automatisch** (Expo SDK 50+).
- Versions-Paar automatisch passend: reanimated 4.3.x ↔ worklets 0.8.x ↔ RN 0.85 (Expo SDK 56).

**Verify-Check (ohne Patch-Bezug):**
```bash
npm run verify:reanimated   # prüft Versionen + reanimatED's eigene Build-Validierung
```

**⚠️ Lektion:** #13–#15 (der Patch-Ansatz) war ein Irrweg. Bei kaputter Installation immer erst **vollständigen Reset** (#15) + offizielles `expo install`, statt Quelldateien von Abhängigkeiten zu patchen. Siehe `REANIMATED-WORKLETS-SETUP.md`.

> **Korrektur 2026-06-28:** „Kaputte Installation" war nicht die Wurzel – siehe **#17**. Die echte Ursache des `rnworklets.h file not found` war ein falsches `expo`-Basiselement (`^46.0.21` statt `~56.0.x`). Der Reset „half" nur zufällig, falls zwischendurch mal `expo install` lief. Erst #17 behebt das dauerhaft.

---

## 17. ⚠️ SUPERSEDED – „expo-Basiselement falsch“ → siehe #18

> **⚠️ Veraltet / widerlegt.** Die These „`expo: ^46.0.21` ist die Ursache“ trifft auf diesen Zustand **nicht** zu: die `package.json` stand korrekt auf `"expo": "~56.0.0"` (installiert `expo@56.0.12`) — und der Build brach **trotzdem**. Der `expo`-Check im Verify-Skript bleibt als Guard nützlich, war hier aber nicht die Ursache. Echte Ursache + Lösung: **#18**.

**Pitfall:** Der iOS-Dev-Build (EAS / `expo run:ios`) bricht reproduzierbar ab:
```
node_modules/react-native-worklets/apple/worklets/apple/WorkletsModule.h:5:9
> #import <rnworklets/rnworklets.h>
          ^ 'rnworklets/rnworklets.h' file not found
```

**Ursache:** In der `package.json` stand `"expo": "^46.0.21"` statt `"expo": "~56.0.x"` (Tippfehler `46` ↔ `56`). `expo@46` = **Expo SDK 46 (2022, React Native 0.69)** – eine Zeit **vor** der New Architecture / Codegen. Beim `npx expo prebuild` läuft dann die **expo@46-CLI**, die ein iOS-Projekt nach **RN-0.69-Schema** erzeugt – **ohne** New-Architecture-Codegen. React Natives Codegen generiert daher den Header `rnworklets.h` (entsteht aus `codegenConfig.name: "rnworklets"` in `react-native-worklets/package.json`) **nie** → beim Kompilieren von `WorkletsModule.h` → *file not found*.

**Warum der Verify-Check das nicht fand:** `scripts/verify-reanimated-worklets.js` prüfte nur reanimated/worklets, nicht das `expo`-Basiselement. **Warum der Reset nie half:** jeder Reset installierte `expo@46` neu – das Problem war in der `package.json` gepinnt, nicht im `node_modules`-Zustand.

**Diagnose (eindeutig):**
```bash
node -p "require('expo/package.json').version"      # muss 56.x sein; 46.x = Bug
```
Hinweis: alle `expo-*`-Module waren korrekt auf `~56.0.x`, nur das Basiselement `expo` war falsch.

**Lösung:**
1. `package.json`: `"expo": "~56.0.0"` setzen (Tilde + SDK-Minor).
2. Vollständiger Reset (siehe `REANIMATED-WORKLETS-SETUP.md` Schritt 1) – nötig, weil `node_modules` die falsche `expo@46` enthält.
3. `npm install` – installiert `expo@56.x`.
4. `npm run verify:reanimated` – prüft jetzt **auch** das `expo`-Basiselement (Schritt [0/5]).

**⚠️ Lektion:** Ein reproduzierbarer Build-Fehler ist **nie** „nur kaputte Installation" – es gibt immer eine Ursache. Bei Codegen-Fehlern (`*.h file not found` für Codegen-Header) immer die **`expo`- und `react-native`-Hauptversion** in `package.json` gegen das SDK prüfen, nicht nur die betroffene Bibliothek.

## 18. ⭐ ECHTE (finale) Ursache: `rnworklets.h file not found` = veraltetes reanimated/worklets-Paar

**Pitfall:** Der iOS-Dev-Build (EAS / `expo run:ios`) bricht reproduzierbar ab:

```
node_modules/react-native-worklets/apple/worklets/apple/WorkletsModule.h:5:9
> #import <rnworklets/rnworklets.h>
          ^ 'rnworklets/rnworklets.h' file not found
```

**Warum #13 / #16 / #17 die Ursache verfehlten:** Weder ein fehlender Patch (#13) noch eine „kaputte Installation" (#16) noch ein falsches `expo`-Basiselement (#17). Beweis: die `package.json` stand korrekt auf `"expo": "~56.0.0"` (installiert `expo@56.0.12`) — und der Build brach **trotzdem** ab. Die #17-Diagnose (`expo@46`) war für diesen Zustand falsch.

**Echte Ursache:** `rnworklets/rnworklets.h` ist ein **vom RN-Codegen generierter Spec-Header** (entsteht aus `codegenConfig.name: "rnworklets"`). Das installierte Paar `react-native-reanimated@4.3.1` + `react-native-worklets@0.8.3` (Stand Sep 2025) war 9 Monate alt; deren Codegen-/Podspec-Pipeline erzeugte den Header bei `expo prebuild` nicht zuverlässig. In den aktuellen Releases ist das gefixt.

**Diagnose:** Versionslage gegen die neuesten kompatiblen Releases prüfen:

```bash
node -p "require('react-native-reanimated/package.json').version"   # war 4.3.1 → latest 4.5.0
node -p "require('react-native-worklets/package.json').version"    # war 0.8.3 → latest 0.10.0
```

Beide Releases fordern explizit `react-native: 0.83 – 0.86`, passen also zu Expo SDK 56 (RN 0.85.3). `reanimated@4.5.0` fordert per `peerDependencies` `react-native-worklets: 0.10.x`.

**Lösung (offiziell, keine Patches, kein Codegen-Eingriff):**

1. `package.json`: `react-native-reanimated` → `^4.5.0`, `react-native-worklets` → `^0.10.0`.
2. `.npmrc` (neu, Projekt-Root) mit `legacy-peer-deps=true` anlegen — sonst bricht `npm install` / `expo install` an einem `react@19.2.3` ↔ `react-dom@19.2.7` peer-Konflikt (ERESOLVE), und der EAS-Cloud-Build scheitert schon vor dem eigentlichen Build.
3. `npm install`.
4. `npm run verify:reanimated` → `✅ Alles ok` (prüft das Paar jetzt **dynamisch** aus reanimateds `peerDependencies`, siehe `scripts/verify-reanimated-worklets.js`).
5. Dev-Build: `eas build --profile development --platform ios` (nativ → kein OTA).

**⚠️ Lektion:** Bei Codegen-Fehlern (`*.h file not found` für einen Codegen-Header wie `rnworklets.h`) als erstes die **Version der Codegen-Libs** gegen die neuesten kompatiblen Releases prüfen — nicht die `expo`-Hauptversion, nicht Quelldateien patchen. Ein veraltetes Paar ist die wahrscheinlichste Ursache; ein Upgrade auf das aktuelle Release behebt Codegen-Pipeline-Regressionen ohne Eingriff in Dependencies.

---

*Zuletzt aktualisiert: 2026-06-28*
