/**
 * Saving a chosen name: one profile write, and it fails closed.
 *
 * The old flow wrote `auth.updateUser({ data: { display_name } })` and then
 * upserted `{ id, updated_at }` into `public.users`, swallowing any error from
 * that upsert because "user_metadata update is what matters". After story 8 the
 * profile row is the only home for the name, so the upsert's error is no longer
 * incidental — it IS the save failing, and closing the modal on it would drop
 * the user into an app still showing their email with nothing to retry.
 *
 * Two things are pinned here and neither is cosmetic:
 *
 * 1. No auth write of any kind. `authenticated` also no longer holds UPDATE on
 *    `users.id`, so the old upsert shape would now be refused outright.
 * 2. A write that does not land keeps the modal open and says why. RLS turns a
 *    write the caller may not make into a ZERO-ROW update rather than an error,
 *    so "no error" is not the same as "saved" and the row count has to be
 *    checked too.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PostgrestError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type UpdateResult = { data: { id: string }[] | null; error: PostgrestError | null };

const backend = vi.hoisted(() => ({
  result: { data: [{ id: 'user-a' }], error: null } as UpdateResult,
  updatePayload: null as Record<string, unknown> | null,
  eqColumn: null as string | null,
  eqValue: null as unknown,
  updateUser: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  // Mirrors the real export. Not `importActual`: this module throws at import
  // time when the VITE_SUPABASE_* env vars are absent. The read side's own use
  // of this value is pinned against the REAL module in
  // tests/unit/api/ownDisplayNameContract.test.ts, so the two cannot drift
  // unnoticed.
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: {
    from: (table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`);
      return {
        update: (payload: Record<string, unknown>) => {
          backend.updatePayload = payload;
          return {
            eq: (column: string, value: unknown) => {
              backend.eqColumn = column;
              backend.eqValue = value;
              return { select: async () => backend.result };
            },
          };
        },
        // Present so a regression back to the old shape is a failed assertion
        // rather than a TypeError that could be mistaken for an unrelated bug.
        upsert: async () => ({ error: null }),
      };
    },
    auth: { updateUser: backend.updateUser },
  },
}));
vi.mock('../../../api/auth/sessionService', () => ({ getUser: backend.getUser }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { DisplayNameSetup } from '../DisplayNameSetup';

function submit(name: string, onComplete = vi.fn()) {
  render(<DisplayNameSetup isOpen onComplete={onComplete} />);
  fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: name } });
  fireEvent.click(screen.getByTestId('display-name-submit'));
  return onComplete;
}

/**
 * Submit the form directly, bypassing the native constraint validation the
 * input's `required`/`minLength` attributes trigger. A click cannot reach the
 * component's OWN length check — the browser refuses the submit first — so a
 * click-driven test would assert the platform's behaviour and leave
 * `validateDisplayName` untested.
 */
function submitPastNativeValidation(name: string, onComplete = vi.fn()) {
  const { container } = render(<DisplayNameSetup isOpen onComplete={onComplete} />);
  fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: name } });
  fireEvent.submit(container.querySelector('form')!);
  return onComplete;
}

