/**
 * StaffView – Skia-basiertes Notensystem (1:1 aus notenlern-app).
 *
 * Zeichnet:
 *   - Pergament-Hintergrund mit Textur (Rauschen + Fasern)
 *   - 5 Hauptlinien
 *   - Guide-Hilfslinien (subtil, als Orientierung)
 *   - Violin- oder Bassschlüssel (Bravura Font)
 *   - Notenkopf als Oval (rotiert) + Stem (UP/DOWN)
 *   - Hilfslinien für Noten außerhalb des Systems
 *   - Falsche Note: Blink-Animation (darkred, opacity oszilliert)
 *   - Richtige Note: Fade-In Animation
 *   - Hover-Indikator bei interaktivem Modus
 *
 * Interaktiv: Klick/Touch → onPositionSelect Callback.
 */

import {
  Canvas,
  Group,
  Line,
  Picture,
  RoundedRect,
  useFont,
} from "@shopify/react-native-skia";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import {
  STAFF_FEEDBACK_COLORS,
  STAFF_METRICS,
  PARCHMENT_COLORS,
  BRAVURA_FONT_FAMILY,
} from "@/constants/music-font";
import { getNoteStaffPosition, type Clef, type StaffPosition } from "@/domain";
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
  getPositionFromY,
  getStaffLineYs,
  getYForPosition,
} from "./staff-geometry";

// ── Types ──────────────────────────────────────────────────────────────────

export interface StaffViewProps {
  /** Notenschlüssel. */
  clef: Clef;
  /** Anzuzeigende Note (MIDI). */
  displayMidi?: number | null;
  /** Farbe der angezeigten Note (Default: Theme text). */
  displayColor?: string;
  /** Falsche Note (MIDI) – rot blinkend. */
  wrongMidi?: number | null;
  /** Feedback einblenden? (Fade-In Animation) */
  showFeedback?: boolean;
  /** Interaktiv? (Klicks erlauben) */
  interactive?: boolean;
  /** Callback bei Positionswahl. */
  onPositionSelect?: (position: StaffPosition) => void;
  /** Breite des Systems (Default: 340). */
  width?: number;
}

type StaffCanvasProps = {
  clef: Clef;
  displayPosition: StaffPosition | null;
  displayColor: string;
  wrongPosition: StaffPosition | null;
  topY: number;
  width: number;
  height: number;
  parchmentColors: (typeof PARCHMENT_COLORS)[keyof typeof PARCHMENT_COLORS];
  hoverPosition: StaffPosition | null;
  fadeOpacity: SharedValue<number>;
  blinkOpacity: SharedValue<number>;
  /** Horizontale Shake-Animation für falsche Note (px, UI-Thread). */
  shakeX: SharedValue<number>;
  /** Atem-Puls des Glow-Rings (UI-Thread). */
  glowPulse: SharedValue<number>;
  showGlow: boolean;
};

// ── Inner Canvas Component ────────────────────────────────────────────────

