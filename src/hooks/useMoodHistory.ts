/**
 * useMoodHistory Hook
 *
 * Custom hook for fetching and paginating mood history entries.
 * Provides infinite scroll functionality with optimized pagination.
 *
 * @module hooks/useMoodHistory
 */

import { useState, useEffect, useCallback } from 'react';
import { moodApi } from '../api/moodApi';
import type { SupabaseMood } from '../api/validation/supabaseSchemas';

const PAGE_SIZE = 50;

interface UseMoodHistoryReturn {
  moods: SupabaseMood[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
}

/**
 * Fetch and paginate mood history for a user
 *
 * @param userId - User ID to fetch moods for
 * @returns Mood history state and pagination controls
 *
 * @example
 * ```typescript
 * function MoodTimeline({ userId }: { userId: string }) {
 *   const { moods, isLoading, hasMore, loadMore } = useMoodHistory(userId);
 *
 *   return (
 *     <div>
 *       {moods.map(mood => <MoodItem key={mood.id} mood={mood} />)}
 *       {hasMore && <button onClick={loadMore}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMoodHistory(userId: string): UseMoodHistoryReturn {
  const [moods, setMoods] = useState<SupabaseMood[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initial load - function moved inside effect to avoid exhaustive-deps warning
  useEffect(() => {
    async function loadInitialMoods() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await moodApi.getMoodHistory(userId, 0, PAGE_SIZE);

        setMoods(data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(PAGE_SIZE);
      } catch (err) {
        console.error('[useMoodHistory] Failed to load initial moods:', err);
        setError(err instanceof Error ? err.message : 'Failed to load mood history');
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialMoods();
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await moodApi.getMoodHistory(userId, offset, PAGE_SIZE);

      setMoods((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (err) {
      console.error('[useMoodHistory] Failed to load more moods:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more moods');
    } finally {
      setIsLoading(false);
    }
  }, [userId, offset, isLoading, hasMore]);

  return {
    moods,
    isLoading,
    hasMore,
    loadMore,
    error,
  };
}
