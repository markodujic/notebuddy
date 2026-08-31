/**
 * RangeFinderMode – 1:1-Portierung des Tonumfang-Finders (🔍🎹) aus
 * `App.svelte` der notenlern-app.
 *
 * Flow (exakt wie das Original):
 *   1. Start-Screen: Karte mit Tier-Emoji des Zeitlimits + „▶ Los geht's!"
 *      (Glitch 600ms → Fly-out 300ms → Test beginnt)
 *   2. Test: Note im Badge (Farbverlauf hell→gelb mit ablaufender Zeit + Shake),
 *      Timer-Balken, interaktives System, Keyboard mit Live-Range (grün)
 *   3. Antwort: grüner Fly-out (500ms) / roter Fly-out (600ms)
 *   4. Ende: Ergebnis-Screen mit gefundenem Tonumfang + „✓ Bereich übernehmen"
 *      (Split bei C4 → Treble ≥ C4, Bass < C4)
 *
 * Der Header zeigt auf dem Start-Screen den Zeit-Slider (rangeFinderReady).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { PianoKeyboard } from '@/components/piano-keyboard';
import { StaffView } from '@/components/staff/staff-view';
import {
  RangeFinder,
  getNoteStaffPosition,
  getNotation,
  positionsMatch,
  type RangeFinderState,
  type StaffPosition,
} from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/stores/app-store';

type ModePhase = 'start' | 'testing' | 'result';

const TIME_LIMIT_EMOJIS: Record<number, string> = {
  1: '⚡', 2: '🐆', 3: '🦌', 4: '🐇', 5: '🦊',
  6: '🐈', 7: '🐕', 8: '🦔', 9: '🐢', 10: '🐌',
};

// Animationen (1:1 aus notenlern-app CSS)
const flyInWithBlur = {
  from: { transform: [{ translateX: 80 }, { scale: 1.3 }, { skewX: '12deg' }], opacity: 0 },
  '60%': { transform: [{ translateX: -5 }, { scale: 1.05 }, { skewX: '-3deg' }], opacity: 1 },
  to: { transform: [{ translateX: 0 }, { scale: 1 }, { skewX: '0deg' }], opacity: 1 },
} as const;

const flyOut = {
  from: { transform: [{ scale: 1 }], opacity: 1 },
  to: { transform: [{ scale: 1.6 }], opacity: 0 },
} as const;

const glitchShake = {
  from: { transform: [{ translateX: -3 }, { skewX: '1deg' }] },
  '25%': { transform: [{ translateX: 3 }, { skewX: '-1deg' }] },
  '50%': { transform: [{ translateX: -2 }] },
  '75%': { transform: [{ translateX: 2 }, { skewX: '0.5deg' }] },
  to: { transform: [{ translateX: -3 }, { skewX: '1deg' }] },
} as const;

const shakePulse = {
  from: { transform: [{ translateX: -1.5 }] },
  to: { transform: [{ translateX: 1.5 }] },
} as const;

export type RangeFinderModeProps = {
  onExit: () => void;
};

export function RangeFinderMode({ onExit }: RangeFinderModeProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const notation = getNotation('german');

  // ── Stores ──
  const timeLimit = useAppStore((s) => s.rangeFinderTimeLimit);
  const setTimeLimit = useAppStore((s) => s.setRangeFinderTimeLimit);
  const effectiveRange = useAppStore((s) => s.getEffectiveRange());
  const setAppState = useAppStore((s) => s.setAppState);
  const setRangeFinderReady = useAppStore((s) => s.setRangeFinderReady);
  const setTrebleRange = useAppStore((s) => s.setTrebleRange);
  const setBassRange = useAppStore((s) => s.setBassRange);

  // ── Local state (1:1) ──
  const [phase, setPhase] = useState<ModePhase>('start');
  const [rfState, setRfState] = useState<RangeFinderState | null>(null);
  const lastStateSigRef = useRef('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [feedbackNoteName, setFeedbackNoteName] = useState('');
  const [showStaff, setShowStaff] = useState(false);
  const [startFlyOut, setStartFlyOut] = useState(false);
  const [glitch, setGlitch] = useState(false);

  const rangeFinderRef = useRef<RangeFinder | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const timeLimitRef = useRef(timeLimit);
  useEffect(() => {
    timeLimitRef.current = timeLimit;
  }, [timeLimit]);

  // Start-Screen anzeigen → Header-Slider (rangeFinderReady 1:1)
  useEffect(() => {
    setAppState('active');
    setRangeFinderReady(true);
    return () => {
      setRangeFinderReady(false);
      rangeFinderRef.current?.destroy();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1:1: `$: if (rangeFinder && rangeFinderActive) rangeFinder.setTimeLimit(...*1000)`
  useEffect(() => {
    if (phase === 'testing' && rangeFinderRef.current) {
      rangeFinderRef.current.setTimeLimit(timeLimit * 1000);
    }
  }, [timeLimit, phase]);

  // ── „▶ Los geht's!" (handleRangeFinderGo 1:1: Glitch 600ms → Fly-out 300ms) ──
  const handleGo = useCallback(() => {
    setGlitch(true);
    setTimeout(() => {
      setGlitch(false);
      setStartFlyOut(true);
      setTimeout(() => {
        setStartFlyOut(false);
        beginTest();
      }, 300);
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Test starten (beginRangeFinder 1:1) ──
  const beginTest = useCallback(() => {
    setRangeFinderReady(false);
    const rf = new RangeFinder(timeLimitRef.current * 1000);
    rangeFinderRef.current = rf;

    rf.onTimeout(() => {
      // Notennamen sichern, BEVOR submit die Note wechselt (1:1)
      const midi = rf.getState().currentNoteMidi;
      if (midi !== null) {
        setFeedbackNoteName(notation.helmholtzFor(midi));
      }
      setFeedback('incorrect');
      setTimeout(() => setFeedback(null), 600);
    });

    setPhase('testing');
    rf.start();
    setRfState(rf.getState());

    // State pollen: Timer nativ (SharedValue), Re-Render nur bei diskreten
    // Änderungen (Note, Clef, Range, Complete) – nicht 10×/s die ganze Mode.
    pollIntervalRef.current = setInterval(() => {
      const current = rangeFinderRef.current;
      if (!current) return;
      const state = current.getState();

      timerProgressSv.value = Math.max(
        0,
        Math.min(1, state.timeRemaining / (timeLimitRef.current * 1000)),
      );

      const sig = `${state.currentNoteMidi}|${state.currentClef}|${
        state.foundRange
          ? `${state.foundRange.minMidi}-${state.foundRange.maxMidi}`
          : ''
      }|${state.isComplete}`;
      if (sig !== lastStateSigRef.current) {
        lastStateSigRef.current = sig;
        setRfState(state);
      }

      if (state.isComplete) {
        // finishRangeFinder 1:1
        current.destroy();
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setPhase('result');
        setAppState('end');
      }
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Antwort (handleRangeFinderAnswer 1:1 inkl. Ledger-Toleranz) ──
  const handleAnswer = useCallback(
    (position: StaffPosition) => {
      const rf = rangeFinderRef.current;
      if (!rf || phaseRef.current !== 'testing' || showStaff) return;
      const currentMidi = rf.getState().currentNoteMidi;
      if (currentMidi === null) return;

      const correctPosition = getNoteStaffPosition(currentMidi, rf.getState().currentClef);
      if (!correctPosition) return;

      const isCorrect = positionsMatch(position, correctPosition, true);

      // Notennamen sichern, BEVOR submit die Note wechselt (1:1)
      setFeedbackNoteName(notation.helmholtzFor(currentMidi));
      setShowStaff(true);
      rf.submitAnswer(isCorrect);

      if (!isCorrect) {
        // Roter Fly-out 600ms
        setFeedback('incorrect');
        setTimeout(() => {
          setFeedback(null);
          setShowStaff(false);
        }, 600);
      } else {
        // Grüner Fly-out 500ms
        setFeedback('correct');
        setTimeout(() => {
          setFeedback(null);
          setShowStaff(false);
        }, 500);
      }
    },
    [showStaff, notation],
  );

  // ── Bereich übernehmen (applyFoundRange 1:1: Split bei C4 = MIDI 60) ──
  const applyFoundRange = useCallback(() => {
    if (rfState?.foundRange) {
      const { minMidi: foundMin, maxMidi: foundMax } = rfState.foundRange;
      const C4 = 60;

      // Violinschlüssel: C4 und darüber
      const trebleMin = Math.max(foundMin, C4);
      const trebleMax = foundMax;
      if (trebleMax >= trebleMin) {
        setTrebleRange({ minMidi: trebleMin, maxMidi: trebleMax });
      }

      // Bassschlüssel: unterhalb C4 (B3 = 59)
      const bassMin = foundMin;
      const bassMax = Math.min(foundMax, C4 - 1);
      if (bassMax >= bassMin) {
        setBassRange({ minMidi: bassMin, maxMidi: bassMax });
      }
    }
    rangeFinderRef.current = null;
    onExit();
  }, [rfState, setTrebleRange, setBassRange, onExit]);

  const minDim = Math.min(windowWidth, windowHeight);
  const boxSize = Math.min(400, Math.round(minDim * 0.45));
  const badgeFont = Math.round(boxSize * 0.45);

  const timeLimitEmoji = TIME_LIMIT_EMOJIS[timeLimit] ?? '🐇';
  // Timer läuft nativ (SharedValue) – löst KEIN Re-Render der ganzen Mode aus.
  const timerProgressSv = useSharedValue(1);

  // Native Timer-Animationen (breite + Farbe, 0 Re-Renders)
  const timerBarStyle = useAnimatedStyle(() => ({
    width: `${timerProgressSv.value * 100}%`,
    backgroundColor: interpolateColor(
      timerProgressSv.value,
      [0, 0.3, 1],
      ['#f44336', '#f44336', theme.accentBlue],
    ),
  }));
  const noteBadgeColor = useAnimatedStyle(() => ({
    color: interpolateColor(
      timerProgressSv.value,
      [0, 1],
      ['#ffcc00', '#e8e4e0'],
    ),
  }));

  const currentNoteName =
    rfState?.currentNoteMidi !== null && rfState?.currentNoteMidi !== undefined
      ? notation.helmholtzFor(rfState.currentNoteMidi)
      : '';

  // Live-Range fürs Keyboard (1:1: foundRange ±5, geklemmt auf 36–96)
  const keyboardRange = rfState?.foundRange
    ? {
        minMidi: Math.max(36, rfState.foundRange.minMidi - 5),
        maxMidi: Math.min(96, rfState.foundRange.maxMidi + 5),
      }
    : effectiveRange;
  const greenKeys: number[] = [];
  if (rfState?.foundRange) {
    for (let m = rfState.foundRange.minMidi; m <= rfState.foundRange.maxMidi; m += 1) {
      greenKeys.push(m);
    }
  }

  // ── Start-Screen (1:1: range-finder-start-card) ──
  if (phase === 'start') {
    return (
      <View style={[styles.exerciseArea, { backgroundColor: theme.bgSurface }]}>
        <View style={styles.startScreen}>
          <Animated.View
            style={[
              styles.startCard,
              { backgroundColor: theme.rfCardBg },
              startFlyOut && {
                animationName: flyOut,
                animationDuration: '300ms',
                animationTimingFunction: 'ease-in',
                animationFillMode: 'forwards',
              },
              glitch && {
                animationName: glitchShake,
                animationDuration: '80ms',
                animationIterationCount: 'infinite',
              },
            ]}
          >
            <Text style={styles.startCardAnimalBg}>{timeLimitEmoji}</Text>
            {!glitch ? (
              <Pressable
                onPress={handleGo}
                style={[styles.goButton, { backgroundColor: theme.accentBlue }]}
              >
                <Text style={styles.goButtonText}>▶ Los geht's!</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Ergebnis-Screen (1:1: range-finder-result) ──
  if (phase === 'result' && rfState) {
    const passedCount = rfState.testedNotes.filter((n) => n.passed).length;
    const failedNote = [...rfState.testedNotes].reverse().find((n) => !n.passed);

    return (
      <View style={[styles.exerciseArea, { backgroundColor: theme.bgSurface }]}>
        <View style={styles.resultScreen}>
          <View style={styles.resultKeyboard}>
            <PianoKeyboard
              interactive={false}
              focusRange={[keyboardRange.minMidi, keyboardRange.maxMidi]}
              greenKeys={greenKeys}
            />
          </View>

          <View style={[styles.resultCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.resultLabel, { color: theme.textPrimary }]}>
              Dein sicherer Tonumfang:
            </Text>
            <View style={styles.resultNotes}>
              <Text style={[styles.resultNote, { color: theme.textHeading }]}>
                {notation.helmholtzFor(rfState.foundRange.minMidi)}
              </Text>
              <Text style={[styles.resultArrow, { color: theme.textMuted }]}>→</Text>
              <Text style={[styles.resultNote, { color: theme.textHeading }]}>
                {notation.helmholtzFor(rfState.foundRange.maxMidi)}
              </Text>
            </View>
            <Text style={[styles.resultCount, { color: theme.textSecondary }]}>
              {passedCount} von {rfState.testedNotes.length} Noten bestanden
            </Text>
            {failedNote ? (
              <Text style={[styles.resultFailed, { color: theme.textTertiary }]}>
                Gestoppt bei: {notation.helmholtzFor(failedNote.midi)}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={applyFoundRange}
            style={[styles.applyButton, { backgroundColor: theme.accentBlue }]}
          >
            <Text style={styles.applyButtonText}>✓ Bereich übernehmen</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Test läuft (1:1: note-badge + Timer + Staff + Keyboard) ──
  return (
    <View style={[styles.exerciseArea, { backgroundColor: theme.bgSurface }]}>
      <View style={styles.visualizationMode}>
        <View style={styles.contentWrapper}>
          <View style={styles.layout}>
            {/* Note-Badge: Fly-in + Farbverlauf hell→gelb + Shake (rf-note-badge) */}
            <View style={{ width: boxSize, height: boxSize }}>
              <Animated.View
                key={`rf-note-${rfState?.currentNoteMidi}`}
                style={{
                  flex: 1,
                  animationName: flyInWithBlur,
                  animationDuration: '400ms',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'both',
                }}
              >
                <View style={[styles.noteBadge, { backgroundColor: theme.noteBadgeBg }]}>
                  {feedback ? (
                    <Animated.Text
                      style={[
                        styles.noteBadgeText,
                        {
                          fontSize: badgeFont,
                          lineHeight: badgeFont * 1.15,
                          color: feedback === 'correct' ? '#44cc44' : '#ff4444',
                          animationName: flyOut,
                          animationDuration: feedback === 'correct' ? '500ms' : '600ms',
                          animationTimingFunction: 'ease-in',
                          animationFillMode: 'forwards',
                        },
                      ]}
                    >
                      {feedbackNoteName}
                    </Animated.Text>
                  ) : (
                    <Animated.Text
                      style={[
                        styles.noteBadgeText,
                        noteBadgeColor,
                        {
                          fontSize: badgeFont,
                          lineHeight: badgeFont * 1.15,
                          animationName: shakePulse,
                          animationDuration: '100ms',
                          animationDirection: 'alternate',
                          animationIterationCount: 'infinite',
                        },
                      ]}
                    >
                      {currentNoteName}
                    </Animated.Text>
                  )}
                </View>
              </Animated.View>
            </View>

            {/* Staff mit Timer-Balken (1:1) */}
            <View style={{ width: boxSize, alignItems: 'center' }}>
              <View style={[styles.timerBarContainer, { backgroundColor: theme.timerBg }]}>
                <Animated.View
                  style={[styles.timerBar, timerBarStyle]}
                />
              </View>
              <StaffView
                clef={rfState?.currentClef ?? 'treble'}
                interactive={!showStaff}
                onPositionSelect={(pos) => handleAnswer(pos)}
                width={boxSize - 16}
              />
            </View>
          </View>
        </View>

        {/* Keyboard mit Live-Range (grün) */}
        <View style={styles.keyboardArea}>
          <PianoKeyboard
            interactive={false}
            focusRange={[keyboardRange.minMidi, keyboardRange.maxMidi]}
            greenKeys={greenKeys}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseArea: { flex: 1 },
  visualizationMode: { flex: 1 },
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

  // Start-Screen (1:1: range-finder-start-card)
  startScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  startCard: {
    width: 280,
    height: 280,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  startCardAnimalBg: {
    position: 'absolute',
    fontSize: 220,
    opacity: 0.15,
  },
  goButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    elevation: 3,
  },
  goButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Test-Layout
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
  timerBarContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  timerBar: {
    height: '100%',
    borderRadius: 4,
  },

  // Ergebnis-Screen (1:1: range-finder-result)
  resultScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  resultKeyboard: {
    width: '100%',
    alignItems: 'center',
  },
  resultCard: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  resultNote: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  resultArrow: {
    fontSize: 28,
  },
  resultCount: {
    fontSize: 14,
  },
  resultFailed: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  applyButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },

  keyboardArea: {
    padding: 8,
  },
});
