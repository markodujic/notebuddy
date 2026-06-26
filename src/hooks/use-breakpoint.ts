/**
 * useBreakpoint – Hook für Responsive Design.
 *
 * Liefert den aktuellen Breakpoint und Orientierung,
 * basierend auf den Fensterdimensionen.
 */

import { useWindowDimensions } from 'react-native';

import {
    type Breakpoint,
    type Orientation,
    getBreakpoint,
    getOrientation,
} from '@/constants/layout';

export interface BreakpointInfo {
  /** Aktueller Breakpoint. */
  breakpoint: Breakpoint;
  /** Aktuelle Orientierung. */
  orientation: Orientation;
  /** Fensterbreite. */
  width: number;
  /** Fensterhöhe. */
  height: number;
  /** True, wenn compact (< 420). */
  isCompact: boolean;
  /** True, wenn medium (420–700). */
  isMedium: boolean;
  /** True, wenn expanded (≥ 700). */
  isExpanded: boolean;
  /** True, wenn Portrait. */
  isPortrait: boolean;
  /** True, wenn Landscape. */
  isLandscape: boolean;
}

/**
 * Hook: Liefert Responsive-Design-Informationen.
 */
export function useBreakpoint(): BreakpointInfo {
  const { width, height } = useWindowDimensions();
  const breakpoint = getBreakpoint(width);
  const orientation = getOrientation(width, height);

  return {
    breakpoint,
    orientation,
    width,
    height,
    isCompact: breakpoint === 'compact',
    isMedium: breakpoint === 'medium',
    isExpanded: breakpoint === 'expanded',
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
  };
}