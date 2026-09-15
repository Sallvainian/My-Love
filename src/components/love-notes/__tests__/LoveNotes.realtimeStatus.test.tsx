/**
 * DW-113's third half: the part a person actually sees.
 *
 * The hook now reports a feed status and `useLoveNotes` passes it through, and
 * both of those are covered — `useRealtimeMessages.test.ts` pins the
 * transitions. What nothing asserted is the render: whether the notice appears
 * at all, what it says, and whether it stays out of the way when the feed is
 * healthy. A regression that deleted the `<span>`, inverted the ternary, or
 * dropped `realtimeStatus` from the hook's return object would have been caught
 * by nothing here.
 *
 * `useLoveNotes` is mocked rather than driven, because what is under test is
 * what `LoveNotes` does with a status, not how the status is produced.
 */
import { cleanup, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteFeedStatus } from '../../../hooks/useRealtimeMessages';

const api = vi.hoisted(() => ({
  getOwnDisplayName: vi.fn(),
  getPartnerDisplayName: vi.fn(),
  getUser: vi.fn(),
}));

const feed = vi.hoisted(() => ({ status: 'connected' as NoteFeedStatus }));

vi.mock('../../../api/supabaseClient', () => ({
  getOwnDisplayName: api.getOwnDisplayName,
  getPartnerDisplayName: api.getPartnerDisplayName,
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: api.getUser },
}));
vi.mock('../../../hooks/useLoveNotes', () => ({
  useLoveNotes: () => ({
    notes: [],
    isLoading: false,
    error: null,
    hasMore: false,
    fetchOlderNotes: vi.fn(),
    clearError: vi.fn(),
    retryFailedMessage: vi.fn(),
    realtimeStatus: feed.status,
  }),
}));

const storeState = {
  navigateHome: vi.fn(),
  userId: 'user-a',
  removeNote: vi.fn(),
};
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('../MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />,
}));
vi.mock('../MessageInput', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
          <div {...rest}>{children}</div>
        ),
    }
  ),
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const NOTICE = 'realtime-connection-status-notes';

async function renderWith(status: NoteFeedStatus) {
  feed.status = status;
  const { LoveNotes } = await import('../LoveNotes');
  return render(<LoveNotes />);
}

describe('LoveNotes realtime notice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getUser.mockResolvedValue({ email: 'someone@example.com' });
    api.getOwnDisplayName.mockResolvedValue(null);
    api.getPartnerDisplayName.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  describe('says nothing while there is nothing to say', () => {
    // A badge that is always on screen is the one nobody reads on the day it
    // matters, so a healthy feed must not narrate itself.
    it.each(['connected', 'connecting', 'idle'] as const)('renders no notice for %s', async (status) => {
      await renderWith(status);

      expect(screen.queryByTestId(NOTICE)).toBeNull();
    });
  });

  it('says the feed is reconnecting while it still might recover', async () => {
    await renderWith('reconnecting');

    const notice = screen.getByTestId(NOTICE);
    expect(notice).toHaveTextContent('Reconnecting');
    // Announced, not merely shown: this appears without the person having done
    // anything, which is the same treatment the error banner gets.
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    // amber-700, not amber-600: 5.05:1 against white versus 3.19:1, and this
    // change is the one that raised the AA floor on the two red buttons.
    expect(notice.className).toContain('text-amber-700');
  });

  it('says the feed has stopped once it has given up', async () => {
    await renderWith('disconnected');

    const notice = screen.getByTestId(NOTICE);
    // States what is true of the feed rather than promising a recovery that is
    // not coming: `disconnected` is terminal for the mount.
    expect(notice).toHaveTextContent('Not receiving new notes');
    expect(notice.textContent).not.toMatch(/reconnect/i);
    expect(notice.className).toContain('text-red-600');
  });

  it('gives the two visible states different text', async () => {
    await renderWith('reconnecting');
    const reconnecting = screen.getByTestId(NOTICE).textContent;
    cleanup();

    await renderWith('disconnected');
    const disconnected = screen.getByTestId(NOTICE).textContent;

    expect(reconnecting).toBeTruthy();
    expect(disconnected).not.toBe(reconnecting);
  });

  it('does not collide with the partner-mood feed indicator', async () => {
    // `PartnerMoodView.tsx:548` uses the unsuffixed id for a different feed
    // with a different vocabulary. Selecting on the bare id here must find
    // nothing, so a spec written against it cannot bind to the wrong view.
    await renderWith('disconnected');

    expect(screen.queryByTestId('realtime-connection-status')).toBeNull();
    expect(screen.getByTestId(NOTICE)).toBeVisible();
  });
});
