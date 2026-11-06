/**
 * Mock-free helpers for the eventsSlice test files (`eventsSlice.test.ts`,
 * `eventsSlice.paging.test.ts` and `eventsSlice.writes.test.ts`): a store
 * holding only the events slice, and builders for its events, form input and
 * pagination. Each of those files keeps its own service fakes, `vi.mock`s and
 * `beforeEach`.
 */
import { create, type StateCreator } from 'zustand';
import type {
  CoupleEvent,
  EventsPagination,
  EventWriteErrorCode,
} from '../../../src/services/eventsService';
import { createEventsSlice, type EventsSlice } from '../../../src/stores/slices/eventsSlice';

export const USER_ID = 'USER-A-ID';

export type TestStore = EventsSlice & { userId: string | null; authSessionVersion: number };

export function createTestStore() {
  const store = create<TestStore>()(createEventsSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_ID, authSessionVersion: 1 });
  return store;
}

export function event(id: string, isoDate: string, overrides: Partial<CoupleEvent> = {}): CoupleEvent {
  const [year, month, day] = isoDate.split('-').map(Number);
  return {
    id,
    userId: USER_ID,
    label: id,
    date: new Date(year, month - 1, day),
    createdAt: new Date(2026, 0, 1),
    description: null,
    icon: 'calendar',
    ...overrides,
  };
}

/** What the events form submits to `addEvent`; the defaults serve a case that needs any input. */
export function eventInput(label = 'x', eventDate = '2026-10-31') {
  return { label, eventDate };
}

export function pagination(hasMore = true): EventsPagination {
  return {
    todayISO: '2026-09-12',
    upcoming: { cursor: null, hasMore: false },
    past: {
      cursor: { event_date: '2026-08-01', created_at: '2026-01-01T00:00:00.123456+00:00', id: 'edge' },
      hasMore,
    },
  };
}

export function codedWriteError(code: EventWriteErrorCode, message: string): Error {
  return Object.assign(new Error(message), { code });
}

export function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
