/**
 * Notations-Font-Konstanten (Bravura / SMuFL).
 *
 * Bravura ist der Open-Source-Standard für Musiknotation (SMuFL).
 * Unicode-Codepoints für Schlüssel und Notensymbole.
 */

/** Font-Family-Name für Bravura in expo-font. */
export const BRAVURA_FONT_FAMILY = 'Bravura';

/** Pfad zur Font-Datei (Asset-Nummer via require). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const BRAVURA_FONT_SOURCE = require('../../assets/fonts/Bravura.otf');

/** SMuFL-Unicode-Codepoints für Bravura. */
export const SMUFL = {
  // Schlüssel
  TREBLE_CLEF: '\uE050', // G-Schlüssel
  BASS_CLEF: '\uE062', // F-Schlüssel

  // Notenköpfe
  NOTE_HEAD_FILLED: '\uE0A4', // Gefüllter Notenkopf
  NOTE_HEAD_HALF: '\uE0A3', // Halbe Noten (hohl)
  NOTE_HEAD_WHOLE: '\uE0A2', // Ganze Note

  // Notenhals
  STEM: '\uE210',

  // Sonstige
  SHARP: '\uE262', // Kreuz
  FLAT: '\uE260', // b
  NATURAL: '\uE261', // Auflösungszeichen
} as const;

/** Liniensystem-Metriken (in Skia-Punkten). */
export const STAFF_METRICS = {
  /** Abstand zwischen zwei Linien (Staff Space). */
  LINE_SPACING: 10,
  /** Dicke einer Notensystem-Linie. */
  LINE_WIDTH: 1.2,
  /** Notenkopf-Breite. */
  NOTE_HEAD_WIDTH: 13,
  /** Notenkopf-Höhe. */
  NOTE_HEAD_HEIGHT: 9,
  /** Notenkopf-Rotation (leicht schräg, wie echte Notation). */
  NOTE_HEAD_ROTATION: -0.3,
  /** Notenhals-Länge. */
  STEM_HEIGHT: 30,
  /** Notenhals-Breite. */
  STEM_WIDTH: 1.5,
  /** Hilfslinie über die Note hinaus. */
  LEDGER_LINE_EXTEND: 6,
} as const;