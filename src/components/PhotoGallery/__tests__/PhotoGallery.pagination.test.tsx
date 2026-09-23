/**
 * PhotoGallery's paginated list against the viewer and the scroll trigger.
 *
 * DW-176: a delete confirmed in the viewer must leave the grid, the count and
 * the viewer itself on the photos that still exist -- the store's own `photos`
 * is a separate list, so filtering it never reached the gallery.
 * DW-179: a failed "load more" must say so and stop, not end the album
 * silently or re-fire the trigger.
 * DW-181: the viewer's "Photo N of M" must not present the loaded page as the
 * whole album.
 * DW-201: the store holds its own, longer list (50 rows against the gallery's
 * pages of 20), so its length says nothing about an upload -- comparing the two
 * reloaded page one and snapped a scrolled album back to 20 photos.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoWithUrls } from '../../../services/photoService';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    img: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMotionValue: () => ({ get: () => 0, set: () => {}, on: () => () => {} }),
}));

const getPhotos = vi.hoisted(() => vi.fn<(limit: number, offset: number) => Promise<unknown[]>>());
vi.mock('../../../services/photoService', () => ({
  photoService: { getPhotos },
}));
vi.mock('../../../api/supabaseClient', () => ({
  getOwnDisplayName: async () => null,
  getPartnerDisplayName: async () => null,
}));
// Stable identity: the initial-load effect depends on loadPhotos.
const storeState = vi.hoisted(() => ({
  photos: [] as PhotoWithUrls[],
  loadPhotos: async () => {},
  deletePhoto: vi.fn<(photoId: string) => Promise<boolean>>(),
}));
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => storeState,
}));

import { PhotoGallery } from '../PhotoGallery';
import { PhotoViewer } from '../PhotoViewer';

// A controllable IntersectionObserver: the setup file's mock never calls back.
const observers: Array<{ fire: () => void; observing: boolean }> = [];
class ControlledObserver {
  private entry: { fire: () => void; observing: boolean };
  // Same signature as the real constructor, so a scanner that resolves
  // IntersectionObserver to this class does not flag the options argument.
  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    this.entry = {
      observing: false,
      fire: () =>
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        ),
    };
    observers.push(this.entry);
  }
  observe() {
    this.entry.observing = true;
  }
  unobserve() {
    this.entry.observing = false;
  }
  disconnect() {
    this.entry.observing = false;
  }
}

/** Scroll the trigger into view: fire every observer still watching it. */
async function scrollToTrigger() {
  await act(async () => {
    observers.filter((o) => o.observing).forEach((o) => o.fire());
  });
}

function photo(index: number): PhotoWithUrls {
  return {
    id: `photo-${index}`,
    user_id: 'me',
    caption: `cap-${index}`,
    signedUrl: `https://example.test/${index}.jpg`,
    isOwn: true,
    created_at: '2026-09-01T10:00:00.000Z',
  } as unknown as PhotoWithUrls;
}

function page(count: number, from = 0): PhotoWithUrls[] {
  return Array.from({ length: count }, (_, i) => photo(from + i));
}

async function renderGallery() {
  render(<PhotoGallery onUploadClick={vi.fn()} />);
  await act(async () => {});
}

async function openAndDelete(caption: string) {
  fireEvent.click(within(screen.getByTestId('photo-gallery-grid')).getByLabelText(caption));
  const overlay = screen.getByTestId('photo-viewer-overlay');
  fireEvent.click(within(overlay).getByLabelText('Delete photo'));
  await act(async () => {
    fireEvent.click(within(overlay).getByRole('button', { name: 'Delete' }));
  });
}

const originalObserver = window.IntersectionObserver;

beforeEach(() => {
  observers.length = 0;
  window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
  storeState.photos = [];
  storeState.deletePhoto.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.IntersectionObserver = originalObserver;
});

describe('PhotoGallery: deleting from the viewer (DW-176)', () => {
  it('drops the photo from the grid and the count, and shows the next photo', async () => {
    getPhotos.mockResolvedValue(page(3));
    await renderGallery();

    await openAndDelete('cap-1');

    expect(storeState.deletePhoto).toHaveBeenCalledWith('photo-1');
    const grid = screen.getByTestId('photo-gallery-grid');
    expect(within(grid).queryByLabelText('cap-1')).toBeNull();
    expect(within(grid).getAllByTestId('photo-grid-item')).toHaveLength(2);
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('2 photos');

    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByAltText('cap-2')).toBeTruthy();
    expect(within(overlay).getByText(/Photo 2 of 2/)).toBeTruthy();
  });

  it('steps back to the previous photo when the last one is deleted', async () => {
    getPhotos.mockResolvedValue(page(3));
    await renderGallery();

    await openAndDelete('cap-2');

    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByAltText('cap-1')).toBeTruthy();
    expect(within(overlay).getByText(/Photo 2 of 2/)).toBeTruthy();
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('2 photos');
  });

  it('closes the viewer and shows the empty state when the only photo is deleted', async () => {
    getPhotos.mockResolvedValue(page(1));
    await renderGallery();

    await openAndDelete('cap-0');

    expect(screen.queryByTestId('photo-viewer-overlay')).toBeNull();
    expect(screen.getByTestId('photo-gallery-empty-state')).toBeTruthy();
  });

  it('keeps the photo in the grid and the viewer when the delete fails', async () => {
    storeState.deletePhoto.mockResolvedValue(false);
    getPhotos.mockResolvedValue(page(3));
    await renderGallery();

    await openAndDelete('cap-1');

    const grid = screen.getByTestId('photo-gallery-grid');
    expect(within(grid).getByLabelText('cap-1')).toBeTruthy();
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('3 photos');
    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByAltText('cap-1')).toBeTruthy();
    expect(within(overlay).getByText(/Photo 2 of 3/)).toBeTruthy();
  });

  it('pulls the next page from one row earlier, so no photo is skipped', async () => {
    getPhotos.mockResolvedValueOnce(page(20));
    await renderGallery();
    await openAndDelete('cap-5');
    fireEvent.click(screen.getByLabelText('Close viewer'));

    getPhotos.mockResolvedValueOnce(page(5, 20));
    await scrollToTrigger();

    // The server's row 19 is what was row 20 before the delete.
    expect(getPhotos).toHaveBeenLastCalledWith(20, 19);
  });
});

