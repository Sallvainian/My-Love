/**
 * EventsSettings — behaviour: authentication session ownership
 *
 * These pin the session-ownership rows of the story's I/O matrix — what the
 * section does, not how it is styled. The fixtures, the store double's wiring
 * and the form helpers live in eventsSettingsKit.tsx.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeAccountDataWrite } from '../../../services/accountDataQueue';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';
import {
  createEventsStoreKit,
  deferredLoad,
  expectUnsettledSession,
  loadOk,
  makeEvent,
  oldOutcomes,
  openAddForm,
  OWN_USER_ID,
  renderSection,
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

const { setStore, reauthenticate } = createEventsStoreKit(store);

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

describe('EventsSettings authentication session ownership', () => {
  it.each(oldOutcomes)('ignores a queued $status before old effect cleanup and re-arms the mount load', async (outcome) => {
    let deliveredAtLoadCount: number | null = null;
    const previous = deferredLoad(() => { deliveredAtLoadCount ??= loadEvents.mock.calls.length; });
    const current = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    setStore({ loadEvents });
    await renderSection();

    await act(async () => {
      previous.resolve(outcome);
      reauthenticate();
      await previous.promise;
    });

    expect(deliveredAtLoadCount).toBe(1);
    expect(loadEvents).toHaveBeenCalledTimes(2);
    expectUnsettledSession();
    await act(async () => { current.resolve(loadOk); });
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
  });

  it.each(oldOutcomes)('keeps the current load and its error after an old $status', async (outcome) => {
    const previous = deferredLoad();
    const current = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    setStore({ loadEvents });
    render(<EventsSettings />);
    await act(async () => { reauthenticate(); });
    expect(loadEvents).toHaveBeenCalledTimes(2);
    expectUnsettledSession();
    await act(async () => { current.resolve({ status: 'failure', error: 'Current failure' }); });
    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
    await act(async () => { previous.resolve(outcome); });
    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-empty')).not.toBeInTheDocument();
  });

  it('hides an already settled empty state on reauthentication and renders current events', async () => {
    const current = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>()
      .mockResolvedValueOnce(loadOk)
      .mockReturnValueOnce(current.promise);
    setStore({ loadEvents });
    await renderSection();
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    await act(async () => { reauthenticate(); });
    expectUnsettledSession();
    await act(async () => {
      store.patch({ events: [makeEvent({ id: 'current', label: 'Current session event' })] });
      current.resolve(loadOk);
    });
    expect(screen.getByTestId('event-row-current')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
  });

  it('does not reload or discard a pending load on same-session user updates', async () => {
    const pending = deferredLoad();
    const loadEvents = vi.fn(() => pending.promise);
    setStore({ loadEvents });
    render(<EventsSettings />);
    const { authSessionVersion, setAuthUser } = store.state as unknown as AppState;
    await act(async () => { setAuthUser(OWN_USER_ID, 'updated@example.com'); });
    expect(store.state.authSessionVersion).toBe(authSessionVersion);
    expect(loadEvents).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(loadOk); });
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
  });

  it.each(oldOutcomes)('ignores an old reconnect $status after same-account reauthentication', async (outcome) => {
    let deliveredAtLoadCount: number | null = null;
    const reconnect = deferredLoad(() => { deliveredAtLoadCount ??= loadEvents.mock.calls.length; });
    const current = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>()
      .mockResolvedValueOnce({ status: 'failure', error: 'Offline' })
      .mockReturnValueOnce(reconnect.promise)
      .mockReturnValueOnce(current.promise);
    setStore({ loadEvents, syncStatus: { isOnline: false, isSyncing: false, pendingMoods: 0 } });
    await renderSection();
    await act(async () => { store.patch({ syncStatus: { isOnline: true } }); });
    expect(loadEvents).toHaveBeenCalledTimes(2);
    await act(async () => {
      reconnect.resolve(outcome);
      reauthenticate();
      await reconnect.promise;
    });
    expect(deliveredAtLoadCount).toBe(2);
    expect(loadEvents).toHaveBeenCalledTimes(3);
    expectUnsettledSession();
    await act(async () => { current.resolve(loadOk); });
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
  });

  it.each([
    ['edit', 'events-form-submit', 'events-form-refresh'],
    ['delete', 'events-delete-confirm', 'events-delete-refresh'],
  ] as const)('does not settle the new session from a stale-row %s refresh', async (kind, confirm, refreshButton) => {
    const user = userEvent.setup();
    const refresh = deferredLoad();
    const current = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>()
      .mockResolvedValueOnce(loadOk)
      .mockReturnValueOnce(refresh.promise)
      .mockReturnValueOnce(current.promise);
    const missing = writeFailure('not-found', 'Event removed');
    setStore({
      events: [makeEvent({ id: 'mine' })],
      loadEvents,
      editEvent: vi.fn(async () => missing),
      removeEvent: vi.fn(async () => missing),
    });
    await renderSection();
    await user.click(screen.getByTestId(`event-${kind}-mine`));
    await user.click(screen.getByTestId(confirm));
    await waitFor(() => expect(screen.getByTestId(refreshButton)).toBeInTheDocument());
    await user.click(screen.getByTestId(refreshButton));
    expect(loadEvents).toHaveBeenCalledTimes(2);
    await act(async () => { reauthenticate(); });
    expect(loadEvents).toHaveBeenCalledTimes(3);
    expectUnsettledSession();
    await act(async () => { current.resolve(loadOk); });
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    await act(async () => { refresh.resolve({ status: 'failure', error: 'Old refresh failed' }); });
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
  });

  it.each(oldOutcomes)('ignores old retry $status and focus while a new-session retry is pending', async (outcome) => {
    const user = userEvent.setup();
    const oldRetry = deferredLoad();
    const newRetry = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>()
      .mockResolvedValueOnce({ status: 'failure', error: 'Initial failure' })
      .mockReturnValueOnce(oldRetry.promise)
      .mockResolvedValueOnce({ status: 'failure', error: 'Current initial failure' })
      .mockReturnValueOnce(newRetry.promise);
    setStore({ loadEvents });
    await renderSection();
    await user.click(screen.getByTestId('events-settings-retry'));
    await act(async () => { reauthenticate(); });
    const retry = screen.getByTestId('events-settings-retry');
    expect(retry).toBeEnabled();
    await user.click(retry);
    expect(loadEvents).toHaveBeenCalledTimes(4);
    expect(retry).toBeDisabled();

    // Give the user somewhere meaningful to focus while the load is pending.
    await openAddForm(user);
    const input = screen.getByTestId('events-form-label');
    await user.click(input);
    await act(async () => { oldRetry.resolve(outcome); });
    expect(input).toHaveFocus();
    expect(retry).toBeDisabled();
    expect(retry).toHaveTextContent('Retrying');
    await user.click(screen.getByTestId('events-form-close'));
    await act(async () => { newRetry.resolve(loadOk); });
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    expect(screen.getByTestId('events-settings-add')).toHaveFocus();
  });
});
