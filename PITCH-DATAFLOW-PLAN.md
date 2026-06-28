# notebuddy – Pitch-Dataflow Architektur (Audio ↔ UI)

> Professioneller Dataflow für Pitch-Detection: Audio und UI strikt entkoppelt über
> Reanimated SharedValues. Status quo eliminiert ~60 Re-Renders/Sekunde.
> Stand: 2026-06-28.

---

## Problem (Status quo)

```
AudioRecorder (native)
  → onAudioReady [JS-Thread]
  → processSamples: RMS + MacLeod [JS-Thread, ~20-60×/s]
  → handleAudioFrame [JS-Thread]
  → setVolume / setStabilityProgress / setDetectedNote [React-State]
  → 🔥 RE-RENDER des GESAMTEN Screens pro Frame
```

`note-to-piano.tsx` ruft pro Audio-Frame bis zu 3× `setState` auf → der ganze Screen
re-rendert 20–60×/Sekunde. `PitchRing` ist zwar `memo`-gewrappt, bekommt aber jeden
Frame neue Props → nutzlos. Klassischer React-Native-Audio-Anti-Pattern.

---

## Ziel-Architektur (3 Schichten, strikt entkoppelt)

```
┌─────────────────────────────────────────────────────────────┐
│  AUDIO LAYER                                                │
│  AudioRecorder → RMS → MacLeod → schreibt SharedValues      │
│  Kennt keine UI, kennt kein React.                          │
└─────────────────────────────────────────────────────────────┘
                          │ (SharedValues = gemeinsamer Speicher)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  BRIDGE / OBSERVABILITY (Reanimated)                        │
│  useDerivedValue rechnet abgeleitete Werte auf UI-Thread    │
│  runOnJS only für seltene Diskret-Ereignisse (note stable)  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER (Skia + Reanimated, UI-Thread)                    │
│  PitchRing liest SharedValues direkt → 0 Re-Renders, 60fps  │
│  PianoKeyboard-Feedback, StaffView-Notenkopf etc.           │
└─────────────────────────────────────────────────────────────┘
```

### Prinzipien

- **Audio kennt keine UI, UI kennt keine Audio-Logik** — nur SharedValues verbinden.
- **Kontinuierliche Werte** (volume, clarity, frequency, stability) → SharedValues.
- **Diskrete Events** (note stable → submit, error) → `runOnJS` (selten, kein Perf-Problem).
- **Skia liest direkt** via `useDerivedValue` → keine React-Props für Live-Werte.

---

## Stufe A — SharedValues (kein Dev-Build, OTA-fähig)

### Dateien

1. `src/services/pitch-shared-values.ts` (**neu**) — zentrale SharedValues:
   - `volume`, `clarity`, `frequency`, `detectedMidi`, `centsOff`, `stabilityProgress`
2. `src/services/audio-engine.ts` (refactor) — schreibt pro Frame in SharedValues
   statt `onFrame`-Callback; `runOnJS` nur für Errors.
3. `src/components/feedback/pitch-ring.tsx` (refactor) — Skia-Consumer liest
   SharedValues via `useDerivedValue`, `useAnimatedReaction` für Text-Updates.
4. `src/app/note-to-piano.tsx` (refactor) — `setVolume`/`setStabilityProgress`/
   `setDetectedNote` entfernt; `useAnimatedReaction` triggert Submit bei Stability.

### Erwartetes Ergebnis

| Metrik | Status quo | Stufe A |
|---|---|---|
| Re-renders Screen | ~60/s | ~0 (nur Diskret-Events) |
| JS-Thread-Last | Detection + Renders | Detection nur |
| UI-Framerate | jankig | 60fps |

---

## Stufe C — Native AudioWorklet (Dev-Build ⚠️ nötig)

### Voraussetzung

`react-native-audio-api` bietet **eigene native AudioWorklets** (Web-Audio-API-Pfad):

```ts
type AudioWorkletRuntime = 'AudioRuntime' | 'UIRuntime';

context.createWorkletNode(
  callback: (audioData: Array<Float32Array>, channelCount: number) => void,
  bufferLength, inputChannelCount,
  workletRuntime?: AudioWorkletRuntime  // 'AudioRuntime' = nativer Audio-Thread!
)
```

Der Callback läuft auf einem **dedizierten nativen Audio-Thread**, nicht JS, nicht UI.

### Schritte

1. **Spike:** `WorkletNode`-Implementation in `node_modules` lesen,
   `'AudioRuntime'`-Verhalten verifizieren, SharedValue-Beschreibung klären.
2. **AudioContext-Graph** aufbauen: Mic → `createWorkletNode('AudioRuntime')`.
3. **MacLeod-Algorithmus** als Worklet-Callback portieren (rein funktional, Float32Array,
   keine Klassen/`this`).
4. **Native Thread → SharedValues** via `runOnUI`.
5. **Dev-Build** (nativ!): `npm run verify:reanimated` → `eas build`.
6. **Performance-Messung:** JS-Thread-Last vor/nach C vergleichen.

### Warum C über B (Reanimated-Worklet)

- `runOnWorklet` serialisiert `Float32Array` (2048 Samples × 20–60/s) → teuer.
- Klassen-`this` (MacLeodPitchDetector) ist im Reanimated-Worklet nicht abbildbar.
- Pre-allocated Buffers (GC-Druck-Optimierung) gehen im Reanimated-Modell verloren.
- Native AudioWorklet verarbeitet Samples **im Entstehungs-Thread** → keine Brücke.

---

## Verwerfen: Stufe B (Reanimated-Worklet)

Nicht empfohlen — Serialisierungs-Overhead + Klassen-Refactoring ohne den vollen
Gewinn von C. Dokumentiert als bewusst nicht gewählter Pfad.

---

*Erstellt: 2026-06-28 · Status: Stufe A ✅ implementiert & validiert (TS clean, Lint clean, Verify ✅). Stufe C folgt.*
