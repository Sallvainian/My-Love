/**
 * PartnerLoadError -- the card shown when the partner could not be determined
 * (the read failed or the device is offline, and no copy is saved).
 *
 * Shared by the Partner view and the Settings Partner page, which show the same
 * wording. Takes props rather than reading the store, so the Partner view's
 * tests, which mock the store wholesale, keep working.
 *
 * @component
 */

import { RefreshCw, WifiOff } from 'lucide-react';

/** Kit card surface and small pill button (design-tokens.md). */
const CARD = 'rounded-[20px] border border-line bg-card shadow-card';
const PILL =
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2';

interface PartnerLoadErrorProps {
  isOnline: boolean;
  /** Asks again; offered only while online. */
  onRetry: () => void;
}

export function PartnerLoadError({ isOnline, onRetry }: PartnerLoadErrorProps) {
  return (
    <div
      className={`${CARD} flex flex-col items-center gap-3 px-5 py-8 text-center`}
      data-testid="partner-load-error"
    >
      <WifiOff className="h-8 w-8 text-muted" aria-hidden="true" />
      <p className="text-[15px] font-semibold text-ink">Couldn't load your partner</p>
      <p className="text-sm text-muted">
        {isOnline
          ? 'Something went wrong. Please try again.'
          : "You're offline. Connect to load your partner."}
      </p>
      {isOnline && (
        <button
          type="button"
          onClick={onRetry}
          className={`${PILL} bg-fill text-white focus-visible:ring-accent`}
          data-testid="partner-load-retry"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}
