/**
 * navigationSlice: the Settings page stack.
 *
 * Settings stays one view; the open subpage is `settingsPath`, mirrored in the
 * URL under `/settings/`. These pin the history contract the stack builds on:
 * each push is exactly one entry, every entry the app creates is marked
 * `inApp` (a fresh load has no state, which is how "back leaves the app" is
 * told from "back returns one level"), and a replace keeps the entry's own
 * mark rather than claiming it. Home is the bottom of the history: a dock pick
 * walks back down to the first entry, makes it Home and stacks the view on it,
 * and every entry the app creates carries its `depth` above that entry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSettingsRoute,
  settingsPathFromRoute,
  settingsRoute,
} from '../../../src/stores/slices/navigationSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { stripBasePath } from '../../../src/utils/basePath';

vi.mock('../../../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Settings routes', () => {
  it('writes the top page and a subpage under /settings', () => {
    expect(settingsRoute('')).toBe('/settings');
    expect(settingsRoute('photos')).toBe('/settings/photos');
    expect(settingsRoute('dates/events')).toBe('/settings/dates/events');
  });

  it('reads a page back from a route, whatever slashes surround it', () => {
    expect(settingsPathFromRoute('/settings')).toBe('');
    expect(settingsPathFromRoute('/settings/')).toBe('');
    expect(settingsPathFromRoute('/settings/photos')).toBe('photos');
    expect(settingsPathFromRoute('/settings/photos/')).toBe('photos');
    expect(settingsPathFromRoute('/settings//photos')).toBe('photos');
    expect(settingsPathFromRoute('/settings/dates/events')).toBe('dates/events');
  });

  it('reads no page from a route outside Settings, including look-alikes', () => {
    expect(settingsPathFromRoute('/')).toBe('');
    expect(settingsPathFromRoute('/photos')).toBe('');
    expect(settingsPathFromRoute('/settingsx')).toBe('');
    expect(settingsPathFromRoute('/settingsx/photos')).toBe('');
  });

  it('round-trips every page through a route', () => {
    for (const path of ['', 'photos', 'dates/events']) {
      expect(settingsPathFromRoute(settingsRoute(path))).toBe(path);
    }
  });

  it('counts /settings and /settings/... as Settings, and nothing else', () => {
    expect(isSettingsRoute('/settings')).toBe(true);
    expect(isSettingsRoute('/settings/photos')).toBe(true);
    expect(isSettingsRoute('/settingsx')).toBe(false);
    expect(isSettingsRoute('/photos')).toBe(false);
    expect(isSettingsRoute('/')).toBe(false);
  });
});

describe('navigationSlice Settings stack', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'home', settingsPath: '', settingsFromHome: false, settingsPushedPath: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'home', settingsPath: '', settingsFromHome: false, settingsPushedPath: null });
  });

  describe('openSettingsPage', () => {
    it('pushes exactly one entry at /settings/photos, marked as the app\'s', () => {
      useAppStore.getState().setView('settings');
      const before = window.history.length;

      useAppStore.getState().openSettingsPage('photos');

      expect(window.history.length).toBe(before + 1);
      expect(window.location.pathname).toBe('/settings/photos');
      expect(window.history.state).toEqual({
        view: 'settings',
        settingsPath: 'photos',
        inApp: true,
        depth: 2,
      });
      expect(useAppStore.getState().currentView).toBe('settings');
      expect(useAppStore.getState().settingsPath).toBe('photos');
    });

    it('writes the URL under a sub-path base and reads it back', () => {
      vi.stubEnv('BASE_URL', '/My-Love/');

      useAppStore.getState().openSettingsPage('photos');

      expect(window.location.pathname).toBe('/My-Love/settings/photos');
      expect(settingsPathFromRoute(stripBasePath(window.location.pathname))).toBe('photos');
    });

    it('remembers the page it pushed, which a reload (a fresh store) does not', () => {
      expect(useAppStore.getState().settingsPushedPath).toBeNull();

      useAppStore.getState().openSettingsPage('dates/new-event', { fromHome: true });

      expect(useAppStore.getState().settingsPushedPath).toBe('dates/new-event');

      // A history restore (popstate, reload) shows what the URL names, pushed by nobody here.
      useAppStore.getState().showSettingsPage('dates/new-event');

      expect(useAppStore.getState().settingsPushedPath).toBeNull();
    });

    it('goes back one level with the browser, restoring the entry it left', async () => {
      useAppStore.getState().setView('settings');
      useAppStore.getState().openSettingsPage('photos');

      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/settings'));

      expect(window.history.state).toMatchObject({ view: 'settings', inApp: true });
    });
  });

  describe('from Home', () => {
    it('marks the pushed entry and the flag when a Home flow opens a page', () => {
      const before = window.history.length;

      useAppStore.getState().openSettingsPage('dates/event/7', { fromHome: true });

      expect(window.history.length).toBe(before + 1);
      expect(window.location.pathname).toBe('/settings/dates/event/7');
      expect(window.history.state).toEqual({
        view: 'settings',
        settingsPath: 'dates/event/7',
        inApp: true,
        depth: 1,
        from: 'home',
      });
      expect(useAppStore.getState().settingsFromHome).toBe(true);
    });

    it('leaves the mark off a push from the Dates list', () => {
      useAppStore.getState().setView('settings');
      useAppStore.getState().openSettingsPage('dates');
      useAppStore.getState().openSettingsPage('dates/event/7');

      expect(window.history.state).not.toHaveProperty('from');
      expect(useAppStore.getState().settingsFromHome).toBe(false);
    });

    it('inherits the mark on a push from a page that is from Home', () => {
      useAppStore.getState().openSettingsPage('dates/event/7', { fromHome: true });

      useAppStore.getState().openSettingsPage('dates/event/7/date');

      expect(window.history.state).toMatchObject({ settingsPath: 'dates/event/7/date', from: 'home' });
      expect(useAppStore.getState().settingsFromHome).toBe(true);
    });

    it('does not inherit the mark from another view', () => {
      useAppStore.setState({ currentView: 'mood', settingsFromHome: true });

      useAppStore.getState().openSettingsPage('photos');

      expect(window.history.state).not.toHaveProperty('from');
      expect(useAppStore.getState().settingsFromHome).toBe(false);
    });

    it('lets an explicit fromHome: false drop the mark', () => {
      useAppStore.getState().openSettingsPage('dates/event/7', { fromHome: true });

      useAppStore.getState().openSettingsPage('photos', { fromHome: false });

      expect(window.history.state).not.toHaveProperty('from');
      expect(useAppStore.getState().settingsFromHome).toBe(false);
    });

    it('reads the mark back from the entry on showSettingsPage, as a reload or popstate does', () => {
      window.history.replaceState(
        { view: 'settings', settingsPath: 'dates/wedding', inApp: true, from: 'home' },
        '',
        '/settings/dates/wedding'
      );

      useAppStore.getState().showSettingsPage('dates/wedding');

      expect(useAppStore.getState().settingsFromHome).toBe(true);
    });

    it('reads no mark from an entry without one (a pasted URL)', () => {
      useAppStore.setState({ settingsFromHome: true });
      window.history.replaceState(null, '', '/settings/dates/wedding');

      useAppStore.getState().showSettingsPage('dates/wedding');

      expect(useAppStore.getState().settingsFromHome).toBe(false);
    });

    it('returns to the Home entry with the flag cleared on browser back', async () => {
      useAppStore.getState().openSettingsPage('dates/event/7', { fromHome: true });

      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
      useAppStore.getState().showSettingsPage('');

      expect(useAppStore.getState().settingsFromHome).toBe(false);
    });

    it('clears the flag when the person picks a view', async () => {
      useAppStore.getState().openSettingsPage('dates/event/7', { fromHome: true });

      useAppStore.getState().setView('mood');

      expect(useAppStore.getState().settingsFromHome).toBe(false);
      await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
      expect(window.history.state).toEqual({ view: 'mood', inApp: true, depth: 1 });
    });

    it('keeps the flag through a history restore (skipHistory)', () => {
      useAppStore.setState({ settingsFromHome: true });

      useAppStore.getState().setView('settings', true);

      expect(useAppStore.getState().settingsFromHome).toBe(true);
    });
  });

  describe('showSettingsPage', () => {
    it('changes the shown page and leaves history alone', () => {
      useAppStore.getState().setView('settings');
      const before = window.history.length;
      const state = window.history.state;

      useAppStore.getState().showSettingsPage('photos');

      expect(useAppStore.getState().settingsPath).toBe('photos');
      expect(window.history.length).toBe(before);
      expect(window.location.pathname).toBe('/settings');
      expect(window.history.state).toEqual(state);
    });
  });

  describe('setView', () => {
    it('pushes an entry marked as the app\'s', () => {
      const before = window.history.length;

      useAppStore.getState().setView('mood');

      expect(window.history.length).toBe(before + 1);
      expect(window.history.state).toEqual({ view: 'mood', inApp: true, depth: 1 });
    });

    it('opens Settings at its top page, even from a subpage', async () => {
      useAppStore.getState().openSettingsPage('photos');
      useAppStore.getState().setView('mood');

      useAppStore.getState().setView('settings');

      expect(useAppStore.getState().settingsPath).toBe('');
      await vi.waitFor(() => expect(window.location.pathname).toBe('/settings'));
    });

    it('leaves the page to the caller when restoring history', () => {
      useAppStore.setState({ settingsPath: 'photos' });

      useAppStore.getState().setView('settings', true);

      expect(useAppStore.getState().settingsPath).toBe('photos');
    });

    it('keeps an app-created entry app-created when the same tab is tapped again', () => {
      useAppStore.getState().setView('settings');
      const before = window.history.length;

      useAppStore.getState().setView('settings');

      expect(window.history.length).toBe(before);
      expect(window.history.state).toEqual({ view: 'settings', inApp: true, depth: 1 });
    });

    it('does not claim a fresh load\'s entry when the same tab is tapped', () => {
      // A fresh load at /settings: the browser's entry, with no state.
      window.history.replaceState(null, '', '/settings');
      const before = window.history.length;

      useAppStore.getState().setView('settings');

      expect(window.history.length).toBe(before);
      expect(window.history.state).toEqual({ view: 'settings' });
      expect(window.history.state.inApp).toBeUndefined();
    });

    it('a tap on Settings from a subpage stacks the top page on Home, not on the subpage', async () => {
      useAppStore.getState().setView('settings');
      useAppStore.getState().openSettingsPage('photos');
      const before = window.history.length;

      useAppStore.getState().setView('settings');

      expect(useAppStore.getState().settingsPath).toBe('');
      await vi.waitFor(() => expect(window.location.pathname).toBe('/settings'));
      // Back down to Home, then one push over the old Settings entry: one fewer.
      expect(window.history.length).toBe(before - 1);
      expect(window.history.state).toEqual({ view: 'settings', inApp: true, depth: 1 });

      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
    });
  });

  describe('Home at the bottom', () => {
    it('goes back to Home, not the view before, after one dock view then another', async () => {
      useAppStore.getState().setView('photos');
      useAppStore.getState().setView('mood');
      await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
      expect(useAppStore.getState().currentView).toBe('mood');

      window.history.back();

      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
      expect(window.history.state?.depth).toBeUndefined();
    });

    it('goes back to Home from a dock view picked on a Settings subpage', async () => {
      useAppStore.getState().setView('settings');
      useAppStore.getState().openSettingsPage('profile');
      useAppStore.getState().openSettingsPage('profile/name');

      useAppStore.getState().setView('mood');
      await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
      expect(window.history.state).toEqual({ view: 'mood', inApp: true, depth: 1 });

      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
    });

    it('returns to the first entry when Home is picked from deep in Settings', async () => {
      useAppStore.getState().setView('settings');
      useAppStore.getState().openSettingsPage('profile');

      useAppStore.getState().setView('home');

      // happy-dom drops forward entries from history.length on a walk back,
      // which a browser keeps, so the entry is pinned by its state instead.
      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
      expect(useAppStore.getState().currentView).toBe('home');
      expect(window.history.state?.depth).toBeUndefined();
    });

    it('goes back one level at a time inside Settings, then to Home', async () => {
      useAppStore.getState().setView('settings');
      useAppStore.getState().openSettingsPage('profile');
      useAppStore.getState().openSettingsPage('profile/name');
      expect(window.history.state).toMatchObject({ depth: 3 });

      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/settings'));
      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
    });

    it('makes a fresh load elsewhere the Home entry, so the picked view sits on Home', async () => {
      // A fresh load at /settings/photos: the browser's entry, with no state.
      window.history.replaceState(null, '', '/settings/photos');
      const before = window.history.length;

      useAppStore.getState().setView('mood');

      expect(window.history.length).toBe(before + 1);
      expect(window.location.pathname).toBe('/mood');
      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
      expect(window.history.state).toEqual({ view: 'home' });
    });

    it('turns a fresh load elsewhere into Home, in place, when Home is picked', () => {
      window.history.replaceState(null, '', '/notes');
      const before = window.history.length;

      useAppStore.getState().setView('home');

      expect(window.history.length).toBe(before);
      expect(window.location.pathname).toBe('/');
    });
  });
});
