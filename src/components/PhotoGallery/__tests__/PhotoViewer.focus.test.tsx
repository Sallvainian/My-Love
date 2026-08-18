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

    const overlay = await screen.findByTestId('photo-viewer-overlay');
    fireEvent.keyDown(overlay, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
