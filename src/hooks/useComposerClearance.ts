import { useLayoutEffect, type RefObject } from 'react';

/** The `<html>` custom property UpdateToast reads for its bottom edge. */
export const COMPOSER_CLEARANCE_PROPERTY = '--composer-clearance';

/**
 * Publishes how far the Love Notes composer's top edge sits above the bottom
 * of the screen, as `--composer-clearance` (px) on `<html>`, so the native
 * shell's update toast (UpdateToast) sits above the composer instead of over
 * it. It follows the composer as it grows (a line of text, a picture preview)
 * and as the window or the visual viewport resizes, and is removed when the
 * composer unmounts, which hands the toast back to `--dock-top`.
 */
export function useComposerClearance(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;

    const publish = () => {
      const clearance = Math.max(0, window.innerHeight - element.getBoundingClientRect().top);
      root.style.setProperty(COMPOSER_CLEARANCE_PROPERTY, `${clearance}px`);
    };
    publish();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(element);
    window.addEventListener('resize', publish);
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', publish);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', publish);
      viewport?.removeEventListener('resize', publish);
      root.style.removeProperty(COMPOSER_CLEARANCE_PROPERTY);
    };
  }, [ref]);
}
