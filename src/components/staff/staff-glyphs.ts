/**
 * Bravura/SMuFL-Glyph-Messung – gemeinsame Helfer für alle Staff-Views.
 *
 * Metrikunabhängig über die Ink-Box: `SkFont.measureText` liefert ein SkRect
 * mit `y` relativ zur Text-Baseline (negativ = oberhalb). Damit lassen sich
 * Glyphen exakt auf einer Zielposition zentrieren, egal wie die Font ihre
 * Boxen zur Baseline legt (die SMuFL-Nominalkonvention „Notenkopf
 * baselinezentriert" wird NICHT vorausgesetzt).
 */

import type { SkFont } from "@shopify/react-native-skia";

import { SMUFL, STAFF_METRICS } from "@/constants/music-font";

/** Geometrie eines Bravura-Glyphs relativ zur Text-Baseline (Ursprung). */
export interface GlyphGeom {
  /** Distanz Baseline → horizontaler Glyph-Mittelpunkt (immer > 0). */
  centerX: number;
  /** Distanz Baseline → vertikaler Glyph-Mittelpunkt (negativ = oberhalb). */
  centerY: number;
}

/** Misst ein beliebiges Bravura-Glyph über seine Ink-Box (SkRect). */
export function glyphGeom(font: SkFont, text: string): GlyphGeom {
  const r = font.measureText(text);
  return { centerX: r.x + r.width / 2, centerY: r.y + r.height / 2 };
}

/** Fallback-Geometrie, solange die Font (noch) nicht geladen ist. */
export const NOTE_HEAD_FALLBACK_GEOM: GlyphGeom = {
  centerX: (STAFF_METRICS.NOTE_HEAD_WIDTH_SPACES * STAFF_METRICS.LINE_SPACING) / 2,
  centerY: 0,
};

/** Geometrie des gefüllten Notenkopfs (für Stem-Ansatz + Zentrierung). */
export function noteHeadGeom(font: SkFont | null | undefined): GlyphGeom {
  return font ? glyphGeom(font, SMUFL.NOTE_HEAD_FILLED) : NOTE_HEAD_FALLBACK_GEOM;
}