describe('DisplayNameSetup saves the name to the profile row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.result = { data: [{ id: 'user-a' }], error: null };
    backend.updatePayload = null;
    backend.eqColumn = null;
    backend.eqValue = null;
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
  });

  afterEach(() => {
    cleanup();
  });

  it('writes display_name scoped to the caller and completes', async () => {
    const onComplete = submit('Frankie');

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(backend.updatePayload).toMatchObject({ display_name: 'Frankie' });
    expect(backend.eqColumn).toBe('id');
    expect(backend.eqValue).toBe('user-a');
    expect(screen.queryByTestId('display-name-error')).not.toBeInTheDocument();
  });

  it('sets updated_at itself, because no trigger does', async () => {
    // `public.users` has no BEFORE UPDATE trigger, and the column grant covers
    // exactly (display_name, updated_at) so this is the client's job.
    const onComplete = submit('Frankie');

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(typeof backend.updatePayload?.updated_at).toBe('string');
    expect(Number.isNaN(Date.parse(String(backend.updatePayload?.updated_at)))).toBe(false);
  });

  it('never writes auth metadata', async () => {
    const onComplete = submit('Frankie');

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(backend.updateUser).not.toHaveBeenCalled();
  });

  it('sends no column the caller may not write', async () => {
    // `id`, `email`, `partner_id`, `created_at` are all outside the grant, and
    // naming any of them makes the whole PATCH a 42501.
    const onComplete = submit('Frankie');

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(Object.keys(backend.updatePayload ?? {}).sort()).toEqual(['display_name', 'updated_at']);
  });

  it('shows the failure inline and stays open when the write errors', async () => {
    // A real PostgrestError, which extends Error: the component re-raises the
    // Supabase error object and only an Error carries its message through to the
    // banner. A plain `{ message }` would land on the generic fallback text, so
    // the faithful shape is what makes this assertion meaningful.
    backend.result = {
      data: null,
      error: new PostgrestError({
        message: 'permission denied for table users',
        code: '42501',
        details: '',
        hint: '',
      }),
    };
    const onComplete = submit('Frankie');

    await waitFor(() =>
      expect(screen.getByTestId('display-name-error')).toHaveTextContent(
        'permission denied for table users'
      )
    );
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId('display-name-setup')).toBeInTheDocument();
  });

  it('shows the failure inline and stays open when the write matches no row', async () => {
    // The RLS shape: no error, no rows, nothing saved. The old code would have
    // called onComplete here.
    backend.result = { data: [], error: null };
    const onComplete = submit('Frankie');

    await waitFor(() =>
      expect(screen.getByTestId('display-name-error')).toHaveTextContent(
        'Could not find your profile to save the name to'
      )
    );
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId('display-name-setup')).toBeInTheDocument();
  });

  it('reports a missing session without attempting a write', async () => {
    backend.getUser.mockResolvedValue(null);
    const onComplete = submit('Frankie');

    await waitFor(() =>
      expect(screen.getByTestId('display-name-error')).toHaveTextContent('User not authenticated')
    );
    expect(backend.updatePayload).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  // The read side calls a stored name equal to the account email, or the literal
  // 'Unknown', "no name chosen" — and recomputes that on every read. Saving one
  // would re-open this modal on every reload and every token refresh, for good.
  // The length rule alone caught neither: an email of <=30 chars passes it, and
  // so does 'Unknown'.
  it.each([
    ['the account email verbatim', 'person@example.com'],
    ['the account email in another case', 'Person@Example.COM'],
    ['the account email with stray whitespace', '  person@example.com  '],
  ])('refuses %s without writing', async (_label, name) => {
    const onComplete = submit(name);

    await waitFor(() =>
      expect(screen.getByTestId('display-name-error')).toHaveTextContent(
        'Please choose a name that is different from your email address'
      )
    );
    expect(backend.updatePayload).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId('display-name-setup')).toBeInTheDocument();
  });

  it("refuses the literal 'Unknown' without writing", async () => {
    const onComplete = submit('Unknown');

    // The exact message, not merely "an error is shown": any throw inside
    // handleSubmit renders this same element, so a looser assertion passes on
    // failures that have nothing to do with the guard.
    await waitFor(() =>
      expect(screen.getByTestId('display-name-error')).toHaveTextContent(
        'is not a name — please choose another'
      )
    );
    expect(backend.updatePayload).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('still accepts a name that merely contains the email or the seed word', async () => {
    // The rule is equality, not containment — refusing these would reject names
    // the read side is perfectly happy to call chosen.
    const onComplete = submit('Unknown Soldier');

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(backend.updatePayload).toMatchObject({ display_name: 'Unknown Soldier' });
  });

  it('accepts a chosen name when the account carries no email to compare against', async () => {
    backend.getUser.mockResolvedValue({ id: 'user-a', email: null });
    const onComplete = submit('Frankie');

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(backend.updatePayload).toMatchObject({ display_name: 'Frankie' });
  });

  it('rejects a too-short name before touching the network', async () => {
    const onComplete = submitPastNativeValidation('ab');

    await waitFor(() =>
      expect(screen.getByTestId('display-name-error')).toHaveTextContent(
        'Display name must be between 3 and 30 characters'
      )
    );
    expect(backend.getUser).not.toHaveBeenCalled();
    expect(backend.updatePayload).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
