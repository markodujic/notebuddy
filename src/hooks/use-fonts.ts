/**
 * useFonts – Lädt alle Custom-Fonts (Bravura etc.).
 *
 * Muss im Root-Layout aufgerufen werden, bevor Notations-UI gerendert wird.
 */

import {
    useFonts,
} from 'expo-font';

import { BRAVURA_FONT_FAMILY, BRAVURA_FONT_SOURCE } from '@/constants/music-font';

/**
 * Hook: Lädt alle App-Fonts.
 *
 * @returns `[isLoaded, error]` – isLoaded wird true, wenn alle Fonts geladen sind.
 */
export function useAppFonts(): [boolean, Error | null] {
  const [loaded, error] = useFonts({
    [BRAVURA_FONT_FAMILY]: BRAVURA_FONT_SOURCE,
  });

  return [loaded, error];
}