/**
 * EventsSettings — behaviour: delete, accessible names and dismissal guards
 *
 * These pin the delete, naming and dismissal rows of the story's I/O matrix —
 * what the section does, not how it is styled. The fixtures, the store double's
 * wiring and the form helpers live in eventsSettingsKit.tsx.
 */
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeAccountDataWrite } from '../../../services/accountDataQueue';
import type { AppState } from '../../../stores/types';
import {
  createEventsStoreKit,
  fillForm,
  loadOk,
  makeEvent,
  ok,
  openAddForm,
  renderSection,
  STALE,
  submitForm,
  writeFailure,
  type EventLoadResult,
  type EventWriteResult,
} from './eventsSettingsKit';

type DivProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
};

vi.mock('motion/react', () => ({
  m: {
    div: ({ children, initial: _i, animate: _a, exit: _e, ...props }: DivProps) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

/** A subscribable store double: `patch` notifies exactly as `set()` would. */
const store = vi.hoisted(() => {
  let state: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    get state() {
      return state;
    },
    replace(next: Record<string, unknown>) {
      state = next;
      notify();
    },
    patch(changes: Record<string, unknown>) {
      state = { ...state, ...changes };
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return state;
    },
  };
});

vi.mock('../../../stores/useAppStore', async () => {
  const { useSyncExternalStore } = await import('react');
  const useAppStore = () => useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { useAppStore: Object.assign(useAppStore, { getState: () => store.state }) };
});

const { setStore } = createEventsStoreKit(store);

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
});

// Sign-out (`reauthenticate`) deletes the outgoing account's mirror rows through
// the account-data queue, fire-and-forget; drain it so its log lines land inside
// the test rather than after the worker closes.
afterEach(async () => {
  await serializeAccountDataWrite(async () => {});
});

describe('EventsSettings delete', () => {
  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine', label: 'Harper visits' })] as AppState['events'],
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));

    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();
    expect(store.state.removeEvent).not.toHaveBeenCalled();
  });

  it('removes the row and closes once the confirmation is accepted', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
    expect(store.state.removeEvent).toHaveBeenCalledWith('mine');
    expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument();
    // Its last row gone, the section falls back to the empty state.
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
  });

  it('cancels without deleting', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-cancel'));

    expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument();
    expect(store.state.removeEvent).not.toHaveBeenCalled();
  });

  /** Confirms a delete that the slice refuses as not found, and waits for its alert. */
  async function rejectDeleteAsNotFound(user: UserEvent) {
    setStore({
      events: [makeEvent({ id: 'mine', label: 'Harper visits' })] as AppState['events'],
      removeEvent: vi.fn(async () =>
        writeFailure('not-found', 'Event not found or not yours to delete')
      ),
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Event not found or not yours to delete')
    );
  }

  it('keeps the row and shows the returned message when the delete is rejected', async () => {
    const user = userEvent.setup();
    await rejectDeleteAsNotFound(user);

    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(screen.queryByTestId('events-delete-confirm')).not.toBeInTheDocument();
  });

  it('styles the stale-delete Refresh as the kit primary action', async () => {
    const user = userEvent.setup();
    await rejectDeleteAsNotFound(user);

    // The kit primary action: pink fill, white label.
    expect(screen.getByTestId('events-delete-refresh')).toHaveClass('bg-fill', 'text-white');
    expect(screen.getByTestId('events-delete-refresh')).not.toHaveClass('bg-red-500');
  });

  it('keeps deliberate delete retry enabled for a transport-coded failure', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(async () =>
        writeFailure('transport', 'Event not found or not yours to delete')
      ),
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-error')).toBeInTheDocument());
    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(screen.getByTestId('events-delete-confirm')).toBeEnabled();
    expect(screen.queryByTestId('events-delete-refresh')).not.toBeInTheDocument();
  });

  it('keeps delete retry available when the action unexpectedly rejects', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(async () => {
        throw new Error('Unexpected delete rejection');
      }),
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() =>
      expect(screen.getByTestId('events-delete-error')).toHaveTextContent(
        'Unexpected delete rejection'
      )
    );
    expect(screen.getByTestId('events-delete-confirm')).toBeEnabled();
    expect(screen.queryByTestId('events-delete-refresh')).not.toBeInTheDocument();
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
  });

  it('closes a stale delete and reloads the list when Refresh events is activated', async () => {
    const user = userEvent.setup();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk);
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      removeEvent: vi.fn(async () => STALE),
    });

    await renderSection();
    loadEvents.mockClear();
    loadEvents.mockImplementationOnce(async () => {
      store.patch({ eventsError: 'Manual refresh failed' });
      return { status: 'failure', error: 'Manual refresh failed' } as const;
    });
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-refresh')).toBeInTheDocument());
    const refresh = screen.getByTestId('events-delete-refresh');
    act(() => {
      refresh.click(); // raw click: two clicks in one act() batch prove the ref guard before React commits
      refresh.click(); // raw click: a user.dblClick re-renders between clicks and would stop proving it
    });

    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
    expect(loadEvents).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument()
    );
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
  });

  it('disables the confirm control while the delete is open', async () => {
    const user = userEvent.setup();
    let releaseRemove: ((result: EventWriteResult) => void) | undefined;
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(
        () =>
          new Promise<EventWriteResult>((resolve) => {
            releaseRemove = resolve;
          })
      ),
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-confirm')).toBeDisabled());

    await user.click(screen.getByTestId('events-delete-confirm'));
    expect(store.state.removeEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseRemove?.(ok);
    });
  });
});

