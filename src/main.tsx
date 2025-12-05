import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import './index.css';
import App from './App.tsx';

// PWA auto-update: Register service worker with aggressive update strategy
// Only register in production to prevent stale code issues in development
if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Auto-reload when new service worker is available
        // This ensures users always get the latest code
        console.log('[SW] New version available, reloading...');
        updateSW(true); // true = reload after update
      },
      onOfflineReady() {
        console.log('[SW] App ready to work offline');
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
      console.log('[Dev] Unregistering service worker:', registration.scope);
      registration.unregister();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <App />
    </LazyMotion>
  </StrictMode>
);
