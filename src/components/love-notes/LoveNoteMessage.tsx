/**
 * LoveNoteMessage Component
 *
 * Single chat bubble component for Love Notes.
 * Displays message content with sender name and timestamp.
 * Supports image attachments with inline display and full-screen viewer.
 *
 * Styling:
 * - Own messages: coral background (#FF6B6B), right-aligned
 * - Partner messages: light gray background (#E9ECEF), left-aligned
 * - Border radius: 16px for soft bubbles
 *
 * Story 2.1: AC-2.1.1 (message styling), AC-2.1.2 (timestamp display)
 * Love Notes Images: AC-7 (inline display), AC-9 (full-screen view)
 */

import { memo, type ReactElement, useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { Loader2 } from 'lucide-react';
import { formatMessageTimestamp, formatFullTimestamp } from '../../utils/dateFormatters';
import type { LoveNote } from '../../types/models';
import { getSignedImageUrl } from '../../services/loveNoteImageService';
import { FullScreenImageViewer } from './FullScreenImageViewer';

export interface LoveNoteMessageProps {
  /** The love note message data */
  message: LoveNote;
  /** Whether this message was sent by the current user */
  isOwnMessage: boolean;
  /** Display name for the sender */
  senderName: string;
  /** Callback when user clicks retry on a failed message (Story 2.2) */
  onRetry?: (tempId: string) => void;
}

/**
 * LoveNoteMessage - Chat bubble for a single love note
 *
 * Features:
 * - Visual distinction between own and partner messages
 * - Friendly timestamp display
 * - Optimistic update indicator (sending state)
 * - Error state display
 * - Animated entrance
 * - Accessible with proper ARIA labels
 * - Image display with loading/error states
 * - Full-screen image viewer on tap
 */
function LoveNoteMessageComponent({
  message,
  isOwnMessage,
  senderName,
  onRetry,
}: LoveNoteMessageProps): ReactElement {
  const formattedTime = formatMessageTimestamp(message.created_at);
  const fullTimestamp = formatFullTimestamp(message.created_at);

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

  // Story 2.4 Code Review: XSS sanitization - strip all HTML tags, keep text only
  const sanitizedContent = useMemo(
    () => DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [], KEEP_CONTENT: true }),
    [message.content]
  );

  // Determine sending/error states
  const isSending = message.sending ?? false;
  const hasError = message.error ?? false;
  const isImageUploading = message.imageUploading ?? false;

  // Check if message has an image (either from server or optimistic preview)
  const hasImage = !!(message.image_url || message.imagePreviewUrl);

  // Fetch signed URL for server-stored images
  useEffect(() => {
    // Use preview URL for optimistic display
    if (message.imagePreviewUrl) {
      setImageUrl(message.imagePreviewUrl);
      return;
    }

    // Fetch signed URL for server images
    if (message.image_url) {
      let isMounted = true;
      setImageLoading(true);
      setImageError(false);

      getSignedImageUrl(message.image_url)
        .then(({ url }) => {
          if (isMounted) {
            setImageUrl(url);
            setImageLoading(false);
          }
        })
        .catch((error) => {
          console.error('[LoveNoteMessage] Failed to get signed URL:', error);
          if (isMounted) {
            setImageError(true);
            setImageLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [message.image_url, message.imagePreviewUrl]);

  // Retry fetching signed URL on 403 error (force refresh to bypass cache)
  const handleImageError = useCallback(async () => {
    if (message.image_url && !message.imagePreviewUrl) {
      console.log('[LoveNoteMessage] Image load failed, forcing URL refresh');
      try {
        // Force refresh to get a new URL (the cached one may have expired)
        const { url } = await getSignedImageUrl(message.image_url, true);
        setImageUrl(url);
        setImageError(false);
      } catch {
        setImageError(true);
      }
    } else {
      setImageError(true);
    }
  }, [message.image_url, message.imagePreviewUrl]);

  // Open full-screen viewer
  const handleImageClick = () => {
    if (imageUrl && !imageError) {
      setShowFullScreen(true);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex flex-col mb-3 px-4 ${isOwnMessage ? 'items-end' : 'items-start'}`}
        role="listitem"
        aria-label={`Message from ${senderName} at ${fullTimestamp}`}
        data-testid="love-note-message"
      >
        {/* Sender name and timestamp caption */}
        <span
          className={`text-xs text-gray-500 mb-1 px-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}
        >
          {senderName} · {formattedTime}
        </span>

        {/* Message bubble */}
        <div
          className={`
            max-w-[80%] rounded-2xl overflow-hidden
            ${
              isOwnMessage
                ? 'bg-[#FF6B6B] text-white rounded-br-md'
                : 'bg-[#E9ECEF] text-gray-800 rounded-bl-md'
            }
            ${isSending ? 'opacity-70' : ''}
            ${hasError ? 'border-2 border-red-500' : ''}
          `}
        >
          {/* Image (displayed above text if both present) */}
          {hasImage && (
            <div className="relative">
              {imageLoading && (
                <div className="w-full h-48 flex items-center justify-center bg-gray-200">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              )}

              {imageError && (
                <div className="w-full h-32 flex items-center justify-center bg-gray-200 text-gray-500 text-sm">
                  Failed to load image
                </div>
              )}

              {imageUrl && !imageLoading && !imageError && (
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="block w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-inset"
                  aria-label="View image full screen"
                >
                  <img
                    src={imageUrl}
                    alt="Attached image"
                    className="w-full max-h-64 object-cover"
                    onError={handleImageError}
                    loading="lazy"
                  />
                </button>
              )}

              {/* Image uploading overlay */}
              {isImageUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-white text-sm">
                    <Loader2 className="animate-spin" size={16} />
                    <span>Uploading...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text content (only if not empty) */}
          {sanitizedContent && (
            <div className="px-4 py-3">
              <p className="text-base leading-relaxed break-words">{sanitizedContent}</p>
            </div>
          )}
        </div>

        {/* Status indicators */}
        {isSending && !isImageUploading && (
          <span className="text-xs text-gray-400 mt-1 px-1" aria-live="polite">
            Sending...
          </span>
        )}
        {hasError && (
          <button
            onClick={() => onRetry?.(message.tempId || message.id)}
            className="text-xs text-red-500 mt-1 px-1 hover:text-red-700 hover:underline cursor-pointer flex items-center gap-1"
            aria-live="assertive"
            aria-label="Retry sending message"
          >
            Failed to send · Tap to retry
          </button>
        )}
      </motion.div>

      {/* Full-screen image viewer */}
      <FullScreenImageViewer
        imageUrl={imageUrl}
        isOpen={showFullScreen}
        onClose={() => setShowFullScreen(false)}
        alt="Love note image"
      />
    </>
  );
}

// Memoize to prevent unnecessary re-renders
export const LoveNoteMessage = memo(LoveNoteMessageComponent);

export default LoveNoteMessage;
