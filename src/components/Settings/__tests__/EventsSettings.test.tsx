/**
 * EventsSettings — behaviour
 *
 * The first test under `src/components/Settings/`, so it also fixes the
 * conventions for the directory: the framer-motion `m` mock the rest of the
 * tree uses, and fixtures built from local date components because
 * `vitest.config.ts` pins `TZ=America/New_York`.
 *
 * The store double is a real subscribable store whose write actions really
 * mutate `events`, mirroring what `eventsSlice` does on success. A frozen
 * object would make three things unobservable — date ordering after a write,
 * the empty state giving way to the list, and the row that held a Delete button
 * disappearing — and the last of those is the entire premise of the fallback
 * focus paths in the sibling focus suite.
 *
 * These pin the rows of the story's I/O matrix — what the section does, not how
 * it is styled. Focus behaviour lives in EventsSettings.focus.test.tsx,
 * following the house standard of a dedicated focus test per dialog.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, initial: _i, animate: _a, exit: _e, ...props }: DivProps) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const OWN_USER_ID = 'user-own';
const PARTNER_USER_ID = 'user-partner';

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

/** Local components, never `new Date('2026-09-12')` — that form parses as UTC. */
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

/** The slice's own ordering: soonest first, createdAt as the same-day tiebreak. */
function sortByDate(events: CoupleEvent[]): CoupleEvent[] {
  return [...events].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
  );
}

function currentEvents(): CoupleEvent[] {
  return (store.state.events ?? []) as CoupleEvent[];
}

const ok: EventWriteResult = { success: true };
const loadOk: EventLoadResult = { status: 'success' };

/**
 * Install a fresh store state. The three write actions mirror what eventsSlice
 * does to `events` on success, so what a test sees after a write is what
 * production would render.
 */
function setStore(overrides: Partial<AppState> = {}) {
  let created = 0;

  store.replace({
    events: [],
    eventsIsLoading: false,
    eventsError: null,
    userId: OWN_USER_ID,
    loadEvents: vi.fn(async () => loadOk),
    addEvent: vi.fn(async (input: NewEventInput) => {
      created += 1;
      store.patch({
        events: sortByDate([
          ...currentEvents(),
          makeEvent({
            id: `created-${created}`,
            label: input.label,
            date: dateFromISO(input.eventDate),
            description: input.description ?? null,
            icon: input.icon ?? 'calendar',
            createdAt: new Date(2026, 0, 1 + created),
          }),
        ]),
      });
      return ok;
    }),
    editEvent: vi.fn(async (eventId: string, updates: EventUpdateInput) => {
      store.patch({
        events: sortByDate(
          currentEvents().map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  label: updates.label ?? event.label,
                  date: updates.eventDate ? dateFromISO(updates.eventDate) : event.date,
                  description:
                    updates.description === undefined ? event.description : updates.description,
                  icon: updates.icon ?? event.icon,
                }
              : event
          )
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

/** Render and let the mount load settle, so no state lands outside act(). */
async function renderSection() {
  const utils = render(<EventsSettings />);
  await act(async () => {});
  return utils;
}

function openAddForm() {
  fireEvent.click(screen.getByTestId('events-settings-add'));
}

function fillForm({
  label,
  date,
  description,
}: {
  label?: string;
  date?: string;
  description?: string;
}) {
  if (label !== undefined) {
    fireEvent.change(screen.getByTestId('events-form-label'), { target: { value: label } });
  }
  if (date !== undefined) {
    fireEvent.change(screen.getByTestId('events-form-date'), { target: { value: date } });
  }
  if (description !== undefined) {
    fireEvent.change(screen.getByTestId('events-form-description'), {
      target: { value: description },
    });
  }
}

function submitForm() {
  fireEvent.click(screen.getByTestId('events-form-submit'));
}

function renderedLabels(): (string | null)[] {
  return within(screen.getByTestId('events-settings-list'))
    .getAllByRole('heading', { level: 3 })
    .map((node) => node.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
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
          label: 'Gracie visits',
          date: new Date(2026, 8, 12),
          description: 'Two whole weeks',
        }),
      ] as AppState['events'],
    });

    await renderSection();

    expect(screen.getByTestId('event-label-past-1')).toHaveTextContent('Last Christmas');
    expect(screen.getByTestId('event-date-past-1')).toHaveTextContent('December 25, 2020');
    expect(screen.getByTestId('event-label-future-1')).toHaveTextContent('Gracie visits');
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
    await renderSection();

    fireEvent.click(screen.getByTestId('events-settings-empty-add'));

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
    // A failed refresh must never blank a list already on screen: events are
    // Supabase-only with no mirror to repopulate from. Reordering the slot
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

  it('keeps the form write failure when its pending mount load succeeds', async () => {
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
      addEvent: vi.fn(async () => ({
        success: false as const,
        code: 'transport' as const,
        error: 'This event did not save',
      })),
    });

    render(<EventsSettings />);
    openAddForm();
    fillForm({ label: 'Unsaved trip', date: '2026-10-31' });
    submitForm();

    await waitFor(() =>
      expect(screen.getByTestId('events-form-error')).toHaveTextContent(
        'This event did not save'
      )
    );
    const loadRegion = screen.getByTestId('events-settings-load-region');
    expect(loadRegion).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('events-settings')).not.toHaveAttribute('aria-busy');
    expect(loadRegion).not.toContainElement(screen.getByTestId('events-form-error'));
    await act(async () => {
      finishLoad();
    });

    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
    expect(screen.getByTestId('events-form-error')).toHaveTextContent('This event did not save');
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
});

