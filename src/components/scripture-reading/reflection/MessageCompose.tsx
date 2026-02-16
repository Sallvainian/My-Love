/**
 * MessageCompose — Presentational component for partner message composition
 *
 * Story 2.3: Daily Prayer Report — Send & View (AC: #1)
 *
 * Features:
 * - "Write something for [Partner Name]" heading
 * - Textarea: max 300 chars, auto-grow, resize-none
 * - Character counter at 250+ chars
 * - Send button (primary, full-width)
 * - Skip button (tertiary, no-guilt language)
 * - Keyboard handling: scroll into view on focus
 * - Disabled prop gates both buttons
 * - Focus moves to textarea on mount (configurable by parent)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ReactElement } from 'react';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';
const MAX_MESSAGE_LENGTH = 300;
const CHAR_COUNTER_THRESHOLD = 250;

interface MessageComposeProps {
  partnerName: string;
  onSend: (message: string) => void;
  onSkip: () => void;
  disabled: boolean;
  autoFocusTextarea?: boolean;
}

export function MessageCompose({
  partnerName,
  onSend,
  onSkip,
  disabled,
  autoFocusTextarea = true,
}: MessageComposeProps): ReactElement {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    if (!autoFocusTextarea) return;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [autoFocusTextarea]);

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`; // ~6 lines max
    }
  }, [message]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleSend = useCallback(() => {
    if (disabled || message.trim().length === 0) return;
    onSend(message);
  }, [disabled, message, onSend]);

  const handleSkip = useCallback(() => {
    if (disabled) return;
    onSkip();
  }, [disabled, onSkip]);

  const isEmpty = message.trim().length === 0;

  return (
    <div
      className="flex w-full flex-col space-y-6"
      data-testid="scripture-message-compose-screen"
    >
      <h2
        className="text-center font-serif text-2xl font-bold text-purple-900"
        data-testid="scripture-message-compose-heading"
        tabIndex={-1}
      >
        Write something for {partnerName}
      </h2>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Share what's on your heart (optional)"
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message to partner"
          enterKeyHint="send"
          data-testid="scripture-message-textarea"
          className={`min-h-[120px] w-full resize-none rounded-2xl border border-purple-200/50 bg-white/80 p-4 text-purple-900 backdrop-blur-sm placeholder:text-purple-300 ${FOCUS_RING}`}
        />
        {message.length >= CHAR_COUNTER_THRESHOLD && (
          <span
            className="absolute bottom-2 right-3 text-xs text-gray-400"
            data-testid="scripture-message-char-count"
            aria-live="polite"
          >
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled}
        aria-disabled={isEmpty || disabled}
        data-testid="scripture-message-send-btn"
        className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 ${FOCUS_RING} ${
          isEmpty ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        Send
      </button>

      {/* Skip button — no-guilt language */}
      <button
        type="button"
        onClick={handleSkip}
        disabled={disabled}
        data-testid="scripture-message-skip-btn"
        className={`text-sm text-purple-500 underline ${FOCUS_RING}`}
      >
        Skip for now
      </button>
    </div>
  );
}
