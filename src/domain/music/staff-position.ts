/**
 * Staff-Position-System (Kernstück der Visualisierung, framework-neutral).
 *
 * Jede Position im Notensystem ist eindeutig als String-Key definiert.
 * Pro Schlüssel gibt es:
 *   - 5 Hauptlinien (line-1 … line-5, von unten)
 *   - 4 Zwischenräume im Hauptsystem (space-1 … space-4, von unten)
 *   - 5 Hilfslinien oben + je 1 Zwischenraum (ledger-above-N / -space-N)
 *   - 5 Hilfslinien unten + je 1 Zwischenraum (ledger-below-N / -space-N)
 */

/** Notenschlüssel. */
export type Clef = 'treble' | 'bass';

/**
 * Position im Notensystem als eindeutiger String-Key.
 *
 * Schema (von unten/innen nach außen):
 * - 'line-1' … 'line-5'                        Hauptlinien
 * - 'space-1' … 'space-4'                      Zwischenräume im System
 * - 'ledger-above-space-1' … 'ledger-above-space-5'  Zwischenraum über System
 * - 'ledger-above-1' … 'ledger-above-5'              Hilfslinie oben
 * - 'ledger-below-space-1' … 'ledger-below-space-5'  Zwischenraum unter System
 * - 'ledger-below-1' … 'ledger-below-5'              Hilfslinie unten
 */
export type StaffPosition =
  | `line-${1 | 2 | 3 | 4 | 5}`
  | `space-${1 | 2 | 3 | 4}`
  | `ledger-above-${1 | 2 | 3 | 4 | 5}`
  | `ledger-above-space-${1 | 2 | 3 | 4 | 5}`
  | `ledger-below-${1 | 2 | 3 | 4 | 5}`
  | `ledger-below-space-${1 | 2 | 3 | 4 | 5}`;

/** Richtung einer Hilfslinie. */
export type LedgerDirection = 'above' | 'below';

/** Typ einer Position. */
export type StaffPositionType = 'line' | 'space' | 'ledger' | 'ledger-space';

/** Strukturierte Positionsinformation. */
export interface StaffPositionInfo {
  position: StaffPosition;
  type: StaffPositionType;
  /** Liniennummer (1–5) oder Hilfslinie-Nummer (1–5). */
  number: number;
  /** Nur bei Hilfslinien: Richtung. */
  direction?: LedgerDirection;
  /** True, wenn es eine Hilfslinie ist (nicht Hauptsystem). */
  isLedger: boolean;
}

// ── Violinschlüssel (Treble) ──────────────────────────────────────────────
// Hauptsystem: Line 1 (E4=64) bis Line 5 (F5=77)
// Middle C (C4=60) = 1. Hilfslinie unten
//
// Vollständiges diatonisches Mapping (nur Stammtöne):
const TREBLE_DIATONIC: ReadonlyMap<number, StaffPosition> = new Map<number, StaffPosition>([
  // ── Unterhalb des Systems (von unten nach oben) ──
  [47, 'ledger-below-5'], // B2
  [48, 'ledger-below-space-5'], // C3
  [50, 'ledger-below-4'], // D3
  [52, 'ledger-below-space-4'], // E3
  [53, 'ledger-below-3'], // F3
  [55, 'ledger-below-space-3'], // G3
  [57, 'ledger-below-2'], // A3
  [59, 'ledger-below-space-2'], // B3/H3
  [60, 'ledger-below-1'], // C4 – Middle C
  [62, 'ledger-below-space-1'], // D4
  // ── Hauptsystem (von unten nach oben) ──
  [64, 'line-1'], // E4
  [65, 'space-1'], // F4
  [67, 'line-2'], // G4
  [69, 'space-2'], // A4
  [71, 'line-3'], // B4 / H4
  [72, 'space-3'], // C5
  [74, 'line-4'], // D5
  [76, 'space-4'], // E5
  [77, 'line-5'], // F5
  // ── Oberhalb des Systems (von unten nach oben) ──
  [79, 'ledger-above-space-1'], // G5
  [81, 'ledger-above-1'], // A5
  [83, 'ledger-above-space-2'], // B5 / H5
  [84, 'ledger-above-2'], // C6
  [86, 'ledger-above-space-3'], // D6
  [88, 'ledger-above-3'], // E6
  [89, 'ledger-above-space-4'], // F6
  [91, 'ledger-above-4'], // G6
  [93, 'ledger-above-space-5'], // A6
  [95, 'ledger-above-5'], // B6 / H6
]);

