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
 *   its h1, including a push that mounts the stack (a Home date card, Add). Back: the page returned to drifts in from the left, gets its scroll
 *   position back and focus returns to the row that opened the page we left.
 *   Reduce Motion swaps both slides for a fade. The animations are enter-only:
 *   two pages never share the DOM, so there are no duplicate test ids and no
 *   overlapping sticky bars.
 * - `history.state.inApp` is what separates "back returns one level" from "back
 *   leaves the app": the app marks every entry it creates, and a fresh load
 *   has no state. A page opened by a fresh load goes up by replacing its entry
 *   with the parent's route instead of leaving. An entry pushed from Home (a
 *   date card, Add) also carries `from: 'home'`, which a replace keeps except
 *   to the top page; `navigationSlice` mirrors it as `settingsFromHome`.
 * - The top page has a back arrow only in the bottom dock form (where the
 *   header gear opened it) and only when the app created its entry; the column
 *   form's capsule is a destination, not a place to go back from.
 * - A path with no page, or one the device cannot use, falls back to the top
 *   page and rewrites the URL to match.
 * - "The page above" is the nearest ancestor path that has a page
 *   (`pageAbove`): `dates/event/<id>` goes up to `dates`, because
 *   `dates/event` is not a page. The back arrow's fresh-load replace and the
 *   reload-to-parent below both use it; the focus walk and the slide direction
 *   read the path's own segments.
 * - A page marked `reloadsToParent` (a one-field or form page) is never shown
 *   by a fresh mount of the stack, since its field has nothing to start from
 *   after a reload: the page above is shown instead. An entry the app created goes
 *   up with `history.back()` (replacing it with the parent would leave two
 *   identical entries, and the next back would seem to do nothing); a fresh
 *   load replaces its entry. A push to the page within the mounted stack shows
 *   it as usual, and so does a push that mounts the stack on it (Home's Add):
 *   `settingsPushedPath` says this document pushed it, which a reload never has.
 * - A form page (New event, New anniversary) sets `leading: 'cancel'`: the bar's
 *   leading cell is a `Cancel` text button instead of the arrow, running the
 *   same `goBack`.
 * - It provides `SettingsPageContext`: the back action, the bar's trailing
 *   cell, which a page's `SettingsBarAction` portals Save (or Add) into, and
 *   `arrivedBack`, true when the page was reached by going back to it (the
 *   Dates list keeps its loaded rows then).
 *
 * @component
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSideColumn } from '../../../hooks/useSideColumn';
import { historyDepth, settingsRoute } from '../../../stores/slices/navigationSlice';
import { useAppStore } from '../../../stores/useAppStore';
import { withBasePath } from '../../../utils/basePath';
import { NetworkStatusIndicator } from '../../shared/NetworkStatusIndicator';
import { SettingsBar } from './SettingsBar';
import { SettingsPageContext } from './settingsPageContext';

export interface SettingsPageSpec {
  title: string;
  /** Large title below the bar (list pages) or small title in the bar (single-item pages). */
  titleStyle: 'large' | 'small';
  /** A page the device cannot use answers false and is never shown. */
  available?: () => boolean;
  /**
   * A one-field or form page: a reload (a fresh mount of the stack on this
   * path) shows its parent instead.
   */
  reloadsToParent?: boolean;
  /**
   * The bar's leading action: the back arrow (default) or `Cancel`, a text
   * button for a form page. Both run `goBack`.
   */
  leading?: 'back' | 'cancel';
  render: () => ReactNode;
}

interface SettingsStackProps {
  /** The page for a path relative to `/settings` (`''` is the top page), or null when there is none. */
  resolvePage: (path: string) => SettingsPageSpec | null;
}

type Direction = 'push' | 'pop' | null;

const segments = (path: string) => (path ? path.split('/').length : 0);
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

/** The nearest ancestor of `path` that `resolvePage` answers; the top page (`''`) at the end. */
function pageAbove(path: string, resolvePage: (path: string) => SettingsPageSpec | null): string {
  let ancestor = parentOf(path);
  while (ancestor !== '' && resolvePage(ancestor) === null) ancestor = parentOf(ancestor);
  return ancestor;
}

/**
 * Rewrites the current entry to a Settings route, keeping whether the app
 * created it, its height above the first entry, and whether the flow began
 * on Home. A redirect to the top page
 * drops the second: it is no longer a date flow.
 */
function replaceSettingsRoute(path: string) {
  const inApp = window.history.state?.inApp === true;
  const fromHome = path !== '' && window.history.state?.from === 'home';
  const depth = historyDepth();
  window.history.replaceState(
    {
      view: 'settings',
      settingsPath: path,
      ...(inApp ? { inApp } : {}),
      ...(depth > 0 ? { depth } : {}),
      ...(fromHome ? { from: 'home' } : {}),
    },
    '',
    withBasePath(settingsRoute(path))
  );
}

export function SettingsStack({ resolvePage }: SettingsStackProps) {
  const requested = useAppStore((s) => s.settingsPath);
  const showSettingsPage = useAppStore((s) => s.showSettingsPage);
  const pushedPath = useAppStore((s) => s.settingsPushedPath);
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
  // A push that mounts the stack on a subpage (a Home date card, Home's Add)
  // is a push like any other; a reload, a history restore and the top page
  // opened from the gear or the dock start with none.
  const [trail, setTrail] = useState<{ path: string; direction: Direction }>(() => ({
    path,
    direction: path !== '' && path === requested && pushedPath === requested ? 'push' : null,
  }));
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

  // A reload on a one-field page shows its parent. Once per mount: the ref
  // keeps StrictMode's second run, and every later path change, out of it. A
  // page this document pushed (Home's Add mounts the stack on New event) is not
  // a reload: `pushedPath` is null after one.
  const reloadChecked = useRef(false);
  const reloadsToParent =
    usable && requestedPage.reloadsToParent === true && pushedPath !== requested;
  useLayoutEffect(() => {
    if (reloadChecked.current) return;
    reloadChecked.current = true;
    if (!reloadsToParent) return;
    const parent = pageAbove(requested, resolvePage);
    if (window.history.state?.inApp === true) window.history.back();
    else replaceSettingsRoute(parent);
    showSettingsPage(parent);
  }, [reloadsToParent, requested, resolvePage, showSettingsPage]);

  // The bar's trailing cell, held in state so a page's action portals into it
  // once it exists.
  const [barTrailing, setBarTrailing] = useState<HTMLElement | null>(null);

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
    if (from === path) return;
    if (from === null && direction !== 'push') return;

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
    const parent = pageAbove(path, resolvePage);
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
    // The clip keeps the slide off the page's sides. The view reaches under the
    // side column and pads itself back out of it, so the clip falls at the
    // screen's edge and the bar's glass, which runs under the column as the
    // app header does, is not cut at the column's edge.
    <div
      className="-mr-(--dock-right) -ml-(--dock-left) overflow-x-clip pr-(--dock-right) pl-(--dock-left)"
      data-testid="settings-view"
    >
      <div key={path} ref={pageRef} className={motionClass}>
        <SettingsBar
          title={page.title}
          large={large}
          titleRef={titleRef}
          onBack={onBack}
          leading={page.leading}
          trailingRef={setBarTrailing}
        />
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
          <SettingsPageContext.Provider
            value={{ goBack, barTrailing, arrivedBack: direction === 'pop' }}
          >
            {page.render()}
          </SettingsPageContext.Provider>
        </div>
      </div>
    </div>
  );
}
