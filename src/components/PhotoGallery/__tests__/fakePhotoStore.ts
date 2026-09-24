/**
 * A stand-in for `useAppStore` in the gallery's component tests.
 *
 * It holds only what PhotoGallery, PhotoGridItem and PhotoViewer read, and its
 * `loadPhotos` / `deletePhoto` follow photosSlice's contract in the smallest
 * form (a failed read keeps the list and sets `photosLoadError`; a confirmed
 * delete drops the row). The slice's own behaviour — the local copy, identity
 * guards, the image cache — is covered in `tests/unit/stores/photosSlice.*`.
 */
import { vi } from 'vitest';
import { create } from 'zustand';
import type { PhotoWithUrls } from '../../../services/photoService';
import type { PhotoImage } from '../../../hooks/usePhotoImage';

/** The server's answer to the store's list read. */
export const listPhotos = vi.fn<() => Promise<PhotoWithUrls[]>>();
/** The server's answer to a delete. */
export const deletePhotoOnServer = vi.fn<(photoId: string) => Promise<boolean>>();

interface FakePhotoState {
  userId: string | null;
  authSessionVersion: number;
  photos: PhotoWithUrls[];
  photosLoaded: boolean;
  photosLoadError: string | null;
  loadPhotos: () => Promise<void>;
  deletePhoto: (photoId: string) => Promise<boolean>;
}

export const fakePhotoStore = create<FakePhotoState>()((set) => ({
  userId: 'me',
  authSessionVersion: 1,
  photos: [],
  photosLoaded: false,
  photosLoadError: null,
  loadPhotos: async () => {
    set({ photosLoadError: null });
    try {
      const photos = await listPhotos();
      set({ photos, photosLoaded: true });
    } catch (error) {
      set({ photosLoadError: error instanceof Error ? error.message : 'Failed to load photos' });
    }
  },
  deletePhoto: async (photoId) => {
    const deleted = await deletePhotoOnServer(photoId);
    if (deleted) set((state) => ({ photos: state.photos.filter((p) => p.id !== photoId) }));
    return deleted;
  },
}));

export function resetFakePhotoStore(): void {
  fakePhotoStore.setState({ photos: [], photosLoaded: false, photosLoadError: null });
  listPhotos.mockReset();
  listPhotos.mockResolvedValue([]);
  deletePhotoOnServer.mockReset();
  deletePhotoOnServer.mockResolvedValue(true);
}

/** `usePhotoImage` with every image cached: a blob URL per storage path. */
export function fakeUsePhotoImage(path: string | null | undefined): PhotoImage {
  return path ? { status: 'ready', url: `blob:${path}` } : { status: 'idle', url: null };
}
