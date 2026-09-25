/**
 * MessageInput Component
 *
 * Text input field for sending love notes with:
 * - Optimistic updates via sendNote action
 * - Character counter (visible at 900+ chars)
 * - Textarea that grows with its content
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line, Escape to clear)
 * - Haptic feedback via Vibration API
 * - Validation (max 1000 chars, no empty messages)
 * - Image attachment support (Love Notes Images feature)
 *
 * Story 2.2 - AC-2.2.1, AC-2.2.2
 * Love Notes Images - AC-1 through AC-6, AC-10, AC-11
 *
 * @module components/love-notes/MessageInput
 */

import { AnimatePresence } from 'framer-motion';
import { ImageIcon, Loader2, Send } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useLoveNotes } from '../../hooks/useLoveNotes';
import { useVibration } from '../../hooks/useVibration';
import { imageCompressionService } from '../../services/imageCompressionService';
import { NoteRefusedOfflineError } from '../../stores/slices/notesSlice';
import { logger } from '../../utils/logger';
import { sanitizeMessageContent, validateMessageContent } from '../../utils/messageValidation';
import { ImagePreview } from './ImagePreview';

const MAX_CHARACTERS = 1000;
const SHOW_COUNTER_AT = 900;
const WARN_AT = 950; // Show warning color when approaching limit

// Accepted image types for file picker
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * MessageInput - Text input with send button and image picker for Love Notes
 */
export function MessageInput() {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // autoFetch=false: the LoveNotes container owns the initial fetch and the
  // realtime subscription (useLoveNotes gates both on this flag).
  const { sendNote } = useLoveNotes(false);
  const { vibrate } = useVibration();

  // Grow the textarea with its content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  /**
   * Handle image file selection
   */
  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous error
    setImageError(null);

    // Validate image file
    const validation = imageCompressionService.validateImageFile(file);
    if (!validation.valid) {
      setImageError(validation.error || 'Invalid image file');
      vibrate([100, 50, 100]); // Error haptic
      return;
    }

    // Show warning for large files
    if (validation.warning) {
      logger.debug('[MessageInput] Large file warning:', validation.warning);
    }

    setSelectedImage(file);
    vibrate(30); // Selection haptic

    // Reset file input for re-selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Remove selected image
   */
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageError(null);
  };

  /**
   * Open file picker
   */
  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Validate and send message
   */
  const handleSend = async () => {
    // Need either text content or image
    const hasContent = content.trim().length > 0;
    const hasImage = selectedImage !== null;

    if (!hasContent && !hasImage) {
      return;
    }

    // Validate text content if present
    if (hasContent) {
      const validation = validateMessageContent(content);
      if (!validation.valid) {
        return;
      }
    }

    try {
      setIsSending(true);

      // Sanitize content to prevent XSS attacks
      const sanitizedContent = hasContent ? sanitizeMessageContent(content) : '';

      // Send message with optional image
      await sendNote(sanitizedContent, selectedImage || undefined);

      // Success vibration (single short pulse)
      vibrate(50);

      // Clear input and selected image
      setContent('');
      setSelectedImage(null);
      setImageError(null);
    } catch (error) {
      console.error('Failed to send message:', error);

      // An offline refusal already shows its reason in the page banner, so the
      // composer shows nothing of its own (and drops an earlier failure's text):
      // one message per failure. Every other failure, including a failed save
      // to the offline queue, shows this one.
      setImageError(
        error instanceof NoteRefusedOfflineError ? null : 'Failed to send. Try again.'
      );

      // Error vibration (double pulse pattern)
      vibrate([100, 50, 100]);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter key sends message (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Escape key clears input and image
    if (e.key === 'Escape') {
      e.preventDefault();
      setContent('');
      setSelectedImage(null);
      setImageError(null);
      return;
    }
  };

  /**
   * Handle textarea change
   */
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  // Calculate character count and states
  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CHARACTERS;
  const isNearLimit = characterCount >= WARN_AT && characterCount <= MAX_CHARACTERS;
  const showCounter = characterCount >= SHOW_COUNTER_AT;

  // Determine counter color based on state
  let counterColor = 'text-muted'; // Default (900-949)
  if (isOverLimit) {
    counterColor = 'text-danger font-semibold'; // Over limit (1001+)
  } else if (isNearLimit) {
    counterColor = 'text-ink font-medium'; // Warning (950-1000)
  }

  // Determine if send button should be disabled
  // Can send if: (valid text OR image) AND not currently sending
  const hasValidContent = content.trim().length > 0 && !isOverLimit;
  const hasImage = selectedImage !== null;
  const canSend = (hasValidContent || hasImage) && !isSending;
  const isDisabled = !canSend;

  return (
    // Transparent over the page ground, as the kit artboard draws it: the
    // composer is a row of kit controls, not a bar of its own.
    <div className="relative z-10 flex shrink-0 flex-col gap-2 px-4 pt-2 pb-3">
      {/* Image preview (when image selected) */}
      <AnimatePresence>
        {selectedImage && (
          <ImagePreview
            file={selectedImage}
            onRemove={handleRemoveImage}
            isCompressing={isSending}
          />
        )}
      </AnimatePresence>

      {/* Character counter (visible at 900+ chars) */}
      {showCounter && (
        <div className={`text-right text-sm ${counterColor}`} aria-live="polite">
          {characterCount}/{MAX_CHARACTERS}
        </div>
      )}

      {/* Input row with image button, textarea, and send button */}
      <div className="flex items-end gap-2">
        {/* Image picker button */}
        <button
          type="button"
          onClick={handleImageButtonClick}
          disabled={isSending}
          aria-label="Attach image"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card2 text-muted transition-colors hover:text-accent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageIcon size={20} aria-hidden="true" />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={handleImageSelect}
          className="hidden"
          aria-hidden="true"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={selectedImage ? 'Add a caption...' : 'Send a love note...'}
          aria-label="Love note message input"
          disabled={isSending}
          className="max-h-50 min-h-11 flex-1 resize-none overflow-y-auto rounded-[22px] bg-card px-4 py-2.75 text-base leading-5.5 text-ink ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-accent focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
          rows={1}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isDisabled}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill text-white transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 size={19} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={19} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Error messages */}
      {imageError && (
        <div className="text-sm text-danger" role="alert">
          {imageError}
        </div>
      )}
      {content.length > 0 && isOverLimit && (
        <div className="text-sm text-danger" role="alert">
          Message is too long (max {MAX_CHARACTERS} characters)
        </div>
      )}
    </div>
  );
}
