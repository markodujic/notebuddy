/**
 * Staff-Primitives – wiederverwendbare Skia-Bausteine für alle Staff-Views.
 *
 * StaffView (interaktiv, Einzelsystem) und GrandStaffView (Display,
 * Doppelsystem) setzen sich aus denselben Bausteinen zusammen → eine Quelle
 * der Wahrheit für Optik und Metriken.
 */

import { Group, Line, Text, type SkFont } from "@shopify/react-native-skia";

import { SMUFL, STAFF_METRICS } from "@/constants/music-font";
import type { Clef } from "@/domain";

import { glyphGeom, type GlyphGeom } from "./staff-glyphs";

// ── StaffLines ──────────────────────────────────────────────────────────────

export function StaffLines({
  lineYs,
  x0,
  x1,
  color,
}: {
  lineYs: number[];
  x0: number;
  x1: number;
  color: string;
}) {
  return (
    <>
      {lineYs.map((y, i) => (
        <Line
          key={`line-${i}`}
          p1={{ x: x0, y }}
          p2={{ x: x1, y }}
          color={color}
          strokeWidth={STAFF_METRICS.LINE_WIDTH}
        />
      ))}
    </>
  );
}

// ── ClefGlyph ───────────────────────────────────────────────────────────────

/** Baseline-Y eines Schlüssels (SMuFL: Baseline = Referenzlinie). */
export function clefBaselineY(clef: Clef, lineYs: number[]): number {
  // Treble: G-Linie (2. von unten = Index 3), Bass: F-Linie (4. von unten = Index 1)
  return clef === "treble" ? lineYs[3] : lineYs[1];
}

export function ClefGlyph({
  clef,
  x,
  lineYs,
  font,
  color,
}: {
  clef: Clef;
  x: number;
  lineYs: number[];
  font: SkFont | null;
  color: string;
}) {
  if (!font) return null;
  return (
    <Text
      x={x}
      y={clefBaselineY(clef, lineYs)}
      text={clef === "treble" ? SMUFL.TREBLE_CLEF : SMUFL.BASS_CLEF}
      font={font}
      color={color}
    />
  );
}

// ── LedgerLines ─────────────────────────────────────────────────────────────

export function LedgerLines({
  ys,
  noteX,
  color,
  extend = STAFF_METRICS.LEDGER_LINE_EXTEND,
  strokeWidth = STAFF_METRICS.LEDGER_LINE_WIDTH,
  /** Optional: Pergament-Freilegung unter der Hilfslinie (wie Original). */
  clearColor,
  clearWidth = STAFF_METRICS.LEDGER_CLEAR_WIDTH,
  clearExtend = STAFF_METRICS.LEDGER_CLEAR_EXTEND,
}: {
  ys: number[];
  noteX: number;
  color: string;
  extend?: number;
  strokeWidth?: number;
  clearColor?: string;
  clearWidth?: number;
  clearExtend?: number;
}) {
  return (
    <>
      {ys.map((y, i) => (
        <Group key={`ledger-${i}`}>
          {clearColor && (
            <Line
              p1={{ x: noteX - clearExtend, y }}
              p2={{ x: noteX + clearExtend, y }}
              color={clearColor}
              strokeWidth={clearWidth}
            />
          )}
          <Line
            p1={{ x: noteX - extend, y }}
            p2={{ x: noteX + extend, y }}
            color={color}
            strokeWidth={strokeWidth}
          />
        </Group>
      ))}
    </>
  );
}

// ── Stem ────────────────────────────────────────────────────────────────────

export function Stem({
  x,
  noteY,
  middleLineY,
  halfWidth,
  color,
  opacity,
}: {
  /** X-Position der Note (Zentrum). */
  x: number;
  noteY: number;
  middleLineY: number;
  /** Halbe Notenkopf-Breite – Hals sitzt exakt an der Glyph-Kante. */
  halfWidth: number;
  color: string;
  opacity?: number | import("react-native-reanimated").SharedValue<number>;
}) {
  const up = noteY > middleLineY; // unterhalb der Mittellinie → Hals nach oben
  const sx = up ? x + halfWidth : x - halfWidth;
  return (
    <Line
      p1={{ x: sx, y: noteY }}
      p2={{
        x: sx,
        y: up ? noteY - STAFF_METRICS.STEM_HEIGHT : noteY + STAFF_METRICS.STEM_HEIGHT,
      }}
      color={color}
      strokeWidth={STAFF_METRICS.STEM_WIDTH}
      opacity={opacity}
    />
  );
}

// ── NoteHeadGlyph ───────────────────────────────────────────────────────────

/**
 * Notenkopf als Bravura-Glyph, Ink-Box-Mitte exakt auf (x, y).
 * `outline` = nur Kontur (für Hover-Indikator), sonst gefüllt.
 */
export function NoteHeadGlyph({
  font,
  geom,
  x,
  y,
  color,
  opacity,
  outline = false,
  outlineWidth = 2,
}: {
  font: SkFont;
  /** Gemessene Geometrie (via noteHeadGeom) – vermeidet Doppel-Messung. */
  geom?: GlyphGeom;
  x: number;
  y: number;
  color: string;
  opacity?: number | import("react-native-reanimated").SharedValue<number>;
  outline?: boolean;
  outlineWidth?: number;
}) {
  const g = geom ?? glyphGeom(font, SMUFL.NOTE_HEAD_FILLED);
  return (
    <Text
      x={x - g.centerX}
      y={y - g.centerY}
      text={SMUFL.NOTE_HEAD_FILLED}
      font={font}
      color={color}
      opacity={opacity}
      style={outline ? "stroke" : "fill"}
      strokeWidth={outline ? outlineWidth : undefined}
    />
  );
}
