/**
 * PhotoViewer — focus behaviour
 *
 * PhotoViewer.tsx:62 cites "AC 6.4.12 & WCAG 2.4.3: Focus trap for modal", but
 * nothing exercised it: no test file referenced this component at all. WCAG
 * 2.4.3 is about focus ORDER, and taking focus without returning it leaves a
 * keyboard user on <body> with no position in the gallery behind the viewer.
 *
 * Pinned here so the shared hook these five components depend on can be changed
 * with evidence rather than assumption.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PhotoWithUrls } from '../../../services/photoService';
import { PhotoViewer } from '../PhotoViewer';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    img: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMotionValue: () => ({ get: () => 0, set: () => {}, on: () => () => {} }),
}));

// Every image is cached: the image path itself is usePhotoImage's own subject.
vi.mock('../../../hooks/usePhotoImage', () => ({
  usePhotoImage: (path: string | null | undefined) =>
    path ? { status: 'ready', url: `blob:${path}` } : { status: 'idle', url: null },
}));

const deletePhotoMock = vi.hoisted(() => vi.fn());
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({ deletePhoto: deletePhotoMock }),
}));

const photo = {
  id: 'photo-1',
  storage_path: 'me/photo-1.jpg',
  signedUrl: null,
  isOwn: true,
  caption: 'a photo',
} as unknown as PhotoWithUrls;

function Harness({ open }: { open: boolean }) {
  return (
    <>
      <button data-testid="thumbnail">open photo</button>
      {open && <PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={vi.fn()} />}
    </>
  );
}

describe('PhotoViewer focus', () => {
  it('moves focus into the viewer when it opens', async () => {
    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId('thumbnail').focus();

    rerender(<Harness open />);

    await waitFor(() => {
      const overlay = screen.getByTestId('photo-viewer-overlay');
      expect(overlay.contains(document.activeElement)).toBe(true);
    });
  });

  it('returns focus to the thumbnail that opened it', async () => {
    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId('thumbnail').focus();

    rerender(<Harness open />);
    await waitFor(() => {
      const overlay = screen.getByTestId('photo-viewer-overlay');
      expect(overlay.contains(document.activeElement)).toBe(true);
    });

    rerender(<Harness open={false} />);

    expect(document.activeElement).toBe(screen.getByTestId('thumbnail'));
  });

  it('closes on Escape from inside the viewer', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button data-testid="thumbnail">open photo</button>
        <PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />
      </>
    );

    // Fire from where focus actually is, not from a node picked by the test.
    // useFocusTrap binds keydown to the container, so an event dispatched on the
    // container directly would pass whether or not focus could ever get there.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('suspends arrow-key navigation while the delete confirmation is open', async () => {
    // The dialog names the photo on screen; navigating behind it would leave
    // the dialog asking about a photo the user can no longer see.
    const two = [
      photo,
      { ...photo, id: 'photo-2', caption: 'second photo' } as unknown as PhotoWithUrls,
    ];
    render(<PhotoViewer photos={two} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByText('Delete Photo?')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    // Still on the first photo: the dialog's quoted caption and the image both
    // name photo-1.
    expect(screen.getByAltText('a photo')).toBeInTheDocument();
    expect(screen.queryByAltText('second photo')).not.toBeInTheDocument();
  });

  it('moves focus into the delete confirmation when it opens', async () => {
    // Without this a keyboard user's focus stays on the trash button behind the
    // overlay, and the confirmation's own buttons are not reachable.
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });
  });

  it('Escape dismisses the delete confirmation, not the viewer', async () => {
    // The confirmation renders inside the trap's container -- stacked visually,
    // not in the DOM tree -- so Escape bubbles to useFocusTrap's listener. It
    // must close the dialog and return focus to the trash button, not tear the
    // whole viewer down around an open confirmation.
    const onClose = vi.fn();
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByText('Delete Photo?')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    expect(screen.queryByText('Delete Photo?')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Delete photo'));

    // A second Escape, with the confirmation gone, closes the viewer.
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes on Escape after focus has fallen to <body>', () => {
    // A focused nav button disabling at either end of the gallery, or a focused
    // Retry button unmounting, sends focus to <body> in a real browser. <body>
    // is an ancestor of the container, so the trap's listener never sees the
    // key; the window-level fallback covers exactly that case.
    const onClose = vi.fn();
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />);

    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs onClose exactly once per Escape when focus is inside the container', () => {
    // The window fallback must stand down while the trap's listener can see the
    // key, or one Escape closes twice -- the double-call the fallback's guard
    // exists to prevent.
    const onClose = vi.fn();
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />);

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('deletes exactly one photo on a double-tap of Delete', async () => {
    // A re-entered handleDeleteConfirm would send a second delete while the
    // first is still in flight.
    deletePhotoMock.mockClear();
    let resolveDelete!: (deleted: boolean) => void;
    deletePhotoMock.mockReturnValue(new Promise<boolean>((r) => (resolveDelete = r)));
    const two = [
      photo,
      { ...photo, id: 'photo-2', caption: 'second photo' } as unknown as PhotoWithUrls,
    ];
    render(<PhotoViewer photos={two} selectedPhotoId="photo-2" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    const deleteButton = await screen.findByRole('button', { name: 'Delete' });
    expect(deleteButton.querySelector('.animate-spin')).toBeNull();
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    expect(deletePhotoMock).toHaveBeenCalledTimes(1);
    // The spinner shows while the delete is held pending.
    expect(deleteButton.querySelector('.animate-spin')).not.toBeNull();
    expect(deletePhotoMock).toHaveBeenCalledWith('photo-2');
    // And the second tap had nothing to land on anyway. Cancel stays enabled
    // as the trap's one focusable, but is inert mid-flight -- clicking it (or
    // Escape) must not dismiss the dialog while the request is pending, or the
    // stuck isDeletingRef swallows the next Delete and the pending finally
    // closes whatever confirmation is open by then.
    expect(deleteButton).toBeDisabled();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).not.toBeDisabled();
    fireEvent.click(cancel);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByText('Delete Photo?')).toBeInTheDocument();

    resolveDelete(true);
    await waitFor(() => {
      expect(screen.queryByText('Delete Photo?')).not.toBeInTheDocument();
    });
    deletePhotoMock.mockReset();
  });

  it('keeps focus inside the container after confirming a delete', async () => {
    // The focused Delete button unmounts with the dialog; without the explicit
    // refocus, focus falls to <body> and the trap's Tab cycle dies.
    deletePhotoMock.mockResolvedValue(true);
    const two = [
      photo,
      { ...photo, id: 'photo-2', caption: 'second photo' } as unknown as PhotoWithUrls,
    ];
    render(<PhotoViewer photos={two} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Delete Photo?')).not.toBeInTheDocument();
    });
    const overlay = screen.getByTestId('photo-viewer-overlay');
    expect(overlay.contains(document.activeElement)).toBe(true);
  });

  it('makes the viewer controls inert while the delete confirmation is open', async () => {
    // The confirmation renders inside the trap's container, so without
    // disabled={showDeleteDialog} the Tab cycle reaches the viewer's own
    // buttons under the overlay and Enter operates them -- "Next photo"
    // re-opens the wrong-photo deletion the arrow guard closed, and "Close
    // viewer" unmounts the viewer around the open confirmation. Disabling them
    // also drops them from FOCUSABLE_SELECTOR, confining Tab to Cancel/Delete.
    const two = [
      photo,
      { ...photo, id: 'photo-2', caption: 'second photo' } as unknown as PhotoWithUrls,
    ];
    render(<PhotoViewer photos={two} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByText('Delete Photo?')).toBeInTheDocument();

    expect(screen.getByLabelText('Delete photo')).toBeDisabled();
    expect(screen.getByLabelText('Close viewer')).toBeDisabled();
    expect(screen.getByLabelText('Previous photo')).toBeDisabled();
    expect(screen.getByLabelText('Next photo')).toBeDisabled();

    // Dismissal re-enables them, and the effect-timed restore still lands on
    // the re-enabled trash button rather than no-opping against a disabled one.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Next photo')).not.toBeDisabled();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Delete photo'));
    });
  });

  it('keeps the container reachable by focus, or Escape dies on the first click', () => {
    // Structural, and deliberately so. This viewer has exactly four focusable
    // controls; the photo, the drag surface, the caption bar and the backdrop are
    // all non-focusable, so clicking any of them in a browser blurs to <body>.
    // useFocusTrap listens on the container, <body> is its ancestor, and keydown
    // bubbles upward -- so once focus lands on <body> the listener never sees
    // another key and both Escape and the Tab cycle are dead for the rest of the
    // session. tabindex="-1" makes the container click-focusable, so those clicks
    // land on it instead and the listener keeps receiving events.
    //
    // Asserted as an attribute because the behaviour cannot be reproduced here:
    // happy-dom's focus() does not enforce focusability (it will focus a plain
    // <div>), and it does not implement the browser's click-to-nearest-focusable
    // -ancestor rule at all, so a click-then-Escape test would pass with the
    // attribute removed. The browser-level check belongs in E2E.
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    expect(screen.getByTestId('photo-viewer-overlay')).toHaveAttribute('tabindex', '-1');
  });
});

describe('PhotoViewer failed delete', () => {
  // deletePhoto resolves false on failure (offline, server error) rather than
  // rejecting. The confirmation used to close anyway, leaving the photo on
  // screen with nothing to say the delete had not happened.
  const two = [
    photo,
    { ...photo, id: 'photo-2', caption: 'second photo' } as unknown as PhotoWithUrls,
  ];

  it('keeps the confirmation open with an alert, and focus inside it', async () => {
    deletePhotoMock.mockReset();
    deletePhotoMock.mockResolvedValue(false);
    render(<PhotoViewer photos={two} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    // A real click focuses the button it lands on; fireEvent does not, and
    // would leave the auto-focused Cancel holding focus throughout.
    const deleteButton = await screen.findByRole('button', { name: 'Delete' });
    deleteButton.focus();
    fireEvent.click(deleteButton);

    const alert = await screen.findByTestId('photo-viewer-delete-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Failed to delete photo. Please try again.');
    const dialog = screen.getByRole('dialog', { name: 'Delete Photo?' });
    expect(dialog.contains(alert)).toBe(true);
    expect(screen.getByAltText('a photo')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    deletePhotoMock.mockReset();
  });

  it('closes and clears the error when a retry succeeds', async () => {
    deletePhotoMock.mockReset();
    deletePhotoMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<PhotoViewer photos={two} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByTestId('photo-viewer-delete-error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Delete Photo?')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('photo-viewer-delete-error')).not.toBeInTheDocument();
    expect(deletePhotoMock).toHaveBeenLastCalledWith('photo-1');
    expect(deletePhotoMock).toHaveBeenCalledTimes(2);
    deletePhotoMock.mockReset();
  });

  it('clears the error when the confirmation is dismissed and reopened', async () => {
    deletePhotoMock.mockReset();
    deletePhotoMock.mockResolvedValue(false);
    render(<PhotoViewer photos={two} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Delete photo'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByTestId('photo-viewer-delete-error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete Photo?')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Delete photo'));
    });

    fireEvent.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByText('Delete Photo?')).toBeInTheDocument();
    expect(screen.queryByTestId('photo-viewer-delete-error')).not.toBeInTheDocument();
    deletePhotoMock.mockReset();
  });
});
