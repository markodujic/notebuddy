# notebuddy – Pitfalls & Lessons Learned

> Wichtige Fallstricke und Learnings beim Aufbau der notebuddy-App mit Expo SDK 56, react-native-audio-api und React Native. Stand: 2026-06-27.

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

*Zuletzt aktualisiert: 2026-06-27*
