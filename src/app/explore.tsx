import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PianoKeyboard,
  type KeyboardZoomMode,
  type PianoKey,
} from "@/components/piano-keyboard";
import { SegmentedControl, type Segment } from "@/components/segmented-control";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

function buildDemoKeys() {
  const keys: PianoKey[] = [];
  for (let midi = 21; midi <= 108; midi += 1) {
    const mod = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(mod);
    const note = `M${midi}`;
    keys.push({
      midi,
      note,
      isBlack,
      state: "idle",
    });
  }
  return keys;
}

const zoomSegments: Segment<KeyboardZoomMode>[] = [
  { label: "Alle", value: "overview" },
  { label: "Fokus", value: "focus" },
  { label: "Detail", value: "detail" },
];

export default function KeyboardModeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [zoomMode, setZoomMode] = useState<KeyboardZoomMode>("overview");
  const [highlightMidi, setHighlightMidi] = useState<number | null>(64);

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const keys = useMemo(() => {
    return buildDemoKeys().map((key) => ({
      ...key,
      state:
        key.midi === highlightMidi ? ("current" as const) : ("idle" as const),
    }));
  }, [highlightMidi]);

  const focusRange: [number, number] =
    zoomMode === "overview"
      ? [21, 108]
      : zoomMode === "focus"
        ? [48, 72]
        : [60, 64];

  const isCompact = width < 420;
  const title = isCompact ? "Keyboard" : "Klaviatur-Modus";

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <ThemedView style={styles.container}>
        {/* Kompakter Header */}
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitleText}>
            Drückbare Klaviatur mit Farbzuständen und steuerbarem Zoom.
          </ThemedText>
        </ThemedView>

        {/* Klaviatur — bekommt maximalen Raum */}
        <ThemedView style={styles.keyboardCard}>
          <PianoKeyboard
            keys={keys}
            focusRange={focusRange}
            zoomMode={zoomMode}
            interactive
            onZoomModeChange={setZoomMode}
            onKeyPress={(key) => {
              setHighlightMidi(key.midi);
              setZoomMode(key.isBlack ? "detail" : "focus");
            }}
          />
        </ThemedView>

        {/* Steuerleiste — Segmented Control + kompakter Hinweis */}
        <ThemedView style={styles.controlBar}>
          <SegmentedControl
            segments={zoomSegments}
            value={zoomMode}
            onValueChange={setZoomMode}
            accessibilityLabel="Zoom-Modus der Klaviatur"
          />
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.controlHint}
          >
            Tippe auf eine Taste, um sie hervorzuheben. Wechsle den Zoom über
            die Segmente.
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    width: "100%",
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    flexShrink: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  titleContainer: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  subtitleText: {
    maxWidth: 620,
    lineHeight: 20,
  },
  keyboardCard: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  controlBar: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  controlHint: {
    lineHeight: 18,
    textAlign: "center",
    opacity: 0.8,
  },
});
