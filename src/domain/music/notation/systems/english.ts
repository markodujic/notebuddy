/**
 * Englisches Notationssystem (framework-neutral).
 *
 * Chromatisch: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
 * (B = internationaler Standard für den 11. Halbton)
 *
 * Tolerantes Parsing unterstützt:
 *   - "C#", "c#", "Cis" → 1
 *   - "Db", "db", "Des" → 1
 *   - "B", "b" → 11
 */

import { midiToHelmholtz } from '../helmholtz';
import {
    type DisplayOptions,
    type NameOptions,
    type NotationSystem,
    midiToNoteIndex,
    midiToScientificOctave,
} from '../types';

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

const NOTE_NAMES_FLAT = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

const NATURAL_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// Parsing-Map: normalisierter Input → chromatischer Index
const PARSE_MAP: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11, // englisch: B = B (nicht Bb)
  h: 11, // tolerate deutsche Eingabe
};

function midiToName(midi: number, opts?: NameOptions): string {
  const index = midiToNoteIndex(midi);
  if (opts?.useFlats) return NOTE_NAMES_FLAT[index];
  return NOTE_NAMES[index];
}

function midiToDisplay(midi: number, opts?: DisplayOptions): string {
  const name = midiToName(midi, opts);
  if (opts?.octaveStyle === 'helmholtz') {
    return helmholtzFor(midi);
  }
  const octave = midiToScientificOctave(midi);
  return `${name}${octave}`;
}

function nameToIndex(input: string): number {
  const normalized = input.trim().toLowerCase().replace(/\.$/, '');

  // Direkter Treffer
  if (normalized in PARSE_MAP) return PARSE_MAP[normalized];

  // Sharp: "c#", "cis", "c♯"
  const sharpMatch = normalized.match(/^([a-g])(?:#|♯|is)$/);
  if (sharpMatch) {
    const base = sharpMatch[1];
    const baseIndex = PARSE_MAP[base];
    if (baseIndex !== undefined) return (baseIndex + 1) % 12;
  }

  // Flat: "db", "des", "d♭"
  const flatMatch = normalized.match(/^([a-g])(?:b|♭|es|as)$/);
  if (flatMatch) {
    const base = flatMatch[1];
    const baseIndex = PARSE_MAP[base];
    if (baseIndex !== undefined) return (baseIndex - 1 + 12) % 12;
  }

  // Toleriere deutsches "h" als b/11
  if (normalized === 'h') return 11;

  return -1;
}

function helmholtzFor(midi: number): string {
  return midiToHelmholtz(midi, (i) => NOTE_NAMES[i]);
}

export const englishNotation: NotationSystem = {
  id: 'english',
  label: 'English',
  description: 'C D E F G A B – international standard notation',
  noteNames: NOTE_NAMES,
  noteNamesFlat: NOTE_NAMES_FLAT,
  naturalNames: NATURAL_NAMES,
  midiToName,
  midiToDisplay,
  nameToIndex,
  helmholtzFor,
};