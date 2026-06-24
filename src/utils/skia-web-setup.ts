/**
 * Skia Web Setup Module
 * Uses the built-in @shopify/react-native-skia web loading mechanism
 */

let isSkiaWebInitialized = false;

/**
 * Initialize Skia Web using the library's built-in LoadSkiaWeb
 * This must be called and awaited BEFORE any Skia components render
 */
export async function initializeSkiaWeb(): Promise<void> {
  if (isSkiaWebInitialized) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Use the built-in Skia web loader from the library
    const { LoadSkiaWeb } = await import(
      // @ts-ignore - web-specific import path
      '@shopify/react-native-skia/lib/module/web'
    );
    await LoadSkiaWeb();
    isSkiaWebInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Skia Web:', error);
  }
}

export function isSkiaWebReady(): boolean {
  return isSkiaWebInitialized;
}
