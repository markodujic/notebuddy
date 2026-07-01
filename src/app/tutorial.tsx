/**
 * Tutorial Screen (Phase 4.3) — Erklärmodus.
 *
 * 1:1 aus notenlern-app (TutorialView.svelte):
 *   Phase 1: Animation der 2er/3er-Gruppen (passiv)
 *   Phase 2: Mic — 2er-Gruppen nachspielen
 *   Phase 3: Mic — 3er-Gruppen nachspielen
 *   Phase 4: Mic — alle 88 Tasten
 *
 * Keine Session, eigene State-Machine via useTutorialPhase.
 */

import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PianoKeyboard } from "@/components/piano-keyboard";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { DREIER_GRUPPEN, ZWEIER_GRUPPEN } from "@/domain";
import { useTheme } from "@/hooks/use-theme";
import { useTutorialPhase } from "@/hooks/use-tutorial-phase";

export default function TutorialScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const tutorial = useTutorialPhase();
  const {
    phase,
    greenKeys,
    animationStep,
    phase1Complete,
    chapterComplete,
    completedGroups,
    playedKeys,
    advanceToPhase2,
    advanceToPhase3,
    advanceToPhase4,
    restartAnimation,
    completeChapter,
  } = tutorial;

  const instructionText = getInstructionText(
    phase,
    phase1Complete,
    animationStep,
    chapterComplete,
  );
  const subtitleText = getSubtitleText(
    phase,
    completedGroups.size,
    playedKeys.size,
    phase1Complete,
    animationStep,
  );

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
          <ThemedText type="subtitle">Erklärmodus</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Phase {phase}/4
          </ThemedText>
        </ThemedView>

        {/* Instruction Card */}
        <ThemedView style={styles.instructionCard}>
          <ThemedText type="subtitle" style={styles.instructionText}>
            {instructionText}
          </ThemedText>
          {subtitleText ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitleText}
            </ThemedText>
          ) : null}
        </ThemedView>

        {/* Action Buttons je nach Phase */}
        <View style={styles.actions}>
          {phase === 1 && phase1Complete && (
            <>
              <ThemedText style={styles.actionBtn} onPress={restartAnimation}>
                ↺ Nochmal ansehen
              </ThemedText>
              <ThemedText
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={advanceToPhase2}
              >
                Weiter →
              </ThemedText>
            </>
          )}
          {phase === 1 && !phase1Complete && (
            <ThemedText style={styles.weiterBtn} onPress={advanceToPhase2}>
              Weiter
            </ThemedText>
          )}
          {phase === 2 && (
            <ThemedText style={styles.weiterBtn} onPress={advanceToPhase3}>
              Weiter
            </ThemedText>
          )}
          {phase === 3 && (
            <ThemedText style={styles.weiterBtn} onPress={advanceToPhase4}>
              Weiter
            </ThemedText>
          )}
          {phase === 4 && !chapterComplete && (
            <ThemedText style={styles.weiterBtn} onPress={completeChapter}>
              Weiter
            </ThemedText>
          )}
          {chapterComplete && (
            <ThemedText
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => router.push("/")}
            >
              Zurück zum Menü
            </ThemedText>
          )}
        </View>

        {/* Full 88-key Keyboard */}
        <ThemedView style={styles.keyboardCard}>
          <PianoKeyboard
            interactive={false}
            greenKeys={greenKeys}
            zoomMode="overview"
          />
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

function getInstructionText(
  phase: number,
  complete: boolean,
  step: number,
  chapterComplete: boolean,
): string {
  if (phase === 2) return "Spiele die schwarzen Tasten jeder 2er-Gruppe!";
  if (phase === 3) return "Spiele die schwarzen Tasten jeder 3er-Gruppe!";
  if (phase === 4)
    return chapterComplete
      ? "Kapitel 1 abgeschlossen!"
      : "Spiele alle Tasten auf dem Klavier!";
  if (complete) return "Das Muster wiederholt sich über die gesamte Klaviatur!";
  if (step < 0) return "Sieh dir das Muster der schwarzen Tasten an…";
  if (step < ZWEIER_GRUPPEN.length)
    return "2er-Gruppen – immer zwei schwarze Tasten nebeneinander";
  return "3er-Gruppen – immer drei schwarze Tasten nebeneinander";
}

function getSubtitleText(
  phase: number,
  completedCount: number,
  playedCount: number,
  complete: boolean,
  step: number,
): string {
  if (phase === 2) return `${completedCount} / ${ZWEIER_GRUPPEN.length}`;
  if (phase === 3) return `${completedCount} / ${DREIER_GRUPPEN.length}`;
  if (phase === 4) return complete ? "" : `${playedCount} / 88`;
  if (complete || step < 0) return "";
  if (step < ZWEIER_GRUPPEN.length)
    return `${step + 1} / ${ZWEIER_GRUPPEN.length}`;
  const idx = step - ZWEIER_GRUPPEN.length;
  return `${idx + 1} / ${DREIER_GRUPPEN.length}`;
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
  instructionCard: {
    alignItems: "center",
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    backgroundColor: "rgba(102, 126, 234, 0.12)",
  },
  instructionText: {
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: "rgba(128,128,128,0.3)",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: "600",
    overflow: "hidden",
  },
  actionBtnPrimary: {
    backgroundColor: "#4a90e2",
    color: "#fff",
    borderColor: "#4a90e2",
  },
  weiterBtn: {
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderRadius: 12,
    backgroundColor: "#4a90e2",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    overflow: "hidden",
  },
  keyboardCard: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
});
