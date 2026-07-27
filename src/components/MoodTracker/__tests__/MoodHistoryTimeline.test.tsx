/**
 * MoodHistoryTimeline — duplicate-mood spec coverage (Goal B)
 *
 * Timeline dedupe must never hide a genuine second mood on the same day, and
 * the row renderer is now declared at module scope so its identity is stable
 * across renders.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMood } from '../../../api/validation/supabaseSchemas';

vi.mock('../../../hooks/useMoodHistory', () => ({
  useMoodHistory: vi.fn(),
}));

import { useMoodHistory } from '../../../hooks/useMoodHistory';
import { MoodHistoryTimeline, TimelineRow } from '../MoodHistoryTimeline';

const mockedUseMoodHistory = vi.mocked(useMoodHistory);

const USER_ID = '00000000-0000-4000-8000-000000000001';

function mood(id: number, createdAt: string, note: string | null = null): SupabaseMood {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    user_id: USER_ID,
    mood_type: 'happy',
    mood_types: ['happy'],
    note,
    created_at: createdAt,
    updated_at: null,
  };
}

function historyOf(moods: SupabaseMood[]): ReturnType<typeof useMoodHistory> {
  return {
    moods,
    isLoading: false,
    hasMore: false,
    loadMore: vi.fn(),
    retry: vi.fn(),
    error: null,
  };
}

describe('MoodHistoryTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[B: two genuine moods on one day] renders both under a single date header', () => {
    const morning = new Date();
    morning.setHours(8, 30, 0, 0);
    const evening = new Date();
    evening.setHours(20, 15, 0, 0);

    mockedUseMoodHistory.mockReturnValue(
      historyOf([
        mood(1, evening.toISOString(), 'evening'),
        mood(2, morning.toISOString(), 'morning'),
      ])
    );

    render(<MoodHistoryTimeline userId={USER_ID} />);

    expect(screen.getAllByTestId('mood-history-item')).toHaveLength(2);
    expect(screen.getAllByText('Today')).toHaveLength(1);
    expect(screen.getByText('evening')).toBeInTheDocument();
    expect(screen.getByText('morning')).toBeInTheDocument();
  });

  it('[B: two genuine moods on one day] keeps rows separate when they share a timestamp', () => {
    const sameInstant = new Date();
    sameInstant.setHours(12, 0, 0, 0);

    mockedUseMoodHistory.mockReturnValue(
      historyOf([
        mood(1, sameInstant.toISOString(), 'first log'),
        mood(2, sameInstant.toISOString(), 'second log'),
      ])
    );

    render(<MoodHistoryTimeline userId={USER_ID} />);

    expect(screen.getAllByTestId('mood-history-item')).toHaveLength(2);
    expect(screen.getAllByText('Today')).toHaveLength(1);
  });

  it('renders a date header row through the module-scope row component', () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);

    const items = [
      { type: 'date-header' as const, date: today.toDateString(), dateLabel: 'Today' },
      { type: 'mood' as const, mood: mood(1, today.toISOString(), 'hoisted') },
    ];

    render(
      <>
        <TimelineRow
          ariaAttributes={{ 'aria-posinset': 1, 'aria-setsize': 2, role: 'listitem' }}
          index={0}
          style={{}}
          timelineItems={items}
          isPartnerView={false}
        />
        <TimelineRow
          ariaAttributes={{ 'aria-posinset': 2, 'aria-setsize': 2, role: 'listitem' }}
          index={1}
          style={{}}
          timelineItems={items}
          isPartnerView={false}
        />
      </>
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByTestId('mood-history-item')).toBeInTheDocument();
  });
});
