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
  Rect,
  RoundedRect,
  Skia,
  Text,
  useFont,
  type SkFont,
  type SkPicture,
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
  BRAVURA_FONT_FAMILY,
  PARCHMENT_COLORS,
  SMUFL,
  STAFF_FEEDBACK_COLORS,
  STAFF_METRICS,
} from "@/constants/music-font";
import { getNoteStaffPosition, type Clef, type StaffPosition } from "@/domain";
import { useAppStore } from "@/stores/app-store";
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

// ── Helpers: Bravura-Glyph-Messung ──────────────────────────────────────────

/**
 * Halbe Breite eines Bravura-Glyphs (für zentriertes Zeichnen).
 * SMuFL: Notenkopf-Origin liegt links, vertikal zentriert auf der Baseline.
 */
function glyphHalfWidth(font: SkFont, text: string): number {
  const m = font.measureText(text) as number | { width: number };
  return (typeof m === "number" ? m : m.width) / 2;
}

// ── Parchment Texture (einmalig offscreen gezeichnet, 1 Draw-Call) ─────────

/**
 * Zeichnet die Pergament-Textur (Hintergrund + Rauschen + Fasern) einmalig
 * in ein offscreen Skia-Picture. Beim Rendern kostet es genau einen
 * Draw-Call statt ~800 einzelner Rects/Lines – und die Zufallswerte
 * (Faser-Enden) bleiben fixiert, statt bei jedem Re-Render zu zappeln.
 */
