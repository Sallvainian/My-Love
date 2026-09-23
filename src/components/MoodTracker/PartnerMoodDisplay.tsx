/**
 * PartnerMoodDisplay Component
 *
 * Displays partner's current mood with real-time updates via Supabase Broadcast API.
 * Shows the partner's avatar, a violet chip per mood (lucide icon + label from
 * the shared MOOD_DISPLAY map), relative timestamp, optional note, and a
 * "Just now" badge for recent moods (< 5 minutes old).
 *
 * Story 5.3: Partner Mood Viewing & Transparency
 * - AC-5.3.1: Partner mood displayed prominently at top of Mood page
 * - AC-5.3.2: Shows mood icons, labels, timestamp, and optional note
 * - AC-5.3.3: Real-time updates via Broadcast API
 * - AC-5.3.4: "Just now" badge for recent entries
 * - AC-5.3.5: Graceful empty state handling
 */

import { m as motion } from 'framer-motion';
import { AlertCircle, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MOOD_DISPLAY, MOOD_TONE } from '../../constants/moodDisplay';
import { usePartnerMood } from '../../hooks/usePartnerMood';
import { useAppStore } from '../../stores/useAppStore';
import { normalizeMoodValues } from '../../types/moods';
import { getRelativeTime, isJustNow } from '../../utils/dateUtils';
import { NoMoodLoggedState } from './NoMoodLoggedState';

interface PartnerMoodDisplayProps {
  partnerId: string;
}

/** Kit card shell shared by every state of this component. */
const CARD = 'rounded-[20px] border border-line bg-card p-3.5 shadow-card';

/**
 * Loading skeleton component for better perceived performance
 */
function LoadingState() {
  return (
    <div className={`${CARD} animate-pulse`} data-testid="loading-state">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-card2"></div>
        <div className="flex-1">
          <div className="mb-2 h-4 w-32 rounded bg-card2"></div>
          <div className="h-3 w-16 rounded bg-card2"></div>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        <div className="h-[34px] w-24 rounded-full bg-card2"></div>
        <div className="h-[34px] w-20 rounded-full bg-card2"></div>
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
  // The store's partner is only loaded by the Partner view, so it is often
  // null here. Never fall back to PARTNER_NAME: it names one fixed person and
  // would put that name on the other partner's mood on their own device.
  const partnerName = useAppStore((s) => s.partner?.displayName)?.trim() || null;
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
        className={`${CARD} flex items-start gap-3`}
        data-testid="partner-mood-error"
        role="alert"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dtint text-danger">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-ink">Unable to load partner mood</h3>
          <p className="text-[13px] text-muted">{error}</p>
        </div>
      </div>
    );
  }

  // Show friendly empty state if partner hasn't logged any moods
  if (!partnerMood) {
    return <NoMoodLoggedState />;
  }

  const normalized = normalizeMoodValues(partnerMood.mood_type, partnerMood.mood_types);
  if (!normalized) return <NoMoodLoggedState />;
  const allMoods = normalized.moods;

  const labels = allMoods.map((m) => MOOD_DISPLAY[m].label).join(', ');
  const timestamp = getRelativeTime(partnerMood.created_at ?? new Date().toISOString());
  const showJustNowBadge = isJustNow(partnerMood.created_at ?? new Date().toISOString());

  return (
    <motion.div
      initial={false}
      animate={{ scale: justUpdated ? [1, 1.02, 1] : 1 }}
      transition={{ duration: 0.6 }}
      className={`${CARD} flex flex-col gap-2.5`}
      data-testid="partner-mood-display"
      role="region"
      aria-label="Partner's current mood"
    >
      <div className="flex min-h-12 items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-partner text-base font-semibold text-card"
          aria-hidden="true"
        >
          {partnerName ? (
            // Array.from splits by code point, so a leading emoji or other
            // non-BMP character is not cut in half.
            Array.from(partnerName)[0].toUpperCase()
          ) : (
            <User className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-[15px] font-medium text-ink">
            {partnerName ?? 'Your partner'} is feeling
          </h2>
          <p className="text-[13px] text-muted" data-testid="partner-mood-timestamp">
            <time dateTime={partnerMood.created_at ?? undefined}>{timestamp}</time>
            {showJustNowBadge && (
              <span
                className="ml-2 inline-flex items-center rounded-full bg-ptint px-2 py-0.5 text-xs font-semibold text-partner"
                data-testid="partner-mood-just-now-badge"
                aria-label="Logged just now"
              >
                Just now
              </span>
            )}
          </p>
        </div>
      </div>

      <h3 className="sr-only" data-testid="partner-mood-label">
        {labels}
      </h3>

      <div
        className="flex flex-wrap gap-2"
        data-testid="partner-mood-emoji"
        role="img"
        aria-label={`${allMoods.join(', ')} mood`}
      >
        {allMoods.map((m, index) => {
          const { icon: Icon, label } = MOOD_DISPLAY[m];
          return (
            <span
              key={`${m}-${index}`}
              className={`flex h-[34px] items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold ${MOOD_TONE.partner}`}
            >
              <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
              {label}
            </span>
          );
        })}
      </div>

      {partnerMood.note && (
        <p
          className="text-sm text-ink italic"
          data-testid="partner-mood-note"
          aria-label="Partner's note about their mood"
        >
          "{partnerMood.note}"
        </p>
      )}
    </motion.div>
  );
}
