/**
 * Theme-Hook – nutzt den Dark-Mode aus dem App-Store (Header-Toggle),
 * exakt wie `toggleDarkMode()` in der alten notenlern-app.
 */

import { Colors } from '@/constants/theme';
import { useAppStore } from '@/stores/app-store';

export function useTheme() {
  const darkMode = useAppStore((s) => s.darkMode);
  return darkMode ? Colors.dark : Colors.light;
}
