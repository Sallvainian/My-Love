/**
 * The grid tile and the viewer against every image status `usePhotoImage` can
 * report (spec-unified-data-storage story 10), and the viewer against a live
 * list that changes while it is open.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoImage, UsePhotoImageOptions } from '../../../hooks/usePhotoImage';
import type { PhotoWithUrls } from '../../../services/photoService';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    img: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMotionValue: () => ({ get: () => 0, set: () => {}, on: () => () => {} }),
}));

const imageFor = vi.hoisted(() =>
  vi.fn<(path: string | null | undefined, options?: UsePhotoImageOptions) => PhotoImage>()
);
vi.mock('../../../hooks/usePhotoImage', () => ({
  usePhotoImage: (path: string | null | undefined, options?: UsePhotoImageOptions) =>
    imageFor(path, options),
}));

const deletePhotoMock = vi.hoisted(() => vi.fn<(photoId: string) => Promise<boolean>>());
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({ deletePhoto: deletePhotoMock }),
}));

import { PhotoGridItem } from '../PhotoGridItem';
import { PhotoViewer } from '../PhotoViewer';

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

const ready = (path: string | null | undefined): PhotoImage =>
  path ? { status: 'ready', url: `blob:${path}` } : { status: 'idle', url: null };

/** Every tile is in view at once. */
class VisibleObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
}

const originalObserver = window.IntersectionObserver;

beforeEach(() => {
  window.IntersectionObserver = VisibleObserver as unknown as typeof IntersectionObserver;
  imageFor.mockReset();
  imageFor.mockImplementation(ready);
  deletePhotoMock.mockReset();
  deletePhotoMock.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  window.IntersectionObserver = originalObserver;
});

function renderTile() {
  render(
    <PhotoGridItem
      photo={photo(0)}
      ownInitial="Y"
      partnerInitial="P"
      partnerName={null}
      onPhotoClick={vi.fn()}
    />
  );
  return screen.getByTestId('photo-grid-item');
}

describe('PhotoGridItem image status', () => {
  it.each(['error', 'unavailable'] as const)(
    '%s: the "not saved on this device" placeholder, no pulse',
    (status) => {
      imageFor.mockReturnValue({ status, url: null });
      const tile = renderTile();

      expect(within(tile).getByTestId('photo-grid-item-not-saved')).toHaveTextContent(
        'Not saved on this device'
      );
      expect(tile.querySelector('.animate-pulse')).toBeNull();
    }
  );

  it('loading: the pulse, no placeholder', () => {
    imageFor.mockReturnValue({ status: 'loading', url: null });
    const tile = renderTile();

    expect(tile.querySelector('.animate-pulse')).not.toBeNull();
    expect(within(tile).queryByTestId('photo-grid-item-not-saved')).toBeNull();
  });

  it('ready: the blob image', () => {
    const tile = renderTile();
    expect(within(tile).getByTestId('photo-grid-item-image')).toHaveAttribute('src', 'blob:me/0.jpg');
  });
});

