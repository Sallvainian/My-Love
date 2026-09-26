/**
 * LoveNoteMessage Component Tests
 *
 * Unit tests for the message bubble component with image display.
 * Tests text rendering, image loading states, full-screen viewer, and retry behavior.
 *
 * Love Notes Images: Task 11 - Component tests (AC-7, AC-9)
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dispatch, HTMLAttributes, ReactNode, SetStateAction } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_STORAGE } from '../../../config/images';
import type { LoveNote } from '../../../types/models';
import { formatFullTimestamp } from '../../../utils/dateUtils';
import { LoveNoteMessage } from '../LoveNoteMessage';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

const stateSetterCalls = vi.hoisted(() => vi.fn<(next: unknown) => void>());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    // React 19 silently ignores unmounted updates. Observe the dispatch itself,
    // forwarding to real state and preserving setter identity across renders.
    useState<T,>(initial: T | (() => T)) {
      const [value, setValue] = actual.useState(initial);
      const observedSetter = actual.useCallback<Dispatch<SetStateAction<T>>>((next) => {
        stateSetterCalls(next);
        setValue(next);
      }, [setValue]);
      return [value, observedSetter];
    },
  };
});

interface FullScreenImageViewerMockProps {
  imageUrl: string | null | undefined;
  isOpen: boolean;
  onClose: () => void;
}

// Mock Motion
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

// Mock loveNoteImageService
const mockGetSignedImageUrl = vi.fn();
const mockDownloadLoveNoteImage = vi.fn();
vi.mock('../../../services/loveNoteImageService', () => ({
  getSignedImageUrl: (path: string) => mockGetSignedImageUrl(path),
  downloadLoveNoteImage: (path: string) => mockDownloadLoveNoteImage(path),
}));

// Mock the per-account image cache
const mockReadCachedImage = vi.fn();
const mockWriteCachedImage = vi.fn();
vi.mock('../../../services/imageCache', () => ({
  readCachedImage: (userId: string, path: string) => mockReadCachedImage(userId, path),
  writeCachedImage: (userId: string, path: string, blob: Blob) =>
    mockWriteCachedImage(userId, path, blob),
}));

// The identity the image effect captures. Signed out (null) by default, which
// takes the signed-URL path directly; the image-cache cases sign in.
const storeState = { userId: null as string | null, authSessionVersion: 1 };
const storeListeners = new Set<(state: typeof storeState) => void>();
/** An account switch as the store announces it, before any re-render. */
function switchIdentity(next: Partial<typeof storeState>) {
  Object.assign(storeState, next);
  for (const listener of storeListeners) listener(storeState);
}
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: Object.assign(
    (selector: (state: typeof storeState) => unknown) => selector(storeState),
    {
      subscribe: (listener: (state: typeof storeState) => void) => {
        storeListeners.add(listener);
        return () => storeListeners.delete(listener);
      },
    }
  ),
}));

// Mock FullScreenImageViewer
vi.mock('../FullScreenImageViewer', () => ({
  FullScreenImageViewer: ({ imageUrl, isOpen, onClose }: FullScreenImageViewerMockProps) =>
    isOpen ? (
      <div data-testid="fullscreen-viewer" onClick={onClose}>
        <img src={imageUrl ?? undefined} alt="Fullscreen" />
      </div>
    ) : null,
}));

