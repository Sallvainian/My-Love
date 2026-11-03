/**
 * SettingsStack: the page stack every Settings page is built on -- its bar,
 * one history entry per push, reload, back, slide and focus. Driven with small
 * stand-in pages and the real store; a popstate listener plays App's part
 * (history restores call `showSettingsPage`).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SideColumn } from '../../../hooks/useSideColumn';
import {
  settingsPathFromRoute,
} from '../../../stores/slices/navigationSlice';
import { useAppStore } from '../../../stores/useAppStore';
import { SettingsBarAction } from '../stack/SettingsBarAction';
import { useSettingsPage } from '../stack/settingsPageContext';
import { SettingsRow } from '../stack/SettingsRows';
import { onPopState } from './settingsStackKit';
import { SettingsStack, type SettingsPageSpec } from '../stack/SettingsStack';

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const sideColumn = vi.hoisted(() => ({ current: null as SideColumn | null }));
vi.mock('../../../hooks/useSideColumn', () => ({
  useSideColumn: () => sideColumn.current,
}));

const available = vi.hoisted(() => ({ photos: true }));

/** A stand-in one-field page: its Save sits in the bar and returns one level. */
function EditPage() {
  const { goBack } = useSettingsPage();
  return (
    <>
      <SettingsBarAction>
        <button type="button" onClick={goBack} data-testid="bar-save">
          Save
        </button>
      </SettingsBarAction>
      <p data-testid="edit-body">Edit body</p>
    </>
  );
}

const PAGES: Record<string, SettingsPageSpec> = {
  '': {
    title: 'Settings',
    titleStyle: 'large',
    render: () => (
      <>
        <SettingsRow label="Photos" value="Wi-Fi only" target="photos" testId="row-photos" />
        <SettingsRow label="Name" target="name" testId="row-name" />
      </>
    ),
  },
  photos: {
    title: 'Photos',
    titleStyle: 'large',
    available: () => available.photos,
    render: () => (
      <>
        <p data-testid="photos-body">Photos body</p>
        <SettingsRow label="Deeper" target="photos/deeper" testId="row-deeper" />
        <SettingsRow label="Edit" target="photos/edit" testId="row-edit" />
      </>
    ),
  },
  'photos/edit': {
    title: 'Edit',
    titleStyle: 'small',
    reloadsToParent: true,
    render: () => <EditPage />,
  },
  'photos/deeper': {
    title: 'Deeper',
    titleStyle: 'large',
    render: () => <p data-testid="deeper-body">Deeper body</p>,
  },
  name: {
    title: 'Name',
    titleStyle: 'small',
    render: () => <p data-testid="name-body">Name body</p>,
  },
  // `items/thing` is deliberately no page, like `dates/event`: a path with an id under it.
  items: {
    title: 'Items',
    titleStyle: 'large',
    render: () => <p data-testid="items-body">Items body</p>,
  },
  'items/thing/1': {
    title: 'Thing',
    titleStyle: 'small',
    render: () => <p data-testid="thing-body">Thing body</p>,
  },
  'items/thing/1/edit': {
    title: 'Edit',
    titleStyle: 'small',
    reloadsToParent: true,
    render: () => <EditPage />,
  },
  'items/thing/2/edit': {
    title: 'Edit',
    titleStyle: 'small',
    reloadsToParent: true,
    render: () => <EditPage />,
  },
};

const resolvePage = (path: string) => PAGES[path] ?? null;

function renderStack() {
  return render(<SettingsStack resolvePage={resolvePage} />);
}

/** The entry as the app creates it: a gear tap on the bottom dock. */
function openedInApp() {
  window.history.replaceState(null, '', '/');
  useAppStore.getState().setView('settings');
}

/** The entry as a fresh load at a URL creates it: no history state. */
function freshLoadAt(route: string) {
  window.history.replaceState(null, '', route);
  act(() => useAppStore.getState().setView('settings', true));
  act(() => useAppStore.getState().showSettingsPage(settingsPathFromRoute(route)));
}

