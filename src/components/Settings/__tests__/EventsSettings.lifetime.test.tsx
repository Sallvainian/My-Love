/** Manual loads outlive Settings; their local continuations must not. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import type { Dispatch, HTMLAttributes, ReactNode, Ref, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';

type CoupleEvent = AppState['events'][number];
type EventLoadResult = Awaited<ReturnType<AppState['loadEvents']>>;
type EventWriteResult = Awaited<ReturnType<AppState['editEvent']>>;
type RefreshKind = 'edit' | 'delete';

const stateSetterCalls = vi.hoisted(() => vi.fn<(next: unknown) => void>());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    // React 19 silently ignores unmounted updates. Observe the dispatch itself,
    // forwarding to real state and preserving setter identity across renders.
    useState<T,>(initial: T | (() => T)) {
      const [value, setValue] = actual.useState(initial);
      const observedSetter = actual.useCallback<Dispatch<SetStateAction<T>>>((next) => {
        stateSetterCalls(next);
        setValue(next);
      }, [setValue]);
      return [value, observedSetter];
    },
  };
});

type DivProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
};

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, initial: _i, animate: _a, exit: _e, ...props }: DivProps) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const store = vi.hoisted(() => {
  let state: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    get state() { return state; },
    replace(next: Record<string, unknown>) { state = next; notify(); },
    patch(changes: Record<string, unknown>) { state = { ...state, ...changes }; notify(); },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot() { return state; },
  };
});

vi.mock('../../../stores/useAppStore', async () => {
  const { useSyncExternalStore } = await import('react');
  const useAppStore = () => useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { useAppStore: Object.assign(useAppStore, { getState: () => store.state }) };
});

const loadOk: EventLoadResult = { status: 'success' };
const loadFailed: EventLoadResult = { status: 'failure', error: 'Connection failed' };
const loadStale: EventLoadResult = { status: 'stale' };
const missing: EventWriteResult = { success: false, code: 'not-found', error: 'Event removed' };
const outcomes = [loadOk, loadFailed, loadStale];

function makeEvent(id = 'mine'): CoupleEvent {
  return {
    id,
    userId: 'user-own',
    label: `Event ${id}`,
    date: new Date(2026, 8, 12),
    createdAt: new Date(2026, 0, 1),
    description: null,
    icon: 'calendar',
  };
}

function setStore(overrides: Partial<AppState> = {}) {
  store.replace({
    events: [],
    eventsIsLoading: false,
    eventsError: null,
    userId: 'user-own',
    authSessionVersion: 1,
    syncStatus: { isOnline: true },
    loadEvents: vi.fn(async () => loadOk),
    clearEventsError: vi.fn(() => store.patch({ eventsError: null })),
    editEvent: vi.fn(async () => missing),
    removeEvent: vi.fn(async () => missing),
    addEvent: vi.fn(async () => ({ success: true } as const)),
    ...overrides,
  });
}

function deferredLoad() {
  let resolve!: (result: EventLoadResult) => void;
  const promise = new Promise<EventLoadResult>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function startPendingLoad(pending: ReturnType<typeof deferredLoad>) {
  store.patch({ eventsIsLoading: true, eventsError: null });
  return pending.promise;
}

async function settleLoad(
  pending: ReturnType<typeof deferredLoad>,
  result: EventLoadResult,
  events?: CoupleEvent[]
) {
  await act(async () => {
    // The shared store still completes its own work, even after view unmount.
    if (result.status !== 'stale') {
      store.patch({
        eventsIsLoading: false,
        eventsError: result.status === 'failure' ? result.error : null,
        ...(events ? { events } : {}),
      });
    }
    pending.resolve(result);
  });
}

async function renderSection(strict = false) {
  const section = <EventsSettings />;
  const view = render(strict ? <StrictMode>{section}</StrictMode> : section);
  await act(async () => {});
  return view;
}

async function refreshStaleRow(kind: RefreshKind) {
  const opener = screen.getByTestId(`event-${kind}-mine`);
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByTestId(kind === 'edit' ? 'events-form-submit' : 'events-delete-confirm'));
  const refreshId = kind === 'edit' ? 'events-form-refresh' : 'events-delete-refresh';
  await waitFor(() => expect(screen.getByTestId(refreshId)).toBeInTheDocument());
  fireEvent.click(screen.getByTestId(refreshId));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('events-settings-add')).toHaveFocus();
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
});

describe('EventsSettings manual load lifetime', () => {
  describe.each(['edit', 'delete'] as const)('stale-row %s refresh', (kind) => {
    it.each(outcomes)('ignores $status settlement after unmount', async (outcome) => {
      const pending = deferredLoad();
      const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk);
      setStore({ events: [makeEvent()], loadEvents });
      const view = await renderSection();
      loadEvents.mockImplementationOnce(() => startPendingLoad(pending));
      await refreshStaleRow(kind);
      expect(loadEvents).toHaveBeenCalledTimes(2);
      expect(store.state.eventsIsLoading).toBe(true);

      view.unmount();
      stateSetterCalls.mockClear();
      const focus = vi.spyOn(HTMLElement.prototype, 'focus');
      try {
        await settleLoad(pending, outcome);
        // Includes settlement, retry cleanup, and the focus-request setter;
        // absence of a DOM node or React warning cannot prove these were skipped.
        expect(stateSetterCalls).not.toHaveBeenCalled();
        expect(focus).not.toHaveBeenCalled();
      } finally {
        focus.mockRestore();
      }
    });
  });

  it.each(outcomes)('ignores retry $status, cleanup, and focus requests after unmount', async (outcome) => {
    const pending = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadFailed);
    setStore({ loadEvents });
    const view = await renderSection();
    loadEvents.mockImplementationOnce(() => startPendingLoad(pending));
    fireEvent.click(screen.getByTestId('events-settings-retry'));
    expect(loadEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('events-settings-loading')).toBeInTheDocument();

    view.unmount();
    stateSetterCalls.mockClear();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      await settleLoad(pending, outcome);
      expect(stateSetterCalls).not.toHaveBeenCalled();
      expect(focus).not.toHaveBeenCalled();
    } finally {
      focus.mockRestore();
    }
  });
});

describe('EventsSettings mounted recovery after StrictMode effect replay', () => {
  it.each(['edit', 'delete'] as const)('settles a successful stale-row %s refresh', async (kind) => {
    const pending = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadFailed);
    setStore({ events: [makeEvent()], loadEvents });
    await renderSection(true);
    expect(loadEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
    loadEvents.mockImplementationOnce(() => startPendingLoad(pending));
    await refreshStaleRow(kind);
    expect(loadEvents).toHaveBeenCalledTimes(3);
    stateSetterCalls.mockClear();

    await settleLoad(pending, loadOk, kind === 'edit' ? [makeEvent('current')] : []);

    expect(stateSetterCalls).toHaveBeenCalled();
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
    expect(screen.getByTestId(kind === 'edit' ? 'event-row-current' : 'events-settings-empty'))
      .toBeInTheDocument();
    expect(screen.getByTestId('events-settings-add')).toHaveFocus();
  });

  it('restores Retry after repeated failures and focuses Add on eventual success', async () => {
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadFailed);
    setStore({ loadEvents });
    await renderSection(true);
    expect(loadEvents).toHaveBeenCalledTimes(2);

    for (const [index, outcome] of [loadFailed, loadFailed, loadOk].entries()) {
      const pending = deferredLoad();
      loadEvents.mockImplementationOnce(() => startPendingLoad(pending));
      const retry = screen.getByTestId('events-settings-retry');
      expect(retry).toBeEnabled();
      retry.focus();
      fireEvent.click(retry);
      expect(loadEvents).toHaveBeenCalledTimes(3 + index);
      expect(screen.getByTestId('events-settings-loading')).toBeInTheDocument();
      stateSetterCalls.mockClear();

      await settleLoad(pending, outcome);

      expect(stateSetterCalls).toHaveBeenCalled();
      if (outcome.status === 'failure') {
        expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
        expect(screen.getByTestId('events-settings-retry')).toBeEnabled();
        expect(screen.getByTestId('events-settings-retry')).toHaveFocus();
      } else {
        expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
        expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
        expect(screen.getByTestId('events-settings-add')).toHaveFocus();
      }
    }
  });

  it('does not revive the cancelled first mount load after replay', async () => {
    const superseded = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk)
      .mockReturnValueOnce(superseded.promise);
    setStore({ loadEvents });
    await renderSection(true);
    expect(loadEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    stateSetterCalls.mockClear();

    await settleLoad(superseded, loadFailed);

    expect(stateSetterCalls).not.toHaveBeenCalled();
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
  });

  it('releases a stale retry without changing its notice or stealing focus', async () => {
    const pending = deferredLoad();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadFailed);
    setStore({ events: [makeEvent()], loadEvents });
    await renderSection(true);
    loadEvents.mockImplementationOnce(() => startPendingLoad(pending));
    const retry = screen.getByTestId('events-settings-retry');
    fireEvent.click(retry);
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(loadEvents).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByTestId('events-settings-add'));
    const input = screen.getByTestId('events-form-label');
    input.focus();

    // A shared newer load has finished; this manual invocation was superseded.
    await act(async () => { store.patch({ eventsIsLoading: false }); });
    expect(retry).toBeDisabled();
    await settleLoad(pending, loadStale);

    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(retry).toBeEnabled();
    expect(input).toHaveFocus();
  });
});
