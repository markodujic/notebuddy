/**
 * Note → Klavier Screen (Pilot-Modus, Audio-Eingabe).
 *
 * Flow:
 *   1. Note anzeigen (Badge, Staff oder GrandStaff)
 *   2. Audio-Engine startet
 *   3. User spielt/singt den Ton
 *   4. Pitch-Detection + Stability-Check
 *   5. Bewertung → Feedback
 *   6. Nächste Aufgabe
 *
 * ⚠️ Architektur (Stufe A, siehe PITCH-DATAFLOW-PLAN.md):
 * Kontinuierliche Audio-Werte laufen über SharedValues → 0 Re-Renders pro Frame.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ParticleExplosion } from "@/components/effects/particle-explosion";
import {
  KEYBOARD_ZOOM_DURATION_MS,
  PianoKeyboard,
  type KeyboardFeedback,
  type KeyboardZoomMode,
} from "@/components/piano-keyboard";
import { GrandStaffView } from "@/components/staff/grand-staff-view";
import { StaffView } from "@/components/staff/staff-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  LEARNING_CONFIG,
  RMS_GATE_THRESHOLD,
  getNotation,
  matchesNote,
} from "@/domain";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useAudioEngine } from "@/services/audio-engine";
import { usePitchSharedValues } from "@/services/pitch-shared-values";
import { type PitchFrame } from "@/services/pitch-utils";
import { StabilityTracker } from "@/services/stability-tracker";
import { useAppStore } from "@/stores/app-store";
import { useSessionStore } from "@/stores/session-store";

type DisplayMode = "badge" | "staff" | "grand";
type ScreenPhase = "asking" | "listening" | "feedback" | "done";

// Keyframes für "Atmen"-Animation während Listening-Phase.
const breathingPulse = {
  from: { transform: [{ scale: 1 }], opacity: 0.85 },
  "50%": { transform: [{ scale: 1.04 }], opacity: 1 },
  to: { transform: [{ scale: 1 }], opacity: 0.85 },
} as const;

// Keyframes für Fly-In mit simuliertem Motion-Blur bei neuen Fragen.
const flyInWithBlur = {
  from: {
    transform: [{ translateY: 60 }, { scale: 0.7 }, { skewX: "12deg" }],
    opacity: 0,
  },
  "40%": {
    transform: [{ translateY: -8 }, { scale: 1.05 }, { skewX: "-3deg" }],
    opacity: 0.9,
  },
  "70%": {
    transform: [{ translateY: 3 }, { scale: 0.98 }, { skewX: "1deg" }],
    opacity: 1,
  },
  to: {
    transform: [{ translateY: 0 }, { scale: 1 }, { skewX: "0deg" }],
    opacity: 1,
  },
} as const;

const DISPLAY_MODE_ICONS: Record<DisplayMode, string> = {
  badge: "🔤",
  staff: "🎼",
  grand: "🎹",
};

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

  // SharedValues – die zentrale Audio↔UI-Brücke (0 Re-Renders pro Frame)
  const values = usePitchSharedValues();

  // Local state (nur echte Phasen-Wechsel, nicht pro Frame)
  const [displayMode, setDisplayMode] = useState<DisplayMode>("badge");
  const [phase, setPhase] = useState<ScreenPhase>("asking");
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [explosionTrigger, setExplosionTrigger] = useState(false);
  const [keyboardZoomMode, setKeyboardZoomMode] =
    useState<KeyboardZoomMode>("overview");

  // Refs für Audio-Verarbeitung
  const stabilityRef = useRef<StabilityTracker | null>(null);
  const silenceFramesRef = useRef(0);
  const isAnsweringRef = useRef(false);
  const silenceGatePassedRef = useRef(false);
  const gateSilenceCountRef = useRef(0);
  const SILENCE_GATE_FRAMES = 3;

  const phaseRef = useRef(phase);
  const targetMidiRef = useRef<number | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const targetMidi = session.currentExercise?.targetNote.midi ?? null;
  const targetName =
    targetMidi !== null
      ? notation.midiToDisplay(targetMidi, { octaveStyle: "helmholtz" })
      : "";
  useEffect(() => {
    targetMidiRef.current = targetMidi;
  }, [targetMidi]);

  const submitAnswerRef = useRef<
    ((detectedMidi: number, frequency: number) => void) | null
  >(null);

  // ── Audio Callback ──
  const handleAudioFrame = useCallback(
    (frame: PitchFrame) => {
      const currentPhase = phaseRef.current;
      const currentTargetMidi = targetMidiRef.current;

      if (currentPhase !== "listening") return;
      if (currentTargetMidi === null) return;
      if (isAnsweringRef.current) return;

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

      if (frame.frequency === 0) {
        silenceFramesRef.current += 1;
        if (silenceFramesRef.current >= 5) {
          stabilityRef.current?.reset();
          values.setStabilityProgress(0);
        }
        return;
      }

      silenceFramesRef.current = 0;

      const detectedMidi = Math.round(
        12 * Math.log2(frame.frequency / 440) + 69,
      );

      if (!stabilityRef.current) {
        stabilityRef.current = new StabilityTracker({
          targetMidi: currentTargetMidi,
          toleranceCents,
          stabilityMs,
        });
      }

      const result = stabilityRef.current.update(
        detectedMidi,
        true,
        frame.timestamp,
      );
      values.setStabilityProgress(result.progress);

      if (result.isStable) {
        const isCorrect = matchesNote(
          frame.frequency,
          currentTargetMidi,
          toleranceCents,
        );
        isAnsweringRef.current = true;
        submitAnswerRef.current?.(
          isCorrect ? currentTargetMidi : detectedMidi,
          frame.frequency,
        );
      }
    },
    [toleranceCents, stabilityMs, values],
  );

  const audio = useAudioEngine(values, handleAudioFrame);

  // ── Antwort einreichen ──
  const submitAnswer = useCallback(
    (detectedMidi: number, frequency: number) => {
      const result = session.submitFrequency(frequency);
      if (!result) return;

      setPhase("feedback");
      audio.stopListening();

      const correct = result.correct;
      setFeedbackCorrect(correct);
      setWrongMidi(correct ? null : detectedMidi);
      if (!correct) {
        setExplosionTrigger(false);
        setTimeout(() => setExplosionTrigger(true), 0);
      }

      const delay = correct
        ? LEARNING_CONFIG.FEEDBACK_CORRECT_MS
        : LEARNING_CONFIG.FEEDBACK_INCORRECT_MS;

      setTimeout(() => {
        if (session.isComplete) {
          setPhase("done");
        } else {
          session.nextExercise();
          setPhase("asking");
        }
      }, delay);
    },
    [session, audio],
  );

  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  // ── Neue Aufgabe → Koordinierte Timeline ──
  const OVERVIEW_DURATION_MS = 2000;

  useEffect(() => {
    if (phase !== "asking" || targetMidi === null) return;

    isAnsweringRef.current = false;
    silenceFramesRef.current = 0;
    silenceGatePassedRef.current = false;
    gateSilenceCountRef.current = 0;
    stabilityRef.current = null;
    values.reset();
    setWrongMidi(null);

    setKeyboardZoomMode("overview");

    const focusTimer = setTimeout(() => {
      setKeyboardZoomMode("focus");
    }, OVERVIEW_DURATION_MS);

    const listenTimer = setTimeout(() => {
      setPhase("listening");
      audio.startListening();
    }, OVERVIEW_DURATION_MS + KEYBOARD_ZOOM_DURATION_MS);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(listenTimer);
    };
  }, [phase, targetMidi, audio, values]);

  const { stopListening } = audio;
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  useEffect(() => {
    if (!session.session) {
      session.startSession("note-to-piano", {
        range: effectiveRange,
        toleranceCents,
        onlyNaturalNotes: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyboardFeedback: KeyboardFeedback | null =
    phase === "feedback" ? (feedbackCorrect ? "correct" : "incorrect") : null;

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
      ]}
    >
      <ThemedView style={styles.container}>
        {/* Header mit Progress */}
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">
            Aufgabe {Math.min(session.currentIndex + 1, session.exerciseCount)}{" "}
            / {session.exerciseCount}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ✓ {session.correctCount} · ✗ {session.incorrectCount}
          </ThemedText>
        </ThemedView>

        {/* Display Mode Toggle (3 Modi wie alte App: 🔤 🎼 🎹) */}
        <View style={styles.modeToggle}>
          {(["badge", "staff", "grand"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setDisplayMode(mode)}
              style={[
                styles.modeChip,
                displayMode === mode && styles.modeChipActive,
              ]}
            >
              <ThemedText type="small" style={styles.modeChipText}>
                {DISPLAY_MODE_ICONS[mode]}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Note Display */}
        <ThemedView style={styles.displayCard}>
          {/* Partikel-Explosion bei falscher Antwort (nur badge modus) */}
          {displayMode === "badge" && (
            <ParticleExplosion
              trigger={explosionTrigger}
              centerX={150}
              centerY={120}
              size={300}
            />
          )}
          {displayMode === "badge" ? (
            <Animated.View
              key={`badge-${targetMidi}`}
              style={[
                styles.badgeContainer,
                {
                  animationName: flyInWithBlur,
                  animationDuration: "600ms",
                  animationTimingFunction: "ease-out",
                  animationFillMode: "both",
                },
                phase === "listening" && {
                  animationName: breathingPulse,
                  animationDuration: "1500ms",
                  animationTimingFunction: "ease-in-out",
                  animationDirection: "alternate",
                  animationIterationCount: "infinite",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.noteBadge,
                  {
                    fontSize: isCompact ? 96 : isExpanded ? 160 : 128,
                    lineHeight: isCompact ? 115 : isExpanded ? 192 : 154,
                  },
                ]}
              >
                {targetName || "–"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {phase === "listening"
                  ? "Höre zu…"
                  : "Spiele oder singe diese Note"}
              </ThemedText>
            </Animated.View>
          ) : displayMode === "staff" ? (
            <View style={styles.staffContainer}>
              <StaffView
                clef={clef}
                displayMidi={targetMidi}
                width={isCompact ? 280 : 340}
              />
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.staffHint}
              >
                {targetName}
              </ThemedText>
            </View>
          ) : (
            // Grand Staff: Violin + Bass mit Akkolade
            <View style={styles.staffContainer}>
              {targetMidi !== null && (
                <GrandStaffView
                  midi={targetMidi}
                  width={isCompact ? 280 : 340}
                />
              )}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.staffHint}
              >
                {targetName}
              </ThemedText>
            </View>
          )}
        </ThemedView>

        {/* Klaviatur */}
        <ThemedView style={styles.keyboardCard}>
          <PianoKeyboard
            targetMidi={phase === "feedback" ? targetMidi : null}
            wrongMidi={phase === "feedback" ? wrongMidi : null}
            feedback={keyboardFeedback}
            interactive={false}
            zoomMode={keyboardZoomMode}
            focusRange={[effectiveRange.minMidi, effectiveRange.maxMidi]}
          />
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    width: "100%",
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    flexShrink: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.two,
  },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
  modeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(128,128,128,0.12)",
  },
  modeChipActive: {
    backgroundColor: "rgba(124,58,237,0.24)",
  },
  modeChipText: {
    opacity: 0.9,
    fontSize: 16,
  },
  displayCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    paddingTop: Spacing.six,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    minHeight: 240,
    backgroundColor: "rgba(128,128,128,0.08)",
  },
  badgeContainer: {
    alignItems: "center",
    gap: Spacing.two,
  },
  noteBadge: {
    fontWeight: "700",
    textAlign: "center",
  },
  staffContainer: {
    alignItems: "center",
    gap: Spacing.one,
  },
  staffHint: {
    textAlign: "center",
  },
  keyboardCard: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
});
