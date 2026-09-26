/**
 * EventsSettings — focus behaviour
 *
 * The house standard is a dedicated focus test per dialog
 * (MoodDetailModal.focus.test.tsx, PhotoViewer.focus.test.tsx). This section
 * adds two of them at once, and the delete dialog is the second consumer
 * anywhere whose opener does not survive the action it confirms — the case useFocusTrap explicitly declines to handle
 * (`useFocusTrap.ts:92-104`: the restore is skipped when the opener is no
 * longer connected, and the caller chooses a surviving destination).
 *
 * The store double therefore has to be a REAL store whose writes really mutate
 * `events`. Against a frozen one the row that held the Delete button is still
 * mounted when the dialog closes, `isConnected` is true, and the hook's own
 * restore fires — so the fallback assertions would be proving that the fallback
 * beats a surviving opener, which is the focus-stealing behaviour
 * `formNeedsFallback` exists to prevent, rather than the production path.
 *
 * What these also guard is the Escape handler's identity stability: the hook
 * lists `onEscape` in its effect deps and re-focuses `initialFocusRef` on every
 * run, so an inline arrow would drag focus back to the label field on every
 * render of the app around this section.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';

type CoupleEvent = AppState['events'][number];
type EventLoadResult = Awaited<ReturnType<AppState['loadEvents']>>;
type EventWriteResult = Awaited<ReturnType<AppState['addEvent']>>;
type NewEventInput = Parameters<AppState['addEvent']>[0];
type EventUpdateInput = Parameters<AppState['editEvent']>[1];

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

const OWN_USER_ID = 'user-own';

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

function dateFromISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function makeEvent(overrides: Partial<CoupleEvent> & Pick<CoupleEvent, 'id'>): CoupleEvent {
  return {
    userId: OWN_USER_ID,
    label: 'An event',
    date: new Date(2026, 8, 12),
    createdAt: new Date(2026, 0, 1),
    description: null,
    icon: 'calendar',
    ...overrides,
  };
}

function currentEvents(): CoupleEvent[] {
  return (store.state.events ?? []) as CoupleEvent[];
}

const ok: EventWriteResult = { success: true };
const loadOk: EventLoadResult = { status: 'success' };

type EventWriteFailure = Extract<EventWriteResult, { success: false }>;

/** A refused write, as the slice resolves it. */
function writeFailure(code: EventWriteFailure['code'], error: string): EventWriteFailure {
  return { success: false, code, error };
}

/** A save whose response could not be read: it may or may not have landed. */
const UNREADABLE = writeFailure('invalid-response', 'Unreadable response');
/** A write against a row that is gone or no longer the caller's. */
const STALE = writeFailure('not-found', 'Stale row');

function setStore(overrides: Partial<AppState> = {}) {
  let created = 0;

  store.replace({
    events: [],
    eventsIsLoading: false,
    eventsError: null,
    syncStatus: {
      pendingMoods: 0,
      isOnline: true,
      lastSyncAt: undefined,
      isSyncing: false,
    },
    userId: OWN_USER_ID,
    authSessionVersion: 1,
    loadEvents: vi.fn(async () => loadOk),
    clearEventsError: vi.fn(() => store.patch({ eventsError: null })),
    addEvent: vi.fn(async (input: NewEventInput) => {
      created += 1;
      store.patch({
        events: [
          ...currentEvents(),
          makeEvent({
            id: `created-${created}`,
            label: input.label,
            date: dateFromISO(input.eventDate),
            description: input.description ?? null,
            icon: input.icon ?? 'calendar',
          }),
        ],
      });
      return ok;
    }),
    editEvent: vi.fn(async (eventId: string, updates: EventUpdateInput) => {
      store.patch({
        events: currentEvents().map((event) =>
          event.id === eventId
            ? {
                ...event,
                label: updates.label ?? event.label,
                date: updates.eventDate ? dateFromISO(updates.eventDate) : event.date,
              }
            : event
        ),
      });
      return ok;
    }),
    removeEvent: vi.fn(async (eventId: string) => {
      store.patch({ events: currentEvents().filter((event) => event.id !== eventId) });
      return ok;
    }),
    ...overrides,
  } as unknown as Record<string, unknown>);
}

