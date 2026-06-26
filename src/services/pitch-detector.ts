/**
 * Pitch-Detector – MacLeod Autocorrelation-Algorithmus (framework-neutral).
 *
 * Implementiert den MacLeod-Pitch-Detection-Algorithmus, ähnlich wie
 * die "Pitchy"-Library der alten App. Liefert Frequenz + Clarity.
 *
 * Der Algorithmus basiert auf der Normalized Square Difference Function (NSDF)
 * und ist besonders robust für tonhafte Signale (Gesang, Instrumente).
 */

/** Ergebnis der Pitch-Detection. */
export interface PitchDetectionResult {
  /** Erkannte Frequenz in Hz (0, falls kein Pitch gefunden). */
  frequency: number;
  /** Clarity/Konfidenz (0–1). */
  clarity: number;
}

/** Standard-Puffergröße für die Analyse (entspricht ~46ms bei 44.1kHz). */
export const DEFAULT_BUFFER_SIZE = 2048;

/**
 * MacLeod Pitch-Detector.
 *
 * Der Algorithmus:
 *   1. Berechne die Autokorrelation (NSDF) des Signals.
 *   2. Finde signifikante Peaks.
 *   3. Parabolische Interpolation für Sub-Sample-Genauigkeit.
 *   4. Frequenz = sampleRate / period.
 */
export class MacLeodPitchDetector {
  private readonly bufferSize: number;
  private readonly sampleRate: number;
  private readonly threshold: number;

  // Pre-allocated Buffers für Performance (keine GC-Druck pro Frame)
  private nsdf: Float32Array;
  private maxPositions: number[];

  constructor(bufferSize = DEFAULT_BUFFER_SIZE, sampleRate = 44100, threshold = 0.1) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.threshold = threshold;
    this.nsdf = new Float32Array(bufferSize);
    this.maxPositions = [];
  }

  /**
   * Erkennt die Tonhöhe in einem Audio-Buffer.
   *
   * @param buffer Float32Array mit Audio-Samples (-1.0 bis 1.0).
   * @returns {frequency, clarity} – frequency=0 wenn kein Pitch.
   */
  getPitch(buffer: Float32Array): PitchDetectionResult {
    this.nsdf.fill(0);
    this.maxPositions.length = 0;

    // 1. Berechne NSDF (Normalized Square Difference Function)
    this.calculateNSDF(buffer);

    // 2. Sammle die Peaks
    this.collectPeaks();

    if (this.maxPositions.length === 0) {
      return { frequency: 0, clarity: 0 };
    }

    // 3. Wähle den höchsten Peak über dem Threshold
    const { position, clarity } = this.selectHighestPeak();

    if (position === 0) {
      return { frequency: 0, clarity };
    }

    // 4. Parabolische Interpolation für Sub-Sample-Genauigkeit
    const betterPosition = this.parabolicInterpolation(position);
    const frequency = this.sampleRate / betterPosition;

    return { frequency, clarity };
  }

  /**
   * Berechnet die Normalized Square Difference Function (NSDF).
   */
  private calculateNSDF(buffer: Float32Array): void {
    const size = Math.min(this.bufferSize, buffer.length);

    for (let tau = 0; tau < size; tau += 1) {
      let acf = 0; // Autocorrelation
      let divisorM = 0; // Divisor (Normalisierung)

      for (let i = 0; i < size - tau; i += 1) {
        const squared = buffer[i] * buffer[i + tau];
        acf += squared;
        divisorM += squared;
      }

      this.nsdf[tau] = divisorM === 0 ? 0 : (2 * acf) / divisorM;
    }
  }

  /**
   * Sammelt die signifikanten Peaks der NSDF.
   */
  private collectPeaks(): void {
    let lastPosition = 0;
    const size = this.bufferSize;

    for (let tau = 1; tau < size - 1; tau += 1) {
      // Aufsteigende Flanke → Spitze → Absteigende Flanke = Peak
      if (this.nsdf[tau] > this.threshold) {
        if (this.nsdf[tau] > this.nsdf[tau - 1] && this.nsdf[tau] >= this.nsdf[tau + 1]) {
          // Lokales Maximum gefunden
          this.maxPositions.push(tau);
          lastPosition = tau;
        }
      }
    }
    void lastPosition;
  }

  /**
   * Wählt den höchsten Peak aus.
   */
  private selectHighestPeak(): { position: number; clarity: number } {
    let maxPosition = 0;
    let maxValue = 0;

    for (const tau of this.maxPositions) {
      if (this.nsdf[tau] > maxValue) {
        maxValue = this.nsdf[tau];
        maxPosition = tau;
      }
    }

    return { position: maxPosition, clarity: Math.min(1, maxValue) };
  }

  /**
   * Parabolische Interpolation für Sub-Sample-Genauigkeit.
   *
   * Verbessert die Frequenzauflösung, indem die Parabel durch drei Punkte
   * (tau-1, tau, tau+1) gelegt und das Maximum berechnet wird.
   */
  private parabolicInterpolation(position: number): number {
    const x0 = position > 0 ? position - 1 : position;
    const x2 = position < this.bufferSize - 1 ? position + 1 : position;

    if (x0 === position) {
      return this.nsdf[position] <= this.nsdf[x2]
        ? position + (this.nsdf[x2] - this.nsdf[position]) / (2 * (this.nsdf[x2] - 2 * this.nsdf[position] + this.nsdf[x0]))
        : position;
    }

    if (x2 === position) {
      return position;
    }

    const s0 = this.nsdf[x0];
    const s1 = this.nsdf[position];
    const s2 = this.nsdf[x2];

    const denominator = 2 * (2 * s1 - s2 - s0);
    if (denominator === 0) return position;

    return position + (s2 - s0) / denominator;
  }
}

/**
 * Berechnet den RMS-Wert (Root Mean Square) eines Audio-Buffers.
 * Wird als Lautstärke-/Rauschfilter verwendet.
 */
export function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}