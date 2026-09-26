/**
 * EventsSettings — behaviour: list and list states
 *
 * The first test under `src/components/Settings/`, so it also fixes the
 * conventions for the directory: the Motion `m` mock the rest of the
 * tree uses, and fixtures built from local date components because
 * `vitest.config.ts` pins `TZ=America/New_York`.
 *
 * These pin the rows of the story's I/O matrix — what the section does, not how
 * it is styled. Focus behaviour lives in EventsSettings.focus.test.tsx,
 * following the house standard of a dedicated focus test per dialog. The rest
 * of the matrix is split by concern into the EventsSettings.validation,
 * .addEdit, .reconciliation, .delete and .session suites; the fixtures, the
 * store double's wiring and the form helpers they share live in
 * eventsSettingsKit.tsx.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { serializeAccountDataWrite } from '../../../services/accountDataQueue';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';
import {
  createEventsStoreKit,
  fillForm,
  loadOk,
  makeEvent,
  openAddForm,
  PARTNER_USER_ID,
  renderedLabels,
  renderSection,
  submitForm,
  writeFailure,
  type EventLoadResult,
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

describe('EventsSettings list', () => {
  it('loads events on mount for the signed-in user, without visiting Home first', async () => {
    // The only other loadEvents() call site is App's Home-gated effect, and
    // `events` is not persisted — so without this a /settings deep link or a
    // reload on Settings renders a permanently empty list.
    await renderSection();

    expect(store.state.loadEvents).toHaveBeenCalledTimes(1);
  });

  it('lists every event including one already in the past', async () => {
    // Home hides past events; Settings must not, or a mistyped year becomes
    // both invisible and uneditable.
    setStore({
      events: [
        makeEvent({ id: 'past-1', label: 'Last Christmas', date: new Date(2020, 11, 25) }),
        makeEvent({
          id: 'future-1',
          label: 'Harper visits',
          date: new Date(2026, 8, 12),
          description: 'Two whole weeks',
        }),
      ] as AppState['events'],
    });

    await renderSection();

    expect(screen.getByTestId('event-label-past-1')).toHaveTextContent('Last Christmas');
    expect(screen.getByTestId('event-date-past-1')).toHaveTextContent('December 25, 2020');
    expect(screen.getByTestId('event-label-future-1')).toHaveTextContent('Harper visits');
    expect(screen.getByTestId('event-date-future-1')).toHaveTextContent('September 12, 2026');
    expect(screen.getByTestId('event-description-future-1')).toHaveTextContent('Two whole weeks');
  });

  it('renders the list in store order', async () => {
    setStore({
      events: [
        makeEvent({ id: 'a', label: 'Sooner', date: new Date(2026, 0, 2) }),
        makeEvent({ id: 'b', label: 'Later', date: new Date(2026, 5, 2) }),
      ] as AppState['events'],
    });

    await renderSection();

    expect(renderedLabels()).toEqual(['Sooner', 'Later']);
  });

  it('gives a partner-owned row no Edit and no Delete control', async () => {
    // RLS filters a non-creator's write to zero rows, which the service turns
    // into "not yours to edit". A control that can only produce that message is
    // worse than no control.
    setStore({
      events: [
        makeEvent({
          id: 'theirs',
          userId: PARTNER_USER_ID,
          label: 'Their trip',
          description: 'Booked already',
        }),
        makeEvent({ id: 'mine', label: 'My trip' }),
      ] as AppState['events'],
    });

    await renderSection();

    expect(screen.getByTestId('event-label-theirs')).toHaveTextContent('Their trip');
    expect(screen.getByTestId('event-description-theirs')).toHaveTextContent('Booked already');
    expect(screen.queryByTestId('event-edit-theirs')).not.toBeInTheDocument();
    expect(screen.queryByTestId('event-delete-theirs')).not.toBeInTheDocument();

    expect(screen.getByTestId('event-edit-mine')).toBeInTheDocument();
    expect(screen.getByTestId('event-delete-mine')).toBeInTheDocument();
  });
});

describe('EventsSettings list states', () => {
  it('shows a loading indicator, never the empty state, while the first load is in flight', async () => {
    setStore({
      eventsIsLoading: true,
      // Never resolves: the window this test is about is Settings painted with
      // loadEvents still outstanding.
      loadEvents: vi.fn(() => new Promise<EventLoadResult>(() => {})),
    });

    render(<EventsSettings />);

    expect(screen.getByTestId('events-settings-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-empty')).not.toBeInTheDocument();
  });

  it('shows an empty state carrying its own add control once the load has settled', async () => {
    await renderSection();

    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    expect(screen.getByTestId('events-settings-empty-add')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-loading')).not.toBeInTheDocument();
  });

  it('opens the form from the empty state add control', async () => {
    const user = userEvent.setup();
    await renderSection();

    await user.click(screen.getByTestId('events-settings-empty-add'));

    expect(screen.getByTestId('events-form')).toBeInTheDocument();
  });

  it('explains a failed load in the list area instead of claiming there are no events', async () => {
    setStore({
      loadEvents: vi.fn(async () => {
        // Deliberately disagree with the result: reading shared state would
        // incorrectly render the empty placeholder.
        store.patch({ eventsError: null });
        return { status: 'failure', error: 'Network error' } as const;
      }),
    });

    await renderSection();

    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-loading')).not.toBeInTheDocument();
  });

  it('keeps a surviving list on screen and puts the failure notice above it', async () => {
    // A failed refresh must never blank a list already on screen, whether it
    // came from the server or the saved `events` copy. Reordering the slot
    // ternary to check loadFailed first would swap the list for the notice, and
    // this is the only test that would notice.
    setStore({
      events: [makeEvent({ id: 'stale', label: 'Still here' })] as AppState['events'],
      loadEvents: vi.fn(async () => {
        store.patch({ eventsError: null });
        return { status: 'failure', error: 'Network error' } as const;
      }),
    });

    await renderSection();

    expect(screen.getByTestId('events-settings-list')).toBeInTheDocument();
    expect(screen.getByTestId('event-row-stale')).toBeInTheDocument();
    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
    // Above the list, not inside it.
    expect(screen.getByTestId('events-settings-list')).not.toContainElement(
      screen.getByTestId('events-settings-load-error')
    );
  });

  /**
   * Fails an add while the mount load is still pending, and waits for the form
   * error. The mount load stays pending until `finishLoad()` is called.
   */
  async function failSaveDuringMountLoad(user: UserEvent) {
    let finishLoad: () => void = () => {};
    setStore({
      eventsIsLoading: true,
      loadEvents: vi.fn(
        () =>
          new Promise<EventLoadResult>((resolve) => {
            finishLoad = () => {
              store.patch({ eventsIsLoading: false });
              resolve({ status: 'success' });
            };
          })
      ),
      addEvent: vi.fn(async () => writeFailure('transport', 'This event did not save')),
    });

    render(<EventsSettings />);
    await openAddForm(user);
    await fillForm(user, { label: 'Unsaved trip', date: '2026-10-31' });
    await submitForm(user);

    await waitFor(() =>
      expect(screen.getByTestId('events-form-error')).toHaveTextContent(
        'This event did not save'
      )
    );
    // A closure: `finishLoad` is only assigned once the mount load runs.
    return { finishLoad: () => finishLoad() };
  }

  it('keeps the form write failure when its pending mount load succeeds', async () => {
    const user = userEvent.setup();
    const { finishLoad } = await failSaveDuringMountLoad(user);

    await act(async () => {
      finishLoad();
    });

    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
    expect(screen.getByTestId('events-form-error')).toHaveTextContent('This event did not save');
  });

  it('marks only the load region busy, not the section or the open form, while the mount load is pending', async () => {
    const user = userEvent.setup();
    await failSaveDuringMountLoad(user);

    const loadRegion = screen.getByTestId('events-settings-load-region');
    expect(loadRegion).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('events-settings')).not.toHaveAttribute('aria-busy');
    expect(loadRegion).not.toContainElement(screen.getByTestId('events-form-error'));
  });

  it('uses the successful call outcome even when shared load error state disagrees', async () => {
    let finishLoad: (result: EventLoadResult) => void = () => {};
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents: vi.fn(
        () =>
          new Promise<EventLoadResult>((resolve) => {
            finishLoad = resolve;
          })
      ),
    });

    render(<EventsSettings />);

    await act(async () => {
      // Deliberately impossible through the revised write actions: this pins
      // the caller contract so a future regression cannot infer this load's
      // outcome from unrelated shared state again.
      store.patch({ eventsError: 'An unrelated stored error' });
      finishLoad({ status: 'success' });
    });

    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('events-settings-list')).toBeInTheDocument();
  });

  it('recovers in place when connectivity returns after a failed load', async () => {
    const reconnectedEvent = makeEvent({ id: 'reconnected', label: 'Back online' });
    const loadEvents = vi
      .fn<() => Promise<EventLoadResult>>()
      .mockImplementationOnce(async () => ({
        status: 'failure',
        error: 'Network error',
      }))
      .mockImplementationOnce(async () => {
        store.patch({
          events: [reconnectedEvent],
          eventsError: null,
          eventsIsLoading: false,
        });
        return loadOk;
      });
    setStore({
      syncStatus: {
        pendingMoods: 0,
        isOnline: false,
        lastSyncAt: undefined,
        isSyncing: false,
      },
      loadEvents,
    });

    await renderSection();
    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();

    act(() => {
      store.patch({
        syncStatus: {
          ...(store.state.syncStatus as AppState['syncStatus']),
          isOnline: true,
        },
      });
    });

    await waitFor(() => expect(loadEvents).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument()
    );
    expect(screen.getByTestId('event-row-reconnected')).toBeInTheDocument();
  });

  /**
   * A mount load that fails, then a Retry load that stays pending until
   * `finishRetry()` lands an empty list.
   */
  function arrangeEmptyRetry() {
    let finishRetry: () => void = () => {};
    const clearEventsError = vi.fn(() => store.patch({ eventsError: null }));
    const loadEvents = vi
      .fn<() => Promise<EventLoadResult>>()
      .mockImplementationOnce(async () => {
        store.patch({ eventsError: 'Network error' });
        return { status: 'failure', error: 'Network error' };
      })
      .mockImplementationOnce(() => {
        store.patch({ eventsError: null, eventsIsLoading: true });
        return new Promise<EventLoadResult>((resolve) => {
          finishRetry = () => {
            store.patch({ events: [], eventsError: null, eventsIsLoading: false });
            resolve(loadOk);
          };
        });
      });
    setStore({ loadEvents, clearEventsError });
    // A closure: `finishRetry` is only assigned once the Retry load runs.
    return { loadEvents, clearEventsError, finishRetry: () => finishRetry() };
  }

  /** Renders the load-error notice and clicks its Retry until the Retry load has started. */
  async function retryFromNotice(user: UserEvent, loadEvents: Mock) {
    await renderSection();
    await user.click(screen.getByTestId('events-settings-retry'));
    await waitFor(() => expect(loadEvents).toHaveBeenCalledTimes(2));
  }

  it('clears the stored load error before the Retry reload starts', async () => {
    const user = userEvent.setup();
    const { loadEvents, clearEventsError } = arrangeEmptyRetry();
    await retryFromNotice(user, loadEvents);

    expect(clearEventsError).toHaveBeenCalledTimes(1);
    expect(clearEventsError.mock.invocationCallOrder[0]).toBeLessThan(
      loadEvents.mock.invocationCallOrder[1]
    );
  });

  it('swaps Retry for the loading indicator, then shows the truthful empty state after a successful Retry', async () => {
    const user = userEvent.setup();
    const { loadEvents, finishRetry } = arrangeEmptyRetry();
    await retryFromNotice(user, loadEvents);

    await waitFor(() => expect(screen.getByTestId('events-settings-loading')).toBeInTheDocument());
    expect(screen.queryByTestId('events-settings-retry')).not.toBeInTheDocument();

    await act(async () => {
      finishRetry();
    });

    await waitFor(() =>
      expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument()
    );
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
  });

  it('moves focus to Add after a successful Retry', async () => {
    const user = userEvent.setup();
    const { loadEvents, finishRetry } = arrangeEmptyRetry();
    await retryFromNotice(user, loadEvents);

    await act(async () => {
      finishRetry();
    });

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-settings-add'))
    );
  });

  it('moves focus back to Retry when an empty-state Retry fails again', async () => {
    const user = userEvent.setup();
    let finishRetry: () => void = () => {};
    const loadEvents = vi
      .fn<() => Promise<EventLoadResult>>()
      .mockImplementationOnce(async () => ({
        status: 'failure',
        error: 'Initial failure',
      }))
      .mockImplementationOnce(() => {
        store.patch({ eventsError: null, eventsIsLoading: true });
        return new Promise<EventLoadResult>((resolve) => {
          finishRetry = () => {
            store.patch({ eventsError: 'Retry failed', eventsIsLoading: false });
            resolve({ status: 'failure', error: 'Retry failed' });
          };
        });
      });
    setStore({ loadEvents });

    await renderSection();
    const retry = screen.getByTestId('events-settings-retry');
    await user.click(retry);

    await waitFor(() => expect(screen.getByTestId('events-settings-loading')).toBeInTheDocument());
    expect(screen.queryByTestId('events-settings-retry')).not.toBeInTheDocument();

    await act(async () => {
      finishRetry();
    });

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-settings-retry'))
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getAllByTestId('events-settings-load-error')).toHaveLength(1);
  });

  it('keeps one retryable notice and the last-good list when Retry fails again', async () => {
    const user = userEvent.setup();
    let finishRetry: () => void = () => {};
    const loadEvents = vi
      .fn<() => Promise<EventLoadResult>>()
      .mockImplementationOnce(async () => ({
        status: 'failure',
        error: 'Initial failure',
      }))
      .mockImplementationOnce(() => {
        store.patch({ eventsError: null, eventsIsLoading: true });
        return new Promise<EventLoadResult>((resolve) => {
          finishRetry = () => {
            store.patch({ eventsError: 'Retry failed', eventsIsLoading: false });
            resolve({ status: 'failure', error: 'Retry failed' });
          };
        });
      });
    setStore({
      events: [makeEvent({ id: 'last-good', label: 'Still visible' })] as AppState['events'],
      loadEvents,
    });

    await renderSection();
    const retry = screen.getByTestId('events-settings-retry');
    await user.click(retry);

    await waitFor(() => expect(retry).toBeDisabled());
    expect(retry).toHaveTextContent('Retrying…');
    await user.click(retry);
    expect(loadEvents).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishRetry();
    });

    expect(screen.getAllByTestId('events-settings-load-error')).toHaveLength(1);
    expect(screen.getByTestId('event-row-last-good')).toBeInTheDocument();
    expect(screen.getByTestId('events-settings-retry')).toBeEnabled();
    expect(screen.getByTestId('events-settings-retry')).toHaveTextContent('Retry');
  });
});
