import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { LazyMotion, domAnimation } from 'motion/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../../src/App';
import { supabase } from '../../../src/api/supabaseClient';
import { NOTES_CONFIG } from '../../../src/config/images';
import { anniversariesService } from '../../../src/services/anniversariesService';
import { eventsService, type CoupleEvent, type EventsPage } from '../../../src/services/eventsService';
import { registerLocalCopy } from '../../../src/services/localCopy';
import {
  COUPLE_SETTINGS_COPY_KIND,
  PROFILE_COPY_KIND,
} from '../../../src/stores/slices/settingsSlice';
import { MOOD_HISTORY_KIND } from '../../../src/stores/slices/moodSlice';
import { INTERACTIONS_COPY_KIND } from '../../../src/stores/slices/interactionsSlice';
import { LOVE_NOTES_COPY_KIND } from '../../../src/stores/slices/notesSlice';
import { PARTNER_COPY_KIND } from '../../../src/stores/slices/partnerSlice';
import { PHOTOS_COPY_KIND } from '../../../src/stores/slices/photosSlice';
import { formatDateISO } from '../../../src/utils/dateUtils';
import { useAppStore } from '../../../src/stores/useAppStore';
import {
  createAuthBootstrapEvent,
  type AuthBootstrapEventInput,
} from '../factories/auth-bootstrap-notification-order';
import '../../../src/index.css';

export type AuthBootstrapMountOptions = {
  initialIdentity?: { userId: string; email?: string };
};

export type AuthBootstrapSnapshot = {
  userId: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  authSessionVersion: number;
  events: Array<{ id: string; userId: string; label: string }>;
  eventsIsLoading: boolean;
  eventsError: string | null;
  lookupCalls: number;
  lookupSettled: boolean;
  activeSubscriptions: number;
  notificationCount: number;
  calls: {
    initializeApp: number;
    syncPendingMoods: number;
    updateSyncStatus: number;
    getEvents: number;
  };
};

export type AuthBootstrapBridge = {
  mount: (options?: AuthBootstrapMountOptions) => void;
  snapshot: () => AuthBootstrapSnapshot;
  notify: (event: AuthChangeEvent, session: Session | null) => Promise<void>;
  resolveLookup: (session: Session | null) => void;
  resolveLookupThenNotify: (
    snapshot: Session | null,
    event: AuthChangeEvent,
    session: Session | null
  ) => Promise<void>;
  rejectLookup: (message: string) => void;
  seedEvents: (events: AuthBootstrapEventInput[]) => void;
  resolveEvents: (events: AuthBootstrapEventInput[], index?: number) => void;
  dispose: () => Promise<void>;
};

