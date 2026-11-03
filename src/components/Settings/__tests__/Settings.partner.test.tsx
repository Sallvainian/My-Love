/**
 * Settings > Partner: the top page's Partner group with its Partner row, and
 * the Partner page (`/settings/partner`) in each of its three states.
 *
 * The real store and the real Settings stack are mounted; the state each case
 * needs is set on the store, as the partner slice leaves it after a copy or a
 * server answer (`partnerSlice.localCopy.test.ts` pins how it gets there).
 * Only the Supabase client and the profile read are faked, as the other
 * Settings page tests do.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerInfo } from '../../../api/partnerService';

const backend = vi.hoisted(() => ({
  fetchOwnProfile: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../services/profileService', () => ({
  profileService: { fetchOwnProfile: backend.fetchOwnProfile, saveBirthday: vi.fn() },
}));
vi.mock('../../../api/authService', () => ({ authService: { signOut: vi.fn() } }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../AnniversarySettings', () => ({ AnniversarySettings: () => null }));
vi.mock('../EventsSettings', () => ({ EventsSettings: () => null }));

import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';
import { onPopState } from './settingsStackKit';

const NOT_LINKED_LEAD = "You aren't linked with a partner yet.";
const OFFLINE_LINE = "You're offline. Connect to load your partner.";
const RETRY_LINE = 'Something went wrong. Please try again.';

const PARTNER: PartnerInfo = {
  id: 'partner-1',
  email: 'harper@example.com',
  displayName: 'Harper',
  linkedSince: '2022-02-03T12:00:00Z',
  birthday: null,
};

let accountCounter = 0;
const originalLoadPartner = useAppStore.getState().loadPartner;

const row = () => screen.getByTestId('settings-partner-row');

/** Puts the partner slice in a state; the rest of the slice stays at rest. */
function setPartner(state: {
  partner?: PartnerInfo | null;
  partnerKnown?: boolean;
  partnerLoadError?: boolean;
  isLoadingPartner?: boolean;
}) {
  act(() => {
    useAppStore.setState({
      partner: null,
      partnerKnown: false,
      partnerLoadError: false,
      isLoadingPartner: false,
      ...state,
    });
  });
}

async function renderSettings() {
  window.history.replaceState(null, '', '/');
  useAppStore.getState().setView('settings');
  render(<Settings />);
  await waitFor(() => expect(useAppStore.getState().ownProfile).not.toBeNull());
}

async function openPartnerPage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(row());
  expect(await screen.findByRole('heading', { level: 1, name: 'Partner' })).toBeInTheDocument();
}

