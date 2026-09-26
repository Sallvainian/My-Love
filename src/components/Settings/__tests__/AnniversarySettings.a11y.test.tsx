/**
 * AnniversarySettings dialogs and rows, as assistive technology meets them.
 *
 * Mirrors what EventsSettings already does: both dialogs are named modal
 * dialogs that trap focus, close on Escape and hand focus back to their
 * opener; a field error is linked to its input and announced; every row's
 * buttons say which anniversary they act on; and a dialog cannot be dismissed
 * while its write is in flight.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => ({
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
        anniversaries: [
          { id: 7, date: '2024-02-14', label: 'First date', serverId: 'ann-7' },
          { id: 8, date: '2025-06-01', label: 'Moving day', serverId: 'ann-8' },
        ],
      },
    },
  } as Partial<AppState>);
});

afterEach(() => {
  cleanup();
});

/**
 * A row opener is found by its verb alone ("Edit …", "Delete …", first row), so
 * these dialog tests do not depend on the row names DW-188 changes.
 */
async function openWith(
  user: UserEvent,
  name: 'Add Anniversary' | 'Edit' | 'Delete'
): Promise<HTMLElement> {
  const opener =
    name === 'Add Anniversary'
      ? screen.getByRole('button', { name })
      : screen.getAllByRole('button', { name: new RegExp(`^${name} `) })[0];
  await user.click(opener);
  return opener;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('DW-188: row buttons name their anniversary', () => {
  it('two rows yield two distinct Edit and Delete names', () => {
    render(<AnniversarySettings />);

    expect(screen.getByRole('button', { name: 'Edit First date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Moving day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete First date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Moving day' })).toBeInTheDocument();
  });
});

describe('DW-184: dialog semantics and focus', () => {
  it('the delete confirmation is a named modal dialog that starts on Cancel', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    await openWith(user, 'Delete');

    const dialog = screen.getByRole('dialog', { name: 'Delete Anniversary?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Cancel takes initial focus because the delete cannot be undone.
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('Escape closes the delete confirmation and focus returns to its opener', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    const opener = await openWith(user, 'Delete');
    expect(screen.getByRole('dialog', { name: 'Delete Anniversary?' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Delete Anniversary?' })).toBeNull();
    expect(removeAnniversary).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it('the edit form is a named modal dialog that starts on the label field', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    await openWith(user, 'Edit');

    const dialog = screen.getByRole('dialog', { name: 'Edit Anniversary' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText(/^Label/)).toHaveFocus();
  });

  it('Escape closes the add form and focus returns to its opener', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    const opener = await openWith(user, 'Add Anniversary');
    expect(screen.getByRole('dialog', { name: 'Add Anniversary' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('Tab from the last control wraps to the first inside the form', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    await openWith(user, 'Add Anniversary');

    const submit = screen.getByRole('button', { name: 'Add' });
    submit.focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Close form' })).toHaveFocus();
  });

  it('after a successful delete removes the opener, focus lands on Add Anniversary', async () => {
    const user = userEvent.setup();
    removeAnniversary.mockImplementation(async (id: number) => {
      const settings = useAppStore.getState().settings!;
      useAppStore.setState({
        settings: {
          ...settings,
          relationship: {
            ...settings.relationship,
            anniversaries: settings.relationship.anniversaries.filter((a) => a.id !== id),
          },
        },
      } as Partial<AppState>);
    });
    render(<AnniversarySettings />);
    await openWith(user, 'Delete');

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Delete First date' })).toBeNull();
    // The fallback focus runs in a passive-phase effect cleanup, which can land
    // after the waitFor above has seen the dialog removed — poll for it.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add Anniversary' })).toHaveFocus()
    );
  });
});

describe('DW-187: form errors are linked and announced', () => {
  it('an invalid field is marked invalid, described by its error, and the error is an alert', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    await openWith(user, 'Add Anniversary');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    const label = screen.getByLabelText(/^Label/);
    expect(label).toHaveAttribute('aria-invalid', 'true');
    expect(label).toHaveAccessibleDescription('Anniversary label cannot be empty');

    const date = screen.getByLabelText(/^Date/);
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAccessibleDescription('Date is required');

    const alerts = screen.getAllByRole('alert').map((node) => node.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining(['Anniversary label cannot be empty', 'Date is required'])
    );
  });

  it('editing a field drops its error, leaving the other field’s in place', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    await openWith(user, 'Add Anniversary');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const label = screen.getByLabelText(/^Label/);
    await user.type(label, 'Moving day');

    expect(label).toHaveAttribute('aria-invalid', 'false');
    expect(label).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('Anniversary label cannot be empty')).toBeNull();
    expect(screen.getByLabelText(/^Date/)).toHaveAttribute('aria-invalid', 'true');

    const date = screen.getByLabelText(/^Date/);
    await user.type(date, '2025-06-01');

    expect(date).toHaveAttribute('aria-invalid', 'false');
    expect(date).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a valid field is not marked invalid and has no description', async () => {
    const user = userEvent.setup();
    render(<AnniversarySettings />);
    await openWith(user, 'Add Anniversary');

    const label = screen.getByLabelText(/^Label/);
    expect(label).toHaveAttribute('aria-invalid', 'false');
    expect(label).not.toHaveAttribute('aria-describedby');
  });

  it('a failed save is announced as an alert', async () => {
    const user = userEvent.setup();
    addAnniversary.mockRejectedValue(new Error('You are offline.'));
    render(<AnniversarySettings />);
    await openWith(user, 'Add Anniversary');

    await user.type(screen.getByLabelText(/^Label/), 'Moving day');
    await user.type(screen.getByLabelText(/^Date/), '2025-06-01');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You are offline.');
    // Focus goes to the re-enabled Save, as EventForm does.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus());
  });

  it('a failed delete hands focus to Cancel', async () => {
    const user = userEvent.setup();
    removeAnniversary.mockRejectedValue(new Error('You are offline.'));
    render(<AnniversarySettings />);
    await openWith(user, 'Delete');

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You are offline.');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toBeEnabled();
    // Focus moves in a passive effect after the alert renders — same race.
    await waitFor(() => expect(cancel).toHaveFocus());
  });
});

describe('DW-191: a dialog stays put while its write is pending', () => {
  it('the delete confirmation disables Cancel and ignores Escape and the backdrop', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    removeAnniversary.mockReturnValue(pending.promise);
    render(<AnniversarySettings />);
    await openWith(user, 'Delete');

    const dialog = screen.getByRole('dialog', { name: 'Delete Anniversary?' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    // The write parked focus on the panel, where the trap listens for Escape.
    expect(dialog.firstElementChild).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.click(dialog);
    expect(screen.getByRole('dialog', { name: 'Delete Anniversary?' })).toBeInTheDocument();

    pending.resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('the form disables Cancel and Close and ignores Escape and the backdrop', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    addAnniversary.mockReturnValue(pending.promise);
    render(<AnniversarySettings />);
    await openWith(user, 'Add Anniversary');

    const dialog = screen.getByRole('dialog', { name: 'Add Anniversary' });
    await user.type(screen.getByLabelText(/^Label/), 'Moving day');
    await user.type(screen.getByLabelText(/^Date/), '2025-06-01');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(addAnniversary).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close form' })).toBeDisabled();
    // The write parked focus on the panel, where the trap listens for Escape.
    expect(dialog.firstElementChild).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.click(dialog);
    expect(screen.getByRole('dialog', { name: 'Add Anniversary' })).toBeInTheDocument();

    pending.resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
