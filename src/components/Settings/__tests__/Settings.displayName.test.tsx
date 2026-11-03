/**
 * DW-130: a route back to the display-name form.
 *
 * `DisplayNameSetup` is the only UI in the app that writes `display_name`, and
 * until now App rendered it on exactly one condition — `needsDisplayName`, set
 * solely when `lookupOwnDisplayName()` answers `unset`. Answering it once made
 * that condition false forever, so a name chosen in a hurry at signup was the
 * name the partner saw on every note from then on, with nothing anywhere in the
 * app able to change it.
 *
 * Settings is the way back. The real `DisplayNameSetup` is rendered here rather
 * than a stub, because the two things worth pinning are precisely the seam
 * between them: that the field arrives carrying the name the row actually
 * holds, and that Settings re-reads the row afterwards instead of trusting the
 * string it just watched go by. The row reads the store's `ownProfile` through
 * `loadOwnProfile` (profileSlice), so the profile read is stubbed at
 * `profileService.fetchOwnProfile` and the store is real.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDataError } from '../../../services/accountDataError';
import type { OwnProfile } from '../../../services/profileService';

type UpdateResult = { data: { id: string }[] | null; error: null };

const backend = vi.hoisted(() => ({
  fetchOwnProfile: vi.fn<() => Promise<OwnProfile>>(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  sessionUser: vi.fn(),
  updatePayload: null as Record<string, unknown> | null,
  updateResult: { data: [{ id: 'user-a' }], error: null } as UpdateResult,
}));

// Not `importActual`: the real module throws at import time without the
// VITE_SUPABASE_* env vars. `supabase` and `SEED_FALLBACK_NAME` are here
// because the REAL DisplayNameSetup is mounted below and reaches for both;
// their true shapes are pinned against the real module in
// tests/unit/api/ownDisplayNameContract.test.ts. `lookupPartnerId` is there
// for the real store's dates slice, which imports it.
vi.mock('../../../api/supabaseClient', () => ({
  lookupPartnerId: vi.fn(),
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: {
    from: (table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`);
      return {
        update: (payload: Record<string, unknown>) => {
          backend.updatePayload = payload;
          return { eq: () => ({ select: async () => backend.updateResult }) };
        },
      };
    },
  },
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: backend.getUser, signOut: backend.signOut },
}));
vi.mock('../../../api/auth/sessionService', () => ({ getUser: backend.sessionUser }));
vi.mock('../../../services/profileService', () => ({
  profileService: { fetchOwnProfile: backend.fetchOwnProfile, saveBirthday: vi.fn() },
}));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// The other two Account-adjacent sections pull in the events store and the
// anniversary storage; neither has anything to do with the name.
vi.mock('../AnniversarySettings', () => ({ AnniversarySettings: () => null }));
vi.mock('../EventsSettings', () => ({ EventsSettings: () => null }));

import { writeLocalCopy } from '../../../services/localCopy';
import { PROFILE_COPY_KIND } from '../../../stores/slices/profileSlice';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';

/** What the profile read answers for a chosen name. */
const chosen = (displayName: string): OwnProfile => ({ displayName, birthday: null });

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

let accountCounter = 0;

const nameRow = () => screen.getByTestId('settings-display-name');
const changeButton = () => screen.getByTestId('settings-display-name-edit');
const nameField = () => screen.getByLabelText('Display Name');

/** Render Settings and wait for the first profile read to land on the row. */
async function renderSettings(expected: string) {
  render(<Settings />);
  // textContent, not toHaveTextContent: that matcher is a substring match, so
  // 'Jessie' would pass against a row still reading 'Loading...Jessie'.
  await waitFor(() => expect(nameRow().textContent).toContain(expected));
}

