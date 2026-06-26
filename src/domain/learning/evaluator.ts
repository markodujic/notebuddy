/**
 * Evaluator (framework-neutral).
 *
 * Bewertet Antworten im Audio-Modus (Frequenz) und im Klavier/Text-Modus (MIDI).
 */

import {
    analyzeFrequency,
    getPitchDirection,
    type PitchDirection,
} from '../music/frequency';
import { Note } from '../music/note';

/** Feedback-Typ nach einer Bewertung. */
export type FeedbackType = 'correct' | 'incorrect' | 'too-high' | 'too-low';

/** Ergebnis einer Bewertung. */
export interface EvaluationResult {
  /** War die Antwort korrekt? */
  correct: boolean;
  /** Feedback-Typ für die UI. */
  feedback: FeedbackType;
  /** Die Zielnote. */
  targetNote: Note;
  /** Die vom Benutzer gegebene Note. */
  inputNote: Note;
}

/**
 * Bewertet eine Audio-Antwort (Frequenz) gegen eine Zielnote.
 *
 * @param frequency Erkannte Frequenz in Hz.
 * @param targetNote Zielnote.
 * @param toleranceCents Toleranz in Cents (Standard: 25).
 */
export function evaluateFrequency(
  frequency: number,
  targetNote: Note,
  toleranceCents = 25,
): EvaluationResult {
  const analysis = analyzeFrequency(frequency, toleranceCents);
  const inputNote = Note.fromMidi(analysis.closestMidi);
  const correct =
    analysis.closestMidi === targetNote.midi && analysis.isInTune;

  let feedback: FeedbackType;
  if (correct) {
    feedback = 'correct';
  } else {
    const direction: PitchDirection = getPitchDirection(frequency, targetNote.midi);
    feedback =
      direction === 'too-high' ? 'too-high' : direction === 'too-low' ? 'too-low' : 'incorrect';
  }

  return {
    correct,
    feedback,
    targetNote,
    inputNote,
  };
}

/**
 * Bewertet eine Noten-Antwort (MIDI) gegen eine Zielnote.
 *
 * @param inputMidi Vom Benutzer gewählte MIDI-Nummer.
 * @param targetNote Zielnote.
 */
export function evaluateNote(inputMidi: number, targetNote: Note): EvaluationResult {
  const inputNote = Note.fromMidi(inputMidi);
  const correct = inputMidi === targetNote.midi;

  let feedback: FeedbackType;
  if (correct) {
    feedback = 'correct';
  } else if (inputMidi > targetNote.midi) {
    feedback = 'too-high';
  } else {
    feedback = 'too-low';
  }

  return {
    correct,
    feedback,
    targetNote,
    inputNote,
  };
}