/**
 * NotationSystem-Interface (framework-neutral).
 *
 * Ein Notation-System kapselt die Benennung von Noten (MIDI → Name)
 * und das Parsing von Namen/Text → Notenindex.
 * Das musikalische Kernmodell (Note, Range, etc.) kennt nur MIDI
 * und ist vollständig unabhängig vom gewählten Notation-System.
 */


/** IDs der unterstützten Notationssysteme. */
export type NotationSystemId = 'german' | 'english' | 'solfege' | 'nordic';

/** Optionen für die Namensausgabe. */
export interface NameOptions {
  /** Wenn true, werden Vorzeichen als 'b' statt '#' notiert (z.B. Db statt C#). */
  useFlats?: boolean;
}

/** Optionen für die Display-Ausgabe (Name + Oktave). */
export interface DisplayOptions extends NameOptions {
  /** Stil der Oktav-Kennzeichnung. */
  octaveStyle?: 'number' | 'helmholtz';
}

/**
 * Vertrag für ein Notation-System.
 *
 * Jedes System implementiert dieses Interface und wird über die Registry
 * (registry.ts) registriert.
 */
export interface NotationSystem {
  /** Eindeutige ID. */
  id: NotationSystemId;
  /** Anzeigename (z.B. "Deutsch", "Solfège"). */
  label: string;
  /** Kurze Beschreibung. */
  description: string;

  /**
   * Chromatische Notennamen (12 Einträge, Index 0–11).
   * Index 0 = C, Index 11 = H/B.
   * Vorzeichen standardmäßig als '#' (kann durch useFlats überschrieben werden).
   */
  noteNames: readonly string[];
  /** Alternative Namen mit 'b' (falls useFlats unterstützt wird). */
  noteNamesFlat?: readonly string[];
  /** Stammtöne (7 Einträge: C D E F G A H/B). */
  naturalNames: readonly string[];

  /**
   * Konvertiert eine MIDI-Nummer in den Notennamen (ohne Oktave).
   * @param midi MIDI-Nummer.
   * @param opts Optionen (z.B. useFlats).
   */
  midiToName(midi: number, opts?: NameOptions): string;

  /**
   * Konvertiert eine MIDI-Nummer in einen Anzeigenamen (Name + Oktave).
   * @param midi MIDI-Nummer.
   * @param opts Optionen (z.B. octaveStyle: 'helmholtz').
   */
  midiToDisplay(midi: number, opts?: DisplayOptions): string;

  /**
   * Parst einen Notennamen in den chromatischen Index (0–11).
   * Sollte tolerant sein (z.B. "cis", "C#", "Bb", "des").
   * @returns Index 0–11 oder -1 bei ungültigem Namen.
   */
  nameToIndex(name: string): number;

  /**
   * Gibt die Helmholtz-Oktav-Notation für eine MIDI-Nummer zurück.
   * z.B. c′ (eingestrichenes c = C4 = MIDI 60).
   */
  helmholtzFor(midi: number): string;
}

/**
 * Hilfsfunktion: Berechnet den chromatischen Index (0–11) aus MIDI.
 */
export function midiToNoteIndex(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/**
 * Hilfsfunktion: Berechnet die科学liche Oktave (C4 = MIDI 60).
 */
export function midiToScientificOctave(midi: number): number {
  return Math.floor((midi - 12) / 12);
}