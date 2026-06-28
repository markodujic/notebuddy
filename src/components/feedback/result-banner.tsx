/**
 * ResultBanner – Feedback-Overlay für Bewertungs-Ergebnisse.
 *
 * Zeigt ein animiertes Banner mit ✓ (grün) oder ✗ (rot)
 * sowie einer Nachricht an.
 */

import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

export interface ResultBannerProps {
  /** Angezeigt? */
  visible: boolean;
  /** Korrekt oder falsch? */
  correct: boolean;
  /** Nachricht (z.B. "Richtig!" oder "Das ist die richtige Note"). */
  message?: string;
  /** Optional: Zweite Zeile. */
  detail?: string;
  /** Bei Tap schließen (auto-advance). */
  onDismiss?: () => void;
}

export const ResultBanner = memo(function ResultBanner({
  visible,
  correct,
  message,
  detail,
  onDismiss,
}: ResultBannerProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      );
      scale.value = withSequence(
        withTiming(1.05, { duration: 150 }),
        withTiming(1, { duration: 100 }),
      );
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.8, { duration: 150 });
    }
  }, [visible, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const bgColor = correct ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)';
  const icon = correct ? '✓' : '✗';
  const defaultMessage = correct ? 'Richtig!' : 'Falsch';

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.banner,
          { backgroundColor: bgColor },
          animatedStyle,
        ]}
      >
        <Pressable
          onPress={() => {
            if (onDismiss) runOnJS(onDismiss)();
          }}
          style={styles.content}
        >
          <ThemedText type="title" style={styles.icon}>{icon}</ThemedText>
          <ThemedText type="subtitle" style={styles.message}>
            {message ?? defaultMessage}
          </ThemedText>
          {detail ? (
            <ThemedText type="small" style={styles.detail}>
              {detail}
            </ThemedText>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  banner: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 24,
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '700',
  },
  message: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  detail: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
});