describe('EventsSettings accessible names and modal semantics', () => {
  it('names the header Add button, which is icon-only at every width', async () => {
    // The header Add button is a round Plus icon with no visible text at any
    // viewport, so the aria-label is the button's entire accessible name.
    await renderSection();

    expect(screen.getByRole('button', { name: 'Add event' })).toBe(
      screen.getByTestId('events-settings-add')
    );
  });

  it('reads "Shared with your partner" under the Events title', async () => {
    // Constant, not the store's partner name: the subtitle never names the
    // partner, even with a partner loaded.
    setStore({
      partner: {
        id: 'p1',
        email: 'partner@example.test',
        displayName: 'Pat',
        connectedAt: null,
        birthday: null,
      },
    });
    await renderSection();

    expect(screen.getByRole('heading', { level: 3, name: 'Events' })).toBeInTheDocument();
    expect(screen.getByTestId('events-subtitle')).toHaveTextContent(/^Shared with your partner$/);
  });

  it('exposes the form as a modal dialog named by its heading', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    const dialog = screen.getByRole('dialog', { name: 'Add Event' });
    expect(dialog).toBe(screen.getByTestId('events-form'));
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('exposes the delete confirmation as a modal dialog named by its heading', async () => {
    const user = userEvent.setup();
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));

    const dialog = screen.getByRole('dialog', { name: 'Delete this event?' });
    expect(dialog).toBe(screen.getByTestId('events-delete-confirmation'));
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

describe('EventsSettings dismissal guards', () => {
  it('closes the form on a backdrop click when nothing is in flight', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    await user.click(screen.getByTestId('events-form'));

    expect(screen.queryByTestId('events-form')).not.toBeInTheDocument();
  });

  it('ignores Escape and a backdrop click while the save is in flight', async () => {
    const user = userEvent.setup();
    // Both guards exist so a stray key or a mistimed tap cannot orphan a write
    // that is already on its way to a table with no idempotency key.
    let releaseAdd: ((result: EventWriteResult) => void) | undefined;
    setStore({
      addEvent: vi.fn(
        () =>
          new Promise<EventWriteResult>((resolve) => {
            releaseAdd = resolve;
          })
      ),
    });

    await renderSection();
    await openAddForm(user);
    await fillForm(user, { label: 'Held', date: '2026-09-12' });
    await submitForm(user);

    await waitFor(() => expect(screen.getByTestId('events-form-submit')).toBeDisabled());

    // handleSubmit parks focus ON THE PANEL before Save is disabled: a browser
    // moves focus to <body> when the focused element becomes disabled, and
    // useFocusTrap binds its keydown listener to the container — so without the
    // move, Tab leaves the dialog and the Escape suppression asserted below is
    // never reached. The panel itself, not merely "somewhere inside the
    // dialog": the label input already satisfies the weaker form before submit,
    // which makes it pass with the parking deleted.
    expect(document.activeElement).toBe(screen.getByTestId('events-form-panel'));

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('events-form')).toBeInTheDocument();

    await user.click(screen.getByTestId('events-form'));
    expect(screen.getByTestId('events-form')).toBeInTheDocument();

    await act(async () => {
      releaseAdd?.(ok);
    });
    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
  });

  it('closes the delete dialog on a backdrop click when nothing is in flight', async () => {
    const user = userEvent.setup();
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));

    await user.click(screen.getByTestId('events-delete-confirmation'));

    expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument();
    expect(store.state.removeEvent).not.toHaveBeenCalled();
  });

  it('ignores Escape and a backdrop click while the delete is in flight', async () => {
    const user = userEvent.setup();
    let releaseRemove: ((result: EventWriteResult) => void) | undefined;
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(
        () =>
          new Promise<EventWriteResult>((resolve) => {
            releaseRemove = resolve;
          })
      ),
    });

    await renderSection();
    await user.click(screen.getByTestId('event-delete-mine'));
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-confirm')).toBeDisabled());

    // Same parking as the form — see the note in the save-in-flight test.
    expect(document.activeElement).toBe(screen.getByTestId('events-delete-panel'));

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();

    await user.click(screen.getByTestId('events-delete-confirmation'));
    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();

    await act(async () => {
      releaseRemove?.(ok);
    });
    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
  });
});
