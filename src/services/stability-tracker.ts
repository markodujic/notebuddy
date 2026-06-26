/**
 * Stability-Tracker (framework-neutral service).
 *
 * Eine Note muss konstant gehalten werden, bevor sie akzeptiert wird.
 * Der Tracker zählt die Dauer seit Start und liefert einen Progress (0–1).
 */

/** Konfiguration für den Stability-Tracker. */
export interface StabilityConfig {
  /** Ziel-MIDI (die Note, die gehalten werden soll). */
  targetMidi: number;
  /** Toleranz in Cents (optional, Default 25). */
  toleranceCents?: number;
  /** Dauer in ms, bis eine Note als stabil gilt. */
  stabilityMs: number;
}

/** Ergebnis eines Stability-Updates. */
export interface StabilityResult {
  /** Fortschritt 0–1. */
  progress: number;
  /** Ist die Note stabil? */
  isStable: boolean;
  /** Hat sich die MIDI-Note geändert (Reset)? */
  reset: boolean;
  /** Erkannte MIDI-Note. */
  detectedMidi: number;
  /** Dauer in ms seit Start. */
  duration: number;
}

/**
 * Verfolgt, wie lange eine Note konstant gehalten wird.
 */
export class StabilityTracker {
  private config: StabilityConfig;
  private currentMidi: number | null = null;
  private startTime = 0;
  private lastUpdate = 0;

  constructor(config: StabilityConfig) {
    this.config = config;
  }

  /** Setzt eine neue Konfiguration (z.B. neue Zielnote). */
  configure(config: StabilityConfig): void {
    this.config = config;
    this.reset();
  }

  /** Setzt den Tracker zurück. */
  reset(): void {
    this.currentMidi = null;
    this.startTime = 0;
    this.lastUpdate = 0;
  }

  /**
   * Aktualisiert den Tracker mit einem neuen Frame.
   *
   * @param detectedMidi Erkannte MIDI-Nummer.
   * @param isMatch Entspricht die Note der Zielnote (innerhalb Toleranz)?
   * @param timestamp Zeitstempel in ms.
   */
  update(detectedMidi: number, isMatch: boolean, timestamp: number): StabilityResult {
    // Reset, wenn die Note wechselt
    const reset = this.currentMidi !== null && this.currentMidi !== detectedMidi;

    if (this.currentMidi === null || reset) {
      this.currentMidi = detectedMidi;
      this.startTime = timestamp;
    }

    this.lastUpdate = timestamp;
    const duration = timestamp - this.startTime;
    const progress = Math.min(1, duration / this.config.stabilityMs);
    const isStable = duration >= this.config.stabilityMs && isMatch;

    return {
      progress,
      isStable,
      reset,
      detectedMidi,
      duration,
    };
  }

  /** Gibt den aktuellen Fortschritt zurück (ohne Update). */
  getProgress(timestamp: number): number {
    if (this.startTime === 0) return 0;
    return Math.min(1, (timestamp - this.startTime) / this.config.stabilityMs);
  }
}