import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PhotoWithUrls } from '../../services/photoService';
import type { Photo } from '../../types';
import { isValidationError } from '../../validation/errorMessages';

// Support both IndexedDB Photo (number id) and Supabase PhotoWithUrls (string id)
type PhotoLike = Photo | PhotoWithUrls;

interface PhotoEditModalProps {
  photo: PhotoLike;
  onClose: () => void;
  onSave: (
    photoId: string | number,
    updates: { caption?: string; tags: string[] }
  ) => Promise<void>;
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
  // Form state - handle both Photo (tags array) and PhotoWithUrls (no tags)
  const [caption, setCaption] = useState(photo.caption || '');
  const [tagsInput, setTagsInput] = useState('tags' in photo ? photo.tags.join(', ') : '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server-side validation errors (from API responses)
  const [serverCaptionError, setServerCaptionError] = useState<string | null>(null);
  const [serverTagsError, setServerTagsError] = useState<string | null>(null);

  // Compute client-side validation during render (derived state)
  const clientCaptionError = useMemo(() => {
    if (caption.length > 500) {
      return `Caption is too long (${caption.length}/500 characters)`;
    }
    return null;
  }, [caption]);

  const clientTagsError = useMemo(() => {
    if (!tagsInput.trim()) {
      return null;
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (tags.length > 10) {
      return `Too many tags (${tags.length}/10 max)`;
    }

    const longTags = tags.filter((tag) => tag.length > 50);
    if (longTags.length > 0) {
      return `Some tags are too long (max 50 characters): ${longTags[0].substring(0, 20)}...`;
    }

    return null;
  }, [tagsInput]);

  // Combine client and server errors (client takes precedence for immediate feedback)
  const captionError = clientCaptionError || serverCaptionError;
  const tagsError = clientTagsError || serverTagsError;

  // Photo preview URL - handles both Photo (imageBlob) and PhotoWithUrls (signedUrl)
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const scheduleUrlUpdate = (nextUrl: string) => {
      queueMicrotask(() => {
        if (!cancelled) {
          setImageUrl(nextUrl);
        }
      });
    };

    // PhotoWithUrls has signedUrl
    if ('signedUrl' in photo && photo.signedUrl) {
      scheduleUrlUpdate(photo.signedUrl);
      return () => {
        cancelled = true;
      };
    }

    // Photo has imageBlob
    if ('imageBlob' in photo && photo.imageBlob) {
      objectUrl = URL.createObjectURL(photo.imageBlob);
      scheduleUrlUpdate(objectUrl);
      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }

    scheduleUrlUpdate('');
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photo]);

  // Check if form has changes
  const hasChanges = () => {
    const currentTags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const originalTags = 'tags' in photo ? photo.tags : [];

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
      // Clear server-side errors before new submission
      setServerCaptionError(null);
      setServerTagsError(null);

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

        // Set field-specific server errors
        if (fieldErrors.has('caption')) {
          setServerCaptionError(fieldErrors.get('caption') || null);
        }
        if (fieldErrors.has('tags')) {
          setServerTagsError(fieldErrors.get('tags') || null);
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
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-gray-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 id="photo-edit-modal-title" className="text-xl font-semibold text-white">
            Edit Photo
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-gray-700"
            aria-label="Close modal"
            data-testid="photo-edit-modal-close-button"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-4">
          {/* Photo Preview */}
          <div className="flex justify-center">
            <img
              src={imageUrl}
              alt={photo.caption || `Photo ${photo.id}`}
              className="max-h-[200px] max-w-full rounded-lg object-contain"
              data-testid="photo-edit-modal-preview"
            />
          </div>

          {/* Caption Field */}
          <div>
            <label htmlFor="photo-caption" className="mb-2 block text-sm font-medium text-gray-300">
              Caption
            </label>
            <textarea
              id="photo-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className={`w-full rounded-lg border bg-gray-700 px-4 py-3 text-white ${
                captionError ? 'border-red-500' : 'border-gray-600'
              } resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              rows={4}
              maxLength={500}
              aria-label="Photo caption"
              data-testid="photo-edit-modal-caption-input"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-sm ${captionError ? 'text-red-400' : 'text-gray-400'}`}>
                {captionError || `${caption.length} / 500 characters`}
              </span>
            </div>
          </div>

          {/* Tags Field */}
          <div>
            <label htmlFor="photo-tags" className="mb-2 block text-sm font-medium text-gray-300">
              Tags
            </label>
            <input
              id="photo-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="beach, sunset, memories"
              className={`w-full rounded-lg border bg-gray-700 px-4 py-3 text-white ${
                tagsError ? 'border-red-500' : 'border-gray-600'
              } focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              aria-label="Photo tags (comma-separated)"
              data-testid="photo-edit-modal-tags-input"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-sm ${tagsError ? 'text-red-400' : 'text-gray-400'}`}>
                {tagsError || 'Separate tags with commas (max 10 tags)'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="rounded-lg border border-red-700 bg-red-900/50 px-4 py-3 text-red-200"
              data-testid="photo-edit-modal-error"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700"
            aria-label="Cancel without saving"
            data-testid="photo-edit-modal-cancel-button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid() || isSaving}
            className={`rounded-lg px-6 py-2 font-medium transition-colors ${
              isValid() && !isSaving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'cursor-not-allowed bg-gray-700 text-gray-500'
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
