/**
 * Frequenz-Mapping und Pitch-Analyse (framework-neutral).
 *
 * Grundlage: A4 (MIDI 69) = 440 Hz (Kammerton).
 */

/** Kammerton A4 in Hz. */
export const A4_FREQUENCY = 440;
/** MIDI-Nummer von A4. */
export const A4_MIDI = 69;
/** Anzahl Halbtöne pro Oktave. */
export const SEMITONES_PER_OCTAVE = 12;
/** Cents pro Halbton. */
export const CENTS_PER_SEMITONE = 100;

/**
 * Konvertiert eine MIDI-Nummer in die entsprechende Frequenz in Hz.
 * f = 440 * 2^((midi - 69) / 12)
 */
export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * Konvertiert eine Frequenz in Hz in die nächste MIDI-Nummer (gerundet).
 * midi = round(12 * log2(f / 440) + 69)
 */
export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return -1;
  return Math.round(SEMITONES_PER_OCTAVE * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI);
}

/**
 * Berechnet die Cents-Differenz zwischen zwei Frequenzen.
 * Positive Werte = f1 höher als f2, negative = f1 tiefer.
 */
export function centsBetween(f1: number, f2: number): number {
  if (f1 <= 0 || f2 <= 0) return 0;
  return 1200 * Math.log2(f1 / f2);
}

/**
 * Berechnet die Cents-Abweichung einer Frequenz zur nächsten gleichschwebenden
 * MIDI-Stufe. Werte liegen im Bereich [-50, +50].
 */
export function centsOffFromNearestNote(frequency: number): number {
  if (frequency <= 0) return 0;
  const exactMidi = SEMITONES_PER_OCTAVE * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI;
  const roundedMidi = Math.round(exactMidi);
  const exactFreqOfRounded = midiToFrequency(roundedMidi);
  return centsBetween(frequency, exactFreqOfRounded);
}

/** Ergebnis der Frequenzanalyse. */
export interface FrequencyAnalysis {
  /** Nächste MIDI-Nummer. */
  closestMidi: number;
  /** Cents-Abweichung zur nächsten MIDI-Stufe [-50, +50]. */
  centsDifference: number;
  /** true, wenn die Abweichung innerhalb der Toleranz liegt. */
  isInTune: boolean;
}

/**
 * Analysiert eine Frequenz und gibt die nächste MIDI-Note sowie die Stimmung zurück.
 *
 * @param frequency Frequenz in Hz.
 * @param toleranceCents Toleranz in Cents (Standard: 25).
 */
export function analyzeFrequency(frequency: number, toleranceCents = 25): FrequencyAnalysis {
  if (frequency <= 0) {
    return { closestMidi: -1, centsDifference: 0, isInTune: false };
  }
  const closestMidi = frequencyToMidi(frequency);
  const centsDifference = centsOffFromNearestNote(frequency);
  return {
    closestMidi,
    centsDifference,
    isInTune: Math.abs(centsDifference) <= toleranceCents,
  };
}

/**
 * Prüft, ob eine Frequenz zur Ziel-MIDI-Note innerhalb der Toleranz passt.
 *
 * @param frequency Erkannte Frequenz in Hz.
 * @param targetMidi Ziel-MIDI-Nummer.
 * @param toleranceCents Toleranz in Cents (Standard: 25).
 */
export function matchesNote(frequency: number, targetMidi: number, toleranceCents = 25): boolean {
  if (frequency <= 0) return false;
  const { closestMidi, isInTune } = analyzeFrequency(frequency, toleranceCents);
  return closestMidi === targetMidi && isInTune;
}

/** Richtung der Tonhöhen-Abweichung. */
export type PitchDirection = 'too-high' | 'too-low' | 'correct';

/**
 * Vergleicht eine Frequenz mit einer Ziel-MIDI-Note und gibt die Richtung zurück.
 */
export function getPitchDirection(frequency: number, targetMidi: number): PitchDirection {
  if (frequency <= 0) return 'too-low';
  const closestMidi = frequencyToMidi(frequency);
  if (closestMidi === targetMidi) return 'correct';
  return closestMidi > targetMidi ? 'too-high' : 'too-low';
}