/**
 * SettingsBar -- Settings' own bar, which replaces the app header on the top
 * page and every subpage (`SettingsStack` renders one per page).
 *
 * Two looks. `large`: the page's name is a large title below the bar, and the
 * bar is transparent over the page ground until that title's bottom passes
 * under it, then turns to glass with a hairline and the name small and centred
 * (aria-hidden: the large title stays the page's one h1). Small: a single-item
 * page; the bar starts and stays in the collapsed look and its centred title
 * is the page's h1.
 *
 * The bar's in-flow height is fixed (52px large, 64px small, plus the status
 * bar's `safe-top`) and the controls are an absolutely positioned 64px panel
 * over it, so collapsing never moves the title below -- a bar that changed
 * height on collapse would shift the title and flicker at the threshold.
 *
 * The leading action is the back arrow, or a `Cancel` text button on a form
 * page (`leading: 'cancel'`); both run the page's `onBack`.
 *
 * It sits inside `<main>`, so it ends at the side column's edge by inheriting
 * `--dock-left`/`--dock-right`, and its z-30 keeps it under the dock (z-40).
 *
 * @component
 */

import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

interface SettingsBarProps {
  title: string;
  /** Large title below the bar (`true`), or the title centred in the bar (`false`). */
  large: boolean;
  /**
   * The page's h1. Large: the element whose bottom is compared with the bar's.
   * Small: attached to the bar's own h1.
   */
  titleRef: RefObject<HTMLHeadingElement | null>;
  /** The leading action (the back arrow, or Cancel) is shown only when given. */
  onBack?: () => void;
  /** What the leading action looks like: the back arrow (default) or a `Cancel` text button. */
  leading?: 'back' | 'cancel';
  /** The bar's trailing action (Save, Add), when a page has one. */
  trailing?: ReactNode;
  /** Receives the trailing cell, which a page's `SettingsBarAction` portals into. */
  trailingRef?: (node: HTMLDivElement | null) => void;
}

const BAR_TITLE = 'min-w-0 truncate text-center text-[17px] font-semibold text-ink';

export function SettingsBar({
  title,
  large,
  titleRef,
  onBack,
  leading = 'back',
  trailing,
  trailingRef,
}: SettingsBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [titleGone, setTitleGone] = useState(false);
  const collapsed = !large || titleGone;
  // `Cancel` is wider than the 44px arrow, so a Cancel bar widens both side
  // columns equally and the title stays centred.
  const cancel = leading === 'cancel';

  useEffect(() => {
    if (!large) return;
    // Against the 64px controls panel, not the shorter in-flow spacer: the title
    // must not slide under the panel and over the back arrow before the bar collapses.
    // Strict `<`: a title whose bottom is exactly the bar's is still in view.
    const update = () => {
      const bar = barRef.current;
      const heading = titleRef.current;
      if (!bar || !heading) return;
      setTitleGone(heading.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom);
    };
    // A reload can restore a scrolled position before the first scroll event.
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [large, titleRef]);

  return (
    <div
      className="safe-top sticky top-0 z-30"
      data-testid="settings-bar"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className={large ? 'h-13' : 'h-16'} />
      {/* The glass reaches up behind the status bar: the 64px bar plus the inset. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-[calc(4rem+env(safe-area-inset-top))] border-b border-line bg-glass backdrop-blur-lg transition-opacity duration-150 ${
          collapsed ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Measured for the collapse: its bottom is the 64px bar's, where the glass ends. */}
      <div
        ref={barRef}
        className={`absolute inset-x-0 top-[env(safe-area-inset-top)] grid h-16 items-center ${
          cancel ? 'grid-cols-[88px_1fr_88px]' : 'grid-cols-[64px_1fr_64px]'
        }`}
      >
        <div className="flex justify-center">
          {onBack && cancel && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 rounded-full px-2 text-[17px] font-normal text-ink focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="settings-cancel"
            >
              Cancel
            </button>
          )}
          {onBack && !cancel && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              data-testid="settings-back"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </div>
        {large ? (
          <span
            aria-hidden="true"
            className={`${BAR_TITLE} transition-opacity duration-150 ${
              collapsed ? 'opacity-100' : 'opacity-0'
            }`}
            data-testid="settings-bar-title"
          >
            {title}
          </span>
        ) : (
          <h1
            ref={titleRef}
            id="settings-title"
            tabIndex={-1}
            className={`${BAR_TITLE} focus:outline-hidden`}
            data-testid="settings-title"
          >
            {title}
          </h1>
        )}
        <div ref={trailingRef} className="flex justify-center">
          {trailing}
        </div>
      </div>
    </div>
  );
}
