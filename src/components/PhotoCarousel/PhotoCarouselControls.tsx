import { Edit, Trash2, X } from 'lucide-react';

interface PhotoCarouselControlsProps {
  onClose: () => void;
  onEdit: () => void; // Story 4.4: AC-4.4.1
  onDelete: () => void; // Story 4.4: AC-4.4.4
  currentIndex: number;
  totalPhotos: number;
}

/**
 * Photo Carousel Controls Component
 * Story 4.3: AC-4.3.8 - Top bar with Edit/Delete/Close buttons
 * Story 4.4: AC-4.4.1, AC-4.4.4 - Enable Edit/Delete buttons
 *
 * Features:
 * - Edit button (Pencil icon) - functional (Story 4.4)
 * - Delete button (Trash icon) - functional (Story 4.4)
 * - Close button (X icon) - functional
 * - Photo counter (current/total)
 * - Semi-transparent backdrop for readability
 */
export function PhotoCarouselControls({
  onClose,
  onEdit,
  onDelete,
  currentIndex,
  totalPhotos,
}: PhotoCarouselControlsProps) {
  return (
    <div
      className="fixed top-0 right-0 left-0 z-[51] bg-black/50 pt-[env(safe-area-inset-top)] backdrop-blur-sm"
      data-testid="photo-carousel-controls"
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side: Photo counter */}
        <div className="text-sm font-medium text-white" data-testid="photo-carousel-counter">
          {currentIndex + 1} / {totalPhotos}
        </div>

        {/* Center/Right: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Story 4.4: AC-4.4.1 - Edit button (functional) */}
          <button
            onClick={onEdit}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-ink"
            aria-label="Edit photo caption and tags"
            data-testid="photo-carousel-edit-button"
          >
            <Edit className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Story 4.4: AC-4.4.4 - Delete button (functional) */}
          <button
            onClick={onDelete}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-danger"
            aria-label="Delete this photo"
            data-testid="photo-carousel-delete-button"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* AC-4.3.5: Close button - functional */}
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-ink"
            aria-label="Close carousel"
            data-testid="photo-carousel-controls-close-button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
