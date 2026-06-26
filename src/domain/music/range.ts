/**
 * Range-Modell (framework-neutral).
 *
 * Verwaltet einen Tonumfang (min/max MIDI) und bietet Hilfsfunktionen.
 */

import { isBlackKey, isNaturalNote, Note } from './note';

/** Standard-Tonumfang (Violinschlüssel): e′–f″ (MIDI 64–77). */
export const TREBLE_DEFAULT_RANGE: Range = {
  minMidi: 64,
  maxMidi: 77,
};

/** Standard-Tonumfang (Bassschlüssel): G–a (MIDI 43–57). */
export const BASS_DEFAULT_RANGE: Range = {
  minMidi: 43,
  maxMidi: 57,
};

/** Allgemeiner Default-Range: C3–C6 (MIDI 48–84). */
export const DEFAULT_RANGE: Range = {
  minMidi: 48,
  maxMidi: 84,
};

/** Ein Tonumfang, definiert durch min/max MIDI. */
export interface Range {
  minMidi: number;
  maxMidi: number;
}

/**
 * Erstellt eine Range aus min/max MIDI und validiert die Reihenfolge.
 */
export function createRange(minMidi: number, maxMidi: number): Range {
  if (minMidi > maxMidi) {
    return { minMidi: maxMidi, maxMidi: minMidi };
  }
  return { minMidi, maxMidi };
}

/**
 * Gibt die kleinere Note in einer Range zurück.
 */
export function getMinNote(range: Range): Note {
  return Note.fromMidi(range.minMidi);
}

/**
 * Gibt die größere Note in einer Range zurück.
 */
export function getMaxNote(range: Range): Note {
  return Note.fromMidi(range.maxMidi);
}

/**
 * Prüft, ob eine MIDI-Nummer in der Range liegt.
 */
export function contains(range: Range, midi: number): boolean {
  return midi >= range.minMidi && midi <= range.maxMidi;
}

/**
 * Anzahl der Noten in der Range (inkl. Grenzen).
 */
export function noteCount(range: Range): number {
  return range.maxMidi - range.minMidi + 1;
}

/**
 * Gibt alle MIDI-Nummern in der Range zurück.
 */
export function getAllMidi(range: Range): number[] {
  const result: number[] = [];
  for (let midi = range.minMidi; midi <= range.maxMidi; midi += 1) {
    result.push(midi);
  }
  return result;
}

/**
 * Gibt alle MIDI-Nummern in der Range zurück, optional auf Stammtöne gefiltert.
 *
 * @param range Tonumfang
 * @param onlyNaturalNotes Wenn true, werden nur weiße Tasten zurückgegeben.
 */
export function getAllMidiFiltered(range: Range, onlyNaturalNotes: boolean): number[] {
  const all = getAllMidi(range);
  if (!onlyNaturalNotes) return all;
  return all.filter((midi) => {
    const noteIndex = ((midi % 12) + 12) % 12;
    return isNaturalNote(noteIndex);
  });
}

/**
 * Gibt eine zufällige MIDI-Nummer aus der Range zurück.
 *
 * @param range Tonumfang
 * @param onlyNaturalNotes Wenn true, nur Stammtöne.
 */
export function getRandomMidi(range: Range, onlyNaturalNotes = false): number {
  const pool = getAllMidiFiltered(range, onlyNaturalNotes);
  if (pool.length === 0) return range.minMidi;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Erweitert eine Range um eine gegebene Anzahl Halbtöne in beide Richtungen.
 */
export function expandRange(range: Range, semitones: number): Range {
  return {
    minMidi: range.minMidi - semitones,
    maxMidi: range.maxMidi + semitones,
  };
}

/**
 * Schneidet eine Range auf absolute Grenzen (z.B. Klavierumfang).
 */
export function clampRange(range: Range, absoluteMin: number, absoluteMax: number): Range {
  return {
    minMidi: Math.max(absoluteMin, range.minMidi),
    maxMidi: Math.min(absoluteMax, range.maxMidi),
  };
}

/**
 * Prüft, ob eine MIDI-Note in der Range eine schwarze Taste ist.
 */
export function isBlackKeyInRange(range: Range, midi: number): boolean {
  if (!contains(range, midi)) return false;
  const noteIndex = ((midi % 12) + 12) % 12;
  return isBlackKey(noteIndex);
}