function StaffCanvasInner({
  clef,
  displayPosition,
  displayColor,
  wrongPosition,
  topY,
  width,
  height,
  parchmentColors,
  hoverPosition,
  fadeOpacity,
  blinkOpacity,
  shakeX,
  glowPulse,
  showGlow,
}: StaffCanvasProps) {
  const bravuraTrebleFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.CLEF_TREBLE_SIZE);
  const bravuraBassFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.CLEF_BASS_SIZE);
  // Notenkopf-Glyph: 1 em = 4 Staff-Spaces (SMuFL) → Kopf ist 1 Space hoch
  const noteFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.NOTE_GLYPH_FONT_SIZE);
  const lineYs = useMemo(() => getStaffLineYs(topY), [topY]);
  const clefX = STAFF_METRICS.CLEF_X; // LEFT_MARGIN + 40 (1:1 wie alte App)
  const noteX = width / 2;

  // Pergament als offscreen Picture (gecached, 1 Draw-Call)
  const parchment = useParchmentPicture(width, height, parchmentColors);

  // Guide-Hilfslinien (subtil, alpha=0.15) — Positionen 1,3,5,7,9 oben+unten
  const guideLedgers = useMemo(() => {
    const result: number[] = [];
    for (let i = 1; i <= 9; i += 2) {
      result.push(lineYs[0] - i * STAFF_METRICS.LINE_SPACING);
    }
    for (let i = 1; i <= 9; i += 2) {
      result.push(lineYs[4] + i * STAFF_METRICS.LINE_SPACING);
    }
    return result;
  }, [lineYs]);

  // Hilfslinien für Display-Note
  const displayLedgers = useMemo(() => {
    if (!displayPosition) return [];
    return getLedgerLineYs(displayPosition, topY);
  }, [displayPosition, topY]);

  // Hilfslinien für Wrong-Note
  const wrongLedgers = useMemo(() => {
    if (!wrongPosition) return [];
    return getLedgerLineYs(wrongPosition, topY);
  }, [wrongPosition, topY]);

  // Hover-Hilfslinien
  const hoverLedgers = useMemo(() => {
    if (!hoverPosition) return [];
    return getLedgerLineYs(hoverPosition, topY);
  }, [hoverPosition, topY]);

  const displayY = displayPosition ? getYForPosition(displayPosition, topY) : 0;
  const wrongY = wrongPosition ? getYForPosition(wrongPosition, topY) : 0;
  const hoverY = hoverPosition ? getYForPosition(hoverPosition, topY) : 0;

  // Middle line für Stem-Richtung
  const middleLineY = lineYs[2];

  // Shake-Transform für die falsche Note (nativ, UI-Thread)
  const wrongShake = useDerivedValue(() => [{ translateX: shakeX.value }]);

  // Notenkopf-Geometrie (gemessen) – Kopf exakt auf Note-Position zentrieren
  const headGeom = noteHeadGeom(noteFont);
  const stemOffsetX = headGeom.centerX;

  return (
    <Canvas style={{ width, height }}>
      {/* ── Pergament-Hintergrund + Textur (ein Draw-Call) ── */}
      {parchment && <Picture picture={parchment} />}

      {/* ── Guide-Hilfslinien (subtile Orientierung) ── */}
      <Group opacity={STAFF_METRICS.GUIDE_LEDGER_ALPHA}>
        {guideLedgers.map((y, i) => (
          <Line
            key={`guide-${i}`}
            p1={{ x: noteX - 22, y }}
            p2={{ x: noteX + 22, y }}
            color={parchmentColors.staffLine}
            strokeWidth={1.5}
          />
        ))}
      </Group>

      {/* ── 5 Hauptlinien ── */}
      <StaffLines lineYs={lineYs} x0={15} x1={width - 15} color={parchmentColors.staffLine} />

      {/* ── Schlüssel ── */}
      {clef === "treble" ? (
        <ClefGlyph
          clef="treble"
          x={clefX}
          lineYs={lineYs}
          font={bravuraTrebleFont}
          color={parchmentColors.clef}
        />
      ) : (
        <ClefGlyph
          clef="bass"
          x={clefX}
          lineYs={lineYs}
          font={bravuraBassFont}
          color={parchmentColors.clef}
        />
      )}

      {/* ── Hilfslinien für Display-Note (mit Pergament-Freilegung, 1:1) ── */}
      <LedgerLines
        ys={displayLedgers}
        noteX={noteX}
        color={parchmentColors.staffLine}
        clearColor={parchmentColors.bg}
      />

      {/* ── Falsche Note (blinkend + Shake, darkred) ── */}
      {wrongPosition && (
        <Group transform={wrongShake}>
          {/* Hilfslinien für wrong note (mit Pergament-Freilegung) */}
          <LedgerLines
            ys={wrongLedgers}
            noteX={noteX}
            color={parchmentColors.staffLine}
            clearColor={parchmentColors.bg}
          />
          {/* Stem */}
          <Stem
            x={noteX}
            noteY={wrongY}
            middleLineY={middleLineY}
            halfWidth={stemOffsetX}
            color={STAFF_FEEDBACK_COLORS.WRONG_BLINK}
            opacity={blinkOpacity}
          />
          {/* Notenkopf als Bravura-Glyph (Ink-Box auf wrongY zentriert) */}
          {noteFont && (
            <NoteHeadGlyph
              font={noteFont}
              geom={headGeom}
              x={noteX}
              y={wrongY}
              color={STAFF_FEEDBACK_COLORS.WRONG_BLINK}
              opacity={blinkOpacity}
            />
          )}
        </Group>
      )}

      {/* ── Display-Note ── */}
      {displayPosition && (
        <>
          {/* Glow-Effekt für korrekte Antworten (grüner Ring um Glyph) */}
          {showGlow && noteFont && (
            <NoteHeadGlyph
              font={noteFont}
              geom={headGeom}
              x={noteX}
              y={displayY}
              color={STAFF_FEEDBACK_COLORS.CORRECT_GLOW}
              outline
              outlineWidth={8}
              opacity={glowPulse}
            />
          )}
          {/* Stem */}
          <Stem
            x={noteX}
            noteY={displayY}
            middleLineY={middleLineY}
            halfWidth={stemOffsetX}
            color={displayColor}
            opacity={fadeOpacity}
          />
          {/* Notenkopf als Bravura-Glyph (Ink-Box auf displayY zentriert) */}
          {noteFont && (
            <NoteHeadGlyph
              font={noteFont}
              geom={headGeom}
              x={noteX}
              y={displayY}
              color={displayColor}
              opacity={fadeOpacity}
            />
          )}
        </>
      )}

      {/* ── Hover-Indikator ── */}
      {hoverPosition && !displayPosition && !wrongPosition && (
        <>
          {/* Hilfslinien für Hover-Position */}
          <LedgerLines
            ys={hoverLedgers}
            noteX={noteX}
            color={parchmentColors.staffLine}
            extend={20}
          />
          {/* Kreis */}
          <RoundedRect
            x={noteX - STAFF_METRICS.HOVER_RADIUS}
            y={hoverY - STAFF_METRICS.HOVER_RADIUS}
            width={STAFF_METRICS.HOVER_RADIUS * 2}
            height={STAFF_METRICS.HOVER_RADIUS * 2}
            r={STAFF_METRICS.HOVER_RADIUS}
            color={STAFF_FEEDBACK_COLORS.HOVER_FILL}
          />
          {/* Notenkopf-Umriss als Glyph */}
          {noteFont && (
            <NoteHeadGlyph
              font={noteFont}
              geom={headGeom}
              x={noteX}
              y={hoverY}
              color={STAFF_FEEDBACK_COLORS.HOVER_STROKE}
              outline
              outlineWidth={2}
            />
          )}
        </>
      )}
    </Canvas>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export const StaffView = memo(function StaffView({
  clef,
  displayMidi,
  displayColor,
  wrongMidi,
  showFeedback,
  interactive = false,
  onPositionSelect,
  width = STAFF_METRICS.CANVAS_SIZE,
}: StaffViewProps) {
  const darkMode = useAppStore((s) => s.darkMode);
  const isDark = darkMode; // Theme folgt dem App-Dark-Mode-Toggle (1:1 wie data-theme)
  const height = width; // Quadratisch wie alte App
  const topY = (height - STAFF_HEIGHT) / 2;

  // Pergament-Farben basierend auf Theme
  const parchmentColors = isDark
    ? PARCHMENT_COLORS.DARK
    : PARCHMENT_COLORS.LIGHT;

  // Animation: Fade-In für korrekte Note (0 → 1, 800ms)
  const fadeOpacity = useSharedValue(1);
  // Animation: Blink für falsche Note (oszilliert 0.3 ↔ 1.0, 300ms)
  const blinkOpacity = useSharedValue(1);
  // Animation: Shake für falsche Note (kurz, 2px, native)
  const shakeX = useSharedValue(0);
  // Animation: Atem-Puls für den Glow-Ring (native)
  const glowPulse = useSharedValue(1);

  // Hover State
  const [hoverPosition, setHoverPosition] = useState<StaffPosition | null>(
    null,
  );

  const displayPosition = useMemo(() => {
    if (displayMidi === null || displayMidi === undefined) return null;
    return getNoteStaffPosition(displayMidi, clef);
  }, [displayMidi, clef]);

  const wrongPosition = useMemo(() => {
    if (wrongMidi === null || wrongMidi === undefined) return null;
    return getNoteStaffPosition(wrongMidi, clef);
  }, [wrongMidi, clef]);

  // 1:1 wie das Original:
  //   - Aufdeckung nach falscher Antwort (showFeedback) → GRÜNE Note, kein Glow
  //   - normale Anzeige → Note-Kopf-Farbe + grüner Glow
  const noteColor = showFeedback
    ? STAFF_FEEDBACK_COLORS.CORRECT
    : (displayColor ?? parchmentColors.noteHead);
  const showGlow = !!displayPosition && !showFeedback;

  // ── Fade-In Animation wenn showFeedback ──
  useEffect(() => {
    if (showFeedback && displayPosition) {
      fadeOpacity.set(0);
      fadeOpacity.set(withTiming(1, { duration: 800 }));
    } else {
      fadeOpacity.set(1);
    }
  }, [showFeedback, displayPosition, fadeOpacity]);

  // ── Blink Animation für falsche Note ──
  useEffect(() => {
    if (wrongPosition) {
      // Oszilliere zwischen 0.3 und 1.0 alle 300ms
      blinkOpacity.set(
        withRepeat(
          withSequence(
            withTiming(0.3, { duration: 300 }),
            withTiming(1, { duration: 300 }),
          ),
          -1, // infinite
          true,
        ),
      );
    } else {
      blinkOpacity.set(1);
    }
  }, [wrongPosition, blinkOpacity]);

  // ── Shake für falsche Note (3 kurze Zyklen, dann Ruhe) ──
  useEffect(() => {
    if (wrongPosition) {
      shakeX.set(
        withSequence(
          withTiming(2.5, { duration: 70 }),
          withTiming(-2.5, { duration: 130 }),
          withTiming(1.8, { duration: 110 }),
          withTiming(-1.8, { duration: 110 }),
          withTiming(0, { duration: 90 }),
        ),
      );
    } else {
      shakeX.set(0);
    }
  }, [wrongPosition, shakeX]);

  // ── Atem-Puls des Glow-Rings (ein Zyklus: kurz dunkel, dann voll) ──
  useEffect(() => {
    if (showGlow && displayPosition) {
      glowPulse.set(
        withSequence(
          withTiming(0.1, { duration: 250 }),
          withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }),
        ),
      );
    } else {
      glowPulse.set(1);
    }
  }, [showGlow, displayPosition, glowPulse]);

  // ── Touch Handler (1:1: Klicks gesperrt während wrongPosition angezeigt wird) ──
  const handlePress = useCallback(
    (y: number) => {
      // Hover-Indikator sofort entfernen – sonst überlagert er die
      // unmittelbar darauf erscheinende Feedback-Note (Kreis + Umriss
      // flackern mit Blink/Fade "hin und her", bis onTouchEnd feuert).
      setHoverPosition(null);
      if (!interactive || !onPositionSelect || wrongPosition) return;
      const pos = getPositionFromY(y, topY);
      if (pos) onPositionSelect(pos);
    },
    [interactive, onPositionSelect, topY, wrongPosition],
  );

  // Sicherheitsnetz: sobald eine Display- oder Wrong-Note erscheint,
  // darf kein Hover-Indikator mehr darüber liegen.
  useEffect(() => {
    if (displayPosition || wrongPosition) setHoverPosition(null);
  }, [displayPosition, wrongPosition]);

  const handleMove = useCallback(
    (y: number) => {
      if (!interactive || displayPosition || wrongPosition) return;
      const pos = getPositionFromY(y, topY);
      setHoverPosition(pos);
    },
    [interactive, displayPosition, wrongPosition, topY],
  );

  const handleLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  return (
    <View style={styles.container}>
      <Pressable
        disabled={!interactive}
        onPressIn={(e) => handlePress(e.nativeEvent.locationY)}
        onTouchMove={(e) => handleMove(e.nativeEvent.locationY)}
        onTouchEnd={handleLeave}
        style={styles.touchLayer}
      >
        <StaffCanvasInner
          clef={clef}
          displayPosition={displayPosition}
          displayColor={noteColor}
          wrongPosition={wrongPosition}
          topY={topY}
          width={width}
          height={height}
          parchmentColors={parchmentColors}
          hoverPosition={hoverPosition}
          fadeOpacity={fadeOpacity}
          blinkOpacity={blinkOpacity}
          shakeX={shakeX}
          glowPulse={glowPulse}
          showGlow={showGlow}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    // „Blatt"-Rahmen: abgerundet, feine Kante, weicher Schatten
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
  touchLayer: {
    width: "100%",
  },
});
