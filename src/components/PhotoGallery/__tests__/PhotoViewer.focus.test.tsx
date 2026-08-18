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

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({ deletePhoto: vi.fn() }),
}));

const photo = {
  id: 'photo-1',
  signedUrl: 'https://example.test/a.jpg',
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
    // handleDeleteConfirm resolves its target as photos[currentIndex] at click
    // time, so navigating behind the open dialog would permanently delete a
    // different photo than the one the dialog named.
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