describe('PhotoGallery: a failed "load more" (DW-179)', () => {
  it('shows a retry row, stops the trigger, and retries on demand', async () => {
    getPhotos.mockResolvedValueOnce(page(20));
    await renderGallery();

    getPhotos.mockRejectedValueOnce(new Error('Network down'));
    await scrollToTrigger();
    expect(getPhotos).toHaveBeenCalledTimes(2);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe("Couldn't load more photos");
    // Not the end of the album, and the count is still a lower bound.
    expect(screen.queryByTestId('photo-gallery-end-message')).toBeNull();
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('20+ photos');

    // The trigger stays quiet: nothing is observing it any more.
    await scrollToTrigger();
    expect(getPhotos).toHaveBeenCalledTimes(2);

    getPhotos.mockResolvedValueOnce(page(5, 20));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(getPhotos).toHaveBeenCalledTimes(3);
    expect(getPhotos).toHaveBeenLastCalledWith(20, 20);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(25);
  });
});

describe('PhotoGallery: the store\'s own list (DW-201)', () => {
  /** Serve getPhotos from an album of `size`, newest first, as the server would. */
  function serveAlbum(album: PhotoWithUrls[]) {
    getPhotos.mockImplementation(async (limit, offset) => album.slice(offset, offset + limit));
  }

  it('keeps page two when the store holds more rows than the gallery shows', async () => {
    // loadPhotos fills the store with photoService.getPhotos()'s default 50.
    storeState.photos = page(50);
    serveAlbum(page(60));
    await renderGallery();

    await scrollToTrigger();

    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(40);
    const calls = getPhotos.mock.calls;
    const pageTwo = calls.findIndex(([limit, offset]) => limit === 20 && offset === 20);
    expect(pageTwo).toBeGreaterThan(-1);
    expect(calls.slice(pageTwo + 1)).not.toContainEqual([20, 0]);
    expect(calls).toEqual([
      [20, 0],
      [20, 20],
    ]);
  });

  it('shows a photo that arrives as the store\'s newest row', async () => {
    storeState.photos = page(50);
    const album = page(60);
    serveAlbum(album);
    const { rerender } = render(<PhotoGallery onUploadClick={vi.fn()} />);
    await act(async () => {});

    const uploaded = { ...photo(99), id: 'photo-new', caption: 'cap-new' } as PhotoWithUrls;
    album.unshift(uploaded);
    storeState.photos = [uploaded, ...storeState.photos];
    rerender(<PhotoGallery onUploadClick={vi.fn()} />);
    await act(async () => {});

    const grid = screen.getByTestId('photo-gallery-grid');
    expect(within(grid).getByLabelText('cap-new')).toBeTruthy();
    expect(within(grid).getAllByTestId('photo-grid-item')[0]).toBe(
      within(grid).getByLabelText('cap-new').closest('[data-testid="photo-grid-item"]')
    );
  });

  it('switches an empty album to the grid on its first upload', async () => {
    const album: PhotoWithUrls[] = [];
    serveAlbum(album);
    const { rerender } = render(<PhotoGallery onUploadClick={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByTestId('photo-gallery-empty-state')).toBeTruthy();

    album.push(photo(0));
    storeState.photos = [photo(0)];
    rerender(<PhotoGallery onUploadClick={vi.fn()} />);
    await act(async () => {});

    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(1);
  });

  it('keeps page two when the newest photo is deleted', async () => {
    storeState.photos = page(50);
    storeState.deletePhoto.mockImplementation(async (photoId) => {
      storeState.photos = storeState.photos.filter((p) => p.id !== photoId);
      return true;
    });
    serveAlbum(page(60));
    await renderGallery();
    await scrollToTrigger();

    await openAndDelete('cap-0');

    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(39);
    expect(getPhotos.mock.calls).toEqual([
      [20, 0],
      [20, 20],
    ]);
  });
});

describe('PhotoViewer: "Photo N of M" (DW-181)', () => {
  it('reads "of 20+" while more pages exist', () => {
    render(
      <PhotoViewer photos={page(20)} selectedPhotoId="photo-0" hasMore onClose={vi.fn()} />
    );
    expect(screen.getByText(/Photo 1 of 20\+ •/)).toBeTruthy();
  });

  it('reads "of 20" once pagination has ended', () => {
    render(
      <PhotoViewer photos={page(20)} selectedPhotoId="photo-0" hasMore={false} onClose={vi.fn()} />
    );
    expect(screen.getByText(/Photo 1 of 20 •/)).toBeTruthy();
  });

  it('is fed hasMore by the gallery', async () => {
    getPhotos.mockResolvedValueOnce(page(20));
    await renderGallery();

    fireEvent.click(screen.getByLabelText('cap-3'));
    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByText(/Photo 4 of 20\+/)).toBeTruthy();
  });
});
