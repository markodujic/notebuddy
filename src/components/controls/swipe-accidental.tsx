/**
 * SwipeAccidental – Wisch-Geste für Vorzeichen (♯/♭).
 *
 * Wischen nach oben (>20px) → ♯ (sharp)
 * Wischen nach unten (<-20px) → ♭ (flat)
 *
 * Zeigt einen Live-Indikator während des Wischens.
 */

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

export type AccidentalType = '' | '#' | 'b';

export interface SwipeAccidentalProps {
  /** Aktuelles Vorzeichen. */
  value: AccidentalType;
  /** Callback bei Änderung. */
  onChange: (value: AccidentalType) => void;
  /** Beschriftung (z.B. Notenname). */
  label?: string;
}

const SWIPE_THRESHOLD = 20;

export const SwipeAccidental = memo(function SwipeAccidental({
  value,
  onChange,
  label,
}: SwipeAccidentalProps) {
  const startY = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isActive = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      startY.value = e.absoluteY;
      isActive.value = true;
    })
    .onUpdate((e) => {
      translateY.value = e.absoluteY - startY.value;
    })
    .onEnd((e) => {
      const delta = e.absoluteY - startY.value;
      isActive.value = false;
      translateY.value = withTiming(0, { duration: 200 });

      if (delta < -SWIPE_THRESHOLD) {
        // Hoch → Sharp
        runOnJSOnChange(onChange, '#');
      } else if (delta > SWIPE_THRESHOLD) {
        // Runter → Flat
        runOnJSOnChange(onChange, 'b');
      }
    });

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: isActive.value ? 1 : 0,
  }));

  const symbol = value === '#' ? '♯' : value === 'b' ? '♭' : '';

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* Live-Indikator während des Wischens */}
        <Animated.View
          style={[styles.indicator, indicatorStyle]}
          pointerEvents="none"
        >
          <ThemedText type="small" style={styles.indicatorText}>
            {translateY.value < -SWIPE_THRESHOLD ? '♯' : translateY.value > SWIPE_THRESHOLD ? '♭' : ''}
          </ThemedText>
        </Animated.View>

        {/* Aktuelles Vorzeichen */}
        <View style={styles.content}>
          {symbol ? (
            <ThemedText type="title" style={styles.symbol}>{symbol}</ThemedText>
          ) : (
            <ThemedText type="small" style={styles.hint}>Wischen für ♯/♭</ThemedText>
          )}
          {label ? (
            <ThemedText type="small" style={styles.label}>{label}</ThemedText>
          ) : null}
        </View>
      </View>
    </GestureDetector>
  );
});

// Helper: Reanimated runOnJS ohne Import-Zirkel
function runOnJSOnChange(fn: (v: AccidentalType) => void, v: AccidentalType) {
  fn(v);
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    minWidth: 80,
    minHeight: 60,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  indicatorText: {
    fontSize: 24,
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    gap: 4,
  },
  symbol: {
    fontSize: 36,
    fontWeight: '700',
  },
  hint: {
    opacity: 0.5,
  },
  label: {
    opacity: 0.7,
  },
});