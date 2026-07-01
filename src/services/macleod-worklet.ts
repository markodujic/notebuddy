/**
 * MacLeod Pitch-Detection – Worklet-Safe Portierung (Stufe C).
 *
 * Rein funktionale Factory-Funktion statt Klasse, damit der Algorithmus im
 * nativen Audio-Thread (`WorkletNode['AudioRuntime']`) laufen kann.
 *
 * Worklet-Constraints (siehe PITCH-STAGE-C-PLAN.md):
 * - Kein `this`, keine Klassen
 * - Pre-allocated Buffers via Closure-HOF → kein GC-Druck pro Frame
 * - Nur reine Arithmetik auf Float32Array / number
 *
 * Der Algorithmus ist identisch mit `pitch-detector.ts` (Stufe A), nur ohne
 * Klassen-Overhead. Siehe PITCH-DATAFLOW-PLAN.md für Architektur-Kontext.
 */

/** Ergebnis der Pitch-Detection (identisch zur Stufe-A-Version). */
export interface WorkletPitchResult {
  /** Erkannte Frequenz in Hz (0, falls kein Pitch gefunden). */
  readonly frequency: number;
  /** Clarity/Konfidenz (0–1). */
  readonly clarity: number;
}

/** Standard-Puffergröße (~46ms bei 44.1kHz). Muss mit WorkletNode-Buffer übereinstimmen. */
export const WORKLET_BUFFER_SIZE = 2048;

/** MacLeod-Peak-Threshold. Gleicher Wert wie Stufe-A-Klasse. */
const MACLEOD_THRESHOLD = 0.1;

/**
 * Erzeugt eine worklet-safe Pitch-Detection-Funktion mit pre-allocated Buffers.
 *
 * Die zurückgegebene Funktion ist eine Closure über NSDF-Buffer und Peak-Liste →
 * keine Allokationen pro Frame, kein GC-Druck.
 *
 * Usage im Worklet-Callback:
 * ```ts
 * const detect = createMacLeodWorklet(2048, 44100);
 * // später pro Frame:
 * const { frequency, clarity } = detect(samples);
 * ```
 *
 * @param bufferSize  Puffergröße (sollte mit WorkletNode `bufferLength` übereinstimmen).
 * @param sampleRate  Sample-Rate in Hz.
 * @returns worklet-safe Detect-Funktion.
 */
export function createMacLeodWorklet(
  bufferSize: number,
  sampleRate: number,
): (samples: Float32Array) => WorkletPitchResult {
  "worklet";

  // Pre-allocated Buffers (Closure-Scope, einmalig allokiert)
  const nsdf = new Float32Array(bufferSize);
  const maxPositions: number[] = [];

  /**
   * Berechnet die Normalized Square Difference Function (NSDF).
   *
   * NSDF(τ) = 2·r(τ) / m(τ)
   *   r(τ) = Σ x[i] · x[i+τ]      (Autokorrelation)
   *   m(τ) = Σ x[i]² + x[i+τ]²    (Normalisierungs-Divisor, McLeod)
   */
  function calculateNSDF(buffer: Float32Array): void {
    "worklet";
    const size = Math.min(bufferSize, buffer.length);

    for (let tau = 0; tau < size; tau += 1) {
      let acf = 0; // Autokorrelation r(τ)
      let divisorM = 0; // Divisor m(τ) = Σ(x[i]² + x[i+τ]²)

      for (let i = 0; i < size - tau; i += 1) {
        acf += buffer[i] * buffer[i + tau];
        divisorM += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
      }

      nsdf[tau] = divisorM === 0 ? 0 : (2 * acf) / divisorM;
    }
  }

  /** Sammelt signifikante Peaks der NSDF (lokale Maxima über Threshold). */
  function collectPeaks(): void {
    "worklet";
    maxPositions.length = 0;

    for (let tau = 1; tau < bufferSize - 1; tau += 1) {
      if (nsdf[tau] > MACLEOD_THRESHOLD) {
        // Aufsteigende Flanke → Spitze → Absteigende Flanke = Peak
        if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) {
          maxPositions.push(tau);
        }
      }
    }
  }

  /** Wählt den höchsten Peak aus. Gibt {position, clarity} zurück. */
  function selectHighestPeak(): { position: number; clarity: number } {
    "worklet";
    let maxPosition = 0;
    let maxValue = 0;

    for (let i = 0; i < maxPositions.length; i += 1) {
      const tau = maxPositions[i];
      if (nsdf[tau] > maxValue) {
        maxValue = nsdf[tau];
        maxPosition = tau;
      }
    }

    return { position: maxPosition, clarity: Math.min(1, maxValue) };
  }

  /**
   * Parabolische Interpolation für Sub-Sample-Genauigkeit.
   * Legt Parabel durch (tau-1, tau, tau+1) und berechnet das Maximum.
   */
  function parabolicInterpolation(position: number): number {
    "worklet";
    const x0 = position > 0 ? position - 1 : position;
    const x2 = position < bufferSize - 1 ? position + 1 : position;

    if (x0 === position) {
      return nsdf[position] <= nsdf[x2]
        ? position +
            (nsdf[x2] - nsdf[position]) /
              (2 * (nsdf[x2] - 2 * nsdf[position] + nsdf[x0]))
        : position;
    }

    if (x2 === position) {
      return position;
    }

    const s0 = nsdf[x0];
    const s1 = nsdf[position];
    const s2 = nsdf[x2];

    const denominator = 2 * (2 * s1 - s2 - s0);
    if (denominator === 0) return position;

    return position + (s2 - s0) / denominator;
  }

  // Rückgabe: die eigentliche Detect-Funktion (Closure über alle Buffers)
  return function detect(samples: Float32Array): WorkletPitchResult {
    "worklet";

    // 1. NSDF berechnen
    calculateNSDF(samples);

    // 2. Peaks sammeln
    collectPeaks();

    if (maxPositions.length === 0) {
      return { frequency: 0, clarity: 0 };
    }

    // 3. Höchsten Peak wählen
    const { position, clarity } = selectHighestPeak();

    if (position === 0) {
      return { frequency: 0, clarity };
    }

    // 4. Parabolische Interpolation + Frequenz
    const betterPosition = parabolicInterpolation(position);
    const frequency = sampleRate / betterPosition;

    return { frequency, clarity };
  };
}
