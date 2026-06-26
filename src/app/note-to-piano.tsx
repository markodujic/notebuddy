/**
 * Note → Klavier Screen (Pilot-Modus, Audio-Eingabe).
 *
 * Flow:
 *   1. Note anzeigen (Badge oder Staff)
 *   2. Audio-Engine startet
 *   3. User spielt/singt den Ton
 *   4. Pitch-Detection + Stability-Check
 *   5. Bewertung → Feedback
 *   6. Nächste Aufgabe
 *
 * ⚠️ WICHTIG: Audio-Verarbeitung läuft in Refs (kein Re-Render pro Frame).
 * Die UI entscheidet selbst, ob/wann sie re-rendert.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PitchRing } from '@/components/feedback/pitch-ring';
import { ResultBanner } from '@/components/feedback/result-banner';
import { PianoKeyboard, type KeyboardFeedback } from '@/components/piano-keyboard';
import { StaffView } from '@/components/staff/staff-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { LEARNING_CONFIG, getNotation, matchesNote } from '@/domain';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useTheme } from '@/hooks/use-theme';
import { useAudioEngine } from '@/services/audio-engine';
import { StabilityTracker } from '@/services/stability-tracker';
import { useAppStore } from '@/stores/app-store';
import { useSessionStore } from '@/stores/session-store';

type DisplayMode = 'badge' | 'staff';
type ScreenPhase = 'asking' | 'listening' | 'feedback' | 'done';

export default function NoteToPianoScreen() {
  const theme = useTheme();
  const { isCompact, isExpanded } = useBreakpoint();
  const insets = useSafeAreaInsets();

  // Stores
  const clef = useAppStore((s) => s.clef);
  const notationSystemId = useAppStore((s) => s.notationSystemId);
  const effectiveRange = useAppStore((s) => s.getEffectiveRange());
  const toleranceCents = useAppStore((s) => s.toleranceCents);
  const stabilityMs = useAppStore((s) => s.stabilityMs);

  const session = useSessionStore();
  const notation = getNotation(notationSystemId);

  // Local state (UI-spezifisch, nicht im Store)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('badge');
  const [phase, setPhase] = useState<ScreenPhase>('asking');
  const [detectedNote, setDetectedNote] = useState('');
  const [stabilityProgress, setStabilityProgress] = useState(0);
  const [volume, setVolume] = useState(0);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Refs für Audio-Verarbeitung (kein Re-Render)
  const stabilityRef = useRef<StabilityTracker | null>(null);
  const silenceFramesRef = useRef(0);
  const isAnsweringRef = useRef(false);
  // Silence Gate: Initial müssen ~50ms Stille erkannt werden, bevor Pitch akzeptiert wird.
  // Verhindert Carry-Over von der vorherigen Antwort.
  const silenceGatePassedRef = useRef(false);
  const gateSilenceCountRef = useRef(0);
  const SILENCE_GATE_FRAMES = 3;

  // Refs für phase und targetMidi, damit der Audio-Callback stabil bleibt
  // (ohne ihn bei jedem Render neu zu erzeugen)
  const phaseRef = useRef(phase);
  const targetMidiRef = useRef<number | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Target Note für aktuelle Aufgabe
  const targetMidi = session.currentExercise?.targetNote.midi ?? null;
  const targetName = targetMidi !== null ? notation.midiToDisplay(targetMidi) : '';
  useEffect(() => {
    targetMidiRef.current = targetMidi;
  }, [targetMidi]);

  // Submit-Ref (vermeidet Dependency-Cycle)
  const submitAnswerRef = useRef<
    ((detectedMidi: number, frequency: number) => void) | null
  >(null);

  // ── Audio Callback ──
  // Stabil (kein Re-Render bei Phase/Target-Änderung).
  // Liest aktuelle Werte aus Refs.
  const handleAudioFrame = useCallback(
    (frame: { frequency: number; clarity: number; rms: number; timestamp: number }) => {
      const currentPhase = phaseRef.current;
      const currentTargetMidi = targetMidiRef.current;

      if (currentPhase !== 'listening') return;
      if (currentTargetMidi === null) return;
      if (isAnsweringRef.current) return;

      // Volume-Visualisierung (wie alte App: smoothedRms / 0.15)
      setVolume(Math.min(1, frame.rms / 0.15));

      // ── Silence Gate (initial) ──
      // Vor dem ersten Pitch müssen ~50ms Stille erkannt werden,
      // um Carry-Over von der vorherigen Antwort zu verhindern.
      if (!silenceGatePassedRef.current) {
        if (frame.frequency === 0 || frame.rms < 0.01) {
          gateSilenceCountRef.current += 1;
          if (gateSilenceCountRef.current >= SILENCE_GATE_FRAMES) {
            silenceGatePassedRef.current = true;
          }
        } else {
          gateSilenceCountRef.current = 0;
        }
        return;
      }

      // ── Stille-Frame ──
      if (frame.frequency === 0) {
        silenceFramesRef.current += 1;
        if (silenceFramesRef.current >= 5) {
          stabilityRef.current?.reset();
          setStabilityProgress(0);
          setDetectedNote('');
        }
        return;
      }

      silenceFramesRef.current = 0;

      // ── Pitch erkannt ──
      const detectedMidi = Math.round(12 * Math.log2(frame.frequency / 440) + 69);
      setDetectedNote(notation.midiToName(detectedMidi));

      // Stability-Tracker initialisieren falls nötig
      if (!stabilityRef.current) {
        stabilityRef.current = new StabilityTracker({
          targetMidi: currentTargetMidi,
          toleranceCents,
          stabilityMs,
        });
      }

      // ⭐ KORREKTUR: Stabilität für JEDEN Ton tracken (isMatch immer true),
      // wie die alte App. Erst nach Stability wird geprüft, ob die Note korrekt ist.
      const result = stabilityRef.current.update(detectedMidi, true, frame.timestamp);
      setStabilityProgress(result.progress);

      // Stabil → erst JETZT correctness prüfen
      if (result.isStable) {
        const isCorrect = matchesNote(frame.frequency, currentTargetMidi, toleranceCents);
        isAnsweringRef.current = true;
        submitAnswerRef.current?.(isCorrect ? currentTargetMidi : detectedMidi, frame.frequency);
      }
    },
    [toleranceCents, stabilityMs, notation],
  );

  // ── Audio Engine ──
  const audio = useAudioEngine(handleAudioFrame);

  // ── Antwort einreichen ──
  const submitAnswer = useCallback(
    (detectedMidi: number, frequency: number) => {
      const result = session.submitFrequency(frequency);
      if (!result) return;

      setPhase('feedback');
      audio.stopListening();

      const correct = result.correct;
      setFeedbackCorrect(correct);
      setFeedbackMessage(correct ? 'Richtig!' : `Gespielt: ${notation.midiToName(detectedMidi)}`);
      setFeedbackVisible(true);

      const delay = correct
        ? LEARNING_CONFIG.FEEDBACK_CORRECT_MS
        : LEARNING_CONFIG.FEEDBACK_INCORRECT_MS;

      setTimeout(() => {
        setFeedbackVisible(false);
        if (session.isComplete) {
          setPhase('done');
        } else {
          session.nextExercise();
          setPhase('asking');
        }
      }, delay);
    },
    [session, audio, notation],
  );

  // submitAnswer in Ref halten (für stabilen Audio-Callback)
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  // ── Neue Aufgabe → Listening starten ──
  useEffect(() => {
    if (phase === 'asking' && targetMidi !== null) {
      isAnsweringRef.current = false;
      silenceFramesRef.current = 0;
      silenceGatePassedRef.current = false;
      gateSilenceCountRef.current = 0;
      stabilityRef.current = null;
      setStabilityProgress(0);
      setDetectedNote('');
      setVolume(0);

      const timer = setTimeout(() => {
        setPhase('listening');
        audio.startListening();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [phase, targetMidi, audio]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      audio.stopListening();
    };
  }, [audio]);

  // ── Session starten beim ersten Mount ──
  useEffect(() => {
    if (!session.session) {
      session.startSession('note-to-piano', {
        range: effectiveRange,
        toleranceCents,
        onlyNaturalNotes: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard Feedback Mapping
  const keyboardFeedback: KeyboardFeedback | null =
    phase === 'feedback'
      ? feedbackCorrect
        ? 'correct'
        : 'incorrect'
      : null;

  const contentInsets = {
    ...insets,
    bottom: insets.bottom + BottomTabInset + Spacing.three,
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={contentInsets}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
        },
      ]}>
      <ThemedView style={styles.container}>
        {/* Header mit Progress */}
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">
            Aufgabe {Math.min(session.currentIndex + 1, session.exerciseCount)} / {session.exerciseCount}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ✓ {session.correctCount} · ✗ {session.incorrectCount}
          </ThemedText>
        </ThemedView>

        {/* Display Mode Toggle */}
        <View style={styles.modeToggle}>
          {(['badge', 'staff'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setDisplayMode(mode)}
              style={[styles.modeChip, displayMode === mode && styles.modeChipActive]}
            >
              <ThemedText type="small" style={styles.modeChipText}>
                {mode === 'badge' ? 'Text' : 'System'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Note Display */}
        <ThemedView style={styles.displayCard}>
          {displayMode === 'badge' ? (
            <View style={styles.badgeContainer}>
              <ThemedText
                style={[
                  styles.noteBadge,
                  {
                    fontSize: isCompact ? 96 : isExpanded ? 160 : 128,
                  },
                ]}
              >
                {targetName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Spiele oder singe diese Note
              </ThemedText>
            </View>
          ) : (
            <View style={styles.staffContainer}>
              <StaffView
                clef={clef}
                displayMidi={targetMidi}
                width={isCompact ? 280 : 340}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.staffHint}>
                {targetName}
              </ThemedText>
            </View>
          )}
        </ThemedView>

        {/* Pitch Ring Feedback */}
        <View style={styles.pitchRingContainer}>
          <PitchRing
            show={phase === 'listening' || phase === 'feedback'}
            isDetecting={phase === 'listening'}
            detectedNote={detectedNote}
            stabilityProgress={stabilityProgress}
            volume={volume}
            resultState={phase === 'feedback' ? (feedbackCorrect ? 'correct' : 'incorrect') : null}
          />
        </View>

        {/* Klaviatur */}
        <ThemedView style={styles.keyboardCard}>
          <PianoKeyboard
            targetMidi={targetMidi}
            feedback={keyboardFeedback}
            interactive={false}
            zoomMode="focus"
            focusRange={[effectiveRange.minMidi, effectiveRange.maxMidi]}
          />
        </ThemedView>
      </ThemedView>

      {/* Result Banner */}
      <ResultBanner
        visible={feedbackVisible}
        correct={feedbackCorrect}
        message={feedbackMessage}
        onDismiss={() => setFeedbackVisible(false)}
      />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  modeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  modeChipActive: {
    backgroundColor: 'rgba(124,58,237,0.24)',
  },
  modeChipText: {
    opacity: 0.9,
  },
  displayCard: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  badgeContainer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  noteBadge: {
    fontWeight: '700',
    textAlign: 'center',
  },
  staffContainer: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  staffHint: {
    textAlign: 'center',
  },
  pitchRingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  keyboardCard: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
});