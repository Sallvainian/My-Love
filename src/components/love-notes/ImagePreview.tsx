/**
 * ImagePreview Component
 *
 * Shows a preview of the selected image before sending in MessageInput.
 * Displays thumbnail, file size estimate, and compression indicator.
 *
 * Props:
 * - file: The selected image file
 * - onRemove: Callback to remove the selected image
 * - isCompressing: Whether compression is in progress
 */

import { memo, useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { imageCompressionService } from '../../services/imageCompressionService';
import { IMAGE_VALIDATION } from '../../config/images';

export interface ImagePreviewProps {
  file: File;
  onRemove: () => void;
  isCompressing?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImagePreviewComponent({ file, onRemove, isCompressing = false }: ImagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create preview URL from file with error handling
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    const schedulePreviewUpdate = (nextUrl: string | null) => {
      queueMicrotask(() => {
        if (!cancelled) {
          setPreviewUrl(nextUrl);
        }
      });
    };

    try {
      url = URL.createObjectURL(file);
      schedulePreviewUpdate(url);
    } catch (error) {
      console.error('[ImagePreview] Failed to create preview URL:', error);
      schedulePreviewUpdate(null);
    }

    return () => {
      cancelled = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);

  // Calculate sizes
  const originalSize = file.size;
  const estimatedCompressedSize = useMemo(
    () => imageCompressionService.estimateCompressedSize(file),
    [file]
  );

  // Determine if file is large enough to show compression indicator
  const showCompressionIndicator = originalSize > IMAGE_VALIDATION.COMPRESSION_INDICATOR_THRESHOLD_BYTES;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative inline-block"
      data-testid="image-preview"
    >
      {/* Image thumbnail */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Selected image preview"
            className="max-w-[200px] max-h-[150px] object-cover"
          />
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          disabled={isCompressing}
          aria-label="Remove selected image"
          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <X size={16} aria-hidden="true" />
        </button>

        {/* Compression/uploading overlay */}
        {isCompressing && (
          <div
            className="absolute inset-0 bg-black/40 flex items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-white text-sm">
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
              <span>Compressing...</span>
            </div>
          </div>
        )}
      </div>

      {/* File size info */}
      <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
        <span>{formatFileSize(originalSize)}</span>
        <span>→</span>
        <span className="text-green-600">~{formatFileSize(estimatedCompressedSize)}</span>
        {showCompressionIndicator && !isCompressing && (
          <span className="text-amber-600">(large file)</span>
        )}
      </div>
    </motion.div>
  );
}

export const ImagePreview = memo(ImagePreviewComponent);
export default ImagePreview;
