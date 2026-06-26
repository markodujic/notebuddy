/**
 * Layout-Konstanten für Responsive Design und Touch-Targets.
 *
 * Breakpoints:
 *   compact  < 420     Handy Portrait
 *   medium   420–700   Handy Landscape / kleines Tablet
 *   expanded ≥ 700     iPad / Desktop
 */

import { Platform } from 'react-native';

/** Breakpoint-Grenzen (Breite in px). */
export const BREAKPOINTS = {
  compact: 420,
  medium: 700,
} as const;

/** Breakpoint-Typ. */
export type Breakpoint = 'compact' | 'medium' | 'expanded';

/** Orientierung. */
export type Orientation = 'portrait' | 'landscape';

/**
 * Liefert den Breakpoint für eine gegebene Fensterbreite.
 */
export function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.compact) return 'compact';
  if (width < BREAKPOINTS.medium) return 'medium';
  return 'expanded';
}

/**
 * Liefert die Orientierung für gegebene Dimensionen.
 */
export function getOrientation(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

/** Mindest-Touch-Target-Größen. */
export const TOUCH_TARGET = {
  /** Apple HIG: 44pt */
  ios: 44,
  /** Material Design: 48dp */
  android: 48,
  /** Fallback */
  default: 44,
} as const;

/** Aktive Mindest-Touch-Target-Größe für das aktuelle Platform. */
export const MIN_TOUCH_TARGET = Platform.select({
  ios: TOUCH_TARGET.ios,
  android: TOUCH_TARGET.android,
  default: TOUCH_TARGET.default,
});

/** Klaviatur-Tastenbreiten pro Breakpoint (weiße Tasten). */
export const KEYBOARD_KEY_WIDTH = {
  compact: 16,
  medium: 24,
  expanded: 28,
} as const;

/** Typografie-Skalierung pro Breakpoint. */
export const TYPOGRAPHY_SCALE = {
  /** Hauptitel */
  title: {
    compact: 34,
    medium: 42,
    expanded: 48,
  },
  /** Zeilenhöhe Haupttitel */
  titleLineHeight: {
    compact: 38,
    medium: 46,
    expanded: 54,
  },
  /** Untertitel */
  subtitle: {
    compact: 22,
    medium: 26,
    expanded: 30,
  },
  /** Body */
  body: {
    compact: 15,
    medium: 16,
    expanded: 17,
  },
  /** Noten-Badge (sehr groß) */
  noteBadge: {
    compact: 96,
    medium: 128,
    expanded: 160,
  },
} as const;