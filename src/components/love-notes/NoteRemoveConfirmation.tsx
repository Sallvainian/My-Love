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
import { useState } from 'react';
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

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      setError(null);
      await onConfirmRemove(note.id);
      onClose();
    } catch (err) {
      console.error('[NoteRemoveConfirmation] Failed to remove note:', err);
      setError('Failed to remove the message. Please try again.');
      setIsRemoving(false);
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
      <div className="mx-4 w-full max-w-md rounded-lg bg-gray-800 shadow-xl">
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
