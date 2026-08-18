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
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { LoveNote } from '../../types/models';

interface NoteRemoveConfirmationProps {
  note: LoveNote;
  onClose: () => void;
  onConfirmRemove: (noteId: string) => Promise<void>;
}

export function NoteRemoveConfirmation({
  note,
  onClose,
  onConfirmRemove,
}: NoteRemoveConfirmationProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isRemovingRef = useRef(false);

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
      cancelButtonRef.current?.focus();
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
