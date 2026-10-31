import { Capacitor } from '@capacitor/core';

/**
 * Marks <html> with `data-native` inside the native iOS shell, so index.css
 * can drop what only a web page shows: inside the app no view draws a scroll
 * bar. The website and the Home Screen web app stay unmarked.
 */
export function markNativeShell(root: HTMLElement): void {
  if (Capacitor.isNativePlatform()) root.setAttribute('data-native', '');
}
