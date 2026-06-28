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
 * ⚠️ Architektur (Stufe A, siehe PITCH-DATAFLOW-PLAN.md):
 * Kontinuierliche Audio-Werte laufen über SharedValues → 0 Re-Renders pro Frame.
 * Der Screen re-rendert NUR bei echten Phasen-Wechseln (asking→listening→feedback→done),
 * nicht mehr 60×/Sekunde. Stability-Progress und Volume sind in SharedValues,
 * `handleAudioFrame` macht nur noch Diskret-Logik (Stability-Tracking + Submit).
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

type DisplayMode = "badge" | "staff";
type ScreenPhase = "asking" | "listening" | "feedback" | "done";

// Keyframes für "Atmen"-Animation während Listening-Phase.
// Reanimated v4 CSS Animation – läuft komplett auf dem UI-Thread, 0 Re-Renders.
const breathingPulse = {
  from: { transform: [{ scale: 1 }], opacity: 0.85 },
  "50%": { transform: [{ scale: 1.04 }], opacity: 1 },
  to: { transform: [{ scale: 1 }], opacity: 0.85 },
} as const;

// Keyframes für Fly-In mit simuliertem Motion-Blur bei neuen Fragen.
// skewX während der Bewegung erzeugt einen Richtungs-Stretch (Motion-Blur-Look).
// Überschwingung am Ende für ein "Snappy" Gefühl.
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
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  // Partikel-Explosion bei falscher Antwort
  const [explosionTrigger, setExplosionTrigger] = useState(false);

  // Keyboard-Zoom: Bei jeder neuen Aufgabe 2 Sekunden alle 88 Tasten zeigen,
  // danach in den Fokus-Bereich reinzoomen.
  const [keyboardZoomMode, setKeyboardZoomMode] =
    useState<KeyboardZoomMode>("overview");

  // Refs für Audio-Verarbeitung (Diskret-Logik, kein Re-Render)
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
  const targetName =
    targetMidi !== null
      ? notation.midiToDisplay(targetMidi, { octaveStyle: "helmholtz" })
      : "";
  useEffect(() => {
    targetMidiRef.current = targetMidi;
  }, [targetMidi]);

  // Submit-Ref (vermeidet Dependency-Cycle)
  const submitAnswerRef = useRef<
    ((detectedMidi: number, frequency: number) => void) | null
  >(null);

  // ── Audio Callback (Diskret-Logik: Stability-Tracking + Submit) ──
  // Läuft pro Frame, aber kommuniziert NUR über SharedValues und
  // (selten) submitAnswerRef → KEIN setState pro Frame.
  const handleAudioFrame = useCallback(
    (frame: PitchFrame) => {
      const currentPhase = phaseRef.current;
      const currentTargetMidi = targetMidiRef.current;

      if (currentPhase !== "listening") return;
      if (currentTargetMidi === null) return;
      if (isAnsweringRef.current) return;

      // ── Silence Gate (initial) ──
      // Vor dem ersten Pitch müssen ~50ms Stille erkannt werden,
      // um Carry-Over von der vorherigen Antwort zu verhindern.
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

      // ── Stille-Frame ──
      if (frame.frequency === 0) {
        silenceFramesRef.current += 1;
        if (silenceFramesRef.current >= 5) {
          stabilityRef.current?.reset();
          values.setStabilityProgress(0);
        }
        return;
      }

      silenceFramesRef.current = 0;

      // ── Pitch erkannt ──
      const detectedMidi = Math.round(
        12 * Math.log2(frame.frequency / 440) + 69,
      );

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
      const result = stabilityRef.current.update(
        detectedMidi,
        true,
        frame.timestamp,
      );
      values.setStabilityProgress(result.progress);

      // Stabil → erst JETZT correctness prüfen
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

  // ── Audio Engine (schreibt kontinuierliche Werte in SharedValues) ──
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
        // Microtask: State-Wechsel erzwingt Neu-Start der Animation
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
    [session, audio, notation],
  );

  // submitAnswer in Ref halten (für stabilen Audio-Callback)
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  // ── Neue Aufgabe → Koordinierte Timeline ──
  // t=0:            Keyboard = Overview (alle 88 Tasten), Refs reset
  // t=2000ms:       Keyboard = Focus → Zoom-Animation startet
  // t=2000ms+ZOOM:  Listening aktivieren (Mikrofon + Pitch-Detection)
  const OVERVIEW_DURATION_MS = 2000;

  useEffect(() => {
    if (phase !== "asking" || targetMidi === null) return;

    // Refs/values resetten
    isAnsweringRef.current = false;
    silenceFramesRef.current = 0;
    silenceGatePassedRef.current = false;
    gateSilenceCountRef.current = 0;
    stabilityRef.current = null;
    values.reset();
    setWrongMidi(null);

    // Keyboard = Overview (alle 88 Tasten)
    setKeyboardZoomMode("overview");

    // t=2000ms: Focus → Zoom-Animation startet
    const focusTimer = setTimeout(() => {
      setKeyboardZoomMode("focus");
    }, OVERVIEW_DURATION_MS);

    // t=2000ms+ZOOM: Listening aktivieren (erst nach Abschluss des Zooms)
    const listenTimer = setTimeout(() => {
      setPhase("listening");
      audio.startListening();
    }, OVERVIEW_DURATION_MS + KEYBOARD_ZOOM_DURATION_MS);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(listenTimer);
    };
  }, [phase, targetMidi, audio, values]);

  // ── Cleanup (nur Unmount, nicht pro Render) ──
  // `audio` ist jetzt memoisiert (useMemo in useAudioEngine), aber defensiv
  // auf [] setzen, damit der Cleanup nie versehentlich bei Re-Renders feuert
  // und das Mikrofon stoppt. stopListening ist stabil (useCallback, []-Deps).
  const { stopListening } = audio;
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // ── Session starten beim ersten Mount ──
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

  // Keyboard Feedback Mapping
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

        {/* Display Mode Toggle */}
        <View style={styles.modeToggle}>
          {(["badge", "staff"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setDisplayMode(mode)}
              style={[
                styles.modeChip,
                displayMode === mode && styles.modeChipActive,
              ]}
            >
              <ThemedText type="small" style={styles.modeChipText}>
                {mode === "badge" ? "Text" : "System"}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Note Display */}
        <ThemedView style={styles.displayCard}>
          {/* Partikel-Explosion bei falscher Antwort */}
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
                  // Fly-In bei jeder neuen Frage (key-Wechsel startet Animation neu)
                  animationName: flyInWithBlur,
                  animationDuration: "600ms",
                  animationTimingFunction: "ease-out",
                  animationFillMode: "both",
                },
                phase === "listening" && {
                  // "Atmen" übernimmt nach dem Fly-In (gleicher Name = Überschreibung)
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
          ) : (
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
