/**
 * PhotoUpload: the success step's 3-second auto-close (DW-205).
 *
 * The timer was a bare setTimeout scheduled from handleUpload and never
 * cleared. Closing by hand and reopening within 3 seconds let it fire into
 * the new session: it closed the dialog and threw away the photo just picked.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type HTMLAttributes, type ReactNode } from 'react';
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

const uploadPhotoMock = vi.hoisted(() => vi.fn());
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({ uploadPhoto: uploadPhotoMock, storageWarning: null }),
}));

vi.mock('../../../services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: () => ({ valid: true }),
    compressImage: vi.fn(async () => ({
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      width: 10,
      height: 10,
    })),
  },
}));

import { PhotoUpload } from '../PhotoUpload';

/** An Image whose load always succeeds, so handleUpload reaches the store. */
class LoadingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 10;
  naturalHeight = 10;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

/** App's wiring: a button opens the dialog and its onClose shuts it. */
function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" data-testid="reopen" onClick={() => setOpen(true)}>
        Upload
      </button>
      <PhotoUpload
        isOpen={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      />
    </>
  );
}

function selectFile() {
  const file = new File(['x'], 'beach.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByTestId('photo-upload-file-input'), { target: { files: [file] } });
}

async function uploadToSuccess() {
  selectFile();
  await act(async () => {
    fireEvent.click(screen.getByTestId('photo-upload-submit-button'));
  });
  // findByText polls on setTimeout, which is faked here; flush promises instead.
  for (let i = 0; i < 10 && !screen.queryByText('Photo uploaded successfully!'); i++) {
    await act(async () => {});
  }
  expect(screen.getByText('Photo uploaded successfully!')).toBeInTheDocument();
}

beforeEach(() => {
  // Only the timers: the upload path resolves through promises and microtasks.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('Image', LoadingImage);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  uploadPhotoMock.mockReset();
  uploadPhotoMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PhotoUpload: auto-close after success (DW-205)', () => {
  it('closes itself 3 seconds after a successful upload', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await uploadToSuccess();

    act(() => vi.advanceTimersByTime(2999));
    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not close a dialog reopened after a manual close', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await uploadToSuccess();

    fireEvent.click(screen.getByTestId('photo-upload-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('reopen'));
    selectFile();
    expect(screen.getByTestId('photo-upload-caption-input')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('photo-upload-caption-input')).toBeInTheDocument();
  });
});
