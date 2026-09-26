/**
 * EventsSettings — behaviour: save reconciliation
 *
 * These pin the unreadable-save reconciliation rows of the story's I/O matrix —
 * what the section does, not how it is styled. The fixtures, the store double's
 * wiring and the form helpers live in eventsSettingsKit.tsx.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { serializeAccountDataWrite } from '../../../services/accountDataQueue';
import type { AppState } from '../../../stores/types';
import {
  createEventsStoreKit,
  deferredLoad,
  emptyStateText,
  fillForm,
  loadOk,
  makeEvent,
  regionLabels,
  renderedLabels,
  renderSection,
  submitForm,
  UNREADABLE,
  writeFailure,
  type CoupleEvent,
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

describe.each([
  {
    kind: 'add',
    initialEvents: (): CoupleEvent[] => [],
    opener: 'events-settings-add',
    writeAction: 'addEvent',
    forbiddenAction: 'editEvent',
    leadingArgs: [] as string[],
    submitLabel: 'Add',
    labelsAfterRefreshFailure: [] as string[],
    loadingDuringRetry: true,
    labelsDuringRetry: [] as string[],
  },
  {
    kind: 'edit',
    initialEvents: (): CoupleEvent[] => [makeEvent({ id: 'mine', label: 'Original event' })],
    opener: 'event-edit-mine',
    writeAction: 'editEvent',
    forbiddenAction: 'addEvent',
    leadingArgs: ['mine'],
    submitLabel: 'Update',
    labelsAfterRefreshFailure: ['Original event'],
    loadingDuringRetry: false,
    labelsDuringRetry: ['Original event'],
  },
] as const)(
  'EventsSettings $kind save reconciliation',
  ({
    initialEvents,
    opener,
    writeAction,
    forbiddenAction,
    leadingArgs,
    submitLabel,
    labelsAfterRefreshFailure,
    loadingDuringRetry,
    labelsDuringRetry,
  }) => {
    async function prepareForm(user: UserEvent) {
      await user.click(screen.getByTestId(opener));
      await fillForm(user, { label: 'Trip together', date: '2026-10-01', description: 'Two weeks away' });
      await user.click(screen.getByTestId('events-form-icon-plane'));
    }

    function saveAction() {
      return store.state[writeAction] as Mock<(...args: never[]) => Promise<EventWriteResult>>;
    }

    function expectWrites(count: number) {
      expect(saveAction()).toHaveBeenCalledTimes(count);
      expect(store.state[forbiddenAction]).not.toHaveBeenCalled();
      expect(store.state.removeEvent).not.toHaveBeenCalled();
    }

    /**
     * Submits a save whose response cannot be read and clicks the form's
     * Refresh. The refresh load and the list Retry load after it stay pending
     * until their deferreds resolve.
     */
    async function startReconciliationRefresh(user: UserEvent) {
      const refresh = deferredLoad();
      const retry = deferredLoad();
      const loadEvents = vi.mocked(store.state.loadEvents as AppState['loadEvents']);
      saveAction().mockResolvedValueOnce(UNREADABLE);
      await renderSection();
      loadEvents.mockImplementationOnce(() => {
        store.patch({ eventsIsLoading: true, eventsError: null });
        return refresh.promise;
      }).mockImplementationOnce(() => {
        store.patch({ eventsIsLoading: true, eventsError: null });
        return retry.promise;
      });
      await prepareForm(user);
      await submitForm(user);
      await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
      await user.click(screen.getByTestId('events-form-refresh'));
      return { loadEvents, refresh, retry };
    }

    /** Fails the reconciliation refresh the way the slice reports a failed load. */
    async function failRefresh(refresh: ReturnType<typeof deferredLoad>) {
      await act(async () => {
        store.patch({ eventsIsLoading: false, eventsError: 'Refresh failed' });
        refresh.resolve({ status: 'failure', error: 'Refresh failed' });
      });
    }

    beforeEach(() => {
      setStore({ events: initialEvents() });
    });

    it.each([
      'The event was not created',
      'The event was saved but its date could not be read',
      'An arbitrary returned message',
    ])('explains uncertainty and preserves the fields for invalid-response: %s', async (error) => {
      const user = userEvent.setup();
      saveAction().mockResolvedValueOnce(writeFailure('invalid-response', error));
      await renderSection();
      await prepareForm(user);
      await submitForm(user);

      await waitFor(() => expect(screen.getByTestId('events-form-error')).toHaveTextContent(
        /may already have been saved/i
      ));
      expect(screen.getByRole('alert')).not.toHaveTextContent(error);
      expect(screen.getByTestId('events-form-label')).toHaveValue('Trip together');
      expect(screen.getByTestId('events-form-date')).toHaveValue('2026-10-01');
      expect(screen.getByTestId('events-form-description')).toHaveValue('Two weeks away');
      expect(screen.getByTestId('events-form-icon-plane')).toBeChecked();
      expect(screen.getByRole('button', { name: 'Refresh events' })).toBeEnabled();
      expect(screen.queryByTestId('events-form-submit')).not.toBeInTheDocument();
      expect(store.state.loadEvents).toHaveBeenCalledTimes(1);
      expectWrites(1);
    });

    it('blocks a direct submit after an uncertain result before React commits the failure', async () => {
      const user = userEvent.setup();
      let finishSave!: (result: EventWriteResult) => void;
      const pendingSave = new Promise<EventWriteResult>((resolve) => { finishSave = resolve; });
      saveAction().mockReturnValueOnce(pendingSave).mockResolvedValue(UNREADABLE);
      await renderSection();
      await prepareForm(user);
      await submitForm(user);
      const form = screen.getByTestId('events-form-element');

      await act(async () => {
        finishSave(UNREADABLE);
        // The save continuation has received invalid-response, but React still
        // exposes the previous render's submit handler during this microtask.
        await Promise.resolve();
        expect(screen.queryByTestId('events-form-error')).not.toBeInTheDocument();
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); // raw submit: must land inside this microtask, before React commits the failure
      });

      expectWrites(1);
      expect(screen.getByTestId('events-form-error')).toHaveTextContent(/may already have been saved/i);
      expect(screen.getByRole('button', { name: 'Refresh events' })).toBeEnabled();
      expect(store.state.loadEvents).toHaveBeenCalledTimes(1);
    });

    it('blocks direct and keyboard submissions, including after field edits', async () => {
      const user = userEvent.setup();
      saveAction().mockResolvedValue(UNREADABLE);
      await renderSection();
      await prepareForm(user);
      await submitForm(user);
      await waitFor(() => expect(screen.getByTestId('events-form-error')).toBeInTheDocument());
      const form = screen.getByTestId('events-form-element');

      // A direct submit event still reaches the form after its button is gone.
      await act(async () => { fireEvent.submit(form); }); // raw submit: the submit button is gone, so only a direct submit reaches the handler it must still guard
      expectWrites(1);

      await fillForm(user, { label: '', date: '', description: 'Changed after the response' });
      await user.click(screen.getByTestId('events-form-icon-ring'));
      await act(async () => { fireEvent.submit(form); }); // raw submit: the submit button is gone, so only a direct submit reaches the handler it must still guard
      expect(screen.getByTestId('events-form-error')).toHaveTextContent(/may already have been saved/i);
      expect(screen.queryByTestId('events-form-label-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('events-form-date-error')).not.toBeInTheDocument();

      await fillForm(user, { label: 'Another label', date: '2026-11-01' });
      await user.click(screen.getByTestId('events-form-label'));
      await user.keyboard('{Enter}');
      // With no submit button and two blocking fields, Enter submits nothing, in a browser or in user-event.
      await act(async () => { fireEvent.submit(form); }); // raw submit: Enter submitted nothing, so this re-checks the direct path now that the fields are valid
      expectWrites(1);
      expect(screen.getByTestId('events-form-error')).toHaveTextContent(/may already have been saved/i);
      expect(screen.getByRole('button', { name: 'Refresh events' })).toBeEnabled();
      expect(screen.queryByTestId('events-form-submit')).not.toBeInTheDocument();
      expect(store.state.loadEvents).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        true,
        (): CoupleEvent[] => [makeEvent({ id: 'mine', label: 'Authoritative saved event' })],
        ['Authoritative saved event'],
        null,
      ],
      [false, (): CoupleEvent[] => [], [], 'No events to display in this part of your history.'],
    ] as const)('reconciles with a read when the bounded refresh contains the saved row: %s', async (_hasSavedRow, refreshedEvents, labels, emptyText) => {
      const user = userEvent.setup();
      const pending = deferredLoad();
      const loadEvents = vi.mocked(store.state.loadEvents as AppState['loadEvents']);
      saveAction().mockResolvedValueOnce(UNREADABLE);
      await renderSection();
      loadEvents.mockImplementationOnce(() => {
        store.patch({ eventsIsLoading: true, eventsError: null });
        return pending.promise;
      });
      await prepareForm(user);
      await submitForm(user);
      await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
      const refresh = screen.getByTestId('events-form-refresh');
      act(() => {
        refresh.click(); // raw click: two clicks in one act() batch prove the ref guard before React commits
        refresh.click(); // raw click: a user.dblClick re-renders between clicks and would stop proving it
      });
      expect(screen.queryByTestId('events-form')).not.toBeInTheDocument();
      expect(loadEvents).toHaveBeenCalledTimes(2);
      expectWrites(1);

      await act(async () => {
        store.patch({
          eventsIsLoading: false,
          events: refreshedEvents(),
          eventsPagination: {
            todayISO: '2026-09-12',
            upcoming: { cursor: null, hasMore: false },
            past: { cursor: null, hasMore: true },
          },
        });
        pending.resolve(loadOk);
      });
      expect(regionLabels()).toEqual(labels);
      expect(emptyStateText()).toBe(emptyText);
      expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('events-form')).not.toBeInTheDocument();
      expect(loadEvents).toHaveBeenCalledTimes(2);
      expectWrites(1);
    });

    it('keeps the form closed with one retryable notice when the reconciliation refresh fails', async () => {
      const user = userEvent.setup();
      const { loadEvents, refresh } = await startReconciliationRefresh(user);
      expect(screen.queryByTestId('events-form')).not.toBeInTheDocument();
      expect(loadEvents).toHaveBeenCalledTimes(2);
      await failRefresh(refresh);

      expect(screen.getAllByTestId('events-settings-load-error')).toHaveLength(1);
      expect(screen.getByTestId('events-settings-load-error')).toHaveTextContent(
        "We couldn't load your events. Check your connection and try again."
      );
      expect(screen.queryByTestId('events-form')).not.toBeInTheDocument();
      expect(regionLabels()).toEqual(labelsAfterRefreshFailure);
      expectWrites(1);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    });

    it('recovers the saved row through the list Retry after the refresh fails', async () => {
      const user = userEvent.setup();
      const { loadEvents, refresh, retry } = await startReconciliationRefresh(user);
      await failRefresh(refresh);

      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(loadEvents).toHaveBeenCalledTimes(3);
      expect(Boolean(screen.queryByTestId('events-settings-loading'))).toBe(loadingDuringRetry);
      expect(regionLabels()).toEqual(labelsDuringRetry);
      await act(async () => {
        store.patch({
          eventsIsLoading: false,
          eventsError: null,
          events: [makeEvent({ id: 'mine', label: 'Recovered saved event' })],
        });
        retry.resolve(loadOk);
      });

      expect(renderedLabels()).toEqual(['Recovered saved event']);
      expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('events-settings-retry')).not.toBeInTheDocument();
      expect(screen.queryByTestId('events-form')).not.toBeInTheDocument();
      expect(loadEvents).toHaveBeenCalledTimes(3);
      expectWrites(1);
    });

    it.each(['offline', 'transport'] as const)('allows a deliberate %s retry with the entered fields', async (code) => {
      const user = userEvent.setup();
      const error = `Returned ${code} message`;
      saveAction().mockResolvedValueOnce(writeFailure(code, error));
      await renderSection();
      await prepareForm(user);
      await submitForm(user);
      await waitFor(() => expect(screen.getByTestId('events-form-error')).toHaveTextContent(error));
      expect(screen.getByTestId('events-form-label')).toHaveValue('Trip together');
      expect(screen.getByTestId('events-form-date')).toHaveValue('2026-10-01');
      expect(screen.getByTestId('events-form-description')).toHaveValue('Two weeks away');
      expect(screen.getByTestId('events-form-icon-plane')).toBeChecked();
      expect(screen.getByRole('button', { name: submitLabel })).toBeEnabled();
      expect(screen.queryByTestId('events-form-refresh')).not.toBeInTheDocument();
      expectWrites(1);

      await submitForm(user);
      await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
      const input = {
        label: 'Trip together', eventDate: '2026-10-01', description: 'Two weeks away', icon: 'plane',
      };
      expect(saveAction()).toHaveBeenNthCalledWith(2, ...leadingArgs, input);
      expectWrites(2);
      expect(renderedLabels()).toEqual(['Trip together']);
      expect(store.state.loadEvents).toHaveBeenCalledTimes(1);
    });
  }
);
