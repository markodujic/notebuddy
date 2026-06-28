/**
 * Adaptive Fehlergewichtung (framework-neutral).
 *
 * ⭐ Kernstück der Lern-Engine: Noten, die oft falsch beantwortet werden,
 * werden häufiger geübt.
 *
 * Konzept:
 *   - Jede Note hat ein Gewicht (weight), startet bei INITIAL_WEIGHT.
 *   - Fehler → weight += WEIGHT_INCREMENT_ON_ERROR (max MAX_ERROR_WEIGHT)
 *   - Erfolg → weight -= WEIGHT_DECREMENT_ON_SUCCESS (min MIN_WEIGHT)
 *   - weightedRandom wählt Noten mit Wahrscheinlichkeit proportional zum Gewicht.
 */

import { LEARNING_CONFIG } from './config';

/** Gewichtung einer einzelnen Note. */
export interface NoteWeight {
  midi: number;
  /** Aktuelles Gewicht (1–5). */
  weight: number;
  /** Anzahl Fehler. */
  errorCount: number;
  /** Anzahl Erfolge. */
  successCount: number;
  /** Zeitstempel der letzten Antwort. */
  lastSeen: number;
}

/**
 * Verwaltet die Gewichtung für alle Noten in einer Session.
 */
export class Weighting {
  private weights: Map<number, NoteWeight> = new Map();
  private readonly maxWeight: number;
  private readonly minWeight: number;
  private readonly initialWeight: number;
  private readonly increment: number;
  private readonly decrement: number;

  constructor(config?: {
    maxWeight?: number;
    minWeight?: number;
    initialWeight?: number;
    increment?: number;
    decrement?: number;
  }) {
    this.maxWeight = config?.maxWeight ?? LEARNING_CONFIG.MAX_ERROR_WEIGHT;
    this.minWeight = config?.minWeight ?? LEARNING_CONFIG.MIN_WEIGHT;
    this.initialWeight = config?.initialWeight ?? LEARNING_CONFIG.INITIAL_WEIGHT;
    this.increment = config?.increment ?? LEARNING_CONFIG.WEIGHT_INCREMENT_ON_ERROR;
    this.decrement = config?.decrement ?? LEARNING_CONFIG.WEIGHT_DECREMENT_ON_SUCCESS;
  }

  /**
   * Initialisiert die Gewichtung für alle gegebenen MIDI-Noten.
   */
  initialize(allMidi: number[]): void {
    this.weights.clear();
    for (const midi of allMidi) {
      this.weights.set(midi, {
        midi,
        weight: this.initialWeight,
        errorCount: 0,
        successCount: 0,
        lastSeen: 0,
      });
    }
  }

  /**
   * Aktualisiert das Gewicht einer Note nach einer Antwort.
   *
   * @param midi MIDI-Nummer.
   * @param correct War die Antwort korrekt?
   * @param timestamp Zeitstempel (Default: now).
   */
  update(midi: number, correct: boolean, timestamp = Date.now()): void {
    const entry = this.weights.get(midi);
    if (!entry) return;

    if (correct) {
      entry.successCount += 1;
      entry.weight = Math.max(this.minWeight, entry.weight - this.decrement);
    } else {
      entry.errorCount += 1;
      entry.weight = Math.min(this.maxWeight, entry.weight + this.increment);
    }
    entry.lastSeen = timestamp;
  }

  /**
   * Gibt das Gewicht einer Note zurück (oder initialWeight, falls unbekannt).
   */
  getWeight(midi: number): number {
    return this.weights.get(midi)?.weight ?? this.initialWeight;
  }

  /**
   * Gibt die NoteWeight-Eintrag für eine Note zurück.
   */
  getEntry(midi: number): NoteWeight | undefined {
    return this.weights.get(midi);
  }

  /**
   * Gibt alle verwalteten NoteWeight-Einträge zurück.
   */
  getAllEntries(): NoteWeight[] {
    return Array.from(this.weights.values());
  }

  /**
   * Gibt die Gesamtsumme aller Gewichte zurück.
   */
  totalWeight(): number {
    let sum = 0;
    for (const entry of this.weights.values()) {
      sum += entry.weight;
    }
    return sum;
  }

  /**
   * Exportiert die Gewichte als flaches Objekt (für Persistenz).
   */
  export(): Record<number, NoteWeight> {
    const result: Record<number, NoteWeight> = {};
    for (const [midi, entry] of this.weights) {
      result[midi] = { ...entry };
    }
    return result;
  }

  /**
   * Importiert Gewichte aus einem flachen Objekt (für Persistenz).
   */
  import(data: Record<number, NoteWeight>): void {
    this.weights.clear();
    for (const [midiStr, entry] of Object.entries(data)) {
      const midi = Number(midiStr);
      this.weights.set(midi, { ...entry, midi });
    }
  }
}

/**
 * Wählt eine MIDI-Nummer aus einer Liste, gewichtet nach ihren Gewichten.
 *
 * Eine Note mit Gewicht 5 ist 5× wahrscheinlicher als eine mit Gewicht 1.
 *
 * @param allMidi Liste aller gültigen MIDI-Nummern.
 * @param weighting Gewichtungs-Instanz.
 * @returns Gewählte MIDI-Nummer.
 */
export function weightedRandom(allMidi: number[], weighting: Weighting): number {
  if (allMidi.length === 0) {
    throw new Error('weightedRandom: allMidi darf nicht leer sein');
  }

  const weights = allMidi.map((midi) => weighting.getWeight(midi));
  const total = weights.reduce((sum, w) => sum + w, 0);

  if (total <= 0) {
    // Fallback: uniform random
    return allMidi[Math.floor(Math.random() * allMidi.length)];
  }

  let r = Math.random() * total;
  for (let i = 0; i < allMidi.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return allMidi[i];
  }
  return allMidi[allMidi.length - 1];
}