function useParchmentPicture(
  width: number,
  height: number,
  colors: (typeof PARCHMENT_COLORS)[keyof typeof PARCHMENT_COLORS],
): SkPicture | null {
  return useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, width, height),
    );

    // Hintergrund
    const bgPaint = Skia.Paint();
    bgPaint.setColor(Skia.Color(colors.bg));
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), bgPaint);

    // Subtle noise (4×4 Pixel Blöcke, wie createTextureCache() im Original)
    const noisePaint = Skia.Paint();
    for (let px = 0; px < width; px += 4) {
      for (let py = 0; py < height; py += 4) {
        const noise = Math.random();
        if (noise > 0.5) {
          noisePaint.setColor(
            Skia.Color(noise > 0.75 ? colors.fiber1 : colors.fiber2),
          );
          noisePaint.setAlphaf(0.03);
          canvas.drawRect(Skia.XYWHRect(px, py, 4, 4), noisePaint);
        }
      }
    }

    // Horizontal fibers (12 zufällige Linien, Enden einmalig fixiert)
    const fiberPaint = Skia.Paint();
    fiberPaint.setStrokeWidth(0.5);
    fiberPaint.setAlphaf(0.015);
    fiberPaint.setColor(Skia.Color(colors.fiber1));
    for (let fi = 0; fi < 12; fi++) {
      const y = Math.random() * height;
      const endY = y + (Math.random() - 0.5) * 3;
      canvas.drawLine(0, y, width, endY, fiberPaint);
    }

    return recorder.finishRecordingAsPicture();
  }, [width, height, colors]);
}

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

  // Notenkopf-Halbbreite (gemessen) – Hals sitzt exakt an der Glyph-Kante
  const headHalfW = noteFont
    ? glyphHalfWidth(noteFont, SMUFL.NOTE_HEAD_FILLED)
    : (STAFF_METRICS.NOTE_HEAD_WIDTH_SPACES * STAFF_METRICS.LINE_SPACING) / 2;
  const stemOffsetX = headHalfW;

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
      {lineYs.map((y, i) => (
        <Line
          key={`line-${i}`}
          p1={{ x: 15, y }}
          p2={{ x: width - 15, y }}
          color={parchmentColors.staffLine}
          strokeWidth={STAFF_METRICS.LINE_WIDTH}
        />
      ))}

      {/* ── Schlüssel ── */}
      {clef === "treble"
        ? bravuraTrebleFont && (
            <Text
              x={clefX}
              y={lineYs[3]} // G-Linie (2. von unten = index 3)
              text={SMUFL.TREBLE_CLEF}
              font={bravuraTrebleFont}
              color={parchmentColors.clef}
            />
          )
        : bravuraBassFont && (
            <Text
              x={clefX}
              y={lineYs[1]} // F-Linie (4. von unten = index 1)
              text={SMUFL.BASS_CLEF}
              font={bravuraBassFont}
              color={parchmentColors.clef}
            />
          )}

      {/* ── Hilfslinien für Display-Note (mit Pergament-Freilegung, 1:1) ── */}
      {displayLedgers.map((y, i) => (
        <Group key={`dl-${i}`}>
          <Line
            p1={{ x: noteX - STAFF_METRICS.LEDGER_CLEAR_EXTEND, y }}
            p2={{ x: noteX + STAFF_METRICS.LEDGER_CLEAR_EXTEND, y }}
            color={parchmentColors.bg}
            strokeWidth={STAFF_METRICS.LEDGER_CLEAR_WIDTH}
          />
          <Line
            p1={{ x: noteX - STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
            p2={{ x: noteX + STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
            color={parchmentColors.staffLine}
            strokeWidth={STAFF_METRICS.LEDGER_LINE_WIDTH}
          />
        </Group>
      ))}

      {/* ── Falsche Note (blinkend + Shake, darkred) ── */}
      {wrongPosition && (
        <Group transform={wrongShake}>
          {/* Hilfslinien für wrong note */}
          {wrongLedgers.map((y, i) => (
            <Line
              key={`wl-${i}`}
              p1={{ x: noteX - STAFF_METRICS.LEDGER_CLEAR_EXTEND, y }}
              p2={{ x: noteX + STAFF_METRICS.LEDGER_CLEAR_EXTEND, y }}
              color={parchmentColors.bg}
              strokeWidth={STAFF_METRICS.LEDGER_CLEAR_WIDTH}
            />
          ))}
          {wrongLedgers.map((y, i) => (
            <Line
              key={`wlc-${i}`}
              p1={{ x: noteX - STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
              p2={{ x: noteX + STAFF_METRICS.LEDGER_LINE_EXTEND, y }}
              color={parchmentColors.staffLine}
              strokeWidth={STAFF_METRICS.LEDGER_LINE_WIDTH}
            />
          ))}
          {/* Stem */}
          <Line
            p1={{
              x:
                wrongY > middleLineY
                  ? noteX + stemOffsetX
                  : noteX - stemOffsetX,
              y: wrongY,
            }}
            p2={{
              x:
                wrongY > middleLineY
                  ? noteX + stemOffsetX
                  : noteX - stemOffsetX,
              y:
                wrongY > middleLineY
                  ? wrongY - STAFF_METRICS.STEM_HEIGHT
                  : wrongY + STAFF_METRICS.STEM_HEIGHT,
            }}
            color={STAFF_FEEDBACK_COLORS.WRONG_BLINK}
            strokeWidth={STAFF_METRICS.STEM_WIDTH}
            opacity={blinkOpacity}
          />
          {/* Notenkopf als Bravura-Glyph (SMuFL, typografisch korrekt) */}
          {noteFont && (
            <Text
              x={noteX - headHalfW}
              y={wrongY}
              text={SMUFL.NOTE_HEAD_FILLED}
              font={noteFont}
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
            <Text
              x={noteX - headHalfW}
              y={displayY}
              text={SMUFL.NOTE_HEAD_FILLED}
              font={noteFont}
              color={STAFF_FEEDBACK_COLORS.CORRECT_GLOW}
              style="stroke"
              strokeWidth={8}
              strokeJoin="round"
              opacity={glowPulse}
            />
          )}
          {/* Stem */}
          <Line
            p1={{
              x:
                displayY > middleLineY
                  ? noteX + stemOffsetX
                  : noteX - stemOffsetX,
              y: displayY,
            }}
            p2={{
              x:
                displayY > middleLineY
                  ? noteX + stemOffsetX
                  : noteX - stemOffsetX,
              y:
                displayY > middleLineY
                  ? displayY - STAFF_METRICS.STEM_HEIGHT
                  : displayY + STAFF_METRICS.STEM_HEIGHT,
            }}
            color={displayColor}
            strokeWidth={STAFF_METRICS.STEM_WIDTH}
            opacity={fadeOpacity}
          />
          {/* Notenkopf als Bravura-Glyph (SMuFL, typografisch korrekt) */}
          {noteFont && (
            <Text
              x={noteX - headHalfW}
              y={displayY}
              text={SMUFL.NOTE_HEAD_FILLED}
              font={noteFont}
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
          {hoverLedgers.map((y, i) => (
            <Line
              key={`hl-${i}`}
              p1={{ x: noteX - 20, y }}
              p2={{ x: noteX + 20, y }}
              color={parchmentColors.staffLine}
              strokeWidth={STAFF_METRICS.LEDGER_LINE_WIDTH}
            />
          ))}
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
            <Text
              x={noteX - headHalfW}
              y={hoverY}
              text={SMUFL.NOTE_HEAD_FILLED}
              font={noteFont}
              color={STAFF_FEEDBACK_COLORS.HOVER_STROKE}
              style="stroke"
              strokeWidth={2}
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
      if (!interactive || !onPositionSelect || wrongPosition) return;
      const pos = getPositionFromY(y, topY);
      if (pos) onPositionSelect(pos);
    },
    [interactive, onPositionSelect, topY, wrongPosition],
  );

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
  },
  touchLayer: {
    width: "100%",
  },
});
