/**
 * EndScreen – 1:1-Portierung des `.end-screen`-Blocks aus `App.svelte`
 * (notenlern-app): „✓ Übung abgeschlossen!", Statistik-Karten
 * (Richtige Antworten, Genauigkeit), ErrorStats und die Buttons
 * „← Zurück" / „Nochmal".
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BaseButton } from '@/components/ui/base-button';

import { ErrorStats } from '@/components/feedback/error-stats';
import { type Weighting } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

export type EndScreenProps = {
  correctCount: number;
  completedCount: number;
  weighting: Weighting | null;
  onBack: () => void;
  onRestart: () => void;
};

export function EndScreen({
  correctCount,
  completedCount,
  weighting,
  onBack,
  onRestart,
}: EndScreenProps) {
  const theme = useTheme();
  const accuracy =
    completedCount > 0 ? ((correctCount / completedCount) * 100).toFixed(0) : '0';

  return (
    <View style={styles.endScreen}>
      <Text style={[styles.heading, { color: theme.textPrimary }]}>
        ✓ Übung abgeschlossen!
      </Text>

      <View style={styles.stats}>
        <View
          style={[
            styles.statItem,
            { backgroundColor: theme.cardBg, shadowColor: '#000', shadowOpacity: 0.1 },
          ]}
        >
          <Text style={[styles.statValue, { color: theme.statValue }]}>
            {correctCount}/{completedCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.statLabel }]}>
            Richtige Antworten
          </Text>
        </View>
        <View
          style={[
            styles.statItem,
            { backgroundColor: theme.cardBg, shadowColor: '#000', shadowOpacity: 0.1 },
          ]}
        >
          <Text style={[styles.statValue, { color: theme.statValue }]}>{accuracy}%</Text>
          <Text style={[styles.statLabel, { color: theme.statLabel }]}>Genauigkeit</Text>
        </View>
      </View>

      <ErrorStats weighting={weighting} show />

      <View style={styles.buttonRow}>
        <BaseButton onPress={onBack} style={[styles.btnSecondary, { backgroundColor: theme.bgHover }]}>
          <Text style={[styles.btnSecondaryText, { color: theme.textPrimary }]}>← Zurück</Text>
        </BaseButton>
        <BaseButton onPress={onRestart} style={styles.btnStart}>
          <Text style={styles.btnStartText}>Nochmal</Text>
        </BaseButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  endScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    minWidth: 140,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  btnStart: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  btnStartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
