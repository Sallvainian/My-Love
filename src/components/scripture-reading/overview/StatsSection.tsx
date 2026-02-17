/**
 * StatsSection — Presentational component for couple-aggregate scripture stats
 * Story 3.1: AC #1, #2, #5
 */

import type { ReactElement } from 'react';
import { BookOpen, CheckCircle, Calendar, Star, Bookmark } from 'lucide-react';
import type { CoupleStats } from '../../../stores/types';

interface StatsSectionProps {
  stats: CoupleStats | null;
  isLoading: boolean;
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (Math.abs(diffSeconds) < 86400) return relativeFormatter.format(0, 'day'); // "today"
  if (Math.abs(diffSeconds) < 2592000) {
    const days = -Math.floor(diffSeconds / 86400);
    return relativeFormatter.format(days, 'day');
  }
  if (Math.abs(diffSeconds) < 31536000) {
    const months = -Math.floor(diffSeconds / 2592000);
    return relativeFormatter.format(months, 'month');
  }
  const years = -Math.floor(diffSeconds / 31536000);
  return relativeFormatter.format(years, 'year');
}

function isZeroState(stats: CoupleStats): boolean {
  return (
    stats.totalSessions === 0 &&
    stats.totalSteps === 0 &&
    stats.bookmarkCount === 0 &&
    stats.avgRating === 0 &&
    stats.lastCompleted === null
  );
}

const CARD_CLASSES = 'bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl p-4';

interface StatCardProps {
  icon: ReactElement;
  value: string;
  label: string;
  testId: string;
  ariaLabel: string;
}

function StatCard({ icon, value, label, testId, ariaLabel }: StatCardProps): ReactElement {
  return (
    <div className={CARD_CLASSES} data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="text-purple-400">{icon}</div>
        <div>
          <div className="text-2xl font-semibold text-purple-900" aria-label={ariaLabel}>
            {value}
          </div>
          <div className="text-xs text-purple-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard(): ReactElement {
  return (
    <div className={CARD_CLASSES}>
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 animate-pulse rounded bg-purple-200" />
        <div>
          <div className="h-8 w-16 animate-pulse rounded bg-purple-200" />
          <div className="mt-1 h-3 w-24 animate-pulse rounded bg-purple-100" />
        </div>
      </div>
    </div>
  );
}

export function StatsSection({ stats, isLoading }: StatsSectionProps): ReactElement {
  const showSkeleton = isLoading && !stats;

  if (showSkeleton) {
    return (
      <section
        aria-label="Scripture reading statistics"
        aria-busy="true"
        data-testid="scripture-stats-skeleton"
        className="space-y-3"
      >
        <h2 className="text-center text-sm font-medium text-purple-700">Your Journey</h2>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>
    );
  }

  // When stats is null and not loading (RPC failed, no cache), show zero-state
  // instead of vanishing the section entirely (empty fragment)
  const effectiveStats = stats ?? {
    totalSessions: 0,
    totalSteps: 0,
    lastCompleted: null,
    avgRating: 0,
    bookmarkCount: 0,
  };

  const zero = isZeroState(effectiveStats);
  const dash = '\u2014'; // em dash

  const sessionsValue = zero ? dash : String(effectiveStats.totalSessions);
  const stepsValue = zero ? dash : String(effectiveStats.totalSteps);
  const lastValue =
    zero || !effectiveStats.lastCompleted ? dash : formatRelativeDate(effectiveStats.lastCompleted);
  const ratingValue = zero ? dash : effectiveStats.avgRating.toFixed(1);
  const bookmarksValue = zero ? dash : String(effectiveStats.bookmarkCount);

  return (
    <section
      aria-label="Scripture reading statistics"
      data-testid="scripture-stats-section"
      className="space-y-3"
    >
      <h2 className="text-center text-sm font-medium text-purple-700">Your Journey</h2>

      <StatCard
        icon={<BookOpen size={20} />}
        value={sessionsValue}
        label="Sessions Completed"
        testId="scripture-stats-sessions"
        ariaLabel={
          zero ? 'No sessions completed' : `${effectiveStats.totalSessions} sessions completed`
        }
      />
      <StatCard
        icon={<CheckCircle size={20} />}
        value={stepsValue}
        label="Steps Completed"
        testId="scripture-stats-steps"
        ariaLabel={zero ? 'No steps completed' : `${effectiveStats.totalSteps} steps completed`}
      />
      <StatCard
        icon={<Calendar size={20} />}
        value={lastValue}
        label="Last Completed"
        testId="scripture-stats-last-completed"
        ariaLabel={zero ? 'No sessions completed yet' : `Last completed ${lastValue}`}
      />
      <StatCard
        icon={<Star size={20} />}
        value={ratingValue}
        label="Average Rating"
        testId="scripture-stats-avg-rating"
        ariaLabel={zero ? 'No ratings yet' : `Average rating ${ratingValue} out of 5`}
      />
      <StatCard
        icon={<Bookmark size={20} />}
        value={bookmarksValue}
        label="Bookmarks Saved"
        testId="scripture-stats-bookmarks"
        ariaLabel={zero ? 'No bookmarks saved' : `${effectiveStats.bookmarkCount} bookmarks saved`}
      />

      {zero && (
        <p
          className="text-center text-sm text-purple-400 italic"
          data-testid="scripture-stats-zero-state"
        >
          Begin your first reading
        </p>
      )}
    </section>
  );
}
