import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Photo } from '../../types';
import { isValidationError } from '../../validation/errorMessages';

interface PhotoEditModalProps {
  photo: Photo;
  onClose: () => void;
  onSave: (photoId: number, updates: { caption?: string; tags: string[] }) => Promise<void>;
}

/**
 * Photo Edit Modal Component
 * Story 4.4: AC-4.4.1, AC-4.4.2, AC-4.4.3
 *
 * Features:
 * - Modal overlay (z-index: 60, above carousel z-index: 50)
 * - Photo thumbnail preview (max 200px height)
 * - Caption textarea with character counter (max 500 chars)
 * - Tags input field with validation (max 10 tags, max 50 chars per tag)
 * - Save button (enabled when validation passes AND changes made)
 * - Cancel button (discards changes)
 * - Backdrop click or X button closes modal without saving
 */
export function PhotoEditModal({ photo, onClose, onSave }: PhotoEditModalProps) {
  // Form state
  const [caption, setCaption] = useState(photo.caption || '');
  const [tagsInput, setTagsInput] = useState(photo.tags.join(', '));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation state
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);

  // Create blob URL for photo preview
  const [imageUrl, setImageUrl] = useState('');

   
  useEffect(() => {
    if (photo.imageBlob) {
      const url = URL.createObjectURL(photo.imageBlob);
      setImageUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [photo.imageBlob]);

  // Validate caption (max 500 characters)
   
  useEffect(() => {
    if (caption.length > 500) {
      setCaptionError(`Caption is too long (${caption.length}/500 characters)`);
    } else {
      setCaptionError(null);
    }
  }, [caption]);

  // Validate tags (max 10 tags, max 50 chars per tag)
   
  useEffect(() => {
    if (!tagsInput.trim()) {
      setTagsError(null);
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (tags.length > 10) {
      setTagsError(`Too many tags (${tags.length}/10 max)`);
      return;
    }

    const longTags = tags.filter((tag) => tag.length > 50);
    if (longTags.length > 0) {
      setTagsError(
        `Some tags are too long (max 50 characters): ${longTags[0].substring(0, 20)}...`
      );
      return;
    }

    setTagsError(null);
  }, [tagsInput]);

  // Check if form has changes
  const hasChanges = () => {
    const currentTags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const originalTags = photo.tags;

    const captionChanged = caption !== (photo.caption || '');
    const tagsChanged = JSON.stringify(currentTags) !== JSON.stringify(originalTags);

    return captionChanged || tagsChanged;
  };

  // Check if form is valid
  const isValid = () => {
    return !captionError && !tagsError && hasChanges();
  };

  // Handle save
  const handleSave = async () => {
    if (!isValid()) return;

    try {
      setIsSaving(true);
      setError(null);

      // Parse tags
      const parsedTags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .filter(
          (tag, index, arr) =>
            // Case-insensitive duplicate detection
            arr.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) === index
        )
        .slice(0, 10) // Max 10 tags
        .map((tag) => tag.slice(0, 50)); // Max 50 chars per tag

      await onSave(photo.id, {
        caption: caption || undefined,
        tags: parsedTags,
      });

      onClose();
    } catch (err) {
      console.error('[PhotoEditModal] Failed to save photo:', err);

      // Handle validation errors with field-specific messages
      if (isValidationError(err)) {
        const fieldErrors = err.fieldErrors;

        // Set field-specific errors
        if (fieldErrors.has('caption')) {
          setCaptionError(fieldErrors.get('caption') || null);
        }
        if (fieldErrors.has('tags')) {
          setTagsError(fieldErrors.get('tags') || null);
        }

        // Set general error message
        setError(err.message);
      } else {
        setError('Failed to save changes. Please try again.');
      }

      setIsSaving(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
      onClick={handleBackdropClick}
      data-testid="photo-edit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-edit-modal-title"
    >
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 id="photo-edit-modal-title" className="text-xl font-semibold text-white">
            Edit Photo
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close modal"
            data-testid="photo-edit-modal-close-button"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Photo Preview */}
          <div className="flex justify-center">
            <img
              src={imageUrl}
              alt={photo.caption || `Photo ${photo.id}`}
              className="max-h-[200px] max-w-full object-contain rounded-lg"
              data-testid="photo-edit-modal-preview"
            />
          </div>

          {/* Caption Field */}
          <div>
            <label htmlFor="photo-caption" className="block text-sm font-medium text-gray-300 mb-2">
              Caption
            </label>
            <textarea
              id="photo-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg border ${
                captionError ? 'border-red-500' : 'border-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
              rows={4}
              maxLength={500}
              aria-label="Photo caption"
              data-testid="photo-edit-modal-caption-input"
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-sm ${captionError ? 'text-red-400' : 'text-gray-400'}`}>
                {captionError || `${caption.length} / 500 characters`}
              </span>
            </div>
          </div>

          {/* Tags Field */}
          <div>
            <label htmlFor="photo-tags" className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <input
              id="photo-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="beach, sunset, memories"
              className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg border ${
                tagsError ? 'border-red-500' : 'border-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              aria-label="Photo tags (comma-separated)"
              data-testid="photo-edit-modal-tags-input"
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-sm ${tagsError ? 'text-red-400' : 'text-gray-400'}`}>
                {tagsError || 'Separate tags with commas (max 10 tags)'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="px-4 py-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200"
              data-testid="photo-edit-modal-error"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Cancel without saving"
            data-testid="photo-edit-modal-cancel-button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid() || isSaving}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isValid() && !isSaving
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            aria-label="Save changes"
            data-testid="photo-edit-modal-save-button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
