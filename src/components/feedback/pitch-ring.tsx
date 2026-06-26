/**
 * PitchRing – Skia Ring für Pitch-Detection-Feedback.
 *
 * Visualisiert:
 *   - Stabilitäts-Ring (Fortschritt 0→1, grün/rot)
 *   - Volume-Ring (orange, hinter Stabilität)
 *   - Glow bei >50% Stabilität
 *   - Result-Icon (✓/✗) im Zentrum
 */

import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export interface PitchRingProps {
  /** Anzeigen? */
  show: boolean;
  /** Wird gerade erkannt? */
  isDetecting: boolean;
  /** Erkannte Note (Text). */
  detectedNote?: string;
  /** Stabilitäts-Fortschritt 0–1. */
  stabilityProgress: number;
  /** Volume 0–1. */
  volume: number;
  /** Ergebnis-Status. */
  resultState?: 'correct' | 'incorrect' | null;
  /** Ergebnis-Message. */
  resultMessage?: string;
  /** Größe des Rings (Durchmesser). */
  size?: number;
}

/** Baut einen SVG-Arc-Path für einen Kreis-Ring-Segment. */
function arcPath(cx: number, cy: number, radius: number, sweepFraction: number): string {
  if (sweepFraction <= 0) return '';
  if (sweepFraction >= 1) {
    // Vollkreis als zwei Halbkreise
    return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`;
  }
  const sweepRad = sweepFraction * 2 * Math.PI;
  // Start oben (-90°), im Uhrzeigersinn
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
  detectedNote,
  stabilityProgress,
  volume,
  resultState,
  resultMessage,
  size = 160,
}: PitchRingProps) {
  const center = size / 2;
  const radius = size / 2 - 12;
  const strokeWidth = 8;

  // Paths für Volume und Stabilität
  const volumeArc = useMemo(
    () => arcPath(center, center, radius, volume),
    [center, radius, volume],
  );
  const stabilityArc = useMemo(
    () => arcPath(center, center, radius, stabilityProgress),
    [center, radius, stabilityProgress],
  );

  // Glow bei hoher Stabilität
  const showGlow = useMemo(() => stabilityProgress > 0.5, [stabilityProgress]);

  // Farben je nach Status
  const stabilityColor = resultState === 'incorrect' ? '#ef4444' : '#22c55e';

  if (!show) return null;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Glow bei hoher Stabilität */}
        {showGlow && (
          <Circle
            cx={center}
            cy={center}
            r={radius + 4}
            color="rgba(34,197,94,0.2)"
            strokeWidth={strokeWidth + 8}
            style="stroke"
          />
        )}

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
        {volumeArc ? (
          <Path
            path={volumeArc}
            color="rgba(249,115,22,0.6)"
            strokeWidth={strokeWidth - 2}
            style="stroke"
            strokeCap="round"
          />
        ) : null}

        {/* Stabilitäts-Ring (grün/rot) */}
        {stabilityArc ? (
          <Path
            path={stabilityArc}
            color={stabilityColor}
            strokeWidth={strokeWidth}
            style="stroke"
            strokeCap="round"
          />
        ) : null}
      </Canvas>

      {/* Zentrum: Note oder Result-Icon */}
      <View style={styles.centerContent}>
        {resultState === 'correct' ? (
          <ThemedText type="title" style={{ color: '#22c55e' }}>✓</ThemedText>
        ) : resultState === 'incorrect' ? (
          <ThemedText type="title" style={{ color: '#ef4444' }}>✗</ThemedText>
        ) : isDetecting && detectedNote ? (
          <ThemedText type="subtitle">{detectedNote}</ThemedText>
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