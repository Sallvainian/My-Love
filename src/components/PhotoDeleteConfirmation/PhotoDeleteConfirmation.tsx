import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { PhotoWithUrls } from '../../services/photoService';
import type { Photo } from '../../types';

// Support both IndexedDB Photo (number id) and Supabase PhotoWithUrls (string id)
type PhotoLike = Photo | PhotoWithUrls;

interface PhotoDeleteConfirmationProps {
  photo: PhotoLike;
  onClose: () => void;
  onConfirmDelete: (photoId: string | number) => Promise<void>;
}

/**
 * Photo Delete Confirmation Dialog Component
 * Story 4.4: AC-4.4.4, AC-4.4.5
 *
 * Features:
 * - Dialog overlay (z-index: 70, above edit modal z-index: 60)
 * - Warning title: "Delete this photo?"
 * - Warning message: "This action cannot be undone."
 * - Cancel button (closes dialog without deleting)
 * - Delete button (red/destructive styling, confirms deletion)
 * - Backdrop prevents interaction with lower layers
 */
export function PhotoDeleteConfirmation({
  photo,
  onClose,
  onConfirmDelete,
}: PhotoDeleteConfirmationProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle delete confirmation
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      await onConfirmDelete(photo.id);

      // Dialog will close automatically via onClose after successful delete
      onClose();
    } catch (err) {
      console.error('[PhotoDeleteConfirmation] Failed to delete photo:', err);
      setError('Failed to delete photo. Please try again.');
      setIsDeleting(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
      onClick={handleBackdropClick}
      data-testid="photo-delete-confirmation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="mx-4 w-full max-w-md rounded-lg bg-gray-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-700 px-6 py-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-900/50">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h2 id="delete-dialog-title" className="text-xl font-semibold text-white">
            Delete this photo?
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-4">
          <p className="text-gray-300">This action cannot be undone.</p>

          {/* Show photo caption if it exists */}
          {photo.caption && (
            <div className="rounded-lg bg-gray-700/50 px-4 py-3">
              <p className="mb-1 text-sm text-gray-400">Caption:</p>
              <p className="line-clamp-2 text-sm text-white">{photo.caption}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="rounded-lg border border-red-700 bg-red-900/50 px-4 py-3 text-red-200"
              data-testid="photo-delete-confirmation-error"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Cancel without deleting"
            data-testid="photo-delete-confirmation-cancel-button"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Delete this photo permanently"
            data-testid="photo-delete-confirmation-delete-button"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
