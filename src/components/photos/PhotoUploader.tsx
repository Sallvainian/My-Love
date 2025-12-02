import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { imageCompressionService } from '../../services/imageCompressionService';

interface PhotoUploaderProps {
  onUpload?: (blob: Blob, metadata: {
    width: number;
    height: number;
    originalSize: number;
    compressedSize: number;
  }) => void;
  onCancel?: () => void;
  maxFileSize?: number; // Default: 25MB
}

/**
 * PhotoUploader Component
 * Story 6.1: AC-6.1.1-6.1.3, AC-6.1.10
 *
 * Features:
 * - File picker with JPEG/PNG/WebP validation (AC-6.1.1)
 * - 25MB max file size validation (AC-6.1.2)
 * - Image preview before upload (AC-6.1.3)
 * - Mobile camera support via capture attribute (AC-6.1.10)
 * - Object URL cleanup on unmount (memory leak prevention)
 */
export function PhotoUploader({
  onUpload,
  onCancel,
  maxFileSize = 25 * 1024 * 1024 // AC-6.1.2: Default 25MB
}: PhotoUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AC-6.1.3: Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /**
   * Helper function to get image dimensions from a File
   * AC-6.1.8: Used for fallback when compression fails
   */
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: img.width,
          height: img.height,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      img.src = objectUrl;
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous state
    setError(null);
    setWarning(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    // AC-6.1.1, AC-6.1.2: Validate file type and size
    const validation = imageCompressionService.validateImageFile(file);

    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      setSelectedFile(null);
      return;
    }

    if (validation.warning) {
      setWarning(validation.warning);
    }

    // AC-6.1.3: Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setError(null);

      // Compress image using service
      const result = await imageCompressionService.compressImage(selectedFile);

      // Call parent callback with compressed blob and metadata
      onUpload?.(result.blob, {
        width: result.width,
        height: result.height,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
      });

      // Cleanup
      handleClear();
    } catch (err) {
      // AC-6.1.8: Compression failure handling with fallback logic
      const FALLBACK_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

      if (selectedFile.size <= FALLBACK_SIZE_LIMIT) {
        // Fallback: Use original file if under 10MB
        console.warn('[PhotoUploader] Compression failed, using original file as fallback:', (err as Error).message);
        try {
          const dimensions = await getImageDimensions(selectedFile);

          onUpload?.(selectedFile, {
            width: dimensions.width,
            height: dimensions.height,
            originalSize: selectedFile.size,
            compressedSize: selectedFile.size, // Same as original when using fallback
          });

          // Cleanup
          handleClear();
        } catch (dimensionError) {
          setError('Unable to process this image file. The file may be corrupted or in an unsupported format. Please try a different photo.');
        }
      } else {
        // File too large to upload without compression
        const sizeMB = (selectedFile.size / 1024 / 1024).toFixed(1);
        setError(
          `File is too large (${sizeMB} MB) and cannot be uploaded without compression. ` +
          `Please try a smaller image (under 10 MB) or use a different photo.`
        );
      }
    }
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    setWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    handleClear();
    onCancel?.();
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Upload Photo</h2>
        <button
          onClick={handleCancel}
          className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* File Input - AC-6.1.1, AC-6.1.10 */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp" // AC-6.1.1
          capture="environment" // AC-6.1.10: Mobile camera support
          onChange={handleFileSelect}
          className="hidden"
          id="photo-upload-input"
        />
        <label
          htmlFor="photo-upload-input"
          className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-pink-500 hover:bg-pink-50 transition-colors"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-4">
              <Camera size={32} className="text-gray-400" />
              <Upload size={32} className="text-gray-400" />
            </div>
            <span className="text-sm text-gray-600">
              Take photo or select from gallery
            </span>
            <span className="text-xs text-gray-400">
              JPEG, PNG, or WebP (max 25MB)
            </span>
          </div>
        </label>
      </div>

      {/* Preview - AC-6.1.3 */}
      {previewUrl && (
        <div className="mb-4">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-64 object-contain bg-gray-100 rounded-lg"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Choose Different Photo
            </button>
            <button
              onClick={handleUpload}
              disabled={!!error}
              className="flex-1 px-4 py-2 text-sm text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload Photo
            </button>
          </div>
        </div>
      )}

      {/* Error Message - AC-6.1.2 */}
      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Warning Message */}
      {warning && !error && (
        <div className="p-3 mb-4 text-sm text-yellow-700 bg-yellow-100 border border-yellow-200 rounded-lg">
          {warning}
        </div>
      )}

      {/* File Info */}
      {selectedFile && !error && (
        <div className="text-xs text-gray-500">
          <p>File: {selectedFile.name}</p>
          <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}
    </div>
  );
}
