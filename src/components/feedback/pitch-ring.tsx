/**
 * PitchRing – Skia Ring für Pitch-Detection-Feedback (Stufe A: SharedValue-Consumer).
 *
 * Visualisiert (alles auf UI-Thread, 0 Re-Renders pro Frame):
 *   - Stabilitäts-Ring (Fortschritt 0→1, grün/rot)
 *   - Volume-Ring (orange, hinter Stabilität)
 *   - Glow bei >50% Stabilität
 *   - Result-Icon (✓/✗) im Zentrum
 *
 * Liest kontinuierliche Werte direkt aus `values` (SharedValues) via
 * `useDerivedValue`. Text-Update (Notenname) nur bei MIDI-Wechsel über
 * `useAnimatedReaction` + `runOnJS` (selten, kein Frame-Overhead).
 */

import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { memo, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import type { PitchSharedValues } from '@/services/pitch-shared-values';

export interface PitchRingProps {
  /** Anzeigen? */
  show: boolean;
  /** Wird gerade erkannt? */
  isDetecting: boolean;
  /** SharedValues (volume, stabilityProgress, detectedMidi, ...). */
  values: PitchSharedValues;
  /** Wandelt MIDI in Anzeige-Text um (z.B. Notation-System). */
  midiToName?: (midi: number) => string;
  /** Ergebnis-Status. */
  resultState?: 'correct' | 'incorrect' | null;
  /** Ergebnis-Message. */
  resultMessage?: string;
  /** Größe des Rings (Durchmesser). */
  size?: number;
}

/** Baut einen SVG-Arc-Path für einen Kreis-Ring-Segment (worklet-safe, rein). */
function arcPath(cx: number, cy: number, radius: number, sweepFraction: number): string {
  'worklet';
  if (sweepFraction <= 0) return '';
  if (sweepFraction >= 1) {
    return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`;
  }
  const sweepRad = sweepFraction * 2 * Math.PI;
  const startX = cx + radius * Math.cos(-Math.PI / 2);
  const startY = cy + radius * Math.sin(-Math.PI / 2);
  const endX = cx + radius * Math.cos(-Math.PI / 2 + sweepRad);
  const endY = cy + radius * Math.sin(-Math.PI / 2 + sweepRad);
  const largeArc = sweepFraction > 0.5 ? 1 : 0;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
}

export const PitchRing = memo(function PitchRing({
  show,
  isDetecting,
  values,
  midiToName,
  resultState,
  resultMessage,
  size = 160,
}: PitchRingProps) {
  const center = size / 2;
  const radius = size / 2 - 12;
  const strokeWidth = 8;

  // Notenname nur bei MIDI-Wechsel updaten (selten, via runOnJS)
  const [noteName, setNoteName] = useState('');
  const updateNoteName = useCallback(
    (midi: number) => {
      if (!midiToName || midi < 0) {
        setNoteName('');
        return;
      }
      setNoteName(midiToName(midi));
    },
    [midiToName],
  );

  // Reagiert nur auf Wechsel der MIDI-Note (nicht pro Frame-Update).
  // Deps: das einzelne SharedValue (stabile Referenz), nicht das Wrapper-Objekt.
  const { detectedMidi, volume, stabilityProgress } = values;
  useAnimatedReaction(
    () => detectedMidi.value,
    (current, prev) => {
      if (current !== prev) {
        runOnJS(updateNoteName)(current);
      }
    },
    [detectedMidi, updateNoteName],
  );

  // Paths & Glow als DerivedValues (UI-Thread, 0 Re-Renders).
  // Deps: die einzelnen SharedValues (stabil), nicht das Wrapper-Objekt.
  const volumeArc = useDerivedValue(
    () => arcPath(center, center, radius, volume.value),
    [center, radius, volume],
  );
  const stabilityArc = useDerivedValue(
    () => arcPath(center, center, radius, stabilityProgress.value),
    [center, radius, stabilityProgress],
  );
  const glowOpacity = useDerivedValue(
    () => (stabilityProgress.value > 0.5 ? 1 : 0),
    [stabilityProgress],
  );

  // Farbe je nach Status
  const stabilityColor = resultState === 'incorrect' ? '#ef4444' : '#22c55e';

  if (!show) return null;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Glow bei hoher Stabilität (opacity-gesteuert, kein Conditional-Render) */}
        <Circle
          cx={center}
          cy={center}
          r={radius + 4}
          color="rgba(34,197,94,0.2)"
          strokeWidth={strokeWidth + 8}
          style="stroke"
          opacity={glowOpacity}
        />

        {/* Hintergrund-Ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          color="rgba(128,128,128,0.15)"
          strokeWidth={strokeWidth}
          style="stroke"
        />

        {/* Volume-Ring (orange) */}
        <Path
          path={volumeArc}
          color="rgba(249,115,22,0.6)"
          strokeWidth={strokeWidth - 2}
          style="stroke"
          strokeCap="round"
        />

        {/* Stabilitäts-Ring (grün/rot) */}
        <Path
          path={stabilityArc}
          color={stabilityColor}
          strokeWidth={strokeWidth}
          style="stroke"
          strokeCap="round"
        />
      </Canvas>

      {/* Zentrum: Note oder Result-Icon */}
      <View style={styles.centerContent}>
        {resultState === 'correct' ? (
          <ThemedText type="title" style={{ color: '#22c55e' }}>✓</ThemedText>
        ) : resultState === 'incorrect' ? (
          <ThemedText type="title" style={{ color: '#ef4444' }}>✗</ThemedText>
        ) : isDetecting && noteName ? (
          <ThemedText type="subtitle">{noteName}</ThemedText>
        ) : (
          <ThemedText type="small" style={{ opacity: 0.5 }}>
            {resultMessage ?? 'Höre zu…'}
          </ThemedText>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});