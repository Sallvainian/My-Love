/**
 * PerStepReflection — Presentational component for post-step reflection
 *
 * Story 2.1: Per-Step Reflection System (AC: #2, #4)
 *
 * Features:
 * - 1–5 rating scale with numbered circles in a radiogroup
 * - End labels: "A little" (1) and "A lot" (5)
 * - Prompt: "How meaningful was this for you today?"
 * - Optional note textarea (max 200 chars, auto-grow, resize-none)
 * - Character counter visible at 150+ chars (muted style)
 * - Continue button: disabled until rating selected
 * - Quiet validation: "Please select a rating" on Continue tap without rating
 * - Keyboard navigation: arrow keys within radiogroup
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';
const MAX_NOTE_LENGTH = 200;
const CHAR_COUNTER_THRESHOLD = 150;

interface PerStepReflectionProps {
  onSubmit: (rating: number, notes: string) => void;
  disabled?: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Rating 1 of 5: A little',
  2: 'Rating 2 of 5',
  3: 'Rating 3 of 5',
  4: 'Rating 4 of 5',
  5: 'Rating 5 of 5: A lot',
};

export function PerStepReflection({ onSubmit, disabled = false }: PerStepReflectionProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ratingRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleRatingSelect = useCallback((rating: number) => {
    setSelectedRating(rating);
    setShowValidation(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      e.preventDefault();
      const current = selectedRating ?? 1;
      let next: number;

      if (e.key === 'ArrowRight') {
        next = current >= 5 ? 1 : current + 1;
      } else {
        next = current <= 1 ? 5 : current - 1;
      }

      setSelectedRating(next);
      setShowValidation(false);
      ratingRefs.current[next - 1]?.focus();
    },
    [selectedRating]
  );

  const handleContinueClick = useCallback(() => {
    if (!selectedRating) {
      setShowValidation(true);
      return;
    }
    onSubmit(selectedRating, notes);
  }, [selectedRating, notes, onSubmit]);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`; // ~4 lines max
    }
  }, [notes]);

  return (
    <div
      className="flex w-full flex-col space-y-6"
      data-testid="scripture-reflection-screen"
    >
      {/* Prompt */}
      <h2
        className="text-center font-serif text-lg font-semibold text-purple-900"
        data-testid="scripture-reflection-prompt"
        tabIndex={-1}
      >
        How meaningful was this for you today?
      </h2>

      {/* Rating Scale */}
      <div className="flex flex-col items-center space-y-2">
        <div
          role="radiogroup"
          aria-label="How meaningful was this for you today?"
          data-testid="scripture-rating-group"
          className="flex items-center gap-2"
          onKeyDown={handleKeyDown}
        >
          {/* Low label */}
          <span
            className="text-xs text-purple-500"
            data-testid="scripture-rating-label-low"
          >
            A little
          </span>

          {/* Rating buttons */}
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              ref={(el) => { ratingRefs.current[n - 1] = el; }}
              type="button"
              role="radio"
              aria-checked={selectedRating === n}
              aria-label={RATING_LABELS[n]}
              tabIndex={selectedRating === n || (selectedRating === null && n === 1) ? 0 : -1}
              data-testid={`scripture-rating-${n}`}
              onClick={() => handleRatingSelect(n)}
              disabled={disabled}
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
                selectedRating === n
                  ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                  : 'border-purple-200 bg-white/80 text-purple-600 hover:border-purple-400'
              } ${FOCUS_RING}`}
            >
              {n}
            </button>
          ))}

          {/* High label */}
          <span
            className="text-xs text-purple-500"
            data-testid="scripture-rating-label-high"
          >
            A lot
          </span>
        </div>

        {/* Validation message */}
        {showValidation && (
          <p
            className="text-sm text-purple-400"
            data-testid="scripture-reflection-validation"
          >
            Please select a rating
          </p>
        )}
      </div>

      {/* Note textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={handleNotesChange}
          placeholder="Add a note (optional)"
          maxLength={MAX_NOTE_LENGTH}
          aria-label="Optional reflection note"
          enterKeyHint="done"
          data-testid="scripture-reflection-note"
          className={`min-h-[80px] w-full resize-none rounded-2xl border border-purple-200/50 bg-white/80 p-4 text-purple-900 backdrop-blur-sm placeholder:text-purple-300 ${FOCUS_RING}`}
        />
        {/* Character counter */}
        {notes.length >= CHAR_COUNTER_THRESHOLD && (
          <span
            className="absolute bottom-2 right-3 text-xs text-gray-400"
            data-testid="scripture-reflection-char-count"
            aria-live="polite"
          >
            {notes.length}/{MAX_NOTE_LENGTH}
          </span>
        )}
      </div>

      {/* Continue button — uses aria-disabled instead of disabled so validation click fires */}
      <button
        type="button"
        onClick={handleContinueClick}
        disabled={disabled}
        aria-disabled={!selectedRating || disabled}
        data-testid="scripture-reflection-continue"
        className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 ${FOCUS_RING} ${
          !selectedRating ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        Continue
      </button>
    </div>
  );
}
