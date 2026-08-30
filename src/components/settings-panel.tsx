/**
 * SettingsPanel – 1:1-Portierung von `ui/controls/Settings.svelte` (notenlern-app).
 *
 * Felder: Notenschlüssel (𝄞/𝄢), Tonumfang (RangeSelector pro Clef),
 * „Nur Stammtöne" (außer im Visualize-Modus), Anzahl Aufgaben (5–50),
 * Tonumfang-Finder-Antwortzeit (1–10s mit Tier-Emoji).
 * Buttons: „Standardwerte" / „Anwenden".
 */

import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { RangeSelector } from '@/components/range-selector';
import { createRange, type Clef, type Range } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

export type SettingsConfig = {
  clef: Clef;
  trebleRange: Range;
  bassRange: Range;
  exerciseCount: number;
  onlyNaturalNotes: boolean;
  rangeFinderTimeLimit: number;
};

export type SettingsPanelProps = {
  isVisualizationMode: boolean;
  exerciseCount: number;
  clef: Clef;
  onlyNaturalNotes: boolean;
  trebleRange: Range;
  bassRange: Range;
  rangeFinderTimeLimit: number;
  onApply: (config: SettingsConfig) => void;
};

const TIME_LIMIT_LABELS: Record<number, { emoji: string; name: string }> = {
  1: { emoji: '⚡', name: 'Blitz' },
  2: { emoji: '🐆', name: 'Gepard' },
  3: { emoji: '🦌', name: 'Gazelle' },
  4: { emoji: '🐇', name: 'Hase' },
  5: { emoji: '🦊', name: 'Fuchs' },
  6: { emoji: '🐈', name: 'Katze' },
  7: { emoji: '🐕', name: 'Hund' },
  8: { emoji: '🦔', name: 'Igel' },
  9: { emoji: '🐢', name: 'Schildkröte' },
  10: { emoji: '🐌', name: 'Schnecke' },
};

