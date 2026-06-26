/**
 * Deutsches Notationssystem (framework-neutral).
 *
 * Besonderheit: H statt B für den 11. Halbton.
 * B wird im deutschen System für Bb (den 10. Halbton) verwendet.
 *
 * Chromatisch: C, C#, D, D#, E, F, F#, G, G#, A, A#/B, H
 *
 * Tolerantes Parsing unterstützt:
 *   - "cis", "Cis", "CIS", "C#" → 1
 *   - "des", "Des", "Db" → 1
 *   - "es", "Es", "Eb" → 3
 *   - "as", "As", "Ab" → 8
 *   - "b", "B" (deutsch = Bb) → 10
 *   - "h", "H" → 11
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
  'B', // deutsch: B = Bb
  'H',
] as const;

const NATURAL_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'H'] as const;

// Parsing-Map: normalisierter Input → chromatischer Index
const PARSE_MAP: Record<string, number> = {
  c: 0,
  cis: 1,
  des: 1,
  d: 2,
  dis: 3,
  es: 3,
  e: 4,
  f: 5,
  fis: 6,
  ges: 6,
  g: 7,
  gis: 8,
  as: 8,
  a: 9,
  ais: 10,
  b: 10, // deutsch: B = Bb
  h: 11,
  his: 0, // His = C (enharmonisch)
  ces: 11, // Ces = H (enharmonisch)
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
    .replace(/[#♯]/g, 'is')
    .replace(/[b♭]/g, 'b')
    .replace(/\.$/, '');

  // Direkter Treffer
  if (normalized in PARSE_MAP) return PARSE_MAP[normalized];

  // Mit "-is"-Suffix (z.B. "cis", "gis")
  if (normalized.endsWith('is') && normalized.length > 2) {
    const base = normalized.slice(0, -2);
    const baseIndex = PARSE_MAP[base];
    if (baseIndex !== undefined) return (baseIndex + 1) % 12;
  }

  // Mit "b"/"es"/"as" etc.
  return -1;
}

function helmholtzFor(midi: number): string {
  return midiToHelmholtz(midi, (i) => NOTE_NAMES[i]);
}

export const germanNotation: NotationSystem = {
  id: 'german',
  label: 'Deutsch',
  description: 'C D E F G A H – deutsche Notation mit B für Bb',
  noteNames: NOTE_NAMES,
  noteNamesFlat: NOTE_NAMES_FLAT,
  naturalNames: NATURAL_NAMES,
  midiToName,
  midiToDisplay,
  nameToIndex,
  helmholtzFor,
};