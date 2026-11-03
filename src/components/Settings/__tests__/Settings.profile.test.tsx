/**
 * Settings > Profile: the top page's Account group with its Profile row, the
 * Profile page (header, Name and Birthday rows) and the two one-field pages
 * under it (DW-130's route back to the display name, and the birthday).
 *
 * The real store, `profileService` write path and one-field page are mounted;
 * only the Supabase client is faked (its `users` row is `backend.row`, which a
 * write updates) and the profile READ is stubbed at
 * `profileService.fetchOwnProfile`, so each case can hold, fail or skip it.
 * That puts what is worth pinning at the seams: the rows read the one
 * `ownProfile` the save writes, a refused value never reaches the table, and a
 * page reached by a reload shows the page above it.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnProfile } from '../../../services/profileService';

type ServerRow = { display_name: string | null; birthday: string | null };
type WriteResult = { data: ServerRow | null; error: unknown };

const backend = vi.hoisted(() => ({
  fetchOwnProfile: vi.fn<() => Promise<OwnProfile>>(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  /** The `public.users` row; a successful write merges its payload into it. */
  row: { display_name: 'Jessie', birthday: null } as ServerRow,
  /** Every payload sent to `users.update`. */
  updates: [] as Record<string, unknown>[],
  /** When set, the next write answers this instead of updating the row. */
  failWith: null as WriteResult | null,
}));

