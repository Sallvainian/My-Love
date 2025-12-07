/**
 * MessageInput Component
 *
 * Text input field for sending love notes with:
 * - Optimistic updates via sendNote action
 * - Character counter (visible at 900+ chars)
 * - Auto-resize textarea
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

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ImageIcon } from 'lucide-react';
import { useLoveNotes } from '../../hooks/useLoveNotes';
import { useVibration } from '../../hooks/useVibration';
import { validateMessageContent, sanitizeMessageContent } from '../../utils/messageValidation';
import { imageCompressionService } from '../../services/imageCompressionService';
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

  const { sendNote } = useLoveNotes();
  const { vibrate } = useVibration();

  // Auto-resize textarea as content grows
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
      console.log('[MessageInput] Large file warning:', validation.warning);
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

      // Show error message to user
      setImageError('Failed to send. Try again.');

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
  let counterColor = 'text-gray-500'; // Default (900-949)
  if (isOverLimit) {
    counterColor = 'text-red-500 font-semibold'; // Over limit (1001+)
  } else if (isNearLimit) {
    counterColor = 'text-yellow-600 font-medium'; // Warning (950-1000)
  }

  // Determine if send button should be disabled
  // Can send if: (valid text OR image) AND not currently sending
  const hasValidContent = content.trim().length > 0 && !isOverLimit;
  const hasImage = selectedImage !== null;
  const canSend = (hasValidContent || hasImage) && !isSending;
  const isDisabled = !canSend;

  return (
    <div className="flex flex-col gap-2 p-4 bg-white border-t border-gray-200 relative z-10 shrink-0">
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
        <div
          className={`text-sm text-right ${counterColor}`}
          aria-live="polite"
        >
          {characterCount}/{MAX_CHARACTERS}
        </div>
      )}

      {/* Input row with image button, textarea, and send button */}
      <div className="flex gap-2 items-end">
        {/* Image picker button */}
        <button
          type="button"
          onClick={handleImageButtonClick}
          disabled={isSending}
          aria-label="Attach image"
          className="p-2 text-gray-500 hover:text-coral-500 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ImageIcon size={24} />
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
          placeholder={selectedImage ? "Add a caption..." : "Send a love note..."}
          aria-label="Love note message input"
          disabled={isSending}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-h-[200px] overflow-y-auto"
          rows={1}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isDisabled}
          aria-label="Send message"
          className="px-6 py-2 bg-coral-500 text-white font-medium rounded-lg hover:bg-coral-600 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-coral-500 transition-colors min-h-[44px]"
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Error messages */}
      {imageError && (
        <div className="text-sm text-red-500" role="alert">
          {imageError}
        </div>
      )}
      {content.length > 0 && isOverLimit && (
        <div className="text-sm text-red-500" role="alert">
          Message is too long (max {MAX_CHARACTERS} characters)
        </div>
      )}
    </div>
  );
}
