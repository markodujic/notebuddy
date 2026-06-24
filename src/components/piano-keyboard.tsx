import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
const KEYBOARD_ZOOM_DURATION_MS = 900;
const VIEWPORT_PADDING = 12;

function isBlackMidi(midi: number) {
  return [1, 3, 6, 8, 10].includes(midi % 12);
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

function resolveKeyFill(key: PianoKey, isBlackKey: boolean) {
  const state = key.state ?? 'idle';

  if (isBlackKey) {
    if (state === 'correct') return '#16a34a';
    if (state === 'wrong') return '#dc2626';
    if (state === 'current') return '#eab308';
    if (state === 'focused') return '#a855f7';
    return '#1f1f28';
  }

  if (state === 'correct') return '#22c55e';
  if (state === 'wrong') return '#ef4444';
  if (state === 'current') return '#facc15';
  if (state === 'focused') return '#c084fc';
  return '#f8f7f4';
}

function getBlackLeft(visibleWhiteKeys: PianoKey[], keyWidth: number, key: PianoKey) {
  const whiteIndex = visibleWhiteKeys.findIndex((white) => white.midi > key.midi) - 1;
  return Math.max(0, whiteIndex) * keyWidth + keyWidth * 0.64;
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
  const isPortrait = width < 520;
  const isCompact = width < 420;
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const keyboardKeys = useMemo(() => keys ?? makeDefaultKeys(), [keys]);
  const whiteKeys = useMemo(
    () => keyboardKeys.filter((key) => !key.isBlack),
    [keyboardKeys],
  );
  const blackKeys = useMemo(
    () => keyboardKeys.filter((key) => key.isBlack),
    [keyboardKeys],
  );

  const viewportWidth = layout.width || width;
  const viewportHeight = layout.height || 0;

  const naturalWhiteKeyWidth = isPortrait ? 16 : 24;
  const whiteKeyCount = Math.max(1, whiteKeys.length);
  const naturalKeyboardWidth = whiteKeyCount * naturalWhiteKeyWidth;
  const overviewScale = Math.min(1, viewportWidth / Math.max(naturalKeyboardWidth, 1));
  const focusScale = Math.min(2, overviewScale * 2.2);
  const pianoHeight = isPortrait ? 124 : isCompact ? 132 : 176;
  const keyWidth = naturalWhiteKeyWidth;
  const blackKeyWidth = keyWidth * 0.58;
  const blackKeyHeight = pianoHeight * 0.62;

  const zoomProgress = useSharedValue(zoomMode === 'focus' ? 1 : 0);
  const focusOffset = useSharedValue(0);

  const keyboardWidth = naturalKeyboardWidth;

  const focusCenter = useMemo(() => {
    if (!focusRange) return naturalKeyboardWidth / 2;
    const [min, max] = focusRange;
    const whiteBefore = whiteKeys.filter((key) => key.midi < min).length;
    const whiteInFocus = whiteKeys.filter(
      (key) => !key.isBlack && key.midi >= min && key.midi <= max,
    ).length;
    return (whiteBefore + Math.max(1, whiteInFocus) / 2) * naturalWhiteKeyWidth;
  }, [focusRange, naturalKeyboardWidth, naturalWhiteKeyWidth, whiteKeys]);

  useEffect(() => {
    const nextProgress = zoomMode === 'focus' ? 1 : 0;
    zoomProgress.value = withTiming(nextProgress, {
      duration: KEYBOARD_ZOOM_DURATION_MS,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
    });

    const centeredOffset = viewportWidth / 2 - focusCenter * focusScale;
    const scaledKeyboardWidth = keyboardWidth * focusScale;
    const minOffset = Math.min(0, viewportWidth - scaledKeyboardWidth);
    const maxOffset = 0;
    const clampedOffset = Math.max(minOffset, Math.min(maxOffset, centeredOffset));

    focusOffset.value = withTiming(zoomMode === 'focus' ? clampedOffset : 0, {
      duration: KEYBOARD_ZOOM_DURATION_MS,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
    });
  }, [focusCenter, keyboardWidth, viewportWidth, zoomMode, focusOffset, zoomProgress]);

  const cameraStyle = useAnimatedStyle(() => {
    const scale = overviewScale + zoomProgress.value * (focusScale - overviewScale);
    const centerShift = (viewportWidth - keyboardWidth * scale) / 2;
    return {
      transform: [{ translateX: centerShift + focusOffset.value }, { scale }],
    };
  });

  function handleLayout(e: LayoutChangeEvent) {
    setLayout({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  }

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
        {zoomMode === 'overview' ? '88 Tasten' : zoomMode === 'focus' ? 'Fokusbereich' : 'Detail'}
      </ThemedText>

      <View
        onLayout={handleLayout}
        style={[
          styles.keyboardViewport,
          {
            height: Math.max(pianoHeight + VIEWPORT_PADDING * 2, viewportHeight || pianoHeight),
            paddingHorizontal: VIEWPORT_PADDING,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.keyboardCamera,
            { width: keyboardWidth, height: pianoHeight },
            cameraStyle,
          ]}
        >
          <Canvas style={{ width: keyboardWidth, height: pianoHeight }}>
            {whiteKeys.map((key, index) => (
              <Group key={key.midi}>
                <Rect
                  x={index * keyWidth}
                  y={0}
                  width={keyWidth}
                  height={pianoHeight}
                  color={resolveKeyFill(key, false)}
                />
                <Rect
                  x={index * keyWidth}
                  y={0}
                  width={keyWidth}
                  height={pianoHeight}
                  color="rgba(0,0,0,0.2)"
                  style="stroke"
                  strokeWidth={1}
                />
              </Group>
            ))}

            {blackKeys.map((key) => {
              const x = getBlackLeft(whiteKeys, keyWidth, key);
              return (
                <Group key={key.midi}>
                  <Rect
                    x={x}
                    y={0}
                    width={blackKeyWidth}
                    height={blackKeyHeight}
                    color={resolveKeyFill(key, true)}
                  />
                </Group>
              );
            })}
          </Canvas>

          {whiteKeys.map((key, index) => (
            <Pressable
              key={key.midi}
              disabled={!interactive}
              onPress={() => onKeyPress?.(key)}
              style={({ pressed }: { pressed: boolean }) => [
                styles.hitKey,
                {
                  left: index * keyWidth,
                  width: keyWidth,
                  height: pianoHeight,
                },
                pressed && styles.keyPressed,
              ]}
            />
          ))}

          {blackKeys.map((key) => {
            const x = getBlackLeft(whiteKeys, keyWidth, key);
            return (
              <Pressable
                key={key.midi}
                disabled={!interactive}
                onPress={() => onKeyPress?.(key)}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.hitKey,
                  {
                    left: x,
                    width: blackKeyWidth,
                    height: blackKeyHeight,
                  },
                  styles.blackHitKey,
                  pressed && styles.keyPressed,
                ]}
              />
            );
          })}
        </Animated.View>
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
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  keyboardCamera: {
    position: 'relative',
  },
  hitKey: {
    position: 'absolute',
    top: 0,
    zIndex: 3,
    backgroundColor: 'transparent',
  },
  blackHitKey: {
    zIndex: 4,
  },
  keyPressed: {
    transform: [{ translateY: 2 }],
    opacity: 0.9,
  },
});