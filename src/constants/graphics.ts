/**
 * Zentrale Grafik-Design-Tokens (Skia-Paletten, Radien, Strokes).
 * Single Source of Truth für Piano-/Keyboard-Optik – von
 * range-selector.tsx und piano-keyboard.tsx gemeinsam genutzt.
 */

/** Premium-Tasten-Verläufe (vertikal). */
export const KEY_GRADIENTS: Record<string, string[]> = {
  /** Weiße Taste, Idle. */
  whiteIdle: ["#fdfdfb", "#e8e5de"],
  /** Weiße Taste im aktiven Bereich (Range-Tönung). */
  whiteRange: ["#ddd6fe", "#a78bfa"],
  /** Schwarze Taste, Idle (inkl. Gloss-Deckel). */
  blackIdle: ["#3d3d49", "#141419"],
} as const;
