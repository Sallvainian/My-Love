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

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
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

const CARD_CLASSES =
  'bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl p-4';

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
          <div
            className="text-2xl font-semibold text-purple-900"
            aria-label={ariaLabel}
          >
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
        <div className="h-6 w-6 bg-purple-200 rounded animate-pulse" />
        <div>
          <div className="h-8 w-16 bg-purple-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-purple-100 rounded animate-pulse mt-1" />
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
        <h2 className="text-sm font-medium text-purple-700 text-center">Your Journey</h2>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>
    );
  }

  if (!stats) return <></>;

  const zero = isZeroState(stats);
  const dash = '\u2014'; // em dash

  const sessionsValue = zero ? dash : String(stats.totalSessions);
  const stepsValue = zero ? dash : String(stats.totalSteps);
  const lastValue = zero || !stats.lastCompleted ? dash : formatRelativeDate(stats.lastCompleted);
  const ratingValue = zero ? dash : stats.avgRating.toFixed(1);
  const bookmarksValue = zero ? dash : String(stats.bookmarkCount);

  return (
    <section
      aria-label="Scripture reading statistics"
      data-testid="scripture-stats-section"
      className="space-y-3"
    >
      <h2 className="text-sm font-medium text-purple-700 text-center">Your Journey</h2>

      <StatCard
        icon={<BookOpen size={20} />}
        value={sessionsValue}
        label="Sessions Completed"
        testId="scripture-stats-sessions"
        ariaLabel={zero ? 'No sessions completed' : `${stats.totalSessions} sessions completed`}
      />
      <StatCard
        icon={<CheckCircle size={20} />}
        value={stepsValue}
        label="Steps Completed"
        testId="scripture-stats-steps"
        ariaLabel={zero ? 'No steps completed' : `${stats.totalSteps} steps completed`}
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
        ariaLabel={zero ? 'No bookmarks saved' : `${stats.bookmarkCount} bookmarks saved`}
      />

      {zero && (
        <p
          className="text-sm text-purple-400 italic text-center"
          data-testid="scripture-stats-zero-state"
        >
          Begin your first reading
        </p>
      )}
    </section>
  );
}