// Not `importActual`: the real module throws at import time without the
// VITE_SUPABASE_* env vars. `isSeedFallbackName` copies the real rule
// (pinned against the real module in tests/unit/api/ownDisplayNameContract.test.ts).
// `lookupPartnerId` is there for the real store's dates slice, which imports it.
vi.mock('../../../api/supabaseClient', () => ({
  lookupPartnerId: vi.fn(),
  SEED_FALLBACK_NAME: 'Unknown',
  isSeedFallbackName: (stored: string | null, email: string | null) => {
    const name = stored?.trim() ?? '';
    const address = email?.trim() ?? '';
    return (
      name === '' ||
      name === 'Unknown' ||
      (address !== '' && name.toLowerCase() === address.toLowerCase())
    );
  },
  supabase: {
    from: (table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`);
      const chain = {
        update: (payload: Record<string, unknown>) => {
          backend.updates.push(payload);
          return chain;
        },
        eq: () => chain,
        select: () => chain,
        abortSignal: () => chain,
        maybeSingle: async (): Promise<WriteResult> => {
          if (backend.failWith) return backend.failWith;
          const payload = backend.updates.at(-1) ?? {};
          if ('display_name' in payload) backend.row.display_name = payload.display_name as string;
          if ('birthday' in payload) backend.row.birthday = payload.birthday as string;
          return { data: { ...backend.row }, error: null };
        },
      };
      return chain;
    },
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'user-a', email: 'person@example.com' } } },
        error: null,
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));
vi.mock('../../../api/authService', () => ({
  authService: { getSession: backend.getSession, signOut: backend.signOut },
}));
vi.mock('../../../services/profileService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/profileService')>();
  return {
    ...actual,
    profileService: { ...actual.profileService, fetchOwnProfile: backend.fetchOwnProfile },
  };
});
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// The other sections pull in the events store and the anniversary storage;
// neither has anything to do with the profile.
vi.mock('../AnniversarySettings', () => ({ AnniversarySettings: () => null }));
vi.mock('../EventsSettings', () => ({ EventsSettings: () => null }));

import { writeLocalCopy } from '../../../services/localCopy';
import { PROFILE_COPY_KIND } from '../../../stores/slices/profileSlice';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';
import { onPopState } from './settingsStackKit';

const EMAIL = 'person@example.com';
const OFFLINE_NAME = 'You are offline. Name changes need a connection to save.';
const OFFLINE_PROFILE = 'You are offline. Profile changes need a connection to save.';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

let accountCounter = 0;

const store = () => useAppStore.getState();
const topRow = () => screen.getByTestId('settings-profile-row');
const nameRow = () => screen.getByTestId('settings-profile-name');
const birthdayRow = () => screen.getByTestId('settings-profile-birthday');
const saveButton = () => screen.getByTestId('settings-field-save');
const nameField = () => screen.getByLabelText('Name');
const birthdayField = () => screen.getByLabelText('Birthday');

/** What the profile read answers: the server row in the app's shape. */
const serverProfile = (): OwnProfile => ({
  displayName: backend.row.display_name,
  birthday: backend.row.birthday,
});

/** Render Settings (opened from the gear, as the app does) and wait for the first profile answer. */
async function renderSettings() {
  window.history.replaceState(null, '', '/');
  useAppStore.getState().setView('settings');
  render(<Settings />);
  await waitFor(() => expect(store().ownProfile).not.toBeNull());
}

async function openProfile(user: UserEvent) {
  await user.click(topRow());
  expect(await screen.findByTestId('settings-profile-header')).toBeInTheDocument();
}

async function openNamePage(user: UserEvent) {
  await openProfile(user);
  await user.click(nameRow());
  expect(await screen.findByTestId('settings-name-page')).toBeInTheDocument();
}

async function openBirthdayPage(user: UserEvent) {
  await openProfile(user);
  await user.click(birthdayRow());
  expect(await screen.findByTestId('settings-birthday-page')).toBeInTheDocument();
}

/** Types `name` into the Name field, replacing what is there. */
async function typeName(user: UserEvent, name: string) {
  await user.clear(nameField());
  await user.type(nameField(), name);
}

describe('Settings > Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setOnline(true);
    backend.row = { display_name: 'Jessie', birthday: null };
    backend.updates = [];
    backend.failWith = null;
    backend.getSession.mockResolvedValue({ user: { id: 'user-a', email: EMAIL } });
    backend.fetchOwnProfile.mockImplementation(async () => serverProfile());
    // A fresh account and session per case, so no saved copy or "fresh" mark
    // from an earlier case decides what this one shows.
    accountCounter += 1;
    useAppStore.setState({
      userId: `user-${accountCounter}`,
      authSessionVersion: accountCounter,
      ownProfile: null,
      ownProfileLoadFailed: false,
      currentView: 'settings',
      settingsPath: '',
    });
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    setOnline(true);
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
    useAppStore.setState({
      userId: null,
      ownProfile: null,
      ownProfileLoadFailed: false,
      currentView: 'home',
      settingsPath: '',
    });
  });

  describe('the top page', () => {
    it('opens with Account first, holding the Profile row with the display name', async () => {
      await renderSettings();

      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings[0]).toHaveTextContent('Account');
      expect(headings[0].closest('section')).toContainElement(topRow());
      expect(topRow()).toHaveTextContent('Profile');
      expect(topRow()).toHaveTextContent('Jessie');
      expect(topRow()).toBe(screen.getByRole('button', { name: 'Profile, Jessie' }));
    });

    it('has no identity row, name editor or birthday editor left in the old section', async () => {
      await renderSettings();

      expect(screen.getByTestId('settings-view')).not.toHaveTextContent('Signed in');
      expect(screen.queryByTestId('settings-avatar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-email')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Display name/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Your birthday')).not.toBeInTheDocument();
      expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Countdowns' })).toBeInTheDocument();
    });

    it('shows no value on the Profile row before the profile has answered', async () => {
      let release: (profile: OwnProfile) => void = () => {};
      backend.fetchOwnProfile.mockReturnValueOnce(
        new Promise<OwnProfile>((resolve) => {
          release = resolve;
        })
      );
      render(<Settings />);

      expect(topRow()).toHaveAccessibleName('Profile');
      expect(topRow()).not.toHaveTextContent('Jessie');

      release(serverProfile());
      await waitFor(() => expect(topRow()).toHaveTextContent('Jessie'));
    });

    it('shows no value for a name that is not set', async () => {
      backend.row.display_name = null;
      await renderSettings();

      expect(topRow()).toHaveAccessibleName('Profile');
    });
  });

  describe('the Profile page rows', () => {
    it('opens as one history entry at /settings/profile, with Name and Birthday as rows', async () => {
      const user = userEvent.setup();
      backend.row.birthday = '2000-05-20';
      await renderSettings();

      await openProfile(user);

      expect(window.location.pathname).toBe('/settings/profile');
      expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
      expect(nameRow()).toHaveTextContent('Name');
      expect(nameRow()).toHaveTextContent('Jessie');
      expect(birthdayRow()).toHaveTextContent('Birthday');
      expect(birthdayRow()).toHaveTextContent('2000');
    });

    it('disables Name and Birthday, with no value, until the first answer arrives', async () => {
      const user = userEvent.setup();
      let release: (profile: OwnProfile) => void = () => {};
      backend.fetchOwnProfile.mockReturnValueOnce(
        new Promise<OwnProfile>((resolve) => {
          release = resolve;
        })
      );
      render(<Settings />);
      await user.click(topRow());
      await screen.findByTestId('settings-profile-header');

      expect(nameRow()).toBeDisabled();
      expect(birthdayRow()).toBeDisabled();
      expect(nameRow()).toHaveAccessibleName('Name');
      expect(birthdayRow()).toHaveAccessibleName('Birthday');

      release(serverProfile());

      await waitFor(() => expect(nameRow()).toBeEnabled());
      expect(birthdayRow()).toBeEnabled();
      expect(nameRow()).toHaveTextContent('Jessie');
    });

    it('opens both pages with an empty field after a failed read with nothing saved', async () => {
      const user = userEvent.setup();
      backend.fetchOwnProfile.mockRejectedValue(new Error('boom'));
      render(<Settings />);
      await waitFor(() => expect(store().ownProfileLoadFailed).toBe(true));
      await user.click(topRow());
      await screen.findByTestId('settings-profile-header');

      expect(store().ownProfile).toBeNull();
      expect(nameRow()).toBeEnabled();
      expect(birthdayRow()).toBeEnabled();
      expect(nameRow()).toHaveAccessibleName('Name');
      expect(birthdayRow()).toHaveAccessibleName('Birthday');

      await user.click(nameRow());
      expect(nameField()).toHaveValue('');
      await user.click(screen.getByRole('button', { name: 'Back' }));
      await user.click(birthdayRow());
      expect(birthdayField()).toHaveValue('');
    });

    it('shows the saved copy offline and prefills the Name page from it', async () => {
      const user = userEvent.setup();
      await writeLocalCopy(store().userId!, PROFILE_COPY_KIND, {
        displayName: 'Jessie',
        birthday: null,
      });
      setOnline(false);
      render(<Settings />);
      await waitFor(() => expect(topRow()).toHaveTextContent('Jessie'));
      await user.click(topRow());
      await screen.findByTestId('settings-profile-header');

      expect(backend.fetchOwnProfile).not.toHaveBeenCalled();
      expect(nameRow()).toBeEnabled();
      expect(nameRow()).toHaveTextContent('Jessie');
      await user.click(nameRow());
      expect(nameField()).toHaveValue('Jessie');
    });

    it('reads Not set for a name and a birthday that are not set', async () => {
      const user = userEvent.setup();
      backend.row = { display_name: null, birthday: null };
      await renderSettings();

      await openProfile(user);

      expect(nameRow()).toHaveTextContent('Not set');
      expect(birthdayRow()).toHaveTextContent('Not set');
    });
  });

  describe('the Profile header', () => {
    it('shows the name, the email and the name\'s initial', async () => {
      const user = userEvent.setup();
      await renderSettings();

      await openProfile(user);

      const header = screen.getByTestId('settings-profile-header');
      expect(within(header).getByText('Jessie')).toBeInTheDocument();
      expect((await screen.findByTestId('settings-email')).textContent).toBe(EMAIL);
      expect(screen.getByTestId('settings-avatar').textContent).toBe('J');
      expect(header).not.toHaveTextContent('Signed in');
    });

    it('takes the initial from the email when no display name is set', async () => {
      const user = userEvent.setup();
      backend.row = { display_name: null, birthday: null };
      await renderSettings();

      await openProfile(user);

      expect((await screen.findByTestId('settings-email')).textContent).toBe(EMAIL);
      expect(screen.getByTestId('settings-avatar').textContent).toBe('P');
      expect(screen.queryByTestId('settings-profile-header-name')).not.toBeInTheDocument();
    });

    it.each([
      ['a whole emoji, not half a surrogate pair, for an emoji-led name', '💖 Jessie', '💖'],
      ['a whole multi-code-point emoji for a skin-tone emoji', '👍🏽 Jessie', '👍🏽'],
    ])('shows %s', async (_what, name, initial) => {
      const user = userEvent.setup();
      backend.row = { display_name: name, birthday: null };
      await renderSettings();

      await openProfile(user);

      expect((await screen.findByTestId('settings-email')).textContent).toBe(EMAIL);
      expect(screen.getByTestId('settings-avatar').textContent).toBe(initial);
    });

    it('renders no email line when the session has none', async () => {
      const user = userEvent.setup();
      backend.getSession.mockResolvedValue({ user: { id: 'user-a' } });
      await renderSettings();

      await openProfile(user);
      await act(async () => {
        await backend.getSession.mock.results[0]?.value;
      });

      expect(screen.queryByTestId('settings-email')).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-view')).not.toHaveTextContent(EMAIL);
      expect(screen.getByTestId('settings-avatar').textContent).toBe('J');
    });
  });

  describe('the Name page', () => {
    it('opens at /settings/profile/name with the current name in the focused field and Save off', async () => {
      const user = userEvent.setup();
      await renderSettings();

      await openNamePage(user);

      expect(window.location.pathname).toBe('/settings/profile/name');
      expect(screen.getByRole('heading', { level: 1, name: 'Name' })).toBeInTheDocument();
      expect(nameField()).toHaveValue('Jessie');
      expect(nameField()).toHaveFocus();
      expect(nameField()).toHaveAttribute('maxlength', '30');
      expect(nameField()).toHaveAttribute('autocomplete', 'nickname');
      expect(within(screen.getByTestId('settings-bar')).getByTestId('settings-field-save')).toBe(
        saveButton()
      );
      expect(saveButton()).toHaveTextContent('Save');
      expect(saveButton()).toBeDisabled();
    });

    it('follows the server\'s answer when the page opened on the saved copy, with Save still off', async () => {
      const user = userEvent.setup();
      await writeLocalCopy(store().userId!, PROFILE_COPY_KIND, {
        displayName: 'Jessie',
        birthday: null,
      });
      // The refresher is held, so the page opens on the copy's name.
      let release: (profile: OwnProfile) => void = () => {};
      backend.fetchOwnProfile.mockReturnValueOnce(
        new Promise<OwnProfile>((resolve) => {
          release = resolve;
        })
      );
      render(<Settings />);
      await waitFor(() => expect(topRow()).toHaveTextContent('Jessie'));
      await openProfile(user);
      await user.click(nameRow());
      expect(nameField()).toHaveValue('Jessie');

      release({ displayName: 'Casey', birthday: null });

      await waitFor(() => expect(nameField()).toHaveValue('Casey'));
      expect(saveButton()).toBeDisabled();
    });

    it('leaves an edited value alone when the saved name changes meanwhile', async () => {
      const user = userEvent.setup();
      await writeLocalCopy(store().userId!, PROFILE_COPY_KIND, {
        displayName: 'Jessie',
        birthday: null,
      });
      let release: (profile: OwnProfile) => void = () => {};
      backend.fetchOwnProfile.mockReturnValueOnce(
        new Promise<OwnProfile>((resolve) => {
          release = resolve;
        })
      );
      render(<Settings />);
      await waitFor(() => expect(topRow()).toHaveTextContent('Jessie'));
      await openProfile(user);
      await user.click(nameRow());
      await typeName(user, 'Typed');

      release({ displayName: 'Casey', birthday: null });

      await waitFor(() => expect(store().ownProfile?.displayName).toBe('Casey'));
      expect(nameField()).toHaveValue('Typed');
      expect(saveButton()).toBeEnabled();
    });

    it('leaves the field empty when there is no name to prefill', async () => {
      const user = userEvent.setup();
      backend.row = { display_name: null, birthday: null };
      await renderSettings();

      await openNamePage(user);

      expect(nameField()).toHaveValue('');
    });

    describe('Save', () => {
      it('writes display_name once, then returns to Profile with the new name shown everywhere, no reload', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);

        await typeName(user, 'Casey');
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        await waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
        expect(backend.updates).toHaveLength(1);
        expect(Object.keys(backend.updates[0]).sort()).toEqual(['display_name', 'updated_at']);
        expect(backend.updates[0].display_name).toBe('Casey');
        // No re-read: the write returns the stored row.
        expect(backend.fetchOwnProfile).toHaveBeenCalledTimes(1);
        // The store, where Home reads it.
        expect(store().ownProfile?.displayName).toBe('Casey');
        // The Name row and the header, still on the Profile page.
        expect(nameRow()).toHaveTextContent('Casey');
        expect(within(screen.getByTestId('settings-profile-header')).getByText('Casey')).toBeInTheDocument();
        expect(screen.getByTestId('settings-avatar').textContent).toBe('C');
        // And the top page's Profile row, after back.
        await user.click(screen.getByRole('button', { name: 'Back' }));
        await waitFor(() => expect(topRow()).toHaveTextContent('Casey'));
      });

      it('trims the name it writes', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);

        await typeName(user, '  Casey  ');
        await user.click(saveButton());

        await waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
        expect(backend.updates[0].display_name).toBe('Casey');
      });

      it('submits on Enter the same way', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);

        await typeName(user, 'Casey');
        await user.keyboard('{Enter}');

        await waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
        expect(backend.updates).toHaveLength(1);
      });

      it('stays off for a name that is too short, too long, blank or unchanged', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);

        await typeName(user, 'ab');
        expect(saveButton()).toBeDisabled();
        // Past what the field lets a person type, as a paste or autofill can.
        fireEvent.change(nameField(), { target: { value: 'a'.repeat(31) } });
        expect(saveButton()).toBeDisabled();
        fireEvent.change(nameField(), { target: { value: '   ' } });
        expect(saveButton()).toBeDisabled();
        fireEvent.change(nameField(), { target: { value: '  Jessie ' } });
        expect(saveButton()).toBeDisabled();
        await user.keyboard('{Enter}');

        expect(backend.updates).toHaveLength(0);
        expect(window.location.pathname).toBe('/settings/profile/name');
      });

      it.each([
        ['the account email', 'person@example.com', /different from your email address/],
        ['the account email in other case', 'Person@Example.com', /different from your email address/],
        ['Unknown', 'Unknown', /"Unknown" is not a name/],
      ])('refuses %s in the Error box, keeps the value and writes nothing', async (_what, name, message) => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);

        await typeName(user, name);
        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(message);
        expect(screen.getByTestId('settings-field-error')).toHaveAttribute('role', 'alert');
        expect(nameField()).toHaveValue(name);
        expect(window.location.pathname).toBe('/settings/profile/name');
        expect(backend.updates).toHaveLength(0);
        expect(store().ownProfile?.displayName).toBe('Jessie');
      });

      it('offline: refuses in the Error box with no request, keeps the typed value and the row', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);
        await typeName(user, 'Casey');

        setOnline(false);
        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(OFFLINE_NAME);
        expect(nameField()).toHaveValue('Casey');
        expect(backend.updates).toHaveLength(0);
        expect(window.location.pathname).toBe('/settings/profile/name');
        expect(store().ownProfile?.displayName).toBe('Jessie');
      });

      it('on a service error: shows the message, keeps the value and the row, clears on the next Save', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);
        await typeName(user, 'Casey');

        backend.failWith = {
          data: null,
          error: { message: 'boom', code: '500', details: '', hint: '' },
        };
        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(/boom/);
        expect(nameField()).toHaveValue('Casey');
        expect(window.location.pathname).toBe('/settings/profile/name');
        expect(store().ownProfile?.displayName).toBe('Jessie');
        expect(saveButton()).toBeEnabled();

        backend.failWith = null;
        await user.click(saveButton());

        await waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
        expect(screen.queryByTestId('settings-field-error')).not.toBeInTheDocument();
        expect(nameRow()).toHaveTextContent('Casey');
      });

      it('fails closed when the update touches no row', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);
        await typeName(user, 'Casey');

        // The RLS shape: nothing written, and no error either.
        backend.failWith = { data: null, error: null };
        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(
          'Could not find your profile to save the name to'
        );
        expect(window.location.pathname).toBe('/settings/profile/name');
        expect(store().ownProfile?.displayName).toBe('Jessie');
      });
    });

    describe('leaving', () => {
      it('discards the edit without a write, and a reopened page shows the stored name', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);
        await typeName(user, 'Discarded');

        await user.click(screen.getByRole('button', { name: 'Back' }));

        await waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
        expect(nameRow()).toHaveTextContent('Jessie');
        expect(backend.updates).toHaveLength(0);

        await user.click(nameRow());
        expect(await screen.findByLabelText('Name')).toHaveValue('Jessie');
      });

      it('clears the Error box, so the reopened page has none', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openNamePage(user);
        await typeName(user, 'Unknown');
        await user.click(saveButton());
        await screen.findByTestId('settings-field-error');

        await user.click(screen.getByRole('button', { name: 'Back' }));
        await waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
        await user.click(nameRow());

        expect(await screen.findByLabelText('Name')).toHaveValue('Jessie');
        expect(screen.queryByTestId('settings-field-error')).not.toBeInTheDocument();
      });
    });

    describe('a reload or a fresh load at /settings/profile/name', () => {
      it('shows Profile, and one back arrow press returns to the top page', async () => {
        const user = userEvent.setup();
        window.history.replaceState(null, '', '/settings/profile/name');
        useAppStore.setState({ settingsPath: 'profile/name' });
        render(<Settings />);

        expect(await screen.findByTestId('settings-profile-header')).toBeInTheDocument();
        expect(screen.queryByTestId('settings-name-page')).not.toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/profile');

        await user.click(screen.getByRole('button', { name: 'Back' }));

        expect(window.location.pathname).toBe('/settings');
        expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      });
    });
  });

  describe('the Birthday page', () => {
    it('opens at /settings/profile/birthday with an empty field and Save off when not set', async () => {
      const user = userEvent.setup();
      await renderSettings();

      await openBirthdayPage(user);

      expect(window.location.pathname).toBe('/settings/profile/birthday');
      expect(screen.getByRole('heading', { level: 1, name: 'Birthday' })).toBeInTheDocument();
      expect(birthdayField()).toHaveValue('');
      expect(birthdayField()).toHaveAttribute('type', 'date');
      expect(saveButton()).toBeDisabled();
    });

    it('prefills a saved birthday, and offers no Clear', async () => {
      const user = userEvent.setup();
      backend.row.birthday = '2000-05-20';
      await renderSettings();

      await openBirthdayPage(user);

      expect(birthdayField()).toHaveValue('2000-05-20');
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it('saves the picked date as YYYY-MM-DD, returns to Profile and shows it on the row', async () => {
      const user = userEvent.setup();
      await renderSettings();
      await openBirthdayPage(user);

      await user.type(birthdayField(), '2000-05-20');
      await user.click(saveButton());

      await waitFor(() => expect(window.location.pathname).toBe('/settings/profile'));
      expect(backend.updates).toHaveLength(1);
      expect(Object.keys(backend.updates[0]).sort()).toEqual(['birthday', 'updated_at']);
      expect(backend.updates[0].birthday).toBe('2000-05-20');
      expect(store().ownProfile?.birthday).toBe('2000-05-20');
      expect(birthdayRow()).toHaveTextContent('2000');
    });

    describe('"in the past", against a pinned clock', () => {
      // Pinned before each render: the field reads the clock both for its `max`
      // and when it validates. Only `Date` is faked, so RTL's `waitFor` keeps
      // its real timers.
      beforeEach(() => {
        vi.setSystemTime(new Date(2026, 8, 25, 12, 0, 0));
      });

      it('keeps Save off for today and for a later day, and sends nothing', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openBirthdayPage(user);

        await user.type(birthdayField(), '2026-09-25');
        expect(saveButton()).toBeDisabled();
        await user.clear(birthdayField());
        await user.type(birthdayField(), '2026-09-26');
        expect(saveButton()).toBeDisabled();
        await user.keyboard('{Enter}');

        expect(backend.updates).toHaveLength(0);
        expect(window.location.pathname).toBe('/settings/profile/birthday');
      });

      it('accepts yesterday, the latest date the field offers', async () => {
        const user = userEvent.setup();
        await renderSettings();
        await openBirthdayPage(user);

        expect(birthdayField()).toHaveAttribute('max', '2026-09-24');
        await user.type(birthdayField(), '2026-09-24');
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        await waitFor(() => expect(backend.updates.at(-1)?.birthday).toBe('2026-09-24'));
      });
    });

    it('keeps Save off for a birthday before 1900 (a mistyped year)', async () => {
      const user = userEvent.setup();
      await renderSettings();
      await openBirthdayPage(user);

      expect(birthdayField()).toHaveAttribute('min', '1900-01-01');
      await user.type(birthdayField(), '0198-03-10');

      expect(saveButton()).toBeDisabled();
      expect(backend.updates).toHaveLength(0);
    });

    it('offline: refuses in the Error box with no request, keeps the typed date and the row', async () => {
      const user = userEvent.setup();
      backend.row.birthday = '2000-05-20';
      await renderSettings();
      await openBirthdayPage(user);
      await user.clear(birthdayField());
      await user.type(birthdayField(), '1999-04-11');

      setOnline(false);
      await user.click(saveButton());

      expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(OFFLINE_PROFILE);
      expect(birthdayField()).toHaveValue('1999-04-11');
      expect(backend.updates).toHaveLength(0);
      expect(store().ownProfile?.birthday).toBe('2000-05-20');
      expect(window.location.pathname).toBe('/settings/profile/birthday');
    });

    it('on a service error: shows the message and keeps the value and the row', async () => {
      const user = userEvent.setup();
      backend.row.birthday = '2000-05-20';
      await renderSettings();
      await openBirthdayPage(user);
      await user.clear(birthdayField());
      await user.type(birthdayField(), '1999-04-11');

      backend.failWith = {
        data: null,
        error: { message: 'boom', code: '500', details: '', hint: '' },
      };
      await user.click(saveButton());

      expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(/boom/);
      expect(birthdayField()).toHaveValue('1999-04-11');
      expect(store().ownProfile?.birthday).toBe('2000-05-20');
    });

    it('shows Profile after a reload at /settings/profile/birthday', async () => {
      window.history.replaceState(null, '', '/settings/profile/birthday');
      useAppStore.setState({ settingsPath: 'profile/birthday' });
      render(<Settings />);

      expect(await screen.findByTestId('settings-profile-header')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-birthday-page')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/profile');
    });
  });
});
