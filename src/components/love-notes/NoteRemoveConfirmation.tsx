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
 * Rendered by LoveNotes, outside the virtualized list, rather than from inside a
 * row: MessageList's rows live in an overflow-hidden container and framer-motion
 * puts a transform on the message wrapper, which would make a fixed-position
 * child resolve against the row instead of the viewport.
 */
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { LoveNote } from '../../types/models';

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
      onClick={handleBackdropClick}
      data-testid="note-remove-confirmation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-note-dialog-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="mx-4 w-full max-w-md rounded-lg bg-gray-800 shadow-xl outline-none"
      >
        <div className="flex items-center gap-3 border-b border-gray-700 px-6 py-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-900/50">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h2 id="remove-note-dialog-title" className="text-xl font-semibold text-white">
            Remove this message?
          </h2>
        </div>

        <div className="space-y-4 px-6 py-4">
          <p className="line-clamp-3 rounded bg-gray-900/60 px-3 py-2 text-sm text-gray-300 italic">
            {preview}
          </p>
          <p className="text-gray-300">
            This removes it from <span className="font-medium text-white">your</span> history only.
            Your partner keeps their copy and will not be told.
          </p>
          <p className="text-sm text-gray-400">You cannot undo this.</p>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-700 px-6 py-4">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isRemoving}
            className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            data-testid="note-remove-confirm"
            className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isRemoving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRemoving ? 'Removing...' : 'Remove for me'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NoteRemoveConfirmation;
