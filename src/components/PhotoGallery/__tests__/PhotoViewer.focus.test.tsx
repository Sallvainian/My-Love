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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PhotoWithUrls } from '../../../services/photoService';
import { PhotoViewer } from '../PhotoViewer';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => ({
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

// Each case sets its own answer; resetting here keeps one from leaking into
// the next even when an assertion throws first.
afterEach(() => {
  deletePhotoMock.mockReset();
});

const photo = {
  id: 'photo-1',
  storage_path: 'me/photo-1.jpg',
  signedUrl: null,
  isOwn: true,
  caption: 'a photo',
} as unknown as PhotoWithUrls;

/** The first photo plus a second one, for navigation and delete cases. */
const TWO_PHOTOS = [
  photo,
  { ...photo, id: 'photo-2', caption: 'second photo' } as unknown as PhotoWithUrls,
];

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
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <button data-testid="thumbnail">open photo</button>
        <PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />
      </>
    );

    // Press from where focus actually is, not from a node picked by the test.
    // useFocusTrap binds keydown to the container, so an event dispatched on the
    // container directly would pass whether or not focus could ever get there.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('suspends arrow-key navigation while the delete confirmation is open', async () => {
    // The dialog names the photo on screen; navigating behind it would leave
    // the dialog asking about a photo the user can no longer see.
    const user = userEvent.setup();
    render(<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByRole('dialog', { name: 'Delete Photo?' })).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');

    // Still on the first photo: the dialog's quoted caption and the image both
    // name photo-1.
    expect(screen.getByAltText('a photo')).toBeInTheDocument();
    expect(screen.queryByAltText('second photo')).not.toBeInTheDocument();
  });

  it('moves focus into the delete confirmation when it opens', async () => {
    // Without this a keyboard user's focus stays on the trash button behind the
    // overlay, and the confirmation's own buttons are not reachable.
    const user = userEvent.setup();
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete photo'));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });
  });

  it('Escape dismisses the delete confirmation, not the viewer', async () => {
    // The confirmation renders inside the trap's container -- stacked visually,
    // not in the DOM tree -- so Escape bubbles to useFocusTrap's listener. It
    // must close the dialog and return focus to the trash button, not tear the
    // whole viewer down around an open confirmation.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />);

    await user.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByRole('dialog', { name: 'Delete Photo?' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Delete Photo?' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Delete photo'));

    // A second Escape, with the confirmation gone, closes the viewer.
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes on Escape after focus has fallen to <body>', async () => {
    // A focused nav button disabling at either end of the gallery, or a focused
    // Retry button unmounting, sends focus to <body> in a real browser. <body>
    // is an ancestor of the container, so the trap's listener never sees the
    // key; the window-level fallback covers exactly that case.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />);

    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the viewer only once per Escape press when focus is inside it', async () => {
    // The window fallback must stand down while the trap's listener can see the
    // key, or one Escape closes twice -- the double-call the fallback's guard
    // exists to prevent.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /** Open the delete confirmation for photo-2, with the delete held pending. */
  async function openPendingDelete() {
    deletePhotoMock.mockClear();
    let resolveDelete!: (deleted: boolean) => void;
    deletePhotoMock.mockReturnValue(new Promise<boolean>((r) => (resolveDelete = r)));
    render(<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-2" onClose={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Delete photo'));
    return {
      user,
      deleteButton: await screen.findByRole('button', { name: 'Delete' }),
      resolve: () => resolveDelete(true),
    };
  }

  it('deletes exactly one photo on a double-tap of Delete', async () => {
    // A re-entered handleDeleteConfirm would send a second delete while the
    // first is still in flight.
    const { user, deleteButton, resolve } = await openPendingDelete();
    expect(
      within(deleteButton).queryByTestId('photo-viewer-delete-spinner')
    ).not.toBeInTheDocument();
    await user.dblClick(deleteButton);

    expect(deletePhotoMock).toHaveBeenCalledTimes(1);
    // The spinner shows while the delete is held pending.
    expect(within(deleteButton).getByTestId('photo-viewer-delete-spinner')).toHaveClass(
      'animate-spin'
    );
    expect(deletePhotoMock).toHaveBeenCalledWith('photo-2');
    // And the second tap had nothing to land on anyway.
    expect(deleteButton).toBeDisabled();

    resolve();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete Photo?' })).not.toBeInTheDocument();
    });
  });

  it('keeps the confirmation open when Cancel or Escape is pressed while the delete is pending', async () => {
    const { user, deleteButton, resolve } = await openPendingDelete();
    await user.click(deleteButton);
    expect(deletePhotoMock).toHaveBeenCalledTimes(1);
    expect(deleteButton).toBeDisabled();

    // Cancel stays enabled as the trap's one focusable, but is inert
    // mid-flight -- clicking it (or Escape) must not dismiss the dialog while
    // the request is pending, or the stuck isDeletingRef swallows the next
    // Delete and the pending finally closes whatever confirmation is open by
    // then.
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).not.toBeDisabled();
    await user.click(cancel);
    // Pressed on Cancel, where the click left focus, so the trap's own
    // Escape handler receives it.
    expect(document.activeElement).toBe(cancel);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Delete Photo?' })).toBeInTheDocument();

    resolve();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete Photo?' })).not.toBeInTheDocument();
    });
  });

  it('keeps focus inside the container after confirming a delete', async () => {
    // The focused Delete button unmounts with the dialog; without the explicit
    // refocus, focus falls to <body> and the trap's Tab cycle dies.
    deletePhotoMock.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete photo'));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete Photo?' })).not.toBeInTheDocument();
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
    const user = userEvent.setup();
    render(<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByRole('dialog', { name: 'Delete Photo?' })).toBeInTheDocument();

    expect(screen.getByLabelText('Delete photo')).toBeDisabled();
    expect(screen.getByLabelText('Close viewer')).toBeDisabled();
    expect(screen.getByLabelText('Previous photo')).toBeDisabled();
    expect(screen.getByLabelText('Next photo')).toBeDisabled();

    // Dismissal re-enables them, and the effect-timed restore still lands on
    // the re-enabled trash button rather than no-opping against a disabled one.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
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
  it('keeps the confirmation open with an alert, and focus inside it', async () => {
    deletePhotoMock.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete photo'));
    // The click focuses Delete, so focus leaves the auto-focused Cancel and
    // the refocus below is the error effect's doing.
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

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
  });

  it('closes and clears the error when a retry succeeds', async () => {
    deletePhotoMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const user = userEvent.setup();
    render(<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete photo'));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByTestId('photo-viewer-delete-error')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete Photo?' })).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('photo-viewer-delete-error')).not.toBeInTheDocument();
    expect(deletePhotoMock).toHaveBeenLastCalledWith('photo-1');
    expect(deletePhotoMock).toHaveBeenCalledTimes(2);
  });

  it('clears the error when the confirmation is dismissed and reopened', async () => {
    deletePhotoMock.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-1" onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete photo'));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByTestId('photo-viewer-delete-error')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Delete Photo?' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Delete photo'));
    });

    await user.click(screen.getByLabelText('Delete photo'));
    expect(await screen.findByRole('dialog', { name: 'Delete Photo?' })).toBeInTheDocument();
    expect(screen.queryByTestId('photo-viewer-delete-error')).not.toBeInTheDocument();
  });
});

describe('PhotoViewer offline delete (ticket 11)', () => {
  it('refuses before any request: the dialog stays open with the offline reason', async () => {
    deletePhotoMock.mockResolvedValue(true);
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const user = userEvent.setup();
    try {
      render(<PhotoViewer photos={[photo]} selectedPhotoId="photo-1" onClose={vi.fn()} />);

      await user.click(screen.getByLabelText('Delete photo'));
      await user.click(await screen.findByRole('button', { name: 'Delete' }));

      const alert = await screen.findByTestId('photo-viewer-delete-error');
      expect(alert).toHaveTextContent('You are offline. Photos need a connection to delete.');
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: 'Delete Photo?' })).toBeInTheDocument();
      expect(screen.getByAltText('a photo')).toBeInTheDocument();
      expect(deletePhotoMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    } finally {
      onLine.mockRestore();
    }
  });
});
