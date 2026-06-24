import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PianoKeyboard, type KeyboardZoomMode, type PianoKey } from '@/components/piano-keyboard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
      state: 'idle',
    });
  }
  return keys;
}

export default function KeyboardModeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [zoomMode, setZoomMode] = useState<KeyboardZoomMode>('overview');
  const [highlightMidi, setHighlightMidi] = useState<number | null>(64);

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four,
    },
  });

  const keys = useMemo(() => {
    return buildDemoKeys().map((key) => ({
      ...key,
      state:
        key.midi === highlightMidi
          ? 'current'
          : zoomMode === 'focus' && key.midi >= 60 && key.midi <= 72
            ? 'focused'
            : 'idle',
    }));
  }, [highlightMidi, zoomMode]);

  const focusRange: [number, number] = zoomMode === 'overview' ? [21, 108] : zoomMode === 'focus' ? [48, 72] : [60, 64];

  const title = width < 420 ? 'Keyboard' : 'Klaviatur-Modus';

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            Drückbare Klaviatur mit Farbzuständen und steuerbarem Zoom für mobile Nutzung.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.keyboardCard}>
          <PianoKeyboard
            keys={keys}
            focusRange={focusRange}
            zoomMode={zoomMode}
            interactive
            onZoomModeChange={setZoomMode}
            onKeyPress={(key) => {
              setHighlightMidi(key.midi);
              setZoomMode(key.isBlack ? 'detail' : 'focus');
            }}
          />
        </ThemedView>

        <ThemedView style={styles.controlsCard}>
          <ThemedText type="defaultSemiBold">Steuerung</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.controlHint}>
            Tippe auf eine Taste, um sie hervorzuheben. Wechsle den Zoomzustand direkt über die Chips.
          </ThemedText>

          <Pressable onPress={() => setZoomMode('overview')} style={styles.actionButton}>
            <ThemedText type="defaultSemiBold">Alle 88 Tasten</ThemedText>
          </Pressable>
          <Pressable onPress={() => setZoomMode('focus')} style={styles.actionButton}>
            <ThemedText type="defaultSemiBold">Fokusbereich</ThemedText>
          </Pressable>
          <Pressable onPress={() => setZoomMode('detail')} style={styles.actionButton}>
            <ThemedText type="defaultSemiBold">Detailansicht</ThemedText>
          </Pressable>
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
    width: '100%',
    alignItems: 'center',
  },
  container: {
    width: '100%',
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
  centerText: {
    maxWidth: 620,
  },
  keyboardCard: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  controlsCard: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  controlHint: {
    lineHeight: 20,
  },
  actionButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
});