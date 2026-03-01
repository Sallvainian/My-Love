import { m as motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { CustomMessage } from '../../types';

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

  const handleDelete = () => {
    deleteCustomMessage(message.id);
    onConfirm();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
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
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with warning icon */}
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Delete Message?</h2>
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

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 p-6">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100"
              data-testid="admin-delete-dialog-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 rounded-lg bg-red-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-red-700"
              data-testid="admin-delete-dialog-confirm"
            >
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
