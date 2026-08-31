import { memo } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "@/hooks/use-theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type BaseButtonProps = PressableProps & {
  /** Hintergrundfarbe (Default: Akzentfarbe des Themes). */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Standard-Button der App: themed, mit nativem Press-Scale-Feedback
 * (Reanimated, UI-Thread – keine JS-Beteiligung pro Frame).
 */
export const BaseButton = memo(function BaseButton({
  backgroundColor,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: BaseButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withTiming(0.96, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 140 });
        onPressOut?.(e);
      }}
      style={[
        {
          backgroundColor: backgroundColor ?? theme.accentBlue,
          borderRadius: 10,
          paddingHorizontal: 20,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
        },
        animated,
        style,
      ]}
    />
  );
});