describe('EventsSettings validation', () => {
  it('rejects a blank label without issuing a request', async () => {
    await renderSection();
    openAddForm();

    fillForm({ label: '   ', date: '2026-09-12' });
    submitForm();

    expect(screen.getByTestId('events-form-label-error')).toHaveTextContent('Label is required');
    expect(store.state.addEvent).not.toHaveBeenCalled();
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
  });

  it('rejects a 101-character label, naming the 100-character limit', async () => {
    await renderSection();
    openAddForm();

    fillForm({ label: 'x'.repeat(101), date: '2026-09-12' });
    submitForm();

    expect(screen.getByTestId('events-form-label-error')).toHaveTextContent(
      'Label must be 100 characters or fewer'
    );
    expect(store.state.addEvent).not.toHaveBeenCalled();
  });

  it('rejects a 501-character description, naming the 500-character limit', async () => {
    await renderSection();
    openAddForm();

    fillForm({ label: 'Fine', date: '2026-09-12', description: 'y'.repeat(501) });
    submitForm();

    expect(screen.getByTestId('events-form-description-error')).toHaveTextContent(
      'Description must be 500 characters or fewer'
    );
    expect(store.state.addEvent).not.toHaveBeenCalled();
  });

  it('rejects a missing date without issuing a request', async () => {
    await renderSection();
    openAddForm();

    fillForm({ label: 'Fine' });
    submitForm();

    expect(screen.getByTestId('events-form-date-error')).toHaveTextContent('Date is required');
    expect(store.state.addEvent).not.toHaveBeenCalled();
  });

  it('announces each field error and points the input at it', async () => {
    // aria-invalid on its own tells a screen-reader user the field is wrong and
    // never says why, and an error that is only rendered — not announced —
    // reaches nobody who submitted with the keyboard.
    await renderSection();
    openAddForm();

    submitForm();

    const labelError = screen.getByTestId('events-form-label-error');
    const dateError = screen.getByTestId('events-form-date-error');
    expect(labelError).toHaveAttribute('role', 'alert');
    expect(dateError).toHaveAttribute('role', 'alert');

    const labelInput = screen.getByTestId('events-form-label');
    expect(labelInput).toHaveAttribute('aria-invalid', 'true');
    expect(labelInput).toHaveAttribute('aria-describedby', labelError.id);
    expect(labelError.id).not.toBe('');

    const dateInput = screen.getByTestId('events-form-date');
    expect(dateInput).toHaveAttribute('aria-describedby', dateError.id);
  });

  it('clears a field error as soon as that field is edited', async () => {
    // setErrors used to run only on submit, so a corrected label kept its red
    // border, its aria-invalid and its message until the user resubmitted.
    await renderSection();
    openAddForm();

    submitForm();
    expect(screen.getByTestId('events-form-label-error')).toBeInTheDocument();
    expect(screen.getByTestId('events-form-date-error')).toBeInTheDocument();

    fillForm({ label: 'Now fine' });

    expect(screen.queryByTestId('events-form-label-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('events-form-label')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByTestId('events-form-label')).not.toHaveAttribute('aria-describedby');
    // Only that field's error goes; the untouched one stays.
    expect(screen.getByTestId('events-form-date-error')).toBeInTheDocument();
  });
});

describe('EventsSettings add', () => {
  it('sends the trimmed label and the date input value verbatim, then closes', async () => {
    await renderSection();
    openAddForm();

    fillForm({ label: '  Gracie visits  ', date: '2026-09-12', description: '  Two weeks  ' });
    fireEvent.click(screen.getByTestId('events-form-icon-plane'));
    submitForm();

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(store.state.addEvent).toHaveBeenCalledWith({
      label: 'Gracie visits',
      eventDate: '2026-09-12',
      description: 'Two weeks',
      icon: 'plane',
    });
  });

  it('defaults the icon to calendar and sends a null description when none was typed', async () => {
    await renderSection();
    openAddForm();

    fillForm({ label: 'Bare', date: '2026-09-12' });
    submitForm();

    await waitFor(() => expect(store.state.addEvent).toHaveBeenCalled());
    expect(store.state.addEvent).toHaveBeenCalledWith({
      label: 'Bare',
      eventDate: '2026-09-12',
      description: null,
      icon: 'calendar',
    });
  });

  it('drops the new row into date order rather than at the end', async () => {
    setStore({
      events: [
        makeEvent({ id: 'a', label: 'January', date: new Date(2026, 0, 2) }),
        makeEvent({ id: 'b', label: 'June', date: new Date(2026, 5, 2) }),
      ] as AppState['events'],
    });

    await renderSection();
    expect(renderedLabels()).toEqual(['January', 'June']);

    openAddForm();
    fillForm({ label: 'March', date: '2026-03-02' });
    submitForm();

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(renderedLabels()).toEqual(['January', 'March', 'June']);
  });

  it('keeps the form open and renders the write’s own message when the save is rejected', async () => {
    setStore({
      addEvent: vi.fn(async () => ({
        success: false as const,
        code: 'offline' as const,
        error: 'You are offline. Events need a connection to save.',
      })),
    });

    await renderSection();
    openAddForm();

    fillForm({ label: 'Doomed', date: '2026-09-12' });
    submitForm();

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
    setStore({
      addEvent: vi.fn(async () => {
        throw new Error('Unexpected save rejection');
      }),
    });

    await renderSection();
    openAddForm();
    fillForm({ label: 'Still here', date: '2026-09-12' });
    submitForm();

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
    ['not-found', true],
    ['validation', false],
    ['transport', false],
  ] as const)(
    'selects refresh from the %s code, not from otherwise identical prose',
    async (code, offersRefresh) => {
      setStore({
        addEvent: vi.fn(async () => ({
          success: false as const,
          code,
          error: 'The same returned message',
        })),
      });

      await renderSection();
      openAddForm();
      fillForm({ label: 'Doomed', date: '2026-09-12' });
      submitForm();

      await waitFor(() =>
        expect(screen.getByTestId('events-form-error')).toHaveTextContent(
          'The same returned message'
        )
      );
      expect(screen.getByTestId('events-form-label')).toHaveValue('Doomed');
      expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
      expect(Boolean(screen.queryByTestId('events-form-refresh'))).toBe(offersRefresh);
      expect(Boolean(screen.queryByTestId('events-form-submit'))).toBe(!offersRefresh);
    }
  );

  it('disables submit while the write is open, so a double tap creates one row', async () => {
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
    openAddForm();

    fillForm({ label: 'Once', date: '2026-09-12' });
    submitForm();

    await waitFor(() => expect(screen.getByTestId('events-form-submit')).toBeDisabled());

    submitForm();
    expect(store.state.addEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseAdd?.(ok);
    });
    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
  });
});

describe('EventsSettings edit', () => {
  it('pre-fills the form with the same calendar day the row shows', async () => {
    setStore({
      events: [
        makeEvent({
          id: 'mine',
          label: 'Gracie visits',
          date: new Date(2026, 8, 12),
          description: 'Two whole weeks',
          icon: 'plane',
        }),
      ] as AppState['events'],
    });

    await renderSection();

    expect(screen.getByTestId('event-date-mine')).toHaveTextContent('September 12, 2026');

    fireEvent.click(screen.getByTestId('event-edit-mine'));

    expect(screen.getByTestId('events-form-label')).toHaveValue('Gracie visits');
    // formatDateISO over local components — the row above and this field name
    // the same calendar day.
    expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
    expect(screen.getByTestId('events-form-description')).toHaveValue('Two whole weeks');
    expect(screen.getByTestId('events-form-icon-plane')).toBeChecked();
  });

  it('pre-fills from local date components, not from the UTC calendar day', async () => {
    // A local-midnight fixture cannot tell formatDateISO apart from the
    // forbidden toISOString().split('T')[0] anywhere west of UTC, and
    // vitest.config.ts pins TZ=America/New_York — so both idioms pass the test
    // above. 20:00 local on 2026-09-12 is 2026-09-13 in UTC, which is the only
    // shape that makes the two disagree under the pinned zone.
    setStore({
      events: [
        makeEvent({ id: 'mine', label: 'Gracie visits', date: new Date(2026, 8, 12, 20, 0, 0) }),
      ] as AppState['events'],
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-edit-mine'));

    expect(screen.getByTestId('events-form-date')).toHaveValue('2026-09-12');
  });

  it('routes the save through editEvent with the row id', async () => {
    setStore({
      events: [makeEvent({ id: 'mine', label: 'Gracie visits' })] as AppState['events'],
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-edit-mine'));

    fillForm({ label: 'Gracie arrives', date: '2026-10-01' });
    submitForm();

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(store.state.editEvent).toHaveBeenCalledWith('mine', {
      label: 'Gracie arrives',
      eventDate: '2026-10-01',
      description: null,
      icon: 'calendar',
    });
    expect(store.state.addEvent).not.toHaveBeenCalled();
  });

  it('re-sorts the row when the edit moves its date past another', async () => {
    setStore({
      events: [
        makeEvent({ id: 'a', label: 'January', date: new Date(2026, 0, 2) }),
        makeEvent({ id: 'b', label: 'June', date: new Date(2026, 5, 2) }),
      ] as AppState['events'],
    });

    await renderSection();
    expect(renderedLabels()).toEqual(['January', 'June']);

    fireEvent.click(screen.getByTestId('event-edit-a'));
    fillForm({ date: '2026-12-02' });
    submitForm();

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(renderedLabels()).toEqual(['June', 'January']);
  });

  it('keeps the edit form open with the returned message when the write is rejected', async () => {
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      editEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'Event not found or not yours to edit',
      })),
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-edit-mine'));

    fillForm({ label: 'Renamed', date: '2026-10-01' });
    submitForm();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Event not found or not yours to edit')
    );
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
  });

  it('closes a stale edit and reloads the list when Refresh events is activated', async () => {
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk);
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      loadEvents,
      editEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'This prose is deliberately arbitrary',
      })),
    });

    await renderSection();
    loadEvents.mockClear();
    loadEvents.mockImplementationOnce(async () => {
      store.patch({ events: [], eventsError: null });
      return loadOk;
    });
    fireEvent.click(screen.getByTestId('event-edit-mine'));
    submitForm();

    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    const refresh = screen.getByTestId('events-form-refresh');
    act(() => {
      refresh.click();
      refresh.click();
    });

    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(loadEvents).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument());
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
  });

  it('clears an existing load banner after a successful stale-row refresh', async () => {
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
      editEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'Stale row',
      })),
    });

    await renderSection();
    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('event-edit-mine'));
    submitForm();
    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('events-form-refresh'));

    await waitFor(() =>
      expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument()
    );
    expect(loadEvents).toHaveBeenCalledTimes(2);
  });

  it('ignores an older stale mount outcome after a stale-row refresh fails', async () => {
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
      editEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'Stale row',
      })),
    });

    render(<EventsSettings />);
    fireEvent.click(screen.getByTestId('event-edit-mine'));
    submitForm();
    await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('events-form-refresh'));

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