export function SettingsPanel(props: SettingsPanelProps) {
  const theme = useTheme();

  const [selectedClef, setSelectedClef] = useState<'treble' | 'bass'>(
    props.clef === 'bass' ? 'bass' : 'treble',
  );
  const [treble, setTreble] = useState({
    min: props.trebleRange.minMidi,
    max: props.trebleRange.maxMidi,
  });
  const [bass, setBass] = useState({
    min: props.bassRange.minMidi,
    max: props.bassRange.maxMidi,
  });
  const [exerciseCount, setExerciseCount] = useState(String(props.exerciseCount));
  const [onlyNaturalNotes, setOnlyNaturalNotes] = useState(props.onlyNaturalNotes);
  const [timeLimit, setTimeLimit] = useState(props.rangeFinderTimeLimit);

  const timeLimitLabel = TIME_LIMIT_LABELS[timeLimit] ?? TIME_LIMIT_LABELS[4];

  const applySettings = () => {
    const count = Math.max(5, Math.min(50, parseInt(exerciseCount, 10) || 10));
    props.onApply({
      clef: selectedClef,
      trebleRange: createRange(treble.min, treble.max),
      bassRange: createRange(bass.min, bass.max),
      exerciseCount: count,
      onlyNaturalNotes,
      rangeFinderTimeLimit: timeLimit,
    });
  };

  const resetDefaults = () => {
    setExerciseCount('10');
    setTreble({ min: 64, max: 77 });
    setBass({ min: 43, max: 57 });
    setSelectedClef('treble');
    setOnlyNaturalNotes(true);
    setTimeLimit(4);
  };

  const rangeProps =
    selectedClef === 'treble'
      ? { minMidi: treble.min, maxMidi: treble.max, onChange: (min: number, max: number) => setTreble({ min, max }) }
      : { minMidi: bass.min, maxMidi: bass.max, onChange: (min: number, max: number) => setBass({ min, max }) };

  return (
    <View style={styles.settings}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Einstellungen</Text>

      {/* Clef toggle */}
      <View style={styles.settingGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Notenschlüssel</Text>
        <View style={styles.clefToggle}>
          {(['treble', 'bass'] as const).map((c) => (
            <Pressable
              key={c}
              onPress={() => setSelectedClef(c)}
              style={[
                styles.clefBtn,
                {
                  borderColor: selectedClef === c ? theme.accentBlue : theme.border,
                  backgroundColor: selectedClef === c ? theme.accentBlueBg : theme.bgSurfaceAlt,
                },
              ]}
            >
              <Text
                style={[
                  styles.clefBtnText,
                  { color: selectedClef === c ? theme.textHeading : theme.textSecondary },
                ]}
              >
                {c === 'treble' ? '𝄞 Volinschlüssel' : '𝄢 Bassschlüssel'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Range keyboard */}
      <View style={styles.settingGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Tonumfang</Text>
        <RangeSelector {...rangeProps} />
      </View>

      {/* Only natural notes */}
      {!props.isVisualizationMode ? (
        <View style={styles.settingGroup}>
          <Pressable style={styles.checkboxLabel} onPress={() => setOnlyNaturalNotes((v) => !v)}>
            <View
              style={[
                styles.checkbox,
                { borderColor: theme.borderInput, backgroundColor: theme.bgInput },
                onlyNaturalNotes && { backgroundColor: theme.accentBlue, borderColor: theme.accentBlue },
              ]}
            >
              {onlyNaturalNotes ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={[styles.checkboxText, { color: theme.textPrimary }]}>
              Nur Stammtöne (keine schwarzen Tasten)
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Exercise count */}
      <View style={styles.settingGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Anzahl Aufgaben</Text>
        <TextInput
          value={exerciseCount}
          onChangeText={setExerciseCount}
          keyboardType="number-pad"
          style={[
            styles.numberInput,
            { borderColor: theme.borderInput, backgroundColor: theme.bgInput, color: theme.textPrimary },
          ]}
        />
      </View>

      {/* Range finder time limit */}
      <View style={styles.settingGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Tonumfang-Finder: Antwortzeit
        </Text>
        <SimpleSlider min={1} max={10} value={timeLimit} onChange={setTimeLimit} />
        <View
          style={[
            styles.timeLimitDisplay,
            { backgroundColor: theme.bgSurfaceAlt, borderColor: theme.border },
          ]}
        >
          <Text style={styles.timeLimitEmoji}>{timeLimitLabel.emoji}</Text>
          <Text style={[styles.timeLimitValue, { color: theme.textHeading }]}>{timeLimit}s</Text>
          <Text style={[styles.timeLimitName, { color: theme.textTertiary }]}>
            {timeLimitLabel.name}
          </Text>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <Pressable onPress={resetDefaults} style={[styles.btn, { backgroundColor: theme.bgHover }]}>
          <Text style={[styles.btnText, { color: theme.textPrimary }]}>Standardwerte</Text>
        </Pressable>
        <Pressable
          onPress={applySettings}
          style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.accentBlue }]}
        >
          <Text style={[styles.btnText, { color: '#ffffff' }]}>Anwenden</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Minimaler Slider als Ersatz für `<input type="range">`.
 * Gradient rot→orange→grün wie im Original (linear-gradient #e74c3c → #f39c12 → #27ae60).
 */
export function SimpleSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const widthRef = useRef(0);
  const fraction = (value - min) / (max - min);

  const valueFromX = (x: number) => {
    const f = Math.max(0, Math.min(1, x / Math.max(1, widthRef.current)));
    return Math.round(min + f * (max - min));
  };

  return (
    <View
      style={styles.sliderTrackWrapper}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      onTouchStart={(e) => onChange(valueFromX(e.nativeEvent.locationX))}
      onTouchMove={(e) => onChange(valueFromX(e.nativeEvent.locationX))}
    >
      <View style={styles.sliderTrack} />
      <View style={[styles.sliderFill, { width: `${fraction * 100}%` }]} />
      <View style={[styles.sliderThumb, { left: `${fraction * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  settings: {
    width: '100%',
  },
  title: {
    margin: 0,
    marginBottom: 20,
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  clefToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  clefBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  clefBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  checkboxLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  checkboxText: {
    fontSize: 14,
    flex: 1,
  },
  numberInput: {
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  timeLimitDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  timeLimitEmoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  timeLimitValue: {
    fontWeight: '700',
    fontSize: 18,
    minWidth: 30,
    textAlign: 'center',
  },
  timeLimitName: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnPrimary: {
    // Farbe kommt aus dem Theme (accentBlue)
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Slider
  sliderTrackWrapper: {
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f39c12',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e74c3c',
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: '#2d2d44',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
