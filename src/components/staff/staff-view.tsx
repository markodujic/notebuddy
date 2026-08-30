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
  Path,
  Rect,
  RoundedRect,
  Skia,
  Text,
  useFont,
} from "@shopify/react-native-skia";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
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
  showGlow: boolean;
};

// ── Helpers: Oval Path (Skia hat keine Ellipse Komponente) ─────────────────

/** Erstellt einen Skia-Pfad für ein Oval (wie ctx.ellipse). */
function makeOvalPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): React.ComponentProps<typeof Path>["path"] {
  const path = Skia.Path.Make();
  path.addOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2));
  return path;
}

/** Erstellt einen Oval-Umriss-Pfad (für Hover, etwas kleiner). */
function makeOvalStrokePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): React.ComponentProps<typeof Path>["path"] {
  return makeOvalPath(cx, cy, rx, ry);
}

// ── Parchment Texture (cached) ────────────────────────────────────────────

interface FiberRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
}

interface FiberLine {
  y: number;
  color: string;
  alpha: number;
}

interface ParchmentTexture {
  rects: FiberRect[];
  lines: FiberLine[];
}

/**
 * Generiert die Pergament-Textur (Rauschen + horizontale Fasern).
 * Wie createTextureCache() in der alten InteractiveStaffView.svelte.
 */
