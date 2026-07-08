/**
 * GrandStaffView – Skia-basiertes Doppelsystem (Violin- + Bassschlüssel).
 *
 * 1:1 aus notenlern-app GrandStaffView.svelte.
 *
 * Zeichnet:
 *   - Pergament-Hintergrund mit Textur
 *   - Violin-System (oben) + Bass-System (unten)
 *   - Akkolade-Klammer (Brace) verbindet beide
 *   - Durchgehende Taktlinie
 *   - Schlüssel für beide Systeme
 *   - Note auf dem korrekten System (C4+ = Violin, <C4 = Bass)
 *   - Vorzeichen (Kreuz/b) wenn nötig
 *   - Hilfslinien für Noten außerhalb des Systems
 *
 * Nicht interaktiv — reine Display-Komponente.
 */

import {
    Canvas,
    Group,
    Line,
    Path,
    Rect,
    Skia,
    Text,
    useFont,
} from "@shopify/react-native-skia";
import { memo, useMemo } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";

import {
    BRAVURA_FONT_FAMILY,
    PARCHMENT_COLORS,
    SMUFL,
    STAFF_METRICS,
} from "@/constants/music-font";
import { getNoteStaffPosition } from "@/domain";
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

/** Y-Offset für Notenkopf-Position in der Akkolade. */
const LEFT_MARGIN = 60;
const NOTE_X_OFFSET = 0.65; // Note bei 65% der Breite

// ── Helper: Oval Path ──────────────────────────────────────────────────────

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

// ── Parchment Texture ─────────────────────────────────────────────────────

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

/**
 * Generiert die Pergament-Textur (gleiche Logik wie StaffView).
 */
function useParchmentTexture(
  width: number,
  height: number,
  colors: (typeof PARCHMENT_COLORS)[keyof typeof PARCHMENT_COLORS],
): { rects: FiberRect[]; lines: FiberLine[] } {
  return useMemo(() => {
    const rects: FiberRect[] = [];
    const lines: FiberLine[] = [];

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

// ── Component ─────────────────────────────────────────────────────────────

export const GrandStaffView = memo(function GrandStaffView({
  midi,
  noteColor,
  width = 340,
}: GrandStaffViewProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const parchmentColors = isDark
    ? PARCHMENT_COLORS.DARK
    : PARCHMENT_COLORS.LIGHT;

  // Höhe: 2 Systeme + Abstand + etwas Rand
  const height = STAFF_HEIGHT * 2 + SYSTEM_SPACING + 40;

  // Violin-System oben, Bass-System unten
  const trebleTopY = 20;
  const bassTopY = trebleTopY + STAFF_HEIGHT + SYSTEM_SPACING;

  const trebleLineYs = useMemo(() => getStaffLineYs(trebleTopY), [trebleTopY]);
  const bassLineYs = useMemo(() => getStaffLineYs(bassTopY), [bassTopY]);

  const bravuraFont = useFont(BRAVURA_FONT_FAMILY, 80);
  const braceFont = useFont(BRAVURA_FONT_FAMILY, height - trebleTopY + 20);
  const texture = useParchmentTexture(width, height, parchmentColors);

  // Bestimme, welches System verwendet wird (C4+ = treble, <C4 = bass)
  const useTreble = midi >= 60;
  const clef = useTreble ? "treble" : "bass";
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
    return getLedgerLineYs(notePosition, activeTopY, clef);
  }, [notePosition, activeTopY, clef]);

  // Middle line für Stem-Richtung
  const middleLineY = activeLineYs[2];

  // Oval-Pfad für Note
  const notePath = useMemo(
    () =>
      makeOvalPath(
        noteX,
        noteY,
        STAFF_METRICS.NOTE_HEAD_RADIUS_X,
        STAFF_METRICS.NOTE_HEAD_RADIUS_Y,
      ),
    [noteX, noteY],
  );

  const color = noteColor ?? parchmentColors.noteHead;

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height }}>
        {/* ── Pergament-Hintergrund ── */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          color={parchmentColors.bg}
        />

        {/* Noise-Textur */}
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

        {/* ── Violin-System (5 Linien) ── */}
        {trebleLineYs.map((y, i) => (
          <Line
            key={`treble-${i}`}
            p1={{ x: LEFT_MARGIN - 40, y }}
            p2={{ x: width - 20, y }}
            color={parchmentColors.staffLine}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Bass-System (5 Linien) ── */}
        {bassLineYs.map((y, i) => (
          <Line
            key={`bass-${i}`}
            p1={{ x: LEFT_MARGIN - 40, y }}
            p2={{ x: width - 20, y }}
            color={parchmentColors.staffLine}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Durchgehende Taktlinie ── */}
        <Line
          p1={{ x: LEFT_MARGIN - 42, y: trebleTopY }}
          p2={{ x: LEFT_MARGIN - 42, y: bassTopY + STAFF_HEIGHT }}
          color={parchmentColors.staffLine}
          strokeWidth={2.5}
        />

        {/* ── Akkolade-Klammer (Brace) ── */}
        {braceFont && (
          <Text
            x={LEFT_MARGIN - 44}
            y={trebleTopY + (height - trebleTopY) / 2 + 10}
            text={SMUFL.BRACE}
            font={braceFont}
            color={parchmentColors.clef}
          />
        )}

        {/* ── Violinschlüssel ── */}
        {bravuraFont && (
          <Text
            x={LEFT_MARGIN - 10}
            y={trebleLineYs[3]}
            text={SMUFL.TREBLE_CLEF}
            font={bravuraFont}
            color={parchmentColors.clef}
          />
        )}

        {/* ── Bassschlüssel ── */}
        {bravuraFont && (
          <Text
            x={LEFT_MARGIN - 10}
            y={bassLineYs[1]}
            text={SMUFL.BASS_CLEF}
            font={bravuraFont}
            color={parchmentColors.clef}
          />
        )}

        {/* ── Hilfslinien für die Note ── */}
        {ledgerYs.map((y, i) => (
          <Line
            key={`ledger-${i}`}
            p1={{ x: noteX - 20, y }}
            p2={{ x: noteX + 20, y }}
            color={parchmentColors.staffLine}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Notenhals (Stem) ── */}
        <Line
          p1={{
            x:
              noteY > middleLineY
                ? noteX + STAFF_METRICS.NOTE_HEAD_RADIUS_X
                : noteX - STAFF_METRICS.NOTE_HEAD_RADIUS_X,
            y: noteY,
          }}
          p2={{
            x:
              noteY > middleLineY
                ? noteX + STAFF_METRICS.NOTE_HEAD_RADIUS_X
                : noteX - STAFF_METRICS.NOTE_HEAD_RADIUS_X,
            y:
              noteY > middleLineY
                ? noteY - STAFF_METRICS.STEM_HEIGHT
                : noteY + STAFF_METRICS.STEM_HEIGHT,
          }}
          color={color}
          strokeWidth={STAFF_METRICS.STEM_WIDTH}
        />

        {/* ── Notenkopf (Oval mit Rotation) ── */}
        <Group
          transform={[{ rotate: STAFF_METRICS.NOTE_HEAD_ROTATION }]}
          origin={{ x: noteX, y: noteY }}
        >
          <Path path={notePath} color={color} />
        </Group>
      </Canvas>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
