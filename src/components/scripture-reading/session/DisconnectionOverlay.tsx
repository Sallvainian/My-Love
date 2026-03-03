/**
 * DisconnectionOverlay — Two-phase overlay for partner disconnection
 *
 * Story 4.3: AC #1, #2, #3
 *
 * Phase A (< 30s): "Partner reconnecting..." with pulse animation
 * Phase B (>= 30s): "Your partner seems to have stepped away" with Keep Waiting / End Session
 *
 * Elapsed time derived from `Date.now() - disconnectedAt` via setInterval(1000).
 * No blame or alarm language in visible text.
 */

import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import { WifiOff } from 'lucide-react';

const TIMEOUT_MS = 30_000;

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

interface DisconnectionOverlayProps {
  partnerName: string;
  disconnectedAt: number;
  onKeepWaiting: () => void;
  onEndSession: () => void;
  isEnding?: boolean;
}

export function DisconnectionOverlay({
  partnerName,
  disconnectedAt,
  onKeepWaiting,
  onEndSession,
  isEnding = false,
}: DisconnectionOverlayProps): ReactElement {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - disconnectedAt));
  const [isConfirmingEndSession, setIsConfirmingEndSession] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: re-derive elapsed from Date.now() when disconnectedAt prop changes
    setElapsed(Math.max(0, Date.now() - disconnectedAt));
    setIsConfirmingEndSession(false);
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Date.now() - disconnectedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [disconnectedAt]);

  // Save previous focus and auto-focus first button when interactive content appears
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Focus first button when timeout or confirmation phase starts
  useEffect(() => {
    if (elapsed >= TIMEOUT_MS) {
      const firstButton = dialogRef.current?.querySelector('button');
      firstButton?.focus();
    }
  }, [elapsed >= TIMEOUT_MS, isConfirmingEndSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus trap: keep Tab cycling within the dialog
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isConfirmingEndSession) {
          setIsConfirmingEndSession(false);
        } else if (elapsed >= TIMEOUT_MS) {
          onKeepWaiting();
        }
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements || focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [isConfirmingEndSession, elapsed, onKeepWaiting]
  );

  const isTimeout = elapsed >= TIMEOUT_MS;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${partnerName} disconnected`}
      data-testid="disconnection-overlay"
      onKeyDown={handleKeyDown}
      ref={dialogRef}
    >
      {/* Accessible announcement */}
      <div role="status" aria-live="polite" className="sr-only">
        {partnerName} seems to have disconnected
      </div>

      <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        {!isTimeout ? (
          <div data-testid="disconnection-reconnecting" className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <WifiOff className="h-6 w-6 text-purple-600" aria-hidden="true" />
            </div>
            <p className="animate-pulse text-base font-medium text-purple-700 motion-reduce:animate-none">
              Partner reconnecting...
            </p>
          </div>
        ) : isConfirmingEndSession ? (
          <div data-testid="disconnection-confirmation" className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <WifiOff className="h-6 w-6 text-purple-600" aria-hidden="true" />
            </div>
            <p className="mb-2 text-base font-medium text-gray-700">
              End this session for both of you?
            </p>
            <p className="mb-6 text-sm text-gray-500">
              Your progress so far will be saved before ending.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onEndSession}
                disabled={isEnding}
                className={`min-h-[48px] w-full rounded-2xl bg-purple-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
                data-testid="disconnection-confirm-end-session"
              >
                {isEnding ? 'Ending...' : 'Yes, End Session'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingEndSession(false)}
                className={`min-h-[48px] w-full rounded-2xl border border-purple-300 px-6 py-3 text-base font-semibold text-purple-700 transition-all hover:bg-purple-50 active:bg-purple-100 ${FOCUS_RING}`}
                data-testid="disconnection-cancel-end-session"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div data-testid="disconnection-timeout" className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <WifiOff className="h-6 w-6 text-purple-600" aria-hidden="true" />
            </div>
            <p className="mb-6 text-base font-medium text-gray-700">
              Your partner seems to have stepped away
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmingEndSession(true)}
                disabled={isEnding}
                className={`min-h-[48px] w-full rounded-2xl bg-purple-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
                data-testid="disconnection-end-session"
              >
                End Session
              </button>
              <button
                type="button"
                onClick={onKeepWaiting}
                className={`min-h-[48px] w-full rounded-2xl border border-purple-300 px-6 py-3 text-base font-semibold text-purple-700 transition-all hover:bg-purple-50 active:bg-purple-100 ${FOCUS_RING}`}
                data-testid="disconnection-keep-waiting"
              >
                Keep Waiting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
