/**
 * PartnerView on the real store: a partner reload over a confirmed "unlinked"
 * answer (a reconnect refresh, Retry) must not swap the Connect screen for the
 * loading block, because that unmounts `PartnerConnect` and loses the typed
 * email, the shown search answer and the error line, which live in it.
 * `loadPartner` raises the flag only while nothing has answered (DW-501).
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPartner = vi.fn();
const searchUsers = vi.fn();
const sendPartnerRequest = vi.fn();

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../api/partnerService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/partnerService')>()),
  partnerService: {
    getPartner: () => getPartner(),
    getPendingRequests: async () => ({ sent: [], received: [] }),
    searchUsers: (email: string) => searchUsers(email),
    sendPartnerRequest: (id: string) => sendPartnerRequest(id),
  },
}));
vi.mock('../../../hooks/usePartnerStreakListener', () => ({
  usePartnerStreakListener: vi.fn(),
}));

import { openMyLoveDB } from '../../../services/dbSchema';
import { useAppStore } from '../../../stores/useAppStore';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';
import { PartnerView } from '../PartnerView';

const USER = 'USER-A-ID';
const TARGET_ID = '00000000-0000-4000-8000-00000000f00d';
const EMAIL = 'jessie@example.test';
const LOADING = 'Loading partner information...';

function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

async function clearCopies(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

const store = () => useAppStore.getState();

describe('PartnerView: a reload over a confirmed unlinked answer', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setOnline(true);
    store().clearAuth();
    store().setAuthUser(USER);
    await clearCopies();
    getPartner.mockResolvedValue({ status: 'unlinked' });
    window.history.replaceState(null, '', '/partner');
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await clearCopies();
    window.history.replaceState(null, '', '/');
  });

  it('keeps the typed email, the shown answer and the error line across a reload', async () => {
    searchUsers.mockResolvedValue({
      status: 'found',
      user: { id: TARGET_ID, email: EMAIL, displayName: 'Jessie' },
    });
    sendPartnerRequest.mockRejectedValue(new Error('Request refused'));
    const user = userEvent.setup();
    render(<PartnerView />);

    await screen.findByTestId('partner-search-card');
    await user.type(screen.getByLabelText("Your partner's email"), EMAIL);
    await user.click(screen.getByRole('button', { name: 'Find' }));
    await user.click(await screen.findByTestId(`send-request-${TARGET_ID}`));
    await screen.findByTestId('partner-connection-error');

    // A reconnect refresh (or Retry) while the server read is still open.
    const server = deferred<unknown>();
    getPartner.mockReturnValue(server.promise);
    let reload: Promise<void> = Promise.resolve();
    act(() => {
      reload = store().loadPartner();
    });
    await waitFor(() => expect(getPartner).toHaveBeenCalledTimes(2));

    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your partner's email")).toHaveValue(EMAIL);
    expect(screen.getByTestId('partner-search-results')).toHaveTextContent('Jessie');
    expect(screen.getByTestId('partner-connection-error')).toHaveTextContent('Request refused');

    await act(async () => {
      server.settle({ status: 'unlinked' });
      await reload;
    });

    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your partner's email")).toHaveValue(EMAIL);
    expect(screen.getByTestId('partner-search-results')).toHaveTextContent('Jessie');
    expect(screen.getByTestId('partner-connection-error')).toHaveTextContent('Request refused');
  });

  it('still shows the loading block on the first load, while nothing has answered', async () => {
    const server = deferred<unknown>();
    getPartner.mockReturnValue(server.promise);
    render(<PartnerView />);

    expect(await screen.findByText(LOADING)).toBeInTheDocument();
    expect(screen.queryByTestId('partner-search-card')).not.toBeInTheDocument();

    await act(async () => {
      server.settle({ status: 'unlinked' });
    });
    expect(await screen.findByTestId('partner-search-card')).toBeInTheDocument();
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
  });

  describe('the /partner/history redirect', () => {
    beforeEach(() => {
      window.history.replaceState(null, '', '/partner');
      window.history.pushState({ inApp: true, depth: 1 }, '', '/partner/history');
    });

    it('opened over a confirmed unlinked answer (no load raised): still leaves the page', async () => {
      const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
      await store().loadPartner();
      expect(store().partnerKnown).toBe(true);
      act(() => store().showPartnerPage('history'));

      render(<PartnerView />);

      await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
      expect(store().partnerPath).toBe('');
      expect(await screen.findByTestId('partner-search-card')).toBeInTheDocument();
      expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    });

    it('a fresh load of it: waits for the answer, then leaves', async () => {
      const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
      const server = deferred<unknown>();
      getPartner.mockReturnValue(server.promise);
      act(() => store().showPartnerPage('history'));

      render(<PartnerView />);
      expect(await screen.findByText(LOADING)).toBeInTheDocument();
      expect(back).not.toHaveBeenCalled();

      await act(async () => {
        server.settle({ status: 'unlinked' });
      });

      await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
      expect(store().partnerPath).toBe('');
    });
  });
});
