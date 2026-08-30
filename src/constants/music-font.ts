/**
 * Notations-Font-Konstanten (Bravura / SMuFL).
 *
 * Bravura ist der Open-Source-Standard für Musiknotation (SMuFL).
 * Unicode-Codepoints für Schlüssel und Notensymbole.
 */

/** Font-Family-Name für Bravura in expo-font. */
export const BRAVURA_FONT_FAMILY = "Bravura";

/** Pfad zur Font-Datei (Asset-Nummer via require). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const BRAVURA_FONT_SOURCE = require("../../assets/fonts/Bravura.otf");

/** SMuFL-Unicode-Codepoints für Bravura. */
export const SMUFL = {
  // Schlüssel
  TREBLE_CLEF: "\uE050", // G-Schlüssel
  BASS_CLEF: "\uE062", // F-Schlüssel

  // Notenköpfe
  NOTE_HEAD_FILLED: "\uE0A4", // Gefüllter Notenkopf
  NOTE_HEAD_HALF: "\uE0A3", // Halbe Noten (hohl)
  NOTE_HEAD_WHOLE: "\uE0A2", // Ganze Note

  // Notenhals
  STEM: "\uE210",

  // Akkolade-Klammer (Grand Staff Brace)
  BRACE: "\uE000",

  // Sonstige
  SHARP: "\uE262", // Kreuz
  FLAT: "\uE260", // b
  NATURAL: "\uE261", // Auflösungszeichen
} as const;

/** Liniensystem-Metriken (in Skia-Punkten).
 *  1:1 aus notenlern-app InteractiveStaffView.svelte übernommen.
 *  LINE_SPACING = 24 (wie original), Canvas ist quadratisch ~340×340.
 */
export const STAFF_METRICS = {
  /** Abstand zwischen zwei Linien (Staff Space). */
  LINE_SPACING: 24,
  /** Dicke einer Notensystem-Linie. */
  LINE_WIDTH: 1.5,
  /** Notenkopf-Breite (Radius X). */
  NOTE_HEAD_RADIUS_X: 13,
  /** Notenkopf-Höhe (Radius Y). */
  NOTE_HEAD_RADIUS_Y: 9,
  /** Notenkopf-Rotation (leicht schräg, wie echte Notation). */
  NOTE_HEAD_ROTATION: -0.3,
  /** Notenhals-Länge (px). */
  STEM_HEIGHT: 67,
  /** Notenhals-Breite. */
  STEM_WIDTH: 2.5,
  /** Notenhals-Offset vom Notenzentrum (Original: ±12, nicht Radius 13). */
  STEM_OFFSET_X: 12,
  /** Violinschlüssel-Font-Größe (Original: 107px Bravura). */
  CLEF_TREBLE_SIZE: 107,
  /** Bassschlüssel-Font-Größe (Original: 88px Bravura). */
  CLEF_BASS_SIZE: 88,
  /** Schlüssel-X-Position (Original: LEFT_MARGIN 15 + 40). */
  CLEF_X: 55,
  /** Hilfslinie über die Note hinaus. */
  LEDGER_LINE_EXTEND: 20,
  /** Breite der Pergament-Freilegung unter Noten-Hilfslinien (Original: 4px auf ±22). */
  LEDGER_CLEAR_WIDTH: 4,
  LEDGER_CLEAR_EXTEND: 22,
  /** Alpha für Guide-Hilfslinien (Orientierungslinien). */
  GUIDE_LEDGER_ALPHA: 0.15,
  /** Dicke einer Hilfslinie (für Noten außerhalb des Systems). */
  LEDGER_LINE_WIDTH: 1.5,
  /** Hover-Indikator Kreis-Radius. */
  HOVER_RADIUS: 16,
  /** Hover-Indikator Alpha. */
  HOVER_ALPHA: 0.3,
  /** Default Canvas-Größe (quadratisch). */
  CANVAS_SIZE: 340,
} as const;

/** Pergament-Farben (wie notenlern-app: light + dark theme). */
export const PARCHMENT_COLORS = {
  LIGHT: {
    bg: "#fdf6e3",
    fiber1: "#c4a35a",
    fiber2: "#b8976a",
    staffLine: "#000000",
    noteHead: "#000000",
    clef: "#000000",
  },
  DARK: {
    bg: "#1e1e32",
    fiber1: "#3a3a55",
    fiber2: "#333350",
    staffLine: "#e0e0e0",
    noteHead: "#e0e0e0",
    clef: "#d0d0d0",
  },
} as const;

/** Feedback-Farben für Staff-Noten. */
export const STAFF_FEEDBACK_COLORS = {
  CORRECT: "#22c55e",
  CORRECT_GLOW: "rgba(34, 197, 94, 0.8)",
  WRONG_BLINK: "#8b0000",
  WRONG: "#ef4444",
  HOVER_FILL: "rgba(102, 126, 234, 0.3)",
  HOVER_STROKE: "rgba(102, 126, 234, 0.8)",
} as const;
