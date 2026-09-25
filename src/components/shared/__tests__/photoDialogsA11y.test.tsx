/**
 * The photo dialogs, as assistive technology meets them.
 *
 * The upload modal and the viewer's inline delete confirmation were plain divs:
 * no dialog role, no accessible name, and the upload modal took no focus and
 * ignored Escape. Their error lines rendered silently, so a screen-reader user
 * who pressed Upload or Delete heard nothing when it failed. A grid tile's
 * caption showed on hover only, never to a keyboard user tabbing the grid.
 * The empty album's Upload button unmounts when the first photo lands, so the
 * dialog it opened had no opener to return focus to and dropped it on <body>.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type HTMLAttributes, type ImgHTMLAttributes, type ReactNode } from 'react';
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
  const img = (props: ImgHTMLAttributes<HTMLImageElement>) => {
    const { initial: _i, animate: _a, exit: _e, transition: _t, ...rest } = props as Record<
      string,
      unknown
    >;
    return <img {...(rest as ImgHTMLAttributes<HTMLImageElement>)} alt={props.alt ?? ''} />;
  };
  return {
    m: { div, img },
    motion: { div, img },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useMotionValue: () => ({ get: () => 0, set: () => {}, on: () => () => {} }),
  };
});

// Every image is cached: the image path itself is usePhotoImage's own subject.
vi.mock('../../../hooks/usePhotoImage', () => ({
  usePhotoImage: (path: string | null | undefined) =>
    path ? { status: 'ready', url: `blob:${path}` } : { status: 'idle', url: null },
}));

const uploadPhotoMock = vi.hoisted(() => vi.fn());
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({ uploadPhoto: uploadPhotoMock, storageWarning: null, deletePhoto: vi.fn() }),
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

import type { PhotoWithUrls } from '../../../services/photoService';
import { PhotoGridItem } from '../../PhotoGallery/PhotoGridItem';
import { PhotoViewer } from '../../PhotoGallery/PhotoViewer';
import { PhotoUpload } from '../../PhotoUpload/PhotoUpload';

const photo = {
  id: 'photo-1',
  caption: 'Beach day',
  storage_path: 'me/photo-1.jpg',
  signedUrl: null,
  isOwn: true,
  created_at: '2026-08-17T10:00:00.000Z',
} as unknown as PhotoWithUrls;

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

function selectFile() {
  const file = new File(['x'], 'beach.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByTestId('photo-upload-file-input'), { target: { files: [file] } });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('Image', LoadingImage);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  uploadPhotoMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DW-180: the upload modal is a dialog', () => {
  it('is found by role and named by its heading', () => {
    render(<PhotoUpload isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Upload Photo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toBe(screen.getByTestId('photo-upload-modal'));
  });

  it('moves focus into the dialog and returns it to the opener on close', async () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button data-testid="opener">Upload</button>
          <PhotoUpload isOpen={open} onClose={vi.fn()} />
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId('opener').focus();

    rerender(<Harness open />);
    await waitFor(() => {
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(screen.getByTestId('opener'));
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<PhotoUpload isOpen onClose={onClose} />);

    fireEvent.keyDown(screen.getByTestId('photo-upload-close'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cycles Tab inside the dialog', () => {
    render(<PhotoUpload isOpen onClose={vi.fn()} />);
    const close = screen.getByTestId('photo-upload-close');
    const select = screen.getByTestId('photo-upload-select-button');

    select.focus();
    fireEvent.keyDown(select, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(select);
  });

  it('keeps focus on the field being typed in', () => {
    // A fresh onEscape each render would re-arm the trap and throw focus back
    // to the close button on every keystroke.
    render(<PhotoUpload isOpen onClose={vi.fn()} />);
    selectFile();

    const caption = screen.getByTestId('photo-upload-caption-input');
    caption.focus();
    fireEvent.change(caption, { target: { value: 'sunset' } });

    expect(document.activeElement).toBe(caption);
  });

  // A step change unmounts the focused control (Select, Upload, Retry). Focus
  // would fall to <body>, outside the element the trap listens on, and both
  // Escape and the Tab cycle would go dead. Escape is fired on whatever holds
  // focus, as a real keypress would be.
  it('keeps focus inside, and Escape working, once a file is picked', () => {
    const onClose = vi.fn();
    render(<PhotoUpload isOpen onClose={onClose} />);
    const select = screen.getByTestId('photo-upload-select-button');
    select.focus();

    fireEvent.click(select);
    selectFile();

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByTestId('photo-upload-caption-input'));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus inside, and Escape working, after an upload fails', async () => {
    const onClose = vi.fn();
    uploadPhotoMock.mockResolvedValue({ success: false, error: 'Storage is full' });
    render(<PhotoUpload isOpen onClose={onClose} />);
    selectFile();
    const submit = screen.getByTestId('photo-upload-submit-button');
    submit.focus();

    await act(async () => {
      fireEvent.click(submit);
    });
    await screen.findByTestId('photo-upload-retry');

    expect(document.activeElement).toBe(screen.getByTestId('photo-upload-retry'));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus inside after Retry', async () => {
    uploadPhotoMock.mockResolvedValue({ success: false, error: 'Storage is full' });
    render(<PhotoUpload isOpen onClose={vi.fn()} />);
    selectFile();

    await act(async () => {
      fireEvent.click(screen.getByTestId('photo-upload-submit-button'));
    });
    const retry = await screen.findByTestId('photo-upload-retry');
    retry.focus();
    fireEvent.click(retry);

    expect(document.activeElement).toBe(screen.getByTestId('photo-upload-caption-input'));
  });

  it('ignores Escape mid-upload, as the disabled close button does', async () => {
    const onClose = vi.fn();
    uploadPhotoMock.mockReturnValue(new Promise(() => {}));
    render(<PhotoUpload isOpen onClose={onClose} />);
    selectFile();

    fireEvent.click(screen.getByTestId('photo-upload-submit-button'));
    expect(await screen.findByText('This may take a moment')).toBeInTheDocument();
    expect(screen.getByTestId('photo-upload-close')).toBeDisabled();

    fireEvent.keyDown(screen.getByTestId('photo-upload-modal'), { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DW-203: focus return when the opener is gone', () => {
  // App renders the gallery and the upload dialog side by side. The empty
  // state's "Upload a photo" opens the dialog; once the first upload lands the
  // grid replaces the empty state, and its header Upload button is the one
  // that survives.
  function Harness({
    open,
    opener,
    header,
  }: {
    open: boolean;
    opener: boolean;
    header: boolean;
  }) {
    const headerUploadRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        {opener && <button data-testid="empty-upload">Upload a photo</button>}
        {header && (
          <button ref={headerUploadRef} data-testid="header-upload">
            Upload
          </button>
        )}
        <PhotoUpload isOpen={open} onClose={vi.fn()} fallbackFocusRef={headerUploadRef} />
      </>
    );
  }

  async function openFromEmptyState() {
    const view = render(<Harness open={false} opener header={false} />);
    screen.getByTestId('empty-upload').focus();
    view.rerender(<Harness open opener header={false} />);
    await waitFor(() => {
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });
    return view;
  }

  it('lands on the header Upload once the empty-state opener has gone', async () => {
    const { rerender } = await openFromEmptyState();

    rerender(<Harness open opener={false} header />);
    rerender(<Harness open={false} opener={false} header />);

    expect(document.activeElement).toBe(screen.getByTestId('header-upload'));
  });

  it('still returns to an opener that survived', async () => {
    const { rerender } = await openFromEmptyState();

    rerender(<Harness open opener header />);
    rerender(<Harness open={false} opener header />);

    expect(document.activeElement).toBe(screen.getByTestId('empty-upload'));
  });

  it('leaves focus alone when neither is on screen', async () => {
    const { rerender } = await openFromEmptyState();

    rerender(<Harness open opener={false} header={false} />);
    rerender(<Harness open={false} opener={false} header={false} />);

    expect(document.activeElement).toBe(document.body);
  });
});

describe('DW-177: the viewer delete confirmation is a dialog', () => {
  it('is found by role and named by its heading', () => {
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));

    const confirm = screen.getByRole('dialog', { name: 'Delete Photo?' });
    expect(confirm).toHaveAttribute('aria-modal', 'true');
    expect(confirm).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
  });
});

describe('DW-182: photo dialog errors are announced', () => {
  it('the upload tag error', () => {
    render(<PhotoUpload isOpen onClose={vi.fn()} />);
    selectFile();

    fireEvent.change(screen.getByTestId('photo-upload-tags-input'), {
      target: { value: 'a,b,c,d,e,f,g,h,i,j,k' },
    });

    expect(screen.getByRole('alert')).toBe(screen.getByTestId('photo-upload-tag-error'));
  });

  it('the upload failure', async () => {
    uploadPhotoMock.mockResolvedValue({ success: false, error: 'Storage is full' });
    render(<PhotoUpload isOpen onClose={vi.fn()} />);
    selectFile();

    await act(async () => {
      fireEvent.click(screen.getByTestId('photo-upload-submit-button'));
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toBe(screen.getByTestId('photo-upload-error'));
    expect(alert).toHaveTextContent('Storage is full');
  });
});

describe('DW-183: a grid tile shows its caption to keyboard focus', () => {
  it('reveals the caption on focus-visible as well as hover, and rings the tile', () => {
    render(
      <PhotoGridItem
        photo={photo}
        ownInitial="A"
        partnerInitial="B"
        partnerName="Partner"
        onPhotoClick={vi.fn()}
      />
    );

    const tile = screen.getByTestId('photo-grid-item');
    expect(tile).toHaveClass(
      'group',
      'focus:outline-hidden',
      'focus-visible:ring-2',
      'focus-visible:ring-accent'
    );
    expect(screen.getByTestId('photo-grid-item-caption-overlay')).toHaveClass(
      'opacity-0',
      'group-hover:opacity-100',
      'group-focus-visible:opacity-100'
    );
  });
});

describe('DW-206: an outside tap closes the upload modal', () => {
  it('closes on a tap on the overlay, not on one inside the panel', () => {
    const onClose = vi.fn();
    render(<PhotoUpload isOpen onClose={onClose} />);

    fireEvent.click(screen.getByTestId('photo-upload-modal'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('photo-upload-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores an outside tap while the upload is in flight', async () => {
    const onClose = vi.fn();
    uploadPhotoMock.mockReturnValue(new Promise(() => {}));
    render(<PhotoUpload isOpen onClose={onClose} />);
    selectFile();
    await act(async () => {
      fireEvent.click(screen.getByTestId('photo-upload-submit-button'));
    });

    fireEvent.click(screen.getByTestId('photo-upload-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
