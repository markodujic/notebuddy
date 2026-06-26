/**
 * Helmholtz-Notation (framework-neutral, shared helper).
 *
 * Helmholtz-Oktav-Bezeichnungen:
 *   Oktave 0: C,,  (Subkontra)
 *   Oktave 1: C,   (Kontra)
 *   Oktave 2: C    (Große Oktave)
 *   Oktave 3: c    (Kleine Oktave)
 *   Oktave 4: c′   (Eingestrichen – Middle C)
 *   Oktave 5: c″   (Zweigestrichen)
 *   Oktave 6: c‴   (Dreigestrichen)
 *   Oktave 7: c′′′′ (Viergestrichen)
 */

import { midiToNoteIndex, midiToScientificOctave } from './types';

const PRIMES = ['', '′', '″', '‴', '′′′′'];
const COMMAS = ['', ',', ',,', ',,,', ',,,,'];

/**
 * Erzeugt die Helmholtz-Bezeichnung für eine MIDI-Nummer.
 *
 * @param midi MIDI-Nummer.
 * @param nameLookup Funktion: noteIndex (0–11) → Notenname (z.B. "C", "Do").
 */
export function midiToHelmholtz(
  midi: number,
  nameLookup: (noteIndex: number) => string,
): string {
  const noteIndex = midiToNoteIndex(midi);
  const octave = midiToScientificOctave(midi);
  const name = nameLookup(noteIndex);

  if (octave <= 2) {
    // Große Oktave und tiefer: Großbuchstaben + Kommas
    const commaIndex = Math.max(0, 2 - octave);
    const base = name.toUpperCase();
    return base + COMMAS[commaIndex];
  }
  // Ab kleine Oktave (Oktave 3): Kleinbuchstaben + Striche
  const primeIndex = Math.min(PRIMES.length - 1, octave - 3);
  const base = name.toLowerCase();
  return base + PRIMES[primeIndex];
}