/**
 * Single-Page-Shell – 1:1 wie `App.svelte` der notenlern-app.
 *
 * Struktur:
 *   main > container > header
 *     - header-left: Titel „🎵 Notenlern-App" + Zurück-Button (wenn Session läuft)
 *     - header-controls: ⚙️ Einstellungen + Dark-Mode-Toggle
 *   SETUP: ModeSwitch-Karten (5 Modi)
 *   Laufende Modi: eingebettete Modus-Screens (werden in Phase B–F
 *   durch exakte 1:1-Ports der alten Modi ersetzt)
 *   Settings als Modal-Overlay (Klick außerhalb schließt).
 */

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModeSwitch } from '@/components/mode-switch';
import { NoteToPianoMode } from '@/components/modes/note-to-piano-mode';
import { PianoToNoteMode } from '@/components/modes/piano-to-note-mode';
import { RangeFinderMode } from '@/components/modes/range-finder-mode';
import { VisualizeMode } from '@/components/modes/visualize-mode';
import { SettingsPanel, SimpleSlider, type SettingsConfig } from '@/components/settings-panel';
import { type ExerciseMode } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/stores/app-store';
import { useSessionStore } from '@/stores/session-store';

type ScreenId = 'setup' | ExerciseMode | 'range-finder';

/** Tier-Emoji pro Zeitlimit (1:1 aus rangeFinderTimeLimitLabels). */
const TIME_LIMIT_EMOJIS: Record<number, string> = {
  1: '⚡', 2: '🐆', 3: '🦌', 4: '🐇', 5: '🦊',
  6: '🐈', 7: '🐕', 8: '🦔', 9: '🐢', 10: '🐌',
};

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const app = useAppStore();
  const { width, height } = useWindowDimensions();

  // Kompakter Header wie im Original (@media landscape/narrow):
  // Titel ausblenden, Settings icon-only, kompakte Paddings.
  const compactHeader = width < 700 || height < 450;

  const [screen, setScreen] = useState<ScreenId>('setup');
  const [runId, setRunId] = useState(0);

  // Session-Fortschritt für den Header (progress-compact 1:1)
  const sessionCorrect = useSessionStore((s) => s.correctCount);
  const sessionCompleted = useSessionStore((s) => s.correctCount + s.incorrectCount);

  const startMode = (mode: ExerciseMode) => {
    app.setMode(mode);
    app.setAppState('active');
    setScreen(mode);
    setRunId((id) => id + 1);
  };

  const startRangeFinder = () => {
    // wie im Original: RangeFinder nutzt intern den Visualize-Flow
    app.setMode('range-finder');
    app.setAppState('active');
    setScreen('range-finder');
    setRunId((id) => id + 1);
  };

  const backToSetup = () => {
    app.setAppState('setup');
    setScreen('setup');
  };

  const handleSettingsApply = (config: SettingsConfig) => {
    app.setClef(config.clef);
    app.setTrebleRange(config.trebleRange);
    app.setBassRange(config.bassRange);
    app.setExerciseCount(config.exerciseCount);
    app.setOnlyNaturalNotes(config.onlyNaturalNotes);
    app.setRangeFinderTimeLimit(config.rangeFinderTimeLimit);
    app.setSettingsOpen(false);

    // Wie im Original: laufende Session wird mit neuen Einstellungen neu gestartet
    if (screen !== 'setup' && screen !== 'range-finder') {
      setRunId((id) => id + 1);
    }
  };

  const renderModeScreen = () => {
    switch (screen) {
      case 'note-to-piano':
        return <NoteToPianoMode key={`ntp-${runId}`} onExit={backToSetup} />;
      case 'piano-to-note':
        return <PianoToNoteMode key={`ptn-${runId}`} onExit={backToSetup} />;
      case 'visualize':
        return <VisualizeMode key={`vis-${runId}`} onExit={backToSetup} />;
      case 'range-finder':
        return <RangeFinderMode key={`rf-${runId}`} onExit={backToSetup} />;
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView
      style={[styles.container, { backgroundColor: theme.bgSurface, paddingTop: insets.top }]}
    >
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          compactHeader && styles.headerCompact,
          { backgroundColor: theme.bgHeader },
        ]}
      >
        <View style={[styles.headerLeft, compactHeader && styles.headerLeftCompact]}>
          {!compactHeader ? (
            <Text style={[styles.h1, { color: theme.textOnHeader }]}>🎵 Notenlern-App</Text>
          ) : null}
          {screen !== 'setup' ? (
            <Pressable
              onPress={backToSetup}
              hitSlop={8}
              style={[styles.backBtnHeader, compactHeader && styles.backBtnCompact]}
            >
              <Text
                numberOfLines={1}
                style={[styles.backBtnText, compactHeader && styles.textCompact, { color: theme.headerBtnText }]}
              >
                ← Zurück
              </Text>
            </Pressable>
          ) : null}
          {/* progress-compact (1:1: „3/10 ✔ 2") */}
          {screen !== 'setup' && app.appState === 'active' ? (
            <View
              style={[
                styles.progressCompact,
                compactHeader && styles.progressCompactSm,
                { backgroundColor: theme.headerBtnBg, borderColor: theme.headerBtnBorder },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.progressCompactText, compactHeader && styles.textSmallCompact, { color: theme.textOnHeader }]}
              >
                {sessionCompleted}/{app.exerciseCount} ✔ {sessionCorrect}
              </Text>
            </View>
          ) : null}
          {/* Antwort-Toggles im Visualize-Modus (1:1: 🎤 Sprache / 🎼 Grafik) */}
          {app.mode === 'visualize' && app.appState === 'active' ? (
            <View style={styles.modeToggleHeader}>
              {(['speech', 'graphic'] as const).map((m) => {
                const active = app.answerInputMode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => app.setAnswerInputMode(m)}
                    style={[
                      styles.toggleBtnHeader,
                      compactHeader && styles.toggleBtnCompact,
                      {
                        backgroundColor: active ? theme.headerBtnActiveBg : theme.headerBtnBg,
                        borderColor: active ? theme.headerBtnActiveBg : theme.headerBtnBorder,
                      },
                    ]}
                  >
                    <Text style={styles.toggleEmoji}>{m === 'speech' ? '🎤' : '🎼'}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {/* Anzeige-Toggles im Audio-Modus (1:1: 🔤 Notenname / 🎼 System / 🎹 Großes System) */}
          {app.mode === 'note-to-piano' && app.appState === 'active' ? (
            <View style={styles.modeToggleHeader}>
              {(['badge', 'staff', 'grand'] as const).map((m) => {
                const active = app.audioDisplayMode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => app.setAudioDisplayMode(m)}
                    style={[
                      styles.toggleBtnHeader,
                      compactHeader && styles.toggleBtnCompact,
                      {
                        backgroundColor: active ? theme.headerBtnActiveBg : theme.headerBtnBg,
                        borderColor: active ? theme.headerBtnActiveBg : theme.headerBtnBorder,
                      },
                    ]}
                  >
                    <Text style={styles.toggleEmoji}>
                      {m === 'badge' ? '🔤' : m === 'staff' ? '🎼' : '🎹'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={[styles.headerControls, compactHeader && styles.headerControlsCompact]}>
          {/* RangeFinder-Zeit-Slider (1:1: nur auf dem Start-Screen sichtbar) */}
          {app.rangeFinderReady ? (
            <View
              style={[
                styles.headerTimeSlider,
                { backgroundColor: theme.headerBtnBg, borderColor: theme.headerBtnBorder },
              ]}
            >
              <Text style={styles.headerTimeEmoji}>
                {TIME_LIMIT_EMOJIS[app.rangeFinderTimeLimit] ?? '🐇'}
              </Text>
              <View style={styles.headerSlider}>
                <SimpleSlider
                  min={1}
                  max={10}
                  value={app.rangeFinderTimeLimit}
                  onChange={app.setRangeFinderTimeLimit}
                />
              </View>
              <Text style={[styles.headerTimeValue, { color: theme.textOnHeader }]}>
                {app.rangeFinderTimeLimit}s
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => app.setSettingsOpen(true)}
            style={[
              styles.headerBtn,
              compactHeader && styles.headerBtnCompact,
              { backgroundColor: theme.headerBtnBg, borderColor: theme.headerBtnBorder },
            ]}
          >
            <Text
              style={[styles.headerBtnText, compactHeader && styles.textCompact, { color: theme.headerBtnText }]}
            >
              ⚙️{compactHeader ? '' : ' Einstellungen'}
            </Text>
          </Pressable>
          <Pressable
            onPress={app.toggleDarkMode}
            style={[
              styles.headerBtn,
              styles.iconBtn,
              compactHeader && styles.iconBtnCompact,
              { backgroundColor: theme.headerBtnBg, borderColor: theme.headerBtnBorder },
            ]}
          >
            <Text style={styles.iconEmoji}>{app.darkMode ? '☀️' : '🌙'}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Inhalt ── */}
      {screen === 'setup' ? (
        <ScrollView contentContainerStyle={styles.setupScreen}>
          <ModeSwitch
            mode={app.mode}
            clef={app.clef}
            onChange={startMode}
            onClefChange={app.setClef}
            onRangeFinderStart={startRangeFinder}
          />
        </ScrollView>
      ) : (
        <View style={styles.exerciseScreen}>{renderModeScreen()}</View>
      )}

      {/* ── Settings-Modal ── */}
      {app.settingsOpen ? (
        <Pressable
          style={styles.modalOverlay}
          onPress={() => app.setSettingsOpen(false)}
        >
          <ScrollView
            style={[styles.modalContent, { backgroundColor: theme.bgModal }]}
            contentContainerStyle={styles.modalInner}
            nestedScrollEnabled
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <SettingsPanel
                isVisualizationMode={app.mode === 'visualize' && screen !== 'range-finder'}
                exerciseCount={app.exerciseCount}
                clef={app.clef}
                onlyNaturalNotes={app.onlyNaturalNotes}
                trebleRange={app.trebleRange}
                bassRange={app.bassRange}
                rangeFinderTimeLimit={app.rangeFinderTimeLimit}
                onApply={handleSettingsApply}
              />
            </Pressable>
          </ScrollView>
        </Pressable>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  headerCompact: {
    // 1:1 Original: header { padding: 4px 8px; flex-wrap: nowrap; gap: 2px; }
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  headerLeftCompact: {
    // 1:1 Original: .header-left { gap: 3px; min-width: 0; flex-shrink: 1; overflow: hidden; }
    gap: 3,
    minWidth: 0,
    overflow: 'hidden',
  },
  h1: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  backBtnHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  backBtnCompact: {
    // 1:1 Original: .btn-back-header { padding: 3px 6px; }
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressCompact: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  progressCompactSm: {
    // 1:1 Original: .progress-compact { padding: 3px 6px; font-size: 10px; white-space: nowrap; }
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  progressCompactText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modeToggleHeader: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleBtnHeader: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnCompact: {
    // 1:1 Original: .toggle-btn-header { font-size: 14px; padding: 3px 5px; }
    width: 26,
    height: 26,
  },
  toggleEmoji: {
    fontSize: 16,
  },
  headerTimeSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 6,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 2,
  },
  headerTimeEmoji: {
    fontSize: 16,
  },
  headerSlider: {
    width: 80,
  },
  headerTimeValue: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerControlsCompact: {
    // 1:1 Original: .header-controls { gap: 3px; flex-shrink: 0; }
    gap: 3,
    flexShrink: 0,
  },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 6,
  },
  headerBtnCompact: {
    // 1:1 Original: .settings-btn { padding: 3px 6px; font-size: 14px; }
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  iconBtn: {
    paddingHorizontal: 10,
  },
  iconBtnCompact: {
    // 1:1 Original: .dark-mode-toggle { padding: 3px 5px; font-size: 14px; }
    paddingHorizontal: 5,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textCompact: {
    // 1:1 Original-Buttons im Landscape: font-size: 11px
    fontSize: 11,
  },
  textSmallCompact: {
    // 1:1 Original: .progress-compact { font-size: 10px; }
    fontSize: 10,
  },
  iconEmoji: {
    fontSize: 16,
  },

  // Content
  setupScreen: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  exerciseScreen: {
    flex: 1,
  },

  // Settings-Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    width: '92%',
    maxHeight: '85%',
    borderRadius: 12,
  },
  modalInner: {
    padding: 20,
  },
});
