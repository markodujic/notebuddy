/**
 * SpeechInputService – 1:1-Portierung von `input/SpeechInput.ts` (notenlern-app)
 * auf `expo-speech-recognition`.
 *
 * Erkennt deutsche Notensystem-Positionen:
 *   „dritte Linie" → line-3
 *   „zweiter Zwischenraum" → space-2
 *   „erste Hilfslinie oben" → ledger-above-1
 *   „unter der ersten Linie" → ledger-below-space-1
 *   „Hilfslinie" ohne Richtung → Default unten + ledgerDirectionOmitted-Flag
 *
 * Auto-Restart-Loop wie das Web-Original (onend → restart nach 100ms).
 */

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type { EventSubscription } from 'expo-modules-core';

import type { StaffPosition } from '@/domain';

export interface SpeechResult {
  position: StaffPosition | null;
  /** True wenn „Hilfslinie" ohne „oben/unten" gesagt wurde. */
  ledgerDirectionOmitted?: boolean;
  transcript: string;
  confidence: number;
}

export interface ParsedPosition {
  position: StaffPosition | null;
  ledgerDirectionOmitted?: boolean;
}

/**
 * Parst einen Transkript-String in eine Staff-Position.
 * 1:1-Kopie aus `SpeechInput.ts#parsePosition` (inkl. Ordinal-/Kardinalzahlen-
 * Normalisierung und tolerantem Keyword-Matching).
 */
