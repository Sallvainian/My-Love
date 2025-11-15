import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// PWA auto-update: Register service worker with aggressive update strategy
import { registerSW } from 'virtual:pwa-register';

// Cleanup stale service workers from other ports/builds
// This prevents conflicts between dev (5173) and production (4173) service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    const currentOrigin = window.location.origin;
    registrations.forEach((registration) => {
      // Unregister service workers from different origins/ports
      if (registration.scope && !registration.scope.startsWith(currentOrigin)) {
        if (import.meta.env.DEV) {
          console.log('[SW] Unregistering stale service worker:', registration.scope);
        }
        registration.unregister();
      }
    });
  });
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-reload when new service worker is available
    // This ensures users always get the latest code
    if (import.meta.env.DEV) {
      console.log('[SW] New version available, reloading...');
    }
    updateSW(true); // true = reload after update
  },
  onOfflineReady() {
    if (import.meta.env.DEV) {
      console.log('[SW] App ready to work offline');
    }
  },
  onRegisterError(error) {
    console.error('[SW] Registration error:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
