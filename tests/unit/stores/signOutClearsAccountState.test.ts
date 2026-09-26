/**
 * Sign-out must not leave one account's data visible to the next
 *
 * `clearAuth` is the only thing that runs on sign-out that touches store state.
 * Signing out unmounts the React tree but nothing recreates the Zustand store —
 * that is precisely what makes an in-place account switch work — so anything it
 * does not clear is still on screen for the next person to sign in.
 *
 * This drives the COMPOSED `useAppStore`, not one slice in isolation. An earlier
 * version of this file built its store from `createAuthSlice` alone, which made
 * its store-wide sweep structurally incapable of failing: `getState()` could
 * only ever contain keys the test itself had seeded, so a leak in notesSlice or
 * partnerSlice was invisible to the very assertion written to catch it.
 *
 * Clearing a SUBSET is worse than clearing nothing, because absence is itself a
 * render condition: clearing `partner` alone flips PartnerMoodView into its
 * `!partner` branch, which paints `sentRequests`, `receivedRequests` and
 * `searchResult`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

// Pass-through spies: the deletes still run for real against IndexedDB, and a
// test can also see whether sign-in asked for one at all. `setAuthUser` starts
// them synchronously (fire-and-forget), so a delete that was never requested
// is known the moment it returns.
vi.mock('../../../src/services/localCopy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/localCopy')>();
  return { ...actual, deleteAccountCopies: vi.fn(actual.deleteAccountCopies) };
});
vi.mock('../../../src/services/imageCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/imageCache')>();
  return { ...actual, deleteAccountImages: vi.fn(actual.deleteAccountImages) };
});

import { useAppStore } from '../../../src/stores/useAppStore';
import { ACCOUNT_OWNER_STORAGE_KEY, signedOutState } from '../../../src/stores/slices/authSlice';
import { deleteAccountImages } from '../../../src/services/imageCache';
import {
  deleteAccountCopies,
  readLocalCopy,
  writeLocalCopy,
} from '../../../src/services/localCopy';
import { MESSAGE_DATA_COPY_KIND, openMyLoveDB } from '../../../src/services/dbSchema';

const EXPECTED_RESET: Record<string, unknown> = {
  moods: [],
  partnerMoods: [],
  syncStatus: {
    pendingMoods: 0,
    // Device state, not account state — carried across rather than reset.
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncAt: undefined,
    isSyncing: false,
  },
  partner: null,
  isLoadingPartner: false,
  partnerLoadError: false,
  sentRequests: [],
  receivedRequests: [],
  isLoadingRequests: false,
  searchResult: null,
  isSearching: false,
  notes: [],
  notesIsLoading: false,
  notesError: null,
  notesHasMore: true,
  sentMessageTimestamps: [],
  notesPendingRemoval: [],
  customMessages: [],
  customMessagesLoaded: false,
  favoriteError: null,
  photos: [],
  photosLoaded: false,
  photosLoadError: null,
  storageWarning: null,
  interactions: [],
  unviewedCount: 0,
  isSubscribed: false,
  interactionPartnerId: null,
  events: [],
  eventsIsLoading: false,
  eventsError: null,
  eventsPagination: null,
  eventsIsLoadingMore: false,
  eventsHistoryError: null,
  coupleSettings: null,
  ownProfile: null,
};

/** Identifiers that must not survive a sign-out */
const SECRETS = {
  ownNote: 'MY-OWN-PRIVATE-NOTE',
  partnerNote: 'PARTNERS-PRIVATE-NOTE',
  partnerName: 'PARTNER-DISPLAY-NAME',
  chatMessage: 'THE-LOVE-NOTES-CHAT-BODY',
  requestedEmail: 'PENDING-REQUEST-EMAIL',
  searchHitName: 'SEARCH-RESULT-DISPLAY-NAME',
  photoCaption: 'PHOTO-CAPTION-TEXT',
  anniversaryLabel: 'OUR-FIRST-KISS-LABEL',
  customMessage: 'MY-OWN-CUSTOM-MESSAGE-TEXT',
  userId: 'USER-A-ID',
};

/** A bundled daily message: shared by everyone, and must SURVIVE sign-out. */
const SHARED_DAILY_TEXT = 'A-BUNDLED-DAILY-MESSAGE';

