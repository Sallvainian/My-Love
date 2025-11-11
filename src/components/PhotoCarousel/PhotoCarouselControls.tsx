import { Edit, Trash2, X } from 'lucide-react';

interface PhotoCarouselControlsProps {
  onClose: () => void;
  currentIndex: number;
  totalPhotos: number;
}

/**
 * Photo Carousel Controls Component
 * Story 4.3: AC-4.3.8 - Top bar with Edit/Delete/Close buttons
 * 
 * Features:
 * - Edit button (Pencil icon) - disabled placeholder for Story 4.4
 * - Delete button (Trash icon) - disabled placeholder for Story 4.4
 * - Close button (X icon) - functional
 * - Photo counter (current/total)
 * - Semi-transparent backdrop for readability
 */
export function PhotoCarouselControls({
  onClose,
  currentIndex,
  totalPhotos,
}: PhotoCarouselControlsProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[51] bg-black/50 backdrop-blur-sm"
      data-testid="photo-carousel-controls"
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side: Photo counter */}
        <div className="text-white text-sm font-medium" data-testid="photo-carousel-counter">
          {currentIndex + 1} / {totalPhotos}
        </div>
        
        {/* Center/Right: Action buttons */}
        <div className="flex items-center gap-2">
          {/* AC-4.3.8: Edit button - disabled (Story 4.4) */}
          <button
            disabled
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-gray-400
                       opacity-50 cursor-not-allowed"
            title="Coming in Story 4.4"
            data-testid="photo-carousel-edit-button"
          >
            <Edit className="w-4 h-4" />
            <span className="text-sm">Edit</span>
          </button>
          
          {/* AC-4.3.8: Delete button - disabled (Story 4.4) */}
          <button
            disabled
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-gray-400
                       opacity-50 cursor-not-allowed"
            title="Coming in Story 4.4"
            data-testid="photo-carousel-delete-button"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">Delete</span>
          </button>
          
          {/* AC-4.3.5: Close button - functional */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white
                       hover:bg-red-700 transition-colors"
            aria-label="Close carousel"
            data-testid="photo-carousel-controls-close-button"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
