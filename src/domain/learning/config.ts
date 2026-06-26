/**
 * Lern-Konfiguration (framework-neutral).
 *
 * Zentrale Konstanten für die Lern-Engine.
 */

export const LEARNING_CONFIG = {
  /** Maximale Fehlergewichtung (wird bei Fehlern erhöht). */
  MAX_ERROR_WEIGHT: 5,
  /** Initiale Gewichtung für alle Noten. */
  INITIAL_WEIGHT: 1,
  /** Minimale Gewichtung (wird nie unterschritten). */
  MIN_WEIGHT: 1,
  /** Gewichts-Reduktion bei Erfolg. */
  WEIGHT_DECREMENT_ON_SUCCESS: 0.5,
  /** Gewichts-Erhöhung bei Fehler. */
  WEIGHT_INCREMENT_ON_ERROR: 1,

  /** Standard-Toleranz in Cents für Pitch-Matching. */
  DEFAULT_TOLERANCE_CENTS: 25,
  /** Standard-Dauer, die eine Note gehalten werden muss (ms). */
  DEFAULT_STABILITY_MS: 180,
  /** Minimale Stability-Dauer (ms). */
  MIN_STABILITY_MS: 150,
  /** Maximale Stability-Dauer (ms). */
  MAX_STABILITY_MS: 300,
  /** Mindestabstand zwischen zwei Antworten (ms). */
  MIN_INTERVAL_MS: 500,

  /** Standard-Anzahl Aufgaben pro Session. */
  DEFAULT_EXERCISE_COUNT: 10,

  /** Feedback-Timing: Richtig (Audio-Modus). */
  FEEDBACK_CORRECT_MS: 1200,
  /** Feedback-Timing: Falsch (Audio-Modus). */
  FEEDBACK_INCORRECT_MS: 2500,
  /** Feedback-Timing: Allgemein (andere Modi). */
  FEEDBACK_DEFAULT_MS: 2000,
} as const;

/** Toleranz für die Pitch-Erkennung im Tutorial (Halbtöne). */
export const TUTORIAL_PITCH_TOLERANCE_SEMITONES = 2;

/** Anzahl konsekutiver Frames für Stability im Tutorial. */
export const TUTORIAL_STABILITY_FRAMES = 3;

/** Warm-up-Zeit nach Mikrofon-Start (ms). */
export const TUTORIAL_WARMUP_MS = 500;

/** Silence-Gate: Anzahl Stille-Frames vor neuem Ton. */
export const SILENCE_GATE_FRAMES = 5;

/** RMS-Schwellenwert für Rauschunterdrückung. */
export const RMS_GATE_THRESHOLD = 0.003;

/** Clarity-Schwellenwert für Pitch-Qualität. */
export const CLARITY_THRESHOLD = 0.75;

/** EMA-Smoothing-Faktor für Volume-Anzeige. */
export const VOLUME_EMA_FACTOR = 0.35;