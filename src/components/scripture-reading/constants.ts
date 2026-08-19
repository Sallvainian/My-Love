/** Lavender Dreams design tokens shared across scripture-reading components. */
export const scriptureTheme = {
  primary: '#A855F7',
  background: '#F3E5F5',
  surface: '#FAF5FF',
};

/** Shared focus-visible ring classes (Story 1.5: AC #1). */
export const FOCUS_RING =
  'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

/**
 * Phase B threshold for DisconnectionOverlay (Story 4.3 AC #2): once the partner
 * has been gone this long, the overlay swaps the "reconnecting" pulse for the
 * Keep Waiting / End Session choice.
 *
 * Exported rather than file-local because tests/support/helpers/scripture-lobby.ts
 * backdates `partnerDisconnectedAt` past it and must not hardcode a second copy.
 * This module deliberately has no imports of its own — that is what makes it safe
 * to pull into the Playwright node process. Do not import DisconnectionOverlay.tsx
 * from a test helper instead: it would drag `lucide-react` into the test runner
 * for the sake of one number.
 */
export const DISCONNECT_TIMEOUT_MS = 30_000;
