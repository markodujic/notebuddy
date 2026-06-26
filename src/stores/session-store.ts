/**
 * Session-Store – Übungs-Session-Zustand (Zustand).
 *
 * Wrappt die framework-neutrale Session-Klasse und exponiert
 * ihren Zustand reaktiv für React-Komponenten.
 */

import { create } from 'zustand';

import {
    type EvaluationResult,
    type Exercise,
    type ExerciseMode,
    type Range,
    type SessionConfig,
    Session,
    createDefaultSessionConfig,
} from '@/domain';

/** Session-Zustand für die UI. */
export interface SessionStoreState {
  /** Die aktive Session (oder null). */
  session: Session | null;
  /** Aktuelle Aufgabe. */
  currentExercise: Exercise | null;
  /** Aktueller Index (0-basiert). */
  currentIndex: number;
  /** Anzahl korrekt. */
  correctCount: number;
  /** Anzahl falsch. */
  incorrectCount: number;
  /** Anzahl Aufgaben gesamt. */
  exerciseCount: number;
  /** Ist die Session abgeschlossen? */
  isComplete: boolean;
  /** Letztes Bewertungsergebnis. */
  lastResult: EvaluationResult | null;

  // ── Actions ──
  /** Startet eine neue Session. */
  startSession: (mode: ExerciseMode, config?: Partial<SessionConfig>) => void;
  /** Reicht eine Audio-Antwort ein. */
  submitFrequency: (frequency: number) => EvaluationResult | null;
  /** Reicht eine Noten-Antwort ein. */
  submitNote: (midi: number) => EvaluationResult | null;
  /** Geht zur nächsten Aufgabe. */
  nextExercise: () => void;
  /** Beendet die Session. */
  endSession: () => void;
}

function buildConfig(
  base: Range,
  overrides?: Partial<SessionConfig>,
): SessionConfig {
  return { ...createDefaultSessionConfig(base), ...overrides };
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  session: null,
  currentExercise: null,
  currentIndex: 0,
  correctCount: 0,
  incorrectCount: 0,
  exerciseCount: 0,
  isComplete: false,
  lastResult: null,

  startSession: (mode, overrides) => {
    // Wir nutzen einen Default-Range; der Aufrufer kann overrides.range setzen.
    const range = overrides?.range ?? { minMidi: 48, maxMidi: 84 };
    const config = buildConfig(range, overrides);
    const session = new Session(mode, config);
    const exercise = session.start();

    set({
      session,
      currentExercise: exercise,
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      exerciseCount: config.exerciseCount,
      isComplete: false,
      lastResult: null,
    });
  },

  submitFrequency: (frequency) => {
    const { session } = get();
    if (!session) return null;

    const result = session.submitFrequencyAnswer(frequency);
    const state = session.getState();

    set({
      currentExercise: session.current(),
      currentIndex: state.currentIndex,
      correctCount: state.correctCount,
      incorrectCount: state.incorrectCount,
      isComplete: state.isComplete,
      lastResult: result,
    });

    return result;
  },

  submitNote: (midi) => {
    const { session } = get();
    if (!session) return null;

    const result = session.submitNoteAnswer(midi);
    const state = session.getState();

    set({
      currentExercise: session.current(),
      currentIndex: state.currentIndex,
      correctCount: state.correctCount,
      incorrectCount: state.incorrectCount,
      isComplete: state.isComplete,
      lastResult: result,
    });

    return result;
  },

  nextExercise: () => {
    const { session } = get();
    if (!session || session.isComplete()) {
      set({ isComplete: true });
      return;
    }

    const exercise = session.nextExercise();
    set({ currentExercise: exercise });
  },

  endSession: () => {
    set({
      session: null,
      currentExercise: null,
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      exerciseCount: 0,
      isComplete: false,
      lastResult: null,
    });
  },
}));