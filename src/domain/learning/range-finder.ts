/**
 * RangeFinder – Adaptiver Test zur Bestimmung des Tonumfangs (framework-neutral).
 *
 * 1:1 Portierung aus notenlern-app (RangeFinder.ts), ohne Svelte-Store.
 * Stattdessen: reine Klasse mit getState() für manuelles Polling oder Wrapper.
 *
 * Algorithmus:
 * 1. Seed: A3–E4 (5 Noten)
 * 2. Noten zufällig testen, 1× richtig = passed, 2× falsch = failed
 * 3. Wenn alle im Pool passed/failed → expandiere um 3 Noten (oben/unten)
 * 4. Test endet wenn keine Expansion mehr möglich
 * 5. Timer pro Note (Default 4s), Timeout = falsch
 * 6. Clef: unter C4 = Bass, ab C4 = Treble
 */

import { type Range, createRange } from "../music/range";
import { type Clef } from "../music/staff-position";

const DEFAULT_TIME_LIMIT_MS = 4000;
const EXPANSION_SIZE = 3;

const SEED_MIN_MIDI = 57; // A3
const SEED_MAX_MIDI = 64; // E4

const ABSOLUTE_MIN_MIDI = 33; // A1
const ABSOLUTE_MAX_MIDI = 88; // E6

const CLEF_BOUNDARY_MIDI = 60; // C4

