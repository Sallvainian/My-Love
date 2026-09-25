/**
 * MessageList — older notes after an offline scroll (ticket 11).
 *
 * `react-window-infinite-loader` 2.0.1 remembers every row it has asked for in
 * a Set it rebuilds only when `isRowLoaded` or `loadMoreRows` changes
 * identity. Offline, the store answers a load-more with no change at all, so
 * without a new identity on reconnect the row stayed "asked for" and the next
 * scroll up never loaded the older page.
 *
 * The real loader runs here; only react-window's List is stood in for, by one
 * that reports the rendered range on every render, as a scroll would.
 */
import { act, render } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoveNote } from '../../../types/models';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const renderedRanges = vi.hoisted(() => [] as Array<{ startIndex: number; stopIndex: number }>);

vi.mock('react-window', () => ({
  useListRef: () => ({ current: null }),
  List: ({
    rowCount,
    onRowsRendered,
  }: {
    rowCount: number;
    onRowsRendered: (rows: { startIndex: number; stopIndex: number }) => void;
  }) => {
    useEffect(() => {
      const rows = { startIndex: 0, stopIndex: rowCount - 1 };
      renderedRanges.push(rows);
      onRowsRendered(rows);
    });
    return null;
  },
}));

import { MessageList } from '../MessageList';

const notes: LoveNote[] = ['1', '2', '3'].map((id) => ({
  id,
  from_user_id: 'partner',
  to_user_id: 'me',
  content: `note ${id}`,
  created_at: `2026-09-20T10:00:0${id}.000Z`,
}));

function list(onLoadMore: () => void) {
  return (
    <MessageList
      notes={notes}
      currentUserId="me"
      partnerName="Partner"
      userName="Me"
      isLoading={false}
      hasMore
      onLoadMore={onLoadMore}
    />
  );
}

let online = true;

beforeEach(() => {
  vi.useFakeTimers();
  renderedRanges.length = 0;
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MessageList load-more across a reconnect', () => {
  it('asks for nothing offline, and loads the older page on the next scroll once online', async () => {
    online = false;
    const onLoadMore = vi.fn();
    const { rerender } = render(list(onLoadMore));

    // The loader reached the unloaded row offline: no load, and a further
    // scroll offline asks for nothing either.
    expect(renderedRanges.length).toBeGreaterThan(0);
    rerender(list(onLoadMore));
    expect(onLoadMore).not.toHaveBeenCalled();

    // Back online: the network status settles after its debounce.
    online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.runAllTimersAsync();
    });
    // The next scroll up.
    rerender(list(onLoadMore));

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('online, loads the older page as before', () => {
    const onLoadMore = vi.fn();
    render(list(onLoadMore));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
