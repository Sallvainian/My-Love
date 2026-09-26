/**
 * P0 E2E: Authentication - Display Name Setup
 *
 * Critical path: an account that arrived without a name must be asked for one
 * before it can use the app, and answering must stick.
 *
 * These two cases were skipped for want of "a test user without display_name in
 * user_metadata", because the gate used to be
 * `!session.user.user_metadata.display_name` and the Supabase client owns that
 * object — network interception cannot reach it. Story 8 moved the gate onto a
 * read of `public.users.display_name`, and the trigger seeds that column from
 * the email when no metadata name is supplied
 * (20251206024345_remote_schema.sql:164). So the fixture is now simply an
 * account created without `user_metadata`, which is what these tests do.
 *
 * The account is dedicated and thrown away, created in the shape of
 * `tests/support/auth/global-setup.ts:28-33` minus the display name. Never a
 * worker-pool account: those are provisioned WITH a name, are shared between
 * parallel workers, and this spec both reads and writes the name.
 *
 * `authSessionEnabled: false` drops the worker's storage state so the browser
 * starts signed out and signs in as the dedicated account through the real
 * login form.
 */
import type { Page } from '@playwright/test';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';
import { test, expect } from '../../support/merged-fixtures';
import type { TypedSupabaseClient } from '../../support/factories';
import { resolveOwnPair } from '../../support/helpers/events';
import { deleteSentNote } from '../../support/helpers/love-notes';
import { navigateTo } from '../../support/helpers/navigation';
import { LOVE_NOTES_READ, LOVE_NOTE_SEND, gateNameRead } from '../../support/helpers/reads';

type Dedicated = { email: string; userId: string; cleanup: () => Promise<void> };

/**
 * An account with no `user_metadata` at all, so `sync_user_profile()` seeds its
 * profile row with the email and the app reads that as "no name chosen".
 */
