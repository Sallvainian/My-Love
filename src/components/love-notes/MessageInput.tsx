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
 *
 * Story 2.2 - AC-2.2.1, AC-2.2.2
 *
 * @module components/love-notes/MessageInput
 */

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useLoveNotes } from '../../hooks/useLoveNotes';
import { useVibration } from '../../hooks/useVibration';
import { validateMessageContent } from '../../utils/messageValidation';

const MAX_CHARACTERS = 1000;
const SHOW_COUNTER_AT = 900;

/**
 * MessageInput - Text input with send button for Love Notes
 */
export function MessageInput() {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
   * Validate and send message
   */
  const handleSend = async () => {
    // Validate message
    const validation = validateMessageContent(content);
    if (!validation.valid) {
      return;
    }

    try {
      setIsSending(true);

      // Send message (optimistic update handled in store)
      await sendNote(content);

      // Success vibration (single short pulse)
      vibrate(50);

      // Clear input
      setContent('');
    } catch (error) {
      console.error('Failed to send message:', error);

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

    // Escape key clears input
    if (e.key === 'Escape') {
      e.preventDefault();
      setContent('');
      return;
    }
  };

  /**
   * Handle textarea change
   */
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  // Calculate character count
  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CHARACTERS;
  const showCounter = characterCount >= SHOW_COUNTER_AT;

  // Determine if send button should be disabled
  const validation = validateMessageContent(content);
  const isDisabled = !validation.valid || isSending;

  return (
    <div className="flex flex-col gap-2 p-4 bg-white border-t border-gray-200">
      {/* Character counter (visible at 900+ chars) */}
      {showCounter && (
        <div
          className={`text-sm text-right ${
            isOverLimit ? 'text-red-500 font-semibold' : 'text-gray-500'
          }`}
          aria-live="polite"
        >
          {characterCount}/{MAX_CHARACTERS}
        </div>
      )}

      {/* Input and send button */}
      <div className="flex gap-2 items-end">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Send a love note..."
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

      {/* Error message (if validation fails) */}
      {!validation.valid && content.length > 0 && (
        <div className="text-sm text-red-500" role="alert">
          {validation.error}
        </div>
      )}
    </div>
  );
}
