import * as Sentry from '@sentry/react';

/** Initialize Sentry error tracking. No-ops when VITE_SENTRY_DSN is absent. */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] Skipped: No VITE_SENTRY_DSN configured');
    return;
  }

  Sentry.init({
    dsn,
    enabled: import.meta.env.PROD,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    environment: import.meta.env.MODE,

    // 20% performance sampling — sufficient for a 2-user app
    tracesSampleRate: 0.2,

    ignoreErrors: [
      // Chunk load failures — handled by ViewErrorBoundary
      /Failed to fetch dynamically imported module/,
      /Loading chunk/,
      /ChunkLoadError/,
      // Offline network errors — expected in offline-first PWA
      /NetworkError/,
      /Failed to fetch/,
      /Load failed/,
      // ResizeObserver noise
      /ResizeObserver loop/,
    ],

    beforeSend(event) {
      // Strip PII — only UUIDs should reach Sentry
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

/** Set Sentry user context after auth. Only sends UUIDs (no PII). */
export function setSentryUser(userId: string, partnerId: string | null): void {
  Sentry.setUser({ id: userId });
  Sentry.setTag('partner_id', partnerId ?? 'none');
}

/** Clear Sentry user context on sign-out. */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}
