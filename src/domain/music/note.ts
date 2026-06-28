/**
 * Note-Modell (framework-neutral).
 *
 * Eine Note wird immer aus einer MIDI-Nummer (0–127) konstruiert.
 * Alle anderen Werte (Frequenz, Name, Oktave, etc.) werden abgeleitet.
 */

import { midiToFrequency } from './frequency';

/** MIDI-Index 0–11 (chromatisch, C=0, C#=1, ..., H/B=11). */
export const NOTE_INDEX = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  H: 11,
} as const;

/** MIDI-Indizes der schwarzen Tasten (Vorzeichen). */
export const BLACK_KEY_INDICES = new Set([1, 3, 6, 8, 10]);

/** MIDI-Indizes der Stammtöne (weiße Tasten). */
export const NATURAL_NOTE_INDICES = new Set([0, 2, 4, 5, 7, 9, 11]);

/**
 * Prüft, ob ein chromatischer Index (0–11) ein Stammtone (weiße Taste) ist.
 */
export function isNaturalNote(noteIndex: number): boolean {
  return NATURAL_NOTE_INDICES.has(noteIndex);
}

/**
 * Prüft, ob ein chromatischer Index (0–11) eine schwarze Taste (Vorzeichen) ist.
 */
export function isBlackKey(noteIndex: number): boolean {
  return BLACK_KEY_INDICES.has(noteIndex);
}

/**
 * Bestimmt die Oktave einer MIDI-Nummer.
 * C4 (MIDI 60) = "eingestrichene Oktave" (Middle C).
 */
export function midiToOctave(midi: number): number {
  // C0 = MIDI 12, daher: Oktave = floor((midi - 12) / 12)
  return Math.floor((midi - 12) / SEMITONES_PER_OCTAVE);
}

const SEMITONES_PER_OCTAVE = 12;

/**
 * Repräsentiert eine musikalische Note.
 *
 * Alle Werte werden aus der MIDI-Nummer abgeleitet.
 * Die Notation (deutsch, englisch, etc.) wird bewusst NICHT hier gespeichert,
 * sondern über das Notation-System on-the-fly berechnet.
 */
export class Note {
  /** MIDI-Nummer 0–127 (z.B. A0=21, C4=60, A4=69, C8=108). */
  readonly midi: number;
  /** Frequenz in Hz. */
  readonly frequency: number;
  /** Chromatischer Index 0–11 (C=0, ..., H=11). */
  readonly noteIndex: number;
  /** Oktave (C4 = MIDI 60 = Middle C). */
  readonly octave: number;
  /** Vorzeichen: '', '#' oder 'b' (international, notationssystemunabhängig). */
  readonly accidental: '' | '#' | 'b';

  private constructor(midi: number) {
    this.midi = midi;
    this.frequency = midiToFrequency(midi);
    this.noteIndex = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
    this.octave = midiToOctave(midi);
    this.accidental = isBlackKey(this.noteIndex) ? '#' : '';
  }

  /**
   * Fabrikmethode aus MIDI-Nummer.
   */
  static fromMidi(midi: number): Note {
    return new Note(midi);
  }

  /**
   * Fabrikmethode aus chromatischem Index (0–11) und Oktave.
   * @param noteIndex 0–11 (C=0, C#=1, ..., H=11)
   * @param octave z.B. 4 für C4
   */
  static fromIndexAndOctave(noteIndex: number, octave: number): Note {
    const midi = 12 * (octave + 1) + noteIndex;
    return new Note(midi);
  }

  /** true, wenn die Note ein Stammtone (weiße Taste) ist. */
  get isNatural(): boolean {
    return isNaturalNote(this.noteIndex);
  }

  /** true, wenn die Note eine schwarze Taste (Vorzeichen) ist. */
  get isBlack(): boolean {
    return isBlackKey(this.noteIndex);
  }

  /** MIDI-Nummer der nächsten Note (Halbton höher). */
  up(interval = 1): Note {
    return new Note(this.midi + interval);
  }

  /** MIDI-Nummer der nächsten Note (Halbton tiefer). */
  down(interval = 1): Note {
    return new Note(this.midi - interval);
  }

  /** Vergleicht zwei Noten auf Gleichheit (MIDI-basiert). */
  equals(other: Note): boolean {
    return this.midi === other.midi;
  }
}

/** MIDI-Bereich eines 88-tastigen Klaviers. */
export const PIANO_MIN_MIDI = 21; // A0
export const PIANO_MAX_MIDI = 108; // C8
/** Middle C. */
export const MIDDLE_C_MIDI = 60;