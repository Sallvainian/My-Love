/**
 * BookmarkFlag — Presentational component for verse bookmark toggle
 *
 * Story 2.1: Per-Step Reflection System (AC: #1)
 *
 * Features:
 * - Amber filled/outlined icon toggle using Lucide Bookmark
 * - 48x48px minimum touch target
 * - aria-label toggling: "Bookmark this verse" / "Remove bookmark"
 * - aria-pressed reflects bookmark state
 * - 300ms debounce for rapid toggles (last-write-wins)
 */

import { useRef, useCallback } from 'react';
import { Bookmark } from 'lucide-react';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';
const DEBOUNCE_MS = 300;

interface BookmarkFlagProps {
  isBookmarked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function BookmarkFlag({ isBookmarked, onToggle, disabled = false }: BookmarkFlagProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (disabled) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onToggle();
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  }, [onToggle, disabled]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this verse'}
      aria-pressed={isBookmarked}
      data-testid="scripture-bookmark-button"
      className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg p-2 transition-colors ${
        isBookmarked
          ? 'text-amber-400'
          : 'text-purple-400 hover:text-purple-600'
      } ${FOCUS_RING}`}
    >
      <Bookmark
        data-testid="bookmark-icon"
        className="h-6 w-6"
        fill={isBookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
      />
    </button>
  );
}
