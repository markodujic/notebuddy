import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModeCard } from '@/components/mode-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const modes = [
  {
    title: 'Noten erkennen',
    description: 'Klaviertaste sehen, Name bestimmen und direkt trainieren.',
    icon: '♪',
    accent: '#7c3aed',
    href: '/explore',
  },
  {
    title: 'Notensystem visualisieren',
    description: 'Positionen im System mental erfassen und sicher anwählen.',
    icon: '🎼',
    accent: '#0ea5e9',
    href: '/explore',
  },
  {
    title: 'Audio',
    description: 'Ton hören, singen oder spielen und die Note direkt prüfen.',
    icon: '🎧',
    accent: '#22c55e',
    href: '/explore',
  },
  {
    title: 'Tonumfang',
    description: 'Deinen sicheren Bereich testen und gezielt erweitern.',
    icon: '⚡',
    accent: '#f59e0b',
    href: '/explore',
  },
  {
    title: 'Erklärmodus',
    description: 'Mit einem geführten Tutorial die Klaviatur verstehen.',
    icon: '📖',
    accent: '#ec4899',
    href: '/explore',
  },
];

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 420;
  const isWide = width >= 700;
  const titleSize = isCompact ? 34 : isWide ? 48 : 42;
  const titleLineHeight = isCompact ? 38 : isWide ? 54 : 46;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, isCompact && styles.safeAreaCompact, isWide && styles.safeAreaWide]}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />

        <ThemedView style={[styles.heroSection, isCompact && styles.heroCompact, isWide && styles.heroWide]} />

        <ThemedView style={[styles.grid, isWide && styles.gridWide]}>
          {modes.map((mode) => (
            <ModeCard
              key={mode.title}
              title={mode.title}
              description={mode.description}
              icon={mode.icon}
              accent={mode.accent}
              onPress={() => router.push(mode.href as never)}
            />
          ))}
        </ThemedView>

        <ThemedView style={[styles.footerCard, isCompact && styles.footerCompact]}>
          <ThemedText type="defaultSemiBold">Bereit zum Loslegen?</ThemedText>
          <ThemedText type="small" style={styles.footerText}>
            Wähle einen Modus oben und starte direkt in die passende Übung.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'stretch',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  safeAreaCompact: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.two,
  },
  safeAreaWide: {
    paddingHorizontal: Spacing.five,
  },
  heroSection: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
  },
  heroCompact: {
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  heroWide: {
    paddingTop: Spacing.six,
  },
  grid: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footerCard: {
    marginTop: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: 6,
  },
  footerCompact: {
    padding: Spacing.three,
  },
  footerText: {
    opacity: 0.72,
  },
  glowOne: {
    position: 'absolute',
    top: -100,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  glowTwo: {
    position: 'absolute',
    top: 220,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
});