describe('PhotoViewer image status', () => {
  it('error: "Failed to load photo"; Retry loads again and shows the image', async () => {
    // The shown photo errors until Retry raises the retry key.
    imageFor.mockImplementation((path, options) =>
      path === 'me/0.jpg' && (options?.retryKey ?? 0) === 0
        ? { status: 'error', url: null }
        : ready(path)
    );
    render(<PhotoViewer photos={[photo(0)]} selectedPhotoId="photo-0" onClose={vi.fn()} />);

    expect(screen.getByText('Failed to load photo')).toBeInTheDocument();
    expect(screen.queryByAltText('cap-0')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(imageFor).toHaveBeenCalledWith('me/0.jpg', { retryKey: 1 });
    expect(screen.getByAltText('cap-0')).toHaveAttribute('src', 'blob:me/0.jpg');
    expect(screen.queryByText('Failed to load photo')).toBeNull();
  });

  it('loading: a spinner while the image downloads', () => {
    imageFor.mockImplementation((path) =>
      path === 'me/0.jpg' ? { status: 'loading', url: null } : ready(path)
    );
    render(<PhotoViewer photos={[photo(0)]} selectedPhotoId="photo-0" onClose={vi.fn()} />);

    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(overlay.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByAltText('cap-0')).toBeNull();
  });

  it('unavailable: the "not saved on this device" placeholder', () => {
    imageFor.mockImplementation((path) =>
      path === 'me/0.jpg' ? { status: 'unavailable', url: null } : ready(path)
    );
    render(<PhotoViewer photos={[photo(0)]} selectedPhotoId="photo-0" onClose={vi.fn()} />);

    expect(screen.getByTestId('photo-viewer-not-saved')).toHaveTextContent(
      'This photo is not saved on this device'
    );
  });
});

describe('PhotoViewer on a live list', () => {
  it('keeps showing the opened photo when a newer photo is prepended', () => {
    const { rerender } = render(
      <PhotoViewer photos={[photo(1), photo(2)]} selectedPhotoId="photo-1" onClose={vi.fn()} />
    );
    expect(screen.getByAltText('cap-1')).toBeInTheDocument();
    expect(screen.getByText(/Photo 1 of 2 •/)).toBeInTheDocument();

    rerender(
      <PhotoViewer
        photos={[photo(0), photo(1), photo(2)]}
        selectedPhotoId="photo-1"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByAltText('cap-1')).toBeInTheDocument();
    expect(screen.getByText(/Photo 2 of 3 •/)).toBeInTheDocument();
  });

  it('deletes the photo the dialog names even after the list changed', async () => {
    const { rerender } = render(
      <PhotoViewer photos={[photo(1), photo(2)]} selectedPhotoId="photo-1" onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('Delete photo'));
    rerender(
      <PhotoViewer
        photos={[photo(0), photo(1), photo(2)]}
        selectedPhotoId="photo-1"
        onClose={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    expect(deletePhotoMock).toHaveBeenCalledWith('photo-1');
  });

  it('closes the confirmation without deleting when a refresh removes the photo it names', async () => {
    // The same account deleted photo-1 on another device; this device's
    // refresh drops it while its confirmation is up. The viewer falls back to
    // the photo now at that index (photo-2), which the user never confirmed.
    const { rerender } = render(
      <PhotoViewer
        photos={[photo(0), photo(1), photo(2)]}
        selectedPhotoId="photo-1"
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Delete photo'));
    expect(screen.getByText('Delete Photo?')).toBeInTheDocument();

    rerender(
      <PhotoViewer photos={[photo(0), photo(2)]} selectedPhotoId="photo-1" onClose={vi.fn()} />
    );

    const confirm = screen.queryByRole('button', { name: 'Delete' });
    if (confirm) {
      await act(async () => {
        fireEvent.click(confirm);
      });
    }

    expect(deletePhotoMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete Photo?')).not.toBeInTheDocument();
    // The viewer itself keeps its fallback: the photo now at that index.
    expect(screen.getByAltText('cap-2')).toBeInTheDocument();
  });

  it('resets for the photo a refresh leaves on screen, dropping the removed photo\'s load error', () => {
    const { rerender } = render(
      <PhotoViewer
        photos={[photo(0), photo(1), photo(2)]}
        selectedPhotoId="photo-1"
        onClose={vi.fn()}
      />
    );
    fireEvent.error(screen.getByAltText('cap-1'));
    expect(screen.getByText('Failed to load photo')).toBeInTheDocument();

    // Deleted on another device: the refresh drops photo-1 while it is open.
    rerender(
      <PhotoViewer photos={[photo(0), photo(2)]} selectedPhotoId="photo-1" onClose={vi.fn()} />
    );

    expect(screen.queryByText('Failed to load photo')).toBeNull();
    expect(screen.getByAltText('cap-2')).toHaveAttribute('src', 'blob:me/2.jpg');
    expect(screen.getByText(/Photo 2 of 2 •/)).toBeInTheDocument();
  });

  it('finishes its own delete when the store drops the row before the delete resolves', async () => {
    // photosSlice.deletePhoto removes the row from the list and only then
    // resolves; the confirmation must not be closed underneath that request.
    let resolveDelete: (deleted: boolean) => void = () => {};
    deletePhotoMock.mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveDelete = resolve))
    );
    const { rerender } = render(
      <PhotoViewer
        photos={[photo(0), photo(1), photo(2)]}
        selectedPhotoId="photo-1"
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Delete photo'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    rerender(
      <PhotoViewer photos={[photo(0), photo(2)]} selectedPhotoId="photo-1" onClose={vi.fn()} />
    );
    expect(screen.getByText('Delete Photo?')).toBeInTheDocument();

    await act(async () => {
      resolveDelete(true);
    });

    expect(deletePhotoMock).toHaveBeenCalledTimes(1);
    expect(deletePhotoMock).toHaveBeenCalledWith('photo-1');
    expect(screen.queryByText('Delete Photo?')).not.toBeInTheDocument();
    expect(screen.getByAltText('cap-2')).toBeInTheDocument();
  });

  it('moves to the next photo once its own delete removes it from the list', async () => {
    const { rerender } = render(
      <PhotoViewer
        photos={[photo(0), photo(1), photo(2)]}
        selectedPhotoId="photo-1"
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Delete photo'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    rerender(
      <PhotoViewer photos={[photo(0), photo(2)]} selectedPhotoId="photo-1" onClose={vi.fn()} />
    );

    expect(screen.getByAltText('cap-2')).toBeInTheDocument();
    expect(screen.getByText(/Photo 2 of 2 •/)).toBeInTheDocument();
  });
});
