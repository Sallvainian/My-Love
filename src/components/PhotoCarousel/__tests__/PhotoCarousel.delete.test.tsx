/**
 * PhotoCarousel's delete confirmation against a delete that fails.
 *
 * The store's deletePhoto resolves false on failure rather than rejecting, and
 * PhotoDeleteConfirmation shows its error only when onConfirmDelete rejects --
 * so the carousel must turn false into a rejection, or a failed delete closes
 * the dialog as if it worked while the photo stays.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => {
  const div = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;
  const img = (props: ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ''} />
  );
  return {
    m: { div, img },
    motion: { div, img },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

const storeState = vi.hoisted(() => ({
  photos: [
    {
      id: 'photo-1',
      user_id: 'user-1',
      storage_path: 'user-1/photo-1.jpg',
      caption: 'Beach day',
      tags: [],
      created_at: '2026-09-01T12:00:00Z',
      signedUrl: 'https://example.test/photo-1.jpg',
      isOwn: true,
    },
  ],
  selectedPhotoId: 'photo-1',
  selectPhoto: () => {},
  clearPhotoSelection: () => {},
  updatePhoto: async () => {},
  deletePhoto: vi.fn<(photoId: string) => Promise<boolean>>(),
}));
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => storeState,
}));

import { PhotoCarousel } from '../PhotoCarousel';

describe('PhotoCarousel delete', () => {
  beforeEach(() => {
    storeState.deletePhoto.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the confirmation open with its error when the delete fails', async () => {
    storeState.deletePhoto.mockResolvedValue(false);
    render(<PhotoCarousel />);

    fireEvent.click(screen.getByTestId('photo-carousel-delete-button'));
    fireEvent.click(screen.getByTestId('photo-delete-confirmation-delete-button'));

    expect(await screen.findByTestId('photo-delete-confirmation-error')).toHaveAttribute(
      'role',
      'alert'
    );
    expect(storeState.deletePhoto).toHaveBeenCalledWith('photo-1');
    expect(screen.getByTestId('photo-delete-confirmation')).toBeInTheDocument();
  });

  it('closes the confirmation when the delete succeeds', async () => {
    storeState.deletePhoto.mockResolvedValue(true);
    render(<PhotoCarousel />);

    fireEvent.click(screen.getByTestId('photo-carousel-delete-button'));
    fireEvent.click(screen.getByTestId('photo-delete-confirmation-delete-button'));

    await waitFor(() =>
      expect(screen.queryByTestId('photo-delete-confirmation')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('photo-delete-confirmation-error')).not.toBeInTheDocument();
  });
});
