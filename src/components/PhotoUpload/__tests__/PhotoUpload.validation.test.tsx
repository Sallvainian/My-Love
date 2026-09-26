/**
 * PhotoUpload: a picked file the validator rejects (DW-202).
 *
 * The rejection set `error` but left the dialog on the select step, and the
 * error block rendered only inside the preview/error steps -- so the user saw
 * nothing happen. The input also kept the rejected file as its value, so
 * picking the same file again fired no change event.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({ uploadPhoto: vi.fn(), storageWarning: null }),
}));

const validateImageFile = vi.hoisted(() =>
  vi.fn<(file: File) => { valid: boolean; error?: string; warning?: string }>()
);
vi.mock('../../../services/imageCompressionService', () => ({
  imageCompressionService: { validateImageFile, compressImage: vi.fn() },
}));

import { PhotoUpload } from '../PhotoUpload';

const REJECTION = 'Unsupported file type. Please choose a JPEG, PNG or WebP image.';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Pick a GIF the validator rejects, on a freshly opened dialog. */
async function rejectGif() {
  // applyAccept off: the GIF must reach the validator, not be dropped by the
  // input's accept list before any change fires.
  const user = userEvent.setup({ applyAccept: false });
  render(<PhotoUpload isOpen onClose={vi.fn()} />);
  const input = screen.getByTestId('photo-upload-file-input') as HTMLInputElement;
  const gif = new File(['x'], 'scan.gif', { type: 'image/gif' });

  validateImageFile.mockReturnValueOnce({ valid: false, error: REJECTION });
  await user.upload(input, gif);

  return { user, input, gif };
}

describe('PhotoUpload: a rejected file (DW-202)', () => {
  it('says why a picked file was rejected and stays on the select step', async () => {
    await rejectGif();

    expect(screen.getByRole('alert')).toHaveTextContent(REJECTION);
    expect(screen.getByTestId('photo-upload-select-button')).toBeInTheDocument();
  });

  it('clears the input after a rejection so the same file can be re-picked', async () => {
    const { user, input, gif } = await rejectGif();

    // user-event reports the picked file as the input's value until the
    // component resets it.
    expect(input.value).toBe('');
    expect(input.files).toHaveLength(0);

    // So picking the same file again fires a change: user-event, like a
    // browser, fires none while the input still holds that file.
    validateImageFile.mockReturnValueOnce({ valid: false, error: REJECTION });
    await user.upload(input, gif);
    expect(validateImageFile).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent(REJECTION);
  });

  it('clears the error when a valid file is picked after a rejection', async () => {
    const { user, input } = await rejectGif();
    expect(screen.getByRole('alert')).toHaveTextContent(REJECTION);

    validateImageFile.mockReturnValueOnce({ valid: true });
    await user.upload(input, new File(['x'], 'beach.jpg', { type: 'image/jpeg' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('photo-upload-preview-image')).toBeInTheDocument();
  });
});
