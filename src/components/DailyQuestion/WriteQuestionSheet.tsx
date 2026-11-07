/**
 * Write tomorrow's question — the bottom sheet that asks the day's writer for
 * tomorrow's This-or-That (architecture AD-4, AD-13).
 *
 * It says "tomorrow" while the snapshot's `write.target_day` is the day after
 * `day` (or missing, from a snapshot saved before the server sent it). When a
 * partner whose clock is ahead has already opened tomorrow, the question goes to
 * a later date, and the sheet names that date's weekday instead (DW-494).
 *
 * `DailyQuestion` decides when it shows (the writer's own server pick is in, the
 * turn is not done or declined, and the day is today). The sheet holds two
 * fields and a "This or That?" preview, and does not validate: the server judges
 * the options (R4), Send is disabled only while a send is in flight, and a
 * refusal's reason (or the offline sentence) shows in the failure box with the
 * sheet kept open. A successful send ends the prompt through the snapshot's
 * `write.done`; "No thanks, pick one for us" saves the day on this device. A tap
 * on the scrim or Escape only calls `onClose`, which hides it for this mount.
 *
 * It opens and closes at once, with no animation (the iOS back swipe pictures
 * whatever is still fading out, and Reduce Motion). The scrim and panel clear
 * all four `env(safe-area-inset-*)`. Focus starts on the panel, not a field, so
 * the keyboard does not pop up.
 *
 * @component
 */

import { Shuffle } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { parseEventDate } from '../../services/eventsService';
import { useAppStore } from '../../stores/useAppStore';
import {
  FAILURE_BOX,
  FIELD_LABEL,
  FOOTNOTE,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  fieldClass,
} from '../shared/kitClasses';

const SHEET_SCRIM =
  'fixed inset-0 z-50 flex items-end justify-center bg-black/50 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]';
const SHEET_PANEL =
  'flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-hidden';

/**
 * The weekday name (`Thursday`) of `targetDay` when it is not the day after
 * `day`; null for tomorrow, a missing target or a date that does not parse.
 */
function laterWeekday(day: string, targetDay: string | undefined): string | null {
  if (!targetDay) return null;
  const from = parseEventDate(day);
  const target = parseEventDate(targetDay);
  if (!from || !target) return null;
  const tomorrow = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return null;
  return target.toLocaleDateString('en-US', { weekday: 'long' });
}

interface WriteQuestionSheetProps {
  /** The day the sheet writes from (the shown day). */
  dayId: string;
  /** The shown day's `YYYY-MM-DD` date. */
  day: string;
  /** The snapshot's `write.target_day`: the date the question would go to. */
  targetDay?: string;
  partnerName: string;
  /** Scrim or Escape: hide the sheet until the next mount of Daily. */
  onClose: () => void;
}

export function WriteQuestionSheet({
  dayId,
  day,
  targetDay,
  partnerName,
  onClose,
}: WriteQuestionSheetProps) {
  const weekday = laterWeekday(day, targetDay);
  const submitWrittenQuestion = useAppStore((state) => state.submitWrittenQuestion);
  const declineWrittenQuestion = useAppStore((state) => state.declineWrittenQuestion);

  const [thisText, setThisText] = useState('');
  const [thatText, setThatText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const thisId = useId();
  const thatId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // The focus trap re-arms (and moves focus) on a new Escape handler, so it
  // gets a stable one that calls the latest `onClose`.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => onCloseRef.current(), []);
  useFocusTrap(panelRef, true, { onEscape: close, initialFocusRef: panelRef });

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      await submitWrittenQuestion(thisText, thatText);
    } catch (caught) {
      console.error("[DailyQuestion] Could not send tomorrow's question:", caught);
      setError(caught instanceof Error ? caught.message : "Could not send tomorrow's question.");
    } finally {
      setSending(false);
    }
  };

  const decline = async () => {
    setSending(true);
    try {
      await declineWrittenQuestion(dayId);
    } finally {
      setSending(false);
      onClose();
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
      data-testid="daily-write-sheet"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={SHEET_PANEL}
        onClick={(e) => e.stopPropagation()}
        data-testid="daily-write-panel"
      >
        <div className="flex flex-col gap-1">
          <span
            className="text-xs font-semibold tracking-[.08em] text-accent uppercase"
            data-testid="daily-write-eyebrow"
          >
            {weekday ?? 'Tomorrow'}
          </span>
          <h2
            id={titleId}
            className="font-serif text-[24px] leading-[1.15] font-semibold text-ink"
          >
            Write {weekday ?? 'tomorrow'}&apos;s question?
          </h2>
          <p className="text-[15px] leading-[1.4] text-muted" data-testid="daily-write-when">
            {partnerName} gets it {weekday ? `on ${weekday}` : 'tomorrow'}. You&apos;ll answer it
            too.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div>
            <label htmlFor={thisId} className={FIELD_LABEL}>
              This
            </label>
            <input
              id={thisId}
              type="text"
              className={fieldClass(false)}
              value={thisText}
              onChange={(e) => setThisText(e.target.value)}
              disabled={sending}
              data-testid="daily-write-this"
            />
          </div>
          <p className="text-center text-sm font-semibold text-muted" aria-hidden="true">
            or
          </p>
          <div>
            <label htmlFor={thatId} className={FIELD_LABEL}>
              That
            </label>
            <input
              id={thatId}
              type="text"
              className={fieldClass(false)}
              value={thatText}
              onChange={(e) => setThatText(e.target.value)}
              disabled={sending}
              data-testid="daily-write-that"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-[14px] bg-card2 p-3">
          <span className="text-xs font-semibold tracking-[.08em] text-muted uppercase">
            {partnerName} will see
          </span>
          <span
            className="text-base font-semibold wrap-break-word text-ink"
            data-testid="daily-write-preview"
          >
            {thisText.trim() || '…'} or {thatText.trim() || '…'}?
          </span>
        </div>

        {error && (
          <div className={FAILURE_BOX} role="alert" data-testid="daily-write-error">
            {error}
          </div>
        )}

        <p className={FOOTNOTE} data-testid="daily-write-rules">
          Each option is 1 to 40 characters, and the two must be different.
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={sending}
              onClick={() => void send()}
              data-testid="daily-write-send"
            >
              Send for {weekday ?? 'tomorrow'}
            </button>
          </div>
          <div className="flex">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={sending}
              onClick={() => void decline()}
              data-testid="daily-write-decline"
            >
              <Shuffle size={18} aria-hidden="true" />
              No thanks, pick one for us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
