/**
 * DW-113's third half: the part a person actually sees.
 *
 * The hook now reports a feed status and `useLoveNotes` passes it through, and
 * both of those are covered — `useRealtimeMessages.closes.test.ts` pins the
 * transitions. What nothing asserted is the render: whether the notice appears
 * at all, what it says, and whether it stays out of the way when the feed is
 * healthy. A regression that deleted the `<span>`, inverted the ternary, or
 * dropped `realtimeStatus` from the hook's return object would have been caught
 * by nothing here.
 *
 * `useLoveNotes` is mocked rather than driven, because what is under test is
 * what `LoveNotes` does with a status, not how the status is produced.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteFeedStatus } from '../../../hooks/useRealtimeMessages';

const api = vi.hoisted(() => ({
  getOwnDisplayName: vi.fn(),
  getPartnerDisplayName: vi.fn(),
  getUser: vi.fn(),
}));

const feed = vi.hoisted(() => ({
  status: 'connected' as NoteFeedStatus,
  error: null as string | null,
}));

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
    error: feed.error,
    hasMore: false,
    fetchOlderNotes: vi.fn(),
    clearError: vi.fn(),
    retryFailedMessage: vi.fn(),
    realtimeStatus: feed.status,
  }),
}));

const storeState = {
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
vi.mock('motion/react', () => ({
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
const ROW = 'notes-partner-row';

async function renderWith(status: NoteFeedStatus) {
  feed.status = status;
  const { LoveNotes } = await import('../LoveNotes');
  return render(<LoveNotes />);
}

describe('LoveNotes realtime notice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feed.error = null;
    api.getUser.mockResolvedValue({ email: 'someone@example.com' });
    api.getOwnDisplayName.mockResolvedValue(null);
    api.getPartnerDisplayName.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  describe('says nothing while there is nothing to say', () => {
    // An announcement that always fires is the one nobody listens to on the
    // day it matters, so a healthy feed must not narrate itself.
    it.each(['connected', 'connecting', 'idle'] as const)('renders no notice for %s', async (status) => {
      await renderWith(status);

      expect(screen.queryByTestId(NOTICE)).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it.each(['connecting', 'idle'] as const)('shows the name alone for %s', async (status) => {
      await renderWith(status);

      const row = screen.getByTestId(ROW);
      expect(row).toHaveTextContent(/^PPartner$/);
      expect(row).not.toHaveTextContent(/Connected|Reconnecting|Not receiving/);
    });
  });

  describe('the partner row', () => {
    it('shows a quiet "Connected" line with a good dot when the feed is up', async () => {
      await renderWith('connected');

      const row = screen.getByTestId(ROW);
      const line = within(row).getByText('Connected');
      expect(line).toHaveClass('text-muted');
      expect(within(line).getByTestId('realtime-connection-status-dot')).toHaveClass('bg-good');
      // The feed status, not presence: there is no presence feature.
      expect(row).not.toHaveTextContent(/online/i);
      // Not a live region -- only the two unhealthy states are announced.
      expect(line).not.toHaveAttribute('role');
      expect(line).not.toHaveAttribute('aria-live');
    });

    it('falls back to "Partner" and a "P" initial when the name is unknown', async () => {
      await renderWith('connected');

      const row = screen.getByTestId(ROW);
      expect(within(row).getByText('Partner')).toHaveClass('text-ink');
      const avatar = within(row).getByText('P');
      expect(avatar).toHaveClass('bg-partner', 'text-card');
    });

    it('uses the partner name and its initial once it is known', async () => {
      api.getPartnerDisplayName.mockResolvedValue('harper');
      await renderWith('connected');

      const row = screen.getByTestId(ROW);
      expect(await within(row).findByText('harper')).toBeVisible();
      expect(within(row).getByText('H')).toHaveClass('bg-partner');
    });

    it('keeps a level-1 "Love Notes" heading, visually hidden, and no back control', async () => {
      await renderWith('connected');

      const heading = screen.getByRole('heading', { level: 1, name: 'Love Notes' });
      expect(heading).toHaveClass('sr-only');
      expect(screen.queryByRole('button', { name: /go back home/i })).toBeNull();
    });
  });

  it('says the feed is reconnecting while it still might recover', async () => {
    await renderWith('reconnecting');

    const notice = screen.getByTestId(NOTICE);
    expect(notice).toHaveTextContent('Reconnecting');
    // Announced, not merely shown: this appears without the person having done
    // anything.
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    // Kit `muted`, with a `muted` dot: still recovering, so not an alarm.
    expect(notice).toHaveClass('text-muted');
    expect(within(notice).getByTestId('realtime-connection-status-dot')).toHaveClass('bg-muted');
    // It sits in the partner row, not a header of its own.
    expect(screen.getByTestId(ROW)).toContainElement(notice);
  });

  it('says the feed has stopped once it has given up', async () => {
    await renderWith('disconnected');

    const notice = screen.getByTestId(NOTICE);
    // States what is true of the feed rather than promising a recovery that is
    // not coming: `disconnected` is terminal for the mount.
    expect(notice).toHaveTextContent('Not receiving new notes');
    expect(notice.textContent).not.toMatch(/reconnect/i);
    expect(notice).toHaveClass('text-danger');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(within(notice).getByTestId('realtime-connection-status-dot')).toHaveClass('bg-danger');
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

  it('announces the error banner as an alert', async () => {
    // DW-172: an error can appear without the person having done anything, so
    // the banner has to be announced rather than only seen.
    feed.error = 'Failed to load notes';
    await renderWith('connected');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load notes');
    // Only the message is announced, not the Dismiss control beside it.
    expect(alert).not.toHaveTextContent('Dismiss');
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
