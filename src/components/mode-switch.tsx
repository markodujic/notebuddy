/**
 * ModeSwitch – 1:1-Portierung von `ui/controls/ModeSwitch.svelte` (notenlern-app).
 *
 * Fünf Karten: Note→Klavier, Klavier→Note, Notensystem visualisieren
 * (inkl. Clef-Selector 𝄞/𝄢), Erklärmodus, Tonumfang-Finder.
 * Responsiv: ab 600px flexible Kartenreihe, darunter 2-Spalten-Grid
 * ohne Beschreibungen (wie das @media-Query im Original).
 */

import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { type Clef, type ExerciseMode } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

export type ModeSwitchProps = {
  mode: ExerciseMode;
  clef: Clef;
  onChange: (mode: ExerciseMode) => void;
  onClefChange: (clef: Clef) => void;
  onRangeFinderStart: () => void;
};

type ModeId = ExerciseMode | 'range-finder';

const CARD_LAYOUT: Array<{
  id: ModeId;
  icon: string;
  label: string;
  description: string;
  variant?: 'tutorial' | 'range-finder';
}> = [
  {
    id: 'note-to-piano',
    icon: '🎵→🎹',
    label: 'Note → Klavier',
    description: 'Spiele die gezeigte Note',
  },
  {
    id: 'piano-to-note',
    icon: '🎹→🎵',
    label: 'Klavier → Note',
    description: 'Benenne die markierte Taste',
  },
  {
    id: 'visualize',
    icon: '🧠→🎼',
    label: 'Notensystem visualisieren',
    description: 'Stelle dir vor, wo die Note liegt',
  },
  {
    id: 'range-finder',
    icon: '🔍🎹',
    label: 'Tonumfang herausfinden',
    description: 'Finde heraus, welche Noten du sicher beherrschst (𝄞 + 𝄢)',
    variant: 'range-finder',
  },
];

export function ModeSwitch({
  mode,
  clef,
  onChange,
  onClefChange,
  onRangeFinderStart,
}: ModeSwitchProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 600;

  const isActive = (id: ModeId) => (id === 'range-finder' ? false : mode === id);

  const borderColorFor = (card: (typeof CARD_LAYOUT)[number]) => {
    if (isActive(card.id)) {
      if (card.variant === 'tutorial') return '#4a9e4a';
      return theme.accentBlue;
    }
    if (card.variant === 'tutorial') return '#6bb86b';
    if (card.variant === 'range-finder') return '#e8a838';
    return theme.cardBorder;
  };

  const backgroundFor = (card: (typeof CARD_LAYOUT)[number]) => {
    if (isActive(card.id)) {
      if (card.variant === 'tutorial') return '#e8f5e8';
      return theme.accentBlueBg;
    }
    return theme.cardBg;
  };

  const handlePress = (id: ModeId) => {
    if (id === 'range-finder') {
      onRangeFinderStart();
      return;
    }
    onChange(id as ExerciseMode);
  };

  return (
    <View style={[styles.modeSwitch, compact && styles.modeSwitchCompact]}>
      {CARD_LAYOUT.map((card) => (
        <Pressable
          key={card.id}
          onPress={() => handlePress(card.id)}
          style={({ pressed }) => [
            compact ? styles.modeButtonCompact : styles.modeButton,
            {
              backgroundColor: backgroundFor(card),
              borderColor: borderColorFor(card),
              borderWidth: 3,
              borderRadius: 12,
            },
            pressed && styles.modeButtonPressed,
          ]}
        >
          <Text style={compact ? styles.iconCompact : styles.icon}>{card.icon}</Text>
          <Text
            style={[
              compact ? styles.labelCompact : styles.label,
              { color: theme.cardTitle },
            ]}
          >
            {card.label}
          </Text>
          {!compact ? (
            <Text style={[styles.description, { color: theme.cardDesc }]}>
              {card.description}
            </Text>
          ) : null}

          {card.id === 'visualize' ? (
            <View style={compact ? styles.clefSelectorCompact : styles.clefSelector}>
              {(['treble', 'bass'] as Clef[]).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    onClefChange(c);
                    if (mode !== 'visualize') onChange('visualize');
                  }}
                  style={[
                    compact ? styles.clefBtnCompact : styles.clefBtn,
                    {
                      borderColor: clef === c ? theme.accentBlue : theme.border,
                      backgroundColor: clef === c ? theme.accentBlue : theme.cardBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.clefBtnText,
                      { color: clef === c ? '#ffffff' : theme.textTertiary },
                    ]}
                  >
                    {c === 'treble' ? '𝄞 Violin' : '𝄢 Bass'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modeSwitch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 20,
    justifyContent: 'center',
  },
  modeSwitchCompact: {
    gap: 10,
    padding: 10,
  },

  modeButton: {
    flex: 1,
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 150,
    maxWidth: 240,
    minHeight: 180,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  modeButtonCompact: {
    width: '48.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
  },
  modeButtonPressed: {
    opacity: 0.85,
    transform: [{ translateY: -2 }],
  },

  icon: {
    fontSize: 32,
  },
  iconCompact: {
    fontSize: 28,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
  },

  clefSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  clefSelectorCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  clefBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 6,
  },
  clefBtnCompact: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderRadius: 6,
  },
  clefBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
