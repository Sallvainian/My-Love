/**
 * ReflectionSummary — Presentational component for end-of-session reflection
 *
 * Story 2.2: End-of-Session Reflection Summary (AC: #1, #2, #3)
 *
 * Features:
 * - Displays bookmarked verses as selectable chips (multi-select)
 * - No-bookmark fallback message
 * - Session-level rating scale (1-5) matching PerStepReflection pattern
 * - Optional note textarea (max 200 chars, auto-grow)
 * - Continue button: aria-disabled until requirements met
 * - Quiet validation messages
 * - Keyboard navigation within rating radiogroup
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';
const MAX_NOTE_LENGTH = 200;
const CHAR_COUNTER_THRESHOLD = 150;

interface BookmarkedVerse {
  stepIndex: number;
  verseReference: string;
  verseText: string;
}

export interface ReflectionSummarySubmission {
  standoutVerses: number[];
  rating: number;
  notes: string;
  shareBookmarkedVerses: boolean;
}

interface ReflectionSummaryProps {
  bookmarkedVerses: BookmarkedVerse[];
  onSubmit: (data: ReflectionSummarySubmission) => void;
  disabled?: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Rating 1 of 5: A little',
  2: 'Rating 2 of 5',
  3: 'Rating 3 of 5',
  4: 'Rating 4 of 5',
  5: 'Rating 5 of 5: A lot',
};

export function ReflectionSummary({
  bookmarkedVerses,
  onSubmit,
  disabled = false,
}: ReflectionSummaryProps): React.JSX.Element {
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [shareBookmarkedVerses, setShareBookmarkedVerses] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ratingRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const hasBookmarks = bookmarkedVerses.length > 0;

  // Focus heading on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      headingRef.current?.focus();
    });
  }, []);

  const handleVerseToggle = useCallback((stepIndex: number) => {
    setSelectedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  }, []);

  const handleRatingSelect = useCallback((rating: number) => {
    setSelectedRating(rating);
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

  const isComplete = hasBookmarks
    ? selectedVerses.size > 0 && selectedRating !== null
    : selectedRating !== null;

  const handleContinueClick = useCallback(() => {
    if (disabled) return;
    if (!isComplete) {
      setShowValidation(true);
      return;
    }
    onSubmit({
      standoutVerses: Array.from(selectedVerses).sort((a, b) => a - b),
      rating: selectedRating!,
      notes,
      shareBookmarkedVerses,
    });
  }, [disabled, isComplete, selectedVerses, selectedRating, notes, onSubmit, shareBookmarkedVerses]);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  }, [notes]);

  // Build validation messages
  const validationMessages: string[] = [];
  if (showValidation) {
    if (hasBookmarks && selectedVerses.size === 0) {
      validationMessages.push('Please select a standout verse');
    }
    if (selectedRating === null) {
      validationMessages.push('Please select a rating');
    }
  }

  return (
    <div
      className="flex w-full flex-col space-y-6"
      data-testid="scripture-reflection-summary-screen"
    >
      {/* Section heading */}
      <h2
        ref={headingRef}
        className="text-center font-serif text-2xl font-bold text-purple-900"
        data-testid="scripture-reflection-summary-heading"
        tabIndex={-1}
      >
        Your Session
      </h2>

      {/* Bookmarked Verses Section */}
      {hasBookmarks ? (
        <div className="flex flex-col space-y-3">
          <h3 className="text-center text-sm font-medium text-purple-700">
            Verses that stood out
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {bookmarkedVerses.map((verse) => {
              const isSelected = selectedVerses.has(verse.stepIndex);
              return (
                <button
                  key={verse.stepIndex}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleVerseToggle(verse.stepIndex)}
                  disabled={disabled}
                  data-testid={`scripture-standout-verse-${verse.stepIndex}`}
                  className={`min-h-[48px] min-w-[48px] rounded-full border-2 px-4 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                      : 'border-purple-200 bg-white/80 text-purple-600 hover:border-purple-400'
                  } ${FOCUS_RING}`}
                >
                  {verse.verseReference}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p
          className="text-center text-sm text-purple-500"
          data-testid="scripture-no-bookmarks-message"
        >
          You didn&apos;t mark any verses — that&apos;s okay
        </p>
      )}

      <label
        className="flex items-center justify-between rounded-2xl border border-purple-200/60 bg-white/70 px-4 py-3 text-sm text-purple-800"
        data-testid="scripture-share-bookmarks-toggle-label"
      >
        <span>Share bookmarked verses with your partner</span>
        <input
          type="checkbox"
          checked={shareBookmarkedVerses}
          onChange={(e) => setShareBookmarkedVerses(e.target.checked)}
          disabled={disabled}
          aria-label="Share bookmarked verses with your partner"
          data-testid="scripture-share-bookmarks-toggle"
          className="h-5 w-5 accent-purple-600"
        />
      </label>

      {/* Session Rating Scale */}
      <div className="flex flex-col items-center space-y-3">
        <p className="text-center text-sm font-medium text-purple-700">
          How meaningful was this session for you today?
        </p>
        <div className="flex flex-col items-center space-y-2">
          <div
            role="radiogroup"
            aria-label="How meaningful was this session for you today?"
            data-testid="scripture-session-rating-group"
            className="flex items-center gap-2"
            onKeyDown={handleKeyDown}
          >
            <span className="text-xs text-purple-500">A little</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                ref={(el) => { ratingRefs.current[n - 1] = el; }}
                type="button"
                role="radio"
                aria-checked={selectedRating === n}
                aria-label={RATING_LABELS[n]}
                tabIndex={selectedRating === n || (selectedRating === null && n === 1) ? 0 : -1}
                data-testid={`scripture-session-rating-${n}`}
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
            <span className="text-xs text-purple-500">A lot</span>
          </div>
        </div>
      </div>

      {/* Note textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={handleNotesChange}
          placeholder="Reflect on the session as a whole (optional)"
          maxLength={MAX_NOTE_LENGTH}
          aria-label="Optional session reflection note"
          enterKeyHint="done"
          data-testid="scripture-session-note"
          className={`min-h-[80px] w-full resize-none rounded-2xl border border-purple-200/50 bg-white/80 p-4 text-purple-900 backdrop-blur-sm placeholder:text-purple-300 ${FOCUS_RING}`}
        />
        {notes.length >= CHAR_COUNTER_THRESHOLD && (
          <span
            className="absolute bottom-2 right-3 text-xs text-gray-400"
            data-testid="scripture-session-note-char-count"
            aria-live="polite"
          >
            {notes.length}/{MAX_NOTE_LENGTH}
          </span>
        )}
      </div>

      {/* Validation messages */}
      {validationMessages.length > 0 && (
        <div
          className="flex flex-col items-center space-y-1 text-sm text-purple-400"
          data-testid="scripture-reflection-summary-validation"
        >
          {validationMessages.map((msg) => (
            <p key={msg}>{msg}</p>
          ))}
        </div>
      )}

      {/* Continue button */}
      <button
        type="button"
        onClick={handleContinueClick}
        disabled={disabled}
        aria-disabled={!isComplete || disabled}
        data-testid="scripture-reflection-summary-continue"
        className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 ${FOCUS_RING} ${
          !isComplete ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        Continue
      </button>
    </div>
  );
}
