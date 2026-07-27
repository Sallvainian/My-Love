/**
 * useMoodHistory — duplicate-mood spec coverage (Goal B)
 *
 * Offset pagination against a table taking concurrent inserts can hand back a
 * row that is already in state even with a deterministic ORDER BY, so the
 * append is defensive. It must dedupe on `id` only — two genuine moods can
 * share a calendar day — and `hasMore` must come from the raw page length.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/moodApi', () => ({
  moodApi: {
    getMoodHistory: vi.fn(),
  },
}));

import { moodApi } from '@/api/moodApi';
import type { SupabaseMood } from '@/api/validation/supabaseSchemas';
import { useMoodHistory } from '@/hooks/useMoodHistory';

const mockedGetMoodHistory = vi.mocked(moodApi.getMoodHistory);

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PAGE_SIZE = 50;

function mood(id: number, createdAt: string): SupabaseMood {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    user_id: USER_ID,
    mood_type: 'happy',
    mood_types: ['happy'],
    note: null,
    created_at: createdAt,
    updated_at: null,
  };
}

/** A full page of distinct moods, one per minute going back from `base` */
function page(startIndex: number): SupabaseMood[] {
  const base = Date.parse('2026-02-01T12:00:00.000Z');
  return Array.from({ length: PAGE_SIZE }, (_unused, offset) => {
    const index = startIndex + offset;
    return mood(index + 1, new Date(base - index * 60_000).toISOString());
  });
}

describe('useMoodHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('[B: same row returned on two pages] an already-seen id is filtered out of the append', async () => {
    const firstPage = page(0);
    // Page 2 overlaps by one row — the last row of page 1 comes back again.
    const secondPage = [firstPage[PAGE_SIZE - 1], ...page(PAGE_SIZE).slice(0, PAGE_SIZE - 1)];

    mockedGetMoodHistory.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    const { result } = renderHook(() => useMoodHistory(USER_ID));
    await waitFor(() => expect(result.current.moods).toHaveLength(PAGE_SIZE));

    await act(async () => {
      await result.current.loadMore();
    });

    const ids = result.current.moods.map((entry) => entry.id);
    expect(ids).toHaveLength(2 * PAGE_SIZE - 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('[B: same row returned on two pages] hasMore comes from the raw page length', async () => {
    const firstPage = page(0);
    const secondPage = [firstPage[PAGE_SIZE - 1], ...page(PAGE_SIZE).slice(0, PAGE_SIZE - 1)];

    mockedGetMoodHistory.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    const { result } = renderHook(() => useMoodHistory(USER_ID));
    await waitFor(() => expect(result.current.moods).toHaveLength(PAGE_SIZE));

    await act(async () => {
      await result.current.loadMore();
    });

    // The server returned a full page; only the dedupe made it look short.
    // Deriving hasMore post-dedupe would strand the rest of the history.
    expect(result.current.hasMore).toBe(true);
  });

  it('[B: two genuine moods on one day] distinct ids sharing a timestamp are both kept', async () => {
    const sameInstant = '2026-02-01T09:00:00.000Z';
    const firstPage = [...page(0).slice(0, PAGE_SIZE - 1), mood(1000, sameInstant)];
    const secondPage = [mood(1001, sameInstant), ...page(PAGE_SIZE).slice(0, PAGE_SIZE - 1)];

    mockedGetMoodHistory.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    const { result } = renderHook(() => useMoodHistory(USER_ID));
    await waitFor(() => expect(result.current.moods).toHaveLength(PAGE_SIZE));

    await act(async () => {
      await result.current.loadMore();
    });

    const sameDayIds = result.current.moods
      .filter((entry) => entry.created_at === sameInstant)
      .map((entry) => entry.id);

    expect(sameDayIds).toHaveLength(2);
    expect(result.current.moods).toHaveLength(2 * PAGE_SIZE);
  });
});
