/**
 * PianoToNoteMode – 1:1-Portierung des Klavier→Note-Modus (🎹→🎵) aus
 * `App.svelte` der notenlern-app.
 *
 * Flow (exakt wie das Original):
 *   1. Session startet → targetNote wird auf der Klaviatur markiert
 *   2. User wählt Note (C D E F G A H, Swipe hoch = ♯ / runter = ♭)
 *   3. User wählt Oktave (Helmholtz-Labels C,, … c′′′′′) → Antwort
 *   4. Feedback-Popup: „✓ Richtig! e′" / „✗ Falsch – es war e′" (2000ms)
 *   5. Session-Ende → EndScreen
 *
 * Außerdem 1:1: Portrait-Blocker auf schmalen Screens im Hochformat
 * („Drehe dein Gerät ins Querformat für diesen Modus").
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { NoteButtons } from '@/components/controls/note-buttons';
import { EndScreen } from '@/components/modes/end-screen';
import { PianoKeyboard } from '@/components/piano-keyboard';
import { Note, getNotation } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/stores/app-store';
import { useSessionStore } from '@/stores/session-store';

type ModePhase = 'input' | 'feedback' | 'end';

// Rotate-Hinweis (1:1 aus `rotate-hint`-Keyframes: 0° → 90° → 90° → 0°)
const rotateHint = {
  from: { transform: [{ rotate: '0deg' }] },
  '25%': { transform: [{ rotate: '90deg' }] },
  '75%': { transform: [{ rotate: '90deg' }] },
  to: { transform: [{ rotate: '0deg' }] },
} as const;

const FEEDBACK_DURATION_MS = 2000;

export type PianoToNoteModeProps = {
  onExit: () => void;
};

export function PianoToNoteMode({ onExit }: PianoToNoteModeProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // ── Stores ──
  const notationSystemId = useAppStore((s) => s.notationSystemId);
  const effectiveRange = useAppStore((s) => s.getEffectiveRange());
  const exerciseCount = useAppStore((s) => s.exerciseCount);
  const toleranceCents = useAppStore((s) => s.toleranceCents);
  const onlyNaturalNotes = useAppStore((s) => s.onlyNaturalNotes);
  const setAppState = useAppStore((s) => s.setAppState);

  const session = useSessionStore();
  const displayNotation = getNotation(notationSystemId);

  // ── Local state ──
  const [phase, setPhase] = useState<ModePhase>('input');
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const targetMidi = session.currentExercise?.targetNote.midi ?? null;
  const targetName =
    targetMidi !== null
      ? displayNotation.midiToDisplay(targetMidi, { octaveStyle: 'helmholtz' })
      : '';

  // ── Session starten (beim Mount, 1:1 wie startSession) ──
  const { startSession } = session;
  useEffect(() => {
    setAppState('active');
    startSession('piano-to-note', {
      range: effectiveRange,
      exerciseCount,
      toleranceCents,
      onlyNaturalNotes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Neue Aufgabe → zurück in den Eingabe-Modus
  const exerciseKey = `${runKey}-${session.currentIndex}-${targetMidi}`;
  useEffect(() => {
    if (phase !== 'end') setPhase('input');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseKey]);

  // ── Antwort (handleNoteSelection 1:1) ──
  const handleNoteSelect = useCallback(
    (noteName: string, octave: number) => {
      if (phase !== 'input' || targetMidi === null) return;

      const midiNumber = Note.fromNameAndOctave(noteName, octave).midi;
      const result = session.submitNote(midiNumber);
      if (!result) return;

      setPhase('feedback');
      setFeedbackCorrect(result.correct);

      // 1:1: Feedback 2000ms (nicht-audio Modi)
      setTimeout(() => {
        if (session.isComplete) {
          setPhase('end');
          setAppState('end');
        } else {
          session.nextExercise();
        }
      }, FEEDBACK_DURATION_MS);
    },
    [phase, targetMidi, session, setAppState],
  );

  // ── Nochmal: Session neu starten ──
  const handleRestart = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase('input');
    setAppState('active');
    startSession('piano-to-note', {
      range: effectiveRange,
      exerciseCount,
      toleranceCents,
      onlyNaturalNotes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRange, exerciseCount, toleranceCents, onlyNaturalNotes, startSession, setAppState]);

  // Portrait-Blocker: kleine Screens im Hochformat (1:1 media query)
  const isPortrait = windowHeight >= windowWidth;
  const showPortraitBlocker = windowWidth < 600 && isPortrait;

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

  return (
    <View style={[styles.exerciseArea, { backgroundColor: theme.bgSurface }]}>
      {/* piano-to-note-layout (1:1: Keyboard + NoteButtons nebeneinander) */}
      <View style={styles.layout}>
        <View style={styles.keyboardArea}>
          <PianoKeyboard
            targetMidi={targetMidi}
            highlightMidi={targetMidi}
            wrongMidi={
              phase === 'feedback' && !feedbackCorrect && targetMidi !== null
                ? targetMidi
                : null
            }
            feedback={phase === 'feedback' ? (feedbackCorrect ? 'correct' : 'incorrect') : null}
            interactive={false}
            focusRange={[effectiveRange.minMidi, effectiveRange.maxMidi]}
          />
        </View>

        <View style={styles.noteButtonsArea}>
          <NoteButtons
            onNoteSelect={handleNoteSelect}
            onBack={onExit}
            landscape
            resetKey={exerciseKey}
          />
        </View>
      </View>

      {/* Feedback-Popup (1:1: „✓ Richtig! e′" / „✗ Falsch – es war e′") */}
      {phase === 'feedback' && targetMidi !== null ? (
        <View
          style={[
            styles.feedbackPopup,
            {
              backgroundColor: feedbackCorrect ? theme.successBg : theme.errorTextBg,
            },
          ]}
        >
          <Text style={styles.feedbackPopupIcon}>{feedbackCorrect ? '✓' : '✗'}</Text>
          <Text
            style={[
              styles.feedbackPopupText,
              { color: feedbackCorrect ? theme.successText : theme.errorTextColor },
            ]}
          >
            {feedbackCorrect ? `Richtig! ${targetName}` : `Falsch – es war ${targetName}`}
          </Text>
        </View>
      ) : null}

      {/* Portrait-Blocker (1:1): Modus braucht Querformat auf Mobilgeräten */}
      {showPortraitBlocker ? (
        <View style={styles.portraitBlocker}>
          <View style={styles.portraitBlockerContent}>
            <Animated.Text
              style={{
                fontSize: 64,
                animationName: rotateHint,
                animationDuration: '2s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
              }}
            >
              📱
            </Animated.Text>
            <Text style={styles.portraitBlockerText}>
              Drehe dein Gerät ins <Text style={{ fontWeight: 'bold' }}>Querformat</Text> für
              diesen Modus
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseArea: {
    flex: 1,
  },

  // piano-to-note-layout
  layout: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
  },
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  noteButtonsArea: {
    width: 300,
    maxWidth: '42%',
    justifyContent: 'flex-end',
  },

  // Feedback-Popup (unter dem Layout, zentriert)
  feedbackPopup: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 4,
  },
  feedbackPopupIcon: {
    fontSize: 24,
    fontWeight: '700',
  },
  feedbackPopupText: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Portrait-Blocker (1:1)
  portraitBlocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  portraitBlockerContent: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  portraitBlockerText: {
    fontSize: 18,
    color: '#e8e4e0',
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 27,
  },
});
