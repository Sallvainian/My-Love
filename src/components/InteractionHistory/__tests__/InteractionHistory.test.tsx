import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Interaction } from '../../../api/interactionService';

const storeMocks = vi.hoisted(() => ({
  // Never resolves: the sheet stays in its loading phase for the whole test.
  loadInteractionHistory: vi.fn(() => new Promise<void>(() => {})),
  getInteractionHistory: vi.fn((): Interaction[] => []),
}));

const USER_ID = 'USER-A-ID';
/**
 * How many interactions the sheet asks for when it opens: the inline
 * `loadInteractionHistory(100)` in src/components/InteractionHistory/InteractionHistory.tsx.
 */
const HISTORY_PAGE_SIZE = 100;

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (state: { userId: string }) => unknown) =>
    selector ? selector({ userId: USER_ID }) : storeMocks,
}));

import { InteractionHistory } from '../InteractionHistory';

describe('InteractionHistory loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the shown list on screen while the refresh is in flight', () => {
    storeMocks.getInteractionHistory.mockReturnValue([
      {
        id: 'recent-1',
        type: 'poke',
        fromUserId: 'PARTNER-ID',
        toUserId: USER_ID,
        viewed: false,
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);

    render(<InteractionHistory isOpen onClose={() => {}} />);

    expect(storeMocks.loadInteractionHistory).toHaveBeenCalledWith(HISTORY_PAGE_SIZE);
    expect(screen.getByTestId('interaction-recent-1')).toBeInTheDocument();
    expect(screen.queryByTestId('interaction-history-loading')).not.toBeInTheDocument();
  });

  it('shows the loading state while the refresh is in flight with an empty list', () => {
    storeMocks.getInteractionHistory.mockReturnValue([]);

    render(<InteractionHistory isOpen onClose={() => {}} />);

    expect(screen.getByTestId('interaction-history-loading')).toHaveTextContent(
      'Loading interactions...'
    );
    expect(screen.queryByTestId('interaction-history-empty')).not.toBeInTheDocument();
  });
});

// DW-289: day labels count calendar days, as love-note and mood timestamps do
// (calendarDaysBetween), not elapsed 24-hour blocks. The suite runs under
// TZ=America/New_York (vitest.config.ts); clocks spring forward on 2026-03-08,
// a 23-hour local day.
describe('InteractionHistory timestamps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function labelAt(now: Date, createdAt: Date): HTMLElement {
    vi.setSystemTime(now);
    storeMocks.getInteractionHistory.mockReturnValue([
      {
        id: 'stamp',
        type: 'kiss',
        fromUserId: 'PARTNER-ID',
        toUserId: USER_ID,
        viewed: true,
        createdAt,
      },
    ]);
    render(<InteractionHistory isOpen onClose={() => {}} />);
    return screen.getByTestId('interaction-stamp');
  }

  it('says "Yesterday" for 23:00 yesterday viewed at 08:00 today, not "9h ago"', () => {
    const row = labelAt(new Date(2026, 8, 26, 8, 0), new Date(2026, 8, 25, 23, 0));
    expect(within(row).getByText('Yesterday')).toBeInTheDocument();
    expect(within(row).queryByText('9h ago')).not.toBeInTheDocument();
  });

  it('says "Yesterday" for a poke 23 hours before, across the day clocks sprang forward', () => {
    // Sun 8 Mar 00:10 to Mon 9 Mar 00:30 is 23h20m of elapsed time.
    const row = labelAt(new Date(2026, 2, 9, 0, 30), new Date(2026, 2, 8, 0, 10));
    expect(within(row).getByText('Yesterday')).toBeInTheDocument();
  });

  it('says "2d ago" two calendar days back, across the day clocks sprang forward', () => {
    // Sun 8 Mar 00:30 to Tue 10 Mar 00:40 is 47h10m of elapsed time.
    const row = labelAt(new Date(2026, 2, 10, 0, 40), new Date(2026, 2, 8, 0, 30));
    expect(within(row).getByText('2d ago')).toBeInTheDocument();
  });

  it.each([
    ['Just now', new Date(2026, 8, 26, 14, 0, 30)],
    ['15m ago', new Date(2026, 8, 26, 13, 46)],
    ['5h ago', new Date(2026, 8, 26, 9, 0)],
  ])('keeps "%s" within the same day', (label, createdAt) => {
    const row = labelAt(new Date(2026, 8, 26, 14, 1), createdAt);
    expect(within(row).getByText(label)).toBeInTheDocument();
  });

  it('counts "Xd ago" in calendar days: 18:00 six days back reads "6d ago" at 14:00', () => {
    // 5 days 20 hours elapsed, six calendar days.
    const row = labelAt(new Date(2026, 8, 26, 14, 0), new Date(2026, 8, 20, 18, 0));
    expect(within(row).getByText('6d ago')).toBeInTheDocument();
  });

  it('shows the date from the seventh calendar day back', () => {
    const createdAt = new Date(2026, 8, 19, 18, 0);
    const row = labelAt(new Date(2026, 8, 26, 14, 0), createdAt);
    expect(within(row).getByText(createdAt.toLocaleDateString())).toBeInTheDocument();
  });

  it('keeps minutes across midnight, since that label is not a day label', () => {
    const row = labelAt(new Date(2026, 8, 26, 0, 10), new Date(2026, 8, 25, 23, 40));
    expect(within(row).getByText('30m ago')).toBeInTheDocument();
  });
});
