/**
 * "Do you want to nudge your partner?" — the bottom sheet offered once, right
 * after the first picker's Send my pick (R2).
 *
 * `DailyQuestion` decides when it shows (see its header) and passes `canNudge`
 * from the shown snapshot's `nudge` (a slot, not spent). Nudge calls the
 * store's `sendDailyNudge` itself: a success calls `onClose` (the waiting
 * card's button then greys from `nudge.spent`); the offline sentence or
 * `NUDGE_FAILED_MESSAGE` shows in the failure box with the sheet kept open (the
 * slice re-reads the day after a refusal). "Not now", a tap on the scrim and
 * Escape only call `onClose`; nothing is sent. Both buttons are disabled while
 * a send is in flight.
 *
 * It opens and closes at once, with no animation (the iOS back swipe pictures
 * whatever is still fading out, and Reduce Motion). The scrim and panel are the
 * write sheet's (`SHEET_SCRIM`, `SHEET_PANEL`) and clear all four
 * `env(safe-area-inset-*)`. Focus starts on the panel.
 *
 * @component
 */

import { Bell } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAppStore } from '../../stores/useAppStore';
import {
  FAILURE_BOX,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SHEET_PANEL,
  SHEET_SCRIM,
} from '../shared/kitClasses';
import { nudgeFailureMessage } from './nudgeFailureMessage';

interface NudgeSheetProps {
  /** The shown snapshot's nudge has a slot and is not spent. */
  canNudge: boolean;
  /** Not now, scrim, Escape, and after a nudge was sent. */
  onClose: () => void;
}

export function NudgeSheet({ canNudge, onClose }: NudgeSheetProps) {
  const sendDailyNudge = useAppStore((state) => state.sendDailyNudge);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // The focus trap re-arms (and moves focus) on a new Escape handler, so it
  // gets a stable one that calls the latest `onClose`.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => onCloseRef.current(), []);
  useFocusTrap(panelRef, true, { onEscape: close, initialFocusRef: panelRef });

  const nudge = async () => {
    setError(null);
    setSending(true);
    try {
      await sendDailyNudge();
      onCloseRef.current();
    } catch (caught) {
      setError(nudgeFailureMessage(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={SHEET_SCRIM}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      data-testid="daily-nudge-sheet"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={SHEET_PANEL}
        onClick={(e) => e.stopPropagation()}
        data-testid="daily-nudge-panel"
      >
        <h2 id={titleId} className="font-serif text-[24px] leading-[1.15] font-semibold text-ink">
          Do you want to nudge your partner?
        </h2>

        {error && (
          <div className={FAILURE_BOX} role="alert" data-testid="daily-nudge-sheet-error">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={sending || !canNudge}
              onClick={() => void nudge()}
              data-testid="daily-nudge-sheet-send"
            >
              <Bell size={18} aria-hidden="true" />
              Nudge
            </button>
          </div>
          <div className="flex">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={sending}
              onClick={close}
              data-testid="daily-nudge-sheet-dismiss"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
