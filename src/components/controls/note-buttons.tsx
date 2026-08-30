/**
 * NoteButtons – Noten-Auswahl für "Klavier → Note" Modus.
 *
 * 1:1 Portierung aus notenlern-app (NoteButtons.svelte).
 * Zwei Bereiche:
 *   1. Oktave-Row: 9 Helmholtz-Oktav-Labels (C,, bis c′′′′′)
 *   2. Notes-Grid: 7 Noten-Buttons (C D E F G A H) mit Swipe-Geste
 *      - Swipe hoch = ♯ (sharp)
 *      - Swipe runter = ♭ (flat)
 *      - Tap ohne Swipe = Stammtone (kein Vorzeichen)
 *
 * Flow: User wählt Note (+ Vorzeichen via Swipe), dann Oktave → callback.
 */

import { useCallback, useEffect, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from "react-native-reanimated";

/** Helmholtz-Oktav-Labels (1:1 aus alter App). */
const OCTAVES: { value: number; label: string }[] = [
  { value: 0, label: "C,," },
  { value: 1, label: "C," },
  { value: 2, label: "C" },
  { value: 3, label: "c" },
  { value: 4, label: "c′" },
  { value: 5, label: "c′′" },
  { value: 6, label: "c′′′" },
  { value: 7, label: "c′′′′" },
  { value: 8, label: "c′′′′′" },
];

/** Die 7 Stammtöne (German notation). */
const NOTES = ["C", "D", "E", "F", "G", "A", "H"] as const;

/** Swipe-Schwelle in Pixeln. */
const SWIPE_THRESHOLD = 20;

export interface NoteButtonsProps {
  /** Callback: Wird aufgerufen wenn Note+Oktave gewählt. */
  onNoteSelect: (noteName: string, octave: number) => void;
  /** Optional: Callback bei "Zurück". */
  onBack?: () => void;
  /** Landscape-Modus (kompakter). */
  landscape?: boolean;
  /** Ändert sich der Key, wird die Auswahl zurückgesetzt (1:1 wie `$: if (targetNote !== lastTargetNote)` im Original). */
  resetKey?: number | string;
}

export function NoteButtons({
  onNoteSelect,
  onBack,
  landscape = false,
  resetKey,
}: NoteButtonsProps) {
  const [selectedNote, setSelectedNote] = useState("");
  const [selectedAccidental, setSelectedAccidental] = useState("");
  const [flashOctave, setFlashOctave] = useState(-1);

  // 1:1 wie im Original: Bei neuer Aufgabe Auswahl zurücksetzen
  useEffect(() => {
    setSelectedNote("");
    setSelectedAccidental("");
  }, [resetKey]);

  const handleOctaveClick = useCallback(
    (octave: number) => {
      setFlashOctave(octave);
      setTimeout(() => setFlashOctave(-1), 300);
      if (selectedNote) {
        const fullName = selectedNote + selectedAccidental;
        onNoteSelect(fullName, octave);
      }
    },
    [selectedNote, selectedAccidental, onNoteSelect],
  );

  const handleNoteSelect = useCallback((note: string, accidental: string) => {
    setSelectedNote(note);
    setSelectedAccidental(accidental);
  }, []);

  return (
    <View style={styles.container}>
      {/* Oktave-Row */}
      <View style={styles.octaveRow}>
        <View style={styles.octaveGrid}>
          {OCTAVES.map((oct) => (
            <Pressable
              key={oct.value}
              style={[
                styles.octaveBtn,
                flashOctave === oct.value && styles.octaveFlash,
              ]}
              onPress={() => handleOctaveClick(oct.value)}
            >
              <Text style={styles.octaveLabel}>{oct.label}</Text>
            </Pressable>
          ))}
        </View>
        {onBack && (
          <Pressable style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backLabel}>← Zurück</Text>
          </Pressable>
        )}
      </View>

      {/* Notes-Grid mit Swipe */}
      <View style={styles.notesGrid}>
        {NOTES.map((note) => (
          <NoteButton
            key={note}
            note={note}
            selected={selectedNote === note && !selectedAccidental}
            onSelect={handleNoteSelect}
          />
        ))}
      </View>
    </View>
  );
}

// ── Einzelner Noten-Button mit Swipe-Geste ──────────────────────────────

interface NoteButtonProps {
  note: string;
  selected: boolean;
  onSelect: (note: string, accidental: string) => void;
}

function NoteButton({ note, selected, onSelect }: NoteButtonProps) {
  const translateY = useSharedValue(0);
  const swipeAccidental = useSharedValue("");
  const [displayAccidental, setDisplayAccidental] = useState("");

  const pan = Gesture.Pan()
    .onBegin((e) => {
      translateY.value = e.absoluteY;
    })
    .onUpdate((e) => {
      const delta = -e.translationY; // positiv = hoch = ♯
      if (delta > SWIPE_THRESHOLD) {
        swipeAccidental.value = "♯";
      } else if (delta < -SWIPE_THRESHOLD) {
        swipeAccidental.value = "♭";
      } else {
        swipeAccidental.value = "";
      }
    })
    .onEnd((e) => {
      const delta = -e.translationY;
      let accidental = "";
      if (delta > SWIPE_THRESHOLD) {
        accidental = "#";
      } else if (delta < -SWIPE_THRESHOLD) {
        accidental = "b";
      }
      const symbol = accidental === "#" ? "♯" : accidental === "b" ? "♭" : "";
      runOnJS(setDisplayAccidental)(symbol);
      runOnJS(onSelect)(note, accidental);
      swipeAccidental.value = "";
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isSwiping = swipeAccidental.value !== "";
    return {
      transform: [{ scale: withSpring(isSwiping ? 1.06 : 1) }],
      backgroundColor: selected
        ? "#ffd700"
        : isSwiping
          ? `rgba(255, 215, 0, 0.3)`
          : "#2d2d44",
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.noteBtn,
          animatedStyle,
          selected && styles.noteBtnSelected,
        ]}
      >
        <Text style={[styles.noteLabel, selected && styles.noteLabelSelected]}>
          {note}
          {displayAccidental}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  octaveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  octaveGrid: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
  },
  octaveBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#8a8aab",
    borderRadius: 8,
    backgroundColor: "#9a9abb",
    paddingVertical: 10,
  },
  octaveFlash: {
    backgroundColor: "#2d2d44",
    borderColor: "#2d2d44",
  },
  octaveLabel: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  backBtn: {
    borderWidth: 2,
    borderColor: "#d4c9a8",
    borderRadius: 6,
    backgroundColor: "#f5edd6",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5a5040",
  },
  notesGrid: {
    flexDirection: "row",
    gap: 3,
  },
  noteBtn: {
    flex: 1,
    aspectRatio: 1.5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#2d2d44",
    borderRadius: 12,
    backgroundColor: "#2d2d44",
  },
  noteBtnSelected: {
    borderColor: "#ffd700",
  },
  noteLabel: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  noteLabelSelected: {
    color: "#333",
  },
});
