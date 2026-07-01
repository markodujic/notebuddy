/**
 * Piano → Note Screen (Phase 4.1).
 *
 * 1:1 Flow aus notenlern-app:
 *   1. Session startet → targetNote (random aus Range)
 *   2. PianoKeyboard wird interaktiv gezeigt
 *   3. User tappt eine Taste → MIDI wird als "getippte Note" gespeichert
 *   4. NoteButtons erscheint: Note + Swipe (♯/♭) + Oktave
 *   5. User wählt Note+Oktave → submitNote(getippteMidi)
 *   6. Feedback → nächste Aufgabe
 *
 * Keine Audio-Engine, keine SharedValues — reine Tap-Interaktion.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoteButtons } from "@/components/controls/note-buttons";
import {
    PianoKeyboard,
    type KeyboardFeedback,
    type KeyboardZoomMode,
} from "@/components/piano-keyboard";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { LEARNING_CONFIG, getNotation } from "@/domain";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/stores/app-store";
import { useSessionStore } from "@/stores/session-store";

type ScreenPhase = "asking" | "input" | "feedback" | "done";

export default function PianoToNoteScreen() {
  const theme = useTheme();
  const { isCompact, isExpanded } = useBreakpoint();
  const insets = useSafeAreaInsets();

  // Stores
  const clef = useAppStore((s) => s.clef);
  const notationSystemId = useAppStore((s) => s.notationSystemId);
  const effectiveRange = useAppStore((s) => s.getEffectiveRange());

  const session = useSessionStore();
  const notation = getNotation(notationSystemId);

  // Local state
  const [phase, setPhase] = useState<ScreenPhase>("asking");
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [selectedKeyMidi, setSelectedKeyMidi] = useState<number | null>(null);

  // Keyboard-Zoom
  const [keyboardZoomMode, setKeyboardZoomMode] =
    useState<KeyboardZoomMode>("overview");

  // Refs
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Target Note
  const targetMidi = session.currentExercise?.targetNote.midi ?? null;
  const targetName =
    targetMidi !== null
      ? notation.midiToDisplay(targetMidi, { octaveStyle: "helmholtz" })
      : "";

  // ── Neue Aufgabe ──
  const OVERVIEW_DURATION_MS = 1500;

  useEffect(() => {
    if (phase !== "asking" || targetMidi === null) return;

    setWrongMidi(null);
    setSelectedKeyMidi(null);
    setKeyboardZoomMode("overview");

    const focusTimer = setTimeout(() => {
      setKeyboardZoomMode("focus");
    }, OVERVIEW_DURATION_MS);

    const inputTimer = setTimeout(() => {
      setPhase("input");
    }, OVERVIEW_DURATION_MS + 900);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(inputTimer);
    };
  }, [phase, targetMidi]);

  // ── Keyboard-Tap ──
  const handleKeyPress = useCallback((key: { midi: number }) => {
    if (phaseRef.current !== "input") return;
    setSelectedKeyMidi(key.midi);
  }, []);

  // ── Note+Oktave gewählt ──
  const handleNoteSelect = useCallback(
    (noteName: string, octave: number) => {
      if (phaseRef.current !== "input" || selectedKeyMidi === null) return;

      const result = session.submitNote(selectedKeyMidi);
      if (!result) return;

      setPhase("feedback");
      setFeedbackCorrect(result.correct);
      setWrongMidi(result.correct ? null : selectedKeyMidi);

      const delay = result.correct
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
    [session, selectedKeyMidi],
  );

  // ── Session starten ──
  useEffect(() => {
    if (!session.session) {
      session.startSession("piano-to-note", {
        range: effectiveRange,
        onlyNaturalNotes: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard Feedback
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

        {/* Status-Anzeige */}
        <ThemedView style={styles.displayCard}>
          {phase === "done" ? (
            <ThemedText type="title">Fertig!</ThemedText>
          ) : phase === "feedback" ? (
            <View style={styles.feedbackContainer}>
              <ThemedText
                type="title"
                style={{ color: feedbackCorrect ? "#22c55e" : "#ef4444" }}
              >
                {feedbackCorrect ? "✓ Richtig!" : "✗ Falsch"}
              </ThemedText>
              <ThemedText type="subtitle">
                {targetName}{" "}
                {feedbackCorrect
                  ? ""
                  : `(deine: ${selectedKeyMidi !== null ? notation.midiToDisplay(selectedKeyMidi, { octaveStyle: "helmholtz" }) : "?"})`}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.instructionContainer}>
              <ThemedText type="subtitle">
                {phase === "input"
                  ? selectedKeyMidi !== null
                    ? "Wähle den Notennamen:"
                    : "Tippe eine Taste auf dem Klavier:"
                  : "Bereit?"}
              </ThemedText>
              {selectedKeyMidi !== null && phase === "input" && (
                <ThemedText type="small" themeColor="textSecondary">
                  Getippt:{" "}
                  {notation.midiToDisplay(selectedKeyMidi, {
                    octaveStyle: "helmholtz",
                  })}
                </ThemedText>
              )}
            </View>
          )}
        </ThemedView>

        {/* Klaviatur */}
        <ThemedView style={styles.keyboardCard}>
          <PianoKeyboard
            targetMidi={phase === "feedback" ? targetMidi : null}
            wrongMidi={phase === "feedback" ? wrongMidi : null}
            feedback={keyboardFeedback}
            interactive={phase === "input"}
            onKeyPress={handleKeyPress}
            zoomMode={keyboardZoomMode}
            focusRange={[effectiveRange.minMidi, effectiveRange.maxMidi]}
          />
        </ThemedView>

        {/* NoteButtons — nur sichtbar wenn eine Taste getippt wurde */}
        {phase === "input" && selectedKeyMidi !== null && (
          <ThemedView style={styles.noteButtonsCard}>
            <NoteButtons onNoteSelect={handleNoteSelect} />
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
  displayCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    paddingTop: Spacing.six,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    minHeight: 120,
    backgroundColor: "rgba(128,128,128,0.08)",
  },
  feedbackContainer: {
    alignItems: "center",
    gap: Spacing.two,
  },
  instructionContainer: {
    alignItems: "center",
    gap: Spacing.one,
  },
  keyboardCard: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  noteButtonsCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
});
