/**
 * "Do you want to nudge your partner?" — the bottom sheet offered once after an
 * answer (R1): right after Send my pick, after the write sheet that follows it,
 * or when a pick saved offline is sent while Daily is open.
 *
 * `DailyQuestion` decides when it shows and hides it at the question's closing
 * instant (see its header). Nudge sends the prompt's nudge through
 * `useNudgeSend` (the waiting card's button uses the same hook): a send that
 * ends as a sent nudge calls `onClose`; a refusal, a re-read that found no
 * nudge, or a lost answer whose re-read failed shows its line in the failure
 * box with the sheet kept open and Nudge enabled, and the offline sentence
 * shows the same way. "Not now", a tap on the scrim and Escape only call
 * `onClose`; nothing is sent, and the waiting card's button still offers its
 * own nudge. `children` (Daily's line naming the day a written question moved
 * to, DW-498) shows under the question. Both buttons are disabled while a send, and the re-read after a
 * lost answer, is in progress, and the scrim and Escape do nothing then, so a
 * failure line is never closed away unseen.
 *
 * It opens and closes at once, with no animation (the iOS back swipe pictures
 * whatever is still fading out, and Reduce Motion). The scrim and panel are the
 * write sheet's (`SHEET_SCRIM`, `SHEET_PANEL`) and clear all four
 * `env(safe-area-inset-*)`. Focus starts on the panel.
 *
 * @component
 */

import { Bell } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  FAILURE_BOX,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SHEET_PANEL,
  SHEET_SCRIM,
} from '../shared/kitClasses';
import { useNudgeSend } from './useNudgeSend';

interface NudgeSheetProps {
  /** Not now, scrim, Escape, and after a nudge was sent. */
  onClose: () => void;
  /** Shown under the question: Daily's line naming a moved written question's day. */
  children?: ReactNode;
}

export function NudgeSheet({ onClose, children }: NudgeSheetProps) {
  const { send, busy: sending, isBusy, error } = useNudgeSend('prompt');

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // The focus trap re-arms (and moves focus) on a new Escape handler, so it
  // gets a stable one that calls the latest `onClose`. `isBusy` reads a ref, not
  // `sending`, so a send that has begun blocks it before a render shows it.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => {
    if (!isBusy()) onCloseRef.current();
  }, [isBusy]);
  useFocusTrap(panelRef, true, { onEscape: close, initialFocusRef: panelRef });

  const nudge = async () => {
    if (await send()) onCloseRef.current();
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

        {children}

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
              disabled={sending}
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
