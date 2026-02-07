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
 * - Pure presentational — debounce handled by container (SoloReadingFlow)
 */

import { Bookmark } from 'lucide-react';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

interface BookmarkFlagProps {
  isBookmarked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function BookmarkFlag({ isBookmarked, onToggle, disabled = false }: BookmarkFlagProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
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
