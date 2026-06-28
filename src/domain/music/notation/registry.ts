/**
 * Notation-Registry (framework-neutral).
 *
 * Zentrale Anlaufstelle, um ein Notation-System per ID zu erhalten.
 * Neue Systeme können hier einfach registriert werden.
 */

import { englishNotation } from './systems/english';
import { germanNotation } from './systems/german';
import { nordicNotation } from './systems/nordic';
import { solfegeNotation } from './systems/solfege';
import type { NotationSystem, NotationSystemId } from './types';

/** Registry aller Notationssysteme. */
const REGISTRY: Record<NotationSystemId, NotationSystem> = {
  german: germanNotation,
  english: englishNotation,
  solfege: solfegeNotation,
  nordic: nordicNotation,
};

/** Default-Notationssystem (Deutsch). */
export const DEFAULT_NOTATION_ID: NotationSystemId = 'german';

/**
 * Gibt das Notation-System für eine ID zurück.
 * Fällt auf Deutsch zurück, wenn die ID unbekannt ist.
 */
export function getNotation(id: NotationSystemId): NotationSystem {
  return REGISTRY[id] ?? REGISTRY[DEFAULT_NOTATION_ID];
}

/** Gibt das Default-Notationssystem zurück. */
export function getDefaultNotation(): NotationSystem {
  return REGISTRY[DEFAULT_NOTATION_ID];
}

/** Gibt alle verfügbaren Notationssysteme zurück. */
export function getAllNotations(): NotationSystem[] {
  return Object.values(REGISTRY);
}

/** Gibt alle verfügbaren Notationssystem-IDs zurück. */
export function getAllNotationIds(): NotationSystemId[] {
  return Object.keys(REGISTRY) as NotationSystemId[];
}