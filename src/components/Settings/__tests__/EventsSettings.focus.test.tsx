/**
 * EventsSettings — focus behaviour
 *
 * The house standard is a dedicated focus test per dialog
 * (NavigationTray.focus.test.tsx, MoodDetailModal.focus.test.tsx,
 * PhotoViewer.focus.test.tsx). This section adds two of them at once, and the
 * delete dialog is the second consumer anywhere whose opener does not survive
 * the action it confirms — the case useFocusTrap explicitly declines to handle
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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';

type CoupleEvent = AppState['events'][number];
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

vi.mock('framer-motion', () => ({
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

function setStore(overrides: Partial<AppState> = {}) {
  let created = 0;

  store.replace({
    events: [],
    eventsIsLoading: false,
    eventsError: null,
    userId: OWN_USER_ID,
    loadEvents: vi.fn(async () => {}),
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

/**
 * The trap captures document.activeElement when it arms, and fireEvent.click
 * does not focus the way a real pointer does — so the opener is focused
 * explicitly first, exactly as NavigationTray.focus.test.tsx does.
 */
function openBy(testId: string) {
  const opener = screen.getByTestId(testId);
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
});

describe('EventsSettings form focus', () => {
  it('moves focus into the panel, onto the label field, when the form opens', async () => {
    await renderSection();

    openBy('events-settings-add');

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );
    expect(screen.getByTestId('events-form')).toContainElement(
      document.activeElement as HTMLElement | null
    );
  });

  it('closes on Escape and hands focus back to the control that opened it', async () => {
    await renderSection();

    const opener = openBy('events-settings-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab inside the form panel rather than letting focus escape it', async () => {
    await renderSection();
    openBy('events-settings-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    const first = screen.getByTestId('events-form-close');
    const last = screen.getByTestId('events-form-submit');

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('returns focus to a row’s Edit button after a successful edit', async () => {
    // The row genuinely survives the edit — the store double keeps the same id —
    // so the opener is still connected and the hook's own restore is correct.
    // The form is handed no fallback in this case; a regression that always
    // passed one would drag focus to the header instead.
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    const opener = openBy('event-edit-mine');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    fireEvent.change(screen.getByTestId('events-form-date'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByTestId('events-form-submit'));

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(opener.isConnected).toBe(true);
    // The hook's restore is a passive-phase cleanup too — same race as below.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('lands focus on the header Add button when the empty state’s own opener is gone', async () => {
    // The add really lands in the store here, so the empty state is replaced by
    // the list and the button that opened the form is removed from the document
    // — the `isConnected === false` branch the fallback exists for.
    await renderSection();

    const opener = openBy('events-settings-empty-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    fireEvent.change(screen.getByTestId('events-form-label'), { target: { value: 'First' } });
    fireEvent.change(screen.getByTestId('events-form-date'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByTestId('events-form-submit'));

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
    // Focus is parked on the panel for the duration of the write, because the
    // browser drops it to <body> when the focused button becomes disabled. On
    // failure it has to come back to a control the user can act on, and it
    // cannot be done inside the await: setIsSaving(false) has not rendered yet,
    // so Save still carries `disabled` and focusing it is a no-op.
    setStore({
      addEvent: vi.fn(async () => ({
        success: false as const,
        code: 'offline' as const,
        error: 'You are offline. Events need a connection to save.',
      })),
    });

    await renderSection();
    openBy('events-settings-add');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-form-label'))
    );

    fireEvent.change(screen.getByTestId('events-form-label'), { target: { value: 'Doomed' } });
    fireEvent.change(screen.getByTestId('events-form-date'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByTestId('events-form-submit'));

    await waitFor(() => expect(screen.getByTestId('events-form-error')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('events-form-submit')).not.toBeDisabled());
    expect(document.activeElement).toBe(screen.getByTestId('events-form-submit'));
  });

  it('keeps focus on the header after refresh later removes the stale edit opener', async () => {
    let finishRefresh: () => void = () => {};
    const loadEvents = vi.fn(async () => {});
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      editEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'Stale row',
      })),
    });
    await renderSection();
    loadEvents.mockClear();
    loadEvents.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = () => {
            store.patch({ events: [], eventsError: null });
            resolve();
          };
        })
    );

    const opener = openBy('event-edit-mine');
    fireEvent.click(screen.getByTestId('events-form-submit'));
    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('events-form-refresh'));

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
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    openBy('event-delete-mine');

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'))
    );
    expect(screen.getByTestId('events-delete-confirmation')).toContainElement(
      document.activeElement as HTMLElement | null
    );
  });

  it('closes on Escape and hands focus back to the row’s Delete button', async () => {
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    const opener = openBy('event-delete-mine');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'))
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab inside the delete panel', async () => {
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    openBy('event-delete-mine');
    const cancel = screen.getByTestId('events-delete-cancel');
    const confirm = screen.getByTestId('events-delete-confirm');
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('lands focus on a surviving element after the delete succeeds', async () => {
    // The delete really removes the row, so the button that opened this dialog
    // is gone from the document by the time the trap tears down — useFocusTrap
    // skips its restore, and this fallback is the only thing between a keyboard
    // user and <body>.
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });
    await renderSection();

    const opener = openBy('event-delete-mine');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'))
    );

    fireEvent.click(screen.getByTestId('events-delete-confirm'));

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
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'Event not found or not yours to delete',
      })),
    });
    await renderSection();

    openBy('event-delete-mine');
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-error')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('events-delete-cancel')).not.toBeDisabled());
    expect(document.activeElement).toBe(screen.getByTestId('events-delete-cancel'));
  });

  it('moves focus to the header when refreshing a stale delete', async () => {
    const loadEvents = vi.fn(async () => {});
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      removeEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'Stale row',
      })),
    });
    await renderSection();
    loadEvents.mockClear();
    loadEvents.mockImplementationOnce(async () => {
      store.patch({ events: [], eventsError: null });
    });

    const opener = openBy('event-delete-mine');
    fireEvent.click(screen.getByTestId('events-delete-confirm'));
    await waitFor(() => expect(screen.getByTestId('events-delete-refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('events-delete-refresh'));

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
