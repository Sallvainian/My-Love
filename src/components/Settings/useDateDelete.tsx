/**
 * The delete flow of a date page (an event, an anniversary): Delete asks
 * first, through `ConfirmDialog`, and is refused offline before the dialog so
 * the person is never asked to confirm what cannot go through, and again on
 * confirm, since the connection may have gone while the dialog was open. A
 * second confirm while one delete is in flight does nothing. A delete that
 * goes through calls `onDeleted` (the page leaves for the Dates list); one
 * that fails puts its message in the page's Error box. Nothing is set or
 * called once the page is gone (`mounted`).
 */

import { AnimatePresence } from 'motion/react';
import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { ConfirmDialog } from './ConfirmDialog';

interface DateDeleteOptions {
  /** `event` or `anniversary`: the dialog's question and test ids, and the messages. */
  noun: 'event' | 'anniversary';
  /** What the offline refusal names (`Events`, `Anniversaries`). */
  what: string;
  /** The console prefix a thrown failure is logged under (`[EventPage]`). */
  logTag: string;
  /** Deletes the date: resolves to the failure to show, or `null` when it went through. */
  remove: () => Promise<string | null>;
  onDeleted: () => void;
  setError: (error: string | null) => void;
  mounted: RefObject<boolean>;
}

export function useDateDelete({
  noun,
  what,
  logTag,
  remove,
  onDeleted,
  setError,
  mounted,
}: DateDeleteOptions): { deleting: boolean; requestDelete: () => void; confirmation: ReactNode } {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  // Stable: the dialog's focus trap re-runs on a new Escape handler.
  const cancelDelete = useCallback(() => setConfirming(false), []);

  const requestDelete = () => {
    setError(null);
    if (!isOnline()) {
      setError(offlineMessage(what, 'delete'));
      return;
    }
    setConfirming(true);
  };

  const confirmDelete = async () => {
    setConfirming(false);
    if (deletingRef.current) return;
    if (!isOnline()) {
      setError(offlineMessage(what, 'delete'));
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    let failure: string | null;
    try {
      failure = await remove();
    } catch (caught) {
      console.error(`${logTag} Could not delete the ${noun}:`, caught);
      failure = caught instanceof Error ? caught.message : `Could not delete the ${noun}.`;
    }
    deletingRef.current = false;
    if (!mounted.current) return;
    setDeleting(false);
    if (failure === null) onDeleted();
    else setError(failure);
  };

  const confirmation = (
    // Outside every card, like the other dialogs, so no card can clip it.
    <AnimatePresence>
      {confirming && (
        <ConfirmDialog
          question={`Delete this ${noun}?`}
          confirmLabel="Delete"
          onCancel={cancelDelete}
          onConfirm={() => void confirmDelete()}
          testId={`settings-${noun}-delete-confirmation`}
        />
      )}
    </AnimatePresence>
  );

  return { deleting, requestDelete, confirmation };
}
