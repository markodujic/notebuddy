# notebuddy – Umsetzungsplan

> Vollständiger, freigegebener Plan zum Aufbau der notebuddy-App auf Basis der `APP_ANALYSE.md` (alte Svelte-Referenz) und der bestehenden Expo/Skia-Basis.

---

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| **Pilot-Modus** | Note → Klavier (Audio-Eingabe) |
| **Domain-Layer** | Framework-neutrale Logik 1:1 von Svelte nach TS portieren |
| **Notensystem-Rendering** | Skia selbst gezeichnet (Default laut AGENTS.md) |
| **Pitch-Detection** | Autocorrelation (MacLeod/YIN) auf `react-native-audio-api` |
| **State Management** | Zustand |
| **Notation** | 4 Systeme (German default, English, Solfège, Nordic) via Registry |
| **Animationen** | Reanimated 4 |
| **Umsetzungstakt** | Fundament (Phase 0 + 0.5 + 1) am Stück, dann iterativ |
| **Bravura-Font** | Wird besorgt und eingebunden |
| **Display-Modi** | Erst `badge` + `staff`, `grand` später |

---

## Architektur-Vorgaben

- **Audio und Grafik strikt entkoppeln** – Audio läuft unabhängig vom UI-Render-Takt
- **Skia als Default-Renderer** für Piano-/Keyboard-/Notensystem-Grafik
- **Reanimated** für Animationen, Transitions und Press-Feedback
- **React Native Views** nur als Interaktions-Overlays oder Layout-Hüllen
- **Services** liefern nur Zustände/Events, keine UI-Logik
- **Domain-Layer** ist reines TypeScript ohne Framework-Abhängigkeit

---

## Phasen

### Phase 0 – Domain-Layer (reines TS) ✅

- [x] `src/domain/music/note.ts` – Note-Modell, MIDI↔Frequenz, Fabrikmethoden
- [x] `src/domain/music/frequency.ts` – Cents, `analyzeFrequency`, `matchesNote`, `getPitchDirection`
- [x] `src/domain/music/range.ts` – Range-Modell, Filter Stammtöne
- [x] `src/domain/music/staff-position.ts` – 29 Positionen pro Schlüssel, MIDI↔Position-Mapping
- [x] `src/domain/music/notation/` – Registry + Interface
- [x] `src/domain/music/notation/systems/german.ts` – C D E F G A H
- [x] `src/domain/music/notation/systems/english.ts` – C D E F G A B
- [x] `src/domain/music/notation/systems/solfege.ts` – Do Re Mi Fa Sol La Si
- [x] `src/domain/music/notation/systems/nordic.ts` – C D E F G A H (Variante)
- [x] `src/domain/learning/config.ts` – `LEARNING_CONFIG` Konstanten
- [x] `src/domain/learning/weighting.ts` – Adaptive Fehlergewichtung
- [x] `src/domain/learning/evaluator.ts` – `evaluateFrequency`, `evaluateNote`
- [x] `src/domain/learning/session.ts` – Session-Orchestrierung
- [x] Barrel-Exports (`index.ts`)

### Phase 0.5 – Responsive & Touch-Fundament ✅

- [x] `hooks/use-breakpoint.ts` – `compact`/`medium`/`expanded` + Orientierung
- [x] `hooks/use-orientation-lock.ts` – Landscape-Lock für bestimmte Modi
- [x] `constants/layout.ts` – Touch-Targets, Key-Breiten, Typography-Scales
- [x] `expo-screen-orientation` installieren
- [ ] Safe-Area-Wrapper konsolidieren (folgt in Phase 2)

### Phase 1 – Services & State ✅

- [x] `npm i zustand`
- [x] `stores/app-store.ts` – Globaler State (mode, clef, ranges, settings, notation, darkMode)
- [x] `stores/session-store.ts` – Session-Zustand (currentExercise, index, progress)
- [x] `services/audio-engine.ts` – `react-native-audio-api` AudioRecorder + Autocorrelation Pitch-Detector, RMS-Gate, Clarity
- [x] `services/pitch-detector.ts` – MacLeod Autocorrelation-Algorithmus (NSDF)
- [x] `services/stability-tracker.ts` – Stabilitäts-Logik (rein)
- [x] `services/pitch-utils.ts` – Brücke Service→Domain (`frequency.ts`)

### Phase 2 – Shared UI ✅

