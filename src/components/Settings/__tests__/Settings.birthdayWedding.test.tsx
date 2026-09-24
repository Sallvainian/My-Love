/**
 * Settings "Birthday" and "Wedding" (spec-unified-data-storage story 4).
 *
 * The rows read `ownProfile` and `coupleSettings` from the real store; the
 * store actions are spied so these cases are about the rows. The birthday must
 * be in the past and has no Clear; the wedding date is any date, linked
 * couples only, and has a Clear.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  lookupOwnDisplayName: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  lookupOwnDisplayName: backend.lookupOwnDisplayName,
  lookupPartnerId: vi.fn(),
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: backend.getUser, signOut: vi.fn() },
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
  setBirthday: useAppStore.getState().setBirthday,
  setWeddingDate: useAppStore.getState().setWeddingDate,
};

const LINKED = { status: 'linked', partnerId: 'p', relationshipStart: null } as const;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
  backend.lookupOwnDisplayName.mockResolvedValue({ status: 'unset' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAppStore.setState({ ownProfile: null, coupleSettings: null, ...real });
});

describe('Settings — Birthday', () => {
  it('shows "Not set yet" and an empty field when no birthday is saved', () => {
    useAppStore.setState({ ownProfile: { displayName: null, birthday: null } });
    render(<Settings />);

    expect(screen.getByTestId('settings-birthday-value')).toHaveTextContent('Not set yet');
    expect(screen.getByTestId('settings-birthday-date')).toHaveValue('');
  });

  it('shows the saved birthday, pre-fills it, and offers no Clear', () => {
    useAppStore.setState({ ownProfile: { displayName: 'Sam', birthday: '2000-05-20' } });
    render(<Settings />);

    expect(screen.getByTestId('settings-birthday-value')).toHaveTextContent('2000');
    expect(screen.getByTestId('settings-birthday-date')).toHaveValue('2000-05-20');
    expect(screen.queryByTestId('settings-birthday-clear')).toBeNull();
  });

  it('saves the picked date as YYYY-MM-DD', async () => {
    useAppStore.setState({ ownProfile: { displayName: null, birthday: null } });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setBirthday: save });
    render(<Settings />);

    fireEvent.change(screen.getByTestId('settings-birthday-date'), {
      target: { value: '2000-05-20' },
    });
    fireEvent.click(screen.getByTestId('settings-birthday-save'));

    await waitFor(() => expect(save).toHaveBeenCalledWith('2000-05-20'));
    expect(screen.queryByTestId('settings-birthday-error')).toBeNull();
  });

  it('refuses a birthday that is not in the past, and sends nothing', async () => {
    useAppStore.setState({ ownProfile: { displayName: null, birthday: null } });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setBirthday: save });
    render(<Settings />);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    fireEvent.change(screen.getByTestId('settings-birthday-date'), { target: { value: today } });
    fireEvent.click(screen.getByTestId('settings-birthday-save'));

    expect(await screen.findByTestId('settings-birthday-error')).toHaveTextContent(/in the past/i);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a birthday before 1900 (a mistyped year), and sends nothing', async () => {
    useAppStore.setState({ ownProfile: { displayName: null, birthday: null } });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setBirthday: save });
    render(<Settings />);

    expect(screen.getByTestId('settings-birthday-date')).toHaveAttribute('min', '1900-01-01');
    fireEvent.change(screen.getByTestId('settings-birthday-date'), {
      target: { value: '0198-03-10' },
    });
    fireEvent.click(screen.getByTestId('settings-birthday-save'));

    expect(await screen.findByTestId('settings-birthday-error')).toHaveTextContent(/after 1900/i);
    expect(save).not.toHaveBeenCalled();
  });

  // Matrix: "Offline edit" and "Save error shown in Settings, value unchanged".
  it('shows why a save was refused, and keeps the shown value', async () => {
    useAppStore.setState({ ownProfile: { displayName: null, birthday: '2000-05-20' } });
    const save = vi.fn(async () => {
      throw new AccountDataError('offline', 'You are offline. Profile changes need a connection to save.');
    });
    useAppStore.setState({ setBirthday: save });
    render(<Settings />);

    fireEvent.change(screen.getByTestId('settings-birthday-date'), {
      target: { value: '1999-04-11' },
    });
    fireEvent.click(screen.getByTestId('settings-birthday-save'));

    expect(await screen.findByTestId('settings-birthday-error')).toHaveTextContent(
      /need a connection/
    );
    expect(useAppStore.getState().ownProfile?.birthday).toBe('2000-05-20');
  });
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
    useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: null } });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setWeddingDate: save });
    render(<Settings />);

    const nextYear = new Date().getFullYear() + 1;
    fireEvent.change(screen.getByTestId('settings-wedding-date'), {
      target: { value: `${nextYear}-06-12` },
    });
    fireEvent.click(screen.getByTestId('settings-wedding-save'));

    await waitFor(() => expect(save).toHaveBeenCalledWith(`${nextYear}-06-12`));
  });

  it('clears a saved wedding date', async () => {
    useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: '2027-06-19' } });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setWeddingDate: save });
    render(<Settings />);

    expect(screen.getByTestId('settings-wedding-date')).toHaveValue('2027-06-19');
    fireEvent.click(screen.getByTestId('settings-wedding-clear'));

    await waitFor(() => expect(save).toHaveBeenCalledWith(null));
  });

  it('shows why a save was refused, and sends nothing without a date', async () => {
    useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: '2027-06-19' } });
    const save = vi.fn(async () => {
      throw new AccountDataError('offline', 'You are offline. Couple settings need a connection to save.');
    });
    useAppStore.setState({ setWeddingDate: save });
    render(<Settings />);

    fireEvent.click(screen.getByTestId('settings-wedding-clear'));
    expect(await screen.findByTestId('settings-wedding-error')).toHaveTextContent(
      /need a connection/
    );

    save.mockClear();
    fireEvent.change(screen.getByTestId('settings-wedding-date'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('settings-wedding-save'));
    expect(await screen.findByTestId('settings-wedding-error')).toHaveTextContent(/pick a date/i);
    expect(save).not.toHaveBeenCalled();
  });
});
