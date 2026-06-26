import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type Segment<T extends string> = {
  label: string;
  value: T;
  icon?: string;
};

type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Optional accessibility label */
  accessibilityLabel?: string;
};

const INDICATOR_DURATION_MS = 280;

export function SegmentedControl<T extends string>({
  segments,
  value,
  onValueChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 380;

  const activeIndex = Math.max(
    0,
    segments.findIndex((s) => s.value === value),
  );

  const [containerWidth, setContainerWidth] = useState(0);

  // Deklarativ abgeleitete Werte — keine imperativen SharedValue-Zuweisungen
  const segmentWidth = useDerivedValue(
    () =>
      containerWidth > 0
        ? (containerWidth - Spacing.half * 2) / segments.length
        : 0,
    [containerWidth, segments.length],
  );

  const indicatorOffset = useDerivedValue(
    () =>
      withTiming(segmentWidth.value * activeIndex, {
        duration: INDICATOR_DURATION_MS,
      }),
    [segmentWidth, activeIndex],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorOffset.value }],
    width: segmentWidth.value,
  }));

  function handleSelect(index: number) {
    onValueChange(segments[index].value);
  }

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement },
        isCompact && styles.containerCompact,
      ]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: theme.background },
          indicatorStyle,
        ]}
      />

      {/* Segments */}
      {segments.map((segment, index) => {
        const isActive = index === activeIndex;
        return (
          <Pressable
            key={segment.value}
            onPress={() => handleSelect(index)}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <ThemedText
              type="smallBold"
              style={[
                styles.segmentLabel,
                isActive && styles.segmentActive,
                isCompact && styles.segmentLabelCompact,
              ]}
              numberOfLines={1}
            >
              {segment.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 14,
    padding: Spacing.half,
    position: "relative",
    alignItems: "center",
  },
  containerCompact: {
    borderRadius: 12,
    padding: 2,
  },
  indicator: {
    position: "absolute",
    top: Spacing.half,
    bottom: Spacing.half,
    left: Spacing.half,
    borderRadius: 12,
    // Subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  segmentLabel: {
    opacity: 0.7,
  },
  segmentLabelCompact: {
    fontSize: 13,
  },
  segmentActive: {
    opacity: 1,
  },
});
