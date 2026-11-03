/**
 * navigationSlice: the Settings page stack.
 *
 * Settings stays one view; the open subpage is `settingsPath`, mirrored in the
 * URL under `/settings/`. These pin the history contract the stack builds on:
 * each push is exactly one entry, every entry the app creates is marked
 * `inApp` (a fresh load has no state, which is how "back leaves the app" is
 * told from "back returns one level"), and a replace keeps the entry's own
 * mark rather than claiming it.
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
    useAppStore.setState({ currentView: 'home', settingsPath: '' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'home', settingsPath: '' });
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

    it('goes back one level with the browser, restoring the entry it left', async () => {
      useAppStore.getState().setView('settings');
      useAppStore.getState().openSettingsPage('photos');

      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/settings'));

      expect(window.history.state).toMatchObject({ view: 'settings', inApp: true });
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
      expect(window.history.state).toEqual({ view: 'mood', inApp: true });
    });

    it('opens Settings at its top page, even from a subpage', () => {
      useAppStore.getState().openSettingsPage('photos');
      useAppStore.getState().setView('mood');

      useAppStore.getState().setView('settings');

      expect(useAppStore.getState().settingsPath).toBe('');
      expect(window.location.pathname).toBe('/settings');
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
      expect(window.history.state).toEqual({ view: 'settings', inApp: true });
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

    it('a tap on Settings from a subpage pushes the top page (one entry)', () => {
      useAppStore.getState().openSettingsPage('photos');
      const before = window.history.length;

      useAppStore.getState().setView('settings');

      expect(window.history.length).toBe(before + 1);
      expect(window.location.pathname).toBe('/settings');
      expect(useAppStore.getState().settingsPath).toBe('');
    });
  });
});
