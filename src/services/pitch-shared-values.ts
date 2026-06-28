/**
 * Pitch-SharedValues – zentrale Shared-Memory-Brücke zwischen Audio-Layer und UI.
 *
 * Stufe A der Pitch-Dataflow-Architektur (siehe PITCH-DATAFLOW-PLAN.md):
 * Audio-Engine schreibt pro Frame direkt in diese SharedValues,
 * UI (Skia/Reanimated) liest sie ohne React-Props → 0 Re-Renders pro Frame.
 *
 * ⚠️ Wichtig: Strings (Notennamen) gehören NICHT hier rein – sie sind UI-Sache.
 * Stattdessen wird `detectedMidi` als Zahl gepusht und die UI wandelt bei
 * MIDI-Wechsel via `useAnimatedReaction` + `runOnJS` in den Namen um.
 *
 * Hinweis: Der `PitchFrame`-Typ für Diskret-Logik lebt in `pitch-utils.ts`
 * (klassische Domain-Brücke). Dieser Modul hier ist nur für kontinuierliche Werte.
 *
 * Design:
 * - `.value =` ist die offizielle Reanimated-API und KEIN React-State.
 *   Die `react-hooks/immutability`-Regel ist hier ein False-Positive → file-level
 *   eslint-disable.
 * - Setter sind KEINE Worklets. Sie werden vom JS-Thread (Audio-Callback)
 *   aufgerufen; `.value =` ist synchron und funktioniert ohne `'worklet'`-Direktive.
 *   (Früher waren sie als Worklets markiert, was beim Aufruf vom JS-Thread mit
 *   Objekt-Argumenten wie PitchFrame in Reanimated 4.x/worklets 0.10.x zu
 *   Problemen führen kann.)
 * - Setter und API-Objekt sind memoisiert → stabile Referenzen, Consumer
 *   re-rendern nicht unnötig, DerivedValues/Reactions bleiben stabil.
 */

/* eslint-disable react-hooks/immutability -- SharedValue .value = ist die
   offizielle Reanimated-API und KEIN React-State. Die Regel ist hier ein
   bekannter False-Positive. Siehe PITCH-DATAFLOW-PLAN.md. */

import { useCallback, useMemo } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { type PitchFrame } from './pitch-utils';

/**
 * Schreibseitige API für kontinuierliche Pitch-Werte.
 * Die Audio-Engine verwendet diese Setter, niemals direkte `.value =`.
 */
export interface PitchSharedValueSetters {
  /** Setzt alle kontinuierlichen Werte auf Stille-Defaults. */
  reset: () => void;
  /** Setzt nur Volume (Stille-Pfad im Audio Callback). */
  setVolume: (volume: number) => void;
  /** Setzt alle Werte aus einem Pitch-Frame (Erkennungspfad). */
  setFrame: (frame: PitchFrame) => void;
  /** Setzt nur den Stabilitäts-Fortschritt (Diskret-Logik im Screen). */
  setStabilityProgress: (progress: number) => void;
}

/**
 * Sämtliche kontinuierlichen Werte der Pitch-Detection (read-only für Consumer).
 * Alle Werte sind im Shared Memory – Updates triggern KEINE React-Re-Renders.
 */
export interface PitchSharedValues {
  /** RMS-Lautstärke, smoothed (0–1). 0 = Stille. */
  readonly volume: ReturnType<typeof useSharedValue<number>>;
  /** Clarity/Konfidenz der Erkennung (0–1). */
  readonly clarity: ReturnType<typeof useSharedValue<number>>;
  /** Erkannte Frequenz in Hz. 0 = Stille / unter Gate. */
  readonly frequency: ReturnType<typeof useSharedValue<number>>;
  /** Erkannte MIDI-Nummer (-1 = Stille, 0–127 = Note). */
  readonly detectedMidi: ReturnType<typeof useSharedValue<number>>;
  /** Cents-Abweichung zum Zielton (-50…+50). 0 bei Stille. */
  readonly centsOff: ReturnType<typeof useSharedValue<number>>;
  /** Stabilitäts-Fortschritt (0–1). */
  readonly stabilityProgress: ReturnType<typeof useSharedValue<number>>;
}

/** Vollständige API: SharedValues (lesen) + Setters (schreiben). */
export type PitchSharedValuesApi = PitchSharedValues & PitchSharedValueSetters;

/**
 * Erzeugt den Satz an Pitch-SharedValues inkl. gekapselter Setter.
 *
 * Initialwerte sind "Stille" (volume 0, midi -1, etc.).
 * Consumer (Audio-Engine, Screen) verwenden nur die Setter, niemals direkte
 * `.value`-Mutationen.
 *
 * Setters und API-Objekt sind memoisiert (useCallback/useMemo) → stabile
 * Referenzen über Renders hinweg.
 */
export function usePitchSharedValues(): PitchSharedValuesApi {
  const volume = useSharedValue(0);
  const clarity = useSharedValue(0);
  const frequency = useSharedValue(0);
  const detectedMidi = useSharedValue(-1);
  const centsOff = useSharedValue(0);
  const stabilityProgress = useSharedValue(0);

  const reset = useCallback(() => {
    volume.value = 0;
    clarity.value = 0;
    frequency.value = 0;
    detectedMidi.value = -1;
    centsOff.value = 0;
    stabilityProgress.value = 0;
  }, [volume, clarity, frequency, detectedMidi, centsOff, stabilityProgress]);

  const setVolume = useCallback(
    (v: number) => {
      volume.value = v;
    },
    [volume],
  );

  const setFrame = useCallback(
    (frame: PitchFrame) => {
      const midi =
        frame.frequency > 0
          ? Math.round(12 * Math.log2(frame.frequency / 440) + 69)
          : -1;
      volume.value = Math.min(1, frame.rms / 0.15);
      clarity.value = frame.clarity;
      frequency.value = frame.frequency;
      detectedMidi.value = midi;
    },
    [volume, clarity, frequency, detectedMidi],
  );

  const setStabilityProgress = useCallback(
    (progress: number) => {
      stabilityProgress.value = progress;
    },
    [stabilityProgress],
  );

  // API-Objekt memoisieren → stabile Referenz, Consumer re-rendern nicht unnötig
  // und useAnimatedReaction/useDerivedValue-Deps bleiben stabil.
  return useMemo(
    () => ({
      volume,
      clarity,
      frequency,
      detectedMidi,
      centsOff,
      stabilityProgress,
      reset,
      setVolume,
      setFrame,
      setStabilityProgress,
    }),
    [
      volume,
      clarity,
      frequency,
      detectedMidi,
      centsOff,
      stabilityProgress,
      reset,
      setVolume,
      setFrame,
      setStabilityProgress,
    ],
  );
}

/* eslint-enable react-hooks/immutability */

/**
 * Hilfsfunktion: Cents-Abweichung zwischen erkannter Frequenz und Ziel-MIDI.
 * Rein numerisch. Gibt 0 zurück bei Stille (freq <= 0).
 */
export function centsOffFromFrequency(
  frequency: number,
  targetMidi: number,
): number {
  if (frequency <= 0) return 0;
  const targetFreq = 440 * Math.pow(2, (targetMidi - 69) / 12);
  return 1200 * Math.log2(frequency / targetFreq);
}