describe('SettingsStack', () => {
  beforeEach(() => {
    sideColumn.current = null;
    available.photos = true;
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'settings', settingsPath: '', settingsFromHome: false, settingsPushedPath: null });
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    // A test may stub `scrollY`; deleting it here keeps a failing test from leaking it.
    Reflect.deleteProperty(window, 'scrollY');
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'home', settingsPath: '', settingsFromHome: false, settingsPushedPath: null });
  });

  describe('push', () => {
    it('opens a row\'s page as one new history entry at its URL, focusing the page\'s h1', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();
      const before = window.history.length;

      await user.click(screen.getByTestId('row-photos'));

      expect(window.history.length).toBe(before + 1);
      expect(window.location.pathname).toBe('/settings/photos');
      expect(screen.getByTestId('photos-body')).toBeInTheDocument();
      const h1 = screen.getByRole('heading', { level: 1, name: 'Photos' });
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(h1).toHaveFocus();
    });

    it('slides the new page in from the right, and fades instead under Reduce Motion', async () => {
      const user = userEvent.setup();
      openedInApp();
      const { container } = renderStack();
      // The first mount does not animate.
      expect(container.querySelector('.animate-settings-push')).toBeNull();

      await user.click(screen.getByTestId('row-photos'));

      const page = container.querySelector('.animate-settings-push');
      expect(page).not.toBeNull();
      expect(page).toHaveClass('motion-reduce:animate-settings-fade');
      expect(page).toContainElement(screen.getByTestId('photos-body'));
    });

    it('scrolls to the top on a push', async () => {
      const user = userEvent.setup();
      openedInApp();
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      renderStack();

      await user.click(screen.getByTestId('row-photos'));

      expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    });

    it('keeps one page in the DOM at a time', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();

      await user.click(screen.getByTestId('row-photos'));

      expect(screen.queryByTestId('row-name')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('settings-bar')).toHaveLength(1);
      expect(screen.getAllByTestId('settings-view')).toHaveLength(1);
    });
  });

  describe('back', () => {
    it('returns one level with the back arrow, putting focus on the row that opened the page', async () => {
      const user = userEvent.setup();
      openedInApp();
      const { container } = renderStack();
      await user.click(screen.getByTestId('row-photos'));
      const before = window.history.length;

      await user.click(screen.getByRole('button', { name: 'Back' }));

      await vi.waitFor(() => expect(window.location.pathname).toBe('/settings'));
      expect(window.history.length).toBe(before);
      expect(screen.queryByTestId('photos-body')).not.toBeInTheDocument();
      const row = screen.getByRole('button', { name: 'Photos, Wi-Fi only' });
      expect(row).toHaveFocus();
      expect(container.querySelector('.animate-settings-pop')).not.toBeNull();
    });

    it('returns one level with the browser\'s back, the same way', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();
      await user.click(screen.getByTestId('row-photos'));

      act(() => window.history.back());

      await vi.waitFor(() => expect(screen.queryByTestId('photos-body')).not.toBeInTheDocument());
      expect(window.location.pathname).toBe('/settings');
      expect(screen.getByTestId('row-photos')).toHaveFocus();
    });

    it('restores the scroll position the page was left at', async () => {
      const user = userEvent.setup();
      openedInApp();
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      renderStack();
      Object.defineProperty(window, 'scrollY', { value: 340, configurable: true });
      fireEvent.scroll(window);
      await user.click(screen.getByTestId('row-photos'));
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      fireEvent.scroll(window);

      await user.click(screen.getByRole('button', { name: 'Back' }));

      await vi.waitFor(() => expect(screen.getByTestId('row-photos')).toBeInTheDocument());
      expect(scrollTo).toHaveBeenLastCalledWith(0, 340);
    });

    it('focuses the nearest ancestor\'s row when history jumps back several levels', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();
      await user.click(screen.getByTestId('row-photos'));
      await user.click(screen.getByTestId('row-deeper'));
      expect(screen.getByTestId('deeper-body')).toBeInTheDocument();

      act(() => window.history.go(-2));

      await vi.waitFor(() => expect(screen.getByTestId('row-photos')).toBeInTheDocument());
      expect(screen.getByTestId('row-photos')).toHaveFocus();
    });
  });

  describe('first entry', () => {
    it('replaces /settings/photos with /settings instead of leaving the app, then shows no arrow', async () => {
      const user = userEvent.setup();
      freshLoadAt('/settings/photos');
      renderStack();
      expect(window.history.state).toBeNull();
      const before = window.history.length;
      const back = vi.spyOn(window.history, 'back');

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(back).not.toHaveBeenCalled();
      expect(window.history.length).toBe(before);
      expect(window.location.pathname).toBe('/settings');
      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
      expect(window.history.state.inApp).toBeUndefined();
    });

    it('keeps the entry\'s app mark when the arrow is used on a page reloaded after an in-app push', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();
      await user.click(screen.getByTestId('row-photos'));
      cleanup();
      // A reload: the entry (and its state) survives, the store starts afresh.
      act(() => useAppStore.getState().showSettingsPage('photos'));
      renderStack();
      const back = vi.spyOn(window.history, 'back');

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(back).toHaveBeenCalledTimes(1);
    });
  });

  describe('an entry from Home', () => {
    /** An entry as a Home flow leaves it, reloaded: the state survives, the store starts afresh. */
    function reloadedFromHome(path: string, extra: Record<string, unknown> = {}) {
      window.history.replaceState(
        { view: 'settings', settingsPath: path, inApp: true, from: 'home', ...extra },
        '',
        `/settings/${path}`
      );
      act(() => useAppStore.getState().setView('settings', true));
      act(() => useAppStore.getState().showSettingsPage(path));
    }

    it('keeps the mark when a reload-to-parent page replaces its entry with the parent', () => {
      reloadedFromHome('photos/edit', { inApp: undefined });

      renderStack();

      expect(window.location.pathname).toBe('/settings/photos');
      expect(window.history.state).toMatchObject({ settingsPath: 'photos', from: 'home' });
      expect(useAppStore.getState().settingsFromHome).toBe(true);
    });

    it('keeps the mark when the back arrow replaces the entry with its parent', async () => {
      const user = userEvent.setup();
      reloadedFromHome('photos/deeper', { inApp: undefined });
      renderStack();

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(window.location.pathname).toBe('/settings/photos');
      expect(window.history.state).toEqual({ view: 'settings', settingsPath: 'photos', from: 'home' });
      expect(useAppStore.getState().settingsFromHome).toBe(true);
    });

    it('drops the mark when the back arrow replaces the entry with the top page', async () => {
      const user = userEvent.setup();
      reloadedFromHome('photos', { inApp: undefined });
      renderStack();

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(window.location.pathname).toBe('/settings');
      expect(window.history.state).toEqual({ view: 'settings', settingsPath: '' });
      expect(useAppStore.getState().settingsFromHome).toBe(false);
    });

    it('drops the mark, and keeps the app mark, on a redirect to the top page', () => {
      reloadedFromHome('xyz');

      renderStack();

      expect(window.location.pathname).toBe('/settings');
      expect(window.history.state).toEqual({ view: 'settings', settingsPath: '', inApp: true });
      expect(useAppStore.getState().settingsFromHome).toBe(false);
    });

    it('goes back with history.back() on an app-created entry, leaving the Home mark to the entry it lands on', async () => {
      const user = userEvent.setup();
      reloadedFromHome('photos');
      renderStack();
      const back = vi.spyOn(window.history, 'back');

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(back).toHaveBeenCalledTimes(1);
    });
  });

  describe('a form page pushed while the stack is not mounted (Home\'s Add)', () => {
    it('shows the page instead of treating the first mount as a reload', () => {
      window.history.replaceState(null, '', '/');
      act(() => useAppStore.getState().openSettingsPage('photos/edit', { fromHome: true }));
      const back = vi.spyOn(window.history, 'back');

      renderStack();

      expect(back).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/photos/edit');
      expect(screen.getByTestId('edit-body')).toBeInTheDocument();
    });

    it('still goes back one level after a reload, which leaves nothing pushed', () => {
      window.history.replaceState(
        { view: 'settings', settingsPath: 'photos/edit', inApp: true, from: 'home' },
        '',
        '/settings/photos/edit'
      );
      act(() => useAppStore.getState().setView('settings', true));
      act(() => useAppStore.getState().showSettingsPage('photos/edit'));
      const back = vi.spyOn(window.history, 'back');

      renderStack();

      expect(back).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('edit-body')).not.toBeInTheDocument();
    });
  });

  describe('the page above a path with no page of its own parent', () => {
    it('is the nearest ancestor that has a page: a fresh load\'s back arrow skips the missing one', async () => {
      const user = userEvent.setup();
      freshLoadAt('/settings/items/thing/1');
      renderStack();
      expect(screen.getByTestId('thing-body')).toBeInTheDocument();
      const back = vi.spyOn(window.history, 'back');

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(back).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/items');
      expect(screen.getByRole('heading', { level: 1, name: 'Items' })).toBeInTheDocument();
    });

    it('is the direct parent when it has a page: a reload-to-parent page shows it', () => {
      freshLoadAt('/settings/items/thing/1/edit');

      renderStack();

      expect(window.location.pathname).toBe('/settings/items/thing/1');
      expect(screen.getByTestId('thing-body')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-body')).not.toBeInTheDocument();
    });

    it('is the nearest ancestor on a reload-to-parent page whose parent has no page', () => {
      freshLoadAt('/settings/items/thing/2/edit');

      renderStack();

      expect(window.location.pathname).toBe('/settings/items');
      expect(screen.getByTestId('items-body')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-body')).not.toBeInTheDocument();
    });
  });

  describe('reload', () => {
    it('renders the page the URL names, without animating or moving focus', () => {
      freshLoadAt('/settings/photos');
      const { container } = renderStack();

      expect(screen.getByTestId('photos-body')).toBeInTheDocument();
      expect(container.querySelector('[class*="animate-settings"]')).toBeNull();
      expect(document.body).toHaveFocus();
    });
  });

  describe('a page that reloads to its parent', () => {
    it('shows the parent and goes back once when an entry the app created is reloaded', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();
      await user.click(screen.getByTestId('row-photos'));
      await user.click(screen.getByTestId('row-edit'));
      cleanup();
      // A reload: the entry (and its state) survives, the store starts afresh.
      act(() => useAppStore.getState().showSettingsPage('photos/edit'));
      const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

      renderStack();

      expect(back).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('photos-body')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-body')).not.toBeInTheDocument();
      expect(useAppStore.getState().settingsPath).toBe('photos');
    });

    it('replaces the URL with the parent\'s on a fresh load, without leaving the app', async () => {
      const user = userEvent.setup();
      freshLoadAt('/settings/photos/edit');
      const back = vi.spyOn(window.history, 'back');
      const before = window.history.length;

      renderStack();

      expect(back).not.toHaveBeenCalled();
      expect(window.history.length).toBe(before);
      expect(window.location.pathname).toBe('/settings/photos');
      expect(screen.getByTestId('photos-body')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-body')).not.toBeInTheDocument();
      expect(window.history.state.inApp).toBeUndefined();

      // One back arrow press then reaches the top page.
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(window.location.pathname).toBe('/settings');
      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    });

    it('is shown by a push within the mounted stack', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();
      await user.click(screen.getByTestId('row-photos'));
      const back = vi.spyOn(window.history, 'back');

      await user.click(screen.getByTestId('row-edit'));

      expect(back).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/photos/edit');
      expect(screen.getByTestId('edit-body')).toBeInTheDocument();
    });
  });

  describe('a page\'s bar action', () => {
    it('renders in the bar\'s trailing cell, and its goBack returns one level', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();
      await user.click(screen.getByTestId('row-photos'));
      await user.click(screen.getByTestId('row-edit'));

      const bar = screen.getByTestId('settings-bar');
      const save = within(bar).getByTestId('bar-save');
      expect(save).toHaveTextContent('Save');
      const before = window.history.length;

      await user.click(save);

      await vi.waitFor(() => expect(screen.getByTestId('photos-body')).toBeInTheDocument());
      expect(screen.queryByTestId('edit-body')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/photos');
      expect(window.history.length).toBe(before);
      expect(screen.queryByTestId('bar-save')).not.toBeInTheDocument();
    });
  });

  describe('unknown or unavailable page', () => {
    it('shows the top page and rewrites /settings/xyz to /settings', () => {
      freshLoadAt('/settings/xyz');
      renderStack();

      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings');
      expect(useAppStore.getState().settingsPath).toBe('');
    });

    it('does the same for a page the device cannot use', () => {
      available.photos = false;
      freshLoadAt('/settings/photos');
      renderStack();

      expect(screen.queryByTestId('photos-body')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings');
    });

    it('keeps the entry\'s app mark through the rewrite', () => {
      openedInApp();
      window.history.replaceState({ view: 'settings', inApp: true }, '', '/settings/xyz');
      act(() => useAppStore.getState().showSettingsPage('xyz'));
      renderStack();

      expect(window.location.pathname).toBe('/settings');
      expect(window.history.state).toMatchObject({ inApp: true });
    });

    it('does not rewrite the URL of a usable page', () => {
      freshLoadAt('/settings/photos');
      renderStack();

      expect(window.location.pathname).toBe('/settings/photos');
    });
  });

  describe('the top page\'s back arrow', () => {
    it('shows with the bottom dock when the app opened Settings, and returns to the previous view', async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, '', '/mood');
      useAppStore.getState().setView('settings');
      renderStack();
      const back = vi.spyOn(window.history, 'back');

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(back).toHaveBeenCalledTimes(1);
    });

    it('is absent after a fresh load', () => {
      freshLoadAt('/settings');
      renderStack();

      expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    it.each(['left', 'right'] as const)('is absent in the column form (%s)', (side) => {
      sideColumn.current = side;
      openedInApp();
      renderStack();

      expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    it('is still there on a subpage in the column form', async () => {
      const user = userEvent.setup();
      sideColumn.current = 'right';
      openedInApp();
      renderStack();

      await user.click(screen.getByTestId('row-photos'));

      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });

    it('is on a subpage after a fresh load, in the bottom form too', () => {
      freshLoadAt('/settings/photos');
      renderStack();

      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });
  });

  describe('leave and return', () => {
    it('leaves no Settings page under another view: browser back from it reaches Home', async () => {
      const user = userEvent.setup();
      openedInApp();
      const first = renderStack();
      await user.click(screen.getByTestId('row-photos'));
      // A dock tap: another view, then the stack unmounts with Settings.
      act(() => useAppStore.getState().setView('mood'));
      first.unmount();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));

      act(() => window.history.back());

      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
    });
  });

  describe('the bar', () => {
    function mockRects(titleBottom: number, barBottom: number) {
      const rect = (bottom: number) =>
        ({ top: bottom - 10, bottom, left: 0, right: 0, width: 0, height: 10, x: 0, y: 0 }) as DOMRect;
      const title = screen.getByRole('heading', { level: 1 });
      vi.spyOn(title, 'getBoundingClientRect').mockReturnValue(rect(titleBottom));
      // The 64px controls panel, the bar's last child: what the title is measured against.
      vi.spyOn(screen.getByTestId('settings-bar').lastElementChild as HTMLElement, 'getBoundingClientRect')
        .mockReturnValue(rect(barBottom));
    }

    it('starts uncollapsed on a large page and collapses once the title passes under it', () => {
      openedInApp();
      renderStack();
      const bar = screen.getByTestId('settings-bar');
      expect(bar).toHaveAttribute('data-collapsed', 'false');

      mockRects(76, 64);
      fireEvent.scroll(window);
      expect(bar).toHaveAttribute('data-collapsed', 'false');

      mockRects(63, 64);
      fireEvent.scroll(window);
      expect(bar).toHaveAttribute('data-collapsed', 'true');

      mockRects(90, 64);
      fireEvent.scroll(window);
      expect(bar).toHaveAttribute('data-collapsed', 'false');
    });

    it('does not collapse while the title\'s bottom is exactly the bar\'s', () => {
      openedInApp();
      renderStack();

      mockRects(64, 64);
      fireEvent.scroll(window);

      expect(screen.getByTestId('settings-bar')).toHaveAttribute('data-collapsed', 'false');
    });

    it('repeats a large title\'s name small and hidden from assistive technology in the bar', () => {
      openedInApp();
      renderStack();

      const small = within(screen.getByTestId('settings-bar')).getByTestId('settings-bar-title');
      expect(small).toHaveTextContent('Settings');
      expect(small).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('is always collapsed on a small-title page, whose centred title is the h1', async () => {
      const user = userEvent.setup();
      openedInApp();
      renderStack();

      await user.click(screen.getByTestId('row-name'));

      const bar = screen.getByTestId('settings-bar');
      expect(bar).toHaveAttribute('data-collapsed', 'true');
      const h1 = screen.getByRole('heading', { level: 1, name: 'Name' });
      expect(bar).toContainElement(h1);
      expect(h1).toHaveFocus();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('has the offline banner right under it, where the app header would have it', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      renderStack();

      const banner = screen.getByTestId('network-status-indicator');
      expect(screen.getByTestId('settings-bar').nextElementSibling).toBe(banner);
      expect(within(banner).getByTestId('network-status-banner')).toBeInTheDocument();
    });

    it('names the back arrow "Back" and sits below the dock', () => {
      openedInApp();
      renderStack();

      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
      expect(screen.getByTestId('settings-bar')).toHaveClass('sticky', 'top-0', 'z-30');
    });
  });
});
