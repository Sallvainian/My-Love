/**
 * MoodHistoryTimeline Component
 *
 * Virtualized timeline displaying mood history with infinite scroll.
 * Uses react-window for memory-efficient rendering of large datasets.
 *
 * @module components/MoodTracker/MoodHistoryTimeline
 */

import { CircleAlert, RotateCcwClock } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { List } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';
import type { SupabaseMood } from '../../api/validation/supabaseSchemas';
import { useMoodHistory } from '../../hooks/useMoodHistory';
import { groupMoodsByDate, type MoodGroup } from '../../utils/moodGrouping';
import { measureScrollPerformance } from '../../utils/performanceMonitoring';
import { MoodHistoryItem } from './MoodHistoryItem';

interface MoodHistoryTimelineProps {
  userId: string;
  isPartnerView?: boolean;
}

/**
 * Date header component for timeline
 */
function DateHeader({ date }: { date: string }) {
  return (
    <div
      className="sticky top-0 z-10 border-b border-line bg-card px-4 py-2.5"
      data-testid={`date-header-${date.toLowerCase().replace(/\s/g, '-')}`}
    >
      <h3 className="text-xs font-semibold tracking-[.08em] text-muted uppercase">
        {date}
      </h3>
    </div>
  );
}

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center" data-testid="loading-spinner">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accent"></div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyMoodHistoryState() {
  return (
    <div
      className="flex flex-col items-center px-4 py-12 text-center"
      data-testid="empty-mood-history-state"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-tint text-accent">
        <RotateCcwClock className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-[15px] font-semibold text-ink">No mood history yet</h3>
      <p className="text-sm text-muted">
        Start logging your moods to see your emotional journey
      </p>
    </div>
  );
}

type TimelineItem =
  | { type: 'date-header'; date: string; dateLabel: string }
  | { type: 'mood'; mood: SupabaseMood };

/**
 * Flatten mood groups into timeline items (date headers + moods)
 */
function flattenMoodGroups(groups: MoodGroup[]): TimelineItem[] {
  const items: TimelineItem[] = [];

  groups.forEach((group) => {
    // Add date header
    items.push({
      type: 'date-header',
      date: group.date.toDateString(),
      dateLabel: group.dateLabel,
    });

    // Add mood entries for this date
    group.moods.forEach((mood) => {
      items.push({
        type: 'mood',
        mood,
      });
    });
  });

  return items;
}

/**
 * Props react-window passes through `rowProps` to every row
 */
interface TimelineRowProps {
  timelineItems: TimelineItem[];
  isPartnerView: boolean;
}

/**
 * Row renderer for the virtualized list
 *
 * Declared at module scope on purpose: defined inside MoodHistoryTimeline its
 * identity changed on every render, which remounted every visible row.
 */
export function TimelineRow({
  index,
  style,
  timelineItems,
  isPartnerView,
}: {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: React.CSSProperties;
} & TimelineRowProps): ReactElement {
  const item = timelineItems[index];

  if (!item) {
    return <div style={style} />;
  }

  return (
    <div style={style}>
      {item.type === 'date-header' ? (
        <DateHeader date={item.dateLabel} />
      ) : (
        <MoodHistoryItem mood={item.mood} isPartnerView={isPartnerView} />
      )}
    </div>
  );
}

/**
 * Main timeline component with virtualized rendering
 *
 * Features:
 * - Infinite scroll with automatic pagination (50 entries per page)
 * - Virtualized rendering for memory efficiency (< 100MB for 1000+ entries)
 * - Day separators with sticky headers
 * - Smooth 60fps scrolling performance
 * - Empty state handling
 *
 * @param userId - User ID to fetch moods for
 * @param isPartnerView - Whether viewing partner's moods (optional)
 */
export function MoodHistoryTimeline({ userId, isPartnerView = false }: MoodHistoryTimelineProps) {
  const { moods, isLoading, hasMore, loadMore, error, retry } = useMoodHistory(userId);

  // Performance monitoring in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      const observer = measureScrollPerformance();
      return () => observer.disconnect();
    }
  }, []);

  // Group moods by date for day separators
  const groupedMoods = useMemo(() => groupMoodsByDate(moods), [moods]);

  // Flatten groups into timeline items (date headers + moods)
  const timelineItems = useMemo(() => flattenMoodGroups(groupedMoods), [groupedMoods]);

  // Determine if row needs loading
  const isRowLoaded = (index: number) => !hasMore || index < timelineItems.length;

  // Load more rows when scrolling near bottom
  const loadMoreRows = async (_startIndex: number, _stopIndex: number) => {
    if (!isLoading && hasMore) {
      await loadMore();
    }
  };

  // Variable sizing function per story spec
  const getRowHeight = (index: number): number => {
    const item = timelineItems[index];
    if (!item) return 80; // Default for loading items

    if (item.type === 'date-header') {
      return 40; // Date headers are compact
    }

    // Mood items vary by note length
    const noteLength = item.mood.note?.length || 0;
    if (noteLength > 100) {
      return 120; // Long notes need more space
    }
    return 80; // Standard mood item height
  };

  // Setup infinite loading hook - must be called before any conditional returns
  const onRowsRendered = useInfiniteLoader({
    isRowLoaded: isRowLoaded,
    loadMoreRows: loadMoreRows,
    rowCount: timelineItems.length + (hasMore ? 1 : 0),
    threshold: 15,
    minimumBatchSize: 10,
  });

  // Show error state — checked BEFORE the empty state, otherwise a failed first
  // page renders "No mood history yet" to a user who has months of moods
  if (error) {
    return (
      <div className="flex flex-col items-center px-4 py-12 text-center" data-testid="error-state">
        <CircleAlert className="mb-3 h-8 w-8 text-muted" aria-hidden="true" />
        <h3 className="mb-1 text-[15px] font-semibold text-ink">Failed to load mood history</h3>
        <p className="text-sm text-muted">{error}</p>
        <button
          onClick={() => void retry()}
          className="mt-4 h-12 rounded-full bg-fill px-6 text-[15px] font-semibold text-white"
          data-testid="mood-history-retry"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Show empty state
  if (!isLoading && moods.length === 0) {
    return <EmptyMoodHistoryState />;
  }

  return (
    <div className="h-full w-full" data-testid="mood-history-timeline">
      <List
        rowCount={timelineItems.length}
        rowHeight={getRowHeight}
        onRowsRendered={onRowsRendered}
        defaultHeight={600}
        rowComponent={TimelineRow}
        rowProps={{ timelineItems, isPartnerView }}
      />

      {isLoading && (
        <div className="py-4 text-center">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
