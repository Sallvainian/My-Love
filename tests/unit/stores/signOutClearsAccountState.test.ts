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
 * `searchResults`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

import { useAppStore } from '../../../src/stores/useAppStore';
import { signedOutState } from '../../../src/stores/slices/authSlice';
import {
  OWNER_STORAGE_KEY,
  VAULT_STORAGE_KEY,
  setAnniversaryOwner,
} from '../../../src/services/anniversaryVault';

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
  sentRequests: [],
  receivedRequests: [],
  isLoadingRequests: false,
  searchResults: [],
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
  selectedPhotoId: null,
  isUploading: false,
  uploadProgress: 0,
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
    sentRequests: [{ id: 'req-1', toEmail: SECRETS.requestedEmail }],
    receivedRequests: [{ id: 'req-2', fromEmail: SECRETS.requestedEmail }],
    searchResults: [{ id: 'USER-C-ID', displayName: SECRETS.searchHitName }],

    notes: [
      {
        id: 'note-1',
        from_user_id: SECRETS.userId,
        to_user_id: 'USER-B-ID',
        content: SECRETS.chatMessage,
        created_at: '2026-08-03T06:00:00.000Z',
      },
    ],
    sentMessageTimestamps: [1],
    // Which messages the previous account removed is theirs, not the next
    // signer-in's — and left behind it would filter their notes by stale ids.
    notesPendingRemoval: ['note-1'],

    photos: [{ id: 'photo-1', caption: SECRETS.photoCaption }],
    selectedPhotoId: 'photo-1',

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
    messages: [
      {
        id: 1,
        text: SHARED_DAILY_TEXT,
        category: 'reason',
        isCustom: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 7,
        text: SECRETS.customMessage,
        category: 'custom',
        isCustom: true,
        userId: SECRETS.userId,
        createdAt: new Date('2026-08-03T06:00:00.000Z'),
      },
    ],
    // DailyMessage renders `currentMessage.text` straight onto Home, and it is
    // a COPY of the row rather than a reference into `messages`.
    currentMessage: {
      id: 7,
      text: SECRETS.customMessage,
      category: 'custom',
      isCustom: true,
      userId: SECRETS.userId,
      createdAt: new Date('2026-08-03T06:00:00.000Z'),
    },

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
 * it -- loaderIdentityGuards.test.ts does -- but left running it can log after
 * the file's worker has closed, which Vitest reports as an unhandled
 * EnvironmentTeardownError and fails the whole run on. So each reload is
 * recorded and every test waits for its own to settle.
 */
const realLoadMessages = useAppStore.getState().loadMessages;
const pendingReloads: Promise<void>[] = [];

describe('clearAuth on sign-out', () => {
  beforeEach(() => {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(OWNER_STORAGE_KEY);
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
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(OWNER_STORAGE_KEY);
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
    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');
    expect(useAppStore.getState().settings!.relationship.anniversaries[0]!.label).toBe(
      SECRETS.anniversaryLabel
    );
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
    expect(state.searchResults).toEqual([]);
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
    expect(state.selectedPhotoId).toBeNull();
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
    const shared = {
      id: 1,
      text: SHARED_DAILY_TEXT,
      category: 'reason',
      isCustom: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
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

  it("drops the previous couple's anniversaries but keeps the device's notification time", () => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings!,
        notificationTime: '21:30',
      },
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    const settings = useAppStore.getState().settings!;
    // Labels and dates are the couple's, `partialize` persists `settings`, and
    // no service re-derives them — left in place they rehydrate into the next
    // account's Home countdown and Settings list.
    expect(settings.relationship.anniversaries).toEqual([]);
    // The notification time is device preference, not account state.
    expect(settings.notificationTime).toBe('21:30');
  });

  it("restores the same user's anniversaries on their next sign-in", () => {
    useAppStore.getState().clearAuth();
    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);

    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');

    // Anniversaries are localStorage-only, so the sign-out clear must not be
    // destruction: the vault stashed them per-user and sign-in pops them back.
    const anniversaries = useAppStore.getState().settings!.relationship.anniversaries;
    expect(anniversaries).toHaveLength(1);
    expect(anniversaries[0]!.label).toBe(SECRETS.anniversaryLabel);
  });

  it("never hands one user's stash to a different account", () => {
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);
    expect(JSON.stringify(useAppStore.getState())).not.toContain(SECRETS.anniversaryLabel);

    // …while A's entry keeps waiting for A.
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');
    expect(useAppStore.getState().settings!.relationship.anniversaries[0]!.label).toBe(
      SECRETS.anniversaryLabel
    );
  });

  it('stashes under the recorded owner when sign-out fires on a no-session boot', () => {
    // Boot after refresh-token expiry (or sign-out-everywhere): persisted
    // settings survived, but authSlice — not persisted — never learned who
    // was signed in. Only the owner marker, written at A's last sign-in,
    // still says whose list this is.
    useAppStore.setState({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
    } as unknown as Parameters<typeof useAppStore.setState>[0]);
    setAnniversaryOwner(SECRETS.userId);

    useAppStore.getState().clearAuth();
    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);

    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');
    expect(useAppStore.getState().settings!.relationship.anniversaries[0]!.label).toBe(
      SECRETS.anniversaryLabel
    );
  });

  it('stashes across a direct account switch that never passes through sign-out', () => {
    // Signing in over a live session hits setAuthUser's switched-account path.
    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    expect(useAppStore.getState().settings!.relationship.anniversaries).toEqual([]);

    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');
    expect(useAppStore.getState().settings!.relationship.anniversaries[0]!.label).toBe(
      SECRETS.anniversaryLabel
    );
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

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
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
        {
          id: 'note-failed',
          from_user_id: SECRETS.userId,
          to_user_id: 'USER-B-ID',
          content: SECRETS.chatMessage,
          created_at: '2026-08-03T06:00:00.000Z',
          imagePreviewUrl: 'blob:http://localhost/ORPHANED-BLOB',
        },
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
        {
          id: 'note-failed',
          from_user_id: SECRETS.userId,
          to_user_id: 'USER-B-ID',
          content: SECRETS.chatMessage,
          created_at: '2026-08-03T06:00:00.000Z',
          imagePreviewUrl: 'blob:http://localhost/SWITCH-ORPHANED-BLOB',
        },
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

  it('signedOutState() and this test agree on which fields exist', () => {
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
