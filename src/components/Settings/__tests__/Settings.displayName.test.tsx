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
 * string it just watched go by.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type UpdateResult = { data: { id: string }[] | null; error: null };

const backend = vi.hoisted(() => ({
  lookupOwnDisplayName: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  sessionUser: vi.fn(),
  refreshLocalCopy: vi.fn(async (_kind: string) => {}),
  updatePayload: null as Record<string, unknown> | null,
  updateResult: { data: [{ id: 'user-a' }], error: null } as UpdateResult,
}));

// Not `importActual`: the real module throws at import time without the
// VITE_SUPABASE_* env vars. `supabase` and `SEED_FALLBACK_NAME` are here
// because the REAL DisplayNameSetup is mounted below and reaches for both;
// their true shapes are pinned against the real module in
// tests/unit/api/ownDisplayNameContract.test.ts.
vi.mock('../../../api/supabaseClient', () => ({
  lookupOwnDisplayName: backend.lookupOwnDisplayName,
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
vi.mock('../../../services/localCopy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/localCopy')>()),
  refreshLocalCopy: backend.refreshLocalCopy,
}));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// The other two Account-adjacent sections pull in the events store and the
// anniversary storage; neither has anything to do with the name.
vi.mock('../AnniversarySettings', () => ({ AnniversarySettings: () => null }));
vi.mock('../EventsSettings', () => ({ EventsSettings: () => null }));

