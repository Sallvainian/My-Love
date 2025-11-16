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
        className="fixed inset-0 bg-black/50 z-50"
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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
          data-testid="admin-delete-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with warning icon */}
          <div className="p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Message?</h2>
            <p className="text-sm text-gray-500">
              This action cannot be undone. The message will be permanently removed from your
              library.
            </p>
          </div>

          {/* Message preview */}
          <div className="px-6 pb-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700 line-clamp-3">{message.text}</p>
              <div className="mt-2 pt-2 border-t border-gray-300 flex items-center justify-between text-xs text-gray-500">
                <span>Category: {message.category}</span>
                <span>ID: {message.id}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              data-testid="admin-delete-dialog-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
