/**
 * AnniversarySettings wiring to the server-first store actions.
 *
 * The actions throw when the server refuses a write (offline included), and
 * the component must keep the form or dialog open with the reason on screen
 * rather than closing as if the change had been saved. The real store is
 * used; only the three write actions are stubbed.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: MotionDivProps) => {
      const { initial: _i, animate: _a, exit: _e, ...rest } = props as Record<string, unknown>;
      return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { useAppStore } from '../../../stores/useAppStore';
import type { AppState } from '../../../stores/types';
import { AnniversarySettings } from '../AnniversarySettings';

const OFFLINE = 'You are offline. Anniversaries need a connection to save.';

const addAnniversary = vi.fn();
const updateAnniversary = vi.fn();
const removeAnniversary = vi.fn();

beforeEach(() => {
  for (const fn of [addAnniversary, updateAnniversary, removeAnniversary]) fn.mockReset();
  const settings = useAppStore.getState().settings!;
  useAppStore.setState({
    addAnniversary,
    updateAnniversary,
    removeAnniversary,
    settings: {
      ...settings,
      relationship: {
        ...settings.relationship,
        anniversaries: [{ id: 7, date: '2024-02-14', label: 'First date', serverId: 'ann-7' }],
      },
    },
  } as Partial<AppState>);
});

afterEach(() => {
  cleanup();
});

function fillForm(label: string, date: string) {
  fireEvent.change(screen.getByLabelText(/^Label/), { target: { value: label } });
  fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: date } });
}

describe('AnniversarySettings writes', () => {
  it('editing calls updateAnniversary with the row’s id and the form data, then closes', async () => {
    updateAnniversary.mockResolvedValue(undefined);
    render(<AnniversarySettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit First date' }));
    fillForm('First date, again', '2024-02-15');
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() =>
      expect(updateAnniversary).toHaveBeenCalledWith(7, {
        label: 'First date, again',
        date: '2024-02-15',
        description: undefined,
      })
    );
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Anniversary' })).toBeNull());
    expect(addAnniversary).not.toHaveBeenCalled();
  });

  it('a rejected add keeps the form open and shows why', async () => {
    addAnniversary.mockRejectedValue(new Error(OFFLINE));
    render(<AnniversarySettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Anniversary' }));
    fillForm('Moving day', '2025-06-01');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
    expect(addAnniversary).toHaveBeenCalledWith(
      { label: 'Moving day', date: '2025-06-01', description: undefined },
      expect.any(String)
    );
    expect(screen.getByRole('heading', { name: 'Add Anniversary' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Label/)).toHaveValue('Moving day');
  });

  it('retrying the same add reuses its key; changing the form mints a new one', async () => {
    addAnniversary.mockRejectedValue(new Error(OFFLINE));
    render(<AnniversarySettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Anniversary' }));
    fillForm('Moving day', '2025-06-01');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByText(OFFLINE);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(addAnniversary).toHaveBeenCalledTimes(2));

    fillForm('Moving day!', '2025-06-01');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(addAnniversary).toHaveBeenCalledTimes(3));

    const keys = addAnniversary.mock.calls.map((call) => call[1]);
    // A lost response then a retry resolves to one row only if the key repeats.
    expect(keys[1]).toBe(keys[0]);
    // Different content must not reuse it, or the server would hand back the
    // first row and drop the edit.
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('a rejected update keeps the form open and shows why', async () => {
    updateAnniversary.mockRejectedValue(new Error(OFFLINE));
    render(<AnniversarySettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit First date' }));
    fillForm('Edited', '2024-02-14');
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit Anniversary' })).toBeInTheDocument();
  });

  it('a rejected delete keeps the dialog open with an alert', async () => {
    removeAnniversary.mockRejectedValue(new Error(OFFLINE));
    render(<AnniversarySettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete First date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(OFFLINE);
    expect(removeAnniversary).toHaveBeenCalledWith(7);
    expect(screen.getByRole('heading', { name: 'Delete Anniversary?' })).toBeInTheDocument();
    expect(screen.getByText('First date')).toBeInTheDocument();
  });

  it('says an empty list in the subtitle alone, with no empty block', () => {
    const settings = useAppStore.getState().settings!;
    useAppStore.setState({
      settings: { ...settings, relationship: { ...settings.relationship, anniversaries: [] } },
    } as Partial<AppState>);
    render(<AnniversarySettings />);

    expect(screen.getByRole('heading', { level: 3, name: 'Anniversaries' })).toBeInTheDocument();
    expect(screen.getByTestId('anniversaries-subtitle').textContent).toBe(
      'Special dates · none yet'
    );
    expect(screen.queryByText(/No anniversaries yet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anniversary Countdowns/)).not.toBeInTheDocument();
  });

  it('drops "none yet" from the subtitle once there is an anniversary', () => {
    render(<AnniversarySettings />);

    expect(screen.getByTestId('anniversaries-subtitle').textContent).toBe('Special dates');
    expect(screen.getByRole('heading', { level: 4, name: 'First date' })).toBeInTheDocument();
  });
});
