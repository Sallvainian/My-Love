import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PhotoViewer } from '../../../src/components/PhotoGallery/PhotoViewer';
import type { PhotoWithUrls } from '../../../src/services/photoService';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    img: ({ children, ...props }: any) => <img {...props}>{children}</img>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useMotionValue: () => ({
    set: vi.fn(),
    get: () => 0,
  }),
}));

// Mock useAppStore
vi.mock('../../../src/stores/useAppStore', () => ({
  useAppStore: () => ({
    deletePhoto: vi.fn(),
  }),
}));

describe('PhotoViewer - Task 1: Modal Component', () => {
  const mockPhotos: PhotoWithUrls[] = [
    {
      id: 'photo-1',
      user_id: 'user-1',
      file_path: 'photos/photo1.jpg',
      caption: 'Test photo 1',
      created_at: '2025-12-01T10:00:00Z',
      signedUrl: 'https://example.com/photo1.jpg',
      isOwn: true,
    },
    {
      id: 'photo-2',
      user_id: 'user-2',
      file_path: 'photos/photo2.jpg',
      caption: 'Test photo 2',
      created_at: '2025-12-02T10:00:00Z',
      signedUrl: 'https://example.com/photo2.jpg',
      isOwn: false,
    },
  ];

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders full-screen modal overlay with black background', () => {
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveClass('bg-black');
    expect(modal).toHaveClass('fixed');
    expect(modal).toHaveClass('inset-0');
  });

  it('displays close button in top-right corner', () => {
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    const closeButton = screen.getByLabelText('Close viewer');
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    const closeButton = screen.getByLabelText('Close viewer');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calculates current photo index from selectedPhotoId', () => {
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-2" onClose={mockOnClose} />
    );

    // Should display second photo (index 1)
    const photoIndexIndicator = screen.getByText(/2 of 2/i);
    expect(photoIndexIndicator).toBeInTheDocument();
  });

  it('has proper z-index for modal stacking', () => {
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveClass('z-50');
  });

  it('prevents body scroll when modal is open', () => {
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    // Check that overflow is hidden on body
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when modal closes (unmounts)', () => {
    const { unmount } = render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    unmount();

    // Body overflow should be restored
    expect(document.body.style.overflow).toBe('');
  });

  it('displays selected photo centered in viewport', () => {
    render(
      <PhotoViewer photos={mockPhotos} selectedPhotoId="photo-1" onClose={mockOnClose} />
    );

    const photoImg = screen.getByAltText('Test photo 1');
    expect(photoImg).toBeInTheDocument();
    expect(photoImg).toHaveAttribute('src', 'https://example.com/photo1.jpg');
  });
});
