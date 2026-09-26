/**
 * Shared harness for the `EventsSettings.*.test.tsx` behaviour suites:
 * fixtures, store double wiring, render and form helpers.
 *
 * Fixtures are built from local date components because `vitest.config.ts`
 * pins `TZ=America/New_York`.
 *
 * The store double is a real subscribable store whose write actions really
 * mutate `events`, mirroring what `eventsSlice` does on success. A frozen
 * object would make three things unobservable — date ordering after a write,
 * the empty state giving way to the list, and the row that held a Delete button
 * disappearing — and the last of those is the entire premise of the fallback
 * focus paths in the sibling focus suite.
 *
 * The store itself is not owned here: `vi.hoisted` and `vi.mock` are scoped to
 * a test file, so each suite keeps its own hoisted `store` and `useAppStore`
 * mock and hands the store to `createEventsStoreKit(store)`. Owning it here
 * would make this module and the mocked `useAppStore` import each other.
 */
import { act, render, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { createAuthSlice } from '../../../stores/slices/authSlice';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';

export type CoupleEvent = AppState['events'][number];
export type EventLoadResult = Awaited<ReturnType<AppState['loadEvents']>>;
export type EventWriteResult = Awaited<ReturnType<AppState['addEvent']>>;
type NewEventInput = Parameters<AppState['addEvent']>[0];
type EventUpdateInput = Parameters<AppState['editEvent']>[1];

export const OWN_USER_ID = 'user-own';
export const PARTNER_USER_ID = 'user-partner';

/** The hoisted store double each test file owns and passes in. */
type EventsStoreDouble = {
  readonly state: Record<string, unknown>;
  replace(next: Record<string, unknown>): void;
  patch(changes: Record<string, unknown>): void;
};

/** Local components, never `new Date('2026-09-12')` — that form parses as UTC. */
export function dateFromISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function makeEvent(overrides: Partial<CoupleEvent> & Pick<CoupleEvent, 'id'>): CoupleEvent {
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

export const ok: EventWriteResult = { success: true };
export const loadOk: EventLoadResult = { status: 'success' };

type EventWriteFailure = Extract<EventWriteResult, { success: false }>;

/** A refused write, as the slice resolves it. */
export function writeFailure(code: EventWriteFailure['code'], error: string): EventWriteFailure {
  return { success: false, code, error };
}

/** A save whose response could not be read: it may or may not have landed. */
export const UNREADABLE = writeFailure('invalid-response', 'Unreadable response');
/** A write against a row that is gone or no longer the caller's. */
export const STALE = writeFailure('not-found', 'Stale row');

/**
 * The store-bound half of the harness: `setStore`, `currentEvents` and
 * `reauthenticate` against the calling file's hoisted `store`. The real
 * `authSlice` is built once per call.
 */
export function createEventsStoreKit(store: EventsStoreDouble) {
  function currentEvents(): CoupleEvent[] {
    return (store.state.events ?? []) as CoupleEvent[];
  }

  // Use the real auth transitions against the subscribable double: in particular,
  // clearAuth must synchronously reset event state and invalidate load ownership.
  const authSlice = createAuthSlice(
    (partial) => store.patch(
      typeof partial === 'function' ? partial(store.state as unknown as AppState) : partial
    ),
    () => store.state as unknown as AppState,
    {} as Parameters<typeof createAuthSlice>[2]
  );

  /**
   * Install a fresh store state. The three write actions mirror what eventsSlice
   * does to `events` on success, so what a test sees after a write is what
   * production would render.
   */
  function setStore(overrides: Partial<AppState> = {}) {
    let created = 0;

    store.replace({
      ...authSlice,
      notes: [],
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

  function reauthenticate() {
    const { clearAuth, setAuthUser } = store.state as unknown as AppState;
    clearAuth();
    setAuthUser(OWN_USER_ID, 'again@example.com');
  }

  return { setStore, currentEvents, reauthenticate };
}

/** Render and let the mount load settle, so no state lands outside act(). */
export async function renderSection() {
  const utils = render(<EventsSettings />);
  await act(async () => {});
  return utils;
}

export async function openAddForm(user: UserEvent) {
  await user.click(screen.getByTestId('events-settings-add'));
}

/**
 * Replace a text field's value as a user would: clear it, then paste the new
 * text. Paste rather than type, because the fixtures run to 500 characters and
 * carry emoji and combining marks that per-key typing would split.
 */
async function replaceText(user: UserEvent, field: HTMLElement, value: string) {
  await user.clear(field);
  if (value !== '') {
    await user.paste(value);
  }
}

export async function fillForm(
  user: UserEvent,
  {
    label,
    date,
    description,
  }: {
    label?: string;
    date?: string;
    description?: string;
  }
) {
  if (label !== undefined) {
    await replaceText(user, screen.getByTestId('events-form-label'), label);
  }
  if (date !== undefined) {
    const dateInput = screen.getByTestId('events-form-date');
    await user.clear(dateInput);
    if (date !== '') {
      await user.type(dateInput, date);
    }
  }
  if (description !== undefined) {
    await replaceText(user, screen.getByTestId('events-form-description'), description);
  }
}

export async function submitForm(user: UserEvent) {
  await user.click(screen.getByTestId('events-form-submit'));
}

export function renderedLabels(): (string | null)[] {
  // Row labels are h4: h1 Settings > h2 Countdowns > h3 Events > h4 rows.
  return within(screen.getByTestId('events-settings-list'))
    .getAllByRole('heading', { level: 4 })
    .map((node) => node.textContent);
}

/**
 * Row labels anywhere in the load region, or `[]` when it holds no list — unlike
 * `renderedLabels()` this never throws, so "no list" is an expected value a
 * table row can carry rather than a separate assertion.
 */
export function regionLabels(): (string | null)[] {
  return within(screen.getByTestId('events-settings-load-region'))
    .queryAllByRole('heading', { level: 4 })
    .map((node) => node.textContent);
}

/** The empty state's sentence, or `null` when the empty state is not shown. */
export function emptyStateText(): string | null {
  return screen.queryByTestId('events-settings-empty')?.querySelector('p')?.textContent ?? null;
}

/** Row descriptions in the load region, `[]` when it holds no list. */
export function regionDescriptions(): (string | null)[] {
  return Array.from(
    screen
      .getByTestId('events-settings-load-region')
      .querySelectorAll('[data-testid^="event-description-"]'),
    (node) => node.textContent
  );
}

export function deferredLoad(onDelivery?: () => void) {
  let resolve!: (result: EventLoadResult) => void;
  const promise = new Promise<EventLoadResult>((release) => { resolve = release; });
  const originalThen = promise.then.bind(promise);
  // Observe the component continuation, before React can flush work between
  // this callback and the test's own await continuation.
  promise.then = function <TResult1 = EventLoadResult, TResult2 = never>(
    onFulfilled?: ((result: EventLoadResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return originalThen((result) => {
      onDelivery?.();
      return onFulfilled ? onFulfilled(result) : (result as TResult1);
    }, onRejected);
  };
  return { promise, resolve };
}

export function expectUnsettledSession() {
  expect(screen.getByTestId('events-settings-loading')).toBeInTheDocument();
  expect(screen.queryByTestId('events-settings-empty')).not.toBeInTheDocument();
  expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
  expect(screen.queryByTestId('events-settings-list')).not.toBeInTheDocument();
}

export const oldOutcomes: EventLoadResult[] = [
  { status: 'success' },
  { status: 'failure', error: 'Previous session failed' },
];