describe('EventsSettings delete', () => {
  it('asks for confirmation before deleting', async () => {
    setStore({
      events: [makeEvent({ id: 'mine', label: 'Gracie visits' })] as AppState['events'],
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));

    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();
    expect(store.state.removeEvent).not.toHaveBeenCalled();
  });

  it('removes the row and closes once the confirmation is accepted', async () => {
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
    expect(store.state.removeEvent).toHaveBeenCalledWith('mine');
    expect(screen.queryByTestId('event-row-mine')).not.toBeInTheDocument();
    // Its last row gone, the section falls back to the empty state.
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
  });

  it('cancels without deleting', async () => {
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-cancel'));

    expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument();
    expect(store.state.removeEvent).not.toHaveBeenCalled();
  });

  it('keeps the row and shows the returned message when the delete is rejected', async () => {
    setStore({
      events: [makeEvent({ id: 'mine', label: 'Gracie visits' })] as AppState['events'],
      removeEvent: vi.fn(async () => ({
        success: false as const,
        code: 'not-found' as const,
        error: 'Event not found or not yours to delete',
      })),
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Event not found or not yours to delete')
    );
    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(screen.getByTestId('events-delete-refresh')).toHaveClass('bg-blue-500');
    expect(screen.getByTestId('events-delete-refresh')).not.toHaveClass('bg-red-500');
    expect(screen.queryByTestId('events-delete-confirm')).not.toBeInTheDocument();
  });

  it('keeps deliberate delete retry enabled for a transport-coded failure', async () => {
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(async () => ({
        success: false as const,
        code: 'transport' as const,
        error: 'Event not found or not yours to delete',
      })),
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-error')).toBeInTheDocument());
    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();
    expect(screen.getByTestId('event-row-mine')).toBeInTheDocument();
    expect(screen.getByTestId('events-delete-confirm')).toBeEnabled();
    expect(screen.queryByTestId('events-delete-refresh')).not.toBeInTheDocument();
  });

  it('keeps delete retry available when the action unexpectedly rejects', async () => {
    setStore({
      events: [makeEvent({ id: 'mine' })] as AppState['events'],
      removeEvent: vi.fn(async () => {
        throw new Error('Unexpected delete rejection');
      }),
    });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

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
    const loadEvents = vi.fn<() => Promise<EventLoadResult>>(async () => loadOk);
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
      store.patch({ eventsError: 'Manual refresh failed' });
      return { status: 'failure', error: 'Manual refresh failed' } as const;
    });
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-refresh')).toBeInTheDocument());
    const refresh = screen.getByTestId('events-delete-refresh');
    act(() => {
      refresh.click();
      refresh.click();
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
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-confirm')).toBeDisabled());

    fireEvent.click(screen.getByTestId('events-delete-confirm'));
    expect(store.state.removeEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseRemove?.(ok);
    });
  });
});

