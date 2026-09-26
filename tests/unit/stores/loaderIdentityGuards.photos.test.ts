/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * This file: the photosSlice actions (`loadPhotos`, `uploadPhoto`, `deletePhoto`).
 * Why these tests switch identity directly instead of calling clearAuth is
 * recorded in `loaderIdentityGuardsFixture.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const getPartner = vi.fn();
const getPendingRequests = vi.fn();
const searchUsers = vi.fn();
const fetchMoods = vi.fn();
const getAllForUser = vi.fn();
const getUnsyncedMoods = vi.fn();
const listAllPhotos = vi.fn();
const uploadPhotoService = vi.fn();
const deletePhotoService = vi.fn();
const checkStorageQuota = vi.fn();
const getEvents = vi.fn();
const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();
const getInteractionHistory = vi.fn();
const getAllStoredMessages = vi.fn();
const getStoredMessage = vi.fn();
const toggleStoredFavorite = vi.fn();
const customCreate = vi.fn();
const customUpdateMessage = vi.fn();
const customDeleteForUser = vi.fn();
const loveNotesQuery = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: () => loveNotesQuery(),
    auth: {},
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
}));

vi.mock('../../../src/api/moodSyncService', () => ({
  moodSyncService: { fetchMoods: () => fetchMoods() },
}));

vi.mock('../../../src/api/partnerService', () => ({
  partnerService: {
    getPartner: () => getPartner(),
    getPendingRequests: () => getPendingRequests(),
    searchUsers: (query: string) => searchUsers(query),
  },
}));

vi.mock('../../../src/services/photoService', () => ({
  photoService: {
    listAllPhotos: () => listAllPhotos(),
    uploadPhoto: (input: unknown, onCheckError?: (message: string) => void) =>
      uploadPhotoService(input, onCheckError),
    deletePhoto: (photoId: string) => deletePhotoService(photoId),
    checkStorageQuota: () => checkStorageQuota(),
  },
}));

// The background photo image fill is photoImageCache's own subject.
vi.mock('../../../src/services/photoImageCache', async (importOriginal) => ({
  deletePhotoImages: (
    await importOriginal<typeof import('../../../src/services/photoImageCache')>()
  ).deletePhotoImages,
  requestPhotoImageFill: vi.fn(async () => {}),
}));

vi.mock('../../../src/services/eventsService', () => ({
  eventsService: {
    getEventsPage: async () => ({
      events: await getEvents(),
      pagination: {
        todayISO: '2026-09-12',
        upcoming: { cursor: null, hasMore: false },
        past: { cursor: null, hasMore: false },
      },
    }),
    createEvent: (input: unknown) => createEvent(input),
    updateEvent: (eventId: string, updates: unknown) => updateEvent(eventId, updates),
    deleteEvent: (eventId: string) => deleteEvent(eventId),
  },
}));

vi.mock('../../../src/api/interactionService', () => ({
  InteractionService: class {
    getInteractionHistory(userId: string, limit: number) {
      return getInteractionHistory(userId, limit);
    }
  },
}));

vi.mock('../../../src/services/storage', () => ({
  storageService: {
    // The bundled rows the rotation pool starts from. Shared by every account;
    // each account's own rows come from its message-data copy (readLocalCopy).
    getAllMessages: () => getAllStoredMessages(),
    getMessage: (id: number) => getStoredMessage(id),
    init: vi.fn(),
    addMessage: vi.fn(),
    addMessages: vi.fn(),
    bundledFavoriteIds: vi.fn(async () => []),
    // The server half of a favorite; a case asserts WHICH account it names.
    toggleFavorite: (userId: string | null, message: unknown, copy: unknown) =>
      toggleStoredFavorite(userId, message, copy),
  },
}));

// The server writes are faked; the copy transforms stay real.
vi.mock('../../../src/services/customMessageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/customMessageService')>();
  return {
    ...actual,
    customMessageService: {
      ...actual.customMessageService,
      createRemote: (userId: string | null, input: unknown, clientKey: string) =>
        customCreate(userId, input, clientKey),
      updateRemote: (row: unknown, input: unknown) => customUpdateMessage(row, input),
      deleteRemote: (row: unknown) => customDeleteForUser(row),
    },
  };
});

// The partner loader reads its saved copy before the server. Controlled here
// so a case can hold the copy read open across an account switch.
const readLocalCopy = vi.fn();
const writeLocalCopy = vi.fn();
vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: (userId: string, kind: string) => readLocalCopy(userId, kind),
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  deleteAccountCopies: async () => {},
  registerLocalCopy: () => () => {},
  refreshLocalCopies: async () => {},
  refreshLocalCopy: async () => {},
}));

vi.mock('../../../src/services/moodService', () => ({
  moodService: {
    getAllForUser: (userId: string) => getAllForUser(userId),
    getUnsyncedMoods: (userId: string) => getUnsyncedMoods(userId),
  },
}));

import { useAppStore } from '../../../src/stores/useAppStore';
// Type-only, so `vi.mock` above still replaces the runtime module. Annotating
// the photo fixtures against the real types is what makes a field rename on
// PhotoUploadInput/SupabasePhoto fail typecheck instead of silently leaving
// these guard tests asserting a shape production never produces.
import type {
  PhotoUploadInput,
  PhotoWithUrls,
  SupabasePhoto,
} from '../../../src/services/photoService';
import {
  A,
  C,
  deferred,
  resetStoreSignedInAsA,
  storageQuota,
  switchToUserC,
} from './loaderIdentityGuardsFixture';

/** The minimum a PhotoUploadInput needs; nothing here reaches a real service. */
function uploadInput(): PhotoUploadInput {
  return {
    file: new Blob(['x'], { type: 'image/jpeg' }),
    filename: 'a.jpg',
    mimeType: 'image/jpeg' as const,
    width: 10,
    height: 10,
  };
}

/** A's photo row, carrying a string that must never appear in C's store. */
function aPhoto(): SupabasePhoto {
  return {
    id: 'a-photo-1',
    user_id: A,
    storage_path: `${A}/a-photo-1.jpeg`,
    filename: 'a.jpg',
    caption: 'A-PRIVATE-PHOTO',
    mime_type: 'image/jpeg',
    file_size: 1,
    width: 10,
    height: 10,
    created_at: '2026-09-01T00:00:00.000Z',
  };
}

/** What C already had on screen. */
function cPhoto(): PhotoWithUrls {
  return {
    id: 'c-photo',
    user_id: C,
    storage_path: `${C}/c-photo.jpeg`,
    filename: 'c.jpg',
    caption: 'C-OWN-CAPTION',
    mime_type: 'image/jpeg',
    file_size: 1,
    width: 10,
    height: 10,
    created_at: '2026-09-02T00:00:00.000Z',
    signedUrl: null,
    isOwn: true,
  };
}

/**
 * A's own gallery row, as `loadPhotos` repopulates it after A signs back in.
 *
 * The same-account-resignin cases seed THIS rather than C's row: `clearAuth()`
 * empties `photos` via `signedOutState()` (`authSlice.ts:92-96`), so a store
 * holding C's data after A has signed back in is a state no app path produces.
 * A's own re-loaded row is what is really on screen when the dead session's
 * continuation lands, and it is what that continuation would really corrupt.
 */
function aGalleryRow(): PhotoWithUrls {
  return { ...aPhoto(), signedUrl: null, isOwn: true };
}

describe('loader identity guards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetStoreSignedInAsA();

    const { getPartnerId, lookupPartnerId } = await import('../../../src/api/supabaseClient');
    vi.mocked(getPartnerId).mockResolvedValue('USER-B-ID');
    vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'linked', partnerId: 'USER-B-ID' });
    getUnsyncedMoods.mockResolvedValue([]);
    // Quiet by default: the custom-message cases each set what they need, and
    // several actions chain into loadMessages/loadCustomMessages afterwards.
    getAllStoredMessages.mockResolvedValue([]);
    getStoredMessage.mockResolvedValue(undefined);
    // uploadPhoto awaits the quota twice; unless a case says otherwise it is
    // quiet, so neither the reject nor the warning branch is what is measured.
    checkStorageQuota.mockResolvedValue(storageQuota(0, 'none'));
    readLocalCopy.mockResolvedValue(null);
    writeLocalCopy.mockResolvedValue(undefined);
  });

  // ==========================================================================
  // photosSlice
  // ==========================================================================

  describe('loadPhotos', () => {
    it('discards the gallery when the account changed', async () => {
      const pending = deferred<unknown[]>();
      listAllPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [cPhoto()] });

      pending.settle([{ ...aPhoto(), caption: 'A-PHOTO-CAPTION' }]);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PHOTO-CAPTION');
      // Nor is A's list saved as anyone's copy.
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      // The failure path writes `photosLoadError`, which the gallery renders.
      const pending = deferred<unknown[]>();
      listAllPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [cPhoto()], error: null, photosLoadError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photosLoadError).toBeNull();
      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
    });

    it('writes nothing when the SAME account signs back in mid-flight', async () => {
      const pending = deferred<unknown[]>();
      listAllPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      // The held read is really reached, so the guard below is what is measured.
      await vi.waitFor(() => expect(listAllPhotos).toHaveBeenCalled());
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      pending.settle([{ ...aPhoto(), id: 'dead-session-row', caption: 'DEAD-SESSION-ROW' }]);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([aGalleryRow()]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // photosSlice — upload / delete (CAP-12)
  //
  // An upload spans four awaits, so the window here is seconds wide rather
  // than one round trip. Every case seeds C's own gallery first, so a guard
  // that fails to discard is caught by C's row being replaced; the failure and
  // quota cases also seed C's `error` / `storageWarning` as null, the keys
  // those stale writes would fill.
  // ==========================================================================

  describe('uploadPhoto', () => {
    it("does not drop the previous account's photo into this one's gallery", async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()] });

      pending.settle(aPhoto());
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-PHOTO');
      // Nor is it saved into anyone's `photos` copy.
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('still reports the true outcome to its own caller', async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()] });

      pending.settle(aPhoto());

      // The upload really did happen and really did succeed. Only the shared
      // store is withheld; inventing a failure here would be a lie to A's
      // own component closure.
      await expect(inFlight).resolves.toEqual({ success: true });
    });

    it("does not paint the previous account's failure onto the new one", async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()], error: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));

      await expect(inFlight).resolves.toEqual({
        success: false,
        error: 'A-REQUEST-FAILURE',
      });
      expect(useAppStore.getState().error).toBeNull();
    });

    it("does not reject the new account's session over the previous one's quota", async () => {
      const quota = deferred<unknown>();
      checkStorageQuota.mockReturnValue(quota.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()], error: null });

      quota.settle(storageQuota(97, 'critical'));

      await expect(inFlight).resolves.toEqual({
        success: false,
        error: 'Storage nearly full (97%) - delete photos to continue',
      });
      expect(useAppStore.getState().error).toBeNull();
    });

    it("does not raise the pre-upload storage warning against the new account", async () => {
      const quota = deferred<unknown>();
      checkStorageQuota.mockReturnValueOnce(quota.promise);
      // Parked, so the assertion below runs while THIS guard is the only one
      // the upload has reached; each guard has to be provable on its own cases.
      const upload = deferred<unknown>();
      uploadPhotoService.mockReturnValue(upload.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()], storageWarning: null });

      // Between 80 and 95: A's account is filling up, C's is not.
      quota.settle(storageQuota(85, 'approaching'));
      // The warning is written, or not, before the upload starts.
      await vi.waitFor(() => expect(uploadPhotoService).toHaveBeenCalled());

      expect(useAppStore.getState().storageWarning).toBeNull();

      upload.settle(aPhoto());
      await inFlight;
    });

    it("does not raise the post-upload storage warning against the new account", async () => {
      // The switch has to land AFTER the insert to reach this write at all:
      // the success guard returns early otherwise, so a switch at call time
      // would leave this branch untested.
      const after = deferred<unknown>();
      checkStorageQuota
        .mockResolvedValueOnce(storageQuota(0, 'none'))
        .mockReturnValueOnce(after.promise);
      uploadPhotoService.mockResolvedValue(aPhoto());

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      // Parked on the post-upload quota read, past the insert.
      await vi.waitFor(() => expect(checkStorageQuota).toHaveBeenCalledTimes(2));

      // A's photo is in A's gallery by now — that write was legitimate.
      expect(useAppStore.getState().photos).toHaveLength(1);
      switchToUserC({ photos: [cPhoto()], storageWarning: null });

      after.settle(storageQuota(85, 'approaching'));
      await inFlight;

      expect(useAppStore.getState().storageWarning).toBeNull();
    });

    it('writes nothing at all when the upload completes after sign-out', async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      useAppStore.getState().clearAuth();

      pending.settle(aPhoto());
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([]);
      expect(useAppStore.getState().error).toBeNull();
    });

    it('writes nothing when the SAME account signs back in mid-flight', async () => {
      // The only row `switchToUserC` cannot express, and the one that
      // discriminates the authSessionVersion half of the guard: `userId` is A
      // again by the time the request lands, so an id-only compare passes.
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);

      pending.settle(aPhoto());
      await inFlight;

      // `signedOutState()` emptied the gallery and the new session has not
      // loaded yet, so an empty list is the real state here — and it still
      // discriminates: an id-only compare would insert A's photo into it.
      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().photos).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-PHOTO');
    });
  });

  describe('deletePhoto', () => {
    it("does not remove a row from the new account's gallery", async () => {
      // Deliberately the SAME id: partners share a gallery, so the id A is
      // deleting can legitimately be on screen for C too.
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);
      const shared = { ...cPhoto(), id: 'a-photo-1' };

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      switchToUserC({ photos: [shared] });

      pending.settle(true);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([shared]);
    });

    it('writes nothing when the delete settles after sign-out', async () => {
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      useAppStore.getState().clearAuth();

      // A REJECTED delete, deliberately. On the success path signedOutState()
      // has already emptied `photos`, so filtering it is a no-op whether the
      // guard is there or not and the case would prove nothing. The rejection
      // writes `error`, which signedOutState() does NOT reset — so that is the
      // observable this row can actually hold.
      pending.settle(false);
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toEqual([]);
    });

    it("does not paint the previous account's delete failure onto the new one", async () => {
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      switchToUserC({ photos: [cPhoto()], error: null });

      pending.fail(new Error('A-DELETE-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
    });

    it('writes nothing when the SAME account signs back in mid-flight', async () => {
      // The case that discriminates the authSessionVersion half of ownsDelete:
      // `userId` is A again by the time the response lands, so an id-only
      // compare lets a dead session's delete filter the live gallery.
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      // What A's own loadPhotos puts back on screen for the NEW session.
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      pending.settle(true);
      await inFlight;

      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().photos).toEqual([aGalleryRow()]);
    });
  });

  // ==========================================================================
  // The ordinary path the guards wrap
  // ==========================================================================

  describe('when the identity has not changed', () => {
    it("an uploaded photo resolves success and joins the gallery as the account's own, with no signed URL", async () => {
      uploadPhotoService.mockResolvedValue(aPhoto());

      await expect(useAppStore.getState().uploadPhoto(uploadInput())).resolves.toEqual({
        success: true,
      });

      // No signed URL: the image is shown from the cache or downloaded by path.
      expect(useAppStore.getState().photos).toEqual([{ ...aPhoto(), signedUrl: null, isOwn: true }]);
    });

    it('uploadPhoto still rejects on a full quota', async () => {
      checkStorageQuota.mockResolvedValueOnce(storageQuota(97, 'critical'));

      await expect(useAppStore.getState().uploadPhoto(uploadInput())).resolves.toEqual({
        success: false,
        error: 'Storage nearly full (97%) - delete photos to continue',
      });
      expect(useAppStore.getState().error).toBe(
        'Storage nearly full (97%) - delete photos to continue'
      );
    });

    // The two warning writes are split across two cases with DIFFERENT
    // percentages on purpose. One case with an every-call quota mock makes both
    // writes produce a byte-identical string, so either could be deleted with
    // the other still satisfying the assertion.
    it('uploadPhoto still warns when storage is already near the limit before the upload', async () => {
      checkStorageQuota
        .mockResolvedValueOnce(storageQuota(85, 'approaching'))
        .mockResolvedValueOnce(storageQuota(86, 'none'));
      uploadPhotoService.mockResolvedValue(aPhoto());

      await useAppStore.getState().uploadPhoto(uploadInput());

      expect(useAppStore.getState().storageWarning).toBe(
        'Storage 85% full - consider deleting old photos'
      );
    });

    it('uploadPhoto still warns when the upload itself pushes storage near the limit', async () => {
      // Below the threshold beforehand, so only the post-upload check can fire
      // — the branch that catches "this photo is what filled you up".
      checkStorageQuota
        .mockResolvedValueOnce(storageQuota(10, 'none'))
        .mockResolvedValueOnce(storageQuota(87, 'approaching'));
      uploadPhotoService.mockResolvedValue(aPhoto());

      await useAppStore.getState().uploadPhoto(uploadInput());

      expect(useAppStore.getState().storageWarning).toBe(
        'Storage 87% full - consider deleting old photos'
      );
    });

    it('uploadPhoto surfaces a failure and a retry then clears it', async () => {
      // One logical upload, retried — so both attempts carry the same
      // idempotencyKey, the shape PhotoUploadInput exists to express
      // (`photoService.ts:72-82`). Minting a fresh input per attempt would
      // encode the double-write this key was added to prevent.
      const retried = { ...uploadInput(), idempotencyKey: 'A-RETRY-KEY' };
      uploadPhotoService.mockRejectedValueOnce(new Error('network down'));

      await expect(useAppStore.getState().uploadPhoto(retried)).resolves.toEqual({
        success: false,
        error: 'network down',
      });
      expect(useAppStore.getState().error).toBe('network down');

      uploadPhotoService.mockResolvedValue(aPhoto());

      await expect(useAppStore.getState().uploadPhoto(retried)).resolves.toEqual({
        success: true,
      });
      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toHaveLength(1);
    });

    it('a deleted photo leaves the gallery', async () => {
      useAppStore.setState({ photos: [{ ...aPhoto(), signedUrl: null, isOwn: true }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      deletePhotoService.mockResolvedValue(true);

      await useAppStore.getState().deletePhoto('a-photo-1');

      expect(useAppStore.getState().photos).toEqual([]);
    });

    it('deletePhoto surfaces a failure', async () => {
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      // A rejected delete returns false, which the action turns into a throw.
      deletePhotoService.mockResolvedValue(false);

      await useAppStore.getState().deletePhoto('a-photo-1');

      expect(useAppStore.getState().error).toBe('Failed to delete photo');
      expect(useAppStore.getState().photos).toEqual([aGalleryRow()]);
    });
  });
});