- [x] Bravura-Font einbinden (`assets/fonts/bravura/Bravura.otf`)
- [x] `constants/music-font.ts` – SMuFL-Codepoints + Staff-Metriken
- [x] `hooks/use-fonts.ts` – Font-Loader-Hook
- [x] `components/staff/staff-geometry.ts` – Y-Position-Berechnung
- [x] `components/staff/staff-view.tsx` – Skia-Notensystem (Linien, Schlüssel, Notenkopf, Hilfslinien, interaktiv)
- [x] `PianoKeyboard` erweitern (target/highlight/feedback/labels/greenKeys)
- [x] `components/feedback/pitch-ring.tsx` – Skia Ring (Stabilität, Volume, Glow, Result)
- [x] `components/feedback/result-banner.tsx` – ✓/✗ Feedback-Overlay (Reanimated)
- [x] `components/controls/swipe-accidental.tsx` – Pan-Geste für ♯/♭

### Phase 3 – Pilot-Modus "Note → Klavier" ✅

- [x] `app/mode/note-to-piano.tsx` – Screen orchestriert Badge/Staff + PitchRing + Keyboard + Session/Audio
- [x] Display-Modi `badge` + `staff` (umschaltbar)
- [x] Audio-Engine-Integration, Stability, Evaluator, Weighting
- [x] Feedback-Timings (richtig 1200ms, falsch 2500ms)
- [x] Nächste-Aufgabe-Flow / Session-Ende
- [x] Home-Screen Mode-Cards mit Router verknüpft
- [x] Font-Loader im Root-Layout

### Phase 4+ – Restliche Modi

- [ ] Klavier → Note (Text-Eingabe, Swipe-Vorzeichen, Landscape-Lock)
- [ ] Notensystem visualisieren (interaktiv + Speech)
- [ ] Tonumfang-Finder (adaptiver Test + Timer)
- [ ] Erklärmodus (4-Phasen-Tutorial)

### Phase 5 – Polish

- [ ] Dual-Theme (Light/Dark)
- [ ] SQLite-Persistenz für Weighting/Statistik
- [ ] Settings-UI (Clef, Ranges, Exercise Count, Notation, Tolerance)
- [ ] Safe-Area, Querformat-Erzwingung, PWA-Meta

---

## Shared-Komponenten

### PianoKeyboard (bestehend, wird erweitert)

Neue Props (rückwärtskompatibel):

| Prop | Nutzung |
|---|---|
| `targetNote?: Note` | Zielnote gold/pulsierend |
| `highlightNote?: Note` | Hervorgehobene Note |
| `feedback?: 'correct'\|'incorrect'\|'too-high'\|'too-low'` | Bewertungs-Feedback |
| `highlightRange?: Range` | Grüner Glow (Range-Finder) |
| `keyLabels?: Record<number, string>` | Notennamen via Notation-System |
| `greenKeys?: number[]` | Multi-Tasten-Highlight (Tutorial) |
| `visibleRange?: Range` | Sichtbarer Ausschnitt |

### StaffView (neu, Skia)

```ts
type StaffViewProps = {
  clef: 'treble' | 'bass' | 'grand';
  displayNote?: { midi: number; color?: string };
  wrongNote?: { midi: number };
  showFeedback?: boolean;
  interactive?: boolean;
  onPositionSelect?: (position: StaffPosition) => void;
  notation: NotationSystem;
};
```

---

## Touch & Responsive

### Breakpoints

| Breakpoint | Width | Charakteristik |
|---|---|---|
| `compact` | < 420 | Handy Portrait |
| `medium` | 420–700 | Handy Landscape / kleines Tablet |
| `expanded` | ≥ 700 | iPad / Desktop |

### Touch-Prinzipien

- Mindest-Touch-Target 44×44 pt / 48 dp überall
- `react-native-gesture-handler` für alle Gesten
- `Pressable` für Tap, `Pan` für Swipe/Drag
- Skia Canvas mit nativem Touch für StaffView

### Orientierung

- "Klavier → Note" + Tutorial → Landscape erzwingen
- Alle anderen Modi → beide Orientierungen

---

## Notation-Registry

```text
src/domain/music/notation/
├── types.ts          # NotationSystem-Interface
├── registry.ts       # Registry + getNotation(id)
├── systems/
│   ├── german.ts     # C D E F G A H (Default)
│   ├── english.ts    # C D E F G A B
│   ├── solfege.ts    # Do Re Mi Fa Sol La Si
│   └── nordic.ts     # C D E F G A H (Variante)
└── index.ts
```

Interface:
```ts
interface NotationSystem {
  id: 'german' | 'english' | 'solfege' | 'nordic';
  label: string;
  noteNames: string[12];
  naturalNames: string[7];
  midiToName(midi, opts?): string;
  midiToDisplay(midi, opts?): string;
  nameToIndex(name): number;
  helmholtzFor(midi): string;
}
```

---

*Erstellt: 2026-06-26 · Version: 1.0.0*