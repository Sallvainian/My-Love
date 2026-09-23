import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { PhotoWithUrls } from '../../services/photoService';
import type { Photo } from '../../types';
import { DIALOG_SCRIM, DIALOG_SURFACE } from '../shared/kitClasses';

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
 * - Delete button (kit destructive styling, confirms deletion)
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
      className={`${DIALOG_SCRIM} z-[70]`}
      onClick={handleBackdropClick}
      data-testid="photo-delete-confirmation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className={`${DIALOG_SURFACE} max-w-md`}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-dtint text-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 id="delete-dialog-title" className="text-lg font-semibold text-ink">
            Delete this photo?
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-4 px-5 py-4">
          <p className="text-[15px] text-ink">This action cannot be undone.</p>

          {/* Show photo caption if it exists */}
          {photo.caption && (
            <div className="rounded-[14px] bg-card2 px-3 py-2">
              <p className="mb-1 text-sm text-muted">Caption:</p>
              <p className="line-clamp-2 text-sm text-ink">{photo.caption}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="rounded-[14px] bg-dtint px-4 py-3 text-sm text-danger"
              data-testid="photo-delete-confirmation-error"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="h-12 rounded-full bg-tint px-5 text-[15px] font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Cancel without deleting"
            data-testid="photo-delete-confirmation-cancel-button"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-12 items-center gap-2 rounded-full bg-dtint px-5 text-[15px] font-semibold text-danger transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-50"
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
