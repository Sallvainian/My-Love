import { useState, useRef } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Camera, Loader } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

interface PhotoUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadStep = 'select' | 'preview' | 'uploading' | 'success' | 'error';

export function PhotoUpload({ isOpen, onClose }: PhotoUploadProps) {
  const { uploadPhoto, storageWarning } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string>('');
  const [warning, setWarning] = useState<string>('');

  const maxCaptionLength = 500;
  const remainingCaptionChars = maxCaptionLength - caption.length;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setWarning('');

    // Validate file type (defense-in-depth)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (prevent huge files)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);

    // Create preview URL - safe from XSS as it's a browser-generated blob URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setStep('preview');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setStep('uploading');
      setError('');

      // Load the image to get dimensions
      const img = new Image();
      const imageUrl = URL.createObjectURL(selectedFile);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      const input = {
        file: selectedFile,
        filename: selectedFile.name,
        caption: caption.trim() || undefined,
        mimeType: selectedFile.type as 'image/jpeg' | 'image/png' | 'image/webp',
        width: img.naturalWidth,
        height: img.naturalHeight,
      };

      URL.revokeObjectURL(imageUrl);

      await uploadPhoto(input);

      setStep('success');

      // Auto-close after showing success (AC-4.1.8: 3 seconds)
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      console.error('[PhotoUpload] Upload failed:', err);
      setError((err as Error).message || 'Failed to upload photo');
      setStep('error');
    }
  };

  const handleClose = () => {
    // Cleanup preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    // Reset all state
    setStep('select');
    setSelectedFile(null);
    setPreviewUrl('');
    setCaption('');
    setTags('');
    setError('');
    setWarning('');

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    onClose();
  };

  const handleRetry = () => {
    setError('');
    setStep('preview');
  };

  const parsedTags = tags
    ? tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    : [];

  const tagErrors = [];
  if (parsedTags.length > 10) {
    tagErrors.push('Maximum 10 tags allowed');
  }
  const tooLongTags = parsedTags.filter((tag) => tag.length > 50);
  if (tooLongTags.length > 0) {
    tagErrors.push(`Tag too long (max 50 characters): "${tooLongTags[0].substring(0, 20)}..."`);
  }

  const isFormValid = selectedFile && tagErrors.length === 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
            data-testid="photo-upload-backdrop"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              data-testid="photo-upload-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Upload Photo</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {step === 'select' && 'Select a photo to upload'}
                    {step === 'preview' && 'Add details and upload'}
                    {step === 'uploading' && 'Compressing and saving...'}
                    {step === 'success' && 'Photo uploaded successfully!'}
                    {step === 'error' && 'Upload failed'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                  data-testid="photo-upload-close"
                  disabled={step === 'uploading'}
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Storage Warning (AC-4.1.9) */}
                {storageWarning && (
                  <div
                    className="p-4 bg-orange-50 border border-orange-300 rounded-lg flex items-start gap-3"
                    data-testid="storage-warning-banner"
                  >
                    <svg
                      className="w-5 h-5 text-orange-600 shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p className="text-sm text-orange-800 font-medium">{storageWarning}</p>
                  </div>
                )}

                {/* Step: Select */}
                {step === 'select' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="bg-pink-50 rounded-full p-6 mb-6">
                      <Camera className="w-12 h-12 text-pink-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose a Photo</h3>
                    <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
                      Select a JPEG, PNG, or WebP image to upload. We'll compress it to save space.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="photo-upload-file-input"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
                      data-testid="photo-upload-select-button"
                    >
                      <Upload className="w-5 h-5" />
                      Select Photo
                    </button>
                  </div>
                )}

                {/* Step: Preview */}
                {(step === 'preview' || step === 'error') && selectedFile && (
                  <>
                    {/* Photo Preview */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preview
                      </label>
                      <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-auto max-h-[300px] object-contain"
                          data-testid="photo-upload-preview-image"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
                        <span>
                          Original size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <span>
                          Will compress to ~{((selectedFile.size * 0.1) / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>

                    {/* Caption */}
                    <div>
                      <label
                        htmlFor="photo-caption"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Caption (optional)
                      </label>
                      <textarea
                        id="photo-caption"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Add a caption to your photo..."
                        maxLength={maxCaptionLength}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                        data-testid="photo-upload-caption-input"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-sm text-gray-500">Supports emoji and multiple lines</p>
                        <p
                          className={`text-sm ${remainingCaptionChars < 50 ? 'text-orange-500' : 'text-gray-500'}`}
                        >
                          {remainingCaptionChars} characters remaining
                        </p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label
                        htmlFor="photo-tags"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Tags (optional)
                      </label>
                      <input
                        id="photo-tags"
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="beach, sunset, memories"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        data-testid="photo-upload-tags-input"
                      />
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-500">
                          Comma-separated, max 10 tags, 50 characters each
                        </p>
                        {parsedTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {parsedTags.slice(0, 10).map((tag, index) => (
                              <span
                                key={index}
                                className={`px-2 py-1 text-xs rounded-full ${
                                  tag.length > 50
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-pink-100 text-pink-700'
                                }`}
                                data-testid={`photo-upload-tag-${index}`}
                              >
                                {tag.length > 50 ? `${tag.substring(0, 20)}...` : tag}
                              </span>
                            ))}
                            {parsedTags.length > 10 && (
                              <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
                                +{parsedTags.length - 10} more (max 10)
                              </span>
                            )}
                          </div>
                        )}
                        {tagErrors.length > 0 && (
                          <div className="space-y-1">
                            {tagErrors.map((err, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600"
                                data-testid="photo-upload-tag-error"
                              >
                                {err}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                      <div
                        className="p-4 bg-red-50 border border-red-200 rounded-lg"
                        data-testid="photo-upload-error"
                      >
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                      </div>
                    )}

                    {/* Warning Display */}
                    {warning && (
                      <div
                        className="p-4 bg-orange-50 border border-orange-200 rounded-lg"
                        data-testid="photo-upload-warning"
                      >
                        <p className="text-sm text-orange-700">{warning}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleClose}
                        className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        data-testid="photo-upload-cancel"
                      >
                        Cancel
                      </button>
                      {step === 'error' && (
                        <button
                          onClick={handleRetry}
                          className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
                          data-testid="photo-upload-retry"
                        >
                          Retry
                        </button>
                      )}
                      {step === 'preview' && (
                        <button
                          onClick={handleUpload}
                          disabled={!isFormValid}
                          className="flex items-center gap-2 px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid="photo-upload-submit-button"
                        >
                          <Upload className="w-5 h-5" />
                          Upload
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Step: Uploading */}
                {step === 'uploading' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader className="w-12 h-12 text-pink-500 animate-spin mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Compressing & Saving...
                    </h3>
                    <p className="text-sm text-gray-500">This may take a moment</p>
                  </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="bg-green-50 rounded-full p-6 mb-6">
                      <svg
                        className="w-12 h-12 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Photo uploaded! ✨</h3>
                    <p className="text-sm text-gray-500">Your photo has been saved</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
