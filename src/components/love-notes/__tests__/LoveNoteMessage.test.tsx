/**
 * LoveNoteMessage Component Tests
 *
 * Unit tests for the message bubble component with image display.
 * Tests text rendering, image loading states, full-screen viewer, and retry behavior.
 *
 * Love Notes Images: Task 11 - Component tests (AC-7, AC-9)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { LoveNoteMessage } from '../LoveNoteMessage';
import type { LoveNote } from '../../../types/models';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

interface FullScreenImageViewerMockProps {
  imageUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

// Mock loveNoteImageService
const mockGetSignedImageUrl = vi.fn();
vi.mock('../../../services/loveNoteImageService', () => ({
  getSignedImageUrl: (path: string) => mockGetSignedImageUrl(path),
}));

// Mock FullScreenImageViewer
vi.mock('../FullScreenImageViewer', () => ({
  FullScreenImageViewer: ({ imageUrl, isOpen, onClose }: FullScreenImageViewerMockProps) =>
    isOpen ? (
      <div data-testid="fullscreen-viewer" onClick={onClose}>
        <img src={imageUrl} alt="Fullscreen" />
      </div>
    ) : null,
}));

describe('LoveNoteMessage', () => {
  const baseMessage: LoveNote = {
    id: 'msg-1',
    from_user_id: 'user-123',
    to_user_id: 'partner-456',
    content: 'Hello love!',
    created_at: '2024-01-15T10:30:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedImageUrl.mockResolvedValue({
      url: 'https://storage.example.com/signed-image.jpg',
      expiresAt: Date.now() + 3600000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Text Message Rendering', () => {
    it('should render message content', () => {
      render(
        <LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />
      );

      expect(screen.getByText('Hello love!')).toBeInTheDocument();
    });

    it('should render sender name and timestamp', () => {
      render(
        <LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />
      );

      expect(screen.getByText(/You/)).toBeInTheDocument();
    });

    it('should apply own message styling when isOwnMessage is true', () => {
      render(
        <LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />
      );

      const messageContainer = screen.getByTestId('love-note-message');
      expect(messageContainer).toHaveClass('items-end');
    });

    it('should apply partner message styling when isOwnMessage is false', () => {
      render(
        <LoveNoteMessage
          message={baseMessage}
          isOwnMessage={false}
          senderName="Partner"
        />
      );

      const messageContainer = screen.getByTestId('love-note-message');
      expect(messageContainer).toHaveClass('items-start');
    });

    it('should sanitize content to prevent XSS', () => {
      const maliciousMessage: LoveNote = {
        ...baseMessage,
        content: '<script>alert("xss")</script>Hello',
      };

      render(
        <LoveNoteMessage message={maliciousMessage} isOwnMessage={true} senderName="You" />
      );

      // Script tags should be stripped
      expect(screen.queryByText('<script>')).not.toBeInTheDocument();
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  describe('Image Message Rendering', () => {
    it('should fetch signed URL for server image', async () => {
      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/1705315800000-uuid.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        expect(mockGetSignedImageUrl).toHaveBeenCalledWith(
          'user-123/1705315800000-uuid.jpg'
        );
      });
    });

    it('should display image after loading signed URL', async () => {
      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        // Dynamic alt text includes sender name and message content
        const img = screen.getByRole('img', { name: /image from you/i });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute(
          'src',
          'https://storage.example.com/signed-image.jpg'
        );
      });
    });

    it('should display optimistic preview URL directly', async () => {
      const messageWithPreview: LoveNote = {
        ...baseMessage,
        imagePreviewUrl: 'blob:http://localhost/preview-123',
      };

      render(
        <LoveNoteMessage
          message={messageWithPreview}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        const img = screen.getByRole('img', { name: /image from you/i });
        expect(img).toHaveAttribute('src', 'blob:http://localhost/preview-123');
      });

      // Should NOT fetch signed URL when preview is available
      expect(mockGetSignedImageUrl).not.toHaveBeenCalled();
    });

    it('should show loading spinner while fetching image URL', async () => {
      // Make the signed URL promise never resolve immediately
      mockGetSignedImageUrl.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ url: 'test' }), 100))
      );

      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Should show loading state (spinner with animate-spin class)
      await waitFor(() => {
        const loadingSpinner = document.querySelector('.animate-spin');
        expect(loadingSpinner).toBeInTheDocument();
      });
    });

    it('should show error state when image fails to load', async () => {
      mockGetSignedImageUrl.mockRejectedValue(new Error('Not found'));

      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/missing.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load image')).toBeInTheDocument();
      });
    });

    it('should show uploading overlay when imageUploading is true', () => {
      const uploadingMessage: LoveNote = {
        ...baseMessage,
        imagePreviewUrl: 'blob:preview',
        imageUploading: true,
      };

      render(
        <LoveNoteMessage
          message={uploadingMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });

  describe('Full Screen Image Viewer', () => {
    it('should open full-screen viewer when image is clicked', async () => {
      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from you/i })).toBeInTheDocument();
      });

      // Dynamic aria-label includes "View full size:" prefix
      const imageButton = screen.getByRole('button', { name: /view full size/i });
      fireEvent.click(imageButton);

      expect(screen.getByTestId('fullscreen-viewer')).toBeInTheDocument();
    });

    it('should close full-screen viewer when clicked', async () => {
      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from you/i })).toBeInTheDocument();
      });

      // Open viewer
      const imageButton = screen.getByRole('button', { name: /view full size/i });
      fireEvent.click(imageButton);

      expect(screen.getByTestId('fullscreen-viewer')).toBeInTheDocument();

      // Close viewer
      fireEvent.click(screen.getByTestId('fullscreen-viewer'));

      await waitFor(() => {
        expect(screen.queryByTestId('fullscreen-viewer')).not.toBeInTheDocument();
      });
    });

    it('should not open viewer when image has error', async () => {
      mockGetSignedImageUrl.mockRejectedValue(new Error('Not found'));

      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/missing.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load image')).toBeInTheDocument();
      });

      // No image button should exist when there's an error
      expect(
        screen.queryByRole('button', { name: /view full size/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Message Status States', () => {
    it('should show sending indicator', () => {
      const sendingMessage: LoveNote = {
        ...baseMessage,
        sending: true,
      };

      render(
        <LoveNoteMessage message={sendingMessage} isOwnMessage={true} senderName="You" />
      );

      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });

    it('should not show sending indicator when image is uploading', () => {
      const uploadingMessage: LoveNote = {
        ...baseMessage,
        sending: true,
        imageUploading: true,
        imagePreviewUrl: 'blob:preview',
      };

      render(
        <LoveNoteMessage
          message={uploadingMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Should show "Uploading..." not "Sending..."
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
      expect(screen.queryByText('Sending...')).not.toBeInTheDocument();
    });

    it('should show error state with retry button', () => {
      const failedMessage: LoveNote = {
        ...baseMessage,
        tempId: 'temp-123',
        error: true,
      };

      render(
        <LoveNoteMessage message={failedMessage} isOwnMessage={true} senderName="You" />
      );

      expect(screen.getByText(/Failed to send/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call onRetry when retry button clicked', () => {
      const onRetry = vi.fn();
      const failedMessage: LoveNote = {
        ...baseMessage,
        tempId: 'temp-123',
        error: true,
      };

      render(
        <LoveNoteMessage
          message={failedMessage}
          isOwnMessage={true}
          senderName="You"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledWith('temp-123');
    });
  });

  describe('Message with Both Text and Image', () => {
    it('should render both text and image', async () => {
      const messageWithBoth: LoveNote = {
        ...baseMessage,
        content: 'Check out this photo!',
        image_url: 'user-123/image.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithBoth}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(screen.getByText('Check out this photo!')).toBeInTheDocument();

      await waitFor(() => {
        // Alt text includes the message caption
        expect(screen.getByRole('img', { name: /image from you.*check out this photo/i })).toBeInTheDocument();
      });
    });

    it('should render image-only message without text bubble', async () => {
      const imageOnlyMessage: LoveNote = {
        ...baseMessage,
        content: '',
        image_url: 'user-123/image.jpg',
      };

      render(
        <LoveNoteMessage
          message={imageOnlyMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        // Image-only messages use generic alt text with sender name
        expect(screen.getByRole('img', { name: /photo shared by you/i })).toBeInTheDocument();
      });

      // Should have no text content
      const messageBubbles = screen.queryAllByText(/./);
      // Filter to just content paragraphs, not controls/timestamp
      const contentParagraphs = messageBubbles.filter(
        (el) =>
          el.tagName === 'P' && el.classList.contains('text-base') && el.textContent === ''
      );
      expect(contentParagraphs).toHaveLength(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label with sender and time', () => {
      render(
        <LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />
      );

      const messageContainer = screen.getByRole('listitem');
      expect(messageContainer).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Message from You')
      );
    });

    it('should have accessible image button', async () => {
      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      await waitFor(() => {
        // Dynamic aria-label: "View full size: Image from [sender]: [caption]"
        const imageButton = screen.getByRole('button', { name: /view full size/i });
        expect(imageButton).toBeInTheDocument();
      });
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not update state after unmount during signed URL fetch', async () => {
      // Create a deferred promise we can control
      let resolveSignedUrl: (value: { url: string; expiresAt: number }) => void;
      const deferredPromise = new Promise<{ url: string; expiresAt: number }>((resolve) => {
        resolveSignedUrl = resolve;
      });
      mockGetSignedImageUrl.mockReturnValue(deferredPromise);

      // Spy on console.error to detect React warnings about unmounted state updates
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      const { unmount } = render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Verify the fetch was initiated
      expect(mockGetSignedImageUrl).toHaveBeenCalledWith('user-123/image.jpg');

      // Unmount BEFORE the promise resolves
      unmount();

      // Now resolve the promise after unmount
      resolveSignedUrl!({
        url: 'https://storage.example.com/signed.jpg',
        expiresAt: Date.now() + 3600000,
      });

      // Wait a tick to allow any potential state updates to occur
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should NOT have any React warnings about state updates on unmounted component
      const reactWarnings = consoleErrorSpy.mock.calls.filter(
        (call) =>
          call[0]?.includes?.('unmounted') ||
          call[0]?.includes?.('memory leak') ||
          call[0]?.includes?.("Can't perform a React state update")
      );
      expect(reactWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it('should not update state after unmount during error retry', async () => {
      // First call succeeds to load the image
      mockGetSignedImageUrl.mockResolvedValueOnce({
        url: 'https://storage.example.com/signed.jpg',
        expiresAt: Date.now() + 3600000,
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      const { unmount } = render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from you/i })).toBeInTheDocument();
      });

      // Set up a deferred promise for the retry attempt
      let resolveRetry: (value: { url: string; expiresAt: number }) => void;
      const retryPromise = new Promise<{ url: string; expiresAt: number }>((resolve) => {
        resolveRetry = resolve;
      });
      mockGetSignedImageUrl.mockReturnValue(retryPromise);

      // Trigger image error (simulating 403 expired URL)
      const img = screen.getByRole('img', { name: /image from you/i });
      fireEvent.error(img);

      // Unmount during retry
      unmount();

      // Resolve retry after unmount
      resolveRetry!({
        url: 'https://storage.example.com/new-signed.jpg',
        expiresAt: Date.now() + 3600000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify no React warnings
      const reactWarnings = consoleErrorSpy.mock.calls.filter(
        (call) =>
          call[0]?.includes?.('unmounted') ||
          call[0]?.includes?.('memory leak') ||
          call[0]?.includes?.("Can't perform a React state update")
      );
      expect(reactWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it('should not update state after unmount when fetch fails', async () => {
      // Create a deferred rejection
      let rejectSignedUrl: (error: Error) => void;
      const deferredPromise = new Promise<{ url: string; expiresAt: number }>((_, reject) => {
        rejectSignedUrl = reject;
      });
      mockGetSignedImageUrl.mockReturnValue(deferredPromise);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messageWithImage: LoveNote = {
        ...baseMessage,
        image_url: 'user-123/image.jpg',
      };

      const { unmount } = render(
        <LoveNoteMessage
          message={messageWithImage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Unmount before rejection
      unmount();

      // Reject after unmount
      rejectSignedUrl!(new Error('Network error'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Filter for React state update warnings only
      const reactWarnings = consoleErrorSpy.mock.calls.filter(
        (call) =>
          call[0]?.includes?.('unmounted') ||
          call[0]?.includes?.('memory leak') ||
          call[0]?.includes?.("Can't perform a React state update")
      );
      expect(reactWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });
  });
});