async function createNamelessAccount(
  supabaseAdmin: TypedSupabaseClient,
  prefix: string
): Promise<Dedicated> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.example.com`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    // Deliberately no user_metadata — that absence IS the fixture.
  });

  if (error || !data?.user) {
    throw new Error(`Failed to create the dedicated account: ${error?.message ?? 'no user'}`);
  }

  const userId = data.user.id;
  return {
    email,
    userId,
    cleanup: async () => {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw new Error(`Failed to delete ${email}: ${deleteError.message}`);
    },
  };
}

/**
 * Stamp the welcome-splash timer so Home renders straight away, the same way
 * every other signed-in E2E does (`tests/e2e/home/events.spec.ts:44`). An init
 * script rather than an `evaluate`, so it is in place before the app's first
 * render reads it.
 */
async function suppressWelcomeSplash(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', String(Date.now()));
  });
}

async function readProfileName(
  supabaseAdmin: TypedSupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`Failed to read the profile row: ${error.message}`);
  return data?.display_name ?? null;
}

test.describe('Display Name Setup', () => {
  // Auth tests must run WITHOUT the shared authenticated storage state so they
  // can sign in as their own account.
  test.use({ authSessionEnabled: false });

  test('[P0] should show display name setup for new OAuth users', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    // GIVEN: An account signed up without a display name.
    const account = await createNamelessAccount(supabaseAdmin, 'nameless-shows');
    cleanup.defer('delete the dedicated account', account.cleanup);

    // Premise: the trigger seeded the profile with the email, which is the
    // state the gate has to recognise as "no name chosen".
    expect(await readProfileName(supabaseAdmin, account.userId)).toBe(account.email);

    // WHEN: App loads after signing in.
    // The worker storage state normally carries this
    // (`tests/support/auth/supabase-auth-provider.ts:153`) and
    // `authSessionEnabled: false` drops it, so the 60-minute welcome splash
    // would otherwise stand between setup and the app.
    await suppressWelcomeSplash(page);
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
    await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
    const signInGate = interceptNetworkCall({ method: 'GET', url: gateNameRead(account.userId) });
    await page.getByTestId('submit-button').click();
    const signInName = await signInGate;
    expect(signInName.status).toBe(200);
    expect(signInName.responseJson).toEqual({ display_name: account.email });

    // THEN: Display name setup modal is shown, and the app is not.
    await expect(page.getByTestId('display-name-setup')).toBeVisible();
    await expect(page.getByTestId('app-container')).toHaveCount(0);

    // AND on a cold load, not just across the sign-in transition. This is the
    // path the nameless account actually arrives by: `needsDisplayName` starts
    // false, so the overlay here can only come from the gate having read the
    // profile on load. Asserting it is *visible* rather than absent is what
    // makes that observable — a `toHaveCount(0)` would pass whether or not the
    // gate ever ran.
    const coldGate = interceptNetworkCall({ method: 'GET', url: gateNameRead(account.userId) });
    await page.reload();
    const coldName = await coldGate;
    expect(coldName.status).toBe(200);
    expect(coldName.responseJson).toEqual({ display_name: account.email });
    await expect(page.getByTestId('display-name-setup')).toBeVisible();
    await expect(page.getByTestId('app-container')).toHaveCount(0);
  });

  test('[P0] should allow setting display name and proceed to app', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    // GIVEN: Display name setup modal is shown.
    const account = await createNamelessAccount(supabaseAdmin, 'nameless-sets');
    cleanup.defer('delete the dedicated account', account.cleanup);
    const chosenName = 'Chosen In E2E';

    // The whole point of the change is that saving a name is a profile write and
    // nothing else. A metadata write is a non-GET to /auth/v1/user; a session
    // refresh is a refresh_token grant.
    const authWrites: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      if (method !== 'GET' && /\/auth\/v1\/user(\?|$)/.test(url)) {
        authWrites.push(`${method} ${url}`);
      }
      if (/\/auth\/v1\/token\?grant_type=refresh_token/.test(url)) {
        authWrites.push(`${method} ${url}`);
      }
    });

    await suppressWelcomeSplash(page);
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
    await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
    const signInGate = interceptNetworkCall({ method: 'GET', url: gateNameRead(account.userId) });
    await page.getByTestId('submit-button').click();
    const signInName = await signInGate;
    expect(signInName.status).toBe(200);
    expect(signInName.responseJson).toEqual({ display_name: account.email });
    await expect(page.getByTestId('display-name-setup')).toBeVisible();

    // WHEN: User enters display name and submits.
    await page.getByLabel('Display Name').fill(chosenName);
    await page.getByTestId('display-name-submit').click();

    // THEN: Modal closes and main app is displayed.
    await expect(page.getByTestId('display-name-setup')).toHaveCount(0);
    await expect(page.getByTestId('app-container')).toBeVisible();

    // The name went to the profile row, and only there.
    expect(await readProfileName(supabaseAdmin, account.userId)).toBe(chosenName);
    expect(authWrites, 'setup must not write auth metadata or refresh the session').toEqual([]);

    // And it survives a reload — which is the case the old trigger broke, and
    // also what proves the gate is reading the saved name back rather than
    // remembering a React state flag.
    const reloadGate = interceptNetworkCall({ method: 'GET', url: gateNameRead(account.userId) });
    await page.reload();
    const reloadName = await reloadGate;
    expect(reloadName.status).toBe(200);
    expect(reloadName.responseJson).toEqual({ display_name: chosenName });
    await expect(page.getByTestId('app-container')).toBeVisible();
    await expect(page.getByTestId('display-name-setup')).toHaveCount(0);
  });
});

/**
 * DW-130 / DW-107: the name can be changed after it is first chosen, and the
 * change reaches the chat and survives a reload.
 *
 * The describe above stops at the post-reload app container, so nothing pinned
 * end to end that a saved name is what love notes actually renders. It also
 * only ever covers the FIRST save: App shows the setup modal solely while the
 * profile row still carries the trigger's seed, so once a name exists that
 * route is closed for good. Settings is the second route, and this is the case
 * that walks it.
 *
 * This describe deliberately does NOT set `authSessionEnabled: false` — `test.use`
 * above is scoped to its own describe — so the browser arrives signed in as
 * this worker's own pool account, which is partner-linked and therefore has a
 * chat to render a name into. A dedicated throwaway account would have no
 * partner and no `getPartnerId()`, and it is this worker's OWN pool row that is
 * written here, never the partner's and never another worker's: the pair comes
 * from `resolveOwnPair`, which is keyed on `TEST_WORKER_INDEX`.
 */
test.describe('Display Name Edit', () => {
  /**
   * What the teardown needs, recorded by the body as soon as it is known.
   *
   * Module-scoped and restored from `test.afterEach` rather than from the end
   * of the test — the way `tests/e2e/home/events.spec.ts:36-38` clears its
   * events — because a Playwright TIMEOUT aborts the body outright. A restore
   * sitting after a `catch` only survives thrown errors, so a timeout would
   * leave this worker's pool row renamed for every later run.
   */
  let renamed: { userId: string; originalName: string | null } | null = null;

  test.afterEach(async ({ supabaseAdmin }) => {
    if (!renamed) return;

    const { userId, originalName } = renamed;
    // Cleared first: a failing restore must not be retried against a row a
    // later test has since renamed again.
    renamed = null;

    // Written twice if need be, and verified each time. A timeout aborts the
    // body without closing the page, so the app's own PATCH can still be in
    // flight and land AFTER this restore, putting the test's name back on the
    // row. Re-reading and rewriting beats that write. Closing the page first
    // would beat it too, and would cost no screenshot — Playwright takes that
    // when the test function ends, before any `afterEach` — but it would drop
    // the page snapshot in `error-context.md`, which is taken at context close.
    let stored: string | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ display_name: originalName, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) {
        throw new Error(`Failed to restore the display name: ${error.message}`);
      }

      stored = await readProfileName(supabaseAdmin, userId);
      if (stored === originalName) break;
    }

    // Asserted, not merely attempted: a silently-lost restore leaves this
    // worker's pool row renamed for every later run, and the spec that fails
    // next would be one that never touched the name.
    expect(stored, "this worker's pool display name must be restored").toBe(originalName);
  });

  /**
   * The note the test sends into this worker pair's shared thread, recorded
   * before the send click, and whether its POST answered 2xx.
   *
   * A hook of its own rather than a step in the restore above: Playwright runs
   * every `afterEach` even when an earlier one throws, so a failed name restore
   * cannot skip the note delete, and a test that failed before renaming still
   * has its note deleted.
   */
  let sentNote: string | null = null;
  let committed = false;

  test.afterEach(async ({ supabaseAdmin }) => {
    const content = sentNote;
    const wasCommitted = committed;
    sentNote = null;
    committed = false;
    if (content) await deleteSentNote(supabaseAdmin, content, wasCommitted);
  });

  test('[P1] should change the display name in Settings and show it in the chat', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: This worker's own pool account, and whatever name it currently has.
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const originalName = await readProfileName(supabaseAdmin, userId);
    // Unique per run so the assertions cannot pass on a name left behind by an
    // earlier one, and inside the form's 3-30 character rule.
    const stamp = Date.now().toString().slice(-8);
    const seededName = `Prefill ${stamp}`;
    const newName = `E2E ${stamp}`;

    // Armed BEFORE the write, so the teardown restores even if the very first
    // assertion below times out.
    renamed = { userId, originalName };

    // A known chosen name, so the prefill below has one exact expected value
    // whatever state an earlier run left this pool row in. A seed value (the
    // email, 'Unknown', blank) would legitimately prefill an empty field.
    const { error: seedError } = await supabaseAdmin
      .from('users')
      .update({ display_name: seededName, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (seedError) throw new Error(`Failed to seed the display name: ${seedError.message}`);
    expect(await readProfileName(supabaseAdmin, userId)).toBe(seededName);

    await page.goto('/');

    // WHEN: The user opens Settings and changes the name. Settings' mount
    // reads the name; the app's own gate read of the same URL may answer
    // first, with the same name.
    const nameRead = interceptNetworkCall({ method: 'GET', url: gateNameRead(userId) });
    await navigateTo(page, 'settings');
    expect((await nameRead).status).toBe(200);

    const nameRow = page.getByTestId('settings-display-name');
    await expect(nameRow).toBeVisible();
    // Premise: the row has finished its read, so the Change control is live
    // and the form will open pre-filled from a real answer. The seeded name is
    // the only text a finished read can show; an error or a stale name cannot.
    await expect(nameRow).toHaveText(seededName);

    await page.getByTestId('settings-display-name-edit').click();
    await expect(page.getByTestId('display-name-setup')).toBeVisible();

    // The field carries the current name, not an empty box — the whole point of
    // an edit route rather than a second setup screen.
    const field = page.getByLabel('Display Name');
    await expect(field).toHaveValue(seededName);

    await field.fill(newName);
    await page.getByTestId('display-name-submit').click();

    // THEN: The form closes and the row shows the new name, with no reload.
    await expect(page.getByTestId('display-name-setup')).toHaveCount(0);
    await expect(nameRow).toHaveText(newName);

    // AND the profile row itself holds it — the column is what every other
    // surface reads, so a green UI over an unwritten row is the failure this
    // catches.
    expect(await readProfileName(supabaseAdmin, userId)).toBe(newName);

    // AND the chat puts it on a note. This is the gap DW-107 names: coverage
    // used to stop at the app container and never reach love notes, where the
    // name is actually rendered.
    await navigateTo(page, 'notes');

    const uniqueMessage = `Display name edit E2E ${Date.now()}`;
    await page.getByLabel(/love note message input/i).fill(uniqueMessage);
    sentNote = uniqueMessage;
    // The reload below must not cut the send short, or the re-fetch it checks
    // could legitimately miss the note.
    const noteSaved = interceptNetworkCall({ method: 'POST', url: LOVE_NOTE_SEND });
    await page.getByLabel(/send message/i).click();
    const { status: sendStatus } = await noteSaved;
    committed = sendStatus >= 200 && sendStatus < 300;
    expect(sendStatus).toBe(201);

    const sentMessage = page.getByTestId('love-note-message').filter({ hasText: uniqueMessage });
    await expect(sentMessage).toBeVisible();
    await expect(sentMessage).toContainText(newName);

    // AND it is still there after a reload. The assertion above sees the
    // OPTIMISTIC render, which a send that fails server-side also produces; only
    // a note re-fetched from `love_notes` proves the row landed. The reload is
    // also DW-107's own wording — "the name shows in chat after reload" — and it
    // re-resolves the name from the profile row rather than from the React state
    // the save left behind.
    const threadRead = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
    await page.reload();
    const thread = await threadRead;
    expect(thread.status).toBe(200);
    expect(thread.responseJson).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: uniqueMessage })])
    );
    await navigateTo(page, 'notes');

    const persistedNote = page.getByTestId('love-note-message').filter({ hasText: uniqueMessage });
    await expect(persistedNote).toBeVisible();
    await expect(persistedNote).toContainText(newName);
  });
});