async function renderSection() {
  const utils = render(<EventsSettings />);
  await act(async () => {});
  return utils;
}

/** The trap captures document.activeElement when it arms; a real click focuses the opener first. */
async function openBy(user: UserEvent, testId: string) {
  const opener = screen.getByTestId(testId);
  await user.click(opener);
  return opener;
}

/** Replaces a form field's value the way a user would: select it all away, then type. */
async function fill(user: UserEvent, testId: string, value: string) {
  const field = screen.getByTestId(testId);
  await user.clear(field);
  await user.type(field, value);
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
});

describe('EventsSettings form focus', () => {
  it('moves focus into the panel, onto the label field, when the form opens', async () => {
    const user = userEvent.setup();
    await renderSection();

    await openBy(user, 'events-settings-add');

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );
    expect(screen.getByTestId('events-form')).toContainElement(
      document.activeElement as HTMLElement | null
    );
  });

  it('closes on Escape and hands focus back to the control that opened it', async () => {
    const user = userEvent.setup();
    await renderSection();

    const opener = await openBy(user, 'events-settings-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab inside the form panel rather than letting focus escape it', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openBy(user, 'events-settings-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    const first = screen.getByTestId('events-form-close');
    const last = screen.getByTestId('events-form-submit');

    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('returns focus to a row’s Edit button after a successful edit', async () => {
    const user = userEvent.setup();
    // The row genuinely survives the edit — the store double keeps the same id —
    // so the opener is still connected and the hook's own restore is correct.
    // The form is handed no fallback in this case; a regression that always
    // passed one would drag focus to the header instead.
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    const opener = await openBy(user, 'event-edit-mine');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    await fill(user, 'events-form-date', '2026-10-01');
    await user.click(screen.getByTestId('events-form-submit'));

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(opener.isConnected).toBe(true);
    // The hook's restore is a passive-phase cleanup too — same race as below.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('lands focus on the header Add button when the empty state’s own opener is gone', async () => {
    const user = userEvent.setup();
    // The add really lands in the store here, so the empty state is replaced by
    // the list and the button that opened the form is removed from the document
    // — the `isConnected === false` branch the fallback exists for.
    await renderSection();

    const opener = await openBy(user, 'events-settings-empty-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    await fill(user, 'events-form-label', 'First');
    await fill(user, 'events-form-date', '2026-10-01');
    await user.click(screen.getByTestId('events-form-submit'));

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    // The premise, asserted rather than assumed.
    expect(screen.queryByTestId('events-settings-empty-add')).not.toBeInTheDocument();
    expect(opener.isConnected).toBe(false);
    // The fallback focus runs in a passive-phase effect cleanup, which can
    // land after the waitFor above has seen the DOM removal — poll for it.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-settings-add'))
    );
  });

  it('hands focus back to Save once a rejected write re-enables it', async () => {
    const user = userEvent.setup();
    // Focus is parked on the panel for the duration of the write, because the
    // browser drops it to <body> when the focused button becomes disabled. On
    // failure it has to come back to a control the user can act on, and it
    // cannot be done inside the await: setIsSaving(false) has not rendered yet,
    // so Save still carries `disabled` and focusing it is a no-op.
    setStore({
      addEvent: vi.fn(async () =>
        writeFailure('offline', 'You are offline. Events need a connection to save.')
      ),
    });

    await renderSection();
    await openBy(user, 'events-settings-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    await fill(user, 'events-form-label', 'Doomed');
    await fill(user, 'events-form-date', '2026-10-01');
    await user.click(screen.getByTestId('events-form-submit'));

    await waitFor(() => expect(screen.getByTestId('events-form-error')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('events-form-submit')).toBeEnabled());
    // The focus effect is passive-phase, so it can run after Save re-enables.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-submit'))
    );
  });

  const UNCERTAIN_SAVES = [
    {
      kind: 'add',
      initialEvents: (): CoupleEvent[] => [],
      writeAction: 'addEvent',
      openerTestId: 'events-settings-empty-add',
      openerSurvives: false,
      loadingAfterRefresh: true,
    },
    {
      kind: 'edit',
      initialEvents: (): CoupleEvent[] => [makeEvent({ id: 'mine' })],
      writeAction: 'editEvent',
      openerTestId: 'event-edit-mine',
      openerSurvives: true,
      loadingAfterRefresh: false,
    },
  ] as const;

  /**
   * Opens the form from the row's opener, submits a save whose response cannot
   * be read, and waits for focus to land on Refresh. The reconciliation load it
   * installs stays pending until `finishRefresh()` is called.
   */
  async function arrangeUncertainSave({
    initialEvents,
    writeAction,
    openerTestId,
  }: (typeof UNCERTAIN_SAVES)[number]) {
    const user = userEvent.setup();
    let finishRefresh!: () => void;
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk);
    const uncertain = vi.fn<() => Promise<EventWriteResult>>(async () => UNREADABLE);
    setStore({
      events: initialEvents(),
      loadEvents,
      [writeAction]: uncertain,
    });
    await renderSection();
    // Installed after the render: the mount load consumes the default.
    loadEvents.mockImplementationOnce(() => {
      store.patch({ eventsIsLoading: true, eventsError: null });
      return new Promise<EventLoadResult>((resolve) => {
        finishRefresh = () => {
          store.patch({
            eventsIsLoading: false,
            eventsError: null,
            events: [makeEvent({ id: 'mine', label: 'Saved event' })],
          });
          resolve(loadOk);
        };
      });
    });

    const opener = await openBy(user, openerTestId);
    await fill(user, 'events-form-label', 'Saved event');
    await fill(user, 'events-form-date', '2026-10-01');
    await user.click(screen.getByTestId('events-form-submit'));

    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toHaveFocus());
    // A closure: `finishRefresh` is only assigned once the reconciliation load runs.
    return { user, loadEvents, uncertain, opener, finishRefresh: () => finishRefresh() };
  }

  /** Clicks Refresh on the uncertain-save form and waits for the form to close. */
  async function reconcile(user: UserEvent) {
    await user.click(screen.getByRole('button', { name: 'Refresh events' }));
    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
  }

  it.each(UNCERTAIN_SAVES)('focuses an enabled Refresh after an uncertain $kind', async (save) => {
    const { opener } = await arrangeUncertainSave(save);

    const refresh = screen.getByRole('button', { name: 'Refresh events' });
    expect(refresh).toBeEnabled();
    expect(opener.isConnected).toBe(true);
  });

  it.each(UNCERTAIN_SAVES)('explains an uncertain $kind in an alert', async (save) => {
    await arrangeUncertainSave(save);

    expect(screen.getByRole('alert')).toHaveTextContent(/may already have been saved/i);
  });

  it.each(UNCERTAIN_SAVES)(
    'wraps Tab between Refresh and Close after an uncertain $kind',
    async (save) => {
      const { user } = await arrangeUncertainSave(save);
      const refresh = screen.getByRole('button', { name: 'Refresh events' });

      await user.tab();
      expect(screen.getByTestId('events-form-close')).toHaveFocus();
      await user.tab({ shift: true });
      expect(refresh).toHaveFocus();
    }
  );

  it.each(UNCERTAIN_SAVES)(
    'focuses the header Add after reconciling an uncertain $kind',
    async (save) => {
      const { user, opener, finishRefresh } = await arrangeUncertainSave(save);

      await reconcile(user);
      expect(opener.isConnected).toBe(save.openerSurvives);
      expect(Boolean(screen.queryByTestId('events-settings-loading'))).toBe(
        save.loadingAfterRefresh
      );
      expect(screen.getByTestId('events-settings-add')).toHaveFocus();
      await act(async () => { finishRefresh(); });
      expect(opener.isConnected).toBe(save.openerSurvives);
      expect(screen.getByTestId('events-settings-add')).toHaveFocus();
    }
  );

  it.each(UNCERTAIN_SAVES)(
    'reloads once and shows the saved row after reconciling an uncertain $kind',
    async (save) => {
      const { user, loadEvents, uncertain, finishRefresh } = await arrangeUncertainSave(save);

      await reconcile(user);
      expect(loadEvents).toHaveBeenCalledTimes(2);
      await act(async () => { finishRefresh(); });
      expect(screen.getByTestId('event-row-mine')).toHaveTextContent('Saved event');
      expect(uncertain).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps focus on the header after refresh later removes the stale edit opener', async () => {
    const user = userEvent.setup();
    let finishRefresh: () => void = () => {};
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk);
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      editEvent: vi.fn(async () => STALE),
    });
    await renderSection();
    loadEvents.mockClear();
    loadEvents.mockImplementationOnce(
      () =>
        new Promise<EventLoadResult>((resolve) => {
          finishRefresh = () => {
            store.patch({ events: [], eventsError: null });
            resolve(loadOk);
          };
        })
    );

    const opener = await openBy(user, 'event-edit-mine');
    await user.click(screen.getByTestId('events-form-submit'));
    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    await user.click(screen.getByTestId('events-form-refresh'));

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-settings-add'))
    );
    expect(opener.isConnected).toBe(true);

    await act(async () => {
      finishRefresh();
    });
    await waitFor(() => expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument());
    expect(opener.isConnected).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId('events-settings-add'));
  });
});

