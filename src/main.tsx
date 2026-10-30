import { LazyMotion, domAnimation } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { Capacitor } from '@capacitor/core';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import './index.css';
import { startNativeUpdates } from './services/nativeUpdates';
import { logger } from './utils/logger';

// The native shell updates through nativeUpdates.ts instead: service workers
// do not run on its capacitor:// origin, and its files ship inside the app.
if (Capacitor.isNativePlatform()) {
  void startNativeUpdates();
} else if (import.meta.env.PROD) {
  // PWA auto-update: Register service worker with aggressive update strategy
  // Only register in production to prevent stale code issues in development
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Auto-reload when new service worker is available
        // This ensures users always get the latest code
        logger.info('[SW] New version available, reloading...');
        updateSW(true); // true = reload after update
      },
      onOfflineReady() {
        logger.info('[SW] App ready to work offline');
      },
      onRegisterError(error) {
        console.error('[SW] Registration error:', error);
      },
    });
  });
} else if ('serviceWorker' in navigator) {
  // In development: Unregister ALL service workers to prevent stale code
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      logger.debug('[Dev] Unregistering service worker:', registration.scope);
      registration.unregister();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LazyMotion>
  </StrictMode>
);
