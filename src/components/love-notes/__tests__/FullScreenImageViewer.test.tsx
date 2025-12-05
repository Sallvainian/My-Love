/**
 * FullScreenImageViewer Component Tests
 *
 * Unit tests for the full-screen image viewing modal.
 * Tests display, close interactions, keyboard handling, and accessibility.
 *
 * Love Notes Images: Task 11 - Component tests (AC-9)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FullScreenImageViewer } from '../FullScreenImageViewer';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, ...props }: any) => (
      <div onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('FullScreenImageViewer', () => {
  const mockImageUrl = 'https://example.com/image.jpg';
  let originalOverflow: string;

  beforeEach(() => {
    originalOverflow = document.body.style.overflow;
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = originalOverflow;
  });

  it('should render image when isOpen is true', () => {
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />
    );

    const img = screen.getByAltText('Full screen image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockImageUrl);
  });

  it('should not render when isOpen is false', () => {
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={false} onClose={vi.fn()} />
    );

    expect(screen.queryByAltText('Full screen image')).not.toBeInTheDocument();
  });

  it('should not render when imageUrl is null', () => {
    render(<FullScreenImageViewer imageUrl={null} isOpen={true} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should call onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />
    );

    const overlay = screen.getByLabelText('Close image viewer');
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close when image itself is clicked', () => {
    const onClose = vi.fn();
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />
    );

    const img = screen.getByAltText('Full screen image');
    fireEvent.click(img);

    // onClose should NOT be called when clicking the image
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not respond to other keys', () => {
    const onClose = vi.fn();
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Space' });
    fireEvent.keyDown(document, { key: 'ArrowLeft' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should prevent body scroll when open', () => {
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when closed', () => {
    const { rerender } = render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={false} onClose={vi.fn()} />
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('should restore body scroll on unmount', () => {
    const { unmount } = render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('should use custom alt text when provided', () => {
    render(
      <FullScreenImageViewer
        imageUrl={mockImageUrl}
        isOpen={true}
        onClose={vi.fn()}
        alt="Love note image"
      />
    );

    expect(screen.getByAltText('Love note image')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Full screen image viewer');
  });

  it('should remove keydown listener when closed', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />
    );

    // Close the viewer
    rerender(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={false} onClose={onClose} />
    );

    // Escape should not trigger onClose anymore
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
