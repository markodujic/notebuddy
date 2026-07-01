# notebuddy – Stufe C: Native AudioWorklet (Pitch-Detection auf Audio-Thread)

> Fortsetzung von `PITCH-DATAFLOW-PLAN.md`. Stufe A ist implementiert (SharedValues,
> JS-Thread-Pitch-Detection). Stufe C verlagert die komplette Pitch-Pipeline auf den
> **nativen Audio-Thread** via `react-native-audio-api` Worklet-API.
>
> Stand: 2026-07-01 · Branch: `feat/pitch-worklet-stage-c`

---

## Warum Stufe C?

Stufe A eliminiert UI-Re-Renders, aber die Pitch-Detection (MacLeod NSDF über 2048
Samples) läuft weiterhin auf dem **JS-Thread** (20–60×/Sekunde). Das blockiert
JS-Work, Animations-Callbacks, Touch-Handler etc.

Stufe C verlagert die komplette Sample-Verarbeitung auf den **nativen Audio-Thread**:
der JS-Thread wird komplett entlastet, die Detection läuft im Entstehungs-Thread der
Samples — keine Brücke, keine Serialisierung.

---

## Verifizierte API (react-native-audio-api@0.12.2)

### Worklet-Klassen

```ts
// BaseAudioContext-Factory-Methoden:
createWorkletNode(
  callback: (audioData: Array<Float32Array>, channelCount: number) => void,
  bufferLength: number,
  inputChannelCount: number,
  workletRuntime?: 'AudioRuntime' | 'UIRuntime'  // default: 'UIRuntime'
): WorkletNode
```

- `WorkletNode` — Input-Consumer (liest Audio, kein Graph-Output). **Unsere Wahl.**
- `WorkletProcessingNode` — Input + Output (klassischer Audio-Processor).
- `WorkletSourceNode` — Source (erzeugt Audio, nicht relevant).

### Runtime

```ts
type AudioWorkletRuntime = "AudioRuntime" | "UIRuntime";
```

- `'AudioRuntime'` → Callback läuft auf **dediziertem nativen Audio-Thread**.
- `'UIRuntime'` → Callback läuft auf Reanimated-UI-Thread (wie Stufe B).

### Mic-Input-Graph

```ts
const recorder = new AudioRecorder();
const context = new AudioContext();
const recorderAdapter = context.createRecorderAdapter();
const workletNode = context.createWorkletNode(
  callback,
  DEFAULT_BUFFER_SIZE, // 2048
  1, // mono input
  "AudioRuntime", // ← nativer Audio-Thread!
);

// Graph aufbauen:
recorder.connect(recorderAdapter); // Mic → Adapter
recorderAdapter.connect(workletNode); // Adapter → Worklet

recorder.start(); // Stream starten
```

### Worklet-Callback-Constraints

Der Callback wird über `makeShareableCloneRecursive` gewrappt (siehe
`WorkletNode.js`) und erhält automatisch die `'worklet'`-Direktive.

**Worklet-safe-Regeln:**

- ❌ Kein `this`, keine Klassen-Instanzen
- ❌ Keine externen Closures außer SharedValues + `runOnUI`/`runOnJS`
- ❌ Kein `console.log`, kein `setTimeout`, kein React-Zugriff
- ✅ Reine Funktionen, lokale Variablen, `Float32Array`-Arithmetik
- ✅ Pre-allocated Buffers via Closure-HOF

---

## Architektur (Stufe C)

```
┌──────────────────────────────────────────────────────────────┐
│  NATIVE AUDIO THREAD (AudioRuntime)                          │
│                                                              │
│  AudioRecorder (Mic)                                         │
│    → RecorderAdapterNode                                     │
│    → WorkletNode['AudioRuntime']                             │
│       Callback (worklet-safe, rein funktional):              │
│         1. RMS berechnen                                     │
│         2. MacLeod NSDF + Peaks + ParabolicInterpolation     │
│         3. runOnUI(setFrame)(frame)  → SharedValues          │
│         4. runOnJS(onFrame)(frame)   → Diskret-Logik         │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  UI LAYER (unverändert aus Stufe A)                          │
│  PitchRing / Screen lesen SharedValues → 0 Re-Renders        │
└──────────────────────────────────────────────────────────────┘
```

**Vorteil gegenüber Stufe A:** JS-Thread komplett entlastet. Detection, RMS und
NSDF laufen nativ — kein GC-Druck, keine JS-Bridge, keine Worklet-Serialisierung.

---

## Implementierung (kleine Schritte)

### Schritt 1 — `src/services/macleod-worklet.ts` (neu)

Rein funktionale MacLeod-Portierung als **Factory-Funktion**:

```ts
export function createMacLeodWorklet(bufferSize: number, sampleRate: number) {
  "worklet";
  // Pre-allocated buffers via Closure (kein GC-Druck)
  const nsdf = new Float32Array(bufferSize);
  const maxPositions: number[] = [];
  const threshold = 0.1;

  return (samples: Float32Array): { frequency: number; clarity: number } => {
    "worklet";
    // ... NSDF, Peaks, ParabolicInterpolation (rein funktional)
  };
}
```

### Schritt 2 — `src/services/audio-worklet-engine.ts` (neu)

AudioContext-Graph-Setup + Worklet-Callback-Orchestrierung:

- Erstellt `AudioContext`, `RecorderAdapterNode`, `WorkletNode`
- Verdrahtet `runOnUI(setFrame)` und `runOnJS(onFrame)`
- Lifecycle: `start()`, `stop()`, `cleanup()`

### Schritt 3 — `src/services/audio-engine.ts` (refactor)

Feature-Flag `USE_WORKLET_ENGINE`:

- `true` → nutzt `audio-worklet-engine.ts` (Stufe C)
- `false` → nutzt bestehende JS-Pipeline (Stufe A, Fallback)

SharedValues- und `onFrame`-Schnittstelle bleibt identisch → Screen unverändert.

### Schritt 4 — Verify

```bash
npm run verify:reanimated
npx tsc --noEmit
npm run lint
```

---

## Risiken & Pitfalls

| Risiko                                       | Mitigation                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `runOnUI` aus Audio-Thread nicht unterstützt | Reanimated 4.x sollte das decken; im Zweifel `runOnJS` als Fallback, dann läuft nur die Detection nativ (immer noch besser als Stufe A) |
| `Float32Array`-Übergabe im Callback          | Library mappt native Arrays → sollte funktionieren; Spike-Test im Dev-Build                                                             |
| Worklet-Scope-Beschränkungen                 | Strict worklet-safe schreiben, `eslint-disable react-hooks/immutability` wo nötig                                                       |
| Dev-Build nötig                              | Native Worklet-API → **kein OTA**, Dev-Build Pflicht                                                                                    |

---

## Dev-Build

⚠️ Stufe C erfordert zwingend einen **neuen Dev-Build** (native Worklet-API).

```bash
npm run verify:reanimated   # ← vor jedem Build
# Dann: User startet Dev-Build manuell
```

---

_Erstellt: 2026-07-01 · Status: In Implementierung_