function useParchmentTexture(
  width: number,
  height: number,
  colors: (typeof PARCHMENT_COLORS)[keyof typeof PARCHMENT_COLORS],
): ParchmentTexture {
  return useMemo(() => {
    const rects: FiberRect[] = [];
    const lines: FiberLine[] = [];

    // Subtle noise (4×4 Pixel Blöcke)
    for (let px = 0; px < width; px += 4) {
      for (let py = 0; py < height; py += 4) {
        const noise = Math.random();
        if (noise > 0.5) {
          rects.push({
            x: px,
            y: py,
            w: 4,
            h: 4,
            color: noise > 0.75 ? colors.fiber1 : colors.fiber2,
            alpha: 0.03,
          });
        }
      }
    }

    // Horizontal fibers (12 zufällige Linien)
    for (let fi = 0; fi < 12; fi++) {
      lines.push({
        y: Math.random() * height,
        color: colors.fiber1,
        alpha: 0.015,
      });
    }

    return { rects, lines };
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
  showGlow,
}: StaffCanvasProps) {
  const bravuraTrebleFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.CLEF_TREBLE_SIZE);
  const bravuraBassFont = useFont(BRAVURA_FONT_FAMILY, STAFF_METRICS.CLEF_BASS_SIZE);
  const lineYs = useMemo(() => getStaffLineYs(topY), [topY]);
  const clefX = STAFF_METRICS.CLEF_X; // LEFT_MARGIN + 40 (1:1 wie alte App)
  const noteX = width / 2;

  // Pergament-Textur generieren (gecached)
  const texture = useParchmentTexture(width, height, parchmentColors);

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

  // Oval-Pfade memoisieren (Skia hat keine Ellipse Komponente)
  const displayNotePath = useMemo(
    () =>
      makeOvalPath(
        noteX,
        displayY,
        STAFF_METRICS.NOTE_HEAD_RADIUS_X,
        STAFF_METRICS.NOTE_HEAD_RADIUS_Y,
      ),
    [noteX, displayY],
  );
  const wrongNotePath = useMemo(
    () =>
      makeOvalPath(
        noteX,
        wrongY,
        STAFF_METRICS.NOTE_HEAD_RADIUS_X,
        STAFF_METRICS.NOTE_HEAD_RADIUS_Y,
      ),
    [noteX, wrongY],
  );
  const hoverNotePath = useMemo(
    () =>
      makeOvalStrokePath(
        noteX,
        hoverY,
        STAFF_METRICS.NOTE_HEAD_RADIUS_X - 2,
        STAFF_METRICS.NOTE_HEAD_RADIUS_Y - 1,
      ),
    [noteX, hoverY],
  );

  return (
    <Canvas style={{ width, height }}>
      {/* ── Pergament-Hintergrund ── */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        color={parchmentColors.bg}
      />

      {/* Noise-Textur (Punkte) */}
      <Group>
        {texture.rects.map((r, i) => (
          <Rect
            key={`noise-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            color={r.color}
            opacity={r.alpha}
          />
        ))}
      </Group>

      {/* Horizontale Fasern */}
      <Group>
        {texture.lines.map((l, i) => (
          <Line
            key={`fiber-${i}`}
            p1={{ x: 0, y: l.y }}
            p2={{ x: width, y: l.y + (Math.random() - 0.5) * 3 }}
            color={l.color}
            strokeWidth={0.5}
            opacity={l.alpha}
          />
        ))}
      </Group>

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

      {/* ── Falsche Note (blinkend, darkred) ── */}
      {wrongPosition && (
        <>
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
                  ? noteX + STAFF_METRICS.STEM_OFFSET_X
                  : noteX - STAFF_METRICS.STEM_OFFSET_X,
              y: wrongY,
            }}
            p2={{
              x:
                wrongY > middleLineY
                  ? noteX + STAFF_METRICS.STEM_OFFSET_X
                  : noteX - STAFF_METRICS.STEM_OFFSET_X,
              y:
                wrongY > middleLineY
                  ? wrongY - STAFF_METRICS.STEM_HEIGHT
                  : wrongY + STAFF_METRICS.STEM_HEIGHT,
            }}
            color={STAFF_FEEDBACK_COLORS.WRONG_BLINK}
            strokeWidth={STAFF_METRICS.STEM_WIDTH}
            opacity={blinkOpacity}
          />
          {/* Notenkopf als Oval (rotiert) */}
          <Group
            transform={[{ rotate: STAFF_METRICS.NOTE_HEAD_ROTATION }]}
            origin={{ x: noteX, y: wrongY }}
            opacity={blinkOpacity}
          >
            <Path
              path={wrongNotePath}
              color={STAFF_FEEDBACK_COLORS.WRONG_BLINK}
            />
          </Group>
        </>
      )}

      {/* ── Display-Note ── */}
      {displayPosition && (
        <>
          {/* Glow-Effekt für korrekte Antworten (grüner Ring) */}
          {showGlow && (
            <Group
              transform={[{ rotate: STAFF_METRICS.NOTE_HEAD_ROTATION }]}
              origin={{ x: noteX, y: displayY }}
              opacity={fadeOpacity}
            >
              <Path
                path={displayNotePath}
                color={STAFF_FEEDBACK_COLORS.CORRECT_GLOW}
                style="stroke"
                strokeWidth={8}
                strokeJoin="round"
              />
            </Group>
          )}
          {/* Stem */}
          <Line
            p1={{
              x:
                displayY > middleLineY
                  ? noteX + STAFF_METRICS.STEM_OFFSET_X
                  : noteX - STAFF_METRICS.STEM_OFFSET_X,
              y: displayY,
            }}
            p2={{
              x:
                displayY > middleLineY
                  ? noteX + STAFF_METRICS.STEM_OFFSET_X
                  : noteX - STAFF_METRICS.STEM_OFFSET_X,
              y:
                displayY > middleLineY
                  ? displayY - STAFF_METRICS.STEM_HEIGHT
                  : displayY + STAFF_METRICS.STEM_HEIGHT,
            }}
            color={displayColor}
            strokeWidth={STAFF_METRICS.STEM_WIDTH}
            opacity={fadeOpacity}
          />
          {/* Notenkopf als Oval (rotiert) */}
          <Group
            transform={[{ rotate: STAFF_METRICS.NOTE_HEAD_ROTATION }]}
            origin={{ x: noteX, y: displayY }}
            opacity={fadeOpacity}
          >
            <Path path={displayNotePath} color={displayColor} />
          </Group>
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
          {/* Notenkopf-Umriss */}
          <Group
            transform={[{ rotate: STAFF_METRICS.NOTE_HEAD_ROTATION }]}
            origin={{ x: noteX, y: hoverY }}
          >
            <Path
              path={hoverNotePath}
              color={STAFF_FEEDBACK_COLORS.HOVER_STROKE}
              style="stroke"
              strokeWidth={2}
            />
          </Group>
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
