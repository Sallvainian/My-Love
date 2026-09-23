/**
 * PhotoUpload: a picked file the validator rejects (DW-202).
 *
 * The rejection set `error` but left the dialog on the select step, and the
 * error block rendered only inside the preview/error steps -- so the user saw
 * nothing happen. The input also kept the rejected file as its value, so
 * picking the same file again fired no change event.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => {
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

/**
 * Pick `file` in the hidden input. The value is a spy, as a file input's value
 * cannot be set from script: it reports the picked file and records resets.
 */
function pick(input: HTMLInputElement, file: File, valueWrites: string[]) {
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => `C:\\fakepath\\${file.name}`,
    set: (v: string) => valueWrites.push(v),
  });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PhotoUpload: a rejected file (DW-202)', () => {
  it('says why, clears the input for a re-pick, and clears the error on a valid file', () => {
    render(<PhotoUpload isOpen onClose={vi.fn()} />);
    const input = screen.getByTestId('photo-upload-file-input') as HTMLInputElement;
    const valueWrites: string[] = [];

    validateImageFile.mockReturnValueOnce({ valid: false, error: REJECTION });
    pick(input, new File(['x'], 'scan.gif', { type: 'image/gif' }), valueWrites);

    expect(screen.getByRole('alert')).toHaveTextContent(REJECTION);
    expect(screen.getByTestId('photo-upload-select-button')).toBeInTheDocument();
    expect(valueWrites).toEqual(['']);

    validateImageFile.mockReturnValueOnce({ valid: true });
    pick(input, new File(['x'], 'beach.jpg', { type: 'image/jpeg' }), valueWrites);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('photo-upload-preview-image')).toBeInTheDocument();
  });
});
