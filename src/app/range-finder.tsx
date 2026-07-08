/**
 * Range Finder Screen (Phase 4.4) — Tonumfang-Finder.
 *
 * 1:1 aus notenlern-app:
 *   1. Start-Screen mit Timer-Slider (1–10s)
 *   2. Adaptiver Test: Notes werden basierend auf Antworten ausgewählt
 *   3. Pro Note: Timer + Position im System tippen
 *   4. Test-Ende → Range berechnen → übernehmen
 *
 * Nutzt RangeFinder-Domain + StaffView.
 */

import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StaffView } from "@/components/staff/staff-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  getNotation,
  getNoteStaffPosition,
  positionsMatch,
  RangeFinder,
  type RangeFinderState,
  type StaffPosition,
} from "@/domain";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/stores/app-store";

// ── Animations-Keyframes (1:1 aus notenlern-app CSS) ───────────────────────

// Note fly-in von rechts mit Motion-Blur-Look (skewX)
const flyInWithBlur = {
  from: {
    transform: [{ translateX: 80 }, { scale: 1.3 }, { skewX: "12deg" }],
    opacity: 0,
  },
  "60%": {
    transform: [{ translateX: -5 }, { scale: 1.05 }, { skewX: "-3deg" }],
    opacity: 1,
  },
  to: {
    transform: [{ translateX: 0 }, { scale: 1 }, { skewX: "0deg" }],
    opacity: 1,
  },
} as const;

// Wrong fly-out nach links mit Blur
const wrongFlyOut = {
  from: {
    transform: [{ scale: 1 }, { translateX: 0 }],
    opacity: 1,
  },
  "40%": {
    transform: [{ scale: 1.15 }, { translateX: 0 }],
    opacity: 1,
  },
  to: {
    transform: [{ scale: 0.8 }, { translateX: -200 }, { scaleX: 1.3 }],
    opacity: 0,
  },
} as const;

// Correct fly-out nach links (grün)
const correctFlyOut = {
  from: {
    transform: [{ scale: 1 }, { translateX: 0 }],
    opacity: 1,
  },
  "30%": {
    transform: [{ scale: 1.1 }, { translateX: 0 }],
    opacity: 1,
  },
  to: {
    transform: [{ scale: 0.8 }, { translateX: -200 }, { scaleX: 1.3 }],
    opacity: 0,
  },
} as const;

const TIME_LIMIT_LABELS: Record<number, string> = {
  1: "⚡",
  2: "🐆",
  3: "🦌",
  4: "🐇",
  5: "🦊",
  6: "🐈",
  7: "🐕",
  8: "🦔",
  9: "🐢",
  10: "🐌",
};

