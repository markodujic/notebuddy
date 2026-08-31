/**
 * VisualizeMode – 1:1-Portierung des „Notensystem visualisieren"-Modus
 * (🧠→🎼) aus `App.svelte` der notenlern-app.
 *
 * Flow (exakt wie das Original):
 *   1. Session mit gültigen Visualize-Noten (29 Positionen, gefiltert auf Range)
 *   2. Note als großes Badge + leeres Notensystem (interaktiv)
 *   3. Antwort per Tipp auf die Position (🎼) oder Spracheingabe (🎤)
 *   4. Falsch → rote Note blinkt 1s → richtige Note wird gezeigt
 *      Richtig → richtige Note sofort
 *   5. Grafik-Modus: Klick anywhere → nächste Aufgabe
 *      Sprache-Modus: auto-advance (1.5s richtig / 2.5s nach Korrektur)
 *   6. Ledger-Toleranz: „Hilfslinie" ohne Richtung → Nummer genügt
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { EndScreen } from '@/components/modes/end-screen';
import { PianoKeyboard } from '@/components/piano-keyboard';
import { StaffView } from '@/components/staff/staff-view';
import {
  getMidiForPosition,
  getNoteStaffPosition,
  getNotation,
  getValidVisualizationNotes,
  type StaffPosition,
} from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { getSpeechInput, type SpeechResult } from '@/services/speech-input';
import { useAppStore } from '@/stores/app-store';
import { useSessionStore } from '@/stores/session-store';

type ModePhase = 'input' | 'feedback' | 'end';

// Fly-In mit Motion-Blur (1:1 aus notenlern-app `note-fly-in`)
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

const SPEECH_EXAMPLES = [
  '„dritte Linie"',
  '„zweiter Zwischenraum"',
  '„erste Hilfslinie oben"',
  '„unter der ersten Linie"',
];

export type VisualizeModeProps = {
  onExit: () => void;
};

export function VisualizeMode({ onExit }: VisualizeModeProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const speechInput = getSpeechInput();

  // ── Stores ──
  const clef = useAppStore((s) => s.clef);
  const notationSystemId = useAppStore((s) => s.notationSystemId);
  const answerInputMode = useAppStore((s) => s.answerInputMode);
  const effectiveRange = useAppStore((s) => s.getEffectiveRange());
  const exerciseCount = useAppStore((s) => s.exerciseCount);
  const toleranceCents = useAppStore((s) => s.toleranceCents);
  const setAppState = useAppStore((s) => s.setAppState);

  const session = useSessionStore();
  const displayNotation = getNotation(notationSystemId);

  // ── Local state (1:1: showStaff, wrongPosition, feedback, speech) ──
  const [phase, setPhase] = useState<ModePhase>('input');
  const [showStaff, setShowStaff] = useState(false);
  const [wrongPosition, setWrongPosition] = useState<StaffPosition | null>(null);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [speechAutoMode, setSpeechAutoMode] = useState(false);
  const [speechLastHeard, setSpeechLastHeard] = useState('');
  const [runKey, setRunKey] = useState(0);

  const feedbackStartTimeRef = useRef(0);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Verzögerte Antwort einer falschen Eingabe (wird erst bei skipToNext eingereicht). */
  const pendingAnswerRef = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const targetMidi = session.currentExercise?.targetNote.midi ?? null;
  const correctPosition =
    targetMidi !== null ? getNoteStaffPosition(targetMidi, clef) : null;
  const targetName =
    targetMidi !== null
      ? displayNotation.midiToDisplay(targetMidi, { octaveStyle: 'helmholtz' })
      : '';

  // ── Session starten (1:1: nur gültige Visualize-Noten in der Range) ──
  const { startSession } = session;
  useEffect(() => {
    setAppState('active');

    const allValid = getValidVisualizationNotes(clef);
    const validMidiNotes = allValid.filter(
      (midi) => midi >= effectiveRange.minMidi && midi <= effectiveRange.maxMidi,
    );
    const notes = validMidiNotes.length > 0 ? validMidiNotes : allValid;

    startSession('visualize', {
      range: { minMidi: Math.min(...notes), maxMidi: Math.max(...notes) },
      exerciseCount,
      toleranceCents,
      onlyNaturalNotes: true, // 1:1: Visualize erzwingt Stammtöne
      validMidiNotes: notes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Neue Aufgabe → Reset + Speech ggf. fortsetzen (showNextExercise 1:1) ──
  const exerciseKey = `${runKey}-${session.currentIndex}-${targetMidi}`;
  useEffect(() => {
    if (targetMidi === null || phase === 'end') return;

    setShowStaff(false);
    setWrongPosition(null);
    setFeedbackCorrect(false);
    setPhase('input');

    if (speechAutoMode && answerInputMode === 'speech') {
      speechInput.resume(handleSpeechResultRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseKey]);

  // ── Antwort-Logik (handlePositionAnswer 1:1 inkl. Ledger-Toleranz) ──
  const handlePositionAnswer = useCallback(
    (position: StaffPosition, ledgerDirectionOmitted?: boolean) => {
      if (phaseRef.current !== 'input' || targetMidi === null || !correctPosition) return;

      // Korrekt prüfen — exakt wie das Original
      let isCorrect = position === correctPosition;

      if (!isCorrect && ledgerDirectionOmitted) {
        // Hilfslinien-Nummer vergleichen: „ledger-(above|below)-N"
        const selectedMatch = position.match(/ledger-(above|below)-(\d)/);
        const correctMatch = correctPosition.match(/ledger-(above|below)-(\d)/);
        if (selectedMatch && correctMatch && selectedMatch[2] === correctMatch[2]) {
          isCorrect = true;
        }
        // Auch Zwischenräume: „ledger-(above|below)-space-N"
        const selectedSpaceMatch = position.match(/ledger-(above|below)-space-(\d)/);
        const correctSpaceMatch = correctPosition.match(/ledger-(above|below)-space-(\d)/);
        if (selectedSpaceMatch && correctSpaceMatch && selectedSpaceMatch[2] === correctSpaceMatch[2]) {
          isCorrect = true;
        }
      }

      setWrongPosition(isCorrect ? null : position);
      setFeedbackCorrect(isCorrect);

      // Session aktualisieren (1:1: richtige MIDI wenn korrekt, sonst target+1)
      const answerMidi = isCorrect ? targetMidi : targetMidi + 1;
      if (isCorrect) {
        // Richtig: sofort einreichen → Aufgabe wechselt (Auto-Advance).
        session.submitNote(answerMidi);
      } else {
        // Falsch: Einreichen VERZÖGERN. submitNoteAnswer schaltet
        // currentIndex sofort weiter → der exerciseKey-Reset-Effekt würde
        // die Aufdeck-Phase (rote Note 1s, dann grüne Note) sofort
        // abbrechen, während der 1s-Timeout später showStaff=true mitten
        // in der nächsten Input-Phase setzte → überlagerte/flackernde
        // Notenköpfe im Staff. Erst bei skipToNextQuestion einreichen.
        pendingAnswerRef.current = answerMidi;
      }

      setPhase('feedback');
      feedbackStartTimeRef.current = Date.now();

      if (isCorrect) {
        // Richtig: Speech auto-advance 1.5s; Grafik: Klick wartet
        if (answerInputMode === 'speech') {
          feedbackTimeoutRef.current = setTimeout(() => skipToNextRef.current(), 1500);
        }
      } else {
        // Falsche Position 1s rot zeigen, dann richtige Note
        setTimeout(() => {
          if (phaseRef.current !== 'feedback') return; // Aufgabe schon gewechselt → veraltet
          setWrongPosition(null);
          setShowStaff(true);
          feedbackStartTimeRef.current = Date.now();
          if (answerInputMode === 'speech') {
            feedbackTimeoutRef.current = setTimeout(() => skipToNextRef.current(), 2500);
          }
        }, 1000);
      }
    },
    [targetMidi, correctPosition, session, answerInputMode],
  );

  const handlePositionAnswerRef = useRef(handlePositionAnswer);
  useEffect(() => {
    handlePositionAnswerRef.current = handlePositionAnswer;
  }, [handlePositionAnswer]);

  // ── Klick auf Hintergrund → weiter (handleVisualizationClick 1:1) ──
  const handleVisualizationClick = useCallback(() => {
    if (!showStaff) return;
    if (wrongPosition) return;
    if (Date.now() - feedbackStartTimeRef.current < 200) return; // Debounce
    skipToNextRef.current();
  }, [showStaff, wrongPosition]);

  // ── Nächste Aufgabe (skipToNextQuestion 1:1) ──
  const skipToNextQuestion = useCallback(() => {
    // Verhindern, dass derselbe Klick antwortet UND weiterspringt
    if (Date.now() - feedbackStartTimeRef.current < 300) return;

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }

    if (phaseRef.current !== 'feedback') return;

    // Verzögerte Antwort (falsch) jetzt einreichen, bevor weitergeschaltet wird
    if (pendingAnswerRef.current !== null) {
      session.submitNote(pendingAnswerRef.current);
      pendingAnswerRef.current = null;
    }

    setShowStaff(false);
    setWrongPosition(null);

    if (!session.isComplete) {
      session.nextExercise();
    } else {
      speechInput.stopContinuous();
      setSpeechAutoMode(false);
      setPhase('end');
      setAppState('end');
    }
  }, [session, speechInput, setAppState]);

  const skipToNextRef = useRef(skipToNextQuestion);
  useEffect(() => {
    skipToNextRef.current = skipToNextQuestion;
  }, [skipToNextQuestion]);

  // ── Speech (1:1: handleSpeechResult + startContinuousSpeech) ──
  const handleSpeechResult = useCallback(
    (result: SpeechResult) => {
      if (phaseRef.current !== 'input' || !result.position) return;
      speechInput.pause(); // Während Feedback pausieren
      handlePositionAnswerRef.current(result.position, result.ledgerDirectionOmitted);
    },
    [speechInput],
  );
  const handleSpeechResultRef = useRef(handleSpeechResult);
  useEffect(() => {
    handleSpeechResultRef.current = handleSpeechResult;
  }, [handleSpeechResult]);

  const startContinuousSpeech = useCallback(() => {
    setSpeechAutoMode(true);
    speechInput.start(handleSpeechResultRef.current, (_listening, transcript) => {
      if (transcript) setSpeechLastHeard(transcript);
    });
  }, [speechInput]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      speechInput.stopContinuous();
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [speechInput]);

  // ── Nochmal ──
  const handleRestart = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase('input');
    setShowStaff(false);
    setWrongPosition(null);
    pendingAnswerRef.current = null;
    setAppState('active');

    const allValid = getValidVisualizationNotes(clef);
    const validMidiNotes = allValid.filter(
      (midi) => midi >= effectiveRange.minMidi && midi <= effectiveRange.maxMidi,
    );
    const notes = validMidiNotes.length > 0 ? validMidiNotes : allValid;
    startSession('visualize', {
      range: { minMidi: Math.min(...notes), maxMidi: Math.max(...notes) },
      exerciseCount,
      toleranceCents,
      onlyNaturalNotes: true,
      validMidiNotes: notes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef, effectiveRange, exerciseCount, toleranceCents, startSession, setAppState]);

  const minDim = Math.min(windowWidth, windowHeight);
  const boxSize = Math.min(400, Math.round(minDim * 0.45));
  const badgeFont = Math.round(boxSize * 0.45);
  const wrongMidi =
    wrongPosition !== null ? getMidiForPosition(wrongPosition, clef) : null;

  // ── End-Screen ──
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

  const feedbackPopup = phase === 'feedback' ? (
    <View
      style={[
        styles.feedbackPopup,
        { backgroundColor: feedbackCorrect ? theme.successBg : theme.accentBlueBg },
      ]}
    >
      <Text style={styles.feedbackPopupIcon}>{feedbackCorrect ? '✓' : '→'}</Text>
      <Text
        style={[
          styles.feedbackPopupText,
          { color: feedbackCorrect ? theme.successText : theme.accentBlue },
        ]}
      >
        {feedbackCorrect ? 'Richtig!' : 'Das ist die richtige Note'}
      </Text>
    </View>
  ) : null;

  // Große Note-Badge (rf-note-badge 1:1: dunkler Kasten, riesige Schrift, Fly-In)
  const noteBadge = (
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
        <View style={[styles.noteBadge, { backgroundColor: theme.noteBadgeBg }]}>
          <Text
            style={[
              styles.noteBadgeText,
              { color: theme.noteBadgeText, fontSize: badgeFont, lineHeight: badgeFont * 1.15 },
            ]}
          >
            {targetName}
          </Text>
        </View>
      </Animated.View>
    </View>
  );

  const staffBox = (interactive: boolean) => (
    <View style={{ width: boxSize, height: boxSize, alignItems: 'center' }}>
      {feedbackPopup}
      <StaffView
        clef={clef}
        displayMidi={showStaff && targetMidi !== null ? targetMidi : null}
        wrongMidi={wrongMidi}
        showFeedback={showStaff && !feedbackCorrect}
        interactive={interactive}
        onPositionSelect={interactive ? (pos) => handlePositionAnswerRef.current(pos) : undefined}
        width={boxSize - 16}
      />
    </View>
  );

  return (
    <Pressable
      style={[styles.exerciseArea, { backgroundColor: theme.bgSurface }]}
      onPress={handleVisualizationClick}
    >
      <View style={styles.visualizationMode}>
        <View style={styles.contentWrapper}>
          {answerInputMode === 'graphic' ? (
            /* ── Grafik-Modus: Badge + interaktives System ── */
            <View style={styles.layout}>
              {noteBadge}
              {staffBox(phase === 'input')}
            </View>
          ) : (
            /* ── Sprache-Modus: Anleitung + nicht-interaktives System ── */
            <View style={styles.layout}>
              <View style={styles.speechPanel}>
                <Text style={[styles.speechTitle, { color: theme.textPrimary }]}>
                  Sage die Position im Notensystem:
                </Text>
                <View style={styles.speechExamples}>
                  {SPEECH_EXAMPLES.map((example) => (
                    <Text
                      key={example}
                      style={[
                        styles.speechExample,
                        {
                          backgroundColor: theme.speechExampleBg,
                          color: theme.speechExampleText,
                        },
                      ]}
                    >
                      {example}
                    </Text>
                  ))}
                </View>

                {speechAutoMode ? (
                  <View style={[styles.speechAutoStatus, { backgroundColor: theme.successBg }]}>
                    <Text style={styles.micIcon}>🎤</Text>
                    <Text style={[styles.speechAutoText, { color: theme.successText }]}>
                      Spracherkennung aktiv
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={startContinuousSpeech}
                    style={[styles.speechStartBtn, { backgroundColor: theme.accentBlue }]}
                  >
                    <Text style={styles.micIcon}>🎤</Text>
                    <Text style={styles.speechStartText}>Spracheingabe starten</Text>
                  </Pressable>
                )}

                {speechAutoMode && speechLastHeard ? (
                  <Text style={[styles.speechDebug, { color: theme.textMuted }]}>
                    Gehört: „{speechLastHeard}"
                  </Text>
                ) : null}
              </View>

              {staffBox(false)}
            </View>
          )}
        </View>

        {/* Keyboard unten, immer sichtbar (1:1) */}
        <View style={styles.keyboardArea}>
          <PianoKeyboard
            targetMidi={showStaff ? targetMidi : null}
            highlightMidi={showStaff ? targetMidi : null}
            feedback={showStaff ? 'correct' : null}
            interactive={false}
            focusRange={[effectiveRange.minMidi, effectiveRange.maxMidi]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  exerciseArea: {
    flex: 1,
  },
  visualizationMode: {
    flex: 1,
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

  // rf-note-badge (1:1)
  noteBadge: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBadgeText: {
    fontWeight: '600',
    fontFamily: 'serif',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // feedback-popup (✓ Richtig! / → Das ist die richtige Note)
  feedbackPopup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  feedbackPopupIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  feedbackPopupText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Speech-Panel (1:1: speech-instructions)
  speechPanel: {
    maxWidth: 380,
    gap: 14,
  },
  speechTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  speechExamples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  speechExample: {
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  speechAutoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  speechAutoText: {
    fontSize: 15,
    fontWeight: '600',
  },
  speechStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  speechStartText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  micIcon: {
    fontSize: 18,
  },
  speechDebug: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  keyboardArea: {
    padding: 8,
  },
});
