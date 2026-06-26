/**
 * Solfège-Notationssystem (framework-neutral).
 *
 * Chromatisch: Do, Do#, Re, Re#, Mi, Fa, Fa#, Sol, Sol#, La, La#, Si
 *
 * Fixed Do (Bewegliches Do deaktiviert): Do entspricht immer C.
 * Verbreitet in Italien, Frankreich, Spanien, Lateinamerika.
 *
 * Tolerantes Parsing unterstützt:
 *   - "do", "Do", "DO" → 0
 *   - "do#", "do♯", "di" → 1
 *   - "reb", "rémol" → 1
 *   - "ut" als alternatives Do → 0
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
  'Do',
  'Do#',
  'Re',
  'Re#',
  'Mi',
  'Fa',
  'Fa#',
  'Sol',
  'Sol#',
  'La',
  'La#',
  'Si',
] as const;

const NOTE_NAMES_FLAT = [
  'Do',
  'Reb',
  'Re',
  'Mib',
  'Mi',
  'Fa',
  'Solb',
  'Sol',
  'Lab',
  'La',
  'Sib',
  'Si',
] as const;

const NATURAL_NAMES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'] as const;

// Parsing-Map: normalisierter Input → chromatischer Index
const PARSE_MAP: Record<string, number> = {
  do: 0,
  ut: 0, // historische Variante
  re: 2,
  mi: 4,
  fa: 5,
  sol: 7,
  so: 7, // amerikanische Variante
  la: 9,
  si: 11,
  ti: 11, // amerikanische Variante
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
    .replace(/[èé]/g, 'e')
    .replace(/[àá]/g, 'a')
    .replace(/[òó]/g, 'o')
    .replace(/[ìí]/g, 'i')
    .replace(/\.$/, '');

  // Direkter Treffer
  if (normalized in PARSE_MAP) return PARSE_MAP[normalized];

  // Sharp: "do#", "do♯", "di"
  const sharpMap: Record<string, number> = {
    di: 1,
    ri: 3,
    fi: 6,
    si: 8,
    li: 10,
  };
  if (normalized in sharpMap) return sharpMap[normalized];

  // Mit Suffix "#"
  const sharpMatch = normalized.match(/^(do|re|mi|fa|sol|so|la|si|ti|ut)(?:#|♯)$/);
  if (sharpMatch) {
    const base = sharpMatch[1];
    const baseIndex = PARSE_MAP[base];
    if (baseIndex !== undefined) return (baseIndex + 1) % 12;
  }

  // Flat: "reb", "re♭"
  const flatMatch = normalized.match(/^(do|re|mi|fa|sol|so|la|si|ti|ut)(?:b|♭)$/);
  if (flatMatch) {
    const base = flatMatch[1];
    const baseIndex = PARSE_MAP[base];
    if (baseIndex !== undefined) return (baseIndex - 1 + 12) % 12;
  }

  // "ra" als Reb, "ma"/"me" als Mib, "se" als Mib, "le" als Solb, "te" als Sib
  const flatMap: Record<string, number> = {
    ra: 1,
    me: 3,
    ma: 3,
    se: 4,
    le: 6,
    te: 10,
  };
  if (normalized in flatMap) return flatMap[normalized];

  return -1;
}

function helmholtzFor(midi: number): string {
  return midiToHelmholtz(midi, (i) => NOTE_NAMES[i]);
}

export const solfegeNotation: NotationSystem = {
  id: 'solfege',
  label: 'Solfège',
  description: 'Do Re Mi Fa Sol La Si – fixed Do (Romanische Länder)',
  noteNames: NOTE_NAMES,
  noteNamesFlat: NOTE_NAMES_FLAT,
  naturalNames: NATURAL_NAMES,
  midiToName,
  midiToDisplay,
  nameToIndex,
  helmholtzFor,
};