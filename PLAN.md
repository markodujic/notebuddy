# notebuddy – Umsetzungsplan

> Vollständiger, freigegebener Plan zum Aufbau der notebuddy-App auf Basis der `APP_ANALYSE.md` (alte Svelte-Referenz) und der bestehenden Expo/Skia-Basis.

---

## Entscheidungen

| Thema                     | Entscheidung                                                      |
| ------------------------- | ----------------------------------------------------------------- |
| **Pilot-Modus**           | Note → Klavier (Audio-Eingabe)                                    |
| **Domain-Layer**          | Framework-neutrale Logik 1:1 von Svelte nach TS portieren         |
| **Notensystem-Rendering** | Skia selbst gezeichnet (Default laut AGENTS.md)                   |
| **Pitch-Detection**       | Autocorrelation (MacLeod/YIN) auf `react-native-audio-api`        |
| **State Management**      | Zustand                                                           |
| **Notation**              | 4 Systeme (German default, English, Solfège, Nordic) via Registry |
| **Animationen**           | Reanimated 4                                                      |
| **Umsetzungstakt**        | Fundament (Phase 0 + 0.5 + 1) am Stück, dann iterativ             |
| **Bravura-Font**          | Wird besorgt und eingebunden                                      |
| **Display-Modi**          | `badge` + `staff` + `grand` (alle implementiert)                  |

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

| Prop                                                       | Nutzung                           |
| ---------------------------------------------------------- | --------------------------------- |
| `targetNote?: Note`                                        | Zielnote gold/pulsierend          |
| `highlightNote?: Note`                                     | Hervorgehobene Note               |
| `feedback?: 'correct'\|'incorrect'\|'too-high'\|'too-low'` | Bewertungs-Feedback               |
| `highlightRange?: Range`                                   | Grüner Glow (Range-Finder)        |
| `keyLabels?: Record<number, string>`                       | Notennamen via Notation-System    |
| `greenKeys?: number[]`                                     | Multi-Tasten-Highlight (Tutorial) |
| `visibleRange?: Range`                                     | Sichtbarer Ausschnitt             |

### StaffView (neu, Skia)

```ts
type StaffViewProps = {
  clef: "treble" | "bass" | "grand";
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

| Breakpoint | Width   | Charakteristik                   |
| ---------- | ------- | -------------------------------- |
| `compact`  | < 420   | Handy Portrait                   |
| `medium`   | 420–700 | Handy Landscape / kleines Tablet |
| `expanded` | ≥ 700   | iPad / Desktop                   |

### Touch-Prinzipien

---

# UI-Polish-Roadmap – professionelle 60fps-UI (2026-08-31) ✅

> 6-Phasen-Roadmap zur Polierung der notebuddy-UI. Status: **alle Phasen umgesetzt**
> (Commits `91f484f` … `8561a9e`). Details: `docs/ui-polish-roadmap.md`.

## Vorarbeit: RangeSelector Boundary-Handle-Jitter-Fix (`91f484f`)

- **Root Cause:** JS-State-Spiegel lief dem nativen Skia-Camera-Transform einen
  Frame hinterher → Handles zappelten beim Zoomen.
- **Fix:** zoom-wrapper View entfernt; `BoundaryHandle` sitzt direkt im Viewport.
  Positionierung komplett im `useAnimatedStyle`-Worklet:
  `translateX = panSV + left·zoomSV − HANDLE_WIDTH/2`.
- **Lektion:** SharedValues im selben Worklet-Frame sind pixel-synchron mit der
  nativen Kamera – JS-State ist es nicht.

## Phase 1 – StaffView: professionelle Notation ✅

- **1.1 Bravura-SMuFL-Notenköpfe (`c1f12f0`):** Echte Bravura-Glyphen
  (`NOTE_HEAD_FILLED` \uE0A4) als `Text` statt rotierter Ovale; Glow/Hover als
  stroke-Glyphen; Hals exakt an Glyph-Kante via `font.measureText`.
  SMuFL: 1 em = 4 Staff-Spaces → `NOTE_GLYPH_FONT_SIZE: 96` = Kopf exakt
  1 Space hoch, Proportionen automatisch typografisch korrekt.
- **1.2 Pergament als offscreen Picture (`cf84519`):** `useParchmentPicture()`
  zeichnet Hintergrund + Noise + Fasern **einmalig** via `PictureRecorder` →
  **1 Draw-Call statt ~800**; `Math.random()` nur noch beim Aufbau → kein
  Faser-Zappeln mehr.
- **1.3 Stichnormen (`d227e92`):** Hilfslinien 2.25px (schwerer als
  Systemlinien), Hals 2.9px = 0.12 spaces.
- **1.4 Feedback (`f2deafc`):** Wrong-Note **shakt** nativ (±2.5px, 3 Zyklen,
  `shakeX` + `useDerivedValue`-Group-Transform); Glow-Ring **pulsiert** beim
  Erscheinen (`glowPulse`, Atem-Zyklus 700ms).
- **1.5 Kartenrahmen (`0a52f6f`):** borderRadius 12, 1px-Kante,
  `overflow: hidden`, iOS-Shadow / Android-Elevation.

## Phase 2 – PianoKeyboard: Kamera & Styling ✅

- **2.1 Kamera** war bereits nativ (SharedValues + 3D-`rotateX` auf
  `Animated.View`, kein JS pro Frame) – bewusst nicht umgebaut.
- **2.2 Premium-Styling (`be51372`):** Idle-Tasten mit vertikalen
  `LinearGradient`-Fills + Gloss-Deckel auf schwarzen Tasten; Zustandsfarben
  bleiben solide.
- **2.3 Feedback** lief bereits worklet-basiert.

## Phase 3 – 60fps sichern ✅

- **3.1 Range-Finder-Timer (`417acf4`):** `timeRemaining` → SharedValue;
  Timer-Balken (Breite + Farbe) und Badge-Farbe nativ via `interpolateColor`.
  `setRfState` nur noch bei diskreten Änderungen (Signatur-Vergleich über
  `lastStateSigRef`) statt 10×/s.
- **3.2 Modes-Audit:** keine weiteren Polling-Loops; Feedbacks diskret/nativ.
- **3.3 (`c2414bf`):** `PianoKeyboard` memoisiert.

## Phase 4 – Design-Tokens & Base-UI ✅

- **4.1 (`15d69c9`):** `src/constants/graphics.ts` – `KEY_GRADIENTS` als
  Single Source of Truth für piano-keyboard **und** range-selector.
- **4.2 (`9f57b5e`):** `src/components/ui/base-button.tsx` – themed Button mit
  nativem Press-Scale; eingesetzt in Range-Finder-Start + End-Screen.
- **4.3 (`f1fc493`):** Dark-Theme-Vignette ins Pergament-Picture gebakt.

## Phase 5 – Wow-Effekt ✅

- **Key-Dip (`8561a9e`):** Taste senkt sich beim Druck ~7px ab (UI-Thread,
  im selben Worklet wie Press-Highlight).

## Phase 6 – Verifikation ✅

- `npx tsc --noEmit` + `npm run verify:reanimated` nach jedem Schritt grün.
- Ein Schritt = eine Komponente = ein Commit. Alles JS-only → OTA reicht,
  kein Dev-Build nötig.


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
  id: "german" | "english" | "solfege" | "nordic";
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

_Erstellt: 2026-06-26 · Version: 1.0.0_
