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

  // ── UI ──
  darkMode: boolean;
  settingsOpen: boolean;

  // ── Actions ──
  setMode: (mode: ExerciseMode) => void;
  setClef: (clef: Clef) => void;
  setTrebleRange: (range: Range) => void;
  setBassRange: (range: Range) => void;
  setExerciseCount: (count: number) => void;
  setToleranceCents: (cents: number) => void;
  setStabilityMs: (ms: number) => void;
  setOnlyNaturalNotes: (value: boolean) => void;
  setNotationSystemId: (id: NotationSystemId) => void;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  setSettingsOpen: (open: boolean) => void;

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
  darkMode: false,
  settingsOpen: false,

  // ── Actions ──
  setMode: (mode) => set({ mode }),
  setClef: (clef) => set({ clef }),
  setTrebleRange: (trebleRange) => set({ trebleRange }),
  setBassRange: (bassRange) => set({ bassRange }),
  setExerciseCount: (exerciseCount) => set({ exerciseCount }),
  setToleranceCents: (toleranceCents) => set({ toleranceCents }),
  setStabilityMs: (stabilityMs) => set({ stabilityMs }),
  setOnlyNaturalNotes: (onlyNaturalNotes) => set({ onlyNaturalNotes }),
  setNotationSystemId: (notationSystemId) => set({ notationSystemId }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  setDarkMode: (darkMode) => set({ darkMode }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  getEffectiveRange: () => {
    const { clef, trebleRange, bassRange } = get();
    return clef === 'treble' ? trebleRange : bassRange;
  },
}));