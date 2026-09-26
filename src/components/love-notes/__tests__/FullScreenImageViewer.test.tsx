/**
 * FullScreenImageViewer Component Tests
 *
 * Unit tests for the full-screen image viewing modal.
 * Tests display, close interactions, keyboard handling, and accessibility.
 *
 * Love Notes Images: Task 11 - Component tests (AC-9)
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullScreenImageViewer } from '../FullScreenImageViewer';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

// Mock Motion
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, onClick, ...props }: MotionDivProps) => (
      <div onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
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

  it('shows the picture full screen when opened', () => {
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />);

    const img = screen.getByAltText('Full screen image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockImageUrl);
  });

  it('shows nothing while closed', () => {
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByAltText('Full screen image')).not.toBeInTheDocument();
  });

  it('shows no dialog when there is no picture', () => {
    render(<FullScreenImageViewer imageUrl={null} isOpen={true} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />);

    await user.click(screen.getByTestId('fullscreen-image-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close when image itself is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />);

    const img = screen.getByAltText('Full screen image');
    await user.click(img);

    // onClose should NOT be called when clicking the image
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not respond to other keys', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />);

    // The viewer focuses its close button after 100 ms; Enter or Space there
    // would press it. Wait for that, then return focus to <body> so the keys
    // reach only the document listener.
    const closeButton = screen.getByRole('button', { name: /close/i });
    await waitFor(() => expect(closeButton).toHaveFocus());
    closeButton.blur();
    expect(document.body).toHaveFocus();

    await user.keyboard('{Enter}[Space]{ArrowLeft}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should prevent body scroll when open', () => {
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />);

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when closed', () => {
    const { rerender } = render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={false} onClose={vi.fn()} />);

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

  it('is exposed as a modal dialog named "Full screen image viewer"', () => {
    render(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Full screen image viewer');
  });

  it('ignores Escape once it has been closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <FullScreenImageViewer imageUrl={mockImageUrl} isOpen={true} onClose={onClose} />
    );

    // Close the viewer
    rerender(<FullScreenImageViewer imageUrl={mockImageUrl} isOpen={false} onClose={onClose} />);

    // Escape should not trigger onClose anymore
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });
});
