/**
 * Pitch-Utils – Brücke zwischen Audio-Service und Domain.
 *
 * Transformiert rohe Audio-Ergebnisse (Frequenz, Clarity, RMS) in
 * domain-verständliche Werte.
 */

import {
    type FrequencyAnalysis,
    analyzeFrequency,
    frequencyToMidi,
} from '@/domain';

/** Ergebnis eines Pitch-Detection-Frames. */
export interface PitchFrame {
  /** Erkannte Frequenz in Hz (0 = Stille). */
  frequency: number;
  /** Clarity/Konfidenz der Erkennung (0–1). */
  clarity: number;
  /** RMS-Lautstärke (0–1). */
  rms: number;
  /** Zeitstempel (ms). */
  timestamp: number;
}

/**
 * Prüft, ob ein Frame die Qualitäts-Gate besteht.
 * (Clarity-Schwellwert UND RMS-Schwellwert).
 */
export function passesQualityGate(
  frame: PitchFrame,
  clarityThreshold: number,
  rmsThreshold: number,
): boolean {
  return frame.frequency > 0 && frame.clarity >= clarityThreshold && frame.rms >= rmsThreshold;
}

/**
 * Analysiert einen Pitch-Frame mit der Domain-Logik.
 */
export function analyzePitchFrame(frame: PitchFrame, toleranceCents = 25): FrequencyAnalysis {
  return analyzeFrequency(frame.frequency, toleranceCents);
}

/**
 * Berechnet die MIDI-Nummer aus einem Pitch-Frame (oder -1 bei Stille).
 */
export function frameToMidi(frame: PitchFrame): number {
  if (frame.frequency <= 0) return -1;
  return frequencyToMidi(frame.frequency);
}

/**
 * EMA-Smoothing (Exponential Moving Average) für Volume.
 *
 * @param previous Vorheriger geglätteter Wert.
 * @param current Aktueller Rohwert.
 * @param factor Glättungsfaktor (0–1, kleiner = stärkere Glättung).
 */
export function emaSmooth(previous: number, current: number, factor: number): number {
  return previous * (1 - factor) + current * factor;
}