/**
 * PhotoGallery's revealed list against the viewer and the scroll trigger.
 *
 * Since spec-unified-data-storage story 10 the gallery renders the store's
 * whole list (every photo, kept offline) and reveals 20 more tiles per scroll
 * step; it never pages the server itself.
 *
 * DW-176: a delete confirmed in the viewer must leave the grid, the count and
 * the viewer itself on the photos that still exist.
 * DW-181: the viewer's "Photo N of M" counts the whole album, not the tiles
 * revealed so far (the gallery hands it the store's whole list).
 * DW-201: an upload (the store's newest row) shows at once, and scrolling the
 * album is never snapped back to its first 20 tiles.
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

vi.mock('../../../api/supabaseClient', () => ({
  getOwnDisplayName: async () => null,
  getPartnerDisplayName: async () => null,
}));
vi.mock('../../../stores/useAppStore', async () => ({
  useAppStore: (await import('./fakePhotoStore')).fakePhotoStore,
}));
vi.mock('../../../hooks/usePhotoImage', async () => ({
  usePhotoImage: (await import('./fakePhotoStore')).fakeUsePhotoImage,
}));

import { PhotoGallery } from '../PhotoGallery';
import {
  deletePhotoOnServer,
  fakePhotoStore,
  listPhotos,
  resetFakePhotoStore,
} from './fakePhotoStore';

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
    storage_path: `me/${index}.jpg`,
    caption: `cap-${index}`,
    signedUrl: null,
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
  resetFakePhotoStore();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.IntersectionObserver = originalObserver;
});

describe('PhotoGallery: deleting from the viewer (DW-176)', () => {
  it('drops the photo from the grid and the count, and shows the next photo', async () => {
    listPhotos.mockResolvedValue(page(3));
    await renderGallery();

    await openAndDelete('cap-1');

    expect(deletePhotoOnServer).toHaveBeenCalledWith('photo-1');
    const grid = screen.getByTestId('photo-gallery-grid');
    expect(within(grid).queryByLabelText('cap-1')).toBeNull();
    expect(within(grid).getAllByTestId('photo-grid-item')).toHaveLength(2);
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('2 photos');

    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByAltText('cap-2')).toBeTruthy();
    expect(within(overlay).getByText(/Photo 2 of 2/)).toBeTruthy();
  });

  it('steps back to the previous photo when the last one is deleted', async () => {
    listPhotos.mockResolvedValue(page(3));
    await renderGallery();

    await openAndDelete('cap-2');

    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByAltText('cap-1')).toBeTruthy();
    expect(within(overlay).getByText(/Photo 2 of 2/)).toBeTruthy();
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('2 photos');
  });

  it('closes the viewer and shows the empty state when the only photo is deleted', async () => {
    listPhotos.mockResolvedValue(page(1));
    await renderGallery();

    await openAndDelete('cap-0');

    expect(screen.queryByTestId('photo-viewer-overlay')).toBeNull();
    expect(screen.getByTestId('photo-gallery-empty-state')).toBeTruthy();
  });

  it('keeps the photo in the grid and the viewer when the delete fails', async () => {
    deletePhotoOnServer.mockResolvedValue(false);
    listPhotos.mockResolvedValue(page(3));
    await renderGallery();

    await openAndDelete('cap-1');

    const grid = screen.getByTestId('photo-gallery-grid');
    expect(within(grid).getByLabelText('cap-1')).toBeTruthy();
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('3 photos');
    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByAltText('cap-1')).toBeTruthy();
    expect(within(overlay).getByText(/Photo 2 of 3/)).toBeTruthy();
  });
});

describe('PhotoGallery: revealing the list', () => {
  it('asks the store for a fresh read when it opens, and never pages the server itself', async () => {
    listPhotos.mockResolvedValue(page(45));
    await renderGallery();
    await scrollToTrigger();
    await scrollToTrigger();

    expect(listPhotos).toHaveBeenCalledTimes(1);
  });

  it('reveals 20 more tiles per scroll step, then the end of the album', async () => {
    listPhotos.mockResolvedValue(page(45));
    await renderGallery();
    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(20);
    expect(screen.queryByTestId('photo-gallery-end-message')).toBeNull();

    await scrollToTrigger();
    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(40);

    await scrollToTrigger();
    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(45);
    expect(screen.queryByTestId('photo-gallery-load-trigger')).toBeNull();
    expect(screen.getByTestId('photo-gallery-end-message')).toBeTruthy();
  });

  it('shows the saved list at once and keeps it when the refresh fails', async () => {
    fakePhotoStore.setState({ photos: page(3), photosLoaded: true });
    listPhotos.mockRejectedValue(new Error('Failed to fetch'));
    await renderGallery();

    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(3);
    expect(screen.queryByTestId('photo-gallery-error-state')).toBeNull();
  });
});

describe('PhotoGallery: the store\'s newest row (DW-201)', () => {
  it('shows a photo that arrives as the store\'s newest row', async () => {
    listPhotos.mockResolvedValue(page(50));
    await renderGallery();

    const uploaded = { ...photo(99), id: 'photo-new', caption: 'cap-new' } as PhotoWithUrls;
    await act(async () => {
      fakePhotoStore.setState((state) => ({ photos: [uploaded, ...state.photos] }));
    });

    const grid = screen.getByTestId('photo-gallery-grid');
    expect(within(grid).getByLabelText('cap-new')).toBeTruthy();
    expect(within(grid).getAllByTestId('photo-grid-item')[0]).toBe(
      within(grid).getByLabelText('cap-new').closest('[data-testid="photo-grid-item"]')
    );
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('51 photos');
  });

  it('switches an empty album to the grid on its first upload', async () => {
    await renderGallery();
    expect(screen.getByTestId('photo-gallery-empty-state')).toBeTruthy();

    await act(async () => {
      fakePhotoStore.setState({ photos: [photo(0)] });
    });

    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(1);
  });

  it('keeps the revealed tiles when the newest photo is deleted', async () => {
    listPhotos.mockResolvedValue(page(60));
    await renderGallery();
    await scrollToTrigger();

    await openAndDelete('cap-0');

    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(40);
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('59 photos');
  });
});

describe('PhotoViewer: "Photo N of M" (DW-181)', () => {
  it('is handed the whole album by the gallery, not just the revealed tiles', async () => {
    listPhotos.mockResolvedValue(page(25));
    await renderGallery();

    fireEvent.click(screen.getByLabelText('cap-3'));
    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(within(overlay).getByText(/Photo 4 of 25 •/)).toBeTruthy();
  });
});
