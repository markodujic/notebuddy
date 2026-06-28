/**
 * useOrientationLock – Hook für Orientierungs-Locks.
 *
 * Erlaubt es, die Bildschirmorientierung für bestimmte Modi zu erzwingen
 * (z.B. Landscape für "Klavier → Note").
 */

import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';

/** Art des Locks. */
export type OrientationLockType = 'portrait' | 'landscape' | 'all';

const LOCK_MAP: Record<OrientationLockType, ScreenOrientation.OrientationLock> = {
  portrait: ScreenOrientation.OrientationLock.PORTRAIT_UP,
  landscape: ScreenOrientation.OrientationLock.LANDSCAPE,
  all: ScreenOrientation.OrientationLock.ALL,
};

/**
 * Hook: Erzwingt eine Orientierung während der Screen gemountet ist.
 *
 * Beim Unmount wird der Lock aufgehoben (ALL).
 *
 * @param lock 'portrait' | 'landscape' | 'all'
 */
export function useOrientationLock(lock: OrientationLockType = 'all'): void {
  useEffect(() => {
    let active = true;

    async function applyLock() {
      try {
        await ScreenOrientation.lockAsync(LOCK_MAP[lock]);
      } catch {
        // Lock kann fehlschlagen (z.B. Web, bestimmte Geräte) – nicht kritisch
      }
    }

    async function releaseLock() {
      try {
        await ScreenOrientation.unlockAsync();
      } catch {
        // Ignorieren
      }
    }

    applyLock();

    return () => {
      active = false;
      if (!active) return;
      releaseLock();
    };
  }, [lock]);
}