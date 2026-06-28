/**
 * Nordisches Notationssystem (framework-neutral).
 *
 * Wie das deutsche System (H statt B), aber mit leicht angepasstem Parsing
 * für skandinavische und niederländische Konventionen.
 *
 * Chromatisch: C, C#, D, D#, E, F, F#, G, G#, A, A#/B, H
 *
 * Tolerantes Parsing unterstützt:
 *   - "ciss", "ciss", "Ciss" → 1 (skandinavische Verdopplung)
 *   - "b", "bess" → 10
 *   - "h", "hess" → 11
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
  'H',
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
  'B', // nordisch: B = Bb (wie deutsch)
  'H',
] as const;

const NATURAL_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'H'] as const;

// Parsing-Map: normalisierter Input → chromatischer Index
const PARSE_MAP: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  h: 11,
  b: 10, // nordisch: B = Bb (wie deutsch)
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
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[#♯]/g, 'iss') // skandinavisch: "iss" statt "is"
    .replace(/[b♭]/g, 'ess')
    .replace(/\.$/, '');

  // Direkter Treffer
  if (normalized in PARSE_MAP) return PARSE_MAP[normalized];

  // Mit "-iss"/"-is"-Suffix (z.B. "ciss", "giss", "cis")
  const sharpMatch = normalized.match(/^([cdefgah])(?:iss|is)$/);
  if (sharpMatch) {
    const base = sharpMatch[1];
    const baseIndex = PARSE_MAP[base];
    if (baseIndex !== undefined) return (baseIndex + 1) % 12;
  }

  // Mit "-ess"/"-es"-Suffix (z.B. "dess", "ess", "as")
  const flatMatch = normalized.match(/^([cdefgah])(?:ess|es)$/);
  if (flatMatch) {
    const base = flatMatch[1];
    const baseIndex = PARSE_MAP[base];
    if (baseIndex !== undefined) return (baseIndex - 1 + 12) % 12;
  }

  // Spezialfall: "ess" = Eb, "ass" = Ab
  if (normalized === 'ess') return 3;
  if (normalized === 'ass') return 8;

  return -1;
}

function helmholtzFor(midi: number): string {
  return midiToHelmholtz(midi, (i) => NOTE_NAMES[i]);
}

export const nordicNotation: NotationSystem = {
  id: 'nordic',
  label: 'Nordisch',
  description: 'C D E F G A H – skandinavische und niederländische Variante',
  noteNames: NOTE_NAMES,
  noteNamesFlat: NOTE_NAMES_FLAT,
  naturalNames: NATURAL_NAMES,
  midiToName,
  midiToDisplay,
  nameToIndex,
  helmholtzFor,
};