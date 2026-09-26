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
import { MOOD_DISPLAY } from '../../constants/moodDisplay';
import { normalizeMoodValues } from '../../types/moods';
import { getRelativeTime } from '../../utils/dateUtils';

interface MoodHistoryItemProps {
  mood: SupabaseMood;
  isPartnerView?: boolean;
}

const NOTE_TRUNCATE_LENGTH = 100;

/**
 * Individual mood entry display component
 *
 * Features:
 * - Displays mood icons (shared MOOD_DISPLAY map), labels, and timestamp
 * - Shows optional note with truncation for long text
 * - Expand/collapse functionality for notes > 100 chars
 * - Clean visual separation between entries
 *
 * @param mood - Mood entry to display
 * @param isPartnerView - Whether this is viewing partner's mood (optional)
 */
export function MoodHistoryItem({ mood }: MoodHistoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const normalized = normalizeMoodValues(mood.mood_type, mood.mood_types);
  if (!normalized) return null;
  const allMoods = normalized.moods;

  const shouldTruncate = mood.note && mood.note.length > NOTE_TRUNCATE_LENGTH;
  const displayNote =
    shouldTruncate && !isExpanded
      ? (mood.note?.slice(0, NOTE_TRUNCATE_LENGTH) ?? '') + '...'
      : (mood.note ?? '');

  return (
    <div
      className="relative flex items-start gap-3 px-4 py-3"
      data-testid="mood-history-item"
      data-timestamp={mood.created_at}
    >
      {/* Icons - one per selected mood, owner-toned (`you` = accent) */}
      <div className="flex shrink-0 gap-1 pt-0.5 text-accent" data-testid="mood-emoji">
        {allMoods.map((m, index) => {
          const Icon = MOOD_DISPLAY[m].icon;
          return (
            <Icon
              key={`${m}-${index}`}
              className="h-5 w-5"
              aria-hidden="true"
              data-testid={`mood-icon-${m}`}
            />
          );
        })}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h4 className="text-[15px] font-medium text-ink" data-testid="mood-label">
            {allMoods.map((m) => MOOD_DISPLAY[m].label).join(', ')}
          </h4>
          <span className="shrink-0 text-[13px] text-muted" data-testid="mood-timestamp">
            {getRelativeTime(mood.created_at || '')}
          </span>
        </div>

        {/* Note with expand/collapse */}
        {mood.note && (
          <div className="mt-1">
            <p className="text-sm text-muted" data-testid="mood-note">
              {displayNote}
            </p>

            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-1 text-xs font-semibold text-accent"
                data-testid="mood-note-toggle"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Divider line */}
      <div className="absolute right-0 bottom-0 left-0 h-px bg-line" />
    </div>
  );
}