function getNaturalMidiInRange(minMidi: number, maxMidi: number): number[] {
  const naturals: number[] = [];
  const offsets = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  for (let octave = 0; octave <= 8; octave += 1) {
    for (const offset of offsets) {
      const midi = octave * 12 + 12 + offset;
      if (midi >= minMidi && midi <= maxMidi) {
        naturals.push(midi);
      }
    }
  }
  return naturals;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getClefForNote(midi: number): Clef {
  return midi < CLEF_BOUNDARY_MIDI ? "bass" : "treble";
}

export interface NoteTestResult {
  midi: number;
  clef: Clef;
  passed: boolean;
  failCount: number;
}

export interface RangeFinderState {
  isActive: boolean;
  currentNoteMidi: number | null;
  currentClef: Clef;
  timeRemaining: number;
  foundRange: Range;
  testedNotes: NoteTestResult[];
  isComplete: boolean;
  notesTestedCount: number;
  notesPassedCount: number;
}

export class RangeFinder {
  private allNaturals: number[];
  private currentPool: Set<number> = new Set();
  private passedNotes: Set<number> = new Set();
  private failedNotes: Set<number> = new Set();
  private failCounts: Map<number, number> = new Map();
  private testQueue: number[] = [];
  private currentMidi: number | null = null;

  private poolLowerMidi = SEED_MIN_MIDI;
  private poolUpperMidi = SEED_MAX_MIDI;
  private confirmedLower = SEED_MIN_MIDI;
  private confirmedUpper = SEED_MAX_MIDI;

  private complete = false;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private timerStart = 0;
  private timeLimitMs: number;
  private onTimeoutCallback: (() => void) | null = null;

  constructor(timeLimitMs: number = DEFAULT_TIME_LIMIT_MS) {
    this.timeLimitMs = timeLimitMs;
    this.allNaturals = getNaturalMidiInRange(
      ABSOLUTE_MIN_MIDI,
      ABSOLUTE_MAX_MIDI,
    );
  }

  onTimeout(callback: () => void): void {
    this.onTimeoutCallback = callback;
  }

  getTimeRemaining(): number {
    if (this.timerStart === 0) return this.timeLimitMs;
    const elapsed = Date.now() - this.timerStart;
    return Math.max(0, this.timeLimitMs - elapsed);
  }

  getFoundRange(): Range {
    return createRange(this.confirmedLower, this.confirmedUpper);
  }

  getState(): RangeFinderState {
    const testedNotes: NoteTestResult[] = [];
    for (const midi of this.currentPool) {
      const passed = this.passedNotes.has(midi);
      const failed = this.failedNotes.has(midi);
      const failCount = this.failCounts.get(midi) || 0;
      if (passed || failed || failCount > 0) {
        testedNotes.push({
          midi,
          clef: getClefForNote(midi),
          passed,
          failCount,
        });
      }
    }

    return {
      isActive: !this.complete,
      currentNoteMidi: this.currentMidi,
      currentClef:
        this.currentMidi !== null ? getClefForNote(this.currentMidi) : "treble",
      timeRemaining: this.getTimeRemaining(),
      foundRange: this.getFoundRange(),
      testedNotes,
      isComplete: this.complete,
      notesTestedCount: this.passedNotes.size + this.failedNotes.size,
      notesPassedCount: this.passedNotes.size,
    };
  }

  start(): void {
    this.passedNotes.clear();
    this.failedNotes.clear();
    this.failCounts.clear();
    this.currentPool.clear();
    this.complete = false;
    this.poolLowerMidi = SEED_MIN_MIDI;
    this.poolUpperMidi = SEED_MAX_MIDI;
    this.confirmedLower = SEED_MIN_MIDI;
    this.confirmedUpper = SEED_MAX_MIDI;

    const seedNotes = getNaturalMidiInRange(SEED_MIN_MIDI, SEED_MAX_MIDI);
    for (const midi of seedNotes) {
      this.currentPool.add(midi);
    }

    this.fillQueue();
    this.nextNote();
  }

  private fillQueue(): void {
    const testable = [...this.currentPool].filter(
      (m) => !this.passedNotes.has(m) && !this.failedNotes.has(m),
    );
    this.testQueue = shuffle(testable);
  }

  private getTestableNotes(): number[] {
    return [...this.currentPool].filter(
      (m) => !this.passedNotes.has(m) && !this.failedNotes.has(m),
    );
  }

  private nextNote(): void {
    this.stopTimer();

    if (this.testQueue.length === 0) {
      const testable = this.getTestableNotes();

      if (testable.length === 0) {
        const canExpandUp = this.passedNotes.has(this.poolUpperMidi);
        const canExpandDown = this.passedNotes.has(this.poolLowerMidi);

        if (!canExpandUp && !canExpandDown) {
          this.complete = true;
          this.currentMidi = null;
          return;
        }

        const expanded = this.expandPool(canExpandUp, canExpandDown);
        if (!expanded) {
          this.complete = true;
          this.currentMidi = null;
          return;
        }
        this.fillQueue();
      } else {
        this.testQueue = shuffle(testable);
      }
    }

    if (this.testQueue.length > 0) {
      this.currentMidi = this.testQueue.shift()!;
      this.startTimer();
    } else {
      this.complete = true;
      this.currentMidi = null;
    }
  }

  private expandPool(allowUp: boolean, allowDown: boolean): boolean {
    let expanded = false;

    if (allowUp) {
      const aboveNotes = this.allNaturals.filter(
        (m) => m > this.poolUpperMidi && m <= ABSOLUTE_MAX_MIDI,
      );
      const newAbove = aboveNotes.slice(0, EXPANSION_SIZE);

      for (const midi of newAbove) {
        this.currentPool.add(midi);
        expanded = true;
      }

      if (newAbove.length > 0) {
        this.poolUpperMidi = Math.max(...newAbove);
      }
    }

    if (allowDown) {
      const belowNotes = this.allNaturals
        .filter((m) => m < this.poolLowerMidi && m >= ABSOLUTE_MIN_MIDI)
        .reverse();
      const newBelow = belowNotes.slice(0, EXPANSION_SIZE);

      for (const midi of newBelow) {
        this.currentPool.add(midi);
        expanded = true;
      }

      if (newBelow.length > 0) {
        this.poolLowerMidi = Math.min(...newBelow);
      }
    }

    return expanded;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerStart = Date.now();

    this.timerHandle = setInterval(() => {
      if (this.getTimeRemaining() <= 0) {
        this.handleTimeout();
      }
    }, 50);
  }

  private stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.timerStart = 0;
  }

  private handleTimeout(): void {
    this.stopTimer();
    this.onTimeoutCallback?.();
    setTimeout(() => this.recordFailure(), 600);
  }

  submitAnswer(correct: boolean): void {
    this.stopTimer();
    if (this.currentMidi === null) return;

    if (correct) {
      this.passedNotes.add(this.currentMidi);
      if (this.currentMidi < this.confirmedLower)
        this.confirmedLower = this.currentMidi;
      if (this.currentMidi > this.confirmedUpper)
        this.confirmedUpper = this.currentMidi;
      this.nextNote();
    } else {
      this.recordFailure();
    }
  }

  private recordFailure(): void {
    if (this.currentMidi === null) return;

    const currentFails = (this.failCounts.get(this.currentMidi) || 0) + 1;
    this.failCounts.set(this.currentMidi, currentFails);

    if (currentFails >= 2) {
      this.failedNotes.add(this.currentMidi);
    }

    this.nextNote();
  }

  destroy(): void {
    this.stopTimer();
  }

  setTimeLimit(ms: number): void {
    this.timeLimitMs = ms;
  }

  static get DEFAULT_TIME_LIMIT_MS(): number {
    return DEFAULT_TIME_LIMIT_MS;
  }
}
