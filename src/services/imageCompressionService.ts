import type { CompressionOptions, CompressionResult } from '../types';

/**
 * Image Compression Service - Client-side image compression using Canvas API
 * Story 6.1: AC-6.1.4-6.1.9 - Compress photos before upload to Supabase Storage
 *
 * Uses native Canvas API (no external dependencies) to:
 * - Resize images to max 2048px dimensions (maintaining aspect ratio)
 * - Convert to JPEG format with 80% quality
 * - Strip EXIF metadata for privacy (automatic via Canvas redraw)
 * - Achieve ~90% size reduction (3-5MB → 300-500KB)
 * - Complete compression in <3 seconds for 10MB input (AC-6.1.7)
 */
class ImageCompressionService {
  private readonly DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.8, // 80% JPEG quality (AC-6.1.5)
  };

  /**
   * Compress image file using Canvas API
   * AC-6.1.4-6.1.9: Max 2048px, 80% JPEG quality, EXIF stripping, <3s for 10MB
   *
   * @param file - Image file to compress
   * @param options - Optional compression settings (defaults applied)
   * @returns Compressed image blob with metadata
   * @throws Error if compression fails (caller should handle AC-6.1.8 fallback)
   */
  async compressImage(
    file: File,
    options: Partial<CompressionOptions> = {}
  ): Promise<CompressionResult> {
    const startTime = performance.now(); // AC-6.1.7: Use performance.now() for precise benchmarking
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      // Load image from file
      const img = await this.loadImage(file);

      // Calculate dimensions (maintain aspect ratio)
      let { width, height } = img;
      if (width > opts.maxWidth) {
        height = (height * opts.maxWidth) / width;
        width = opts.maxWidth;
      }
      if (height > opts.maxHeight) {
        width = (width * opts.maxHeight) / height;
        height = opts.maxHeight;
      }

      // Round dimensions to whole pixels
      width = Math.floor(width);
      height = Math.floor(height);

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas 2D context');
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/jpeg',
          opts.quality
        );
      });

      const duration = performance.now() - startTime; // AC-6.1.7: Measure compression timing
      const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
      const compressedSizeKB = (blob.size / 1024).toFixed(0);
      const reductionPercent = (((file.size - blob.size) / file.size) * 100).toFixed(0);

      // AC-6.1.7: Log compression performance (target: <3000ms for 10MB)
      console.log(
        `[Compression] ${originalSizeMB}MB → ${compressedSizeKB}KB (${reductionPercent}% reduction) in ${duration.toFixed(0)}ms`
      );

      // AC-6.1.7: Warn if compression exceeds performance target
      if (duration > 3000 && file.size > 5 * 1024 * 1024) {
        console.warn(
          `[Compression] Performance target exceeded: ${duration.toFixed(0)}ms for ${originalSizeMB}MB file (target: <3000ms for 10MB)`
        );
      }

      return {
        blob,
        width,
        height,
        originalSize: file.size,
        compressedSize: blob.size,
      };
    } catch (error) {
      console.error('[Compression] Failed to compress image:', error);
      throw new Error(`Compression failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate image file before compression
   * AC-6.1.1: Accept only JPEG, PNG, WebP
   * AC-6.1.2: Reject files >25MB raw with error message
   *
   * @param file - File to validate
   * @returns Validation result with error message if invalid
   */
  validateImageFile(file: File): { valid: boolean; error?: string; warning?: string } {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']; // AC-6.1.1

    // Error: Unsupported format
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Unsupported file format. Please select a JPEG, PNG, or WebP image.',
      };
    }

    // Error: File too large (>25MB) - AC-6.1.2
    if (file.size > 25 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      return {
        valid: false,
        error: `File is too large (${sizeMB} MB). Maximum file size is 25 MB.`,
      };
    }

    // Warning: Large file (>10MB) - AC-6.1.7 (may approach 3s limit)
    if (file.size > 10 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      return {
        valid: true,
        warning: `This file is large (${sizeMB} MB). Compression may take a few seconds.`,
      };
    }

    return { valid: true };
  }

  /**
   * Estimate compressed size before actual compression
   * Used for preview screen display (AC-4.1.3)
   *
   * @param file - Original file
   * @returns Estimated compressed size in bytes
   */
  estimateCompressedSize(file: File): number {
    // Typical compression ratio: 3-5MB → 300-500KB (~90% reduction)
    // Conservative estimate: 10% of original size
    return Math.round(file.size * 0.1);
  }

  /**
   * Load image from file
   * Private helper method using FileReader and Image
   *
   * @param file - File to load
   * @returns Promise resolving to HTMLImageElement
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Cleanup object URL after loading
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
      img.src = URL.createObjectURL(file);
    });
  }
}

// Singleton instance
export const imageCompressionService = new ImageCompressionService();
