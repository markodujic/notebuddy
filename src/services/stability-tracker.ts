/**
 * Stability-Tracker (framework-neutral service).
 *
 * Eine Note muss konstant gehalten werden, bevor sie akzeptiert wird.
 * Der Tracker zählt die Dauer seit Start und liefert einen Progress (0–1).
 *
 * Toleranz-Modus: Kurze Erkennungs-Jitter (1–2 Frames mit abweichender
 * MIDI-Note) führen NICHT zu einem Reset. Erst nach `maxConsecutiveMismatches`
 * aufeinanderfolgenden Fehl-Frames wird der Timer zurückgesetzt.
 */

/** Konfiguration für den Stability-Tracker. */
export interface StabilityConfig {
  /** Ziel-MIDI (die Note, die gehalten werden soll). */
  targetMidi: number;
  /** Toleranz in Cents (optional, Default 25). */
  toleranceCents?: number;
  /** Dauer in ms, bis eine Note als stabil gilt. */
  stabilityMs: number;
  /**
   * Max. Anzahl aufeinanderfolgender Frames mit abweichender MIDI-Note,
   * bevor der Tracker zurückgesetzt wird (Default: 2).
   * Höhere Werte = robuster gegen kurzfristige Erkennungsfehler (Oktavsprünge,
   * Rauschen). Bei 0 verhält sich der Tracker wie vorher (sofortiger Reset).
   */
  maxConsecutiveMismatches?: number;
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
 *
 * Der Tracker toleriert bis zu `maxConsecutiveMismatches` aufeinanderfolgende
 * Frames mit einer abweichenden MIDI-Note, bevor er den Timer zurücksetzt.
 * Das verhindert, dass kurzfristige Erkennungsfehler (Oktavsprünge, Jitter)
 * die Stabilitätsschwelle unerreichbar machen.
 */
export class StabilityTracker {
  private config: StabilityConfig;
  private currentMidi: number | null = null;
  private startTime = 0;
  private lastUpdate = 0;
  private consecutiveMismatches = 0;
  private maxMismatches: number;

  constructor(config: StabilityConfig) {
    this.config = config;
    this.maxMismatches = config.maxConsecutiveMismatches ?? 2;
  }

  /** Setzt eine neue Konfiguration (z.B. neue Zielnote). */
  configure(config: StabilityConfig): void {
    this.config = config;
    this.maxMismatches = config.maxConsecutiveMismatches ?? 2;
    this.reset();
  }

  /** Setzt den Tracker zurück. */
  reset(): void {
    this.currentMidi = null;
    this.startTime = 0;
    this.lastUpdate = 0;
    this.consecutiveMismatches = 0;
  }

  /**
   * Aktualisiert den Tracker mit einem neuen Frame.
   *
   * @param detectedMidi Erkannte MIDI-Nummer.
   * @param isMatch Entspricht die Note der Zielnote (innerhalb Toleranz)?
   * @param timestamp Zeitstempel in ms.
   */
  update(
    detectedMidi: number,
    isMatch: boolean,
    timestamp: number,
  ): StabilityResult {
    let reset = false;

    if (this.currentMidi === null) {
      // Erster Frame → Timer starten
      this.currentMidi = detectedMidi;
      this.startTime = timestamp;
      this.consecutiveMismatches = 0;
    } else if (this.currentMidi === detectedMidi) {
      // Gleiche Note → Mismatch-Counter zurücksetzen
      this.consecutiveMismatches = 0;
    } else {
      // Abweichende Note → Mismatch zählen
      this.consecutiveMismatches += 1;
      if (this.consecutiveMismatches > this.maxMismatches) {
        // Zu viele aufeinanderfolgende Abweichungen → Reset auf neue Note
        reset = true;
        this.currentMidi = detectedMidi;
        this.startTime = timestamp;
        this.consecutiveMismatches = 0;
      }
      // Sonst: toleriere den Ausreißer, behalte die aktuelle Note als Referenz
    }

    this.lastUpdate = timestamp;
    const duration = timestamp - this.startTime;
    const progress = Math.min(1, duration / this.config.stabilityMs);
    const isStable = duration >= this.config.stabilityMs && isMatch;

    return {
      progress,
      isStable,
      reset,
      detectedMidi: this.currentMidi ?? detectedMidi,
      duration,
    };
  }

  /** Gibt den aktuellen Fortschritt zurück (ohne Update). */
  getProgress(timestamp: number): number {
    if (this.startTime === 0) return 0;
    return Math.min(1, (timestamp - this.startTime) / this.config.stabilityMs);
  }
}
