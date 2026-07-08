/**
 * Visualize Screen (Phase 4.2) — Notensystem visualisieren.
 *
 * 1:1 Flow aus notenlern-app:
 *   1. Session startet → targetNote
 *   2. correctPosition = getNoteStaffPosition(targetMidi, clef)
 *   3. StaffView wird interaktiv gezeigt
 *   4. User tippt auf eine Position im System
 *   5. Position prüfen (mit Ledger-Toleranz)
 *   6. Feedback → nächste Aufgabe
 *
 * Erst Graphic-Modus (auf Position tippen).
 * Speech-Modus (🎤) folgt später.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StaffView } from "@/components/staff/staff-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  LEARNING_CONFIG,
  getNotation,
  getNoteStaffPosition,
  positionsMatch,
  type StaffPosition,
} from "@/domain";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/stores/app-store";
import { useSessionStore } from "@/stores/session-store";

type ScreenPhase = "asking" | "input" | "feedback" | "done";
type AnswerInputMode = "graphic" | "speech";

export default function VisualizeScreen() {
  const theme = useTheme();
  const { isCompact } = useBreakpoint();
  const insets = useSafeAreaInsets();

  // Stores
  const clef = useAppStore((s) => s.clef);
  const notationSystemId = useAppStore((s) => s.notationSystemId);
  const effectiveRange = useAppStore((s) => s.getEffectiveRange());

  const session = useSessionStore();
  const notation = getNotation(notationSystemId);

  // State
  const [phase, setPhase] = useState<ScreenPhase>("asking");
  const [inputMode] = useState<AnswerInputMode>("graphic");
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [wrongPosition, setWrongPosition] = useState<StaffPosition | null>(
    null,
  );
  const [showCorrectNote, setShowCorrectNote] = useState(false);

  // Refs
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Target
  const targetMidi = session.currentExercise?.targetNote.midi ?? null;
  const correctPosition =
    targetMidi !== null ? getNoteStaffPosition(targetMidi, clef) : null;
  const targetName =
    targetMidi !== null
      ? notation.midiToDisplay(targetMidi, { octaveStyle: "helmholtz" })
      : "";

  // ── Neue Aufgabe ──
  useEffect(() => {
    if (phase !== "asking" || targetMidi === null) return;

    setWrongPosition(null);
    setShowCorrectNote(false);

    const timer = setTimeout(() => setPhase("input"), 600);
    return () => clearTimeout(timer);
  }, [phase, targetMidi]);

  // ── Position antippen ──
  const handlePositionSelect = useCallback(
    (position: StaffPosition) => {
      if (phaseRef.current !== "input" || !correctPosition) return;

      const isCorrect = positionsMatch(position, correctPosition, true);

      if (isCorrect) {
        setShowCorrectNote(true);
        setWrongPosition(null);
      } else {
        // Falsche Position erst rot zeigen, dann korrekt
        setWrongPosition(position);
        setShowCorrectNote(false);

        setTimeout(() => {
          setWrongPosition(null);
          setShowCorrectNote(true);
        }, 1000);
      }

      setFeedbackCorrect(isCorrect);
      setPhase("feedback");

      // Session updaten
      const answerMidi = isCorrect ? targetMidi! : targetMidi! + 1;
      session.submitNote(answerMidi);

      // Nächste Aufgabe nach Delay
      const delay = isCorrect
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
    [correctPosition, session, targetMidi],
  );

  // ── Session starten ──
  useEffect(() => {
    if (!session.session) {
      session.startSession("visualize", {
        range: effectiveRange,
        onlyNaturalNotes: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">
            Aufgabe {Math.min(session.currentIndex + 1, session.exerciseCount)}{" "}
            / {session.exerciseCount}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ✓ {session.correctCount} · ✗ {session.incorrectCount}
          </ThemedText>
        </ThemedView>

        {/* Status */}
        <ThemedView style={styles.statusCard}>
          {phase === "done" ? (
            <ThemedText type="title">Fertig!</ThemedText>
          ) : phase === "feedback" ? (
            <View style={styles.feedbackContainer}>
              <ThemedText
                type="title"
                style={{
                  color: feedbackCorrect ? "#22c55e" : "#ef4444",
                }}
              >
                {feedbackCorrect ? "✓ Richtig!" : "✗ Falsch"}
              </ThemedText>
              <ThemedText type="subtitle">{targetName}</ThemedText>
            </View>
          ) : (
            <ThemedText type="subtitle">
              {phase === "input" ? "Wo ist diese Note im System?" : "Bereit?"}
            </ThemedText>
          )}
        </ThemedView>

        {/* Target Note Display */}
        {phase !== "done" && targetMidi !== null && (
          <ThemedView style={styles.noteDisplayCard}>
            <ThemedText
              style={[styles.noteBadge, { fontSize: isCompact ? 72 : 96 }]}
            >
              {targetName}
            </ThemedText>
          </ThemedView>
        )}

        {/* Interactive Staff */}
        {phase !== "done" && (
          <ThemedView style={styles.staffCard}>
            <StaffView
              clef={clef}
              displayMidi={
                phase === "feedback" && showCorrectNote ? targetMidi : null
              }
              displayColor={feedbackCorrect ? "#22c55e" : theme.text}
              wrongMidi={
                wrongPosition
                  ? (() => {
                      // StaffView akzeptiert MIDI für wrongMidi.
                      // Wir haben eine StaffPosition, brauchen aber MIDI.
                      // Da wir die Note nicht eindeutig kennen (Position ohne Vorzeichen),
                      // geben wir die Target-MIDI als Platzhalter — visuell rot.
                      return targetMidi;
                    })()
                  : null
              }
              interactive={phase === "input"}
              onPositionSelect={handlePositionSelect}
              width={isCompact ? 280 : 340}
            />
          </ThemedView>
        )}
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
  statusCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    minHeight: 60,
    backgroundColor: "rgba(128,128,128,0.08)",
  },
  feedbackContainer: {
    alignItems: "center",
    gap: Spacing.two,
  },
  noteDisplayCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  noteBadge: {
    fontWeight: "700",
    textAlign: "center",
  },
  staffCard: {
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
});
