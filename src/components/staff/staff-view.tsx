/**
 * StaffView – Skia-basiertes Notensystem.
 *
 * Zeichnet:
 *   - 5 Hauptlinien
 *   - Violin- oder Bassschlüssel (Bravura Font)
 *   - Notenkopf + Hilfslinien an einer Position
 *   - Falsche Note (rot blinkend)
 *
 * Interaktiv: Klick/Touch → onPositionSelect Callback.
 */

import { Canvas, Line, RoundedRect, Text, useFont } from '@shopify/react-native-skia';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue
} from 'react-native-reanimated';

import { BRAVURA_FONT_FAMILY, SMUFL, STAFF_METRICS } from '@/constants/music-font';
import {
  type Clef,
  type StaffPosition,
  getNoteStaffPosition,
} from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import {
  STAFF_HEIGHT,
  getLedgerLineYs,
  getStaffLineYs,
  getYForPosition,
} from './staff-geometry';

export interface StaffViewProps {
  /** Notenschlüssel. */
  clef: Clef;
  /** Anzuzeigende Note (MIDI). */
  displayMidi?: number | null;
  /** Farbe der angezeigten Note (Default: Theme text). */
  displayColor?: string;
  /** Falsche Note (MIDI) – rot blinkend. */
  wrongMidi?: number | null;
  /** Feedback einblenden? (Fade-In Animation) */
  showFeedback?: boolean;
  /** Interaktiv? (Klicks erlauben) */
  interactive?: boolean;
  /** Callback bei Positionswahl. */
  onPositionSelect?: (position: StaffPosition) => void;
  /** Breite des Systems (Default: 100%). */
  width?: number;
}

