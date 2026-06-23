import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type KeyboardZoomMode = 'overview' | 'focus' | 'detail';
export type KeyboardKeyState = 'idle' | 'current' | 'focused' | 'correct' | 'wrong';

export type PianoKey = {
  midi: number;
  note: string;
  isBlack: boolean;
  state?: KeyboardKeyState;
};

type PianoKeyboardProps = {
  keys?: PianoKey[];
  focusRange?: [number, number];
  zoomMode?: KeyboardZoomMode;
  interactive?: boolean;
  onKeyPress?: (key: PianoKey) => void;
  onZoomModeChange?: (mode: KeyboardZoomMode) => void;
};

const DEFAULT_START_MIDI = 21;
const DEFAULT_END_MIDI = 108;

function isBlackMidi(midi: number) {
  const mod = midi % 12;
  return [1, 3, 6, 8, 10].includes(mod);
}

function makeDefaultKeys(): PianoKey[] {
  const result: PianoKey[] = [];
  for (let midi = DEFAULT_START_MIDI; midi <= DEFAULT_END_MIDI; midi += 1) {
    result.push({
      midi,
      note: `M${midi}`,
      isBlack: isBlackMidi(midi),
      state: 'idle',
    });
  }
  return result;
}

export function PianoKeyboard({
  keys,
  focusRange,
  zoomMode = 'overview',
  interactive = true,
  onKeyPress,
  onZoomModeChange,
}: PianoKeyboardProps) {
  const { width } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const viewportWidth = layoutWidth || width;

  const keyboardKeys = useMemo(() => keys ?? makeDefaultKeys(), [keys]);
  const whiteKeys = useMemo(() => keyboardKeys.filter((key) => !key.isBlack), [keyboardKeys]);
  const blackKeys = useMemo(() => keyboardKeys.filter((key) => key.isBlack), [keyboardKeys]);

  const visibleKeys = useMemo(() => {
    if (!focusRange) return keyboardKeys;
    const [min, max] = focusRange;
    return keyboardKeys.filter((key) => key.midi >= min && key.midi <= max);
  }, [focusRange, keyboardKeys]);

  const isCompact = width < 420;
  const pianoHeight = isCompact ? 132 : 176;
  const keyWidth = Math.max(10, Math.min(isCompact ? 18 : 24, viewportWidth / Math.max(7, visibleKeys.filter((key) => !key.isBlack).length)));
  const focusLabel =
    zoomMode === 'overview' ? '88 Tasten' : zoomMode === 'focus' ? 'Fokusbereich' : 'Detail';

  function handleLayout(e: LayoutChangeEvent) {
    setLayoutWidth(e.nativeEvent.layout.width);
  }

  const whiteKeyCount = visibleKeys.filter((key) => !key.isBlack).length;
  const keyboardWidth = Math.max(viewportWidth, whiteKeyCount * keyWidth);

  return (
    <ThemedView style={styles.shell}>
      <View style={styles.headerRow}>
        <ThemedText type="defaultSemiBold">Klaviatur</ThemedText>
        <View style={styles.zoomRow}>
          {(['overview', 'focus', 'detail'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => onZoomModeChange?.(mode)}
              style={[styles.zoomChip, zoomMode === mode && styles.zoomChipActive]}
            >
              <ThemedText type="small" style={styles.zoomChipText}>
                {mode === 'overview' ? 'Alle' : mode === 'focus' ? 'Fokus' : 'Detail'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <ThemedText type="small" style={styles.focusLabel}>
        {focusLabel}
      </ThemedText>

      <View onLayout={handleLayout} style={[styles.keyboardViewport, { minHeight: pianoHeight }]}> 
        <View style={[styles.keyboardTrack, { width: keyboardWidth, height: pianoHeight }]}>
          {whiteKeys.map((key, index) => {
            const state = key.state ?? 'idle';
            return (
              <Pressable
                key={key.midi}
                disabled={!interactive}
                onPress={() => onKeyPress?.(key)}
                style={({ pressed }) => [
                  styles.whiteKey,
                  {
                    left: index * keyWidth,
                    width: keyWidth,
                    height: pianoHeight,
                  },
                  state === 'correct' && styles.keyCorrect,
                  state === 'wrong' && styles.keyWrong,
                  state === 'current' && styles.keyCurrent,
                  state === 'focused' && styles.keyFocused,
                  pressed && styles.keyPressed,
                ]}
              >
                <ThemedText type="small" style={styles.keyLabel}>
                  {key.note}
                </ThemedText>
              </Pressable>
            );
          })}

          {blackKeys.map((key) => {
            const whiteIndex = whiteKeys.findIndex((white) => white.midi > key.midi) - 1;
            const x = Math.max(0, whiteIndex) * keyWidth + keyWidth * 0.64;
            const state = key.state ?? 'idle';
            return (
              <Pressable
                key={key.midi}
                disabled={!interactive}
                onPress={() => onKeyPress?.(key)}
                style={({ pressed }) => [
                  styles.blackKey,
                  {
                    left: x,
                    width: keyWidth * 0.58,
                    height: pianoHeight * 0.6,
                  },
                  state === 'correct' && styles.blackKeyCorrect,
                  state === 'wrong' && styles.blackKeyWrong,
                  state === 'current' && styles.blackKeyCurrent,
                  state === 'focused' && styles.blackKeyFocused,
                  pressed && styles.keyPressed,
                ]}
              >
                <ThemedText type="small" style={styles.blackKeyLabel}>
                  {key.note}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  zoomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  zoomChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  zoomChipActive: {
    backgroundColor: 'rgba(124,58,237,0.24)',
  },
  zoomChipText: {
    opacity: 0.9,
  },
  focusLabel: {
    opacity: 0.7,
  },
  keyboardViewport: {
    overflow: 'hidden',
    borderRadius: 24,
  },
  keyboardTrack: {
    position: 'relative',
  },
  whiteKey: {
    position: 'absolute',
    bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#f8f7f4',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    borderRadius: 8,
    backgroundColor: '#1f1f28',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    zIndex: 2,
  },
  keyPressed: {
    transform: [{ translateY: 2 }],
    opacity: 0.9,
  },
  keyCorrect: {
    backgroundColor: '#22c55e',
  },
  keyWrong: {
    backgroundColor: '#ef4444',
  },
  keyCurrent: {
    backgroundColor: '#facc15',
  },
  keyFocused: {
    backgroundColor: '#c084fc',
  },
  blackKeyCorrect: {
    backgroundColor: '#16a34a',
  },
  blackKeyWrong: {
    backgroundColor: '#dc2626',
  },
  blackKeyCurrent: {
    backgroundColor: '#eab308',
  },
  blackKeyFocused: {
    backgroundColor: '#a855f7',
  },
  keyLabel: {
    fontSize: 10,
    opacity: 0.72,
    marginBottom: 2,
  },
  blackKeyLabel: {
    fontSize: 9,
    opacity: 0.85,
    color: '#fff',
  },
});