import { Settings } from '../Settings';

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
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Jessie' });
  });

  afterEach(() => {
    cleanup();
  });

  describe('the row reports whatever the profile read answered', () => {
    it('shows a chosen name', async () => {
      await renderSettings('Jessie');

      expect(nameRow().textContent).toBe('Jessie');
    });

    it('says so when no name has been chosen yet', async () => {
      backend.lookupOwnDisplayName.mockResolvedValue({ status: 'unset' });
      await renderSettings('Not set yet');

      // Not the email, and not a blank: the label has to be distinguishable
      // from a name someone actually picked.
      expect(nameRow().textContent).not.toContain('@');
    });

    it('says the name could not be loaded when the read fails', async () => {
      backend.lookupOwnDisplayName.mockResolvedValue({ status: 'error', reason: 'boom' });
      await renderSettings("Couldn't load your name");

      // A failed read is not evidence the name is unset, so it must not read as
      // one — same fail-open-on-display rule App applies to its setup gate.
      expect(nameRow().textContent).not.toContain('Not set yet');
    });
  });

  describe('the Change control opens the real form', () => {
    it('is closed until asked for', async () => {
      await renderSettings('Jessie');

      expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument();
    });

    it('opens the form with the current name already in the field', async () => {
      await renderSettings('Jessie');

      fireEvent.click(changeButton());

      expect(screen.getByTestId('display-name-setup')).toBeInTheDocument();
      expect(nameField()).toHaveValue('Jessie');
    });

    it('offers a Cancel control, unlike the signup gate', async () => {
      await renderSettings('Jessie');

      fireEvent.click(changeButton());

      expect(screen.getByTestId('display-name-cancel')).toBeInTheDocument();
    });

    it('still offers editing after a failed read, with an empty field', async () => {
      // The read failing says nothing about whether the user knows the name
      // they want. An empty field rather than a guess: pre-filling something
      // the row may not hold invites saving it back over the real value.
      backend.lookupOwnDisplayName.mockResolvedValue({ status: 'error', reason: 'boom' });
      await renderSettings("Couldn't load your name");

      expect(changeButton()).toBeEnabled();
      fireEvent.click(changeButton());

      expect(nameField()).toHaveValue('');
    });

    it('leaves the field empty when there is no name to prefill', async () => {
      backend.lookupOwnDisplayName.mockResolvedValue({ status: 'unset' });
      await renderSettings('Not set yet');

      fireEvent.click(changeButton());

      expect(nameField()).toHaveValue('');
    });
  });

  describe('completing the form re-reads the row', () => {
    it('shows the saved name without a reload', async () => {
      await renderSettings('Jessie');

      fireEvent.click(changeButton());
      fireEvent.change(nameField(), { target: { value: 'Casey' } });

      // The second read is what the row renders from — the component never
      // takes the submitted string for granted, because the read applies the
      // seed rule and the write only refuses it.
      backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Casey' });
      fireEvent.click(screen.getByTestId('display-name-submit'));

      await waitFor(() => expect(nameRow().textContent).toBe('Casey'));
      expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument();
      expect(backend.updatePayload).toMatchObject({ display_name: 'Casey' });
      expect(backend.lookupOwnDisplayName).toHaveBeenCalledTimes(2);
      // Home's own birthday card is labelled with the name: its copy refreshes.
      expect(backend.refreshLocalCopy).toHaveBeenCalledWith('profile');
    });

    it('disables Change across the re-read, so the old name cannot be saved back', async () => {
      // The window this closes: `onComplete` used to bump the read token while
      // `nameLookup` still held the PRE-save answer, leaving Change live. A
      // click in that window reopened the form prefilled from `editPrefill` —
      // derived from that stale answer — and the next submit wrote the OLD name
      // straight back over the one just saved.
      await renderSettings('Jessie');

      fireEvent.click(changeButton());
      fireEvent.change(nameField(), { target: { value: 'Casey' } });

      // Hold the re-read open so the window is observable at all.
      let releaseReRead: (v: { status: 'chosen'; displayName: string }) => void = () => {};
      backend.lookupOwnDisplayName.mockReturnValueOnce(
        new Promise<{ status: 'chosen'; displayName: string }>((resolve) => {
          releaseReRead = resolve;
        })
      );

      fireEvent.click(screen.getByTestId('display-name-submit'));

      // The form has closed and the re-read has not answered yet.
      await waitFor(() => expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument());
      await waitFor(() => expect(changeButton()).toBeDisabled());

      releaseReRead({ status: 'chosen', displayName: 'Casey' });

      await waitFor(() => expect(nameRow().textContent).toBe('Casey'));
      expect(changeButton()).toBeEnabled();
      // Reopening now prefills from the SAVED name, not the pre-save one.
      fireEvent.click(changeButton());
      expect(nameField()).toHaveValue('Casey');
    });

    it('renders what the row answered, not what was typed', async () => {
      // If the re-read is ever replaced by "just show the submitted value",
      // this is the case that catches it: the row is the source of truth for
      // every other surface, so Settings must agree with it or silently lie.
      await renderSettings('Jessie');

      fireEvent.click(changeButton());
      fireEvent.change(nameField(), { target: { value: 'Casey' } });

      backend.lookupOwnDisplayName.mockResolvedValue({
        status: 'chosen',
        displayName: 'Trimmed By The Row',
      });
      fireEvent.click(screen.getByTestId('display-name-submit'));

      await waitFor(() => expect(nameRow().textContent).toBe('Trimmed By The Row'));
    });

    it('keeps the form open and the row unchanged when the save fails closed', async () => {
      // Zero rows: the RLS shape, where nothing was written.
      backend.updateResult = { data: [], error: null };
      await renderSettings('Jessie');

      fireEvent.click(changeButton());
      fireEvent.change(nameField(), { target: { value: 'Casey' } });
      fireEvent.click(screen.getByTestId('display-name-submit'));

      await waitFor(() => expect(screen.getByTestId('display-name-error')).toBeInTheDocument());
      expect(screen.getByTestId('display-name-setup')).toBeInTheDocument();
      expect(nameRow().textContent).toBe('Jessie');
      expect(backend.lookupOwnDisplayName).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelling changes nothing', () => {
    it('closes the form without a write or a re-read', async () => {
      await renderSettings('Jessie');

      fireEvent.click(changeButton());
      fireEvent.change(nameField(), { target: { value: 'Discarded' } });
      fireEvent.click(screen.getByTestId('display-name-cancel'));

      expect(screen.queryByTestId('display-name-setup')).not.toBeInTheDocument();
      expect(nameRow().textContent).toBe('Jessie');
      expect(backend.updatePayload).toBeNull();
      expect(backend.lookupOwnDisplayName).toHaveBeenCalledTimes(1);
    });

    it('discards the abandoned edit, so reopening shows the stored name again', async () => {
      // The form is mounted conditionally precisely so that each open is a
      // fresh mount; kept mounted behind `isOpen={false}` it would come back
      // still holding 'Discarded'.
      await renderSettings('Jessie');

      fireEvent.click(changeButton());
      fireEvent.change(nameField(), { target: { value: 'Discarded' } });
      fireEvent.click(screen.getByTestId('display-name-cancel'));
      fireEvent.click(changeButton());

      expect(nameField()).toHaveValue('Jessie');
    });
  });
});