// ── Bassschlüssel (Bass) ──────────────────────────────────────────────────
// Hauptsystem: Line 1 (G2=43) bis Line 5 (A3=57)
// Middle C (C4=60) = 1. Hilfslinie oben
//
// Vollständiges diatonisches Mapping (nur Stammtöne):
const BASS_DIATONIC: ReadonlyMap<number, StaffPosition> = new Map<number, StaffPosition>([
  // ── Unterhalb des Systems (von unten nach oben) ──
  [26, 'ledger-below-5'], // D1
  [28, 'ledger-below-space-5'], // E1
  [29, 'ledger-below-4'], // F1
  [31, 'ledger-below-space-4'], // G1
  [33, 'ledger-below-3'], // A1
  [35, 'ledger-below-space-3'], // B1 / H1
  [36, 'ledger-below-2'], // C2
  [38, 'ledger-below-space-2'], // D2
  [40, 'ledger-below-1'], // E2
  [41, 'ledger-below-space-1'], // F2
  // ── Hauptsystem (von unten nach oben) ──
  [43, 'line-1'], // G2
  [45, 'space-1'], // A2
  [47, 'line-2'], // B2 / H2
  [48, 'space-2'], // C3
  [50, 'line-3'], // D3
  [52, 'space-3'], // E3
  [53, 'line-4'], // F3
  [55, 'space-4'], // G3
  [57, 'line-5'], // A3
  // ── Oberhalb des Systems (von unten nach oben) ──
  [59, 'ledger-above-space-1'], // B3 / H3
  [60, 'ledger-above-1'], // C4 – Middle C
  [62, 'ledger-above-space-2'], // D4
  [64, 'ledger-above-2'], // E4
  [65, 'ledger-above-space-3'], // F4
  [67, 'ledger-above-3'], // G4
  [69, 'ledger-above-space-4'], // A4
  [71, 'ledger-above-4'], // B4 / H4
  [72, 'ledger-above-space-5'], // C5
  [74, 'ledger-above-5'], // D5
]);

/**
 * Gibt die Position einer Note im Notensystem zurück.
 *
 * @param midi MIDI-Nummer.
 * @param clef Notenschlüssel.
 * @returns Position oder null, wenn die Note nicht darstellbar ist.
 */
export function getNoteStaffPosition(midi: number, clef: Clef): StaffPosition | null {
  const map = clef === 'treble' ? TREBLE_DIATONIC : BASS_DIATONIC;
  return map.get(midi) ?? null;
}

/**
 * Gibt alle gültigen MIDI-Nummern für die Visualisierung zurück.
 * Nur Stammtöne, da der Visualisierungsmodus keine Vorzeichen unterstützt.
 *
 * @param clef Notenschlüssel.
 */
export function getValidVisualizationNotes(clef: Clef): number[] {
  const map = clef === 'treble' ? TREBLE_DIATONIC : BASS_DIATONIC;
  return Array.from(map.keys()).sort((a, b) => a - b);
}

/**
 * Parst eine Position in strukturierte Informationen.
 */
export function parseStaffPosition(position: StaffPosition): StaffPositionInfo {
  if (position.startsWith('line-')) {
    return {
      position,
      type: 'line',
      number: Number(position.slice('line-'.length)),
      isLedger: false,
    };
  }
  if (position.startsWith('space-')) {
    return {
      position,
      type: 'space',
      number: Number(position.slice('space-'.length)),
      isLedger: false,
    };
  }
  if (position.startsWith('ledger-above-space-')) {
    return {
      position,
      type: 'ledger-space',
      number: Number(position.slice('ledger-above-space-'.length)),
      direction: 'above',
      isLedger: true,
    };
  }
  if (position.startsWith('ledger-below-space-')) {
    return {
      position,
      type: 'ledger-space',
      number: Number(position.slice('ledger-below-space-'.length)),
      direction: 'below',
      isLedger: true,
    };
  }
  if (position.startsWith('ledger-above-')) {
    return {
      position,
      type: 'ledger',
      number: Number(position.slice('ledger-above-'.length)),
      direction: 'above',
      isLedger: true,
    };
  }
  // ledger-below-
  return {
    position,
    type: 'ledger',
    number: Number(position.slice('ledger-below-'.length)),
    direction: 'below',
    isLedger: true,
  };
}

/**
 * Vergleicht zwei Positionen, mit Toleranz für weggelassene Richtung
 * bei Hilfslinien ("erste Hilfslinie" ohne oben/unten).
 *
 * Wenn ledgerDirectionOmitted=true, werden nur die Nummern verglichen:
 * 'ledger-above-1' == 'ledger-below-1' → true
 */
export function positionsMatch(
  actual: StaffPosition,
  expected: StaffPosition,
  ledgerDirectionOmitted = false,
): boolean {
  if (actual === expected) return true;
  if (!ledgerDirectionOmitted) return false;

  const a = parseStaffPosition(actual);
  const e = parseStaffPosition(expected);
  return a.number === e.number && a.isLedger === e.isLedger && a.type === e.type;
}

/**
 * Gibt die MIDI-Nummer zu einer Position zurück (Umkehrung des Mappings).
 */
export function getMidiForPosition(position: StaffPosition, clef: Clef): number | null {
  const map = clef === 'treble' ? TREBLE_DIATONIC : BASS_DIATONIC;
  for (const [midi, pos] of map) {
    if (pos === position) return midi;
  }
  return null;
}

/** Alle Hauptlinien eines Schlüssels (von unten nach oben). */
export const STAFF_LINES: ReadonlyArray<StaffPosition> = [
  'line-1',
  'line-2',
  'line-3',
  'line-4',
  'line-5',
];

/** Alle Zwischenräume eines Schlüssels (von unten nach oben). */
export const STAFF_SPACES: ReadonlyArray<StaffPosition> = [
  'space-1',
  'space-2',
  'space-3',
  'space-4',
];