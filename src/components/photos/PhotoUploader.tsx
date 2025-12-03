import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { imageCompressionService } from '../../services/imageCompressionService';
import { usePhotos } from '../../hooks/usePhotos';
import type { PhotoUploadInput } from '../../services/photoService';

interface PhotoUploaderProps {
  onUploadSuccess?: () => void; // Called when upload completes successfully
  onCancel?: () => void;
  maxFileSize?: number; // Default: 25MB
}

// AC-6.1.8: Maximum file size for fallback upload without compression
const FALLBACK_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

// Toast notification type
type ToastType = 'success' | 'error' | 'warning';
interface Toast {
  type: ToastType;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * PhotoUploader Component
 * Story 6.1: AC-6.1.1-6.1.3, AC-6.1.10
 * Story 6.2: AC-6.2.1-6.2.5, AC-6.2.8-6.2.9, AC-6.2.12-6.2.13
 *
 * Features:
 * - File picker with JPEG/PNG/WebP validation (AC-6.1.1)
 * - 25MB max file size validation (AC-6.1.2)
 * - Image preview before upload (AC-6.1.3)
 * - Mobile camera support via capture attribute (AC-6.1.10)
 * - Caption input with 500 char limit and counter (AC-6.2.4, AC-6.2.5)
 * - Upload button disabled until photo selected (AC-6.2.1)
 * - Progress bar shows 0-100% during upload (AC-6.2.2, AC-6.2.3)
 * - Success toast on upload completion (AC-6.2.8)
 * - Error toast with retry button on failure (AC-6.2.9, AC-6.2.13)
 * - Modal closes on success (AC-6.2.12)
 * - Object URL cleanup on unmount (memory leak prevention)
 */
export function PhotoUploader({
  onUploadSuccess,
  onCancel,
  // maxFileSize parameter not used - component uses internal FALLBACK_SIZE_LIMIT validation
}: PhotoUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>(''); // AC-6.2.4: Caption input
  const [retryUpload, setRetryUpload] = useState<(() => void) | null>(null); // AC-6.2.9: Retry logic
  const [toast, setToast] = useState<Toast | null>(null); // AC-6.2.8, AC-6.2.9: Toast notifications
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Story 6.2: Use photos hook for upload state and actions
  const {
    uploadPhoto,
    isUploading,
    uploadProgress,
    error: uploadError,
    storageWarning,
    clearError,
    clearStorageWarning,
  } = usePhotos(false); // Don't auto-load photos

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
      clearError(); // Clear any previous upload errors

      // Compress image using service
      const result = await imageCompressionService.compressImage(selectedFile);

      // Prepare upload input (AC-6.2.6, AC-6.2.7)
      const uploadInput: PhotoUploadInput = {
        file: result.blob,
        filename: selectedFile.name,
        caption: caption.trim() || undefined, // AC-6.2.4: Optional caption
        mimeType: result.blob.type as 'image/jpeg' | 'image/png' | 'image/webp',
        width: result.width,
        height: result.height,
      };

      // Upload photo with progress tracking (AC-6.2.2, AC-6.2.3)
      await uploadPhoto(uploadInput);

      // AC-6.2.8: Success toast
      setToast({
        type: 'success',
        message: 'Photo uploaded successfully!',
      });

      // AC-6.2.12: Close modal on success
      handleClear();
      onUploadSuccess?.();
    } catch (err) {
      // AC-6.1.8: Compression failure handling with fallback logic
      if (selectedFile.size <= FALLBACK_SIZE_LIMIT) {
        // Fallback: Use original file if under 10MB
        console.warn('[PhotoUploader] Compression failed, using original file as fallback:', (err as Error).message);
        try {
          const dimensions = await getImageDimensions(selectedFile);

          const uploadInput: PhotoUploadInput = {
            file: selectedFile,
            filename: selectedFile.name,
            caption: caption.trim() || undefined,
            mimeType: selectedFile.type as 'image/jpeg' | 'image/png' | 'image/webp',
            width: dimensions.width,
            height: dimensions.height,
          };

          // Retry upload with original file
          await uploadPhoto(uploadInput);

          // AC-6.2.8: Success toast
          setToast({
            type: 'success',
            message: 'Photo uploaded successfully!',
          });

          // AC-6.2.12: Close modal on success
          handleClear();
          onUploadSuccess?.();
        } catch (_dimensionError) {
          setError('Unable to process this image file. The file may be corrupted or in an unsupported format. Please try a different photo.');
          // AC-6.2.9: Set retry function for error toast
          setRetryUpload(() => handleUpload);
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

  // AC-6.2.9, AC-6.2.13: Show error toast when upload error occurs
  useEffect(() => {
    if (uploadError) {
      setToast({
        type: 'error',
        message: uploadError,
        action: retryUpload
          ? {
              label: 'Retry',
              onClick: () => {
                clearError();
                setToast(null);
                retryUpload();
                setRetryUpload(null);
              },
            }
          : undefined,
      });
    }
  }, [uploadError, retryUpload, clearError]);

  // AC-6.2.10: Show storage warning toast
  useEffect(() => {
    if (storageWarning) {
      setToast({
        type: 'warning',
        message: storageWarning,
      });
      // Auto-dismiss warning after 5 seconds
      const timer = setTimeout(() => {
        clearStorageWarning();
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [storageWarning, clearStorageWarning]);

  // Auto-dismiss success toast after 3 seconds
  useEffect(() => {
    if (toast?.type === 'success') {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    setWarning(null);
    setCaption(''); // AC-6.2.4: Clear caption
    setRetryUpload(null); // Clear retry function
    clearError(); // Clear upload errors
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // AC-6.2.4, AC-6.2.5: Handle caption input with 500 char limit
  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setCaption(value);
    }
  };

  // AC-6.2.5: Character counter color
  const captionCounterColor =
    caption.length >= 490 ? 'text-red-500' : caption.length >= 400 ? 'text-yellow-500' : 'text-gray-500';

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

          {/* Caption Input - AC-6.2.4, AC-6.2.5 */}
          <div className="mt-3">
            <label htmlFor="caption-input" className="block text-sm font-medium text-gray-700 mb-1">
              Caption (optional)
            </label>
            <textarea
              id="caption-input"
              value={caption}
              onChange={handleCaptionChange}
              placeholder="Add a caption (optional)"
              maxLength={500}
              rows={3}
              disabled={isUploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {/* AC-6.2.5: Character counter */}
            <div className={`text-xs ${captionCounterColor} text-right mt-1`}>
              {caption.length}/500
            </div>
          </div>

          {/* Progress Bar - AC-6.2.2, AC-6.2.3 */}
          {isUploading && (
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-pink-500 transition-all duration-100 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleClear}
              disabled={isUploading} // Disable during upload
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Choose Different Photo
            </button>
            {/* AC-6.2.1: Upload button disabled until photo selected */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !!error || isUploading} // AC-6.2.1: Disabled until photo selected
              className="flex-1 px-4 py-2 text-sm text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload Photo'}
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

      {/* Toast Notification - AC-6.2.8, AC-6.2.9, AC-6.2.13 */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-lg shadow-lg transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-green-100 border border-green-200 text-green-800'
              : toast.type === 'error'
                ? 'bg-red-100 border border-red-200 text-red-800'
                : 'bg-yellow-100 border border-yellow-200 text-yellow-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {toast.type === 'success' ? (
              <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.action && (
                <button
                  onClick={toast.action.onClick}
                  className="mt-2 text-sm font-semibold underline hover:no-underline"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setToast(null);
                if (toast.type === 'error') clearError();
                if (toast.type === 'warning') clearStorageWarning();
              }}
              className="p-1 rounded-full hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