describe('Settings offers a way to change the display name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.updatePayload = null;
    backend.updateResult = { data: [{ id: 'user-a' }], error: null };
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.sessionUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.fetchOwnProfile.mockResolvedValue(chosen('Jessie'));
    // A fresh account and session per case, so no saved copy or "fresh" mark
    // from an earlier case decides what this one shows.
    accountCounter += 1;
    useAppStore.setState({
      userId: `user-${accountCounter}`,
      authSessionVersion: accountCounter,
      ownProfile: null,
      ownProfileLoadFailed: false,
    });
  });

  afterEach(() => {
    cleanup();
    setOnline(true);
    useAppStore.setState({ userId: null, ownProfile: null, ownProfileLoadFailed: false });
  });

  describe('the row reports whatever the profile read answered', () => {
    it('shows Loading... with Change disabled until the first read answers', async () => {
      let releaseRead: (v: OwnProfile) => void = () => {};
      backend.fetchOwnProfile.mockReturnValueOnce(
        new Promise<OwnProfile>((resolve) => {
          releaseRead = resolve;
        })
      );
      render(<Settings />);

      expect(nameRow().textContent).toBe('Loading...');
      expect(changeButton()).toBeDisabled();

      releaseRead(chosen('Jessie'));

      await waitFor(() => expect(nameRow().textContent).toBe('Jessie'));
      expect(changeButton()).toBeEnabled();
    });

    it('shows a chosen name', async () => {
      await renderSettings('Jessie');

      expect(nameRow().textContent).toBe('Jessie');
    });

    it('says so when no name has been chosen yet', async () => {
      backend.fetchOwnProfile.mockResolvedValue({ displayName: null, birthday: null });
      await renderSettings('Not set yet');

      // Not the email, and not a blank: the label has to be distinguishable
      // from a name someone actually picked.
      expect(nameRow().textContent).not.toContain('@');
    });

    it('says the name could not be loaded when the read fails', async () => {
      backend.fetchOwnProfile.mockRejectedValue(new AccountDataError('transport', 'boom'));
      await renderSettings("Couldn't load your name");

      // A failed read is not evidence the name is unset, so it must not read as
      // one — same fail-open-on-display rule App applies to its setup gate.
      expect(nameRow().textContent).not.toContain('Not set yet');
      expect(useAppStore.getState().ownProfileLoadFailed).toBe(true);
    });

    it('says the name could not be loaded when offline, even with a saved copy', async () => {
      const user = userEvent.setup();
      const { userId } = useAppStore.getState();
      await writeLocalCopy(userId!, PROFILE_COPY_KIND, chosen('Jessie'));
      setOnline(false);
      await renderSettings("Couldn't load your name");

      // The saved copy reaches the store, but the row has no server answer to
      // vouch for it, so it neither shows nor prefills it.
      expect(backend.fetchOwnProfile).not.toHaveBeenCalled();
      expect(useAppStore.getState().ownProfile?.displayName).toBe('Jessie');
      expect(changeButton()).toBeEnabled();
      await user.click(changeButton());
      expect(nameField()).toHaveValue('');
    });
  });

  describe('the Change control opens the real form', () => {
    it('is closed until asked for', async () => {
      await renderSettings('Jessie');

      expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument();
    });

    it('opens the form with the current name already in the field', async () => {
      const user = userEvent.setup();
      await renderSettings('Jessie');

      await user.click(changeButton());

      expect(screen.getByTestId('display-name-setup')).toBeInTheDocument();
      expect(nameField()).toHaveValue('Jessie');
    });

    it('offers a Cancel control, unlike the signup gate', async () => {
      const user = userEvent.setup();
      await renderSettings('Jessie');

      await user.click(changeButton());

      expect(screen.getByTestId('display-name-cancel')).toBeInTheDocument();
    });

    it('still offers editing after a failed read, with an empty field', async () => {
      const user = userEvent.setup();
      // The read failing says nothing about whether the user knows the name
      // they want. An empty field rather than a guess: pre-filling something
      // the row may not hold invites saving it back over the real value.
      backend.fetchOwnProfile.mockRejectedValue(new AccountDataError('transport', 'boom'));
      await renderSettings("Couldn't load your name");

      expect(changeButton()).toBeEnabled();
      await user.click(changeButton());

      expect(nameField()).toHaveValue('');
    });

    it('leaves the field empty when there is no name to prefill', async () => {
      const user = userEvent.setup();
      backend.fetchOwnProfile.mockResolvedValue({ displayName: null, birthday: null });
      await renderSettings('Not set yet');

      await user.click(changeButton());

      expect(nameField()).toHaveValue('');
    });
  });

  describe('completing the form re-reads the row', () => {
    /** Saves `name` through the form and waits for the re-read to reach the row. */
    async function saveNameAs(user: UserEvent, name: string) {
      await user.click(changeButton());
      await user.clear(nameField());
      await user.type(nameField(), name);

      // The second read is what the row renders from — the component never
      // takes the submitted string for granted, because the read applies the
      // seed rule and the write only refuses it.
      backend.fetchOwnProfile.mockResolvedValue(chosen(name));
      await user.click(screen.getByTestId('display-name-submit'));

      await waitFor(() => expect(nameRow().textContent).toBe(name));
    }

    it('shows the saved name without a reload', async () => {
      const user = userEvent.setup();
      await renderSettings('Jessie');
      await saveNameAs(user, 'Casey');

      expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument();
      expect(backend.fetchOwnProfile).toHaveBeenCalledTimes(2);
    });

    it('writes the new name to the users row', async () => {
      const user = userEvent.setup();
      await renderSettings('Jessie');
      await saveNameAs(user, 'Casey');

      expect(backend.updatePayload).toMatchObject({ display_name: 'Casey' });
    });

    it('puts the saved name in the store, where Home reads it', async () => {
      const user = userEvent.setup();
      await renderSettings('Jessie');
      await saveNameAs(user, 'Casey');

      // Home's own birthday card is labelled with the name: it reads the store.
      expect(useAppStore.getState().ownProfile?.displayName).toBe('Casey');
    });

    it('says the name could not be loaded when the re-read fails, with an empty field', async () => {
      const user = userEvent.setup();
      await renderSettings('Jessie');

      await user.click(changeButton());
      await user.clear(nameField());
      await user.type(nameField(), 'Casey');
      // The store still holds the pre-save name; prefilling it would write it
      // back over the name just stored.
      backend.fetchOwnProfile.mockRejectedValue(new AccountDataError('transport', 'boom'));
      await user.click(screen.getByTestId('display-name-submit'));

      await waitFor(() => expect(nameRow().textContent).toBe("Couldn't load your name"));
      expect(changeButton()).toBeEnabled();
      await user.click(changeButton());
      expect(nameField()).toHaveValue('');
    });

    it('disables Change across the re-read, so the old name cannot be saved back', async () => {
      const user = userEvent.setup();
      // The window this closes: `onComplete` used to bump the read token while
      // the row still held the PRE-save answer, leaving Change live. A click in
      // that window reopened the form prefilled from `editPrefill` — derived
      // from that stale answer — and the next submit wrote the OLD name
      // straight back over the one just saved.
      await renderSettings('Jessie');

      await user.click(changeButton());
      await user.clear(nameField());
      await user.type(nameField(), 'Casey');

      // Hold the re-read open so the window is observable at all.
      let releaseReRead: (v: OwnProfile) => void = () => {};
      backend.fetchOwnProfile.mockReturnValueOnce(
        new Promise<OwnProfile>((resolve) => {
          releaseReRead = resolve;
        })
      );

      await user.click(screen.getByTestId('display-name-submit'));

      // The form has closed and the re-read has not answered yet.
      await waitFor(() => expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument());
      await waitFor(() => expect(changeButton()).toBeDisabled());
      expect(nameRow().textContent).toBe('Loading...');

      releaseReRead(chosen('Casey'));

      await waitFor(() => expect(nameRow().textContent).toBe('Casey'));
      expect(changeButton()).toBeEnabled();
      // Reopening now prefills from the SAVED name, not the pre-save one.
      await user.click(changeButton());
      expect(nameField()).toHaveValue('Casey');
    });

    it('renders what the row answered, not what was typed', async () => {
      const user = userEvent.setup();
      // If the re-read is ever replaced by "just show the submitted value",
      // this is the case that catches it: the row is the source of truth for
      // every other surface, so Settings must agree with it or silently lie.
      await renderSettings('Jessie');

      await user.click(changeButton());
      await user.clear(nameField());
      await user.type(nameField(), 'Casey');

      backend.fetchOwnProfile.mockResolvedValue(chosen('Trimmed By The Row'));
      await user.click(screen.getByTestId('display-name-submit'));

      await waitFor(() => expect(nameRow().textContent).toBe('Trimmed By The Row'));
    });

    it('keeps the form open and the row unchanged when the save fails closed', async () => {
      const user = userEvent.setup();
      // Zero rows: the RLS shape, where nothing was written.
      backend.updateResult = { data: [], error: null };
      await renderSettings('Jessie');

      await user.click(changeButton());
      await user.clear(nameField());
      await user.type(nameField(), 'Casey');
      await user.click(screen.getByTestId('display-name-submit'));

      await waitFor(() => expect(screen.getByTestId('display-name-error')).toBeInTheDocument());
      expect(screen.getByTestId('display-name-setup')).toBeInTheDocument();
      expect(nameRow().textContent).toBe('Jessie');
      expect(backend.fetchOwnProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelling changes nothing', () => {
    it('closes the form without a write or a re-read', async () => {
      const user = userEvent.setup();
      await renderSettings('Jessie');

      await user.click(changeButton());
      await user.clear(nameField());
      await user.type(nameField(), 'Discarded');
      await user.click(screen.getByTestId('display-name-cancel'));

      expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument();
      expect(nameRow().textContent).toBe('Jessie');
      expect(backend.updatePayload).toBeNull();
      expect(backend.fetchOwnProfile).toHaveBeenCalledTimes(1);
    });

    it('discards the abandoned edit, so reopening shows the stored name again', async () => {
      const user = userEvent.setup();
      // The form is mounted conditionally precisely so that each open is a
      // fresh mount; kept mounted behind `isOpen={false}` it would come back
      // still holding 'Discarded'.
      await renderSettings('Jessie');

      await user.click(changeButton());
      await user.clear(nameField());
      await user.type(nameField(), 'Discarded');
      await user.click(screen.getByTestId('display-name-cancel'));
      await user.click(changeButton());

      expect(nameField()).toHaveValue('Jessie');
    });
  });
});
