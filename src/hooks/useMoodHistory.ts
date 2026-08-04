/**
 * useMoodHistory Hook
 *
 * Custom hook for fetching and paginating mood history entries.
 * Provides infinite scroll functionality with optimized pagination.
 *
 * @module hooks/useMoodHistory
 */

import { useCallback, useEffect, useState } from 'react';
import { moodApi } from '../api/moodApi';
import type { SupabaseMood } from '../api/validation/supabaseSchemas';

const PAGE_SIZE = 50;

interface UseMoodHistoryReturn {
  moods: SupabaseMood[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
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
  // Starts true because the mount effect below fetches unconditionally. Initialising it
  // false meant the first commit reported "settled with zero results" for a load that had
  // not been issued yet, since the effect is passive and runs after that commit.
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initial load - exposed as `retry` so the UI can re-run it after a failure
  const loadInitialMoods = useCallback(async () => {
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
  }, [userId]);

  useEffect(() => {
    // The synchronous setIsLoading(true)/setError(null) inside loadInitialMoods does nothing
    // for the mount path — isLoading already starts true, and the effect runs after paint, so
    // it could never have beaten the first commit to the screen. It earns its place on the
    // retry path instead: loadInitialMoods is the exposed `retry`, where it clears the failure
    // banner and re-enters the spinner from a settled state. The suppression stands because a
    // paginated fetch accumulating pages in local state has nothing to derive during render
    // and no external store to subscribe to.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch-on-mount lifecycle
    loadInitialMoods();
  }, [loadInitialMoods]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await moodApi.getMoodHistory(userId, offset, PAGE_SIZE);

      // Dedupe on id only — never on date, since two genuine moods can share a
      // calendar day. Offset pagination against a table taking concurrent
      // inserts can still hand back a row that is already in state.
      setMoods((prev) => {
        const seen = new Set(prev.map((mood) => mood.id));
        return [...prev, ...data.filter((mood) => !seen.has(mood.id))];
      });
      // hasMore comes from the raw page length, not the deduped one: a single
      // overlapping row would otherwise end pagination early.
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
    retry: loadInitialMoods,
    error,
  };
}
