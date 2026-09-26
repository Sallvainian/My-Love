/**
 * EventsSettings — behaviour: add and edit
 *
 * These pin the add and edit rows of the story's I/O matrix — what the section
 * does, not how it is styled. The fixtures, the store double's wiring and the
 * form helpers live in eventsSettingsKit.tsx.
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
  fillForm,
  loadOk,
  makeEvent,
  ok,
  openAddForm,
  renderedLabels,
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

describe('EventsSettings add', () => {
  it('sends the trimmed label and the date input value verbatim, then closes', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: '  Harper visits  ', date: '2026-09-12', description: '  Two weeks  ' });
    await user.click(screen.getByTestId('events-form-icon-plane'));
    await submitForm(user);

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(store.state.addEvent).toHaveBeenCalledWith({
      label: 'Harper visits',
      eventDate: '2026-09-12',
      description: 'Two weeks',
      icon: 'plane',
    });
  });

  it('defaults the icon to calendar and sends a null description when none was typed', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: 'Bare', date: '2026-09-12' });
    await submitForm(user);

    await waitFor(() => expect(store.state.addEvent).toHaveBeenCalled());
    expect(store.state.addEvent).toHaveBeenCalledWith({
      label: 'Bare',
      eventDate: '2026-09-12',
      description: null,
      icon: 'calendar',
    });
  });

  it('drops the new row into date order rather than at the end', async () => {
    const user = userEvent.setup();
    setStore({
      events: [
        makeEvent({ id: 'a', label: 'January', date: new Date(2026, 0, 2) }),
        makeEvent({ id: 'b', label: 'June', date: new Date(2026, 5, 2) }),
      ] as AppState['events'],
    });

    await renderSection();
    expect(renderedLabels()).toEqual(['January', 'June']);

    await openAddForm(user);
    await fillForm(user, { label: 'March', date: '2026-03-02' });
    await submitForm(user);

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(renderedLabels()).toEqual(['January', 'March', 'June']);
  });

  it('keeps the form open and renders the write’s own message when the save is rejected', async () => {
    const user = userEvent.setup();
    setStore({
      addEvent: vi.fn(async () =>
        writeFailure('offline', 'You are offline. Events need a connection to save.')
      ),
    });

    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: 'Doomed', date: '2026-09-12' });
    await submitForm(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'You are offline. Events need a connection to save.'
      )
    );
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
    expect(screen.getByTestId('events-form-label')).toHaveValue('Doomed');
    expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
    expect(screen.getByTestId('events-form-submit')).toBeEnabled();
    expect(screen.queryByTestId('events-form-refresh')).not.toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-list')).not.toBeInTheDocument();
  });

  it('keeps save retry available when the action unexpectedly rejects', async () => {
    const user = userEvent.setup();
    setStore({
      addEvent: vi.fn(async () => {
        throw new Error('Unexpected save rejection');
      }),
    });

    await renderSection();
    await openAddForm(user);
    await fillForm(user, { label: 'Still here', date: '2026-09-12' });
    await submitForm(user);

    await waitFor(() =>
      expect(screen.getByTestId('events-form-error')).toHaveTextContent(
        'Unexpected save rejection'
      )
    );
    expect(screen.getByTestId('events-form-label')).toHaveValue('Still here');
    expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
    expect(screen.getByTestId('events-form-submit')).toBeEnabled();
    expect(screen.queryByTestId('events-form-refresh')).not.toBeInTheDocument();
  });

  it.each([
    ['not-found', true, 'The same returned message'],
    [
      'invalid-response',
      true,
      "This event may already have been saved. We couldn't read the response. Refresh events to check the latest list before making another change.",
    ],
    ['validation', false, 'The same returned message'],
    ['transport', false, 'The same returned message'],
  ] as const)(
    'selects refresh from the %s code, not from otherwise identical prose',
    async (code, offersRefresh, expectedError) => {
      const user = userEvent.setup();
      setStore({
        addEvent: vi.fn(async () => writeFailure(code, 'The same returned message')),
      });

      await renderSection();
      await openAddForm(user);
      await fillForm(user, { label: 'Doomed', date: '2026-09-12' });
      await submitForm(user);

      await waitFor(() =>
        expect(screen.getByTestId('events-form-error').textContent).toBe(expectedError)
      );
      expect(screen.getByTestId('events-form-label')).toHaveValue('Doomed');
      expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
      expect(Boolean(screen.queryByTestId('events-form-refresh'))).toBe(offersRefresh);
      expect(Boolean(screen.queryByTestId('events-form-submit'))).toBe(!offersRefresh);
    }
  );

  it('disables submit while the write is open, so a double tap creates one row', async () => {
    const user = userEvent.setup();
    // `public.events` carries no unique constraint and no idempotency key, so
    // the disabled control is the only double-submit guard there is.
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

    await fillForm(user, { label: 'Once', date: '2026-09-12' });
    await submitForm(user);

    await waitFor(() => expect(screen.getByTestId('events-form-submit')).toBeDisabled());

    await submitForm(user);
    expect(store.state.addEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseAdd?.(ok);
    });
    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
  });
});

describe('EventsSettings edit', () => {
  it('pre-fills the form with the same calendar day the row shows', async () => {
    const user = userEvent.setup();
    setStore({
      events: [
        makeEvent({
          id: 'mine',
          label: 'Harper visits',
          date: new Date(2026, 8, 12),
          description: 'Two whole weeks',
          icon: 'plane',
        }),
      ] as AppState['events'],
    });

    await renderSection();

    expect(screen.getByTestId('event-date-mine')).toHaveTextContent('September 12, 2026');

    await user.click(screen.getByTestId('event-edit-mine'));

    expect(screen.getByTestId('events-form-label')).toHaveValue('Harper visits');
    // formatDateISO over local components — the row above and this field name
    // the same calendar day.
    expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
    expect(screen.getByTestId('events-form-description')).toHaveValue('Two whole weeks');
    expect(screen.getByTestId('events-form-icon-plane')).toBeChecked();
  });

  it('pre-fills from local date components, not from the UTC calendar day', async () => {
    const user = userEvent.setup();
    // A local-midnight fixture cannot tell formatDateISO apart from the
    // forbidden toISOString().split('T')[0] anywhere west of UTC, and
    // vitest.config.ts pins TZ=America/New_York — so both idioms pass the test
    // above. 20:00 local on 2026-09-12 is 2026-09-13 in UTC, which is the only
    // shape that makes the two disagree under the pinned zone.
    setStore({
      events: [
        makeEvent({ id: 'mine', label: 'Harper visits', date: new Date(2026, 8, 12, 20, 0, 0) }),
      ] as AppState['events'],
    });

    await renderSection();
    await user.click(screen.getByTestId('event-edit-mine'));

    expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
  });

  it('saves an edit to the row it was opened from rather than adding a new event', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine', label: 'Harper visits' })] as AppState['events'],
    });

    await renderSection();
    await user.click(screen.getByTestId('event-edit-mine'));

    await fillForm(user, { label: 'Harper arrives', date: '2026-10-01' });
    await submitForm(user);

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(store.state.editEvent).toHaveBeenCalledWith('mine', {
      label: 'Harper arrives',
      eventDate: '2026-10-01',
      description: null,
      icon: 'calendar',
    });
    expect(store.state.addEvent).not.toHaveBeenCalled();
  });

  it('re-sorts the row when the edit moves its date past another', async () => {
    const user = userEvent.setup();
    setStore({
      events: [
        makeEvent({ id: 'a', label: 'January', date: new Date(2026, 0, 2) }),
        makeEvent({ id: 'b', label: 'June', date: new Date(2026, 5, 2) }),
      ] as AppState['events'],
    });

    await renderSection();
    expect(renderedLabels()).toEqual(['January', 'June']);

    await user.click(screen.getByTestId('event-edit-a'));
    await fillForm(user, { date: '2026-12-02' });
    await submitForm(user);

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(renderedLabels()).toEqual(['June', 'January']);
  });

  it('keeps the edit form open with the returned message when the write is rejected', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      editEvent: vi.fn(async () =>
        writeFailure('not-found', 'Event not found or not yours to edit')
      ),
    });

    await renderSection();
    await user.click(screen.getByTestId('event-edit-mine'));

    await fillForm(user, { label: 'Renamed', date: '2026-10-01' });
    await submitForm(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Event not found or not yours to edit')
    );
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
  });

  it('closes a stale edit and reloads the list when Refresh events is activated', async () => {
    const user = userEvent.setup();
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk);
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      editEvent: vi.fn(async () =>
        writeFailure('not-found', 'This prose is deliberately arbitrary')
      ),
    });

    await renderSection();
    loadEvents.mockClear();
    loadEvents.mockImplementationOnce(async () => {
      store.patch({ events: [], eventsError: null });
      return loadOk;
    });
    await user.click(screen.getByTestId('event-edit-mine'));
    await submitForm(user);

    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    const refresh = screen.getByTestId('events-form-refresh');
    act(() => {
      refresh.click(); // raw click: two clicks in one act() batch prove the ref guard before React commits
      refresh.click(); // raw click: a user.dblClick re-renders between clicks and would stop proving it
    });

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(loadEvents).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument());
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
  });

  it('clears an existing load banner after a successful stale-row refresh', async () => {
    const user = userEvent.setup();
    const loadEvents = vi
      .fn()
      .mockImplementationOnce(async () => {
        return { status: 'failure', error: 'The initial load failed' } as const;
      })
      .mockImplementationOnce(async () => {
        return loadOk;
      });
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      editEvent: vi.fn(async () => STALE),
    });

    await renderSection();
    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();

    await user.click(screen.getByTestId('event-edit-mine'));
    await submitForm(user);
    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    await user.click(screen.getByTestId('events-form-refresh'));

    await waitFor(() =>
      expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument()
    );
    expect(loadEvents).toHaveBeenCalledTimes(2);
  });

  it('ignores an older stale mount outcome after a stale-row refresh fails', async () => {
    const user = userEvent.setup();
    let finishMountLoad: (result: EventLoadResult) => void = () => {};
    const loadEvents = vi
      .fn<() => Promise<EventLoadResult>>()
      .mockImplementationOnce(
        () =>
          new Promise<EventLoadResult>((resolve) => {
            finishMountLoad = resolve;
          })
      )
      .mockImplementationOnce(async () => ({
        status: 'failure',
        error: 'The refresh failed',
      }));
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      editEvent: vi.fn(async () => STALE),
    });

    render(<EventsSettings />);
    await user.click(screen.getByTestId('event-edit-mine'));
    await submitForm(user);
    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    await user.click(screen.getByTestId('events-form-refresh'));

    await waitFor(() =>
      expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument()
    );
    expect(loadEvents).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishMountLoad({ status: 'stale' });
    });

    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
  });
});