declare global {
  interface Window {
    __authBootstrap?: AuthBootstrapBridge;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/**
 * Real sessionService, App, auth actions and event ownership run in Chromium.
 * Only the SDK delivery boundary and unrelated data initialization are controlled.
 * This mounts once without development StrictMode; unit tests cover effect cleanup.
 */
export function createAuthBootstrapHarness(): AuthBootstrapBridge {
  const container = document.getElementById('root');
  if (!container) throw new Error('Auth bootstrap harness root is missing');
  const root = createRoot(container);
  const originalState = useAppStore.getState();
  const originalGetSession = supabase.auth.getSession;
  const originalOnAuthStateChange = supabase.auth.onAuthStateChange;
  const originalGetEventsPage = eventsService.getEventsPage;
  const originalFetchAnniversaries = anniversariesService.fetchAnniversaries;
  const previousWelcome = localStorage.getItem('lastWelcomeView');
  type LookupResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
  type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void | Promise<void>;
  const lookup = deferred<LookupResult>();
  const requests: Array<ReturnType<typeof deferred<EventsPage>>> = [];
  const subscriptions: Array<{ callback: AuthCallback; active: boolean }> = [];
  const deliveries: Promise<void>[] = [];
  const calls = { initializeApp: 0, syncPendingMoods: 0, updateSyncStatus: 0, getEvents: 0 };
  let currentSession: Session | null = null;
  let lookupCalls = 0;
  let lookupSettled = false;
  let notificationCount = 0;
  let mounted = false;
  let disposed = false;
  let restoreCoupleSettingsRefresher: (() => void) | null = null;

  const eventPage = (events: CoupleEvent[]): EventsPage => ({
    events,
    pagination: {
      todayISO: formatDateISO(new Date()),
      upcoming: { cursor: null, hasMore: false },
      past: { cursor: null, hasMore: false },
    },
  });

  const resolveLookup = (session: Session | null) => {
    if (lookupSettled) throw new Error('Bootstrap lookup already settled');
    lookupSettled = true;
    // Later, ancillary SDK calls see the latest session. The pending bootstrap
    // always receives the EXACT supplied snapshot, including superseded inputs.
    if (notificationCount === 0) currentSession = session;
    lookup.resolve(session
      ? { data: { session }, error: null }
      : { data: { session: null }, error: null });
  };

  const notify = (event: AuthChangeEvent, session: Session | null) => {
    const active = subscriptions.filter((subscription) => subscription.active);
    if (active.length === 0) throw new Error('App auth listener has not mounted');
    currentSession = session;
    notificationCount += 1;
    // Invoke the captured production service callback immediately. No identity
    // filtering or loading completion belongs in the fixture.
    const delivered = Promise.all(active.map(({ callback }) => callback(event, session)))
      .then(() => {});
    deliveries.push(delivered);
    return delivered;
  };

  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    try {
      root.unmount();
      // Retire in-flight real store loads before releasing controlled results.
      useAppStore.getState().clearAuth();
      if (!lookupSettled) resolveLookup(null);
      requests.forEach((request) => request.resolve(eventPage([])));
      await Promise.allSettled([lookup.promise, ...deliveries, ...requests.map((r) => r.promise)]);
    } finally {
      supabase.auth.getSession = originalGetSession;
      supabase.auth.onAuthStateChange = originalOnAuthStateChange;
      eventsService.getEventsPage = originalGetEventsPage;
      anniversariesService.fetchAnniversaries = originalFetchAnniversaries;
      restoreCoupleSettingsRefresher?.();
      useAppStore.setState(originalState, true);
      if (previousWelcome === null) localStorage.removeItem('lastWelcomeView');
      else localStorage.setItem('lastWelcomeView', previousWelcome);
      delete window.__authBootstrap;
    }
  };

  try {
    // playwright-utils deviation: HTTP/HAR cannot defer a local SDK session promise or invoke its subscription callback.
    supabase.auth.getSession = () => {
      lookupCalls += 1;
      if (lookupCalls === 1) return lookup.promise;
      return Promise.resolve(currentSession
        ? { data: { session: currentSession }, error: null }
        : { data: { session: null }, error: null });
    };
    supabase.auth.onAuthStateChange = (callback) => {
      const subscription = { callback, active: true };
      subscriptions.push(subscription);
      return {
        data: {
          subscription: {
            id: crypto.randomUUID(),
            callback,
            unsubscribe: () => { subscription.active = false; },
          },
        },
      };
    };
    eventsService.getEventsPage = () => {
      calls.getEvents += 1;
      const request = deferred<EventsPage>();
      requests.push(request);
      return request.promise;
    };
    // A signed-in start refreshes every registered local copy. The anniversaries
    // refresher's PostgREST request would read the token through
    // supabase.auth.getSession — the very call this harness counts and defers
    // — and with `initialIdentity` it runs before the bootstrap lookup.
    anniversariesService.fetchAnniversaries = async () => [];
    // Same reason for the couple-settings refresher, one step earlier: its
    // partner lookup (`lookupPartnerId`) calls supabase.auth.getSession
    // directly — and for the partner, profile, mood-history, interactions,
    // love-notes and photos refreshers, whose reads do too (and whose fake-token requests
    // PostgREST answers with 401).
    // Replaced with no-ops for the harness's lifetime; dispose puts the
    // store's own refreshers back.
    const unregisterNoop = registerLocalCopy(COUPLE_SETTINGS_COPY_KIND, async () => {});
    const unregisterProfileNoop = registerLocalCopy(PROFILE_COPY_KIND, async () => {});
    const unregisterMoodHistoryNoop = registerLocalCopy(MOOD_HISTORY_KIND, async () => {});
    const unregisterInteractionsNoop = registerLocalCopy(INTERACTIONS_COPY_KIND, async () => {});
    const unregisterLoveNotesNoop = registerLocalCopy(LOVE_NOTES_COPY_KIND, async () => {});
    const unregisterPhotosNoop = registerLocalCopy(PHOTOS_COPY_KIND, async () => {});
    const unregisterPartnerNoop = registerLocalCopy(PARTNER_COPY_KIND, async () => {});
    restoreCoupleSettingsRefresher = () => {
      unregisterNoop();
      unregisterProfileNoop();
      unregisterMoodHistoryNoop();
      unregisterInteractionsNoop();
      unregisterLoveNotesNoop();
      unregisterPhotosNoop();
      unregisterPartnerNoop();
      registerLocalCopy(COUPLE_SETTINGS_COPY_KIND, () => useAppStore.getState().loadCoupleSettings());
      registerLocalCopy(PARTNER_COPY_KIND, () => useAppStore.getState().loadPartner());
      registerLocalCopy(PROFILE_COPY_KIND, () => useAppStore.getState().loadOwnProfile());
      registerLocalCopy(MOOD_HISTORY_KIND, () => useAppStore.getState().loadMoodHistoryFromServer());
      registerLocalCopy(INTERACTIONS_COPY_KIND, async () => {
        if (!useAppStore.getState().userId) return;
        await useAppStore.getState().loadInteractionHistory();
      });
      registerLocalCopy(LOVE_NOTES_COPY_KIND, async () => {
        if (!useAppStore.getState().userId) return;
        await useAppStore.getState().fetchNotes(NOTES_CONFIG.PAGE_SIZE, { keepOlder: true });
      });
      registerLocalCopy(PHOTOS_COPY_KIND, async () => {
        if (!useAppStore.getState().userId) return;
        await useAppStore.getState().loadPhotos();
      });
    };
    localStorage.setItem('lastWelcomeView', String(Date.now()));
    useAppStore.setState({
      isLoading: false,
      currentMessage: {
        id: 81001,
        text: 'A message for the current bootstrap session.',
        category: 'affirmation',
        isCustom: false,
        createdAt: new Date(),
      },
      initializeApp: async () => { calls.initializeApp += 1; },
      syncPendingMoods: async () => {
        calls.syncPendingMoods += 1;
        return { synced: 0, failed: 0, skipped: false };
      },
      updateSyncStatus: async () => { calls.updateSyncStatus += 1; },
    });
  } catch (error) {
    void dispose();
    throw error;
  }

  return {
    mount: (options = {}) => {
      if (mounted || disposed) throw new Error('Auth bootstrap harness can mount only once');
      mounted = true;
      if (options.initialIdentity) {
        useAppStore.getState().setAuthUser(options.initialIdentity.userId, options.initialIdentity.email);
      }
      root.render(createElement(LazyMotion, { features: domAnimation }, createElement(App)));
    },
    snapshot: () => {
      const state = useAppStore.getState();
      return {
        userId: state.userId,
        userEmail: state.userEmail,
        isAuthenticated: state.isAuthenticated,
        authSessionVersion: state.authSessionVersion,
        events: state.events.map(({ id, userId, label }) => ({ id, userId, label })),
        eventsIsLoading: state.eventsIsLoading,
        eventsError: state.eventsError,
        lookupCalls,
        lookupSettled,
        activeSubscriptions: subscriptions.filter((subscription) => subscription.active).length,
        notificationCount,
        calls: { ...calls },
      };
    },
    notify,
    resolveLookup,
    resolveLookupThenNotify: (snapshot, event, session) => {
      resolveLookup(snapshot);
      return notify(event, session);
    },
    rejectLookup: (message) => {
      if (lookupSettled) throw new Error('Bootstrap lookup already settled');
      lookupSettled = true;
      lookup.reject(new Error(message));
    },
    seedEvents: (events) => useAppStore.setState({ events: events.map(createAuthBootstrapEvent) }),
    resolveEvents: (events, index = 0) => {
      const request = requests[index];
      if (!request) throw new Error('Missing controlled event request ' + index);
      request.resolve(eventPage(events.map(createAuthBootstrapEvent)));
    },
    dispose,
  };
}
