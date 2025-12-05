/**
 * FullScreenImageViewer Component
 *
 * Modal overlay for viewing images at full size.
 * Simple implementation without pinch-to-zoom (MVP).
 *
 * Features:
 * - Dark overlay background
 * - Tap outside image to close
 * - X button in corner to close
 * - Centered image with max dimensions
 */

import { memo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface FullScreenImageViewerProps {
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

  return (
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
            aria-label="Close image viewer"
          />

          {/* Close button */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close image viewer"
          >
            <X size={24} aria-hidden="true" />
          </button>

          {/* Image container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              loading="eager"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const FullScreenImageViewer = memo(FullScreenImageViewerComponent);
export default FullScreenImageViewer;
