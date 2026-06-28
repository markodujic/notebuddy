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
 * Design: Sämtliche `.value`-Mutationen sind in Methoden dieses Hooks gekapselt
 * (`setSilence`, `setFrame`, `setStabilityProgress`, `reset`). Consumer greifen
 * nie direkt auf `.value` schreibend zu → der React Compiler hat nichts zu
 * meckern (Reanimated-Mutationen sind False-Positives von `react-hooks/immutability`).
 */

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
 * `.value`-Mutationen → React-Compiler-kompatibel.
 */
export function usePitchSharedValues(): PitchSharedValuesApi {
  const volume = useSharedValue(0);
  const clarity = useSharedValue(0);
  const frequency = useSharedValue(0);
  const detectedMidi = useSharedValue(-1);
  const centsOff = useSharedValue(0);
  const stabilityProgress = useSharedValue(0);

  // ⚠️ Reanimated SharedValues werden per `.value =` mutationiert – das ist die
  // offiziell dokumentierte API und KEIN React-State. Innerhalb von Worklets
  // (`'worklet'`) greift die `react-hooks/immutability`-Regel ohnehin nicht,
  // daher ist kein eslint-disable nötig. Die Mutationen sind hier zentral
  // gekapselt, Consumer greifen nie direkt auf `.value` schreibend zu.
  const reset = () => {
    'worklet';
    volume.value = 0;
    clarity.value = 0;
    frequency.value = 0;
    detectedMidi.value = -1;
    centsOff.value = 0;
    stabilityProgress.value = 0;
  };

  const setVolume = (v: number) => {
    'worklet';
    volume.value = v;
  };

  const setFrame = (frame: PitchFrame) => {
    'worklet';
    const midi =
      frame.frequency > 0
        ? Math.round(12 * Math.log2(frame.frequency / 440) + 69)
        : -1;
    volume.value = Math.min(1, frame.rms / 0.15);
    clarity.value = frame.clarity;
    frequency.value = frame.frequency;
    detectedMidi.value = midi;
  };

  const setStabilityProgress = (progress: number) => {
    'worklet';
    stabilityProgress.value = progress;
  };

  return {
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
  };
}

/**
 * Hilfsfunktion: Cents-Abweichung zwischen erkannter Frequenz und Ziel-MIDI.
 * Rein numerisch (worklet-safe). Gibt 0 zurück bei Stille (freq <= 0).
 */
export function centsOffFromFrequency(
  frequency: number,
  targetMidi: number,
): number {
  'worklet';
  if (frequency <= 0) return 0;
  const targetFreq = 440 * Math.pow(2, (targetMidi - 69) / 12);
  return 1200 * Math.log2(frequency / targetFreq);
}