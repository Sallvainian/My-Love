import { AnimatePresence, m as motion } from 'framer-motion';
import { AlertTriangle, Camera, Check, Loader, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { useFocusTrap } from '../../hooks';
import { offlineMessage } from '../../services/accountDataError';
import { imageCompressionService } from '../../services/imageCompressionService';
import { useAppStore } from '../../stores/useAppStore';

interface PhotoUploadProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Where focus goes on close when the button that opened this is gone: the
   * empty album's Upload unmounts once the first photo lands, and the gallery
   * header's Upload replaces it.
   */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

type UploadStep = 'select' | 'preview' | 'uploading' | 'success' | 'error';

export function PhotoUpload({ isOpen, onClose, fallbackFocusRef }: PhotoUploadProps) {
  const { uploadPhoto, storageWarning } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Stable key for the currently selected file, held across retries.
   *
   * Retry sends the user back to the preview step and re-runs handleUpload,
   * which previously produced a brand-new storage path each time -- so an
   * upload that had actually committed before the response was lost got
   * duplicated in the gallery. Reusing the key makes the retry resolve to the
   * row and object the first attempt wrote. Reset whenever the selection
   * changes, so a genuinely new file is never mistaken for a retry.
   */
  const uploadKeyRef = useRef<string>('');

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

    // Validate type and size through the compression service so the gate matches
    // what the upload path can actually process (JPEG/PNG/WebP, 25MB)
    const validation = imageCompressionService.validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      // Picking the same file again must fire a change, or the user can only
      // retry by choosing a different file first.
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    if (validation.warning) {
      setWarning(validation.warning);
    }

    setSelectedFile(file);
    uploadKeyRef.current = crypto.randomUUID();

    // Create preview URL - safe from XSS as it's a browser-generated blob URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setStep('preview');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Refused before compressing or sending anything; Retry returns to the
    // preview with the same file and key.
    if (!isOnline()) {
      setError(offlineMessage('Photos', 'upload'));
      setStep('error');
      return;
    }

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

      const result = await imageCompressionService.compressImage(selectedFile);

      const input = {
        file: result.blob,
        filename: selectedFile.name,
        caption: caption.trim() || undefined,
        mimeType: result.blob.type as 'image/jpeg' | 'image/png' | 'image/webp',
        width: result.width || img.naturalWidth,
        height: result.height || img.naturalHeight,
        idempotencyKey: uploadKeyRef.current,
      };

      URL.revokeObjectURL(imageUrl);

      const uploadResult = await uploadPhoto(input);

      if (!uploadResult.success) {
        setError(uploadResult.error || 'Failed to upload photo');
        setStep('error');
        return;
      }

      setStep('success');
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
    uploadKeyRef.current = '';
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

  // An outside tap lands on the full-screen overlay that centres the panel,
  // not on the backdrop beneath it, so the overlay owns the close. Ignored mid-
  // upload, like the disabled close button.
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && step !== 'uploading') {
      handleClose();
    }
  };

  // Escape does what the close button does, and is ignored while it is
  // disabled mid-upload. Read through refs so the handler stays referentially
  // stable: App passes an inline onClose, and a new onEscape would re-run the
  // trap's arming effect on every render, throwing focus back to the close
  // button on each keystroke.
  const modalRef = useRef<HTMLDivElement>(null);
  const handleCloseRef = useRef(handleClose);
  const stepRef = useRef(step);
  useLayoutEffect(() => {
    handleCloseRef.current = handleClose;
    stepRef.current = step;
  });
  const handleEscape = useCallback(() => {
    if (stepRef.current === 'uploading') return;
    handleCloseRef.current();
  }, []);
  useFocusTrap(modalRef, isOpen, { onEscape: handleEscape, fallbackFocusRef });

  // Auto-close after showing success (AC-4.1.8: 3 seconds). Owned by the step,
  // so any close -- which resets the step -- cancels it, and a dialog reopened
  // within the 3 seconds is never closed by the previous upload's timer.
  useEffect(() => {
    if (!isOpen || step !== 'success') return;
    const timer = setTimeout(() => handleCloseRef.current(), 3000);
    return () => clearTimeout(timer);
  }, [isOpen, step]);

  // Every step change unmounts the control that started it -- Select, Upload,
  // Retry -- and a focused element that unmounts blurs to <body>. <body> is an
  // ancestor of the modal, so the trap's keydown listener would never see
  // Escape or Tab again. Hand focus to the step's natural target instead; the
  // container (tabIndex -1) is the fallback for steps with nothing to act on.
  // Declared after useFocusTrap so that on open the trap captures the opener
  // for its focus return before anything here moves focus.
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const modal = modalRef.current;
    if (!isOpen || !modal) return;
    const active = document.activeElement;
    if (active !== modal && modal.contains(active)) return;
    const target =
      step === 'preview' ? captionRef.current : step === 'error' ? retryRef.current : null;
    (target ?? modal).focus();
  }, [isOpen, step]);

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

  // One error block, placed by step: a rejected pick leaves the dialog on the
  // select step, an upload failure on the preview/error steps. The steps are
  // exclusive, so it never renders twice.
  const errorAlert = error ? (
    <div className="rounded-[14px] bg-dtint p-4" role="alert" data-testid="photo-upload-error">
      <p className="text-sm font-medium text-danger">{error}</p>
    </div>
  ) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            data-testid="photo-upload-backdrop"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
            data-testid="photo-upload-overlay"
          >
            <div
              ref={modalRef}
              // tabIndex -1 keeps this container reachable by focus without a
              // tab stop, so the uploading and success steps -- which render no
              // focusable control -- still hold focus where the trap listens.
              tabIndex={-1}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[20px] bg-card shadow-float"
              data-testid="photo-upload-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="photo-upload-title"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <h2 id="photo-upload-title" className="text-lg font-semibold text-ink">
                    Upload Photo
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {step === 'select' && 'Select a photo to upload'}
                    {step === 'preview' && 'Add details and upload'}
                    {step === 'uploading' && 'Compressing and saving...'}
                    {step === 'success' && 'Photo uploaded successfully!'}
                    {step === 'error' && 'Upload failed'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card2 text-muted transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                  aria-label="Close"
                  data-testid="photo-upload-close"
                  disabled={step === 'uploading'}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-6 px-5 py-5">
                {/* Storage Warning (AC-4.1.9) */}
                {storageWarning && (
                  <div
                    className="flex items-start gap-3 rounded-[14px] bg-card2 p-4"
                    data-testid="storage-warning-banner"
                  >
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <p className="text-sm font-medium text-ink">{storageWarning}</p>
                  </div>
                )}

                {/* A file rejected at pick time (DW-202) */}
                {step === 'select' && errorAlert}

                {/* Step: Select */}
                {step === 'select' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-tint text-accent">
                      <Camera className="h-[30px] w-[30px]" aria-hidden="true" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-ink">Choose a Photo</h3>
                    <p className="mb-6 max-w-md text-center text-sm text-muted">
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
                      className="flex h-12 items-center gap-2 rounded-full bg-fill px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      data-testid="photo-upload-select-button"
                    >
                      <Upload className="h-5 w-5" aria-hidden="true" />
                      Select Photo
                    </button>
                  </div>
                )}

                {/* Step: Preview */}
                {(step === 'preview' || step === 'error') && selectedFile && (
                  <>
                    {/* Photo Preview */}
                    <div>
                      <label className="mb-2 block text-[13px] font-semibold text-ink">
                        Preview
                      </label>
                      <div className="relative w-full overflow-hidden rounded-[14px] bg-card2">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="h-auto max-h-[300px] w-full object-contain"
                          data-testid="photo-upload-preview-image"
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-muted">
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
                        className="mb-2 block text-[13px] font-semibold text-ink"
                      >
                        Caption (optional)
                      </label>
                      <textarea
                        ref={captionRef}
                        id="photo-caption"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Add a caption to your photo..."
                        maxLength={maxCaptionLength}
                        rows={3}
                        className="w-full resize-none rounded-[14px] bg-field px-4 text-base text-ink ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-accent focus:outline-none py-3"
                        data-testid="photo-upload-caption-input"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm text-muted">Supports emoji and multiple lines</p>
                        <p
                          className={`text-sm ${remainingCaptionChars < 50 ? 'font-semibold text-ink' : 'text-muted'}`}
                        >
                          {remainingCaptionChars} characters remaining
                        </p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label
                        htmlFor="photo-tags"
                        className="mb-2 block text-[13px] font-semibold text-ink"
                      >
                        Tags (optional)
                      </label>
                      <input
                        id="photo-tags"
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="beach, sunset, memories"
                        className="h-12 w-full rounded-[14px] bg-field px-4 text-base text-ink ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-accent focus:outline-none"
                        data-testid="photo-upload-tags-input"
                      />
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-muted">
                          Comma-separated, max 10 tags, 50 characters each
                        </p>
                        {parsedTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {parsedTags.slice(0, 10).map((tag, index) => (
                              <span
                                key={index}
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  tag.length > 50 ? 'bg-dtint text-danger' : 'bg-tint text-accent'
                                }`}
                                data-testid={`photo-upload-tag-${index}`}
                              >
                                {tag.length > 50 ? `${tag.substring(0, 20)}...` : tag}
                              </span>
                            ))}
                            {parsedTags.length > 10 && (
                              <span className="rounded-full bg-card2 px-2.5 py-1 text-xs font-semibold text-ink">
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
                                className="text-sm text-danger"
                                role="alert"
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
                    {errorAlert}

                    {/* Warning Display */}
                    {warning && (
                      <div
                        className="rounded-[14px] bg-card2 p-4"
                        data-testid="photo-upload-warning"
                      >
                        <p className="text-sm text-ink">{warning}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="-mx-5 flex items-center justify-end gap-3 border-t border-line px-5 pt-4">
                      <button
                        onClick={handleClose}
                        className="h-12 rounded-full bg-tint px-5 text-[15px] font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        data-testid="photo-upload-cancel"
                      >
                        Cancel
                      </button>
                      {step === 'error' && (
                        <button
                          ref={retryRef}
                          onClick={handleRetry}
                          className="h-12 rounded-full bg-fill px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          data-testid="photo-upload-retry"
                        >
                          Retry
                        </button>
                      )}
                      {step === 'preview' && (
                        <button
                          onClick={handleUpload}
                          disabled={!isFormValid}
                          className="flex h-12 items-center gap-2 rounded-full bg-fill px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="photo-upload-submit-button"
                        >
                          <Upload className="h-5 w-5" aria-hidden="true" />
                          Upload
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Step: Uploading */}
                {step === 'uploading' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader className="mb-4 h-12 w-12 animate-spin text-accent" aria-hidden="true" />
                    <h3 className="mb-2 text-lg font-semibold text-ink">
                      Compressing & Saving...
                    </h3>
                    <p className="text-sm text-muted">This may take a moment</p>
                  </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-tint text-accent">
                      <Check className="h-[30px] w-[30px]" aria-hidden="true" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-ink">Photo uploaded!</h3>
                    <p className="text-sm text-muted">Your photo has been saved</p>
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