export function parseSpeechPosition(text: string): ParsedPosition {
  // Whitespace + Sprach-Artefakte normalisieren
  let normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');

  // Ordinalzahlen (alle deutschen Deklinationsformen)
  normalized = normalized
    .replace(/erste[nrsm]?/g, '1')
    .replace(/zweite[nrsm]?/g, '2')
    .replace(/dritte[nrsm]?/g, '3')
    .replace(/vierte[nrsm]?/g, '4')
    .replace(/f[uü]nfte[nrsm]?/g, '5')
    // Kardinalzahlen als Wörter
    .replace(/\beins\b/g, '1')
    .replace(/\bzwei\b/g, '2')
    .replace(/\bdrei\b/g, '3')
    .replace(/\bvier\b/g, '4')
    .replace(/\bf[uü]nf\b/g, '5')
    // Ziffer mit Ordinal-Suffix: „3." „3te" „3ter"
    .replace(/(\d)\.?\s*(?:te[nrsm]?|ste[nrsm]?)?/g, '$1');

  // Nummer extrahieren
  const numMatch = normalized.match(/(\d)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 0;

  if (num < 1 || num > 5) {
    return { position: null };
  }

  const t = normalized;

  // Positionstyp – tolerantes Matching (1:1)
  const isAbove = /oben|ober|über|darüber|drüber/.test(t);
  const isBelow = /unten|unter|darunter|drunter/.test(t);
  const isLedger = /hilfs/.test(t);
  const isLine = /lini/.test(t);
  const isSpace = /zwischen|raum/.test(t);

  // „unter der X." ohne „Linie" impliziert Linie
  const impliedLine = (isAbove || isBelow) && !isLine && !isSpace && !isLedger;

  // „unter der X. Linie" = Zwischenraum darunter, KEINE Hilfslinie
  const isRelativeToLine = (isLine || impliedLine) && !isLedger && (isAbove || isBelow);

  // Richtung bei Hilfslinie nicht gesagt?
  const ledgerDirectionOmitted = isLedger && !isAbove && !isBelow;

  if (isRelativeToLine) {
    if (isBelow && num === 1) {
      return { position: 'ledger-below-space-1' };
    }
    if (isAbove && num === 5) {
      return { position: 'ledger-above-space-1' };
    }
    // Andere „unter/über der X. Linie"-Fälle werden NICHT erkannt (1:1)
    return { position: null };
  }

  // Hilfslinie OHNE Richtungsangabe → Default unten + Flag
  if (ledgerDirectionOmitted) {
    if (isSpace) {
      const spaces: StaffPosition[] = [
        'ledger-below-space-1', 'ledger-below-space-2',
        'ledger-below-space-3', 'ledger-below-space-4',
        'ledger-below-space-5',
      ];
      return { position: spaces[num - 1] ?? null, ledgerDirectionOmitted: true };
    }
    const lines: StaffPosition[] = [
      'ledger-below-1', 'ledger-below-2',
      'ledger-below-3', 'ledger-below-4',
      'ledger-below-5',
    ];
    return { position: lines[num - 1] ?? null, ledgerDirectionOmitted: true };
  }

  // Im Hauptsystem (Linien/Zwischenräume)
  if (!isAbove && !isBelow && !isLedger) {
    if (isLine) {
      const lines: StaffPosition[] = ['line-1', 'line-2', 'line-3', 'line-4', 'line-5'];
      return { position: lines[num - 1] ?? null };
    }
    if (isSpace && num <= 4) {
      const spaces: StaffPosition[] = ['space-1', 'space-2', 'space-3', 'space-4'];
      return { position: spaces[num - 1] ?? null };
    }
  }

  // Hilfslinien oben (explizit „oben"/„über")
  if (isAbove && (isLedger || isSpace)) {
    if (isSpace) {
      const spaces: StaffPosition[] = [
        'ledger-above-space-1', 'ledger-above-space-2',
        'ledger-above-space-3', 'ledger-above-space-4',
        'ledger-above-space-5',
      ];
      return { position: spaces[num - 1] ?? null };
    }
    const lines: StaffPosition[] = [
      'ledger-above-1', 'ledger-above-2',
      'ledger-above-3', 'ledger-above-4',
      'ledger-above-5',
    ];
    return { position: lines[num - 1] ?? null };
  }

  // Hilfslinien unten (explizit „unten"/„unter")
  if (isBelow && (isLedger || isSpace)) {
    if (isSpace) {
      const spaces: StaffPosition[] = [
        'ledger-below-space-1', 'ledger-below-space-2',
        'ledger-below-space-3', 'ledger-below-space-4',
        'ledger-below-space-5',
      ];
      return { position: spaces[num - 1] ?? null };
    }
    const lines: StaffPosition[] = [
      'ledger-below-1', 'ledger-below-2',
      'ledger-below-3', 'ledger-below-4',
      'ledger-below-5',
    ];
    return { position: lines[num - 1] ?? null };
  }

  return { position: null };
}

/**
 * Spracherkennungs-Service (Singleton, wie `getSpeechInput()` im Original).
 * Continuous-Loop: Nach `end` wird nach 100ms automatisch neu gestartet,
 * solange `isListening` true ist – exakt wie das Web-onend-Verhalten.
 */
export class SpeechInputService {
  private isListening = false;
  private onResult: ((result: SpeechResult) => void) | null = null;
  private onStateChange: ((listening: boolean, transcript: string) => void) | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: EventSubscription[] = [];

  isActive(): boolean {
    return this.isListening;
  }

  /** Startet kontinuierliches Zuhören. Liefert jede erkannte Position. */
  async start(
    onResult: (result: SpeechResult) => void,
    onStateChange?: (listening: boolean, transcript: string) => void,
  ): Promise<void> {
    if (this.isListening) return;

    // Mikrofon-/Spracherkennungs-Berechtigung anfragen
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        onStateChange?.(false, '');
        return;
      }
    } catch {
      onStateChange?.(false, '');
      return;
    }

    this.onResult = onResult;
    this.onStateChange = onStateChange ?? null;
    this.isListening = true;
    this.setupListeners();
    this.onStateChange?.(true, '');

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'de-DE',
        interimResults: true,
        maxAlternatives: 3,
        contextualStrings: [
          'erste Linie', 'zweite Linie', 'dritte Linie', 'vierte Linie', 'fünfte Linie',
          'erster Zwischenraum', 'zweiter Zwischenraum', 'dritter Zwischenraum',
          'vierter Zwischenraum', 'erste Hilfslinie oben', 'erste Hilfslinie unten',
          'über der fünften Linie', 'unter der ersten Linie',
        ],
      });
    } catch {
      // Already started
    }
  }

  private startRecognition() {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'de-DE',
        interimResults: true,
        maxAlternatives: 3,
      });
    } catch {
      // Already started — Aufrufer behandelt Retry
    }
  }

  private setupListeners() {
    this.teardownListeners();

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        // Alle Alternativen anzeigen (wie das Original)
        if (this.onStateChange) {
          const allAlts = event.results.map((r) => r.transcript.toLowerCase().trim());
          this.onStateChange(true, allAlts.join(' | '));
        }

        for (const result of event.results) {
          const transcript = result.transcript.toLowerCase().trim();
          const parseResult = parseSpeechPosition(transcript);

          if (parseResult.position && this.onResult) {
            this.onResult({
              position: parseResult.position,
              ledgerDirectionOmitted: parseResult.ledgerDirectionOmitted,
              transcript,
              confidence: result.confidence,
            });
            return;
          }
        }
      }),
    );

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        if (__DEV__) {
          console.log('[Speech] error:', event.error, event.message);
        }
        if (event.error === 'not-allowed') {
          this.isListening = false;
          this.onStateChange?.(false, '');
        }
        // „no-speech", „aborted" etc. — end-Event startet neu
      }),
    );

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('end', () => {
        // Auto-Restart wie das Web-Original (onend → 100ms → restart)
        if (this.isListening) {
          this.restartTimer = setTimeout(() => {
            if (this.isListening) {
              this.startRecognition();
            }
          }, 100);
        }
      }),
    );
  }

  /** Stoppt das kontinuierliche Zuhören komplett. */
  stopContinuous(): void {
    this.isListening = false;
    this.onResult = null;
    this.onStateChange = null;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.teardownListeners();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // Already stopped
    }
  }

  /** Pausiert temporär (während Feedback). isListening bleibt true. */
  pause(): void {
    this.onResult = null;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const wasListening = this.isListening;
    this.isListening = false;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* already stopped */
    }
    this.isListening = wasListening;
  }

  /** Setzt Zuhören nach pause() fort. */
  resume(onResult: (result: SpeechResult) => void): void {
    this.onResult = onResult;
    if (this.isListening) {
      this.setupListeners();
      this.startRecognition();
    }
  }

  private teardownListeners() {
    for (const sub of this.subscriptions) {
      try {
        sub.remove();
      } catch {
        /* already removed */
      }
    }
    this.subscriptions = [];
  }
}

// Singleton-Instanz (wie getSpeechInput im Original)
let speechInputInstance: SpeechInputService | null = null;

export function getSpeechInput(): SpeechInputService {
  if (!speechInputInstance) {
    speechInputInstance = new SpeechInputService();
  }
  return speechInputInstance;
}
