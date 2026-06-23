import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type ModeCardProps = {
  title: string;
  description: string;
  icon: string;
  accent: string;
  onPress?: () => void;
};

export function ModeCard({ title, description, icon, accent, onPress }: ModeCardProps) {
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <ThemedView style={[styles.card, compact && styles.cardCompact, { borderColor: accent }]}> 
        <View style={[styles.iconBubble, compact && styles.iconBubbleCompact, { backgroundColor: accent }]}>
          <ThemedText type="defaultSemiBold" style={styles.icon}>
            {icon}
          </ThemedText>
        </View>
        <View style={styles.textWrap}>
          <ThemedText type="subtitle" style={[styles.title, compact && styles.titleCompact]}>
            {title}
          </ThemedText>
          <ThemedText type="default" style={[styles.description, compact && styles.descriptionCompact]}>
            {description}
          </ThemedText>
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 92,
  },
  cardCompact: {
    padding: 14,
    gap: 12,
    minHeight: 84,
  },
  iconBubble: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleCompact: {
    width: 46,
    height: 46,
    borderRadius: 16,
  },
  icon: {
    color: '#fff',
    fontSize: 22,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
  },
  titleCompact: {
    fontSize: 16,
  },
  description: {
    opacity: 0.78,
    lineHeight: 20,
  },
  descriptionCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
});