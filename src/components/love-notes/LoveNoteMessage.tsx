/**
 * LoveNoteMessage Component
 *
 * Single chat bubble component for Love Notes.
 * Displays message content with sender name and timestamp.
 *
 * Styling:
 * - Own messages: coral background (#FF6B6B), right-aligned
 * - Partner messages: light gray background (#E9ECEF), left-aligned
 * - Border radius: 16px for soft bubbles
 *
 * Story 2.1: AC-2.1.1 (message styling), AC-2.1.2 (timestamp display)
 */

import { memo, type ReactElement, useMemo } from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { formatMessageTimestamp, formatFullTimestamp } from '../../utils/dateFormatters';
import type { LoveNote } from '../../types/models';

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
 */
function LoveNoteMessageComponent({
  message,
  isOwnMessage,
  senderName,
  onRetry,
}: LoveNoteMessageProps): ReactElement {
  const formattedTime = formatMessageTimestamp(message.created_at);
  const fullTimestamp = formatFullTimestamp(message.created_at);

  // Story 2.4 Code Review: XSS sanitization - strip all HTML tags, keep text only
  const sanitizedContent = useMemo(
    () => DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [], KEEP_CONTENT: true }),
    [message.content]
  );

  // Determine sending/error states
  const isSending = message.sending ?? false;
  const hasError = message.error ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col mb-3 px-4 ${isOwnMessage ? 'items-end' : 'items-start'}`}
      role="listitem"
      aria-label={`Message from ${senderName} at ${fullTimestamp}`}
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
          max-w-[80%] px-4 py-3 rounded-2xl
          ${
            isOwnMessage
              ? 'bg-[#FF6B6B] text-white rounded-br-md'
              : 'bg-[#E9ECEF] text-gray-800 rounded-bl-md'
          }
          ${isSending ? 'opacity-70' : ''}
          ${hasError ? 'border-2 border-red-500' : ''}
        `}
      >
        <p className="text-base leading-relaxed break-words">{sanitizedContent}</p>
      </div>

      {/* Status indicators */}
      {isSending && (
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
  );
}

// Memoize to prevent unnecessary re-renders
export const LoveNoteMessage = memo(LoveNoteMessageComponent);

export default LoveNoteMessage;
