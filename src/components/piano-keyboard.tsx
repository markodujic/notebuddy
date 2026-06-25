import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
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
/** Real piano white-key ratio: height / width ≈ 6 */
const KEY_ASPECT_RATIO = 6;

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

function resolveKeyFill(key: PianoKey, isBlackKey: boolean, dimmed: boolean) {
  const state = key.state ?? 'idle';

  // Active feedback states always win, even outside the focus range
  if (state === 'correct') return isBlackKey ? '#16a34a' : '#22c55e';
  if (state === 'wrong') return isBlackKey ? '#dc2626' : '#ef4444';
  if (state === 'current') return isBlackKey ? '#eab308' : '#facc15';

  // Keys outside the focus range are greyed out
  if (dimmed) return isBlackKey ? '#4a4a55' : '#c8c8cc';

  // Normal idle fill
  return isBlackKey ? '#1f1f28' : '#f8f7f4';
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
  const [viewportWidth, setViewportWidth] = useState(0);
  const isFirstLayout = useRef(true);

  const keyboardKeys = useMemo(() => keys ?? makeDefaultKeys(), [keys]);
  const whiteKeys = useMemo(
    () => keyboardKeys.filter((key) => !key.isBlack),
    [keyboardKeys],
  );
  const blackKeys = useMemo(
    () => keyboardKeys.filter((key) => key.isBlack),
    [keyboardKeys],
  );

  // Natural key width — height is derived from the aspect ratio so keys
  // always have real piano proportions.
  const naturalWhiteKeyWidth = isPortrait ? 16 : 24;
  const whiteKeyCount = Math.max(1, whiteKeys.length);
  const naturalKeyboardWidth = whiteKeyCount * naturalWhiteKeyWidth;
  const keyboardWidth = naturalKeyboardWidth;
  const pianoHeight = naturalWhiteKeyWidth * KEY_ASPECT_RATIO;
  const blackKeyHeight = pianoHeight * 0.62;

  // Whether a key lies outside the active focus range (→ greyed out)
  const isDimmed = (midi: number) =>
    zoomMode !== 'overview' && focusRange
      ? !(midi >= focusRange[0] && midi <= focusRange[1])
      : false;

  // ── Three-stage scale system ──────────────────────────────────────────
  const overviewScale =
    viewportWidth > 0 ? Math.min(1, viewportWidth / naturalKeyboardWidth) : 0;
  const focusScale = Math.min(3, overviewScale * 2.5);
  const detailScale = Math.min(6, overviewScale * 4.5);

  const keyWidth = naturalWhiteKeyWidth;
  const blackKeyWidth = keyWidth * 0.58;

  // Focus center in natural coordinates (used for pan offset)
  const focusCenter = useMemo(() => {
    if (!focusRange) return naturalKeyboardWidth / 2;
    const [min, max] = focusRange;
    const whiteBefore = whiteKeys.filter((key) => key.midi < min).length;
    const whiteInFocus = whiteKeys.filter(
      (key) => !key.isBlack && key.midi >= min && key.midi <= max,
    ).length;
    return (whiteBefore + Math.max(1, whiteInFocus) / 2) * naturalWhiteKeyWidth;
  }, [focusRange, naturalKeyboardWidth, naturalWhiteKeyWidth, whiteKeys]);

  // Resolve the target scale for the current zoom mode
  const targetScale =
    zoomMode === 'detail'
      ? detailScale
      : zoomMode === 'focus'
        ? focusScale
        : overviewScale;

  const scaleSv = useSharedValue(targetScale);
  const offsetX = useSharedValue(0);

  useEffect(() => {
    if (viewportWidth <= 0) return;

    const scaledWidth = keyboardWidth * targetScale;
    let targetOffset: number;

    if (zoomMode === 'overview') {
      targetOffset = (viewportWidth - scaledWidth) / 2;
    } else {
      const rawOffset = viewportWidth / 2 - focusCenter * targetScale;
      const minOffset = Math.min(0, viewportWidth - scaledWidth);
      const maxOffset = Math.max(0, (viewportWidth - scaledWidth) / 2);
      targetOffset = Math.max(minOffset, Math.min(maxOffset, rawOffset));
    }

    const animationConfig = {
      duration: KEYBOARD_ZOOM_DURATION_MS,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
    };

    if (isFirstLayout.current) {
      isFirstLayout.current = false;
      scaleSv.value = targetScale;
      offsetX.value = targetOffset;
    } else {
      scaleSv.value = withTiming(targetScale, animationConfig);
      offsetX.value = withTiming(targetOffset, animationConfig);
    }
  }, [targetScale, zoomMode, viewportWidth, keyboardWidth, focusCenter, scaleSv, offsetX]);

  // Uniform scale preserves real piano-key proportions at every zoom level.
  // transformOrigin "left top" anchors at the top-left corner.
  const cameraStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { scale: scaleSv.value }],
  }));

  // The viewport height grows with the scale so the full key height is
  // always visible — no clipping, proportions stay correct.
  const viewportStyle = useAnimatedStyle(() => ({
    height: pianoHeight * scaleSv.value + VIEWPORT_PADDING * 2,
  }));

  function handleLayout(e: LayoutChangeEvent) {
    setViewportWidth(e.nativeEvent.layout.width);
  }

  return (
    <ThemedView style={styles.shell}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold">Klaviatur</ThemedText>
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
        {zoomMode === 'overview'
          ? '88 Tasten'
          : zoomMode === 'focus'
            ? 'Fokusbereich'
            : 'Detail'}
      </ThemedText>

      <Animated.View onLayout={handleLayout} style={[styles.keyboardViewport, viewportStyle]}>
        <Animated.View
          style={[
            styles.keyboardCamera,
            {
              width: keyboardWidth,
              height: pianoHeight,
              top: VIEWPORT_PADDING,
              transformOrigin: 'left top',
            },
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
                  color={resolveKeyFill(key, false, isDimmed(key.midi))}
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
                    color={resolveKeyFill(key, true, isDimmed(key.midi))}
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
      </Animated.View>
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
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    width: '100%',
    alignSelf: 'stretch',
  },
  keyboardCamera: {
    position: 'absolute',
    left: 0,
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