import { useEffect, useState, useCallback } from 'react';
import { m as motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { useAppStore } from '../../stores/useAppStore';
import { PhotoCarouselControls } from './PhotoCarouselControls';
import { PhotoEditModal } from '../PhotoEditModal/PhotoEditModal';
import { PhotoDeleteConfirmation } from '../PhotoDeleteConfirmation/PhotoDeleteConfirmation';

/**
 * Photo Carousel Component
 * Story 4.3: Full-screen lightbox carousel with swipe/keyboard navigation
 * Story 4.4: AC-4.4.1-AC-4.4.7 - Edit and delete photo functionality
 *
 * Features:
 * - AC-4.3.1: Opens from PhotoGallery when photo is tapped (selectedPhotoId !== null)
 * - AC-4.3.2: Swipe left/right navigation with 300ms spring transitions
 * - AC-4.3.3: Photo displayed at optimal size (object-fit: contain, maintains aspect ratio)
 * - AC-4.3.4: Caption and tags displayed below photo
 * - AC-4.3.5: Close button (X) and swipe-down gesture closes carousel
 * - AC-4.3.6: Keyboard navigation (ArrowLeft, ArrowRight, Escape)
 * - AC-4.3.7: Framer Motion spring animations (stiffness: 300, damping: 30)
 * - AC-4.3.9: Drag constraints prevent over-scroll at boundaries
 * - AC-4.4.1: Edit button opens PhotoEditModal
 * - AC-4.4.4: Delete button opens PhotoDeleteConfirmation
 */
export function PhotoCarousel() {
  const { photos, selectedPhotoId, selectPhoto, clearPhotoSelection, updatePhoto, deletePhoto } =
    useAppStore();

  // Find current photo index based on selectedPhotoId
  const currentIndex = photos.findIndex((p) => p.id === selectedPhotoId);
  const currentPhoto = photos[currentIndex];

  // Navigation state
  const [direction, setDirection] = useState<'left' | 'right'>('left');

  // Story 4.4: Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // AC-4.3.3: Derive image URL from current photo (no state needed - pure computation)
  const imageUrl = (currentPhoto && 'signedUrl' in currentPhoto && currentPhoto.signedUrl)
    ? currentPhoto.signedUrl
    : '';

  // AC-4.3.2: Navigation functions (with boundary checking)
  const navigateToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      const nextPhoto = photos[currentIndex + 1];
      selectPhoto(nextPhoto.id);
      setDirection('left'); // Swipe left shows next photo
    }
  }, [currentIndex, photos, selectPhoto]);

  const navigateToPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevPhoto = photos[currentIndex - 1];
      selectPhoto(prevPhoto.id);
      setDirection('right'); // Swipe right shows previous photo
    }
  }, [currentIndex, photos, selectPhoto]);

  // AC-4.3.2: Swipe gesture handler (50px threshold)
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 50;

    // Swipe left (offset.x < -50) → next photo
    if (info.offset.x < -swipeThreshold) {
      navigateToNext();
    }
    // Swipe right (offset.x > 50) → previous photo
    else if (info.offset.x > swipeThreshold) {
      navigateToPrev();
    }
    // AC-4.3.5: Swipe down (offset.y > 100) → close carousel
    else if (info.offset.y > 100) {
      clearPhotoSelection();
    }
  };

  // AC-4.3.6: Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard events when modals are open
      if (isEditModalOpen || isDeleteConfirmOpen) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateToPrev();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        clearPhotoSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigateToNext, navigateToPrev, clearPhotoSelection, isEditModalOpen, isDeleteConfirmOpen]);

  // Story 4.4: Modal handlers
  const handleOpenEditModal = () => {
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleOpenDeleteConfirm = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = () => {
    setIsDeleteConfirmOpen(false);
  };

  // AC-4.3.9: Dynamic drag constraints based on current position
  const dragConstraints = {
    left: currentIndex === photos.length - 1 ? 0 : -100,
    right: currentIndex === 0 ? 0 : 100,
  };

  // Don't render if no photo selected
  if (!currentPhoto || selectedPhotoId === null) {
    return null;
  }

  // AC-4.3.7: Exit animation direction based on swipe
  const exitX = direction === 'left' ? -300 : 300;
  const enterX = direction === 'left' ? 300 : -300;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      data-testid="photo-carousel"
      role="dialog"
      aria-modal="true"
      aria-label="Photo carousel"
    >
      {/* AC-4.3.8: Top controls bar */}
      <PhotoCarouselControls
        onClose={clearPhotoSelection}
        onEdit={handleOpenEditModal}
        onDelete={handleOpenDeleteConfirm}
        currentIndex={currentIndex}
        totalPhotos={photos.length}
      />

      {/* AC-4.3.7: AnimatePresence for smooth enter/exit transitions */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentPhoto.id}
          className="flex flex-col items-center justify-center h-full w-full px-4 pb-24"
          drag="x"
          dragConstraints={dragConstraints}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          initial={{ x: enterX, opacity: 0, scale: 0.95 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: exitX, opacity: 0, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
          data-testid="photo-carousel-image-container"
        >
          {/* AC-4.3.3: Photo displayed at optimal size (object-fit: contain) */}
          <div className="flex items-center justify-center max-w-full max-h-[calc(100vh-12rem)]">
            <img
              src={imageUrl}
              alt={currentPhoto.caption || `Photo ${currentPhoto.id}`}
              className="max-w-full max-h-full object-contain"
              draggable={false}
              data-testid="photo-carousel-image"
            />
          </div>

          {/* AC-4.3.4: Caption below photo */}
          {currentPhoto.caption && (
            <div className="mt-6 text-center max-w-4xl" data-testid="photo-carousel-metadata">
              <h3
                className="text-white text-xl font-medium mb-3"
                data-testid="photo-carousel-caption"
              >
                {currentPhoto.caption}
              </h3>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation hint text */}
      <div className="fixed bottom-4 left-0 right-0 text-center text-white/60 text-sm">
        <p>← → Arrow keys or swipe to navigate • Esc to close • ↓ Swipe down to close</p>
      </div>

      {/* Story 4.4: AC-4.4.1, AC-4.4.2, AC-4.4.3 - Photo Edit Modal */}
      {isEditModalOpen && currentPhoto && (
        <PhotoEditModal
          photo={currentPhoto}
          onClose={handleCloseEditModal}
          onSave={(id, updates) => updatePhoto(String(id), updates)}
        />
      )}

      {/* Story 4.4: AC-4.4.4, AC-4.4.5 - Photo Delete Confirmation */}
      {isDeleteConfirmOpen && currentPhoto && (
        <PhotoDeleteConfirmation
          photo={currentPhoto}
          onClose={handleCloseDeleteConfirm}
          onConfirmDelete={(id) => deletePhoto(String(id))}
        />
      )}
    </div>
  );
}
