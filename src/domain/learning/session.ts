/**
 * Session-Orchestrierung (framework-neutral).
 *
 * Verwaltet eine Übungs-Session mit N Aufgaben:
 *   1. Konstruktor → Weighting initialisieren
 *   2. start() → nextExercise() wählt Note via weightedRandom
 *   3. submitAnswer() → Bewertet, aktualisiert Weighting
 *   4. isComplete(), wenn alle Aufgaben erledigt
 */

import { Note } from '../music/note';
import type { Range } from '../music/range';
import { getAllMidiFiltered } from '../music/range';
import { LEARNING_CONFIG } from './config';
import {
    evaluateFrequency,
    evaluateNote,
    type EvaluationResult,
} from './evaluator';
import { Weighting, weightedRandom } from './weighting';

/** Die fünf Übungsmodi. */
export type ExerciseMode =
  | 'note-to-piano'
  | 'piano-to-note'
  | 'visualize'
  | 'range-finder'
  | 'tutorial';

/** Konfiguration einer Session. */
export interface SessionConfig {
  range: Range;
  exerciseCount: number;
  toleranceCents: number;
  onlyNaturalNotes: boolean;
  /** Optional: explizite Noten-Liste (überschreibt range). */
  validMidiNotes?: number[];
}

/** Eine einzelne Aufgabe. */
export interface Exercise {
  /** Zielnote dieser Aufgabe. */
  targetNote: Note;
  /** Wurde die Aufgabe bereits beantwortet? */
  completed: boolean;
  /** Bewertungsergebnis (nach completed). */
  result?: EvaluationResult;
}

/** Zustand der Session für die UI. */
export interface SessionState {
  mode: ExerciseMode;
  exercises: Exercise[];
  currentIndex: number;
  isComplete: boolean;
  correctCount: number;
  incorrectCount: number;
}

/**
 * Orchestriert eine Übungs-Session.
 */
export class Session {
  readonly config: SessionConfig;
  readonly mode: ExerciseMode;
  readonly weighting: Weighting;

  private exercises: Exercise[] = [];
  private currentIndex = 0;
  private correctCount = 0;
  private incorrectCount = 0;
  private allMidi: number[];

  constructor(mode: ExerciseMode, config: SessionConfig) {
    this.mode = mode;
    this.config = config;
    this.allMidi = config.validMidiNotes
      ? [...config.validMidiNotes]
      : getAllMidiFiltered(config.range, config.onlyNaturalNotes);
    this.weighting = new Weighting();
    this.weighting.initialize(this.allMidi);
  }

  /**
   * Startet die Session und erzeugt die erste Aufgabe.
   */
  start(): Exercise {
    return this.nextExercise();
  }

  /**
   * Erzeugt die nächste Aufgabe (weighted random).
   */
  nextExercise(): Exercise {
    const targetMidi = weightedRandom(this.allMidi, this.weighting);
    const exercise: Exercise = {
      targetNote: Note.fromMidi(targetMidi),
      completed: false,
    };
    this.exercises.push(exercise);
    return exercise;
  }

  /**
   * Reicht eine Audio-Antwort (Frequenz) ein und bewertet sie.
   */
  submitFrequencyAnswer(frequency: number): EvaluationResult {
    const exercise = this.current();
    const result = evaluateFrequency(frequency, exercise.targetNote, this.config.toleranceCents);
    this.completeExercise(exercise, result);
    return result;
  }

  /**
   * Reicht eine Noten-Antwort (MIDI) ein und bewertet sie.
   */
  submitNoteAnswer(inputMidi: number): EvaluationResult {
    const exercise = this.current();
    const result = evaluateNote(inputMidi, exercise.targetNote);
    this.completeExercise(exercise, result);
    return result;
  }

  private completeExercise(exercise: Exercise, result: EvaluationResult): void {
    exercise.completed = true;
    exercise.result = result;
    this.weighting.update(exercise.targetNote.midi, result.correct);
    if (result.correct) {
      this.correctCount += 1;
    } else {
      this.incorrectCount += 1;
    }
    this.currentIndex += 1;
  }

  /**
   * Gibt die aktuelle Aufgabe zurück.
   */
  current(): Exercise {
    return this.exercises[this.exercises.length - 1];
  }

  /**
   * Gibt true zurück, wenn alle Aufgaben erledigt sind.
   */
  isComplete(): boolean {
    return this.currentIndex >= this.config.exerciseCount;
  }

  /**
   * Gibt den aktuellen State für die UI zurück.
   */
  getState(): SessionState {
    return {
      mode: this.mode,
      exercises: [...this.exercises],
      currentIndex: this.currentIndex,
      isComplete: this.isComplete(),
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
    };
  }
}

/**
 * Erzeugt eine Default-Session-Konfiguration.
 */
export function createDefaultSessionConfig(range: Range): SessionConfig {
  return {
    range,
    exerciseCount: LEARNING_CONFIG.DEFAULT_EXERCISE_COUNT,
    toleranceCents: LEARNING_CONFIG.DEFAULT_TOLERANCE_CENTS,
    onlyNaturalNotes: true,
  };
}