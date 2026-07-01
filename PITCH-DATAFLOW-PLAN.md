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

| Metrik            | Status quo          | Stufe A                 |
| ----------------- | ------------------- | ----------------------- |
| Re-renders Screen | ~60/s               | ~0 (nur Diskret-Events) |
| JS-Thread-Last    | Detection + Renders | Detection nur           |
| UI-Framerate      | jankig              | 60fps                   |

---

## Stufe C — Native AudioWorklet (`AudioRuntime`) — ❌ verworfen

### Verifizierte API

`react-native-audio-api@0.12.2` bietet native AudioWorklets:

```ts
type AudioWorkletRuntime = 'AudioRuntime' | 'UIRuntime';

context.createWorkletNode(
  callback: (audioData: Array<Float32Array>, channelCount: number) => void,
  bufferLength, inputChannelCount,
  workletRuntime?: AudioWorkletRuntime
)
```

### Warum verworfen

`AudioRuntime` läuft auf einem **fremden nativen Thread** ohne Reanimated-Kontext.
Dort funktionieren:

- ❌ SharedValue `.value =` (braucht Reanimated-Runtime)
- ❌ `runOnJS(...)` (braucht Reanimated-Runtime)

→ Keine Kommunikation aus dem Callback möglich → Pitch-Erkennung unsichtbar.

---

## Stufe B — Worklet auf Reanimated-UI-Thread ✅ implementiert

### Statt C verwenden wir `'UIRuntime'`

Der Callback läuft auf dem **Reanimated-UI-Thread**. Dort sind SharedValue-Schreiben
und `runOnJS` nativ verfügbar. Die Pitch-Detection (MacLeod) blockiert nicht mehr den
JS-Thread — sie läuft auf dem UI-Thread.

### Audio-Graph

```
AudioRecorder (Mic)
  → connect(RecorderAdapterNode)
  → connect(WorkletNode['UIRuntime'])
     Callback auf Reanimated-UI-Thread:
       1. RMS berechnen (rein funktional, inline)
       2. MacLeod NSDF + Peaks + Interpolation (Factory, pre-alloc)
       3. SharedValues direkt (.value =) → 0 Re-Renders
       4. runOnJS(onFrame) für Diskret-Logik (Stability)
```

### Dateien

1. `src/services/macleod-worklet.ts` — Rein funktionale Factory (worklet-safe,
   pre-allocated Buffers via Closure, kein `this`).
2. `src/services/audio-worklet-engine.ts` — AudioContext-Graph mit `UIRuntime`.
3. `src/services/audio-engine.ts` — Dispatcher mit `USE_WORKLET_ENGINE` Flag:
   - `true` → Stufe B (`useAudioWorkletEngine`, UI-Thread)
   - `false` → Stufe A (`useAudioEngineJs`, JS-Thread, Fallback)

### Ergebnis

| Metrik                     | Stufe A             | Stufe B       |
| -------------------------- | ------------------- | ------------- |
| JS-Thread-Last             | Detection + Renders | Renders nur   |
| Pitch-Detection-Thread     | JS                  | Reanimated-UI |
| Re-Renders Screen          | ~0                  | ~0            |
| SharedValue-Kompatibilität | ✅                  | ✅            |

---

_Erstellt: 2026-06-28 · Status: Stufe A ✅ implementiert. Stufe B ✅ implementiert (UIRuntime). Stufe C ❌ verworfen (AudioRuntime ohne Reanimated-Kontext)._
