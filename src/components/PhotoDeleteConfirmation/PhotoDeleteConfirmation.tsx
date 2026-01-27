import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Photo } from '../../types';
import type { PhotoWithUrls } from '../../services/photoService';

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
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-700">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h2 id="delete-dialog-title" className="text-xl font-semibold text-white">
            Delete this photo?
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-gray-300">This action cannot be undone.</p>

          {/* Show photo caption if it exists */}
          {photo.caption && (
            <div className="px-4 py-3 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Caption:</p>
              <p className="text-white text-sm line-clamp-2">{photo.caption}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="px-4 py-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200"
              data-testid="photo-delete-confirmation-error"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cancel without deleting"
            data-testid="photo-delete-confirmation-cancel-button"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Delete this photo permanently"
            data-testid="photo-delete-confirmation-delete-button"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
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
