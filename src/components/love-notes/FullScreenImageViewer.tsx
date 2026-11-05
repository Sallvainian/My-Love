/**
 * FullScreenImageViewer Component
 *
 * Modal overlay for viewing images at full size.
 * Simple implementation without pinch zoom (MVP).
 *
 * Features:
 * - Dark overlay background
 * - Tap outside image to close
 * - X button in corner to close
 * - Centered image with max dimensions
 */

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface FullScreenImageViewerProps {
  imageUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  alt?: string;
}

function FullScreenImageViewerComponent({
  imageUrl,
  isOpen,
  onClose,
  alt = 'Full screen image',
}: FullScreenImageViewerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle escape key to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Focus management: trap focus in modal and restore on close
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element to restore later
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);

      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';

      // Restore focus to previously focused element
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  // Rendered into document.body: the viewer opens from a message row, which
  // the virtualized list positions with a transform, and a transformed
  // ancestor becomes the containing block of `fixed inset-0`, so in place the
  // viewer covered only that row's part of the list, clipped by its scroller.
  return createPortal(
    <AnimatePresence>
      {isOpen && imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Full screen image viewer"
          data-testid="fullscreen-image-viewer"
        >
          {/* Dark overlay - click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90"
            onClick={onClose}
            aria-hidden="true"
            data-testid="fullscreen-image-backdrop"
          />

          {/* Close button. The viewer covers the whole screen, so Close keeps
              clear of the right inset as of the top one: on the iPhone Duo the
              side column holds the capsule there, as in the photo viewer. */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-right))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close image viewer"
          >
            <X size={20} aria-hidden="true" />
          </button>

          {/* Image container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={alt}
              className="max-h-[90vh] max-w-full rounded-[14px] object-contain"
              loading="eager"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export const FullScreenImageViewer = memo(FullScreenImageViewerComponent);
