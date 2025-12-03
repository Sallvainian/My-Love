/**
 * MoodHistoryItem Component
 *
 * Displays a single mood entry in the timeline with expand/collapse
 * functionality for long notes.
 *
 * @module components/MoodTracker/MoodHistoryItem
 */

import { useState } from 'react';
import type { SupabaseMood } from '../../api/validation/supabaseSchemas';
import { getMoodEmoji } from '../../utils/moodEmojis';
import { getRelativeTime } from '../../utils/dateFormat';

interface MoodHistoryItemProps {
  mood: SupabaseMood;
  isPartnerView?: boolean;
}

const NOTE_TRUNCATE_LENGTH = 100;

/**
 * Individual mood entry display component
 *
 * Features:
 * - Displays mood emoji, type, and timestamp
 * - Shows optional note with truncation for long text
 * - Expand/collapse functionality for notes > 100 chars
 * - Clean visual separation between entries
 *
 * @param mood - Mood entry to display
 * @param isPartnerView - Whether this is viewing partner's mood (optional)
 */
export function MoodHistoryItem({ mood }: MoodHistoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const shouldTruncate = mood.note && mood.note.length > NOTE_TRUNCATE_LENGTH;
  const displayNote =
    shouldTruncate && !isExpanded
      ? (mood.note?.slice(0, NOTE_TRUNCATE_LENGTH) ?? '') + '...'
      : mood.note ?? '';

  return (
    <div
      className="flex items-start gap-3 py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative"
      data-testid="mood-history-item"
      data-timestamp={mood.created_at}
    >
      {/* Emoji */}
      <div className="flex-shrink-0" data-testid="mood-emoji">
        <span className="text-3xl">{getMoodEmoji(mood.mood_type)}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h4
            className="font-medium text-gray-900 dark:text-gray-100 capitalize"
            data-testid="mood-label"
          >
            {mood.mood_type}
          </h4>
          <span
            className="text-sm text-gray-500 dark:text-gray-400"
            data-testid="mood-timestamp"
          >
            {getRelativeTime(mood.created_at || '')}
          </span>
        </div>

        {/* Note with expand/collapse */}
        {mood.note && (
          <div className="mt-1">
            <p className="text-gray-700 dark:text-gray-300 text-sm" data-testid="mood-note">
              {displayNote}
            </p>

            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 mt-1 font-medium"
                data-testid="mood-note-toggle"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Divider line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}