/** A promise the test settles by hand, at the point it chooses. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('LoveNoteMessage', () => {
  const baseMessage: LoveNote = {
    id: 'msg-1',
    from_user_id: 'user-123',
    to_user_id: 'partner-456',
    content: 'Hello love!',
    created_at: '2024-01-15T10:30:00Z',
  };
  /** baseMessage carrying a stored picture at `path`. */
  const withImage = (
    path = 'user-123/image.jpg',
    overrides: Partial<LoveNote> = {}
  ): LoveNote => ({ ...baseMessage, image_url: path, ...overrides });

  beforeEach(() => {
    vi.clearAllMocks();
    storeState.userId = null;
    storeState.authSessionVersion = 1;
    storeListeners.clear();
    mockReadCachedImage.mockResolvedValue(null);
    mockWriteCachedImage.mockResolvedValue(undefined);
    mockDownloadLoveNoteImage.mockRejectedValue(new Error('Failed to download image'));
    mockGetSignedImageUrl.mockResolvedValue({
      url: 'https://storage.example.com/signed-image.jpg',
      expiresAt: Date.now() + IMAGE_STORAGE.SIGNED_URL_EXPIRY_SECONDS * 1000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Text Message Rendering', () => {
    it('should render message content', () => {
      render(<LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />);

      expect(screen.getByTestId('love-note-text')).toHaveTextContent('Hello love!');
    });

    it('should render sender name and timestamp', () => {
      render(<LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />);

      expect(screen.getByTestId('love-note-caption')).toHaveTextContent(/^You · .+$/);
    });

    it('shows when a late-delivered note was written, not when it arrived', () => {
      const late: LoveNote = {
        ...baseMessage,
        created_at: '2024-01-15T14:00:00.000000+00:00',
        written_at: '2024-01-15T09:00:00.000000+00:00',
      };
      render(<LoveNoteMessage message={late} isOwnMessage={true} senderName="You" />);

      expect(screen.getByTestId('love-note-message')).toHaveAttribute(
        'aria-label',
        `Message from You at ${formatFullTimestamp('2024-01-15T09:00:00.000000+00:00')}`
      );
    });

    it('shows the delivery time when written_at is within a minute of it', () => {
      const prompt: LoveNote = {
        ...baseMessage,
        created_at: '2024-01-15T14:00:00.000000+00:00',
        written_at: '2024-01-15T13:59:30.000000+00:00',
      };
      render(<LoveNoteMessage message={prompt} isOwnMessage={true} senderName="You" />);

      expect(screen.getByTestId('love-note-message')).toHaveAttribute(
        'aria-label',
        `Message from You at ${formatFullTimestamp('2024-01-15T14:00:00.000000+00:00')}`
      );
    });

    it('shows your own note as a filled bubble on the right', () => {
      render(<LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />);

      const messageContainer = screen.getByTestId('love-note-message');
      expect(messageContainer).toHaveClass('items-end');
      expect(screen.queryByTestId('love-note-status')).not.toBeInTheDocument();
      const bubble = screen.getByTestId('love-note-bubble');
      // Own bubble: kit `fill` with white text and the 6px bottom-right tail,
      // no hairline (the fill is the edge).
      expect(bubble).toHaveClass('max-w-[78%]', 'rounded-br-md', 'bg-fill', 'text-white');
      expect(bubble).not.toHaveClass('outline-line');
      expect(bubble).not.toHaveClass('opacity-70');
    });

    it('shows a partner note as an outlined bubble on the left', () => {
      render(<LoveNoteMessage message={baseMessage} isOwnMessage={false} senderName="Partner" />);

      const messageContainer = screen.getByTestId('love-note-message');
      expect(messageContainer).toHaveClass('items-start');
      const bubble = screen.getByTestId('love-note-bubble');
      // Partner bubble: kit `card` with an inset 1px `line` edge and the 6px
      // bottom-left tail.
      expect(bubble).toHaveClass(
        'max-w-[78%]',
        'rounded-bl-md',
        'bg-card',
        'text-ink',
        'outline-1',
        '-outline-offset-1',
        'outline-line'
      );
      expect(bubble).not.toHaveClass('opacity-70');
    });

    it('should sanitize content to prevent XSS', () => {
      const maliciousMessage: LoveNote = {
        ...baseMessage,
        content: '<script>alert("xss")</script>Hello',
      };

      render(<LoveNoteMessage message={maliciousMessage} isOwnMessage={true} senderName="You" />);

      // Script tags should be stripped
      const text = screen.getByTestId('love-note-text');
      expect(text).toHaveTextContent(/^Hello$/);
      expect(text).not.toHaveTextContent('<script>');
    });
  });

  describe('Image Message Rendering', () => {
    it('loads a stored picture by its storage path', async () => {
      const messageWithImage = withImage('user-123/1705315800000-uuid.jpg');

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        expect(mockGetSignedImageUrl).toHaveBeenCalledWith('user-123/1705315800000-uuid.jpg');
      });
    });

    it('should display image after loading signed URL', async () => {
      const messageWithImage = withImage();

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        // Dynamic alt text includes sender name and message content
        const img = screen.getByRole('img', { name: /image from you/i });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://storage.example.com/signed-image.jpg');
      });
    });

    it('should display optimistic preview URL directly', async () => {
      const messageWithPreview: LoveNote = {
        ...baseMessage,
        imagePreviewUrl: 'blob:http://localhost/preview-123',
      };

      render(<LoveNoteMessage message={messageWithPreview} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        const img = screen.getByRole('img', { name: /image from you/i });
        expect(img).toHaveAttribute('src', 'blob:http://localhost/preview-123');
      });

      // Should NOT fetch signed URL when preview is available
      expect(mockGetSignedImageUrl).not.toHaveBeenCalled();
    });

    it('should show loading spinner while fetching image URL', async () => {
      // The signed URL stays pending until the spinner has been seen
      const signedUrl = deferred<{ url: string; expiresAt: number }>();
      mockGetSignedImageUrl.mockReturnValue(signedUrl.promise);

      const messageWithImage = withImage();

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      // Should show the image loading placeholder while the URL is pending
      await waitFor(() => {
        expect(screen.getByTestId('love-note-image-loading')).toBeInTheDocument();
      });

      // Once the URL arrives, the image replaces the spinner
      await act(async () => {
        signedUrl.resolve({ url: 'https://storage.example.com/late.jpg', expiresAt: 0 });
        await signedUrl.promise;
      });
      expect(screen.getByRole('img', { name: /image from you/i })).toHaveAttribute(
        'src',
        'https://storage.example.com/late.jpg'
      );
      expect(screen.queryByTestId('love-note-image-loading')).not.toBeInTheDocument();
    });

    it('should show error state when image fails to load', async () => {
      mockGetSignedImageUrl.mockRejectedValue(new Error('Not found'));

      const messageWithImage = withImage('user-123/missing.jpg');

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        expect(screen.getByTestId('love-note-image-error')).toHaveTextContent(
          'Failed to load image'
        );
      });
    });

    it('shows Uploading... over a picture that is still uploading', () => {
      const uploadingMessage: LoveNote = {
        ...baseMessage,
        imagePreviewUrl: 'blob:preview',
        imageUploading: true,
      };

      render(<LoveNoteMessage message={uploadingMessage} isOwnMessage={true} senderName="You" />);

      expect(screen.getByTestId('love-note-image-uploading')).toHaveTextContent('Uploading...');
    });
  });

  describe('Image cache (offline)', () => {
    const USER = 'user-123';
    const PATH = 'partner-456/1705315800000-uuid.jpg';
    const imageMessage = withImage(PATH);
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    beforeEach(() => {
      storeState.userId = USER;
      createObjectURL = vi.fn(() => 'blob:http://localhost/cached-image');
      revokeObjectURL = vi.fn();
      URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    });

    afterEach(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });

    it('shows a cached image from the cache, with no download or signed URL', async () => {
      const blob = new Blob(['cached']);
      mockReadCachedImage.mockResolvedValue(blob);

      render(<LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from partner/i })).toHaveAttribute(
          'src',
          'blob:http://localhost/cached-image'
        );
      });
      expect(mockReadCachedImage).toHaveBeenCalledWith(USER, PATH);
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(mockDownloadLoveNoteImage).not.toHaveBeenCalled();
      expect(mockGetSignedImageUrl).not.toHaveBeenCalled();
    });

    it('on a miss, downloads by storage path, caches it and shows it', async () => {
      const blob = new Blob(['downloaded']);
      mockDownloadLoveNoteImage.mockResolvedValue(blob);

      render(<LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from partner/i })).toHaveAttribute(
          'src',
          'blob:http://localhost/cached-image'
        );
      });
      expect(mockDownloadLoveNoteImage).toHaveBeenCalledWith(PATH);
      expect(mockWriteCachedImage).toHaveBeenCalledWith(USER, PATH, blob);
      expect(mockGetSignedImageUrl).not.toHaveBeenCalled();
    });

    it('falls back to a signed URL when the download fails, caching nothing', async () => {
      render(<LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from partner/i })).toHaveAttribute(
          'src',
          'https://storage.example.com/signed-image.jpg'
        );
      });
      expect(mockWriteCachedImage).not.toHaveBeenCalled();
    });

    it('offline, an image never seen before shows the image-error placeholder', async () => {
      mockGetSignedImageUrl.mockRejectedValue(new Error('Failed to fetch'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />);

      await waitFor(() => {
        expect(screen.getByTestId('love-note-image-error')).toHaveTextContent(
          'Failed to load image'
        );
      });
      expect(mockWriteCachedImage).not.toHaveBeenCalled();
    });

    it('a failed cache write is logged and the image still shows', async () => {
      mockDownloadLoveNoteImage.mockResolvedValue(new Blob(['downloaded']));
      mockWriteCachedImage.mockRejectedValue(new Error('QuotaExceededError'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from partner/i })).toHaveAttribute(
          'src',
          'blob:http://localhost/cached-image'
        );
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LoveNoteMessage] Failed to cache image:',
        expect.any(Error)
      );
    });

    it("drops a download that resolves after an account switch: nothing cached or shown for A", async () => {
      const download = deferred<Blob>();
      mockDownloadLoveNoteImage.mockReturnValue(download.promise);

      render(<LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />);
      await waitFor(() => expect(mockDownloadLoveNoteImage).toHaveBeenCalled());

      switchIdentity({ userId: 'user-B', authSessionVersion: 2 });
      // Async act drains every continuation of the resolved download
      await act(async () => {
        download.resolve(new Blob(['A-IMAGE']));
        await download.promise;
      });

      expect(mockWriteCachedImage).not.toHaveBeenCalled();
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(mockGetSignedImageUrl).not.toHaveBeenCalled();
    });

    it('drops a cache read that resolves after a sign-out and back in (new session)', async () => {
      const read = deferred<Blob | null>();
      mockReadCachedImage.mockReturnValue(read.promise);

      render(<LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />);
      // The read starts during render, but the loading state commits a task
      // later. Switch only after that commit: a render still pending at the
      // switch reads the new session, re-runs the effect as it, and this mock
      // answers that second read with the same blob, which is then shown.
      await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument());

      switchIdentity({ authSessionVersion: 2 });
      await act(async () => {
        read.resolve(new Blob(['A-IMAGE']));
        await read.promise;
      });

      // One read: only the first session's effect ran, so its drop is what's tested
      expect(mockReadCachedImage).toHaveBeenCalledTimes(1);
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(mockDownloadLoveNoteImage).not.toHaveBeenCalled();
    });

    it('releases the cached picture when the note unmounts', async () => {
      mockReadCachedImage.mockResolvedValue(new Blob(['cached']));

      const { unmount } = render(
        <LoveNoteMessage message={imageMessage} isOwnMessage={false} senderName="Partner" />
      );
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());

      unmount();

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/cached-image');
    });

    it('never reads or writes the cache for an optimistic preview', async () => {
      render(
        <LoveNoteMessage
          message={{ ...baseMessage, imagePreviewUrl: 'blob:http://localhost/preview-1' }}
          isOwnMessage={true}
          senderName="You"
        />
      );
      // The preview is on screen, so the image effect has already run
      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from you/i })).toHaveAttribute(
          'src',
          'blob:http://localhost/preview-1'
        );
      });

      expect(mockReadCachedImage).not.toHaveBeenCalled();
      expect(mockWriteCachedImage).not.toHaveBeenCalled();
    });
  });

  describe('Full Screen Image Viewer', () => {
    it('should open full-screen viewer when image is clicked', async () => {
      const user = userEvent.setup();
      const messageWithImage = withImage();

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from you/i })).toBeInTheDocument();
      });

      // Dynamic aria-label includes "View full size:" prefix
      const imageButton = screen.getByRole('button', { name: /view full size/i });
      await user.click(imageButton);

      expect(screen.getByTestId('fullscreen-viewer')).toBeInTheDocument();
    });

    it('should close full-screen viewer when clicked', async () => {
      const user = userEvent.setup();
      const messageWithImage = withImage();

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from you/i })).toBeInTheDocument();
      });

      // Open viewer
      const imageButton = screen.getByRole('button', { name: /view full size/i });
      await user.click(imageButton);

      expect(screen.getByTestId('fullscreen-viewer')).toBeInTheDocument();

      // Close viewer
      await user.click(screen.getByTestId('fullscreen-viewer'));

      await waitFor(() => {
        expect(screen.queryByTestId('fullscreen-viewer')).not.toBeInTheDocument();
      });
    });

    it('should not open viewer when image has error', async () => {
      mockGetSignedImageUrl.mockRejectedValue(new Error('Not found'));

      const messageWithImage = withImage('user-123/missing.jpg');

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        expect(screen.getByTestId('love-note-image-error')).toHaveTextContent(
          'Failed to load image'
        );
      });

      // No image button should exist when there's an error
      expect(screen.queryByRole('button', { name: /view full size/i })).not.toBeInTheDocument();
    });
  });

  describe('Message Status States', () => {
    it('should show sending indicator', () => {
      const sendingMessage: LoveNote = {
        ...baseMessage,
        sending: true,
      };

      render(<LoveNoteMessage message={sendingMessage} isOwnMessage={true} senderName="You" />);

      const sending = screen.getByTestId('love-note-status');
      expect(sending).toHaveTextContent('Sending...');
      expect(sending).toBeInTheDocument();
      expect(sending).toHaveAttribute('aria-live', 'polite');
      expect(sending).toHaveClass('text-muted');
      const bubble = screen.getByTestId('love-note-bubble');
      expect(bubble).toHaveClass('bg-fill', 'text-white');
      expect(bubble).not.toHaveClass('opacity-70');
    });

    it('should show "Waiting to send" for a queued note that is not sending', () => {
      const queuedMessage: LoveNote = {
        ...baseMessage,
        tempId: 'temp-queued',
        queued: true,
        sending: false,
      };

      render(<LoveNoteMessage message={queuedMessage} isOwnMessage={true} senderName="You" />);

      const waiting = screen.getByTestId('love-note-status');
      expect(waiting).toHaveTextContent('Waiting to send');
      expect(waiting).toHaveAttribute('aria-live', 'polite');
      expect(waiting).toHaveClass('text-muted');
      expect(waiting).not.toHaveTextContent('Sending...');
      expect(screen.queryByRole('button', { name: 'Retry sending message' })).not.toBeInTheDocument();
    });

    it('should show "Sending..." rather than "Waiting to send" while a queued note sends', () => {
      const sendingQueued: LoveNote = { ...baseMessage, tempId: 'temp-q', queued: true, sending: true };

      render(<LoveNoteMessage message={sendingQueued} isOwnMessage={true} senderName="You" />);

      const status = screen.getByTestId('love-note-status');
      expect(status).toHaveTextContent('Sending...');
      expect(status).not.toHaveTextContent('Waiting to send');
    });

    it('should show only Retry for a failed queued note', () => {
      const failedQueued: LoveNote = {
        ...baseMessage,
        tempId: 'temp-q',
        queued: true,
        sending: false,
        error: true,
      };

      render(<LoveNoteMessage message={failedQueued} isOwnMessage={true} senderName="You" />);

      expect(screen.getByRole('button', { name: 'Retry sending message' })).toBeInTheDocument();
      expect(screen.queryByTestId('love-note-status')).not.toBeInTheDocument();
    });

    it('should not show sending indicator when image is uploading', () => {
      const uploadingMessage: LoveNote = {
        ...baseMessage,
        sending: true,
        imageUploading: true,
        imagePreviewUrl: 'blob:preview',
      };

      render(<LoveNoteMessage message={uploadingMessage} isOwnMessage={true} senderName="You" />);

      // Should show "Uploading..." not "Sending..."
      expect(screen.getByTestId('love-note-image-uploading')).toHaveTextContent('Uploading...');
      expect(screen.queryByTestId('love-note-status')).not.toBeInTheDocument();
    });

    it('should show error state with retry button', () => {
      const failedMessage: LoveNote = {
        ...baseMessage,
        tempId: 'temp-123',
        error: true,
      };

      render(<LoveNoteMessage message={failedMessage} isOwnMessage={true} senderName="You" />);

      const retry = screen.getByRole('button', { name: 'Retry sending message' });
      expect(retry).toHaveTextContent(/Failed to send/);
      expect(retry).toBeInTheDocument();
      expect(retry).toHaveClass('text-danger');
      const bubble = screen.getByTestId('love-note-bubble');
      expect(bubble).toHaveClass('outline-2', 'outline-offset-2', 'outline-danger');
    });

    it('retries the failed note by its temp id when Retry is tapped', async () => {
      const user = userEvent.setup();
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
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledWith('temp-123');
    });
  });

  describe('Message with Both Text and Image', () => {
    it('should render both text and image', async () => {
      const messageWithBoth = withImage(undefined, { content: 'Check out this photo!' });

      render(<LoveNoteMessage message={messageWithBoth} isOwnMessage={true} senderName="You" />);

      expect(screen.getByTestId('love-note-text')).toHaveTextContent('Check out this photo!');

      await waitFor(() => {
        // Alt text includes the message caption
        expect(
          screen.getByRole('img', { name: /image from you.*check out this photo/i })
        ).toBeInTheDocument();
      });
    });

    it('should render image-only message without text bubble', async () => {
      const imageOnlyMessage = withImage(undefined, { content: '' });

      render(<LoveNoteMessage message={imageOnlyMessage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        // Image-only messages use generic alt text with sender name
        expect(screen.getByRole('img', { name: /photo shared by you/i })).toBeInTheDocument();
      });

      // No text bubble is rendered for an empty caption
      expect(screen.queryByTestId('love-note-text')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('names the note by its sender and time for screen readers', () => {
      render(<LoveNoteMessage message={baseMessage} isOwnMessage={true} senderName="You" />);

      const messageContainer = screen.getByRole('listitem');
      expect(messageContainer).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Message from You')
      );
    });

    it('should have accessible image button', async () => {
      const messageWithImage = withImage();

      render(<LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />);

      await waitFor(() => {
        // Dynamic aria-label: "View full size: Image from [sender]: [caption]"
        const imageButton = screen.getByRole('button', { name: /view full size/i });
        expect(imageButton).toBeInTheDocument();
      });
    });
  });

  describe('Memory Leak Prevention', () => {
    it('ignores a signed URL that arrives after unmount', async () => {
      // Create a deferred promise we can control
      const signedUrl = deferred<{ url: string; expiresAt: number }>();
      mockGetSignedImageUrl.mockReturnValue(signedUrl.promise);

      // Keep console output quiet; the setter spy is what detects late updates
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messageWithImage = withImage();

      const { unmount } = render(
        <LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />
      );

      // Verify the fetch was initiated
      expect(mockGetSignedImageUrl).toHaveBeenCalledWith('user-123/image.jpg');

      // Unmount BEFORE the promise resolves; only setter calls from here on count
      stateSetterCalls.mockClear();
      unmount();

      // Now resolve the promise after unmount; async act drains every
      // continuation, so a late update would already have been dispatched
      await act(async () => {
        signedUrl.resolve({ url: 'https://storage.example.com/signed.jpg', expiresAt: 0 });
        await signedUrl.promise;
      });

      // React 19 no longer warns about unmounted updates, so observe the
      // setters directly: the late resolve must not dispatch any state
      expect(stateSetterCalls).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('ignores a retried signed URL that arrives after unmount', async () => {
      // First call succeeds to load the image
      mockGetSignedImageUrl.mockResolvedValueOnce({
        url: 'https://storage.example.com/signed.jpg',
        expiresAt: Date.now() + IMAGE_STORAGE.SIGNED_URL_EXPIRY_SECONDS * 1000,
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messageWithImage = withImage();

      const { unmount } = render(
        <LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('img', { name: /image from you/i })).toBeInTheDocument();
      });

      // Set up a deferred promise for the retry attempt
      const retry = deferred<{ url: string; expiresAt: number }>();
      mockGetSignedImageUrl.mockReturnValue(retry.promise);

      // Trigger image error (simulating 403 expired URL)
      const img = screen.getByRole('img', { name: /image from you/i });
      fireEvent.error(img); // raw error: an <img> load failure is a resource event, not a user action

      // The error handler bumps the retry count synchronously; only setter
      // calls after unmount count
      stateSetterCalls.mockClear();

      // Unmount during retry
      unmount();

      // Resolve retry after unmount
      await act(async () => {
        retry.resolve({ url: 'https://storage.example.com/new-signed.jpg', expiresAt: 0 });
        await retry.promise;
      });

      // The late retry result must not dispatch any state
      expect(stateSetterCalls).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('logs but ignores a signed-URL failure that settles after unmount', async () => {
      // Create a deferred rejection
      const signedUrl = deferred<{ url: string; expiresAt: number }>();
      mockGetSignedImageUrl.mockReturnValue(signedUrl.promise);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messageWithImage = withImage();

      const { unmount } = render(
        <LoveNoteMessage message={messageWithImage} isOwnMessage={true} senderName="You" />
      );

      // Unmount before rejection; only setter calls from here on count
      stateSetterCalls.mockClear();
      unmount();

      // Reject after unmount
      await act(async () => {
        signedUrl.reject(new Error('Network error'));
        await signedUrl.promise.catch(() => {});
      });

      // The rejection is logged, and must not dispatch any state
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LoveNoteMessage] Failed to get signed URL:',
        expect.any(Error)
      );
      expect(stateSetterCalls).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
