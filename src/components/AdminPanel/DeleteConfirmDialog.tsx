import { m as motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { AccountDataError } from '../../services/accountDataError';
import { useAppStore } from '../../stores/useAppStore';
import type { CustomMessage } from '../../types';
import { useDialogSession } from './useDialogSession';

interface DeleteConfirmDialogProps {
  message: CustomMessage;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  message,
  isOpen,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const { deleteCustomMessage } = useAppStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const captureSession = useDialogSession();

  const handleDelete = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsDeleting(true);
    setError(null);
    const stillCurrent = captureSession();
    try {
      await deleteCustomMessage(message.id);
      if (stillCurrent()) onConfirm();
    } catch (err) {
      if (!stillCurrent()) return;
      setError(
        err instanceof AccountDataError && err.code === 'offline'
          ? err.message
          : 'Could not delete this message. Please try again.'
      );
    } finally {
      pending.current = false;
      if (stillCurrent()) setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    if (!pending.current) onCancel();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleCancel}
        className="fixed inset-0 z-50 bg-black/50"
        data-testid="admin-delete-dialog-backdrop"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          data-testid="admin-delete-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-message-title"
          aria-busy={isDeleting}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with warning icon */}
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <TriangleAlert className="h-6 w-6 text-red-600" />
            </div>
            <h2 id="delete-message-title" className="mb-2 text-xl font-bold text-gray-900">
              Delete Message?
            </h2>
            <p className="text-sm text-gray-500">
              This action cannot be undone. The message will be permanently removed from your
              library.
            </p>
          </div>

          {/* Message preview */}
          <div className="px-6 pb-6">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="line-clamp-3 text-sm text-gray-700">{message.text}</p>
              <div className="mt-2 flex items-center justify-between border-t border-gray-300 pt-2 text-xs text-gray-500">
                <span>Category: {message.category}</span>
                <span>ID: {message.id}</span>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="px-6 pb-4 text-sm text-red-700">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 p-6">
            <button
              onClick={handleCancel}
              disabled={isDeleting}
              className="flex-1 rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100"
              data-testid="admin-delete-dialog-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 rounded-lg bg-red-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-red-700"
              data-testid="admin-delete-dialog-confirm"
            >
              {isDeleting ? 'Deleting…' : error ? 'Retry delete' : 'Delete'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
