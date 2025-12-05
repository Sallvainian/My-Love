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

import { memo, useEffect, useCallback } from 'react';
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
  // Handle escape key to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Add/remove keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
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
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
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
