/**
 * RangeSelector – 1:1-Portierung von `ui/controls/RangeSelector.svelte` (notenlern-app).
 *
 * Mini-Keyboard A0–C8 (88 Tasten). Tippen links der Mitte → Min-Grenze,
 * rechts → Max-Grenze. Ziehen über die Tasten verschiebt die jeweilige
 * Grenze. Anzeige „Von/Bis" mit deutschem Notennamen + MIDI.
 */

import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getNotation } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

const KEYBOARD_START = 21; // A0
const KEYBOARD_END = 108; // C8
const KEY_COUNT = KEYBOARD_END - KEYBOARD_START + 1;

export type RangeSelectorProps = {
  minMidi: number;
  maxMidi: number;
  onChange: (minMidi: number, maxMidi: number) => void;
};

export function RangeSelector({ minMidi, maxMidi, onChange }: RangeSelectorProps) {
  const theme = useTheme();
  const notation = getNotation('german');
  const containerWidth = useRef(0);
  const draggingRef = useRef<'min' | 'max' | null>(null);

  const [dragging, setDragging] = useState(false);

  const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);
  const inRange = (midi: number) => midi >= minMidi && midi <= maxMidi;

  const midiFromX = (x: number) => {
    const keyW = containerWidth.current / KEY_COUNT;
    const midi = KEYBOARD_START + Math.floor(x / keyW);
    return Math.max(KEYBOARD_START, Math.min(KEYBOARD_END, midi));
  };

  const handleDragAt = (x: number) => {
    const midi = midiFromX(x);
    if (draggingRef.current === 'min') {
      onChange(Math.min(midi, maxMidi - 1), maxMidi);
    } else if (draggingRef.current === 'max') {
      onChange(minMidi, Math.max(midi, minMidi + 1));
    }
  };

  const handleTouchStart = (x: number) => {
    const midi = midiFromX(x);
    const middle = (minMidi + maxMidi) / 2;
    draggingRef.current = midi < middle ? 'min' : 'max';
    setDragging(true);
    handleDragAt(x);
  };

  const handleTouchEnd = () => {
    draggingRef.current = null;
    setDragging(false);
  };

  const keys = [];
  for (let midi = KEYBOARD_START; midi <= KEYBOARD_END; midi++) {
    const black = isBlack(midi);
    const boundary = midi === minMidi || midi === maxMidi;
    keys.push(
      <View
        key={midi}
        style={[
          styles.key,
          black ? styles.keyBlack : styles.keyWhite,
          inRange(midi) && (black ? styles.keyBlackInRange : styles.keyWhiteInRange),
          boundary && styles.keyBoundary,
          midi === minMidi && styles.keyMinBoundary,
          midi === maxMidi && styles.keyMaxBoundary,
        ]}
      >
        {boundary ? (
          <Text style={styles.marker}>{midi === minMidi ? '◀' : '▶'}</Text>
        ) : null}
      </View>,
    );
  }

  return (
    <View style={styles.rangeSelector}>
      <View style={[styles.rangeInfo, { backgroundColor: theme.bgSurfaceAlt }]}>
        <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
          <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>Von: </Text>
          {notation.midiToDisplay(minMidi)} (MIDI {minMidi})
        </Text>
        <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
          <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>Bis: </Text>
          {notation.midiToDisplay(maxMidi)} (MIDI {maxMidi})
        </Text>
      </View>

      <View
        style={[styles.keyboardContainer, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
        onLayout={(e) => {
          containerWidth.current = e.nativeEvent.layout.width - 20; // Padding abziehen
        }}
        onTouchStart={(e) => handleTouchStart(e.nativeEvent.locationX - 10)}
        onTouchMove={(e) => {
          if (dragging) handleDragAt(e.nativeEvent.locationX - 10);
        }}
        onTouchEnd={handleTouchEnd}
      >
        <View style={styles.keyboard}>{keys}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rangeSelector: {
    width: '100%',
  },
  rangeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
  },
  rangeLabel: {
    fontSize: 13,
  },
  keyboardContainer: {
    marginBottom: 8,
    borderWidth: 2,
    borderRadius: 8,
    padding: 10,
  },
  keyboard: {
    flexDirection: 'row',
    width: '100%',
    height: 80,
    position: 'relative',
  },
  key: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 3,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 3,
  },
  keyWhite: {
    height: '100%',
  },
  keyBlack: {
    height: '60%',
    zIndex: 2,
    alignSelf: 'flex-start',
  },
  keyWhiteInRange: {
    backgroundColor: '#e3f2fd',
  },
  keyBlackInRange: {
    backgroundColor: '#1976d2',
  },
  keyBoundary: {
    borderWidth: 3,
    borderColor: '#4a90e2',
  },
  keyMinBoundary: {
    backgroundColor: '#4caf50',
  },
  keyMaxBoundary: {
    backgroundColor: '#ff9800',
  },
  marker: {
    fontSize: 10,
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});