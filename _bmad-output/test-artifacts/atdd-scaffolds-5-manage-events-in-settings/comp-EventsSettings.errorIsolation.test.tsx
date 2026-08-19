/**
 * RED-PHASE ATDD SCAFFOLD — story 5, `5-manage-events-in-settings`
 *
 * TARGET PATH ON ACTIVATION:
 *   src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx
 *
 * COVERS:
 *   DE.5-COMP-002 [P2] — `test-design-epic-5.md:357`, risk R-002. Blocked on DW-26.
 *   DE.5-COMP-003 [P2] — `test-design-epic-5.md:358`, risk R-003. Blocked on DW-27.
 *
 * RUN: npx vitest run src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx
 *
 * MEASURED FIRST RUN: RED — both cases, run 2026-08-19 as
 * `npx vitest run src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx`.
 * Result: 2 failed, 0 passed, each failing on the assertion that names its own
 * ledger entry:
 *
 *   DE.5-COMP-002  `expect(element).not.toBeInTheDocument()` —
 *                  "expected document not to contain element, found <div ...
 *                  data-testid="events-settings-load-error" ...>". The false
 *                  notice is rendered, exactly as DW-26 describes.
 *   DE.5-COMP-003  `expected "vi.fn()" to be called 2 times, but got 1 times`.
 *                  The reconnect never re-fires the load, exactly as DW-27
 *                  describes. Its E2E twin
 *                  (tests/e2e/settings/events-load-recovery.spec.ts) failed in
 *                  the same run for the same reason.
 *
 * Neither is red because the feature is unbuilt: each pins an open entry in the
 * deferred-work ledger.
 *
 *   DW-26 (`deferred-work.md:236-242`): "A save that fails while the first load
 *   is still in flight makes the list paint a false 'we couldn't load your
 *   events' notice after that load succeeds." One `eventsError` key serves loads
 *   and all three writes with no per-call token.
 *
 *   DW-27 (`deferred-work.md:244-250`): "Once the Settings events load fails,
 *   nothing re-fires it: the notice and the empty list persist until the user
 *   reloads the page." The mount effect's deps are `[userId, loadEvents]`
 *   (`EventsSettings.tsx:141`) where App.tsx's otherwise identical Home effect
 *   adds `isOnline` (`App.tsx:447`).
 *
 * GREEN CONDITION IS A PRODUCTION CHANGE, NOT A TEST CHANGE. Both fixes land
 * outside this component's story-5 Never list — DW-26 needs a per-call error
 * token in `eventsSlice.ts`, DW-27 needs the online flag in this effect's deps.
 * If either test is ever "fixed" by editing the assertion, the ledger entry it
 * represents has been silently closed without the defect being fixed.
 *
 * HARNESS: duplicated from `EventsSettings.test.tsx:20-180` rather than
 * extracted. That is the house pattern here — `NavigationTray.test.tsx` and
 * `NavigationTray.focus.test.tsx` duplicate the same way, and the story's review
 * pass explicitly dismissed extracting it.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../stores/types';
import { EventsSettings } from '../EventsSettings';

type CoupleEvent = AppState['events'][number];
type EventWriteResult = Awaited<ReturnType<AppState['addEvent']>>;

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

const ok: EventWriteResult = { success: true };

/**
 * `syncStatus` is in the base state because DW-27's fix reads the online flag
 * from the store, exactly as App.tsx does at `:85` (`isOnline: s.syncStatus.isOnline`).
 */
function setStore(overrides: Record<string, unknown> = {}) {
  store.replace({
    events: [],
    eventsIsLoading: false,
    eventsError: null,
    userId: OWN_USER_ID,
    syncStatus: { isOnline: true },
    loadEvents: vi.fn(async () => {}),
    addEvent: vi.fn(async () => ok),
    editEvent: vi.fn(async () => ok),
    removeEvent: vi.fn(async () => ok),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
});

describe.skip('DE.5-COMP-002: a failed save cannot forge a failed load (DW-26)', () => {
  it('leaves no load notice when a save fails inside the first load flight window', async () => {
    // The header Add button renders before the load settles — that window is the
    // whole defect. A save that fails inside it writes the shared `eventsError`
    // key, and the load's own `.finally` then reads that key as its own verdict.
    let releaseLoad: (() => void) | undefined;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });

    const saveMessage = 'You are offline. Events need a connection to save.';

    setStore({
      loadEvents: vi.fn(async () => {
        // loadEvents clears the key on entry, as the slice does.
        store.patch({ eventsError: null });
        await loadGate;
        // ...and then SUCCEEDS. It writes no error of its own.
      }),
      addEvent: vi.fn(async () => {
        store.patch({ eventsError: saveMessage });
        return { success: false, error: saveMessage } as EventWriteResult;
      }),
    });

    render(<EventsSettings />);

    fireEvent.click(screen.getByTestId('events-settings-add'));
    fireEvent.change(screen.getByTestId('events-form-label'), {
      target: { value: 'Anniversary trip' },
    });
    fireEvent.change(screen.getByTestId('events-form-date'), { target: { value: '2026-12-24' } });
    fireEvent.click(screen.getByTestId('events-form-submit'));

    // The save's own message belongs in the form, and it gets there today.
    await waitFor(() => {
      expect(screen.getByTestId('events-form-error')).toHaveTextContent(saveMessage);
    });

    // Now the load — which never failed — settles.
    await act(async () => {
      releaseLoad?.();
      await loadGate;
    });

    // The load succeeded, so the list area must not claim otherwise.
    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
    // And with zero events and a successful load, the empty state is the truth.
    expect(screen.getByTestId('events-settings-empty')).toBeInTheDocument();
  });
});

describe.skip('DE.5-COMP-003: a failed load re-fires on reconnect (DW-27)', () => {
  it('reloads and clears its notice when the app comes back online', async () => {
    const loadEvents = vi.fn(async () => {
      if (loadEvents.mock.calls.length === 1) {
        store.patch({ eventsError: 'Network error' });
        return;
      }
      store.patch({
        eventsError: null,
        events: [makeEvent({ id: 'after-reconnect', label: 'Back online' })],
      });
    });

    setStore({ loadEvents, syncStatus: { isOnline: false } });

    render(<EventsSettings />);
    await act(async () => {});

    expect(screen.getByTestId('events-settings-load-error')).toBeInTheDocument();
    expect(loadEvents).toHaveBeenCalledTimes(1);

    // Connectivity returns. Nothing else about the account changed.
    await act(async () => {
      store.patch({ syncStatus: { isOnline: true } });
    });

    // App.tsx:443-447 documents the reason its Home twin lists isOnline:
    // "coming back online re-fires the load, so the offline error card clears
    // without leaving Home." Settings has no equivalent, and no retry control,
    // so today the notice is terminal until a page reload.
    await waitFor(() => {
      expect(loadEvents).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByTestId('events-settings-load-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('event-row-after-reconnect')).toBeInTheDocument();
  });
});
