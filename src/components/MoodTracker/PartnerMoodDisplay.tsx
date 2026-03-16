/**
 * PartnerMoodDisplay Component
 *
 * Displays partner's current mood with real-time updates via Supabase Broadcast API.
 * Shows emoji, mood label, relative timestamp, optional note, and "Just now" badge
 * for recent moods (< 5 minutes old).
 *
 * Story 5.3: Partner Mood Viewing & Transparency
 * - AC-5.3.1: Partner mood displayed prominently at top of Mood page
 * - AC-5.3.2: Shows emoji, label, timestamp, and optional note
 * - AC-5.3.3: Real-time updates via Broadcast API
 * - AC-5.3.4: "Just now" badge for recent entries
 * - AC-5.3.5: Graceful empty state handling
 */

import { useEffect, useRef, useState } from 'react';
import { m as motion } from 'framer-motion';
import { usePartnerMood } from '../../hooks/usePartnerMood';
import { NoMoodLoggedState } from './NoMoodLoggedState';
import { getMoodEmoji } from '../../utils/moodEmojis';
import { getRelativeTime, isJustNow } from '../../utils/dateUtils';

interface PartnerMoodDisplayProps {
  partnerId: string;
}

/**
 * Loading skeleton component for better perceived performance
 */
function LoadingState() {
  return (
    <div
      className="mb-6 animate-pulse rounded-2xl bg-gray-50 p-6 dark:bg-gray-800/50"
      data-testid="loading-state"
    >
      <div className="mb-4 h-4 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div className="flex-1">
          <div className="mb-2 h-6 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Partner Mood Display Component
 *
 * Loads and displays partner's most recent mood with real-time updates.
 * Includes visual animation feedback when partner updates their mood.
 */
export function PartnerMoodDisplay({ partnerId }: PartnerMoodDisplayProps) {
  const { partnerMood, isLoading, error } = usePartnerMood(partnerId);
  const [justUpdated, setJustUpdated] = useState(false);
  const prevMoodIdRef = useRef<string | undefined>(undefined);

  // Visual feedback when mood updates in real-time (not on initial load)
  useEffect(() => {
    const currentMoodId = partnerMood?.id;
    // Only animate on actual updates, not initial load
    if (
      currentMoodId &&
      prevMoodIdRef.current !== undefined &&
      currentMoodId !== prevMoodIdRef.current
    ) {
      // Use queueMicrotask to defer setState and avoid synchronous cascading renders
      queueMicrotask(() => setJustUpdated(true));
      const timer = setTimeout(() => setJustUpdated(false), 3000);
      prevMoodIdRef.current = currentMoodId;
      return () => clearTimeout(timer);
    }
    prevMoodIdRef.current = currentMoodId;
  }, [partnerMood?.id]);

  // Show loading skeleton while fetching initial data
  if (isLoading) {
    return <LoadingState />;
  }

  // Show error state if loading failed
  if (error) {
    return (
      <div
        className="mb-6 rounded-2xl bg-red-50 p-6 dark:bg-red-900/20"
        data-testid="partner-mood-error"
        role="alert"
      >
        <div className="mb-3 text-6xl">⚠️</div>
        <h3 className="mb-2 text-lg font-medium text-red-900 dark:text-red-100">
          Unable to load partner mood
        </h3>
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  // Show friendly empty state if partner hasn't logged any moods
  if (!partnerMood) {
    return <NoMoodLoggedState />;
  }

  const emoji = getMoodEmoji(partnerMood.mood_type);
  const timestamp = getRelativeTime(partnerMood.created_at ?? new Date().toISOString());
  const showJustNowBadge = isJustNow(partnerMood.created_at ?? new Date().toISOString());

  return (
    <motion.div
      initial={false}
      animate={{
        scale: justUpdated ? [1, 1.02, 1] : 1,
        borderColor: justUpdated ? ['#F9A8D4', '#EC4899', '#F9A8D4'] : '#F9A8D4',
      }}
      transition={{ duration: 0.6 }}
      className="mb-6 rounded-2xl border-2 bg-linear-to-br from-pink-50 to-pink-100 p-6 dark:from-pink-900/20 dark:to-pink-800/20"
      style={{ borderColor: '#F9A8D4' }}
      data-testid="partner-mood-display"
      role="region"
      aria-label="Partner's current mood"
    >
      <h2 className="mb-2 text-sm font-medium text-slate-700">Your partner is feeling:</h2>
      <div className="flex items-center gap-4">
        <span
          className="text-6xl"
          data-testid="partner-mood-emoji"
          role="img"
          aria-label={`${partnerMood.mood_type} mood emoji`}
        >
          {emoji}
        </span>
        <div className="flex-1">
          <h3
            className="text-2xl font-semibold text-slate-800 capitalize"
            data-testid="partner-mood-label"
          >
            {partnerMood.mood_type}
          </h3>
          <p className="text-sm text-slate-600" data-testid="partner-mood-timestamp">
            <time dateTime={partnerMood.created_at ?? undefined}>{timestamp}</time>
            {showJustNowBadge && (
              <span
                className="ml-2 inline-flex items-center rounded-full bg-pink-200 px-2 py-1 text-xs font-medium text-pink-900"
                data-testid="partner-mood-just-now-badge"
                aria-label="Logged just now"
              >
                Just now
              </span>
            )}
          </p>
          {partnerMood.note && (
            <p
              className="mt-2 text-slate-700 italic"
              data-testid="partner-mood-note"
              aria-label="Partner's note about their mood"
            >
              "{partnerMood.note}"
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
