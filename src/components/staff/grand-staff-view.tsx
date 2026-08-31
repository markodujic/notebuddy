/**
 * GrandStaffView – Skia-basiertes Doppelsystem (Violin- + Bassschlüssel).
 *
 * 1:1 aus notenlern-app GrandStaffView.svelte, aber aufgebaut aus den
 * gemeinsamen Staff-Primitives (staff-primitives.tsx) und dem geteilten
 * Pergament-Picture → optisch identisch mit StaffView.
 *
 * Zeichnet:
 *   - Pergament-Hintergrund als offscreen Picture (1 Draw-Call, Dark-Vignette)
 *   - Violin-System (oben) + Bass-System (unten) via StaffLines
 *   - Akkolade-Klammer (Brace) + durchgehende Taktlinie
 *   - Schlüssel für beide Systeme via ClefGlyph
 *   - Note auf dem korrekten System (C4+ = Violin, <C4 = Bass)
 *     als Bravura-Glyph (Ink-Box-zentriert) + Stem + Hilfslinien
 *
 * Nicht interaktiv — reine Display-Komponente.
 */

import { Canvas, Line, Picture, Text, useFont } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  BRAVURA_FONT_FAMILY,
  PARCHMENT_COLORS,
  SMUFL,
  STAFF_METRICS,
} from "@/constants/music-font";
import { getNoteStaffPosition, type Clef } from "@/domain";
import { useAppStore } from "@/stores/app-store";
import { useParchmentPicture } from "./parchment-picture";
import { noteHeadGeom } from "./staff-glyphs";
import {
  ClefGlyph,
  LedgerLines,
  NoteHeadGlyph,
  StaffLines,
  Stem,
} from "./staff-primitives";
import {
  STAFF_HEIGHT,
  getLedgerLineYs,
  getStaffLineYs,
  getYForPosition,
} from "./staff-geometry";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GrandStaffViewProps {
  /** Anzuzeigende Note (MIDI). */
  midi: number;
  /** Farbe der Note (Default: Parchment noteHead). */
  noteColor?: string;
  /** Breite (Default: 340). */
  width?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Abstand zwischen Violin- und Bass-System. */
const SYSTEM_SPACING = 40;

/** Y-Offset des Violinsystems. */
const TREBLE_TOP_Y = 20;

/** Oberer/unterer Rand links/rechts der Systemlinien. */
const LINE_X_START = 20;
const LINE_X_END = 20;

const LEFT_MARGIN = 60;
const NOTE_X_OFFSET = 0.65; // Note bei 65% der Breite

// ── Component ──────────────────────────────────────────────────────────────

export const GrandStaffView = memo(function GrandStaffView({
  midi,
  noteColor,
  width = STAFF_METRICS.CANVAS_SIZE,
}: GrandStaffViewProps) {
  // Theme folgt dem App-Dark-Mode-Toggle (wie StaffView, eine Quelle der Wahrheit)
  const darkMode = useAppStore((s) => s.darkMode);
  const parchmentColors = darkMode
    ? PARCHMENT_COLORS.DARK
    : PARCHMENT_COLORS.LIGHT;

  // Höhe: 2 Systeme + Abstand + Rand oben/unten
  const height = TREBLE_TOP_Y * 2 + STAFF_HEIGHT * 2 + SYSTEM_SPACING;

  const trebleTopY = TREBLE_TOP_Y;
  const bassTopY = trebleTopY + STAFF_HEIGHT + SYSTEM_SPACING;

  const trebleLineYs = useMemo(() => getStaffLineYs(trebleTopY), [trebleTopY]);
  const bassLineYs = useMemo(() => getStaffLineYs(bassTopY), [bassTopY]);

  const bravuraTrebleFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.CLEF_TREBLE_SIZE);
  const bravuraBassFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.CLEF_BASS_SIZE);
  const braceFont = useFont(BRAVURA_FONT_FAMILY, height - trebleTopY + 20);
  // Notenkopf-Glyph: 1 em = 4 Staff-Spaces (SMuFL) → Kopf ist 1 Space hoch
  const noteFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.NOTE_GLYPH_FONT_SIZE);
  const headGeom = noteHeadGeom(noteFont);

  // Pergament als offscreen Picture (gecached, 1 Draw-Call, Dark-Vignette)
  const parchment = useParchmentPicture(width, height, parchmentColors);

  // Bestimme, welches System verwendet wird (C4+ = treble, <C4 = bass)
  const useTreble = midi >= 60;
  const clef: Clef = useTreble ? "treble" : "bass";
  const activeTopY = useTreble ? trebleTopY : bassTopY;
  const activeLineYs = useTreble ? trebleLineYs : bassLineYs;

  // Note positionieren
  const notePosition = useMemo(
    () => getNoteStaffPosition(midi, clef),
    [midi, clef],
  );
  const noteX = width * NOTE_X_OFFSET;
  const noteY = notePosition ? getYForPosition(notePosition, activeTopY) : 0;

  // Hilfslinien
  const ledgerYs = useMemo(() => {
    if (!notePosition) return [];
    return getLedgerLineYs(notePosition, activeTopY);
  }, [notePosition, activeTopY]);

  // Middle line für Stem-Richtung
  const middleLineY = activeLineYs[2];

  const color = noteColor ?? parchmentColors.noteHead;

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height }}>
        {/* Pergament-Hintergrund + Textur + Vignette (1 Draw-Call) */}
        {parchment && <Picture picture={parchment} />}

        {/* Violin-System (5 Linien) */}
        <StaffLines
          lineYs={trebleLineYs}
          x0={LEFT_MARGIN - LINE_X_START}
          x1={width - LINE_X_END}
          color={parchmentColors.staffLine}
        />

        {/* Bass-System (5 Linien) */}
        <StaffLines
          lineYs={bassLineYs}
          x0={LEFT_MARGIN - LINE_X_START}
          x1={width - LINE_X_END}
          color={parchmentColors.staffLine}
        />

        {/* Durchgehende Taktlinie */}
        <Line
          p1={{ x: LEFT_MARGIN - LINE_X_START - 2, y: trebleTopY }}
          p2={{ x: LEFT_MARGIN - LINE_X_START - 2, y: bassTopY + STAFF_HEIGHT }}
          color={parchmentColors.staffLine}
          strokeWidth={2.5}
        />

        {/* Akkolade-Klammer (Brace) */}
        {braceFont && (
          <Text
            x={LEFT_MARGIN - LINE_X_START - 4}
            y={trebleTopY + (height - trebleTopY) / 2 + 10}
            text={SMUFL.BRACE}
            font={braceFont}
            color={parchmentColors.clef}
          />
        )}

        {/* Schlüssel */}
        <ClefGlyph
          clef="treble"
          x={LEFT_MARGIN - 10}
          lineYs={trebleLineYs}
          font={bravuraTrebleFont}
          color={parchmentColors.clef}
        />
        <ClefGlyph
          clef="bass"
          x={LEFT_MARGIN - 10}
          lineYs={bassLineYs}
          font={bravuraBassFont}
          color={parchmentColors.clef}
        />

        {/* Hilfslinien für die Note */}
        <LedgerLines
          ys={ledgerYs}
          noteX={noteX}
          color={parchmentColors.staffLine}
        />

        {/* Notenhals (Stem) */}
        <Stem
          x={noteX}
          noteY={noteY}
          middleLineY={middleLineY}
          halfWidth={headGeom.centerX}
          color={color}
        />

        {/* Notenkopf als Bravura-Glyph (wie StaffView) */}
        {noteFont && (
          <NoteHeadGlyph
            font={noteFont}
            geom={headGeom}
            x={noteX}
            y={noteY}
            color={color}
          />
        )}
      </Canvas>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    // „Blatt"-Rahmen wie StaffView: abgerundet, feine Kante, weicher Schatten
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(128, 128, 128, 0.28)",
    overflow: "hidden",
    // iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    // Android
    elevation: 4,
  },
});
