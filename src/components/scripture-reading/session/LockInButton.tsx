/**
 * LockInButton — Presentational component for lock-in / waiting / undo
 *
 * Story 4.2: AC #3, #4
 *
 * States:
 *   - Unlocked: "Ready for next verse" primary button
 *   - Locked: "Waiting for [partnerName]..." + "Tap to undo" link
 *   - Partner locked (indicator): "[PartnerName] is ready" green check
 *   - Pending: loading state (disabled)
 */

interface LockInButtonProps {
  isLocked: boolean;
  isPending: boolean;
  partnerLocked: boolean;
  partnerName: string;
  onLockIn: () => void;
  onUndoLockIn: () => void;
  isPartnerDisconnected?: boolean;
}

import { FOCUS_RING } from '../constants';

export function LockInButton({
  isLocked,
  isPending,
  partnerLocked,
  partnerName,
  onLockIn,
  onUndoLockIn,
  isPartnerDisconnected = false,
}: LockInButtonProps) {
  // Story 4.3: Disconnected + unlocked → show "Holding your place" disabled button
  if (isPartnerDisconnected && !isLocked) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          disabled
          className="pointer-events-none min-h-[48px] w-full rounded-2xl border-2 border-purple-300 bg-purple-50 px-6 py-3 text-base font-semibold text-purple-400 opacity-50"
          data-testid="lock-in-disconnected"
          aria-label="Holding your place while partner reconnects"
        >
          Holding your place
        </button>
        <p className="text-sm text-purple-400">Reconnecting...</p>
      </div>
    );
  }

  // Story 4.3: Disconnected + locked → show waiting with reconnecting note, undo still available
  if (isPartnerDisconnected && isLocked) {
    return (
      <div className="flex w-full flex-col items-center gap-1">
        <button
          type="button"
          disabled
          className={`min-h-[48px] w-full rounded-2xl border-2 border-purple-400 bg-purple-100 px-6 py-3 text-base font-semibold text-purple-700 ${isPending ? 'opacity-50' : ''}`}
          data-testid="lock-in-button"
          aria-label={`Waiting for ${partnerName} to be ready`}
        >
          Waiting for {partnerName}...
        </button>
        <p className="text-sm text-purple-400">Reconnecting...</p>
        <button
          type="button"
          onClick={onUndoLockIn}
          disabled={isPending}
          className={`min-h-[48px] rounded-lg px-3 py-2 text-sm text-purple-500 transition-colors hover:text-purple-700 disabled:opacity-50 ${FOCUS_RING}`}
          data-testid="lock-in-undo"
          aria-label="Undo ready status"
        >
          Tap to undo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Partner locked indicator — shown when partner is ready but user hasn't locked */}
      {partnerLocked && !isLocked && (
        <div
          className="flex items-center gap-1.5 text-sm font-medium text-green-600"
          data-testid="partner-locked-indicator"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{partnerName} is ready</span>
        </div>
      )}

      {/* Main button */}
      {!isLocked ? (
        <button
          type="button"
          onClick={onLockIn}
          disabled={isPending}
          className={`min-h-[48px] w-full rounded-2xl bg-purple-600 px-6 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-purple-700 active:bg-purple-800 disabled:pointer-events-none disabled:opacity-50 ${FOCUS_RING}`}
          data-testid="lock-in-button"
          aria-label="Ready for next verse"
        >
          Ready for next verse
        </button>
      ) : (
        <div className="flex w-full flex-col items-center gap-1">
          <button
            type="button"
            disabled
            className={`min-h-[48px] w-full rounded-2xl border-2 border-purple-400 bg-purple-100 px-6 py-3 text-base font-semibold text-purple-700 ${isPending ? 'opacity-50' : ''}`}
            data-testid="lock-in-button"
            aria-label={`Waiting for ${partnerName} to be ready`}
          >
            Waiting for {partnerName}...
          </button>
          <button
            type="button"
            onClick={onUndoLockIn}
            disabled={isPending}
            className={`min-h-[48px] rounded-lg px-3 py-2 text-sm text-purple-500 transition-colors hover:text-purple-700 disabled:opacity-50 ${FOCUS_RING}`}
            data-testid="lock-in-undo"
            aria-label="Undo ready status"
          >
            Tap to undo
          </button>
        </div>
      )}
    </div>
  );
}
