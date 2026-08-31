/**
 * Pergament-Textur als offscreen Skia-Picture.
 *
 * Wird einmalig (useMemo) aufgezeichnet und beim Rendern mit einem einzigen
 * Draw-Call (`<Picture />`) gezeichnet – statt ~800 einzelner Rects/Lines.
 * Die Zufallswerte (Noise, Faser-Enden) bleiben dadurch fixiert, statt bei
 * jedem Re-Render neu zu würfeln.
 *
 * Gemeinsam genutzt von StaffView und GrandStaffView (eine Quelle der Wahrheit).
 */

import { Skia, type SkPicture } from "@shopify/react-native-skia";
import { useMemo } from "react";

import { PARCHMENT_COLORS } from "@/constants/music-font";

export type ParchmentColors =
  (typeof PARCHMENT_COLORS)[keyof typeof PARCHMENT_COLORS];

export function useParchmentPicture(
  width: number,
  height: number,
  colors: ParchmentColors,
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

    // Dark-Theme: dezente Vignette (Ränder etwas dunkler)
    if (colors === PARCHMENT_COLORS.DARK) {
      const vignettePaint = Skia.Paint();
      const shader = Skia.Shader.MakeRadialGradient(
        { x: width / 2, y: height / 2 },
        Math.max(width, height) * 0.75,
        [Skia.Color("rgba(0,0,0,0)"), Skia.Color("rgba(0,0,0,0.25)")],
        [0, 1],
        0,
      );
      vignettePaint.setShader(shader);
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), vignettePaint);
    }

    return recorder.finishRecordingAsPicture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, colors]);
}
