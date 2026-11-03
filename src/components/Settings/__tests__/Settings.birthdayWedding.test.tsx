/**
 * Settings "Wedding" (spec-unified-data-storage story 4).
 *
 * The row reads `coupleSettings` from the real store; the store actions are
 * spied so these cases are about the row. The wedding date is any date, linked
 * couples only, and has a Clear. The birthday moved to the Profile pages, whose
 * cases are in `Settings.profile.test.tsx`.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/supabaseClient', () => ({
  lookupPartnerId: vi.fn(),
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../api/authService', () => ({
  authService: { signOut: vi.fn() },
}));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../AnniversarySettings', () => ({ AnniversarySettings: () => null }));
vi.mock('../EventsSettings', () => ({ EventsSettings: () => null }));

import { AccountDataError } from '../../../services/accountDataError';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';

const real = {
  setWeddingDate: useAppStore.getState().setWeddingDate,
};

const LINKED = { status: 'linked', partnerId: 'p', relationshipStart: null } as const;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  useAppStore.setState({ coupleSettings: null, ...real });
});

describe('Settings — Wedding', () => {
  it('is hidden for an unlinked account', () => {
    useAppStore.setState({ coupleSettings: { status: 'unlinked' } });
    render(<Settings />);

    expect(screen.queryByTestId('settings-wedding')).toBeNull();
  });

  it('linked, not set: "Not set yet", an empty field and no Clear', () => {
    useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: null } });
    render(<Settings />);

    expect(screen.getByTestId('settings-wedding-value')).toHaveTextContent('Not set yet');
    expect(screen.getByTestId('settings-wedding-date')).toHaveValue('');
    expect(screen.queryByTestId('settings-wedding-clear')).toBeNull();
  });

  it('saves any date, including one in the future', async () => {
    const user = userEvent.setup();
    // Pinned before render, so the date below stays in the future whenever
    // this runs.
    vi.setSystemTime(new Date(2026, 8, 25, 12, 0, 0));
    useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: null } });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setWeddingDate: save });
    render(<Settings />);

    await user.type(screen.getByTestId('settings-wedding-date'), '2027-06-19');
    await user.click(screen.getByTestId('settings-wedding-save'));

    await waitFor(() => expect(save).toHaveBeenCalledWith('2027-06-19'));
  });

  it('clears a saved wedding date', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: '2027-06-19' } });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setWeddingDate: save });
    render(<Settings />);

    expect(screen.getByTestId('settings-wedding-date')).toHaveValue('2027-06-19');
    await user.click(screen.getByTestId('settings-wedding-clear'));

    await waitFor(() => expect(save).toHaveBeenCalledWith(null));
  });

  it('shows why a save was refused, and sends nothing without a date', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: '2027-06-19' } });
    const save = vi.fn(async () => {
      throw new AccountDataError('offline', 'You are offline. Couple settings need a connection to save.');
    });
    useAppStore.setState({ setWeddingDate: save });
    render(<Settings />);

    await user.click(screen.getByTestId('settings-wedding-clear'));
    expect(await screen.findByTestId('settings-wedding-error')).toHaveTextContent(
      /need a connection/
    );

    save.mockClear();
    await user.clear(screen.getByTestId('settings-wedding-date'));
    await user.click(screen.getByTestId('settings-wedding-save'));
    expect(await screen.findByTestId('settings-wedding-error')).toHaveTextContent(/pick a date/i);
    expect(save).not.toHaveBeenCalled();
  });
});