// Innere Skia-Canvas-Komponente (nur Rendering)
type StaffCanvasProps = {
  clef: Clef;
  displayPosition: StaffPosition | null;
  displayColor: string;
  wrongPosition: StaffPosition | null;
  topY: number;
  width: number;
  staffLineColor: string;
  clefColor: string;
  noteColor: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StaffCanvasInner({
  clef,
  displayPosition,
  displayColor,
  wrongPosition,
  topY,
  width,
  staffLineColor,
  clefColor,
  noteColor,
}: StaffCanvasProps) {
  const bravuraFont = useFont(BRAVURA_FONT_FAMILY, 64);
  const lineYs = useMemo(() => getStaffLineYs(topY), [topY]);
  const clefX = 12;
  const noteX = width * 0.5;

  // Hilfslinien für Display-Note
  const displayLedgers = useMemo(() => {
    if (!displayPosition) return [];
    return getLedgerLineYs(displayPosition, topY, clef);
  }, [displayPosition, topY, clef]);

  // Hilfslinien für Wrong-Note
  const wrongLedgers = useMemo(() => {
    if (!wrongPosition) return [];
    return getLedgerLineYs(wrongPosition, topY, clef);
  }, [wrongPosition, topY, clef]);

  const displayY = displayPosition ? getYForPosition(displayPosition, topY) : 0;
  const wrongY = wrongPosition ? getYForPosition(wrongPosition, topY) : 0;

  const clefGlyph = clef === 'treble' ? SMUFL.TREBLE_CLEF : SMUFL.BASS_CLEF;

  return (
    <Canvas style={{ width, height: STAFF_HEIGHT + 100 }}>
      {/* 5 Hauptlinien */}
      {lineYs.map((y, i) => (
        <Line
          key={`line-${i}`}
          p1={{ x: 0, y }}
          p2={{ x: width, y }}
          color={staffLineColor}
          strokeWidth={STAFF_METRICS.LINE_WIDTH}
        />
      ))}

      {/* Schlüssel */}
      {bravuraFont && (
        <Text
          x={clefX}
          y={topY + STAFF_METRICS.LINE_SPACING * 4 + 4}
          text={clefGlyph}
          font={bravuraFont}
          color={clefColor}
        />
      )}

      {/* Hilfslinien für Display-Note */}
      {displayLedgers.map((y, i) => (
        <Line
          key={`dl-${i}`}
          p1={{ x: noteX - STAFF_METRICS.NOTE_HEAD_WIDTH - STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
          p2={{ x: noteX + STAFF_METRICS.NOTE_HEAD_WIDTH + STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
          color={staffLineColor}
          strokeWidth={STAFF_METRICS.LINE_WIDTH}
        />
      ))}

      {/* Falsche Note (rot blinkend) */}
      {wrongPosition && (
        <>
          {wrongLedgers.map((y, i) => (
            <Line
              key={`wl-${i}`}
              p1={{ x: noteX - STAFF_METRICS.NOTE_HEAD_WIDTH - STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
              p2={{ x: noteX + STAFF_METRICS.NOTE_HEAD_WIDTH + STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
              color="#ef4444"
              strokeWidth={STAFF_METRICS.LINE_WIDTH}
            />
          ))}
          {/* Notenkopf rot */}
          <RoundedRect
            x={noteX - STAFF_METRICS.NOTE_HEAD_WIDTH / 2}
            y={wrongY - STAFF_METRICS.NOTE_HEAD_HEIGHT / 2}
            width={STAFF_METRICS.NOTE_HEAD_WIDTH}
            height={STAFF_METRICS.NOTE_HEAD_HEIGHT}
            r={STAFF_METRICS.NOTE_HEAD_HEIGHT / 2}
            color="#ef4444"
          />
        </>
      )}

      {/* Display-Note */}
      {displayPosition && (
        <RoundedRect
          x={noteX - STAFF_METRICS.NOTE_HEAD_WIDTH / 2}
          y={displayY - STAFF_METRICS.NOTE_HEAD_HEIGHT / 2}
          width={STAFF_METRICS.NOTE_HEAD_WIDTH}
          height={STAFF_METRICS.NOTE_HEAD_HEIGHT}
          r={STAFF_METRICS.NOTE_HEAD_HEIGHT / 2}
          color={displayColor || noteColor}
        />
      )}
    </Canvas>
  );
}

export const StaffView = memo(function StaffView({
  clef,
  displayMidi,
  displayColor,
  wrongMidi,
  showFeedback,
  interactive = false,
  onPositionSelect,
  width = 300,
}: StaffViewProps) {
  const theme = useTheme();
  const topY = 30; // Obere Linie

  // Platzhalter für künftige Blink/Fade-In Animationen
  const blinkOpacity = useSharedValue(1);
  const feedbackOpacity = useSharedValue(0);
  void blinkOpacity;
  void feedbackOpacity;

  const displayPosition = useMemo(() => {
    if (displayMidi === null || displayMidi === undefined) return null;
    return getNoteStaffPosition(displayMidi, clef);
  }, [displayMidi, clef]);

  const wrongPosition = useMemo(() => {
    if (wrongMidi === null || wrongMidi === undefined) return null;
    return getNoteStaffPosition(wrongMidi, clef);
  }, [wrongMidi, clef]);

  // Blink-Animation für falsche Note
  // (würde via useEffect getriggert werden – hier vorbereitet)
  const noteColor = displayColor ?? theme.text;

  const handlePress = useCallback(
    (y: number) => {
      if (!interactive || !onPositionSelect) return;
      // Importiere getPositionFromY lazy (vermeide circular dependency)
      import('./staff-geometry').then(({ getPositionFromY }) => {
        const pos = getPositionFromY(y, topY, clef);
        if (pos) onPositionSelect(pos);
      });
    },
    [interactive, onPositionSelect, clef],
  );

  return (
    <View style={styles.container}>
      <AnimatedPressable
        disabled={!interactive}
        onPressIn={(e) => handlePress(e.nativeEvent.locationY)}
        style={styles.touchLayer}
      >
        <StaffCanvasInner
          clef={clef}
          displayPosition={displayPosition}
          displayColor={noteColor}
          wrongPosition={wrongPosition}
          topY={topY}
          width={width}
          staffLineColor={theme.text}
          clefColor={theme.textSecondary}
          noteColor={noteColor}
        />
      </AnimatedPressable>
      {/* Reanimated-SharedValues werden später für Blink/Fade-In genutzt */}
      {showFeedback ? <View /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchLayer: {
    width: '100%',
  },
});