describe('EventsSettings delete dialog focus', () => {
  it('moves focus onto Cancel, because the action cannot be undone', async () => {
    const user = userEvent.setup();
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    await openBy(user, 'event-delete-mine');

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'))
    );
    expect(screen.getByTestId('events-delete-confirmation')).toContainElement(
      document.activeElement as HTMLElement | null
    );
  });

  it('closes on Escape and hands focus back to the row’s Delete button', async () => {
    const user = userEvent.setup();
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    const opener = await openBy(user, 'event-delete-mine');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'))
    );

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab inside the delete panel', async () => {
    const user = userEvent.setup();
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    await openBy(user, 'event-delete-mine');
    const cancel = screen.getByTestId('events-delete-cancel');
    const confirm = screen.getByTestId('events-delete-confirm');
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    // Tab from Cancel reaches Delete, the last control, before the wrap is tested.
    await user.tab();
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('lands focus on a surviving element after the delete succeeds', async () => {
    const user = userEvent.setup();
    // The delete really removes the row, so the button that opened this dialog
    // is gone from the document by the time the trap tears down — useFocusTrap
    // skips its restore, and this fallback is the only thing between a keyboard
    // user and <body>.
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    const opener = await openBy(user, 'event-delete-mine');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'))
    );

    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
    // The premise, asserted rather than assumed.
    expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument();
    expect(opener.isConnected).toBe(false);
    // Same passive-phase race as the save test above — poll, don't read.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-settings-add'))
    );
  });

  it('leaves focus on Cancel when the delete fails, so the user can get out', async () => {
    const user = userEvent.setup();
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(async () =>
        writeFailure('not-found', 'Event not found or not yours to delete')
      ),
    });
    await renderSection();

    await openBy(user, 'event-delete-mine');
    await user.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-error')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('events-delete-cancel')).toBeEnabled());
    // Same passive-phase race as the Save test above — poll, don't read.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'))
    );
  });

  it('moves focus to the header when refreshing a stale delete', async () => {
    const user = userEvent.setup();
    const loadEvents = vi.fn(async () => loadOk);
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      removeEvent: vi.fn(async () => STALE),
    });
    await renderSection();
    loadEvents.mockClear();
    loadEvents.mockImplementationOnce(async () => {
      store.patch({ events: [], eventsError: null });
      return loadOk;
    });

    const opener = await openBy(user, 'event-delete-mine');
    await user.click(screen.getByTestId('events-delete-confirm'));
    await waitFor(() => expect(screen.getByTestId('events-delete-refresh')).toBeInTheDocument());
    await user.click(screen.getByTestId('events-delete-refresh'));

    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument());
    expect(opener.isConnected).toBe(false);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-settings-add'))
    );
  });
});