/** The bundled daily row. A new object per call, so no two seeds share one. */
function sharedDaily() {
  return {
    id: 1,
    text: SHARED_DAILY_TEXT,
    category: 'reason',
    isCustom: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

/**
 * The signed-in account's own custom row. A new object per call:
 * `currentMessage` is a copy of the pool row, never a reference into it.
 */
function ownCustom() {
  return {
    id: 7,
    text: SECRETS.customMessage,
    category: 'custom',
    isCustom: true,
    userId: SECRETS.userId,
    createdAt: new Date('2026-08-03T06:00:00.000Z'),
  };
}

/** A love note from the signed-in account to its partner. */
function accountNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    from_user_id: SECRETS.userId,
    to_user_id: 'USER-B-ID',
    content: SECRETS.chatMessage,
    created_at: '2026-08-03T06:00:00.000Z',
    ...overrides,
  };
}

function moodEntry(userId: string, note: string) {
  return {
    id: 1,
    userId,
    mood: 'sad' as const,
    moods: ['sad' as const],
    note,
    date: '2026-08-03',
    timestamp: new Date('2026-08-03T06:00:00.000Z'),
    synced: true,
  };
}

/** Fill every account-scoped corner of the store the way a live session would */
function seedSignedInSession(): void {
  useAppStore.setState({
    userId: SECRETS.userId,
    userEmail: 'a@example.com',
    isAuthenticated: true,

    moods: [moodEntry(SECRETS.userId, SECRETS.ownNote)],
    partnerMoods: [moodEntry('USER-B-ID', SECRETS.partnerNote)],

    partner: {
      id: 'USER-B-ID',
      displayName: SECRETS.partnerName,
      email: 'b@example.com',
    },
    partnerLoadError: true,
    sentRequests: [{ id: 'req-1', toEmail: SECRETS.requestedEmail }],
    receivedRequests: [{ id: 'req-2', fromEmail: SECRETS.requestedEmail }],
    searchResult: {
      status: 'found',
      user: { id: 'USER-C-ID', email: 'c@example.com', displayName: SECRETS.searchHitName },
    },

    notes: [accountNote()],
    sentMessageTimestamps: [1],
    // Which messages the previous account removed is theirs, not the next
    // signer-in's — and left behind it would filter their notes by stale ids.
    notesPendingRemoval: ['note-1'],

    photos: [{ id: 'photo-1', caption: SECRETS.photoCaption }],
    photosLoaded: true,
    photosLoadError: 'A photo list read failed',

    // The AdminPanel list, plus the rotation pool the same rows feed into.
    // `messages` deliberately mixes the two kinds: a bundled daily row shared
    // by every account and this account's own custom row.
    customMessages: [
      {
        id: 7,
        text: SECRETS.customMessage,
        category: 'custom',
        isCustom: true,
        active: true,
        createdAt: '2026-08-03T06:00:00.000Z',
      },
    ],
    customMessagesLoaded: true,
    favoriteError: 'A favorite write failed',
    messages: [sharedDaily(), ownCustom()],
    // DailyMessage renders `currentMessage.text` straight onto Home, and it is
    // a COPY of the row rather than a reference into `messages`.
    currentMessage: ownCustom(),

    interactions: [{ id: 'int-1', from_user_id: 'USER-B-ID', type: 'poke' }],
    unviewedCount: 3,

    // Anniversaries live INSIDE `settings`, which partialize persists and
    // sign-out must otherwise preserve (theme, notifications are device
    // configuration) — so this seeds through the current object rather than
    // replacing it.
    // settingsSlice seeds `settings` non-null defaults, so the assertion holds.
    settings: {
      ...useAppStore.getState().settings!,
      relationship: {
        ...useAppStore.getState().settings!.relationship,
        anniversaries: [{ id: 1, date: '2025-11-26', label: SECRETS.anniversaryLabel }],
      },
    },
    // Seeding shapes loosely on purpose: the point is what SURVIVES, not that
    // each fixture satisfies its full production type.
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
}

/**
 * Every switch to a new user starts a fire-and-forget IndexedDB reload of the
 * rotation pool (`reloadRotationPool` in authSlice.ts). Nothing here asserts on
 * it -- loaderIdentityGuards.*.test.ts does -- but left running it can log after
 * the file's worker has closed, which Vitest reports as an unhandled
 * EnvironmentTeardownError and fails the whole run on. So each reload is
 * recorded and every test waits for its own to settle.
 */
const realLoadMessages = useAppStore.getState().loadMessages;
const pendingReloads: Promise<void>[] = [];

describe('clearAuth on sign-out', () => {
  beforeEach(() => {
    vi.mocked(deleteAccountCopies).mockClear();
    vi.mocked(deleteAccountImages).mockClear();
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    useAppStore.setState({
      loadMessages: () => {
        const reload = realLoadMessages();
        pendingReloads.push(reload);
        return reload;
      },
    });
    seedSignedInSession();
  });

  afterEach(async () => {
    await Promise.allSettled(pendingReloads.splice(0));
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    // happy-dom serves `onLine` from the Navigator prototype, so deleting the
    // own property a test defined restores the real value — even when that
    // test's assertions threw before it could restore it inline.
    Reflect.deleteProperty(navigator, 'onLine');
    // Runs after the reloads settle, so none of them writes into a cleared
    // store; and here rather than inline, so a failed assertion cannot leave
    // one test's seeded rows for the next.
    await clearDevice();
  });

  it('clears the identity', () => {
    useAppStore.getState().clearAuth();

    expect(useAppStore.getState().userId).toBeNull();
    expect(useAppStore.getState().userEmail).toBeNull();
    expect(useAppStore.getState().isAuthenticated).toBe(false);
  });

  it('starts with an unpersisted ownership version', () => {
    expect(useAppStore.getInitialState().authSessionVersion).toBe(0);
    const persisted = JSON.parse(localStorage.getItem('my-love-storage')!);
    expect(persisted.state).not.toHaveProperty('authSessionVersion');
  });

  it('advances ownership atomically with every sign-out and identity transition', () => {
    const version = useAppStore.getState().authSessionVersion;
    useAppStore.setState({ eventsIsLoading: true, eventsError: 'old-session-error' });
    const snapshots: Array<{
      userId: string | null;
      authSessionVersion: number;
      eventsIsLoading: boolean;
      eventsError: string | null;
    }> = [];
    const unsubscribe = useAppStore.subscribe((state) => {
      snapshots.push({
        userId: state.userId,
        authSessionVersion: state.authSessionVersion,
        eventsIsLoading: state.eventsIsLoading,
        eventsError: state.eventsError,
      });
    });

    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');
    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');
    useAppStore.getState().clearAuth();
    useAppStore.getState().clearAuth();
    unsubscribe();

    expect(snapshots).toEqual(
      [null, SECRETS.userId, 'USER-B-ID', null, null].map((userId, index) => ({
        userId,
        authSessionVersion: version + index + 1,
        eventsIsLoading: false,
        eventsError: null,
      }))
    );
  });

  it('routes the null-user setter through sign-out, including identity and anniversary cleanup', () => {
    const version = useAppStore.getState().authSessionVersion;

    useAppStore.getState().setAuthUser(null, 'ignored@example.com');

    expect(useAppStore.getState()).toMatchObject({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      authSessionVersion: version + 1,
    });
    expect(JSON.stringify(useAppStore.getState())).not.toContain(SECRETS.anniversaryLabel);
  });

  it('clears both mood arrays', () => {
    useAppStore.getState().clearAuth();

    expect(useAppStore.getState().moods).toEqual([]);
    // The partner's entries carry the partner's free-text notes, so they are
    // exactly as private as the user's own.
    expect(useAppStore.getState().partnerMoods).toEqual([]);
  });

  it('clears the partner identity and everything the !partner branch renders', () => {
    useAppStore.getState().clearAuth();

    const state = useAppStore.getState();
    expect(state.partner).toBeNull();
    // Clearing `partner` alone is what makes these reachable — PartnerMoodView
    // renders its search-and-request UI precisely when `partner` is null.
    expect(state.sentRequests).toEqual([]);
    expect(state.receivedRequests).toEqual([]);
    expect(state.searchResult).toBeNull();
  });

  it('clears the love-notes chat', () => {
    useAppStore.getState().clearAuth();

    // The largest private disclosure in the app, and it has the same property
    // that justified clearing partnerMoods: the empty-state placeholder only
    // shows while the array is EMPTY, so a stale chat is never masked.
    expect(useAppStore.getState().notes).toEqual([]);
  });

  it('clears photos and interactions', () => {
    useAppStore.getState().clearAuth();

    const state = useAppStore.getState();
    expect(state.photos).toEqual([]);
    expect(state.interactions).toEqual([]);
    expect(state.unviewedCount).toBe(0);
    // The partner snapshot names the previous couple: a stale one would let
    // the next account accept that couple's incoming traffic.
    expect(state.interactionPartnerId).toBeNull();
  });

  it.each(['clearAuth', 'setAuthUser'] as const)(
    '%s strips custom messages from the rotation pool but keeps the shared daily ones',
    (action) => {
      if (action === 'clearAuth') useAppStore.getState().clearAuth();
      else useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

      const state = useAppStore.getState();

      // The AdminPanel list and the flag its reload effect gates on.
      expect(state.customMessages).toEqual([]);
      expect(state.customMessagesLoaded).toBe(false);

      // `messages` is the rotation pool. Emptying it outright would be safe but
      // wrong: nothing reloads the bundled rows after an in-place switch, so
      // the next account would get a blank Home and an empty pool. Only the
      // account-scoped half goes.
      expect(state.messages).toEqual([
        expect.objectContaining({ id: 1, text: SHARED_DAILY_TEXT, isCustom: false }),
      ]);

      // Home renders this directly, and it is a copy the array strip cannot reach.
      expect(state.currentMessage).toBeNull();
    }
  );

  it('drops the rotation-history entries that point at stripped rows', () => {
    // `messageHistory.shownMessages` maps a date to the id shown that day, and
    // it is PERSISTED. If the outgoing account's custom row won today's
    // rotation, that entry now names an id no longer in the pool, and the
    // incoming account would inherit it. `updateCurrentMessage` also defends
    // itself against a dangling id now (see updateCurrentMessageStaleCache),
    // so this asserts the prune on its own terms — the stored map is left
    // clean — rather than as the only thing preventing a broken Home screen.
    // Driven through clearAuth: the switched-account path also fires an
    // asynchronous pool reload, which this case has no business waiting on.
    useAppStore.setState({
      messageHistory: {
        ...useAppStore.getState().messageHistory,
        shownMessages: new Map([
          ['2026-09-12', 7], // the outgoing account's custom row — stripped
          ['2026-09-11', 1], // a bundled daily row — survives the strip
        ]),
      },
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    const { shownMessages } = useAppStore.getState().messageHistory;
    expect(shownMessages.has('2026-09-12')).toBe(false);
    expect(shownMessages.get('2026-09-11')).toBe(1);
  });

  it('keeps the whole rotation history when the pool has not loaded yet', () => {
    // The no-session boot: App.tsx calls clearAuth() as soon as getSession()
    // comes back empty, and `messages` is not persisted — so this runs against
    // an empty pool, and initializeApp (gated on a session) never fills it.
    // Pruning by "ids still in the pool" would find nothing surviving and wipe
    // the persisted 30-day map every time the app opens signed out, taking the
    // shared daily rows with it. Nothing was stripped here, so nothing goes.
    useAppStore.setState({
      messages: [],
      messageHistory: {
        ...useAppStore.getState().messageHistory,
        shownMessages: new Map([
          ['2026-09-12', 7],
          ['2026-09-11', 1],
        ]),
      },
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    const { shownMessages } = useAppStore.getState().messageHistory;
    expect(shownMessages.get('2026-09-12')).toBe(7);
    expect(shownMessages.get('2026-09-11')).toBe(1);
  });

  it('keeps a shared daily message on screen across sign-out', () => {
    // The other half of the rule: a bundled row is not account state, and
    // nulling it would blank Home for the next account with nothing to
    // re-derive it before the next page load.
    const shared = sharedDaily();
    useAppStore.setState({ currentMessage: shared } as unknown as Parameters<
      typeof useAppStore.setState
    >[0]);

    useAppStore.getState().clearAuth();

    expect(useAppStore.getState().currentMessage).toMatchObject({ text: SHARED_DAILY_TEXT });
  });

  it('leaves no trace of the seeded identifiers anywhere in the store', () => {
    useAppStore.getState().clearAuth();

    const remaining = JSON.stringify(useAppStore.getState());
    for (const [label, secret] of Object.entries(SECRETS)) {
      expect(remaining, `${label} survived sign-out`).not.toContain(secret);
    }
  });

  it.each(['clearAuth', 'setAuthUser'] as const)('%s resets every account field', (action) => {
    // Deliberately duplicated from the source rather than derived from it.
    // Iterating signedOutState() itself is circular — deleting a field removes
    // its own assertion, which is why the first attempt at this test still let
    // 24 of 36 deletions through. An independent list is the whole point.
    const distinguishable = (resetValue: unknown): unknown => {
      if (Array.isArray(resetValue)) return ['NOT-RESET'];
      if (typeof resetValue === 'boolean') return !resetValue;
      if (typeof resetValue === 'number') return resetValue + 99;
      return 'NOT-RESET';
    };

    const dirty: Record<string, unknown> = {};
    for (const [key, resetValue] of Object.entries(EXPECTED_RESET)) {
      dirty[key] = distinguishable(resetValue);
    }
    useAppStore.setState(dirty as unknown as Parameters<typeof useAppStore.setState>[0]);

    if (action === 'clearAuth') useAppStore.getState().clearAuth();
    else useAppStore.getState().setAuthUser(null);

    const after = useAppStore.getState() as unknown as Record<string, unknown>;
    for (const [key, resetValue] of Object.entries(EXPECTED_RESET)) {
      expect(after[key], `${key} was not reset by ${action}`).toEqual(resetValue);
    }
  });

  it("drops the previous couple's anniversaries, shared dates and own profile", () => {
    useAppStore.setState({
      coupleSettings: {
        status: 'linked',
        partnerId: 'previous-partner',
        relationshipStart: '2020-01-01T18:00:00.000Z',
        weddingDate: '2021-06-12',
      },
      ownProfile: { displayName: 'PREVIOUS-NAME', birthday: '1990-01-02' },
    });

    useAppStore.getState().clearAuth();

    const state = useAppStore.getState();
    // Labels and dates are the couple's, `partialize` persists `settings`, and
    // no service re-derives them — left in place they rehydrate into the next
    // account's Home countdown and Settings list.
    expect(state.settings!.relationship.anniversaries).toEqual([]);
    // The start date is the couple's too; the next account reads its own copy.
    expect(state.coupleSettings).toBeNull();
    // The previous account's own name and birthday go too.
    expect(state.ownProfile).toBeNull();
  });

  it('keeps no copy of the anniversaries anywhere in localStorage', () => {
    // The retired vault stashed each signed-out account's list under a
    // device-global key. The saved copy is the account's local copy now, which
    // its own refresher reads; nothing brings a list back at sign-in.
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');

    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key), key).not.toContain(SECRETS.anniversaryLabel);
    }
  });

  it("never shows one account's anniversaries to a different account", () => {
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);
    expect(JSON.stringify(useAppStore.getState())).not.toContain(SECRETS.anniversaryLabel);
  });

  it('drops the anniversaries across a direct account switch that never passes through sign-out', () => {
    // Signing in over a live session hits setAuthUser's switched-account path.
    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);
    expect(JSON.stringify(useAppStore.getState())).not.toContain(SECRETS.anniversaryLabel);
  });

  it("drops the previous account's pending count but keeps the device's network state", () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    useAppStore.setState({
      syncStatus: {
        pendingMoods: 7,
        isOnline: false,
        lastSyncAt: new Date('2026-08-03T06:00:00.000Z'),
        isSyncing: true,
      },
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    const { syncStatus } = useAppStore.getState();
    // Whose moods are pending, and when they last synced, belong to the account.
    expect(syncStatus.pendingMoods).toBe(0);
    expect(syncStatus.lastSyncAt).toBeUndefined();
    expect(syncStatus.isSyncing).toBe(false);
    // Whether the device has a network does not — resetting it to true would
    // put the badge on "Online" while the phone is in a tunnel.
    expect(syncStatus.isOnline).toBe(false);
  });

  it('revokes the preview URLs of the notes it is about to drop', () => {
    // A failed image send keeps its blob URL on the note. Every other writer of
    // `notes` revokes through the shared helper, and the unmount cleanup that
    // would otherwise catch these reads the live array — which clearAuth has
    // already emptied by the time React unmounts. Assigning `[]` without
    // revoking first pins the compressed image in memory for the lifetime of
    // the document, and nothing later can reach the URL to free it.
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    useAppStore.setState({
      notes: [
        accountNote({
          id: 'note-failed',
          imagePreviewUrl: 'blob:http://localhost/ORPHANED-BLOB',
        }),
      ],
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/ORPHANED-BLOB');
    expect(useAppStore.getState().notes).toEqual([]);
    revoke.mockRestore();
  });

  it('an account switch that never signs out also clears the previous account', () => {
    // clearAuth is not the only way the store changes hands. onAuthStateChange
    // routes every session-bearing event to setAuthUser (App.tsx:233), which
    // used to set only userId/userEmail/isAuthenticated -- so a sign-in over a
    // live session would have carried the previous couple's chat into the new
    // account on a shared device.
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    seedSignedInSession();
    useAppStore.setState({
      notes: [
        accountNote({
          id: 'note-failed',
          imagePreviewUrl: 'blob:http://localhost/SWITCH-ORPHANED-BLOB',
        }),
      ],
    } as unknown as Parameters<typeof useAppStore.setState>[0]);
    expect(useAppStore.getState().notes.length).toBeGreaterThan(0);

    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    // Resetting without revoking first strands the blob URL: the array it lives
    // in is gone, so nothing can reach it afterwards. clearAuth has always done
    // this; the switch path has to as well.
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/SWITCH-ORPHANED-BLOB');
    revoke.mockRestore();

    expect(useAppStore.getState().userId).toBe('USER-B-ID');
    expect(useAppStore.getState().notes).toEqual([]);
    expect(useAppStore.getState().moods).toEqual([]);
    expect(useAppStore.getState().photos).toEqual([]);
    expect(useAppStore.getState().partner).toBeNull();
    expect(useAppStore.getState().notesPendingRemoval).toEqual([]);
    expect(JSON.stringify(useAppStore.getState())).not.toContain(SECRETS.chatMessage);
  });

  it('a repeat event for the SAME user leaves the session alone', () => {
    // TOKEN_REFRESHED, INITIAL_SESSION and USER_UPDATED all arrive here with the
    // same user. Resetting on those would wipe the screen mid-session.
    seedSignedInSession();
    const before = useAppStore.getState().notes;
    const version = useAppStore.getState().authSessionVersion;

    useAppStore.getState().setAuthUser(SECRETS.userId, 'updated@example.com');

    expect(useAppStore.getState().notes).toBe(before);
    expect(useAppStore.getState().userId).toBe(SECRETS.userId);
    expect(useAppStore.getState().userEmail).toBe('updated@example.com');
    expect(useAppStore.getState().authSessionVersion).toBe(version);
  });

  /**
   * Seed the device the way a shared phone looks: the outgoing account's local
   * copies (custom messages and favorites among them) and an unsynced mood,
   * beside another account's data and the bundled daily row nobody owns.
   */
  async function seedDevice(outgoing: string) {
    await writeLocalCopy(outgoing, 'anniversaries', [
      { id: 1, date: '2025-11-26', label: SECRETS.anniversaryLabel },
    ]);
    await writeLocalCopy('OTHER-ACCOUNT', 'anniversaries', []);
    await writeLocalCopy(outgoing, 'profile', { displayName: 'OUTGOING', birthday: '1990-01-02' });
    await writeLocalCopy(outgoing, 'love-notes', [{ id: 'note-1', content: 'OUTGOING-NOTE' }]);
    const db = await openMyLoveDB();
    try {
      // Cached note images (story 8). The value is opaque to the delete, so a
      // string stands in for the Blob happy-dom cannot structured-clone.
      await db.put('image-cache', {
        userId: outgoing, path: 'partner/pic.jpg', blob: 'OUTGOING-IMAGE' as never, savedAt: 1,
      });
      await db.put('image-cache', {
        userId: 'OTHER-ACCOUNT', path: 'partner/pic.jpg', blob: 'OTHER-IMAGE' as never, savedAt: 1,
      });
      const at = new Date('2026-08-03T06:00:00.000Z');
      // The id is IndexedDB's to assign.
      const { id: _bundledId, ...bundledRow } = sharedDaily();
      const bundledId = await db.add('messages', { ...bundledRow, createdAt: at } as never);
      const ownId = 900;
      const otherId = 901;
      const customRow = (id: number, userId: string, text: string, serverId: string) => ({
        id, text, category: 'custom', isCustom: true, userId, serverId, isFavorite: true, createdAt: at,
      });
      await db.put('local-copies', {
        userId: outgoing,
        kind: MESSAGE_DATA_COPY_KIND,
        value: {
          custom: [customRow(ownId, outgoing, SECRETS.customMessage, 'srv-own')],
          bundledFavoriteIds: [bundledId],
          nextCustomId: ownId + 1,
        },
        savedAt: 1,
      });
      await db.put('local-copies', {
        userId: 'OTHER-ACCOUNT',
        kind: MESSAGE_DATA_COPY_KIND,
        value: {
          custom: [customRow(otherId, 'OTHER-ACCOUNT', 'OTHER-CUSTOM', 'srv-other')],
          bundledFavoriteIds: [bundledId],
          nextCustomId: otherId + 1,
        },
        savedAt: 1,
      });
      const { id: _seedId, ...pendingMood } = moodEntry(outgoing, SECRETS.ownNote);
      const moodId = await db.add('moods', {
        ...pendingMood,
        date: '2026-08-04',
        synced: false,
      } as never);
      return { bundledId, ownId, otherId, moodId };
    } finally {
      db.close();
    }
  }

  async function expectOnlyOutgoingDataDeleted(
    outgoing: string,
    ids: Awaited<ReturnType<typeof seedDevice>>
  ) {
    await vi.waitFor(async () => {
      expect(await readLocalCopy(outgoing, 'anniversaries')).toBeNull();
      expect(await readLocalCopy(outgoing, 'profile')).toBeNull();
      expect(await readLocalCopy(outgoing, 'love-notes')).toBeNull();
      const db = await openMyLoveDB();
      try {
        expect(await db.get('image-cache', [outgoing, 'partner/pic.jpg'])).toBeUndefined();
        // Custom messages and favorites go with the message-data copy.
        expect(await db.get('local-copies', [outgoing, MESSAGE_DATA_COPY_KIND])).toBeUndefined();
      } finally {
        db.close();
      }
    });
    expect(await readLocalCopy('OTHER-ACCOUNT', 'anniversaries')).toEqual([]);
    const db = await openMyLoveDB();
    try {
      // Unowned rows and the other account's rows are untouched…
      expect(await db.get('image-cache', ['OTHER-ACCOUNT', 'partner/pic.jpg'])).toMatchObject({
        blob: 'OTHER-IMAGE',
      });
      expect(await db.get('messages', ids.bundledId)).toBeDefined();
      expect(
        (await db.get('local-copies', ['OTHER-ACCOUNT', MESSAGE_DATA_COPY_KIND]))?.value
      ).toMatchObject({
        custom: [expect.objectContaining({ id: ids.otherId, text: 'OTHER-CUSTOM' })],
        bundledFavoriteIds: [ids.bundledId],
      });
      // …and the outgoing account's unsynced mood, a queued write, survives.
      expect(await db.get('moods', ids.moodId)).toMatchObject({ synced: false });
    } finally {
      db.close();
    }
  }

  async function clearDevice() {
    const db = await openMyLoveDB();
    try {
      await Promise.all(
        (['moods', 'local-copies', 'image-cache', 'messages'] as const).map((store) =>
          db.clear(store)
        )
      );
    } finally {
      db.close();
    }
  }

  it("deletes the outgoing account's local copies (custom messages and favorites included) and cached images, and nothing else", async () => {
    // CAP-7: another account on the device keeps its data, and the outgoing
    // account's unsynced mood — a queued write — survives for its next sign-in.
    const ids = await seedDevice(SECRETS.userId);

    useAppStore.getState().clearAuth();

    await expectOnlyOutgoingDataDeleted(SECRETS.userId, ids);
  });

  it("deletes the outgoing account's saved data on a direct account switch", async () => {
    const ids = await seedDevice(SECRETS.userId);

    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    await expectOnlyOutgoingDataDeleted(SECRETS.userId, ids);
  });

  it('records the signed-in account as the device owner, and clears it on sign-out', () => {
    useAppStore.getState().clearAuth();
    expect(localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY)).toBeNull();
    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');
    expect(localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY)).toBe(SECRETS.userId);
    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');
    expect(localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY)).toBe('USER-B-ID');
    useAppStore.getState().clearAuth();
    expect(localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY)).toBeNull();
  });

  it("deletes the recorded owner's saved data on a no-session boot", async () => {
    // Boot after refresh-token expiry (or sign-out-everywhere): authSlice — not
    // persisted — never learned who was signed in. Only the owner marker,
    // written at A's last sign-in, still says whose data is on the device.
    localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, SECRETS.userId);
    useAppStore.setState({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
    } as unknown as Parameters<typeof useAppStore.setState>[0]);
    const ids = await seedDevice(SECRETS.userId);

    expect(() => useAppStore.getState().clearAuth()).not.toThrow();

    expect(localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY)).toBeNull();
    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);
    await expectOnlyOutgoingDataDeleted(SECRETS.userId, ids);
  });

  it('deletes a previous owner\'s leftover data when a different account signs in fresh', async () => {
    // A's session ended without this device seeing it (no clearAuth ran), and
    // B's session is the first thing the next boot reports.
    localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, SECRETS.userId);
    useAppStore.setState({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
    } as unknown as Parameters<typeof useAppStore.setState>[0]);
    const ids = await seedDevice(SECRETS.userId);

    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    expect(localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY)).toBe('USER-B-ID');
    // Requested synchronously, for the recorded owner only.
    expect(deleteAccountCopies).toHaveBeenCalledExactlyOnceWith(SECRETS.userId);
    expect(deleteAccountImages).toHaveBeenCalledExactlyOnceWith(SECRETS.userId);
    await expectOnlyOutgoingDataDeleted(SECRETS.userId, ids);
  });

  it("a fresh boot of the recorded owner's own session deletes nothing", async () => {
    localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, SECRETS.userId);
    useAppStore.setState({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
    } as unknown as Parameters<typeof useAppStore.setState>[0]);
    const ids = await seedDevice(SECRETS.userId);

    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');

    // Sign-in starts any delete synchronously, so none was ever requested.
    expect(deleteAccountCopies).not.toHaveBeenCalled();
    expect(deleteAccountImages).not.toHaveBeenCalled();
    expect(await readLocalCopy(SECRETS.userId, 'anniversaries')).not.toBeNull();
    const db = await openMyLoveDB();
    try {
      expect(
        (await db.get('local-copies', [SECRETS.userId, MESSAGE_DATA_COPY_KIND]))?.value
      ).toMatchObject({
        custom: [expect.objectContaining({ id: ids.ownId })],
        bundledFavoriteIds: [ids.bundledId],
      });
    } finally {
      db.close();
    }
  });

  it('sign-out resets exactly the account fields this suite lists, so a newly added field cannot go unasserted', () => {
    // Catches drift in the other direction: a field ADDED to the source without
    // being added here would otherwise go unasserted forever.
    expect(Object.keys(signedOutState()).sort()).toEqual(Object.keys(EXPECTED_RESET).sort());
  });

  it('does not keep scripture-owned fields on the reset object', () => {
    const resetKeys = Object.keys(signedOutState());
    const expectedKeys = Object.keys(EXPECTED_RESET);
    const scriptureOwned = [
      'session',
      'scriptureLoading',
      'isSyncing',
      'isPendingLockIn',
      'isPendingReflection',
      'activeSession',
      'isCheckingSession',
      'coupleStats',
      'isStatsLoading',
      'myRole',
      'partnerJoined',
      'myReady',
      'partnerReady',
      'partnerLocked',
      'partnerDisconnected',
      'partnerDisconnectedAt',
      'countdownStartedAt',
      'pendingRetry',
      'scriptureError',
      'isInitialized',
    ];

    for (const key of scriptureOwned) {
      expect(resetKeys).not.toContain(key);
      expect(expectedKeys).not.toContain(key);
    }
  });
});
