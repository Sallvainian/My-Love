/**
 * PhotoUpload offline (ticket 11, CAP-4): Upload is refused before the image
 * is compressed or any request goes out, with the reason in the dialog's error
 * block. Retry returns to the preview with the same file.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => {
  const div = ({ children, ...props }: MotionDivProps) => {
    const { initial: _i, animate: _a, exit: _e, transition: _t, ...rest } = props as Record<
      string,
      unknown
    >;
    return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return {
    m: { div },
    motion: { div },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

const uploadPhoto = vi.hoisted(() => vi.fn());
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({ uploadPhoto, storageWarning: null }),
}));

const compressImage = vi.hoisted(() => vi.fn());
vi.mock('../../../services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: () => ({ valid: true }),
    compressImage,
  },
}));

import { PhotoUpload } from '../PhotoUpload';

const OFFLINE = 'You are offline. Photos need a connection to upload.';

function pickPhoto() {
  const input = screen.getByTestId('photo-upload-file-input') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'beach.jpg', { type: 'image/jpeg' })] },
  });
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('PhotoUpload offline', () => {
  it('refuses Upload with the offline reason; nothing is compressed or uploaded', () => {
    render(<PhotoUpload isOpen onClose={vi.fn()} />);
    pickPhoto();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    fireEvent.click(screen.getByTestId('photo-upload-submit-button'));

    expect(screen.getByTestId('photo-upload-error')).toHaveTextContent(OFFLINE);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(compressImage).not.toHaveBeenCalled();
    expect(uploadPhoto).not.toHaveBeenCalled();

    // Retry returns to the preview with the same photo, ready to upload.
    fireEvent.click(screen.getByTestId('photo-upload-retry'));
    expect(screen.queryByTestId('photo-upload-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('photo-upload-preview-image')).toBeInTheDocument();
  });

  it('online, Upload compresses and uploads as before', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    compressImage.mockResolvedValue({ blob: new Blob(['x'], { type: 'image/jpeg' }), width: 1, height: 1 });
    uploadPhoto.mockResolvedValue({ success: true });
    // The component waits for the preview image to load before compressing.
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        naturalWidth = 1;
        naturalHeight = 1;
        set src(_v: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
    try {
      render(<PhotoUpload isOpen onClose={vi.fn()} />);
      pickPhoto();

      fireEvent.click(screen.getByTestId('photo-upload-submit-button'));

      await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(1));
      expect(compressImage).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('photo-upload-error')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
