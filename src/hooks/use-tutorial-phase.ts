/**
 * useTutorialPhase – State-Machine für das Tutorial (Phase 4.3).
 *
 * 4 Phasen:
 *   1. Animation: 2er/3er-Gruppen passiv anzeigen
 *   2. Mic: 2er-Gruppen nachspielen
 *   3. Mic: 3er-Gruppen nachspielen
 *   4. Mic: Alle 88 Tasten spielen
 *
 * Nutzt useAudioEngine für Pitch-Detection (Phasen 2–4).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
    ANIMATION_GROUPS,
    ANIMATION_INTERVAL_MS,
    DREIER_GRUPPEN,
    FULL_KEYBOARD_KEY_COUNT,
    MIN_CLARITY,
    MIN_RMS,
    NOTE_TOLERANCE,
    REQUIRED_STABLE_FRAMES,
    ZWEIER_GRUPPEN,
} from "@/domain";
import { useAudioEngine } from "@/services/audio-engine";
import { usePitchSharedValues } from "@/services/pitch-shared-values";
import { type PitchFrame } from "@/services/pitch-utils";

export type TutorialPhase = 1 | 2 | 3 | 4;

export function useTutorialPhase() {
  const values = usePitchSharedValues();

  const [phase, setPhase] = useState<TutorialPhase>(1);
  const [greenKeys, setGreenKeys] = useState<number[]>([]);
  const [animationStep, setAnimationStep] = useState(-1);
  const [phase1Complete, setPhase1Complete] = useState(false);
  const [completedGroups, setCompletedGroups] = useState<Set<number>>(
    new Set(),
  );
  const [playedGroupNotes, setPlayedGroupNotes] = useState<Set<string>>(
    new Set(),
  );
  const [playedKeys, setPlayedKeys] = useState<Set<number>>(new Set());
  const [chapterComplete, setChapterComplete] = useState(false);

  const stableMidiRef = useRef(-1);
  const stableCountRef = useRef(0);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const handleAudioFrame = useCallback(
    (frame: PitchFrame) => {
      if (frame.frequency === 0) return;
      if (frame.clarity < MIN_CLARITY || frame.rms < MIN_RMS) return;

      const midi = Math.round(12 * Math.log2(frame.frequency / 440) + 69);
      if (midi < 21 || midi > 108) return;

      if (midi === stableMidiRef.current) {
        stableCountRef.current += 1;
      } else {
        stableMidiRef.current = midi;
        stableCountRef.current = 1;
      }
      if (stableCountRef.current < REQUIRED_STABLE_FRAMES) return;

      const currentPhase = phaseRef.current;

      if (currentPhase === 2 || currentPhase === 3) {
        const groups = currentPhase === 2 ? ZWEIER_GRUPPEN : DREIER_GRUPPEN;

        for (let gi = 0; gi < groups.length; gi += 1) {
          if (completedGroups.has(gi)) continue;
          const group = groups[gi];

          for (const targetMidi of group) {
            const key = `${gi}-${targetMidi}`;
            if (playedGroupNotes.has(key)) continue;

            if (Math.abs(midi - targetMidi) <= NOTE_TOLERANCE) {
              const newPlayed = new Set(playedGroupNotes);
              newPlayed.add(key);
              setPlayedGroupNotes(newPlayed);
              setGreenKeys((prev) => [...prev, targetMidi]);

              const allDone = group.every((m) => newPlayed.has(`${gi}-${m}`));
              if (allDone) {
                const newCompleted = new Set(completedGroups);
                newCompleted.add(gi);
                setCompletedGroups(newCompleted);

                if (newCompleted.size >= groups.length) {
                  if (currentPhase === 2) {
                    setPhase(3);
                    setGreenKeys([]);
                    setCompletedGroups(new Set());
                    setPlayedGroupNotes(new Set());
                  } else {
                    setPhase(4);
                    setGreenKeys([]);
                    setPlayedKeys(new Set());
                  }
                }
              }

              stableMidiRef.current = -1;
              stableCountRef.current = 0;
              return;
            }
          }
        }
      }

      if (currentPhase === 4 && !chapterComplete) {
        if (playedKeys.has(midi)) return;

        const newPlayed = new Set(playedKeys);
        newPlayed.add(midi);
        setPlayedKeys(newPlayed);
        setGreenKeys((prev) => [...prev, midi]);

        stableMidiRef.current = -1;
        stableCountRef.current = 0;

        if (newPlayed.size >= FULL_KEYBOARD_KEY_COUNT) {
          setChapterComplete(true);
        }
      }
    },
    [completedGroups, playedGroupNotes, playedKeys, chapterComplete],
  );

  const audio = useAudioEngine(values, handleAudioFrame);

  useEffect(() => {
    if (phase !== 1 || phase1Complete) return;

    const timer = setInterval(() => {
      setAnimationStep((prev) => {
        const next = prev + 1;
        if (next < ANIMATION_GROUPS.length) {
          setGreenKeys((prevKeys) => [...prevKeys, ...ANIMATION_GROUPS[next]]);
          return next;
        } else {
          clearInterval(timer);
          setPhase1Complete(true);
          return prev;
        }
      });
    }, ANIMATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [phase, phase1Complete]);

  const advanceToPhase2 = useCallback(() => {
    setPhase(2);
    setGreenKeys([]);
    setCompletedGroups(new Set());
    setPlayedGroupNotes(new Set());
    stableMidiRef.current = -1;
    stableCountRef.current = 0;
    audio.startListening();
  }, [audio]);

  const advanceToPhase3 = useCallback(() => {
    setPhase(3);
    setGreenKeys([]);
    setCompletedGroups(new Set());
    setPlayedGroupNotes(new Set());
    stableMidiRef.current = -1;
    stableCountRef.current = 0;
  }, []);

  const advanceToPhase4 = useCallback(() => {
    setPhase(4);
    setGreenKeys([]);
    setPlayedKeys(new Set());
    setChapterComplete(false);
    stableMidiRef.current = -1;
    stableCountRef.current = 0;
  }, []);

  const restartAnimation = useCallback(() => {
    setAnimationStep(-1);
    setGreenKeys([]);
    setPhase1Complete(false);
  }, []);

  const completeChapter = useCallback(() => {
    setChapterComplete(true);
    audio.stopListening();
  }, [audio]);

  useEffect(() => {
    return () => {
      audio.stopListening();
    };
  }, [audio]);

  return {
    phase,
    greenKeys,
    animationStep,
    phase1Complete,
    chapterComplete,
    completedGroups,
    playedKeys,
    advanceToPhase2,
    advanceToPhase3,
    advanceToPhase4,
    restartAnimation,
    completeChapter,
  };
}
