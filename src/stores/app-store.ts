/**
 * App-Store – Globaler App-Zustand (Zustand).
 *
 * Verwaltet modusübergreifende Einstellungen:
 *   - Aktueller Übungsmodus
 *   - Notenschlüssel
 *   - Tonumfänge (Treble/Bass)
 *   - Notationssystem
 *   - Toleranz, Stability, Only-Natural-Notes
 *   - Dark Mode
 */

import { create } from 'zustand';

import { loadDarkMode, saveDarkMode } from '@/services/settings-storage';

import {
    type Clef,
    type ExerciseMode,
    type NotationSystemId,
    type Range,
    BASS_DEFAULT_RANGE,
    DEFAULT_NOTATION_ID,
    LEARNING_CONFIG,
    TREBLE_DEFAULT_RANGE,
} from '@/domain';

/** App-Zustand. */
export interface AppState {
  // ── Modus & Schlüssel ──
  mode: ExerciseMode;
  clef: Clef;

  // ── Tonumfänge ──
  trebleRange: Range;
  bassRange: Range;

  // ── Einstellungen ──
  exerciseCount: number;
  toleranceCents: number;
  stabilityMs: number;
  onlyNaturalNotes: boolean;
  notationSystemId: NotationSystemId;
  rangeFinderTimeLimit: number;

  // ── UI ──
  darkMode: boolean;
  settingsOpen: boolean;
  /** AppState-Maschine 1:1 wie APP_STATES in der alten App (reduziert auf die UI-relevanten Zustände). */
  appState: 'setup' | 'active' | 'end';
  /** Anzeige im Audio-Modus (Note → Klavier): badge / staff / grand – wie audioDisplayMode im Original (Default: grand). */
  audioDisplayMode: 'badge' | 'staff' | 'grand';
  /** Antwort-Modus im Visualize-Modus: Sprache (🎤) oder Grafik (🎼) – wie ANSWER_INPUT_MODES im Original (Default: speech). */
  answerInputMode: 'speech' | 'graphic';
  /** RangeFinder: Zeigt den Start-Screen (Header zeigt dann den Zeit-Slider, 1:1 wie rangeFinderReady). */
  rangeFinderReady: boolean;

  // ── Actions ──
  setMode: (mode: ExerciseMode) => void;
  setClef: (clef: Clef) => void;
  setTrebleRange: (range: Range) => void;
  setBassRange: (range: Range) => void;
  setExerciseCount: (count: number) => void;
  setToleranceCents: (cents: number) => void;
  setStabilityMs: (ms: number) => void;
  setOnlyNaturalNotes: (value: boolean) => void;
  setRangeFinderTimeLimit: (seconds: number) => void;
  setNotationSystemId: (id: NotationSystemId) => void;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAppState: (state: 'setup' | 'active' | 'end') => void;
  setAudioDisplayMode: (mode: 'badge' | 'staff' | 'grand') => void;
  setAnswerInputMode: (mode: 'speech' | 'graphic') => void;
  setRangeFinderReady: (ready: boolean) => void;

  /** Gibt die effektive Range für den aktuellen Schlüssel zurück. */
  getEffectiveRange: () => Range;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Initial-State ──
  mode: 'note-to-piano',
  clef: 'treble',
  trebleRange: TREBLE_DEFAULT_RANGE,
  bassRange: BASS_DEFAULT_RANGE,
  exerciseCount: LEARNING_CONFIG.DEFAULT_EXERCISE_COUNT,
  toleranceCents: LEARNING_CONFIG.DEFAULT_TOLERANCE_CENTS,
  stabilityMs: LEARNING_CONFIG.DEFAULT_STABILITY_MS,
  onlyNaturalNotes: true,
  notationSystemId: DEFAULT_NOTATION_ID,
  rangeFinderTimeLimit: 4,
  darkMode: false,
  settingsOpen: false,
  appState: 'setup',
  audioDisplayMode: 'grand',
  answerInputMode: 'speech',
  rangeFinderReady: false,

  // ── Actions ──
  setMode: (mode) => set({ mode }),
  setClef: (clef) => set({ clef }),
  setTrebleRange: (trebleRange) => set({ trebleRange }),
  setBassRange: (bassRange) => set({ bassRange }),
  setExerciseCount: (exerciseCount) => set({ exerciseCount }),
  setToleranceCents: (toleranceCents) => set({ toleranceCents }),
  setStabilityMs: (stabilityMs) => set({ stabilityMs }),
  setOnlyNaturalNotes: (onlyNaturalNotes) => set({ onlyNaturalNotes }),
  setRangeFinderTimeLimit: (rangeFinderTimeLimit) => set({ rangeFinderTimeLimit }),
  setNotationSystemId: (notationSystemId) => set({ notationSystemId }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  setDarkMode: (darkMode) => set({ darkMode }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAppState: (appState) => set({ appState }),
  setAudioDisplayMode: (audioDisplayMode) => set({ audioDisplayMode }),
  setAnswerInputMode: (answerInputMode) => set({ answerInputMode }),
  setRangeFinderReady: (rangeFinderReady) => set({ rangeFinderReady }),

  getEffectiveRange: () => {
    const { clef, trebleRange, bassRange } = get();
    return clef === 'treble' ? trebleRange : bassRange;
  },
}));

// ── Persistenz (1:1 wie localStorage der notenlern-app: nur darkMode) ──
const persistedDarkMode = loadDarkMode();
if (persistedDarkMode !== null) {
  useAppStore.setState({ darkMode: persistedDarkMode });
}

useAppStore.subscribe((state, prev) => {
  if (state.darkMode !== prev.darkMode) {
    saveDarkMode(state.darkMode);
  }
});