/**
 * Settings "Together since": the couple's shared start date and time
 * (spec-unified-data-storage story 3). The row reads `coupleSettings` from the
 * real store; the store action is spied so these cases are about the row.
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

import { AccountDataError } from '../../../services/accountDataError';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';

const START = new Date(2025, 9, 18, 18, 0, 0).toISOString();
const realSetRelationshipStart = useAppStore.getState().setRelationshipStart;

describe('Settings — Together since', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Frankie' });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.setState({ coupleSettings: null, setRelationshipStart: realSetRelationshipStart });
  });

  it('with no partner says to link one first and offers no inputs', () => {
    useAppStore.setState({ coupleSettings: { status: 'unlinked' } });
    render(<Settings />);

    expect(screen.getByTestId('settings-together-since-value')).toHaveTextContent(
      /link a partner first/i
    );
    expect(screen.queryByTestId('settings-together-since-date')).toBeNull();
  });

  it('linked but not set yet: "Not set yet" and empty inputs', () => {
    useAppStore.setState({
      coupleSettings: { status: 'linked', partnerId: 'p', relationshipStart: null, weddingDate: null },
    });
    render(<Settings />);

    expect(screen.getByTestId('settings-together-since-value')).toHaveTextContent('Not set yet');
    expect(screen.getByTestId('settings-together-since-date')).toHaveValue('');
  });

  it('pre-fills the saved date and time in local time', () => {
    useAppStore.setState({
      coupleSettings: { status: 'linked', partnerId: 'p', relationshipStart: START, weddingDate: null },
    });
    render(<Settings />);

    expect(screen.getByTestId('settings-together-since-date')).toHaveValue('2025-10-18');
    expect(screen.getByTestId('settings-together-since-time')).toHaveValue('18:00');
  });

  it('saves the local date and time as one instant', async () => {
    useAppStore.setState({
      coupleSettings: { status: 'linked', partnerId: 'p', relationshipStart: null, weddingDate: null },
    });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setRelationshipStart: save });
    render(<Settings />);

    fireEvent.change(screen.getByTestId('settings-together-since-date'), {
      target: { value: '2025-10-18' },
    });
    fireEvent.change(screen.getByTestId('settings-together-since-time'), {
      target: { value: '18:00' },
    });
    fireEvent.click(screen.getByTestId('settings-together-since-save'));

    await waitFor(() => expect(save).toHaveBeenCalledWith(START));
    expect(screen.queryByTestId('settings-together-since-error')).toBeNull();
  });

  it('shows why a save was refused, and sends nothing without a date', async () => {
    useAppStore.setState({
      coupleSettings: { status: 'linked', partnerId: 'p', relationshipStart: START, weddingDate: null },
    });
    const save = vi.fn(async () => {
      throw new AccountDataError(
        'offline',
        'You are offline. Couple settings need a connection to save.'
      );
    });
    useAppStore.setState({ setRelationshipStart: save });
    render(<Settings />);

    fireEvent.click(screen.getByTestId('settings-together-since-save'));
    expect(await screen.findByTestId('settings-together-since-error')).toHaveTextContent(
      /need a connection/
    );

    fireEvent.change(screen.getByTestId('settings-together-since-date'), { target: { value: '' } });
    save.mockClear();
    fireEvent.click(screen.getByTestId('settings-together-since-save'));
    expect(await screen.findByTestId('settings-together-since-error')).toHaveTextContent(
      /pick a date/i
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a start in the future and sends nothing', async () => {
    useAppStore.setState({
      coupleSettings: { status: 'linked', partnerId: 'p', relationshipStart: null, weddingDate: null },
    });
    const save = vi.fn(async () => {});
    useAppStore.setState({ setRelationshipStart: save });
    render(<Settings />);

    const nextYear = new Date().getFullYear() + 1;
    fireEvent.change(screen.getByTestId('settings-together-since-date'), {
      target: { value: `${nextYear}-01-01` },
    });
    fireEvent.click(screen.getByTestId('settings-together-since-save'));

    expect(await screen.findByTestId('settings-together-since-error')).toHaveTextContent(
      /in the past/i
    );
    expect(save).not.toHaveBeenCalled();
  });
});
