/**
 * SettingsStack -- Settings as a stack of pages.
 *
 * Settings stays the one `ViewType`; the open subpage is `settingsPath` in
 * `navigationSlice`, mirrored in the URL under `/settings/` with one history
 * entry per push (`openSettingsPage`). This component resolves that path to a
 * page through `resolvePage`, renders Settings' own bar and the page, and owns
 * everything a page should not repeat: the slide in, the scroll position, the
 * focus move and the back arrow.
 *
 * - Push: the page slides in from the right, scrolls to the top and focuses
 *   its h1. Back: the page returned to drifts in from the left, gets its scroll
 *   position back and focus returns to the row that opened the page we left.
 *   Reduce Motion swaps both slides for a fade. The animations are enter-only:
 *   two pages never share the DOM, so there are no duplicate test ids and no
 *   overlapping sticky bars.
 * - `history.state.inApp` is what separates "back returns one level" from "back
 *   leaves the app": the app marks every entry it creates, and a fresh load
 *   has no state. A page opened by a fresh load goes up by replacing its entry
 *   with the parent's route instead of leaving.
 * - The top page has a back arrow only in the bottom dock form (where the
 *   header gear opened it) and only when the app created its entry; the column
 *   form's capsule is a destination, not a place to go back from.
 * - A path with no page, or one the device cannot use, falls back to the top
 *   page and rewrites the URL to match.
 *
 * @component
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSideColumn } from '../../../hooks/useSideColumn';
import { settingsRoute } from '../../../stores/slices/navigationSlice';
import { useAppStore } from '../../../stores/useAppStore';
import { withBasePath } from '../../../utils/basePath';
import { NetworkStatusIndicator } from '../../shared/NetworkStatusIndicator';
import { SettingsBar } from './SettingsBar';

export interface SettingsPageSpec {
  title: string;
  /** Large title below the bar (list pages) or small title in the bar (single-item pages). */
  titleStyle: 'large' | 'small';
  /** A page the device cannot use answers false and is never shown. */
  available?: () => boolean;
  render: () => ReactNode;
}

interface SettingsStackProps {
  /** The page for a path relative to `/settings` (`''` is the top page), or null when there is none. */
  resolvePage: (path: string) => SettingsPageSpec | null;
}

type Direction = 'push' | 'pop' | null;

const segments = (path: string) => (path ? path.split('/').length : 0);
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

/** Rewrites the current entry to a Settings route, keeping whether the app created it. */
function replaceSettingsRoute(path: string) {
  const inApp = window.history.state?.inApp === true;
  window.history.replaceState(
    { view: 'settings', settingsPath: path, ...(inApp ? { inApp } : {}) },
    '',
    withBasePath(settingsRoute(path))
  );
}

export function SettingsStack({ resolvePage }: SettingsStackProps) {
  const requested = useAppStore((s) => s.settingsPath);
  const showSettingsPage = useAppStore((s) => s.showSettingsPage);
  const column = useSideColumn();

  const requestedPage = resolvePage(requested);
  const usable = requestedPage !== null && requestedPage.available?.() !== false;
  const path = usable ? requested : '';
  const page = usable ? requestedPage : resolvePage('');

  const titleRef = useRef<HTMLHeadingElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  /** The path the DOM shows, set at commit; null before the first one. */
  const shownPath = useRef<string | null>(null);
  const scrollByPath = useRef(new Map<string, number>());

  // Which way the page moved, held until the next change so a re-render for
  // any other reason keeps the same animation class and does not restart it.
  const [trail, setTrail] = useState<{ path: string; direction: Direction }>({
    path,
    direction: null,
  });
  let direction = trail.direction;
  if (trail.path !== path) {
    direction = segments(path) < segments(trail.path) ? 'pop' : 'push';
    setTrail({ path, direction });
  }

  // An unknown or unavailable path: show the top page, and say so in the URL.
  const redirect = requested !== path;
  useLayoutEffect(() => {
    if (!redirect) return;
    replaceSettingsRoute('');
    showSettingsPage('');
  }, [redirect, showSettingsPage]);

  useEffect(() => {
    const record = () => {
      scrollByPath.current.set(shownPath.current ?? '', window.scrollY);
    };
    window.addEventListener('scroll', record, { passive: true });
    return () => window.removeEventListener('scroll', record);
  }, []);

  useLayoutEffect(() => {
    const from = shownPath.current;
    shownPath.current = path;
    if (from === null || from === path) return;

    if (direction === 'pop') {
      window.scrollTo?.(0, scrollByPath.current.get(path) ?? 0);
      // The row that opened the page we left, or the nearest ancestor's row
      // when history jumped back several levels at once.
      const rows = pageRef.current?.querySelectorAll<HTMLElement>('[data-settings-target]') ?? [];
      let target: HTMLElement | undefined;
      for (let left = from; left && left !== path && !target; left = parentOf(left)) {
        target = Array.from(rows).find((row) => row.dataset.settingsTarget === left);
      }
      (target ?? titleRef.current)?.focus({ preventScroll: true });
    } else {
      window.scrollTo?.(0, 0);
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [path, direction]);

  if (!page) return null;

  const inApp = window.history.state?.inApp === true;
  const goBack = () => {
    if (window.history.state?.inApp === true) {
      window.history.back();
      return;
    }
    const parent = parentOf(path);
    replaceSettingsRoute(parent);
    showSettingsPage(parent);
  };
  const onBack = path !== '' || (column === null && inApp) ? goBack : undefined;
  const large = page.titleStyle === 'large';

  const motionClass =
    direction === 'push'
      ? 'animate-settings-push motion-reduce:animate-settings-fade'
      : direction === 'pop'
        ? 'animate-settings-pop motion-reduce:animate-settings-fade'
        : '';

  return (
    <div className="overflow-x-clip" data-testid="settings-view">
      <div key={path} ref={pageRef} className={motionClass}>
        <SettingsBar title={page.title} large={large} titleRef={titleRef} onBack={onBack} />
        {/* The offline banner, under the bar as it sits under the app header on
            every other view: the bar holds the status bar's inset, which the
            banner has none of. */}
        <NetworkStatusIndicator showOnlyWhenOffline />
        <div
          className={`mx-auto flex w-full max-w-200 flex-col gap-4 px-4 pb-6 ${large ? 'pt-1' : 'pt-3'}`}
        >
          {large && (
            <h1
              ref={titleRef}
              id="settings-title"
              tabIndex={-1}
              className="px-1 pt-1 font-serif text-[30px] leading-[1.1] font-semibold text-ink focus:outline-hidden"
              data-testid="settings-title"
            >
              {page.title}
            </h1>
          )}
          {page.render()}
        </div>
      </div>
    </div>
  );
}
