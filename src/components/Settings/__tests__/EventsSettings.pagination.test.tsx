/** Explicit history paging, recoverable failures, and async view ownership. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import type { Dispatch, HTMLAttributes, ReactNode, Ref, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';

type CoupleEvent = AppState['events'][number];
type EventLoadResult = Awaited<ReturnType<AppState['loadEvents']>>;
type Pagination = NonNullable<AppState['eventsPagination']>;

const stateSetterCalls = vi.hoisted(() => vi.fn<(next: unknown) => void>());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    // React silently ignores unmounted state updates; observe dispatch itself.
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

vi.mock('motion/react', () => ({
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

function makeEvent(id = 'mine', userId = 'user-own'): CoupleEvent {
  return {
    id,
    userId,
    label: `Event ${id}`,
    date: new Date(2020, 0, 1),
    createdAt: new Date(2026, 0, 1),
    description: `Details ${id}`,
    icon: 'calendar',
  };
}

function pagination(upcoming = false, past = true): Pagination {
  return {
    todayISO: '2026-09-12',
    upcoming: { cursor: null, hasMore: upcoming },
    past: { cursor: null, hasMore: past },
  };
}

function setStore(overrides: Partial<AppState> = {}) {
  store.replace({
    events: [makeEvent()],
    eventsIsLoading: false,
    eventsIsLoadingMore: false,
    eventsError: null,
    eventsHistoryError: null,
    eventsPagination: pagination(),
    userId: 'user-own',
    authSessionVersion: 1,
    syncStatus: { isOnline: true },
    loadEvents: vi.fn(async () => loadOk),
    loadMoreEvents: vi.fn(async () => loadOk),
    clearEventsError: vi.fn(() => store.patch({ eventsError: null })),
    addEvent: vi.fn(async () => ({ success: true } as const)),
    editEvent: vi.fn(async () => ({ success: true } as const)),
    removeEvent: vi.fn(async () => ({ success: true } as const)),
    ...overrides,
  });
}

function deferredLoad() {
  let resolve!: (result: EventLoadResult) => void;
  const promise = new Promise<EventLoadResult>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function startPendingHistory(pending: ReturnType<typeof deferredLoad>) {
  store.patch({ eventsIsLoadingMore: true, eventsHistoryError: null });
  return pending.promise;
}

async function settleHistory(
  pending: ReturnType<typeof deferredLoad>,
  outcome: EventLoadResult,
  changes: Partial<AppState> = {}
) {
  await act(async () => {
    if (outcome.status !== 'stale') {
      store.patch({
        eventsIsLoadingMore: false,
        eventsHistoryError: outcome.status === 'failure' ? outcome.error : null,
        ...changes,
      });
    }
    pending.resolve(outcome);
  });
}

async function renderSection(strict = false) {
  const section = <EventsSettings />;
  const view = render(strict ? <StrictMode>{section}</StrictMode> : section);
  await act(async () => {});
  return view;
}

function activateHistory() {
  const button = screen.getByTestId('events-settings-load-more');
  button.focus();
  fireEvent.click(button);
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
});

describe('EventsSettings explicit history', () => {
  it.each([
    { upcoming: false, past: false, more: false },
    { upcoming: true, past: false, more: true },
    { upcoming: false, past: true, more: true },
    { upcoming: true, past: true, more: true },
  ])('uses raw continuation flags: upcoming=$upcoming, past=$past', async ({ upcoming, past, more }) => {
    const loadMoreEvents = vi.fn(async () => loadOk);
    setStore({ eventsPagination: pagination(upcoming, past), loadMoreEvents });
    await renderSection();

    expect(Boolean(screen.queryByRole('button', { name: 'Load more history' }))).toBe(more);
    expect(Boolean(screen.queryByTestId('events-settings-history-notice'))).toBe(more);
    if (more) {
      expect(screen.getByTestId('events-settings-history-notice')).toHaveTextContent(
        /After a refresh or reload, saved events outside this list may need to be loaded again/
      );
    }
    expect(loadMoreEvents).not.toHaveBeenCalled();
  });

  it('does not offer paging before a first page exists', async () => {
    setStore({ eventsPagination: null });
    await renderSection();
    expect(screen.queryByTestId('events-settings-load-more')).not.toBeInTheDocument();
  });

  it('allows continuation through a sparse page without claiming there are no events', async () => {
    setStore({ events: [] });
    await renderSection();
    expect(screen.getByTestId('events-settings-empty')).toHaveTextContent(
      'No events to display in this part of your history.'
    );
    expect(screen.queryByText(/No events yet/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more history' })).toBeEnabled();
  });

  it('keeps loaded rows while busy, blocks duplicates, and makes a deep own row editable', async () => {
    const pending = deferredLoad();
    const loadMoreEvents = vi.fn(() => startPendingHistory(pending));
    setStore({ loadMoreEvents });
    await renderSection();
    const status = screen.getByTestId('events-settings-history-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    const button = activateHistory();
    expect(button).toHaveAccessibleName('Loading history…');
    expect(button).toBeDisabled();
    expect(status).toHaveTextContent('Loading history…');
    expect(screen.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    fireEvent.click(button);
    expect(loadMoreEvents).toHaveBeenCalledTimes(1);
    // happy-dom refuses to blur disabled controls; reproduce Chromium's body
    // focus explicitly after the focused history control becomes disabled.
    document.body.focus();
    expect(document.body).toHaveFocus();

    const deep = { ...makeEvent('deep'), date: new Date(1999, 11, 31) };
    await settleHistory(pending, loadOk, {
      events: [deep, makeEvent(), makeEvent('partner', 'user-partner')],
      eventsPagination: pagination(false, false),
    });

    expect(screen.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByTestId('events-settings-load-more')).not.toBeInTheDocument();
    expect(screen.getByTestId('events-settings-add')).toHaveFocus();
    expect(status).toHaveTextContent('3 events loaded. No more history to load.');
    expect(screen.queryByTestId('event-edit-partner')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Event deep' }));
    expect(screen.getByTestId('events-form-date')).toHaveValue('1999-12-31');
    expect(screen.getByTestId('events-form-description')).toHaveValue('Details deep');
  });

  it('keeps the same page retryable after failure without refreshing or hiding rows', async () => {
    const failedPage = deferredLoad();
    const retriedPage = deferredLoad();
    const loadEvents = vi.fn(async () => loadOk);
    const loadMoreEvents = vi.fn(() => startPendingHistory(failedPage))
      .mockImplementationOnce(() => startPendingHistory(failedPage))
      .mockImplementationOnce(() => startPendingHistory(retriedPage));
    setStore({ loadEvents, loadMoreEvents });
    await renderSection();
    activateHistory();
    document.body.focus();
    await settleHistory(failedPage, loadFailed);

    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(screen.getByTestId('events-settings-history-error')).toHaveTextContent(
      /couldn't load more history/
    );
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry loading history' })).toHaveFocus();
    expect(screen.getByTestId('events-settings-history-status')).toBeEmptyDOMElement();

    const retry = activateHistory();
    expect(retry).toBeDisabled();
    document.body.focus();
    expect(screen.queryByTestId('events-settings-history-error')).not.toBeInTheDocument();
    await settleHistory(retriedPage, loadOk, {
      events: [makeEvent('older'), makeEvent()],
    });

    expect(screen.getByTestId('event-row-older')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more history' })).toBeEnabled();
    expect(screen.getByTestId('events-settings-load-more')).toHaveFocus();
    expect(screen.getByTestId('events-settings-history-status')).toHaveTextContent(
      '2 events loaded. More history is available.'
    );
    expect(loadMoreEvents).toHaveBeenCalledTimes(2);
    expect(loadEvents).toHaveBeenCalledTimes(1);
  });

  it('disables history while a full refresh is in flight', async () => {
    const loadMoreEvents = vi.fn(async () => loadOk);
    setStore({ eventsIsLoading: true, loadMoreEvents });
    await renderSection();
    expect(screen.getByTestId('events-settings-load-more')).toBeDisabled();
    fireEvent.click(screen.getByTestId('events-settings-load-more'));
    expect(loadMoreEvents).not.toHaveBeenCalled();
  });

  it('keeps focus in an edit form opened while the final history page loads', async () => {
    const pending = deferredLoad();
    setStore({ loadMoreEvents: vi.fn(() => startPendingHistory(pending)) });
    await renderSection();
    activateHistory();
    fireEvent.click(screen.getByTestId('event-edit-mine'));
    const input = screen.getByTestId('events-form-label');
    input.focus();
    await settleHistory(pending, loadOk, { eventsPagination: pagination(false, false) });
    expect(input).toHaveFocus();
  });

  it('does not claim body focus if the history control never owned it', async () => {
    const pending = deferredLoad();
    setStore({ loadMoreEvents: vi.fn(() => startPendingHistory(pending)) });
    await renderSection();
    fireEvent.click(screen.getByTestId('events-settings-load-more'));
    expect(document.body).toHaveFocus();
    await settleHistory(pending, loadOk, { eventsPagination: pagination(false, false) });
    expect(document.body).toHaveFocus();
  });

  it('announces final exhaustion even when a sparse page adds no readable rows', async () => {
    const pending = deferredLoad();
    setStore({ events: [], loadMoreEvents: vi.fn(() => startPendingHistory(pending)) });
    await renderSection();
    activateHistory();
    await settleHistory(pending, loadOk, { eventsPagination: pagination(false, false) });
    expect(screen.getByTestId('events-settings-history-status')).toHaveTextContent(
      '0 events loaded. No more history to load.'
    );
  });

  it('preserves edit mode, draft values, and the save target when a refresh removes the paged row', async () => {
    const editEvent = vi.fn(async () => ({ success: true } as const));
    const addEvent = vi.fn(async () => ({ success: true } as const));
    setStore({ events: [makeEvent('deep'), makeEvent()], editEvent, addEvent });
    await renderSection();
    fireEvent.click(screen.getByTestId('event-edit-deep'));
    fireEvent.change(screen.getByTestId('events-form-label'), {
      target: { value: 'Corrected old event' },
    });
    fireEvent.change(screen.getByTestId('events-form-date'), {
      target: { value: '1999-12-31' },
    });

    await act(async () => {
      store.patch({ eventsIsLoading: true });
    });
    await act(async () => {
      store.patch({ eventsIsLoading: false, events: [makeEvent()], eventsPagination: pagination() });
    });

    expect(screen.queryByTestId('event-row-deep')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit Event' })).toBeInTheDocument();
    expect(screen.getByTestId('events-form-label')).toHaveValue('Corrected old event');
    expect(screen.getByTestId('events-form-date')).toHaveValue('1999-12-31');
    expect(screen.getByTestId('events-form-description')).toHaveValue('Details deep');
    await act(async () => {
      fireEvent.click(screen.getByTestId('events-form-submit'));
    });
    expect(editEvent).toHaveBeenCalledWith('deep', {
      label: 'Corrected old event',
      eventDate: '1999-12-31',
      description: 'Details deep',
      icon: 'calendar',
    });
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('releases a superseded page before it settles and prevents it from releasing a newer page', async () => {
    const pending = deferredLoad();
    const currentPage = deferredLoad();
    const loadMoreEvents = vi.fn(() => startPendingHistory(pending))
      .mockImplementationOnce(() => startPendingHistory(pending))
      .mockImplementationOnce(() => startPendingHistory(currentPage));
    setStore({ loadMoreEvents });
    await renderSection();
    const button = activateHistory();
    await act(async () => {
      store.patch({ eventsIsLoading: true, eventsIsLoadingMore: false, eventsHistoryError: null });
    });
    expect(button).toBeDisabled();
    await act(async () => { store.patch({ eventsIsLoading: false }); });
    // The old network request remains pending, but a completed refresh leaves
    // the current list ready for another page without waiting on that request.
    expect(button).toBeEnabled();
    expect(screen.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'false');
    activateHistory();
    stateSetterCalls.mockClear();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      await settleHistory(pending, loadStale);
      expect(stateSetterCalls).not.toHaveBeenCalled();
      expect(focus).not.toHaveBeenCalled();
      expect(screen.queryByTestId('events-settings-history-error')).not.toBeInTheDocument();
      expect(button).toBeDisabled();
      expect(screen.getByTestId('events-settings-history-status')).toHaveTextContent('Loading history…');
      await settleHistory(currentPage, loadOk);
      expect(button).toBeEnabled();
      expect(loadMoreEvents).toHaveBeenCalledTimes(2);
    } finally {
      focus.mockRestore();
    }
  });
});

describe('EventsSettings history ownership', () => {
  it.each([loadOk, loadFailed, loadStale])('ignores $status settlement after unmount', async (outcome) => {
    const pending = deferredLoad();
    setStore({ loadMoreEvents: vi.fn(() => startPendingHistory(pending)) });
    const view = await renderSection();
    activateHistory();
    view.unmount();
    stateSetterCalls.mockClear();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      await settleHistory(pending, outcome);
      expect(stateSetterCalls).not.toHaveBeenCalled();
      expect(focus).not.toHaveBeenCalled();
    } finally {
      focus.mockRestore();
    }
  });

  it.each(['user-own', 'user-next'])('does not settle into a newer %s session or release its request', async (userId) => {
    const oldPage = deferredLoad();
    const currentPage = deferredLoad();
    const loadMoreEvents = vi.fn(() => startPendingHistory(oldPage))
      .mockImplementationOnce(() => startPendingHistory(oldPage))
      .mockImplementationOnce(() => startPendingHistory(currentPage));
    setStore({ loadMoreEvents });
    await renderSection();
    activateHistory();

    await act(async () => {
      store.patch({
        userId,
        authSessionVersion: 2,
        events: [makeEvent('current', userId)],
        eventsPagination: pagination(),
        eventsIsLoadingMore: false,
        eventsHistoryError: null,
      });
    });
    expect(screen.getByTestId('events-settings-load-more')).toBeEnabled();
    const currentButton = activateHistory();
    stateSetterCalls.mockClear();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      // Store ownership already rejects the old response; exercise the view's
      // checks even with a success result queued before the session transition.
      await act(async () => { oldPage.resolve(loadOk); });
      expect(stateSetterCalls).not.toHaveBeenCalled();
      expect(focus).not.toHaveBeenCalled();
      expect(currentButton).toBeDisabled();
      expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument();
      expect(screen.getByTestId('event-row-current')).toBeInTheDocument();
      await settleHistory(currentPage, loadOk);
      expect(currentButton).toBeEnabled();
      expect(currentButton).toHaveFocus();
    } finally {
      focus.mockRestore();
    }
  });

  it('settles history after StrictMode replays mount effects', async () => {
    const pending = deferredLoad();
    setStore({ loadMoreEvents: vi.fn(() => startPendingHistory(pending)) });
    await renderSection(true);
    activateHistory();
    await settleHistory(pending, loadFailed);
    expect(screen.getByRole('button', { name: 'Retry loading history' })).toBeEnabled();
    expect(screen.getByTestId('events-settings-history-error')).toBeInTheDocument();
  });
});
