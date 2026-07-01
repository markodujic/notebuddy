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
import { ScrollView, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
    type StaffPosition
} from "@/domain";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/stores/app-store";

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

  const rangeFinderRef = useRef<RangeFinder | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Start ──
  const beginTest = useCallback(() => {
    const rf = new RangeFinder(timeLimit * 1000);
    rangeFinderRef.current = rf;

    rf.onTimeout(() => {
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
  }, [timeLimit]);

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
    [rfState],
  );

  // ── Range übernehmen ──
  const applyRange = useCallback(() => {
    if (!rfState?.foundRange) return;

    const foundMin = rfState.foundRange.minMidi;
    const foundMax = rfState.foundRange.maxMidi;
    const C4 = 60;

    // Treble: C4 und darüber
    const trebleMin = Math.max(foundMin, C4);
    const trebleMax = foundMax;
    if (trebleMax >= trebleMin) {
      setTrebleRange({ minMidi: trebleMin, maxMidi: trebleMax });
    }

    // Bass: unter C4
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
            <ThemedText style={styles.backBtn} onPress={cancel}>
              ← Zurück
            </ThemedText>
          </ThemedView>

          {/* ── Start Screen ── */}
          {screenPhase === "start" && (
            <ThemedView style={styles.startCard}>
              <ThemedText type="title">Tonumfang testen</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Testet adaptiv deinen sicheren Notenbereich.
              </ThemedText>

              {/* Timer Slider */}
              <View style={styles.timerRow}>
                <ThemedText style={styles.timerEmoji}>
                  {TIME_LIMIT_LABELS[timeLimit] || "🐇"}
                </ThemedText>
                <View style={styles.timerSliderWrap}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <ThemedText
                      key={n}
                      style={[
                        styles.timerStep,
                        n === timeLimit && styles.timerStepActive,
                      ]}
                      onPress={() => setTimeLimit(n)}
                    >
                      {n}
                    </ThemedText>
                  ))}
                </View>
                <ThemedText style={styles.timerValue}>{timeLimit}s</ThemedText>
              </View>

              <ThemedText style={styles.startBtn} onPress={beginTest}>
                Start →
              </ThemedText>
            </ThemedView>
          )}

          {/* ── Testing ── */}
          {screenPhase === "testing" && rfState && (
            <>
              {/* Progress */}
              <ThemedView style={styles.progressCard}>
                <ThemedText type="small">
                  Getestet: {rfState.notesTestedCount} · Bestanden:{" "}
                  {rfState.notesPassedCount}
                </ThemedText>
                {/* Timer bar */}
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

              {/* Staff */}
              <ThemedView style={styles.staffCard}>
                <StaffView
                  clef={rfState.currentClef}
                  displayMidi={
                    feedback === "correct" ? rfState.currentNoteMidi : null
                  }
                  displayColor={feedback === "correct" ? "#22c55e" : theme.text}
                  interactive={feedback === null}
                  onPositionSelect={handlePositionSelect}
                  width={isCompact ? 280 : 340}
                />
              </ThemedView>
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
                <ThemedText style={styles.applyBtn} onPress={applyRange}>
                  ✓ Bereich übernehmen
                </ThemedText>
                <ThemedText
                  style={styles.cancelBtn}
                  onPress={() => router.push("/")}
                >
                  Später
                </ThemedText>
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
  startCard: {
    alignItems: "center",
    padding: Spacing.five,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    backgroundColor: "rgba(128,128,128,0.08)",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  timerEmoji: {
    fontSize: 32,
  },
  timerSliderWrap: {
    flexDirection: "row",
    gap: 4,
  },
  timerStep: {
    width: 28,
    height: 36,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 14,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
    borderRadius: 6,
    overflow: "hidden",
  },
  timerStepActive: {
    backgroundColor: "#4a90e2",
    color: "#fff",
    borderColor: "#4a90e2",
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
    backgroundColor: "#4a90e2",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    overflow: "hidden",
  },
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
  staffCard: {
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
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
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    overflow: "hidden",
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(128,128,128,0.3)",
    fontSize: 16,
    fontWeight: "600",
    overflow: "hidden",
  },
});
