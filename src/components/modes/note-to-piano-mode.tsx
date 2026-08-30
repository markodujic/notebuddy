/**
 * NoteToPianoMode – 1:1-Portierung des Audio-Modus (🎵→🎹) aus
 * `App.svelte` der notenlern-app.
 *
 * Flow (exakt wie das Original):
 *   1. Session startet → targetNote (gewichtet random aus Range)
 *   2. Links: Note-Badge / Staff / GrandStaff (🔤/🎼/🎹-Toggle im Header)
 *   3. Rechts: Pitch-Ring (Stabilität + Volume) während LISTEN
 *   4. Stabile Note erkannt → Bewertung
 *      → Feedback-Popup („Richtig!" / „Das ist die richtige Note")
 *      → Badge-Modus: Staff zeigt die richtige Position
 *      → Staff/Grand-Modus: großes ✓/✗ + Notenname
 *   5. Feedback: richtig 1200ms / falsch 2500ms → nächste Aufgabe
 *   6. Session-Ende → EndScreen (Statistik + ErrorStats)
 *
 * Audio-Architektur (AGENTS.md): kontinuierliche Werte laufen über
 * SharedValues (0 Re-Renders/Frame), nur Phasen-Wechsel re-rendern.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { EndScreen } from '@/components/modes/end-screen';
import { PitchRing } from '@/components/feedback/pitch-ring';
import { PianoKeyboard } from '@/components/piano-keyboard';
import { GrandStaffView } from '@/components/staff/grand-staff-view';
import { StaffView } from '@/components/staff/staff-view';
import { LEARNING_CONFIG, RMS_GATE_THRESHOLD, getNotation, matchesNote } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAudioEngine } from '@/services/audio-engine';
import { usePitchSharedValues } from '@/services/pitch-shared-values';
import { type PitchFrame } from '@/services/pitch-utils';
import { StabilityTracker } from '@/services/stability-tracker';
import { useAppStore } from '@/stores/app-store';
import { useSessionStore } from '@/stores/session-store';

type ModePhase = 'listening' | 'result' | 'end';

// Fly-In mit Motion-Blur-Look (1:1 aus notenlern-app `note-fly-in`)
const flyInWithBlur = {
  from: {
    transform: [{ translateX: 80 }, { scale: 1.3 }, { skewX: '12deg' }],
    opacity: 0,
  },
  '60%': {
    transform: [{ translateX: -5 }, { scale: 1.05 }, { skewX: '-3deg' }],
    opacity: 1,
  },
  to: {
    transform: [{ translateX: 0 }, { scale: 1 }, { skewX: '0deg' }],
    opacity: 1,
  },
} as const;

export type NoteToPianoModeProps = {
  onExit: () => void;
};

export function NoteToPianoMode({ onExit }: NoteToPianoModeProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const notation = getNotation('german');

  // ── Stores ──
  const clef = useAppStore((s) => s.clef);
  const audioDisplayMode = useAppStore((s) => s.audioDisplayMode);
  const notationSystemId = useAppStore((s) => s.notationSystemId);
  const effectiveRange = useAppStore((s) => s.getEffectiveRange());
  const toleranceCents = useAppStore((s) => s.toleranceCents);
  const stabilityMs = useAppStore((s) => s.stabilityMs);
  const exerciseCount = useAppStore((s) => s.exerciseCount);
  const onlyNaturalNotes = useAppStore((s) => s.onlyNaturalNotes);
  const setAppState = useAppStore((s) => s.setAppState);

  const session = useSessionStore();
  const displayNotation = getNotation(notationSystemId);

  // ── Local state ──
  const [phase, setPhase] = useState<ModePhase>('listening');
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);

  // ── SharedValues (Audio↔UI-Brücke, 0 Re-Renders pro Frame) ──
  const values = usePitchSharedValues();

  // ── Refs für Audio-Verarbeitung (1:1 wie startAudioListening im Original) ──
  const stabilityRef = useRef<StabilityTracker | null>(null);
  const silenceFramesRef = useRef(0);
  const isAnsweringRef = useRef(false);
  const silenceGatePassedRef = useRef(false);
  const gateSilenceCountRef = useRef(0);
  const SILENCE_GATE_FRAMES = 3;
  const SILENCE_THRESHOLD = 5;

  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const targetMidi = session.currentExercise?.targetNote.midi ?? null;
  const targetMidiRef = useRef<number | null>(null);
  useEffect(() => {
    targetMidiRef.current = targetMidi;
  }, [targetMidi]);

  const targetName =
    targetMidi !== null
      ? displayNotation.midiToDisplay(targetMidi, { octaveStyle: 'helmholtz' })
      : '';

  const submitAnswerRef = useRef<((detectedMidi: number, frequency: number) => void) | null>(null);

  // ── Audio Callback (Diskret-Logik, 1:1 wie startAudioListening im Original) ──
  const handleAudioFrame = useCallback(
    (frame: PitchFrame) => {
      if (phaseRef.current !== 'listening') return;
      const currentTargetMidi = targetMidiRef.current;
      if (currentTargetMidi === null) return;
      if (isAnsweringRef.current) return;

      // Silence-Gate: Erst Stille akzeptieren (verhindert Carry-Over der vorigen Antwort)
      if (!silenceGatePassedRef.current) {
        if (frame.frequency === 0 || frame.rms < RMS_GATE_THRESHOLD) {
          gateSilenceCountRef.current += 1;
          if (gateSilenceCountRef.current >= SILENCE_GATE_FRAMES) {
            silenceGatePassedRef.current = true;
          }
        } else {
          gateSilenceCountRef.current = 0;
        }
        return;
      }

      // Kein gültiger Pitch → Stille-Zähler, dann Reset
      if (frame.frequency === 0) {
        silenceFramesRef.current += 1;
        if (silenceFramesRef.current >= SILENCE_THRESHOLD) {
          stabilityRef.current?.reset();
          values.setStabilityProgress(0);
        }
        return;
      }

      silenceFramesRef.current = 0;
      const detectedMidi = Math.round(12 * Math.log2(frame.frequency / 440) + 69);

      if (!stabilityRef.current) {
        stabilityRef.current = new StabilityTracker({
          targetMidi: currentTargetMidi,
          toleranceCents,
          stabilityMs,
        });
      }

      // Stabilität JEDER gehaltener Note tracken (wie im Original: isMatch=true)
      const status = stabilityRef.current.update(detectedMidi, true, frame.timestamp);
      values.setStabilityProgress(status.progress);

      if (status.isStable) {
        // Bewertung: stimmt die stabile Note mit dem Ziel überein?
        const isCorrect = matchesNote(frame.frequency, currentTargetMidi, toleranceCents);
        isAnsweringRef.current = true;
        // Richtige MIDI schicken, sonst die erkannte (wie handleAnswer im Original)
        submitAnswerRef.current?.(
          isCorrect ? currentTargetMidi : detectedMidi,
          frame.frequency,
        );
      }
    },
    [toleranceCents, stabilityMs, values],
  );

  const audio = useAudioEngine(
    values,
    handleAudioFrame,
    (error) => {
      setMicErrorMessage(
        /permission|denied/i.test(error.message)
          ? 'Mikrofonberechtigung wurde abgelehnt. Bitte erlaube den Zugriff auf dein Mikrofon in den Geräte-Einstellungen.'
          : 'Kein Mikrofon gefunden. Bitte stelle sicher, dass ein Mikrofon verfügbar ist.',
      );
    },
  );

  // ── Antwort einreichen (handleAnswer 1:1: Feedback 1200/2500ms) ──
  const submitAnswer = useCallback(
    (detectedMidi: number, frequency: number) => {
      const result = session.submitFrequency(frequency);
      if (!result) return;

      setPhase('result');
      setFeedbackCorrect(result.correct);
      audio.stopListening();

      const delay = result.correct
        ? LEARNING_CONFIG.FEEDBACK_CORRECT_MS
        : LEARNING_CONFIG.FEEDBACK_INCORRECT_MS;

      setTimeout(() => {
        if (session.isComplete) {
          setPhase('end');
          setAppState('end');
        } else {
          session.nextExercise();
        }
      }, delay);
    },
    [session, audio, setAppState],
  );

  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  // ── Session starten (beim Mount, wie startSession im Original) ──
  const { startSession } = session;
  useEffect(() => {
    setAppState('active');
    startSession('note-to-piano', {
      range: effectiveRange,
      exerciseCount,
      toleranceCents,
      onlyNaturalNotes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Neue Aufgabe → Listening starten (showNextExercise 1:1) ──
  const exerciseKey = `${runKey}-${session.currentIndex}-${targetMidi}`;
  useEffect(() => {
    if (phase === 'end' || targetMidi === null) return;

    // Audio-Feedback-State zurücksetzen
    isAnsweringRef.current = false;
    silenceFramesRef.current = 0;
    silenceGatePassedRef.current = false;
    gateSilenceCountRef.current = 0;
    stabilityRef.current = null;
    values.reset();
    setPhase('listening');
    audio.startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseKey]);

  // ── Cleanup ──
  const { stopListening } = audio;
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // ── Nochmal: Session neu starten ──
  const handleRestart = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase('listening');
    setAppState('active');
    startSession('note-to-piano', {
      range: effectiveRange,
      exerciseCount,
      toleranceCents,
      onlyNaturalNotes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRange, exerciseCount, toleranceCents, onlyNaturalNotes, startSession, setAppState]);

  // ── Mikrofon-Fehler: Erneut versuchen ──
  const retryMicrophone = useCallback(() => {
    setMicErrorMessage(null);
    audio.startListening();
  }, [audio]);

  const minDim = Math.min(windowWidth, windowHeight);
  const boxSize = Math.min(400, Math.round(minDim * 0.45));
  const grandWidth = Math.min(500, Math.round(windowWidth * 0.55));
  const badgeFont = Math.round(boxSize * 0.42);

  // ── Mikrofon-Fehler-Screen (1:1 wie showMicrophoneError-Block) ──
  if (micErrorMessage) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.bgSurface }]}>
        <View style={[styles.errorBox, { backgroundColor: theme.errorTextBg }]}>
          <Text style={styles.errorIcon}>🎤</Text>
          <Text style={[styles.errorTitle, { color: theme.errorTextColor }]}>
            Mikrofon-Zugriff benötigt
          </Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
            {micErrorMessage}
          </Text>
          <View style={styles.errorActions}>
            <Pressable
              onPress={onExit}
              style={[styles.btnSecondary, { backgroundColor: theme.bgHover }]}
            >
              <Text style={[styles.btnText, { color: theme.textPrimary }]}>Zurück</Text>
            </Pressable>
            <Pressable
              onPress={retryMicrophone}
              style={[styles.btnStart, { backgroundColor: theme.accentBlue }]}
            >
              <Text style={[styles.btnText, { color: '#ffffff' }]}>🔄 Erneut versuchen</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── End-Screen (1:1 wie end-screen) ──
  if (phase === 'end') {
    return (
      <EndScreen
        correctCount={session.correctCount}
        completedCount={session.correctCount + session.incorrectCount}
        weighting={session.session?.weighting ?? null}
        onBack={onExit}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <View style={[styles.exerciseArea, { backgroundColor: theme.bgSurface }]}>
      <View style={styles.visualizationMode}>
        <View style={styles.contentWrapper}>
          <View style={styles.layout}>
            {/* Links: Note-Badge / Staff / GrandStaff */}
            {audioDisplayMode === 'badge' ? (
              <View style={{ width: boxSize, height: boxSize }}>
                <Animated.View
                  key={`note-${targetMidi}`}
                  style={{
                    flex: 1,
                    animationName: flyInWithBlur,
                    animationDuration: '400ms',
                    animationTimingFunction: 'ease-out',
                    animationFillMode: 'both',
                  }}
                >
                  <View style={[styles.noteName, { backgroundColor: theme.noteBadgeBg }]}>
                    <Text
                      style={[
                        styles.noteNameText,
                        {
                          color:
                            phase === 'result'
                              ? feedbackCorrect
                                ? '#44cc44'
                                : '#ff4444'
                              : theme.noteBadgeText,
                          fontSize: badgeFont,
                          lineHeight: badgeFont * 1.2,
                        },
                      ]}
                    >
                      {targetName}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            ) : audioDisplayMode === 'staff' ? (
              <View style={[styles.staffBox, { width: boxSize, height: boxSize }]}>
                {targetMidi !== null && (
                  <StaffView clef={clef} displayMidi={targetMidi} width={boxSize - 16} />
                )}
              </View>
            ) : (
              <View style={[styles.grandBox, { width: grandWidth, height: boxSize }]}>
                {targetMidi !== null && (
                  <GrandStaffView midi={targetMidi} width={grandWidth - 16} />
                )}
              </View>
            )}

            {/* Rechts: Pitch-Ring oder Ergebnis */}
            <View style={[styles.staffBox, { width: boxSize, height: boxSize }]}>
              {phase === 'result' ? (
                <>
                  <View
                    style={[
                      styles.feedbackPopup,
                      {
                        backgroundColor: feedbackCorrect
                          ? theme.successBg
                          : theme.accentBlueBg,
                      },
                    ]}
                  >
                    <Text style={styles.feedbackPopupIcon}>
                      {feedbackCorrect ? '✓' : '→'}
                    </Text>
                    <Text
                      style={[
                        styles.feedbackPopupText,
                        { color: feedbackCorrect ? theme.successText : theme.accentBlue },
                      ]}
                    >
                      {feedbackCorrect ? 'Richtig!' : 'Das ist die richtige Note'}
                    </Text>
                  </View>
                  {audioDisplayMode === 'badge' ? (
                    targetMidi !== null && (
                      <StaffView clef={clef} displayMidi={targetMidi} width={boxSize - 16} />
                    )
                  ) : (
                    <View style={styles.resultFeedbackOnly}>
                      <Text
                        style={[
                          styles.resultIcon,
                          { color: feedbackCorrect ? '#44cc44' : '#ff4444' },
                        ]}
                      >
                        {feedbackCorrect ? '✓' : '✗'}
                      </Text>
                      <Text style={[styles.resultName, { color: theme.textHeading }]}>
                        {targetName}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <PitchRing
                  show
                  isDetecting={phase === 'listening'}
                  values={values}
                  midiToName={(midi) => notation.helmholtzFor(midi)}
                  size={Math.min(280, boxSize)}
                />
              )}
            </View>
          </View>
        </View>

        {/* Keyboard unten, immer sichtbar (1:1) */}
        <View style={styles.keyboardArea}>
          <PianoKeyboard
            targetMidi={phase === 'result' ? targetMidi : null}
            highlightMidi={phase === 'result' ? targetMidi : null}
            feedback={phase === 'result' ? (feedbackCorrect ? 'correct' : 'incorrect') : null}
            interactive={false}
            focusRange={[effectiveRange.minMidi, effectiveRange.maxMidi]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseArea: {
    flex: 1,
  },

  // visualization-mode (1:1)
  visualizationMode: {
    flex: 1,
    flexDirection: 'column',
  },
  contentWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  // Note-Badge (1:1: .note-badge .note-name – dunkler Kasten, Georgia)
  noteName: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
  },
  noteNameText: {
    fontWeight: '600',
    fontFamily: 'serif',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // Staff-Boxen (audio-staff-left / staff-container)
  staffBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  grandBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // feedback-popup (✓ Richtig! / → Das ist die richtige Note)
  feedbackPopup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: '100%',
  },
  feedbackPopupIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  feedbackPopupText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // audio-result-feedback-only (großes ✓/✗ + Notenname)
  resultFeedbackOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 200,
  },
  resultIcon: {
    fontSize: 120,
    fontWeight: '700',
    lineHeight: 132,
  },
  resultName: {
    fontSize: 32,
    fontFamily: 'serif',
    opacity: 0.8,
  },

  // Keyboard unten
  keyboardArea: {
    padding: 8,
  },

  // Mikrofon-Fehler
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorBox: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 12,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  btnStart: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
