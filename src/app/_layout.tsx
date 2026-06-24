import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initializeSkiaWeb } from '@/utils/skia-web-setup';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      initializeSkiaWeb()
        .then(() => setSkiaReady(true))
        .catch(() => setSkiaReady(true)); // render anyway on failure
    }
  }, []);

  if (!skiaReady) {
    return null; // don't render until CanvasKit is loaded on web
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
