/**
 * ErrorStats – 1:1-Portierung von `ui/feedback/ErrorStats.svelte` (notenlern-app).
 *
 * „🎯 Noten zum Üben": Top-10 der Fehlernoten einer Session mit
 * Fehler-Balken (orange→rot), Rang und Notennamen (Helmholtz + German).
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getNotation, type Weighting } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

export type ErrorStatsProps = {
  weighting: Weighting | null;
  show: boolean;
};

export function ErrorStats({ weighting, show }: ErrorStatsProps) {
  const theme = useTheme();
  const notation = getNotation('german');

  const errorNotes = useMemo(() => {
    if (!weighting) return [];
    return weighting
      .getAllEntries()
      .filter((entry) => entry.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);
  }, [weighting]);

  if (!show || errorNotes.length === 0) return null;

  return (
    <View
      style={[
        styles.errorStats,
        { backgroundColor: theme.cardBg, shadowColor: '#000', shadowOpacity: 0.1 },
      ]}
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>🎯 Noten zum Üben</Text>
      <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
        Diese Noten solltest du noch üben:
      </Text>

      <View style={styles.notesList}>
        {errorNotes.map((item, index) => (
          <View
            key={item.midi}
            style={[styles.noteItem, { backgroundColor: theme.bgSurfaceAlt }]}
          >
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text style={[styles.noteName, { color: theme.textPrimary }]}>
              {notation.helmholtzFor(item.midi)}
            </Text>
            <Text style={[styles.germanName, { color: theme.textTertiary }]}>
              {notation.midiToDisplay(item.midi)}
            </Text>
            <View style={[styles.errorBar, { backgroundColor: theme.progressBg }]}>
              <View
                style={[styles.barFill, { width: `${Math.min(100, item.errorCount * 10)}%` }]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  errorStats: {
    marginVertical: 20,
    padding: 20,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    margin: 0,
    marginBottom: 5,
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    margin: 0,
    marginBottom: 15,
    fontSize: 14,
  },
  notesList: {
    gap: 10,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 12,
    borderRadius: 8,
  },
  rank: {
    width: 36,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
    textAlign: 'center',
  },
  noteName: {
    width: 70,
    fontSize: 24,
    fontWeight: 'bold',
  },
  germanName: {
    flex: 1,
    fontSize: 14,
  },
  errorBar: {
    width: 100,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#f4503a',
  },
});
