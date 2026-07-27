/**
 * MoodHistoryTimeline — row component identity (Goal B)
 *
 * TimelineRow was moved to module scope so its identity is stable across
 * renders; declared inside the component it got a new function identity every
 * render, and react-window remounted every visible row.
 *
 * That claim needs its own file: verifying it means mocking `react-window` to
 * capture the `rowComponent` prop, which would blank out the real rendering the
 * sibling MoodHistoryTimeline.test.tsx asserts on.
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMood } from '../../../api/validation/supabaseSchemas';

/** Every value passed as `rowComponent`, one entry per List render */
const capturedRowComponents: unknown[] = [];

vi.mock('react-window', () => ({
  List: (props: { rowComponent: unknown }) => {
    capturedRowComponents.push(props.rowComponent);
    return <div data-testid="fake-list" />;
  },
}));

vi.mock('react-window-infinite-loader', () => ({
  useInfiniteLoader: () => vi.fn(),
}));

vi.mock('../../../hooks/useMoodHistory', () => ({
  useMoodHistory: vi.fn(),
}));

import { useMoodHistory } from '../../../hooks/useMoodHistory';
import { MoodHistoryTimeline } from '../MoodHistoryTimeline';

const mockedUseMoodHistory = vi.mocked(useMoodHistory);

const USER_ID = '00000000-0000-4000-8000-000000000001';

function mood(id: number): SupabaseMood {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    user_id: USER_ID,
    mood_type: 'happy',
    mood_types: ['happy'],
    note: null,
    created_at: new Date().toISOString(),
    updated_at: null,
  };
}

describe('MoodHistoryTimeline row identity', () => {
  beforeEach(() => {
    capturedRowComponents.length = 0;
    mockedUseMoodHistory.mockReturnValue({
      moods: [mood(1), mood(2)],
      isLoading: false,
      hasMore: false,
      loadMore: vi.fn(),
      retry: vi.fn(),
      error: null,
    });
  });

  it('passes the same row component across re-renders', () => {
    const { rerender } = render(<MoodHistoryTimeline userId={USER_ID} />);
    // isPartnerView flips so React genuinely re-renders rather than bailing out
    rerender(<MoodHistoryTimeline userId={USER_ID} isPartnerView />);

    expect(capturedRowComponents.length).toBeGreaterThanOrEqual(2);

    // Referential equality is the whole point: react-window treats a new
    // function identity as a different component type and remounts every row.
    const [first, ...rest] = capturedRowComponents;
    rest.forEach((seen) => expect(seen).toBe(first));
  });
});