export default function RangeFinderScreen() {
  const theme = useTheme();
  const { isCompact } = useBreakpoint();
  const insets = useSafeAreaInsets();

  const notationSystemId = useAppStore((s) => s.notationSystemId);
  const setTrebleRange = useAppStore((s) => s.setTrebleRange);
  const setBassRange = useAppStore((s) => s.setBassRange);
  const notation = getNotation(notationSystemId);

  const [screenPhase, setScreenPhase] = useState<
    "start" | "testing" | "result"
  >("start");
  const [timeLimit, setTimeLimit] = useState(4);
  const [rfState, setRfState] = useState<RangeFinderState | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null,
  );
  const [feedbackNoteName, setFeedbackNoteName] = useState("");

  const rangeFinderRef = useRef<RangeFinder | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Start ──
  const beginTest = useCallback(() => {
    const rf = new RangeFinder(timeLimit * 1000);
    rangeFinderRef.current = rf;

    rf.onTimeout(() => {
      // Save note name before submit changes it
      const midi = rf.getState().currentNoteMidi;
      if (midi != null) {
        setFeedbackNoteName(
          notation.midiToDisplay(midi, { octaveStyle: "helmholtz" }),
        );
      }
      setFeedback("incorrect");
      setTimeout(() => setFeedback(null), 600);
    });

    setScreenPhase("testing");
    rf.start();
    setRfState(rf.getState());

    // Poll state every 100ms for timer updates
    pollIntervalRef.current = setInterval(() => {
      if (rangeFinderRef.current) {
        const state = rangeFinderRef.current.getState();
        setRfState(state);
        if (state.isComplete) {
          setScreenPhase("result");
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    }, 100);
  }, [timeLimit, notation]);

  // ── Position antippen ──
  const handlePositionSelect = useCallback(
    (position: StaffPosition) => {
      if (!rangeFinderRef.current || !rfState?.currentNoteMidi) return;

      const correctPosition = getNoteStaffPosition(
        rfState.currentNoteMidi,
        rfState.currentClef,
      );
      if (!correctPosition) return;

      const isCorrect = positionsMatch(position, correctPosition, true);

      // Save note name BEFORE submitting (submit changes the note)
      const midi = rfState.currentNoteMidi;
      if (midi != null) {
        setFeedbackNoteName(
          notation.midiToDisplay(midi, { octaveStyle: "helmholtz" }),
        );
      }

      if (isCorrect) {
        setFeedback("correct");
        setTimeout(() => setFeedback(null), 400);
      } else {
        setFeedback("incorrect");
        setTimeout(() => setFeedback(null), 600);
      }

      rangeFinderRef.current.submitAnswer(isCorrect);
      setRfState(rangeFinderRef.current.getState());
    },
    [rfState, notation],
  );

  // ── Range übernehmen ──
  const applyRange = useCallback(() => {
    if (!rfState?.foundRange) return;

    const foundMin = rfState.foundRange.minMidi;
    const foundMax = rfState.foundRange.maxMidi;
    const C4 = 60;

    const trebleMin = Math.max(foundMin, C4);
    const trebleMax = foundMax;
    if (trebleMax >= trebleMin) {
      setTrebleRange({ minMidi: trebleMin, maxMidi: trebleMax });
    }

    const bassMin = foundMin;
    const bassMax = Math.min(foundMax, C4 - 1);
    if (bassMax >= bassMin) {
      setBassRange({ minMidi: bassMin, maxMidi: bassMax });
    }

    router.push("/");
  }, [rfState, setTrebleRange, setBassRange]);

  // ── Cancel ──
  const cancel = useCallback(() => {
    rangeFinderRef.current?.destroy();
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    router.push("/");
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      rangeFinderRef.current?.destroy();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const contentInsets = {
    ...insets,
    bottom: insets.bottom + BottomTabInset + Spacing.three,
  };

  const currentNoteName =
    rfState?.currentNoteMidi != null
      ? notation.midiToDisplay(rfState.currentNoteMidi, {
          octaveStyle: "helmholtz",
        })
      : "";
  const timerProgress = rfState
    ? rfState.timeRemaining / (timeLimit * 1000)
    : 1;

  // Note-Text: bei Feedback den gespeicherten Namen zeigen, sonst aktuellen
  const displayNoteName = feedback ? feedbackNoteName : currentNoteName;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
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
            <ThemedText type="subtitle">Tonumfang-Finder</ThemedText>
            <Pressable onPress={cancel}>
              <ThemedText style={styles.backBtn}>← Zurück</ThemedText>
            </Pressable>
          </ThemedView>

          {/* ── Start Screen ── */}
          {screenPhase === "start" && (
            <ThemedView style={styles.startCard}>
              <ThemedText
                style={[styles.startEmoji, { fontSize: isCompact ? 100 : 180 }]}
              >
                {TIME_LIMIT_LABELS[timeLimit] || "🐇"}
              </ThemedText>
              <ThemedText type="title">Tonumfang testen</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Testet adaptiv deinen sicheren Notenbereich.
              </ThemedText>

              {/* Timer Slider */}
              <View style={styles.timerRow}>
                <View style={styles.timerSliderWrap}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setTimeLimit(n)}
                      style={[
                        styles.timerStep,
                        n === timeLimit && styles.timerStepActive,
                      ]}
                    >
                      <ThemedText
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: n === timeLimit ? "#fff" : theme.text,
                        }}
                      >
                        {n}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
                <ThemedText style={styles.timerValue}>{timeLimit}s</ThemedText>
              </View>

              <Pressable style={styles.startBtn} onPress={beginTest}>
                <ThemedText
                  style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}
                >
                  Start →
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {/* ── Testing ── */}
          {screenPhase === "testing" && rfState && (
            <>
              {/* Progress + Timer bar */}
              <ThemedView style={styles.progressCard}>
                <ThemedText type="small">
                  Getestet: {rfState.notesTestedCount} · Bestanden:{" "}
                  {rfState.notesPassedCount}
                </ThemedText>
                <View style={styles.timerBarBg}>
                  <View
                    style={[
                      styles.timerBarFill,
                      {
                        width: `${timerProgress * 100}%`,
                        backgroundColor:
                          timerProgress > 0.3 ? "#22c55e" : "#ef4444",
                      },
                    ]}
                  />
                </View>
              </ThemedView>

              {/* Layout: Note-Badge links + Staff rechts (wie alte App) */}
              <View style={styles.testLayout}>
                {/* Note Badge links */}
                <View style={styles.noteBadgeWrap}>
                  <Animated.View
                    key={`note-${rfState.currentNoteMidi}`}
                    style={[
                      styles.noteBadge,
                      {
                        animationName: feedback
                          ? feedback === "correct"
                            ? correctFlyOut
                            : wrongFlyOut
                          : flyInWithBlur,
                        animationDuration: feedback ? "500ms" : "400ms",
                        animationTimingFunction: "ease-out",
                        animationFillMode: "forwards",
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.noteBadgeText,
                        {
                          fontSize: isCompact ? 72 : 96,
                          color: feedback
                            ? feedback === "correct"
                              ? "#22c55e"
                              : "#ef4444"
                            : theme.text,
                        },
                      ]}
                    >
                      {displayNoteName}
                    </ThemedText>
                  </Animated.View>
                </View>

                {/* Staff rechts */}
                <View style={styles.staffWrap}>
                  {/* Timer bar über dem Staff */}
                  <View style={styles.staffTimerBarBg}>
                    <View
                      style={[
                        styles.staffTimerBarFill,
                        {
                          width: `${timerProgress * 100}%`,
                          backgroundColor:
                            timerProgress > 0.3 ? "#22c55e" : "#ef4444",
                        },
                      ]}
                    />
                  </View>
                  <StaffView
                    clef={rfState.currentClef}
                    displayMidi={
                      feedback === "correct" ? rfState.currentNoteMidi : null
                    }
                    displayColor={
                      feedback === "correct" ? "#22c55e" : theme.text
                    }
                    showFeedback={feedback === "correct"}
                    interactive={feedback === null}
                    onPositionSelect={handlePositionSelect}
                    width={isCompact ? 200 : 260}
                  />
                </View>
              </View>
            </>
          )}

          {/* ── Result ── */}
          {screenPhase === "result" && rfState && (
            <ThemedView style={styles.resultCard}>
              <ThemedText type="title">Dein Tonumfang</ThemedText>
              <ThemedText type="subtitle">
                {notation.midiToDisplay(rfState.foundRange.minMidi, {
                  octaveStyle: "helmholtz",
                })}{" "}
                –{" "}
                {notation.midiToDisplay(rfState.foundRange.maxMidi, {
                  octaveStyle: "helmholtz",
                })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {rfState.notesPassedCount} Noten bestanden
              </ThemedText>

              <View style={styles.resultActions}>
                <Pressable style={styles.applyBtn} onPress={applyRange}>
                  <ThemedText
                    style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}
                  >
                    ✓ Bereich übernehmen
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => router.push("/")}
                >
                  <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
                    Später
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
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
  backBtn: {
    fontSize: 16,
    color: "#4a90e2",
  },
  // ── Start Screen ──
  startCard: {
    alignItems: "center",
    padding: Spacing.five,
    borderRadius: 20,
    gap: Spacing.three,
    backgroundColor: "rgba(128,128,128,0.08)",
  },
  startEmoji: {
    lineHeight: 1,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  timerSliderWrap: {
    flexDirection: "row",
    gap: 4,
  },
  timerStep: {
    width: 28,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
    borderRadius: 6,
    overflow: "hidden",
  },
  timerStepActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  timerValue: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 40,
  },
  startBtn: {
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    overflow: "hidden",
  },
  // ── Testing ──
  progressCard: {
    alignItems: "center",
    padding: Spacing.two,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    backgroundColor: "rgba(128,128,128,0.08)",
  },
  timerBarBg: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(128,128,128,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  timerBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  testLayout: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "stretch",
    justifyContent: "center",
  },
  noteBadgeWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  noteBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  noteBadgeText: {
    fontWeight: "700",
    textAlign: "center",
  },
  staffWrap: {
    alignItems: "center",
    position: "relative",
  },
  staffTimerBarBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(128,128,128,0.2)",
    borderRadius: 2,
    overflow: "hidden",
    zIndex: 10,
  },
  staffTimerBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  // ── Result ──
  resultCard: {
    alignItems: "center",
    padding: Spacing.five,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  resultActions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  applyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    overflow: "hidden",
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(128,128,128,0.3)",
    overflow: "hidden",
  },
});
