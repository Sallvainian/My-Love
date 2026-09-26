/**
 * ImagePreview Component Tests
 *
 * Unit tests for the image preview component shown before sending.
 * Tests thumbnail display, size info, compression indicator, and remove button.
 *
 * Love Notes Images: Task 11 - Component tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImagePreview } from '../ImagePreview';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

// Mock Motion to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

// Mock image compression service
vi.mock('../../../services/imageCompressionService', () => ({
  imageCompressionService: {
    estimateCompressedSize: vi.fn((file: File) => Math.round(file.size * 0.1)),
  },
}));

describe('ImagePreview', () => {
  let mockObjectUrl: string;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockObjectUrl = 'blob:http://localhost/mock-image-url';
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockObjectUrl);
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should render image thumbnail with preview URL', async () => {
    const mockFile = new File(['test-image-data'], 'photo.jpg', { type: 'image/jpeg' });
    const onRemove = vi.fn();

    render(<ImagePreview file={mockFile} onRemove={onRemove} />);

    await waitFor(() => {
      const img = screen.getByAltText('Selected image preview');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', mockObjectUrl);
    });
  });

  it('should display original file size', () => {
    // Create a file that's ~2MB
    const fileSize = 2 * 1024 * 1024;
    const mockFile = new File([new ArrayBuffer(fileSize)], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(mockFile, 'size', { value: fileSize });

    render(<ImagePreview file={mockFile} onRemove={vi.fn()} />);

    expect(screen.getByTestId('image-preview-original-size')).toHaveTextContent(/^2\.0 MB$/);
  });

  it('should display estimated compressed size', () => {
    // Create a file that's ~5MB
    const fileSize = 5 * 1024 * 1024;
    const mockFile = new File([new ArrayBuffer(fileSize)], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(mockFile, 'size', { value: fileSize });

    render(<ImagePreview file={mockFile} onRemove={vi.fn()} />);

    // Estimated size is 10% of original = 500KB
    expect(screen.getByTestId('image-preview-compressed-size')).toHaveTextContent(/^~512\.0 KB$/);
  });

  it('should show large file indicator for files over 5MB', () => {
    const fileSize = 6 * 1024 * 1024;
    const mockFile = new File([new ArrayBuffer(fileSize)], 'large-photo.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(mockFile, 'size', { value: fileSize });

    render(<ImagePreview file={mockFile} onRemove={vi.fn()} />);

    expect(screen.getByTestId('image-preview-large-file')).toHaveTextContent('(large file)');
  });

  it('should not show large file indicator for files under 5MB', () => {
    const fileSize = 3 * 1024 * 1024;
    const mockFile = new File([new ArrayBuffer(fileSize)], 'small-photo.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(mockFile, 'size', { value: fileSize });

    render(<ImagePreview file={mockFile} onRemove={vi.fn()} />);

    expect(screen.getByTestId('image-preview-original-size')).toHaveTextContent(/^3\.0 MB$/);
    expect(screen.queryByTestId('image-preview-large-file')).not.toBeInTheDocument();
  });

  it('removes the selected picture when Remove is clicked', async () => {
    const user = userEvent.setup();
    const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    const onRemove = vi.fn();

    render(<ImagePreview file={mockFile} onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', { name: /remove selected image/i });
    await user.click(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('should disable remove button when compressing', async () => {
    const user = userEvent.setup();
    const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    const onRemove = vi.fn();

    render(<ImagePreview file={mockFile} onRemove={onRemove} isCompressing={true} />);

    const removeButton = screen.getByRole('button', { name: /remove selected image/i });
    expect(removeButton).toBeDisabled();

    await user.click(removeButton);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows Compressing... over the picture while it compresses', () => {
    const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

    render(<ImagePreview file={mockFile} onRemove={vi.fn()} isCompressing={true} />);

    expect(screen.getByRole('status')).toHaveTextContent('Compressing...');
  });

  it('shows no compressing overlay once compression is done', () => {
    const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

    render(<ImagePreview file={mockFile} onRemove={vi.fn()} isCompressing={false} />);

    expect(screen.getByTestId('image-preview')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('releases the preview image when unmounted', async () => {
    const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

    const { unmount } = render(<ImagePreview file={mockFile} onRemove={vi.fn()} />);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledWith(mockFile);
    });

    unmount();

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockObjectUrl);
  });

  it('shows small sizes in B and larger ones in KB', () => {
    // Test bytes
    const tinyFile = new File(['x'], 'tiny.jpg', { type: 'image/jpeg' });
    Object.defineProperty(tinyFile, 'size', { value: 500 });

    const { rerender } = render(<ImagePreview file={tinyFile} onRemove={vi.fn()} />);
    expect(screen.getByTestId('image-preview-original-size')).toHaveTextContent(/^500 B$/);

    // Test KB
    const kbFile = new File(['x'], 'kb.jpg', { type: 'image/jpeg' });
    Object.defineProperty(kbFile, 'size', { value: 50 * 1024 });

    rerender(<ImagePreview file={kbFile} onRemove={vi.fn()} />);
    expect(screen.getByTestId('image-preview-original-size')).toHaveTextContent(/^50\.0 KB$/);
  });
});
