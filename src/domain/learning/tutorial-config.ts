/**
 * Tutorial-Konfiguration (framework-neutral).
 *
 * 1:1 aus notenlern-app (TutorialView.svelte) portiert.
 * Definiert die 2er- und 3er-Gruppen der schwarzen Tasten,
 * Animations-Parameter und Pitch-Detection-Toleranzen.
 */

/** Intervall zwischen Animations-Schritten (Phase 1) in ms. */
export const ANIMATION_INTERVAL_MS = 2000;

/** Pitch-Toleranz: ±2 Halbtöne vom Ziel. */
export const NOTE_TOLERANCE = 2;

/** Mindest-Clarity für Pitch-Akzeptanz. */
export const MIN_CLARITY = 0.9;

/** Mindest-RMS für Pitch-Akzeptanz. */
export const MIN_RMS = 0.01;

/** Anzahl stabiler Frames, bevor eine Note akzeptiert wird. */
export const REQUIRED_STABLE_FRAMES = 3;

/** Warmup nach Mic-Start in ms. */
export const MIC_WARMUP_MS = 500;

/**
 * 2er-Gruppen (C♯/D♯ pro Oktave), von unten nach oben.
 * MIDI-Nummern der schwarzen Tasten.
 */
export const ZWEIER_GRUPPEN: number[][] = [
  [25, 27], // Oktave 1
  [37, 39], // Oktave 2
  [49, 51], // Oktave 3
  [61, 63], // Oktave 4
  [73, 75], // Oktave 5
  [85, 87], // Oktave 6
  [97, 99], // Oktave 7
];

/**
 * 3er-Gruppen (F♯/G♯/A♯ pro Oktave), von unten nach oben.
 * MIDI-Nummern der schwarzen Tasten.
 */
export const DREIER_GRUPPEN: number[][] = [
  [30, 32, 34], // Oktave 1
  [42, 44, 46], // Oktave 2
  [54, 56, 58], // Oktave 3
  [66, 68, 70], // Oktave 4
  [78, 80, 82], // Oktave 5
  [90, 92, 94], // Oktave 6
  [102, 104, 106], // Oktave 7
];

/** Animation: erst alle 2er, dann alle 3er. */
export const ANIMATION_GROUPS = [...ZWEIER_GRUPPEN, ...DREIER_GRUPPEN];

/** Alle Tasten eines 88-key Klaviers. */
export const FULL_KEYBOARD_MIN_MIDI = 21; // A0
export const FULL_KEYBOARD_MAX_MIDI = 108; // C8
export const FULL_KEYBOARD_KEY_COUNT = 88;
