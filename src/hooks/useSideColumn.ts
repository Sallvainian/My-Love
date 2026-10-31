/**
 * useSideColumn
 *
 * Which side of the page, if any, holds a screen column the page draws under:
 * the iPhone Duo's 84 pt strip beside the shell's page in folded portrait, both
 * folded landscapes, unfolded landscape and the right pane side by side.
 *
 * Story 7's rule: the column is the one side whose `env(safe-area-inset-*)` is
 * non-zero. Both zero (unfolded portrait, Safari, the Home Screen web app) or
 * both non-zero (a notched iPhone in landscape, 62/62) means no column. A side
 * counts only when it can hold one 44px dock button, so a narrow one-sided
 * cutout band (Android Chrome in landscape, about 24-48px) keeps the bottom
 * dock instead of a capsule narrower than its buttons. Only
 * the insets decide it -- `screen.*` reports the outer display in every pose,
 * and the user agent or `display-mode` say nothing about the pose.
 *
 * CSS cannot branch on an `env()` value, so a hidden fixed probe padded with
 * the side insets is read in JS, and read again on each of three signals,
 * because each pose change fires a different one: an unfold fires a
 * `visualViewport` resize; the side flip between the two folded landscapes
 * fires `screen.orientation` change; swapping side-by-side panes fires only
 * the ResizeObserver. Every signal also re-reads on the next frame.
 *
 * The orientation change can fire before layout applies the flip's new
 * `env()` values, and on the Duo simulator the next frame was sometimes still
 * too early, leaving the capsule on the old side. So the probe holds one child
 * per side, each as wide as its side's padding, and the ResizeObserver watches
 * those too: a side flip keeps the probe's size (84 pt moves from one side to
 * the other) but resizes both children, after layout, whenever it lands.
 */
import { useLayoutEffect, useState } from 'react';

export type SideColumn = 'left' | 'right';

// The capsule's button width (w-11): a side inset narrower than this is no column.
const MIN_COLUMN_INSET = 44;

/** Exactly one side inset wide enough for a dock button is a column; anything else is none. */
export function sideColumnFromInsets(left: number, right: number): SideColumn | null {
  const hasLeft = left >= MIN_COLUMN_INSET;
  const hasRight = right >= MIN_COLUMN_INSET;
  if (hasLeft === hasRight) return null;
  return hasLeft ? 'left' : 'right';
}

// Spans the viewport like the readout story 7 measured with, so its content box
// shrinks when a column appears (the pane swap) and the ResizeObserver hears it.
const PROBE_STYLE =
  'position:fixed;inset:0;box-sizing:border-box;' +
  'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);' +
  'visibility:hidden;pointer-events:none;z-index:-1';

// One per side, as wide as that side's padding: the side flip resizes these.
const SIDE_STYLE = {
  left: 'position:absolute;top:0;left:0;height:0;width:env(safe-area-inset-left)',
  right: 'position:absolute;top:0;right:0;height:0;width:env(safe-area-inset-right)',
} as const;

export function useSideColumn(): SideColumn | null {
  const [column, setColumn] = useState<SideColumn | null>(null);

  // A layout effect, so the first paint already has the right form.
  useLayoutEffect(() => {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-testid', 'side-column-probe');
    probe.setAttribute('style', PROBE_STYLE);
    const sides = (['left', 'right'] as const).map((side) => {
      const child = document.createElement('div');
      child.setAttribute('data-side', side);
      child.setAttribute('style', SIDE_STYLE[side]);
      probe.appendChild(child);
      return child;
    });
    document.body.appendChild(probe);

    const read = () => {
      const style = getComputedStyle(probe);
      setColumn(
        sideColumnFromInsets(parseFloat(style.paddingLeft) || 0, parseFloat(style.paddingRight) || 0)
      );
    };

    const canFrame = typeof window.requestAnimationFrame === 'function';
    let frame = 0;
    const onSignal = () => {
      read();
      if (!canFrame) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(read);
    };

    read();

    // Each signal is guarded on its own: a missing one leaves the others working.
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', onSignal);
    const orientation = typeof screen === 'undefined' ? undefined : screen.orientation;
    orientation?.addEventListener('change', onSignal);
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(onSignal) : undefined;
    observer?.observe(probe);
    for (const side of sides) observer?.observe(side);

    return () => {
      viewport?.removeEventListener('resize', onSignal);
      orientation?.removeEventListener('change', onSignal);
      observer?.disconnect();
      if (canFrame) window.cancelAnimationFrame(frame);
      probe.remove();
    };
  }, []);

  return column;
}
