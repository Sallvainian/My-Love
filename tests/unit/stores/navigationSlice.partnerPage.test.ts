/**
 * navigationSlice: the Partner page (`/partner/history`).
 *
 * The Partner view stays one view; the open page is `partnerPath`, mirrored in
 * the URL under `/partner/`. These pin the route helpers and the history
 * contract: a push is exactly one entry marked `inApp` at the next depth, a
 * restore (`showPartnerPage`) touches no history, and a view the person picks
 * resets the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isPartnerRoute,
  partnerPathFromRoute,
  replaceWithPartnerTop,
} from '../../../src/stores/slices/navigationSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { stripBasePath } from '../../../src/utils/basePath';

vi.mock('../../../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const reset = () => {
  window.history.replaceState(null, '', '/');
  useAppStore.setState({ currentView: 'home', partnerPath: '' });
};

describe('Partner routes', () => {
  it('counts /partner and /partner/history as Partner, and nothing else', () => {
    expect(isPartnerRoute('/partner')).toBe(true);
    expect(isPartnerRoute('/partner/history')).toBe(true);
    expect(isPartnerRoute('/partner/')).toBe(false);
    expect(isPartnerRoute('/partner/other')).toBe(false);
    expect(isPartnerRoute('/partnerx')).toBe(false);
    expect(isPartnerRoute('/settings/partner')).toBe(false);
    expect(isPartnerRoute('/')).toBe(false);
  });

  it('reads history from /partner/history and the top page from anything else', () => {
    expect(partnerPathFromRoute('/partner/history')).toBe('history');
    expect(partnerPathFromRoute('/partner')).toBe('');
    expect(partnerPathFromRoute('/partner/other')).toBe('');
    expect(partnerPathFromRoute('/photos')).toBe('');
    expect(partnerPathFromRoute('/')).toBe('');
  });
});

describe('navigationSlice Partner page', () => {
  beforeEach(reset);
  afterEach(() => {
    vi.unstubAllEnvs();
    reset();
  });

  it('starts at the top page', () => {
    expect(useAppStore.getState().partnerPath).toBe('');
  });

  describe('openPartnerPage', () => {
    it("pushes exactly one entry at /partner/history, marked as the app's", () => {
      useAppStore.getState().setView('partner');
      const before = window.history.length;

      useAppStore.getState().openPartnerPage('history');

      expect(window.history.length).toBe(before + 1);
      expect(window.location.pathname).toBe('/partner/history');
      expect(window.history.state).toEqual({
        view: 'partner',
        partnerPath: 'history',
        inApp: true,
        depth: 2,
      });
      expect(useAppStore.getState().currentView).toBe('partner');
      expect(useAppStore.getState().partnerPath).toBe('history');
    });

    it('writes the URL under a sub-path base and reads it back', () => {
      vi.stubEnv('BASE_URL', '/My-Love/');

      useAppStore.getState().openPartnerPage('history');

      expect(window.location.pathname).toBe('/My-Love/partner/history');
      expect(partnerPathFromRoute(stripBasePath(window.location.pathname))).toBe('history');
    });

    it('goes back one level with the browser, restoring the entry it left', async () => {
      useAppStore.getState().setView('partner');
      useAppStore.getState().openPartnerPage('history');

      window.history.back();
      await vi.waitFor(() => expect(window.location.pathname).toBe('/partner'));

      expect(window.history.state).toMatchObject({ view: 'partner', inApp: true });
    });
  });

  describe('showPartnerPage', () => {
    it('sets the page without touching history', () => {
      const before = window.history.length;
      const state = window.history.state;

      useAppStore.getState().showPartnerPage('history');

      expect(useAppStore.getState().partnerPath).toBe('history');
      expect(window.history.length).toBe(before);
      expect(window.history.state).toBe(state);
      expect(window.location.pathname).toBe('/');
    });
  });

  describe('setView', () => {
    it('resets the page when the person picks a view', () => {
      useAppStore.setState({ currentView: 'partner', partnerPath: 'history' });

      useAppStore.getState().setView('partner');

      expect(useAppStore.getState().partnerPath).toBe('');
    });

    it('leaves the page to showPartnerPage on a history restore', () => {
      useAppStore.setState({ currentView: 'partner', partnerPath: 'history' });

      useAppStore.getState().setView('partner', true);

      expect(useAppStore.getState().partnerPath).toBe('history');
    });

    it('a dock tap on Partner from the history page lands on /partner', async () => {
      useAppStore.getState().setView('partner');
      useAppStore.getState().openPartnerPage('history');
      // The app's popstate handler restores the page the walk lands on.
      const onPopstate = () => {
        useAppStore.getState().setView('home', true);
        useAppStore.getState().showPartnerPage('');
      };
      window.addEventListener('popstate', onPopstate);

      useAppStore.getState().setView('partner');
      await vi.waitFor(() => expect(window.location.pathname).toBe('/partner'));
      window.removeEventListener('popstate', onPopstate);

      expect(useAppStore.getState().currentView).toBe('partner');
      expect(useAppStore.getState().partnerPath).toBe('');
    });
  });

  describe('replaceWithPartnerTop', () => {
    it('rewrites the entry to /partner keeping inApp and depth, adding none', () => {
      useAppStore.getState().setView('partner');
      useAppStore.getState().openPartnerPage('history');
      const length = window.history.length;

      replaceWithPartnerTop();

      expect(window.location.pathname).toBe('/partner');
      expect(window.history.length).toBe(length);
      expect(window.history.state).toEqual({
        view: 'partner',
        partnerPath: '',
        inApp: true,
        depth: 2,
      });
    });

    it('does not claim an entry a fresh load created', () => {
      window.history.replaceState(null, '', '/partner/history');

      replaceWithPartnerTop();

      expect(window.location.pathname).toBe('/partner');
      expect(window.history.state).toEqual({ view: 'partner', partnerPath: '' });
    });
  });
});