describe('Settings > Partner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Jessie', birthday: null });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    accountCounter += 1;
    useAppStore.setState({
      userId: `user-${accountCounter}`,
      authSessionVersion: accountCounter,
      ownProfile: null,
      ownProfileLoadFailed: false,
      currentView: 'settings',
      settingsPath: '',
      partner: null,
      partnerKnown: false,
      partnerLoadError: false,
      isLoadingPartner: false,
    });
    useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: true } });
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
    useAppStore.setState({
      userId: null,
      ownProfile: null,
      currentView: 'home',
      settingsPath: '',
      partner: null,
      partnerKnown: false,
      partnerLoadError: false,
      isLoadingPartner: false,
      loadPartner: originalLoadPartner,
    });
  });

  describe('the top page', () => {
    it('puts the Partner group right after Account, holding the Partner row', async () => {
      await renderSettings();

      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings[0]).toHaveTextContent('Account');
      expect(headings[1]).toHaveTextContent('Partner');
      expect(headings[1].closest('section')).toContainElement(row());
      expect(row()).toHaveTextContent('Partner');
    });

    it("shows the partner's name on the row when linked", async () => {
      setPartner({ partner: PARTNER, partnerKnown: true });
      await renderSettings();

      expect(row()).toHaveAccessibleName('Partner, Harper');
    });

    it('shows Not linked only after a loaded unlinked answer', async () => {
      setPartner({ partner: null, partnerKnown: true });
      await renderSettings();

      expect(row()).toHaveAccessibleName('Partner, Not linked');
    });

    it('shows no value before anything has answered', async () => {
      await renderSettings();

      expect(row()).toHaveAccessibleName('Partner');
      expect(row()).not.toHaveTextContent('Not linked');
    });

    it('shows no value, never Not linked, after a failed read with nothing saved', async () => {
      setPartner({ partner: null, partnerKnown: false, partnerLoadError: true });
      await renderSettings();

      expect(row()).toHaveAccessibleName('Partner');
      expect(row()).not.toHaveTextContent('Not linked');
    });

    it('shows no value when a later read fails with nothing saved, over an earlier loaded answer', async () => {
      setPartner({ partner: null, partnerKnown: true, partnerLoadError: true });
      await renderSettings();

      expect(row()).toHaveAccessibleName('Partner');
      expect(row()).not.toHaveTextContent('Not linked');
    });

    it('follows the store to a new answer with no reload', async () => {
      await renderSettings();
      expect(row()).toHaveAccessibleName('Partner');

      setPartner({ partner: PARTNER, partnerKnown: true });

      expect(row()).toHaveAccessibleName('Partner, Harper');
    });
  });

  describe('linked', () => {
    it('opens at /settings/partner with Name, Email and Linked since as read-only rows', async () => {
      const user = userEvent.setup();
      setPartner({ partner: PARTNER, partnerKnown: true });
      await renderSettings();

      await openPartnerPage(user);

      expect(window.location.pathname).toBe('/settings/partner');
      const name = screen.getByTestId('settings-partner-name');
      const email = screen.getByTestId('settings-partner-email');
      const since = screen.getByTestId('settings-partner-linked-since');
      expect(name).toHaveTextContent('Name');
      expect(name).toHaveTextContent('Harper');
      expect(email).toHaveTextContent('Email');
      expect(email).toHaveTextContent('harper@example.com');
      expect(since).toHaveTextContent('Linked since');
      expect(since).toHaveTextContent(
        new Date(PARTNER.linkedSince as string).toLocaleDateString(undefined, { dateStyle: 'long' })
      );
      expect(since).toHaveTextContent('2022');
    });

    it('draws the three rows as plain rows: no button, no chevron', async () => {
      const user = userEvent.setup();
      setPartner({ partner: PARTNER, partnerKnown: true });
      await renderSettings();
      await openPartnerPage(user);

      const card = screen.getByTestId('settings-partner-card');
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
      expect(card.querySelector('svg')).toBeNull();
      for (const id of ['name', 'email', 'linked-since']) {
        expect(screen.getByTestId(`settings-partner-${id}`).className).not.toMatch(/opacity/);
      }
    });

    it('hides Linked since when the link date is not known', async () => {
      const user = userEvent.setup();
      setPartner({ partner: { ...PARTNER, linkedSince: null }, partnerKnown: true });
      await renderSettings();

      await openPartnerPage(user);

      expect(screen.getByTestId('settings-partner-name')).toBeInTheDocument();
      expect(screen.getByTestId('settings-partner-email')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-partner-linked-since')).not.toBeInTheDocument();
      expect(screen.queryByText('Linked since')).not.toBeInTheDocument();
    });

    it('hides Linked since when the saved date does not parse', async () => {
      const user = userEvent.setup();
      setPartner({ partner: { ...PARTNER, linkedSince: 'not a date' }, partnerKnown: true });
      await renderSettings();

      await openPartnerPage(user);

      expect(screen.queryByTestId('settings-partner-linked-since')).not.toBeInTheDocument();
    });

    it('shows a saved copy, linked, when the read since failed', async () => {
      const user = userEvent.setup();
      // A failed read over a saved copy leaves the partner and raises no error.
      setPartner({ partner: PARTNER, partnerKnown: true, partnerLoadError: false });
      await renderSettings();

      await openPartnerPage(user);

      expect(screen.getByTestId('settings-partner-name')).toHaveTextContent('Harper');
      expect(screen.queryByTestId('partner-load-error')).not.toBeInTheDocument();
    });

    it('goes back one level to the top page', async () => {
      const user = userEvent.setup();
      setPartner({ partner: PARTNER, partnerKnown: true });
      await renderSettings();
      await openPartnerPage(user);

      await user.click(screen.getByRole('button', { name: 'Back' }));

      await waitFor(() => expect(window.location.pathname).toBe('/settings'));
      expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    });
  });

  describe('not linked', () => {
    it('shows the lead line and Go to Partner, and no linked rows', async () => {
      const user = userEvent.setup();
      setPartner({ partner: null, partnerKnown: true });
      await renderSettings();

      await openPartnerPage(user);

      expect(screen.getByTestId('settings-partner-lead')).toHaveTextContent(NOT_LINKED_LEAD);
      expect(screen.getByTestId('settings-go-to-partner')).toHaveTextContent('Go to Partner');
      expect(screen.queryByTestId('settings-partner-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-load-error')).not.toBeInTheDocument();
    });

    it('opens the Partner view from Go to Partner', async () => {
      const user = userEvent.setup();
      setPartner({ partner: null, partnerKnown: true });
      await renderSettings();
      await openPartnerPage(user);

      await user.click(screen.getByTestId('settings-go-to-partner'));

      expect(useAppStore.getState().currentView).toBe('partner');
    });
  });

  describe('not answered yet', () => {
    it('shows nothing under the title: no rows, never Not linked', async () => {
      const user = userEvent.setup();
      await renderSettings();

      await openPartnerPage(user);

      expect(screen.queryByTestId('settings-partner-lead')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-go-to-partner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-partner-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-load-error')).not.toBeInTheDocument();
      expect(screen.queryByText(NOT_LINKED_LEAD)).not.toBeInTheDocument();
      expect(screen.queryByText('Not linked')).not.toBeInTheDocument();
    });

    it('fills in when the answer arrives', async () => {
      const user = userEvent.setup();
      await renderSettings();
      await openPartnerPage(user);

      setPartner({ partner: PARTNER, partnerKnown: true });

      expect(await screen.findByTestId('settings-partner-name')).toHaveTextContent('Harper');
    });
  });

  describe('a failed read with nothing saved', () => {
    it('shows the load-error card with the retry line, never the not-linked page', async () => {
      const user = userEvent.setup();
      setPartner({ partner: null, partnerKnown: false, partnerLoadError: true });
      await renderSettings();

      await openPartnerPage(user);

      const card = screen.getByTestId('partner-load-error');
      expect(card).toHaveTextContent("Couldn't load your partner");
      expect(card).toHaveTextContent(RETRY_LINE);
      expect(screen.getByTestId('partner-load-retry')).toHaveTextContent('Try again');
      expect(screen.queryByTestId('settings-partner-lead')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-go-to-partner')).not.toBeInTheDocument();
      expect(screen.queryByText(NOT_LINKED_LEAD)).not.toBeInTheDocument();
    });

    it('asks again with loadPartner when Try again is tapped', async () => {
      const user = userEvent.setup();
      const loadPartner = vi.fn(async () => {});
      useAppStore.setState({ loadPartner });
      setPartner({ partner: null, partnerKnown: false, partnerLoadError: true });
      await renderSettings();
      await openPartnerPage(user);

      await user.click(screen.getByTestId('partner-load-retry'));

      expect(loadPartner).toHaveBeenCalledTimes(1);
    });

    it('hides the card while a retry is loading, without falling through to another page', async () => {
      const user = userEvent.setup();
      setPartner({ partner: null, partnerKnown: false, partnerLoadError: true });
      await renderSettings();
      await openPartnerPage(user);
      expect(screen.getByTestId('partner-load-error')).toBeInTheDocument();

      setPartner({ partner: null, partnerKnown: false, partnerLoadError: true, isLoadingPartner: true });

      expect(screen.queryByTestId('partner-load-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-load-retry')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-partner-lead')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-go-to-partner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-partner-name')).not.toBeInTheDocument();
    });

    it('offline: says so and offers no retry', async () => {
      const user = userEvent.setup();
      setPartner({ partner: null, partnerKnown: false, partnerLoadError: true });
      await renderSettings();
      act(() => {
        useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: false } });
      });

      await openPartnerPage(user);

      expect(screen.getByTestId('partner-load-error')).toHaveTextContent(OFFLINE_LINE);
      expect(screen.queryByTestId('partner-load-retry')).not.toBeInTheDocument();
    });
  });
});
