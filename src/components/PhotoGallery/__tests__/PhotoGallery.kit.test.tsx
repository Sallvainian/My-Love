/**
 * PhotoGallery on the kit: the story's matrix rows.
 *
 * Grid -> title, count + partner subtitle, header Upload pill carrying the old
 * FAB's testid; the exact count while tiles are still unrevealed; singular; no
 * partner name; empty state without the header Upload; loading header + a
 * skeleton in the grid's exact layout; load error card with retry; owner
 * badges. The gallery renders the store's list (`fakePhotoStore`).
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoWithUrls } from '../../../services/photoService';

const names = vi.hoisted(() => ({
  own: vi.fn<() => Promise<string | null>>(),
  partner: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  getOwnDisplayName: names.own,
  getPartnerDisplayName: names.partner,
}));
vi.mock('../../../stores/useAppStore', async () => ({
  useAppStore: (await import('./fakePhotoStore')).fakePhotoStore,
}));
vi.mock('../../../hooks/usePhotoImage', async () => ({
  usePhotoImage: (await import('./fakePhotoStore')).fakeUsePhotoImage,
}));

import { PhotoGallery } from '../PhotoGallery';
import { listPhotos, resetFakePhotoStore } from './fakePhotoStore';

function photo(index: number, isOwn = true): PhotoWithUrls {
  return {
    id: `photo-${index}`,
    user_id: isOwn ? 'me' : 'partner',
    storage_path: `${isOwn ? 'me' : 'partner'}/${index}.jpg`,
    caption: null,
    signedUrl: null,
    isOwn,
    created_at: '2026-09-01T10:00:00.000Z',
  } as unknown as PhotoWithUrls;
}

function page(count: number, ownEvery = true): PhotoWithUrls[] {
  return Array.from({ length: count }, (_, i) => photo(i, ownEvery ? true : i % 2 === 0));
}

/** Render and let the photo and name reads settle. */
async function renderGallery(onUploadClick = vi.fn()) {
  render(<PhotoGallery onUploadClick={onUploadClick} />);
  await act(async () => {});
  return onUploadClick;
}

beforeEach(() => {
  resetFakePhotoStore();
  names.own.mockResolvedValue('Jessie');
  names.partner.mockResolvedValue('Harper');
  listPhotos.mockResolvedValue(page(12));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PhotoGallery grid', () => {
  it('renders the title and the count subtitle with the partner name', async () => {
    await renderGallery();

    expect(screen.getByRole('heading', { level: 1, name: 'Photos' })).toBeTruthy();
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe(
      '12 photos · shared with Harper'
    );
  });

  it('shows a labelled header Upload pill that is not fixed', async () => {
    await renderGallery();

    const upload = screen.getByTestId('photo-gallery-upload-fab');
    expect(upload.getAttribute('aria-label')).toBe('Upload photo');
    expect(upload.className).not.toMatch(/\bfixed\b/);
    expect(upload.textContent).toBe('Upload');
  });

  it('calls onUploadClick once when the header Upload pill is pressed', async () => {
    const user = userEvent.setup();
    const onUploadClick = await renderGallery();

    const upload = screen.getByTestId('photo-gallery-upload-fab');
    await user.click(upload);
    expect(onUploadClick).toHaveBeenCalledTimes(1);
  });

  it('lays the grid out in three columns at every width', async () => {
    await renderGallery();

    const grid = screen.getByTestId('photo-gallery-grid');
    expect(grid.className).toContain('grid-cols-3');
    expect(grid.className).toContain('gap-1.5');
    expect(grid.className).not.toMatch(/(sm|md|lg):grid-cols/);
  });

  it('gives the upload dialog the header Upload button to return focus to', async () => {
    const uploadButtonRef = createRef<HTMLButtonElement>();
    render(<PhotoGallery onUploadClick={vi.fn()} uploadButtonRef={uploadButtonRef} />);
    await act(async () => {});

    expect(uploadButtonRef.current).toBe(screen.getByTestId('photo-gallery-upload-fab'));
  });

  it('counts every photo while only the first 20 tiles are shown', async () => {
    listPhotos.mockResolvedValue(page(25));
    await renderGallery();

    // The whole list is held, so the count is exact, never "20+".
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe(
      '25 photos · shared with Harper'
    );
    expect(screen.getAllByTestId('photo-grid-item')).toHaveLength(20);
  });

  it('says "1 photo" for a single photo', async () => {
    listPhotos.mockResolvedValue(page(1));
    await renderGallery();

    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe(
      '1 photo · shared with Harper'
    );
  });

  it('drops the "shared with" clause when there is no partner name', async () => {
    names.partner.mockResolvedValue(null);
    listPhotos.mockResolvedValue(page(3));
    await renderGallery();

    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('3 photos');
  });

  it('falls back when neither name is known', async () => {
    // Both reads collapse "unset" and "failed" to null; they never reject.
    names.own.mockResolvedValue(null);
    names.partner.mockResolvedValue(null);
    listPhotos.mockResolvedValue([photo(0, true), photo(1, false)]);
    await renderGallery();

    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe('2 photos');
    const [own, partner] = screen.getAllByTestId('photo-grid-item-owner-badge');
    expect(own.textContent).toBe('YUploaded by you');
    expect(partner.textContent).toBe('PUploaded by your partner');
  });
});

