/**
 * MoodHistoryTimeline Component
 *
 * Virtualized timeline displaying mood history with infinite scroll.
 * Uses react-window for memory-efficient rendering of large datasets.
 *
 * @module components/MoodTracker/MoodHistoryTimeline
 */

import { useMemo, useEffect, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useMoodHistory } from '../../hooks/useMoodHistory';
import { MoodHistoryItem } from './MoodHistoryItem';
import { groupMoodsByDate, type MoodGroup } from '../../utils/moodGrouping';
import { measureScrollPerformance } from '../../utils/performanceMonitoring';
import type { SupabaseMood } from '../../api/validation/supabaseSchemas';

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
      className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700"
      data-testid={`date-header-${date.toLowerCase().replace(/\s/g, '-')}`}
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyMoodHistoryState() {
  return (
    <div className="text-center py-12" data-testid="empty-mood-history-state">
      <div className="text-6xl mb-4">📊</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        No mood history yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
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
  const { moods, isLoading, hasMore, loadMore, error } = useMoodHistory(userId);

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

  // Show empty state
  if (!isLoading && moods.length === 0) {
    return <EmptyMoodHistoryState />;
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-12" data-testid="error-state">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Failed to load mood history
        </h3>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  // Variable sizing function per story spec
  const getItemSize = (index: number): number => {
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

  // Create ref for VariableSizeList
  const listRef = useRef<InstanceType<typeof List>>(null);

  return (
    <div className="w-full h-full" data-testid="mood-history-timeline">
      <InfiniteLoader
        isItemLoaded={isRowLoaded}
        itemCount={timelineItems.length + (hasMore ? 1 : 0)}
        loadMoreItems={loadMoreRows}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={(list) => {
              // Assign to both refs
              ref(list);
              if (listRef) listRef.current = list;
            }}
            height={600}
            itemCount={timelineItems.length}
            itemSize={getItemSize}
            width="100%"
            onItemsRendered={onItemsRendered}
          >
            {({ index, style }) => {
              const item = timelineItems[index];

              return (
                <div style={style}>
                  {item.type === 'date-header' ? (
                    <DateHeader date={item.dateLabel} />
                  ) : (
                    <MoodHistoryItem mood={item.mood} isPartnerView={isPartnerView} />
                  )}
                </div>
              );
            }}
          </List>
        )}
      </InfiniteLoader>

      {isLoading && (
        <div className="text-center py-4">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
