/**
 * Note Remove Confirmation Dialog
 *
 * Removal is one-way -- love_note_removals carries no DELETE policy and does not
 * grant the privilege -- so this dialog is the only thing standing between a
 * mistaken tap and a message the user cannot get back.
 *
 * The wording matters: this removes the message from THIS person's history only.
 * There is one love_notes row per message and it is simultaneously the partner's
 * copy, so the partner's thread is untouched and they cannot tell.
 *
 * A note that failed to send (it still carries its tempId) is confirmed here
 * too, but it has no server row to remove: LoveNotes deletes it from this
 * device, and the wording says only that it failed to send.
 *
 * Rendered by LoveNotes, outside the virtualized list, rather than from inside a
 * row: MessageList's rows live in an overflow-hidden container and Motion
 * puts a transform on the message wrapper, which would make a fixed-position
 * child resolve against the row instead of the viewport.
 */
import { TriangleAlert, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { LoveNote } from '../../types/models';
import { DIALOG_SCRIM, DIALOG_SURFACE } from '../shared/kitClasses';

interface NoteRemoveConfirmationProps {
  note: LoveNote;
  onClose: () => void;
  onConfirmRemove: (noteId: string) => Promise<void>;
  /**
   * Where focus goes when the control that opened this dialog does not survive
   * the removal. Owned by LoveNotes rather than found in the DOM, because the
   * element has to outlive the thread it belongs to -- see the cleanup below.
   */
  fallbackFocusRef: RefObject<HTMLElement | null>;
}

export function NoteRemoveConfirmation({
  note,
  onClose,
  onConfirmRemove,
  fallbackFocusRef,
}: NoteRemoveConfirmationProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isRemovingRef = useRef(false);
  const removalSucceededRef = useRef(false);

  // useFocusTrap lists onEscape in its effect deps and re-focuses initialFocusRef
  // on every run, so any change of identity re-arms the trap and drags focus back
  // to Cancel -- which a `isRemoving ? undefined : onClose` ternary did on every
  // write, and an inline arrow from the parent did on every parent render. Read
  // the flag from a ref instead, so this handler is created once and the effect
  // runs once. onClose must be stable too; LoveNotes wraps it in useCallback.
  // Latest-ref rather than a dep: this must hold even when a caller passes an
  // inline arrow, which is the normal React thing to do. Depending on onClose
  // would put the component's accessibility at the mercy of every call site
  // remembering to memoise.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleEscape = useCallback(() => {
    // Escape stays suppressed mid-write so a stray key cannot orphan a removal.
    if (isRemovingRef.current) return;
    onCloseRef.current();
  }, []);

  // Focus stays on the trash button behind the overlay otherwise, inside a
  // subtree aria-modal tells assistive tech to ignore -- so a keyboard user
  // opens a dialog they cannot reach or dismiss. Cancel takes initial focus
  // because this action cannot be undone.
  useFocusTrap(panelRef, true, {
    onEscape: handleEscape,
    initialFocusRef: cancelButtonRef,
  });

  // Hand focus back to Cancel once a failure has re-enabled it. This has to run
  // after that render: doing it inside the catch focuses a still-disabled
  // button, which the DOM ignores, leaving focus parked on the panel.
  useEffect(() => {
    if (error && !isRemoving) {
      cancelButtonRef.current?.focus();
    }
  }, [error, isRemoving]);

  // Only the fallback lives here. useFocusTrap already restores the opener when
  // the trap goes away; this covers the case unique to a removal, where there is
  // no opener left to go back to -- the control was on the row that just went.
  //
  // Gated on the removal having succeeded, NOT on whether the opener is still in
  // the document. An earlier version captured document.activeElement and asked
  // `opener.isConnected` at cleanup, which is not a sound signal: React runs
  // effect cleanups against a DOM it has not finished mutating, so the answer
  // depends on where the opener sat in the tree. Measured both ways -- with the
  // trash button as a direct sibling of the dialog it read false (fallback fired,
  // correctly), but with the button inside the list container that MessageList
  // swaps out for its empty state it read true, the guard bailed, and focus
  // landed on <body>. That is the last-note removal: the case the fallback exists
  // for, silently broken. Whether the user confirmed is something this component
  // knows for certain, so it decides on that instead.
  //
  // A passive effect, and declared after useFocusTrap so its cleanup runs second.
  // That ordering is load-bearing, not a nicety: after a removal the hook's
  // restore does NOT reliably no-op (as measured above, the opener can still
  // read isConnected at cleanup time) -- it may focus the doomed opener, and
  // this cleanup, running second, is what overwrites that with the fallback.
  // Swapping the declaration order of the useFocusTrap call and this effect
  // would regress the last-note case with no test-visible change here.
  useEffect(() => {
    return () => {
      if (!removalSucceededRef.current) return;
      // Reading the ref at cleanup is the point, not an oversight. The rule below
      // wants the node copied in at effect time; doing that would re-freeze a DOM
      // node the way the version this replaced did, which is what broke the
      // last-note case.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the ref at cleanup on purpose: the fallback must be the node mounted now
      const fallback = fallbackFocusRef.current;
      if (fallback?.isConnected) {
        fallback.focus();
      }
    };
  }, [fallbackFocusRef]);

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      isRemovingRef.current = true;
      setError(null);

      // The button the user just activated is about to be disabled, and a browser
      // moves focus to <body> when the focused element becomes disabled -- verified
      // in Chrome, and re-focusing an already-disabled Cancel is a no-op. That
      // would park focus outside the element the trap's keydown listener is bound
      // to. Move it onto the panel first, while the move can still land.
      panelRef.current?.focus();

      await onConfirmRemove(note.id);
      removalSucceededRef.current = true;
      onClose();
    } catch (err) {
      console.error('[NoteRemoveConfirmation] Failed to remove note:', err);
      // Surface what removeNote actually threw. Every message it raises is
      // written for a person, and the generic "please try again" was advice that
      // could not work for some of them -- a note that is no longer in the
      // loaded window throws on every retry, so the fixed string sent the user
      // round a loop whose only exit was Cancel.
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to remove the message. Please try again.'
      );
      setIsRemoving(false);
      isRemovingRef.current = false;
      // Focus is restored by the effect below, not here: setIsRemoving(false) is
      // batched and has not rendered yet, so Cancel still carries `disabled` and
      // focusing a disabled element is a no-op.
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isRemoving) {
      onClose();
    }
  };

  const preview = note.content?.trim() ? note.content.trim() : 'this photo';
  // A failed send. Not "never sent": a picture note whose response was lost may
  // have been stored anyway, so this states only what the user saw.
  const failedToSend = !!note.tempId;

  return (
    <div
      className={`${DIALOG_SCRIM} z-70`}
      onClick={handleBackdropClick}
      data-testid="note-remove-confirmation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-note-dialog-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`${DIALOG_SURFACE} max-w-md`}
        data-testid="note-remove-panel"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dtint text-danger">
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 id="remove-note-dialog-title" className="text-lg font-semibold text-ink">
            Remove this message?
          </h2>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="line-clamp-3 rounded-[14px] bg-card2 px-3 py-2 text-sm text-muted italic">
            {preview}
          </p>
          {failedToSend ? (
            <p className="text-[15px] text-ink">
              This message failed to send. It will be deleted from this device.
            </p>
          ) : (
            <p className="text-[15px] text-ink">
              This removes it from <span className="font-semibold">your</span> history only.
              Your partner keeps their copy and will not be told.
            </p>
          )}
          <p className="text-sm text-muted">You cannot undo this.</p>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-line px-5 py-4">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isRemoving}
            className="h-12 rounded-full bg-tint px-5 text-[15px] font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            data-testid="note-remove-confirm"
            className="flex h-12 items-center gap-2 rounded-full bg-dtint px-5 text-[15px] font-semibold text-danger transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50"
          >
            {isRemoving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isRemoving ? 'Removing...' : 'Remove for me'}
          </button>
        </div>
      </div>
    </div>
  );
}
