/**
 * Staff-Geometry – Y-Position-Berechnung für das Notensystem (framework-neutral).
 *
 * Wandelt StaffPosition ↔ Y-Koordinate (in Skia-Punkten) um.
 * Y wächst nach unten; musikalische Linie 1 ist unten (großes Y).
 */

import { STAFF_METRICS } from '@/constants/music-font';
import {
  type Clef,
  type StaffPosition,
  getNoteStaffPosition,
  getValidVisualizationNotes,
  parseStaffPosition,
} from '@/domain';

/** Höhe des Hauptsystems (5 Linien, 4 Abstände). */
export const STAFF_HEIGHT = 4 * STAFF_METRICS.LINE_SPACING;

/** Anzahl der Linien im Hauptsystem. */
export const STAFF_LINE_COUNT = 5;

/**
 * Ordnet jeder Position eine diatonische "Stufe" (vertikaler Index) zu.
 *
 * Hauptsystem:
 *   Line 5 (oben) = Stufe 0
 *   Space 4       = Stufe 1
 *   Line 4        = Stufe 2
 *   Space 3       = Stufe 3
 *   Line 3        = Stufe 4
 *   Space 2       = Stufe 5
 *   Line 2        = Stufe 6
 *   Space 1       = Stufe 7
 *   Line 1 (unten)= Stufe 8
 *
 * Hilfslinien oben: negative Stufen (-1, -2, ...)
 * Hilfslinien unten: Stufen > 8 (9, 10, ...)
 */
function positionToStep(position: StaffPosition): number {
  const info = parseStaffPosition(position);

  if (!info.isLedger) {
    // Hauptsystem: Line N von unten → Stufe = (5 - N) * 2
    // Space N von unten → Stufe = (5 - N) * 2 - 1
    if (info.type === 'line') {
      return (STAFF_LINE_COUNT - info.number) * 2;
    }
    // space
    return (STAFF_LINE_COUNT - info.number) * 2 - 1;
  }

  // Hilfslinien
  const baseTop = -1; // Erste Position über dem System (Space above Line 5)
  const baseBottom = 9; // Erste Position unter dem System (Space below Line 1)

  if (info.direction === 'above') {
    // ledger-above-N → auf der Linie, ledger-above-space-N → im Zwischenraum
    if (info.type === 'ledger') {
      return baseTop - (info.number - 1) * 2;
    }
    return baseTop - (info.number - 1) * 2 + 1;
  }

  // below
  if (info.type === 'ledger') {
    return baseBottom + (info.number - 1) * 2;
  }
  return baseBottom + (info.number - 1) * 2 - 1;
}

/**
 * Berechnet die Y-Koordinate für eine Position.
 *
 * @param position Staff-Position.
 * @param topY Y-Koordinate der obersten Linie (Line 5).
 * @returns Y-Koordinate in Skia-Punkten.
 */
export function getYForPosition(position: StaffPosition, topY: number): number {
  const step = positionToStep(position);
  // Stufe 0 = Line 5 = topY
  // Jede Stufe = LINE_SPACING / 2 (halb so viel wie ein Linienabstand)
  return topY + step * (STAFF_METRICS.LINE_SPACING / 2);
}

/**
 * Wandelt eine Y-Koordinate in die nächste StaffPosition um.
 *
 * @param y Y-Koordinate.
 * @param topY Y-Koordinate der obersten Linie (Line 5).
 * @param clef Notenschlüssel (für gültige Positionen).
 * @returns Position oder null.
 */
export function getPositionFromY(
  y: number,
  topY: number,
  clef: Clef,
): StaffPosition | null {
  const validNotes = getValidVisualizationNotes(clef);

  // Finde die nächste Position zur Y-Koordinate
  let bestPosition: StaffPosition | null = null;
  let bestDistance = Infinity;

  for (const midi of validNotes) {
    const pos = getNoteStaffPosition(midi, clef) as StaffPosition | null;
    if (!pos) continue;
    const posY = getYForPosition(pos, topY);
    const distance = Math.abs(y - posY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPosition = pos;
    }
  }

  // Toleranz-Check: nur akzeptieren, wenn nah genug
  const tolerance = STAFF_METRICS.LINE_SPACING / 2.5;
  return bestDistance <= tolerance ? bestPosition : null;
}

/**
 * Gibt die Y-Positionen der 5 Hauptlinien zurück.
 *
 * @param topY Y-Koordinate der obersten Linie (Line 5).
 * @returns Array von 5 Y-Koordinaten (von oben nach unten).
 */
export function getStaffLineYs(topY: number): number[] {
  return [
    topY,
    topY + STAFF_METRICS.LINE_SPACING,
    topY + 2 * STAFF_METRICS.LINE_SPACING,
    topY + 3 * STAFF_METRICS.LINE_SPACING,
    topY + 4 * STAFF_METRICS.LINE_SPACING,
  ];
}

/**
 * Berechnet, welche Hilfslinien für eine Note gezeichnet werden müssen.
 *
 * @param position Die anzuzeigende Position.
 * @param topY Y-Koordinate der obersten Linie.
 * @param clef Schlüssel.
 * @returns Array von Y-Koordinaten für Hilfslinien.
 */
export function getLedgerLineYs(
  position: StaffPosition,
  topY: number,
  clef: Clef,
): number[] {
  const info = parseStaffPosition(position);
  if (!info.isLedger || info.type !== 'ledger') return [];

  const result: number[] = [];
  if (info.direction === 'below') {
    // Alle Hilfslinien unterhalb von 1 bis zur aktuellen
    for (let n = 1; n <= info.number; n += 1) {
      const ledgerPos = `ledger-below-${n}` as StaffPosition;
      result.push(getYForPosition(ledgerPos, topY));
    }
  } else if (info.direction === 'above') {
    // Alle Hilfslinien oberhalb von 1 bis zur aktuellen
    for (let n = 1; n <= info.number; n += 1) {
      const ledgerPos = `ledger-above-${n}` as StaffPosition;
      result.push(getYForPosition(ledgerPos, topY));
    }
  }

  void clef;
  return result;
}