describe('PhotoGallery owner badge', () => {
  it('shows the own / partner initial on fill / partner, with sr-only text', async () => {
    listPhotos.mockResolvedValue([photo(0, true), photo(1, false)]);
    await renderGallery();

    const [own, partner] = screen.getAllByTestId('photo-grid-item-owner-badge');

    expect(own.className).toContain('bg-fill');
    expect(own.className).toContain('text-white');
    expect(own.className).toContain('h-5');
    expect(own.className).toContain('w-5');
    expect(own.className).toContain('left-1.5');
    expect(own.className).toContain('bottom-1.5');
    expect(within(own).getByTestId('photo-grid-item-owner-initial').textContent).toBe('J');
    const ownText = within(own).getByTestId('photo-grid-item-owner-text');
    expect(ownText.textContent).toBe('Uploaded by you');
    expect(ownText).toHaveClass('sr-only');

    expect(partner.className).toContain('bg-partner');
    expect(partner.className).toContain('text-card');
    expect(partner.className).not.toContain('text-white');
    expect(within(partner).getByTestId('photo-grid-item-owner-initial').textContent).toBe('H');
    const partnerText = within(partner).getByTestId('photo-grid-item-owner-text');
    expect(partnerText.textContent).toBe('Uploaded by Harper');
    expect(partnerText).toHaveClass('sr-only');

    // The tile's aria-label wins over its content, so the uploader reaches
    // assistive tech through aria-describedby.
    const [ownTile, partnerTile] = screen.getAllByTestId('photo-grid-item');
    expect(ownTile).toHaveAccessibleDescription('Uploaded by you');
    expect(partnerTile).toHaveAccessibleDescription('Uploaded by Harper');
  });

  it('keeps a name that opens with an emoji whole on the badge', async () => {
    names.partner.mockResolvedValue('🌸Harper');
    listPhotos.mockResolvedValue([photo(0, false)]);
    await renderGallery();

    const badge = screen.getByTestId('photo-grid-item-owner-badge');
    expect(within(badge).getByTestId('photo-grid-item-owner-initial').textContent).toBe('🌸');
  });
});

describe('PhotoGallery empty', () => {
  it('shows the empty card and no header Upload', async () => {
    listPhotos.mockResolvedValue([]);
    await renderGallery();

    const empty = screen.getByTestId('photo-gallery-empty-state');
    expect(within(empty).getByRole('heading', { level: 1, name: 'Photos' })).toBeTruthy();
    expect(within(empty).getByTestId('photo-gallery-subtitle').textContent).toBe(
      'Your shared album'
    );
    expect(within(empty).getByRole('heading', { name: 'No photos yet' })).toBeTruthy();
    expect(screen.queryByTestId('photo-gallery-upload-fab')).toBeNull();
    // Not nested inside `photo-gallery`: the E2E `.or()` would match both.
    expect(screen.queryByTestId('photo-gallery')).toBeNull();

    const button = within(empty).getByTestId('photo-gallery-empty-upload-button');
    expect(button.textContent).toBe('Upload a photo');
    expect(button.className).toContain('bg-fill');
  });

  it('calls onUploadClick once when the empty-state Upload button is pressed', async () => {
    const user = userEvent.setup();
    listPhotos.mockResolvedValue([]);
    const onUploadClick = await renderGallery();

    const button = within(screen.getByTestId('photo-gallery-empty-state')).getByTestId(
      'photo-gallery-empty-upload-button'
    );
    await user.click(button);
    expect(onUploadClick).toHaveBeenCalledTimes(1);
  });
});

describe('PhotoGallery loading', () => {
  it('shows the empty-state header and a skeleton in the grid layout', async () => {
    let resolve: (value: PhotoWithUrls[]) => void = () => {};
    listPhotos.mockImplementation(() => new Promise((r) => (resolve = r)));
    render(<PhotoGallery onUploadClick={vi.fn()} />);

    const wrapper = screen.getByTestId('photo-gallery');
    expect(within(wrapper).getByRole('heading', { level: 1, name: 'Photos' })).toBeTruthy();
    expect(within(wrapper).getByTestId('photo-gallery-subtitle').textContent).toBe(
      'Your shared album'
    );
    expect(screen.queryByTestId('photo-gallery-upload-fab')).toBeNull();

    const skeletonGrid = screen.getByTestId('photo-gallery-skeleton-grid');
    const [tile] = screen.getAllByTestId('photo-grid-skeleton');
    expect(tile.className).toContain('rounded-[14px]');
    expect(tile.className).toContain('bg-card2');
    expect(tile.className).toContain('animate-pulse');

    await act(async () => resolve(page(4)));

    const grid = screen.getByTestId('photo-gallery-grid');
    expect(grid.className).toBe(skeletonGrid.className);
    const [item] = screen.getAllByTestId('photo-grid-item');
    expect(item.className).toContain('rounded-[14px]');
  });
});

describe('PhotoGallery load error', () => {
  it('shows the header and a kit error card with a working retry', async () => {
    const user = userEvent.setup();
    listPhotos.mockRejectedValueOnce(new Error('Network down'));
    await renderGallery();

    const errorState = screen.getByTestId('photo-gallery-error-state');
    expect(within(errorState).getByRole('heading', { level: 1, name: 'Photos' })).toBeTruthy();
    const alert = within(errorState).getByRole('alert');
    expect(alert.textContent).toBe('Network down');
    expect(alert.className).toContain('bg-dtint');
    expect(alert.className).toContain('text-danger');
    expect(screen.queryByTestId('photo-gallery-upload-fab')).toBeNull();

    await user.click(within(errorState).getByTestId('photo-gallery-error-retry-button'));
    await act(async () => {});

    expect(screen.queryByTestId('photo-gallery-error-state')).toBeNull();
    expect(screen.getByTestId('photo-gallery-subtitle').textContent).toBe(
      '12 photos · shared with Harper'
    );
  });
});