describe('EventsSettings accessible names and modal semantics', () => {
  it('names the header Add button, which is icon-only below the sm breakpoint', async () => {
    // The visible "Add Event" span is `hidden sm:inline`, so on the phone
    // viewport the aria-label is the button's entire accessible name.
    await renderSection();

    expect(screen.getByRole('button', { name: 'Add event' })).toBe(
      screen.getByTestId('events-settings-add')
    );
  });

  it('exposes the form as a modal dialog named by its heading', async () => {
    await renderSection();
    openAddForm();

    const dialog = screen.getByRole('dialog', { name: 'Add Event' });
    expect(dialog).toBe(screen.getByTestId('events-form'));
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('exposes the delete confirmation as a modal dialog named by its heading', async () => {
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));

    const dialog = screen.getByRole('dialog', { name: 'Delete this event?' });
    expect(dialog).toBe(screen.getByTestId('events-delete-confirmation'));
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

describe('EventsSettings dismissal guards', () => {
  it('closes the form on a backdrop click when nothing is in flight', async () => {
    await renderSection();
    openAddForm();

    fireEvent.click(screen.getByTestId('events-form'));

    expect(screen.queryByTestId('events-form')).not.toBeInTheDocument();
  });

  it('ignores Escape and a backdrop click while the save is in flight', async () => {
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
    openAddForm();
    fillForm({ label: 'Held', date: '2026-09-12' });
    submitForm();

    await waitFor(() => expect(screen.getByTestId('events-form-submit')).toBeDisabled());

    // handleSubmit parks focus ON THE PANEL before Save is disabled: a browser
    // moves focus to <body> when the focused element becomes disabled, and
    // useFocusTrap binds its keydown listener to the container — so without the
    // move, Tab leaves the dialog and the Escape suppression asserted below is
    // never reached. The panel itself, not merely "somewhere inside the
    // dialog": the label input already satisfies the weaker form before submit,
    // which makes it pass with the parking deleted.
    expect(document.activeElement).toBe(
      screen.getByTestId('events-form').querySelector('[tabindex="-1"]')
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.getByTestId('events-form')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('events-form'));
    expect(screen.getByTestId('events-form')).toBeInTheDocument();

    await act(async () => {
      releaseAdd?.(ok);
    });
    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
  });

  it('closes the delete dialog on a backdrop click when nothing is in flight', async () => {
    setStore({ events: [makeEvent({ id: 'mine' })] as AppState['events'] });

    await renderSection();
    fireEvent.click(screen.getByTestId('event-delete-mine'));

    fireEvent.click(screen.getByTestId('events-delete-confirmation'));

    expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument();
    expect(store.state.removeEvent).not.toHaveBeenCalled();
  });

  it('ignores Escape and a backdrop click while the delete is in flight', async () => {
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
    fireEvent.click(screen.getByTestId('event-delete-mine'));
    fireEvent.click(screen.getByTestId('events-delete-confirm'));

    await waitFor(() => expect(screen.getByTestId('events-delete-confirm')).toBeDisabled());

    // Same parking as the form — see the note in the save-in-flight test.
    expect(document.activeElement).toBe(
      screen.getByTestId('events-delete-confirmation').querySelector('[tabindex="-1"]')
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('events-delete-confirmation'));
    expect(screen.getByTestId('events-delete-confirmation')).toBeInTheDocument();

    await act(async () => {
      releaseRemove?.(ok);
    });
    await waitFor(() =>
      expect(screen.queryByTestId('events-delete-confirmation')).not.toBeInTheDocument()
    );
  });
});
