/**
 * Events test helpers — the couple pair, its rows, and the dates they carry.
 *
 * Import by this DEEP path, never through `../helpers`: the barrel at
 * `tests/support/helpers/index.ts` re-exports only `./navigation`, and
 * `../helpers` resolves to that barrel rather than to this module.
 *
 * ── Why this module exists ────────────────────────────────────────────────
 *
 * `resolveAppUserId`, `resolveOwnPair` and `clearPairEvents` were previously
 * hand-copied into every spec that touched `public.events`. Measured with
 * `grep -rln` over `tests/` and `_bmad-output/test-artifacts/` on 2026-08-19:
 * `resolveAppUserId` in 7 files, `resolveOwnPair` in 6, `clearPairEvents` in 6
 * — `tests/e2e/home/events.spec.ts`, `tests/e2e/settings/events-crud.spec.ts`,
 * four ATDD specs, and two automation specs. `data-factories.md` sets the
 * extraction bar at three or more consumers of the same thing; this is eight.
 *
 * The duplication is not cosmetic. `clearPairEvents` is the teardown that keeps
 * one worker's rows out of another worker's premise, and eight independent
 * copies is eight chances for one of them to drift into deleting more than its
 * own pair — which is exactly what AGENTS.md's worker-pool rule forbids.
 *
 * ── What is deliberately NOT here ─────────────────────────────────────────
 *
 * No Playwright fixture wrapper. These are pure functions over the
 * `supabaseAdmin` fixture the project already composes at
 * `tests/support/fixtures/index.ts:35`, and wrapping them would add an entry
 * point without adding meaning. It also keeps them usable from the `api`
 * project and the `chromium` project alike. Same call as
 * `tests/support/helpers/rls-security.ts`, which this module's shape follows.
 */
import { getWorkerPairEmails } from '../auth/worker-pool';
import type { TypedSupabaseClient } from '../factories';
import { formatDateISO } from '../../../src/utils/dateUtils';

/** The icon set `events.icon`'s CHECK constraint admits
 * (`supabase/migrations/20260818000002_create_events_table.sql:22`). */
export type EventIcon = 'ring' | 'plane' | 'calendar';

/** `email` → `public.users.id`. `public.users.id` is a PK on `auth.users(id)`
 * (`20251203000001_create_base_schema.sql:14`), so the same uuid is what
 * `events.user_id` references and what `getUserAccessToken` takes. */
export async function resolveAppUserId(
  supabaseAdmin: TypedSupabaseClient,
  email: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data?.id) {
    throw new Error(`Could not resolve app user for ${email}: ${error?.message ?? 'not found'}`);
  }

  return data.id;
}

/**
 * This worker's own pair, resolved to `public.users.id`s.
 *
 * Keyed on `TEST_WORKER_INDEX` through `getWorkerPairEmails()`, never
 * `TEST_PARALLEL_INDEX` — the two diverge on retry, and a spec that followed
 * the parallel index would start writing another worker's rows on exactly the
 * runs that are already failing. Throws outside a worker rather than falling
 * back to a default pair, so a misconfigured run fails loudly instead of
 * quietly sharing one identity.
 */
export async function resolveOwnPair(
  supabaseAdmin: TypedSupabaseClient
): Promise<{ userId: string; partnerId: string }> {
  const pair = getWorkerPairEmails();
  if (!pair) {
    throw new Error('resolveOwnPair: no worker identity (TEST_WORKER_INDEX unset)');
  }

  const [userId, partnerId] = await Promise.all([
    resolveAppUserId(supabaseAdmin, pair.user1Email),
    resolveAppUserId(supabaseAdmin, pair.user2Email),
  ]);

  return { userId, partnerId };
}

/**
 * Remove every event owned by either half of THIS worker's pair, and only that
 * pair.
 *
 * Rows created through the UI have ids the test never learns, so deleting by
 * `user_id` is the only handle there is. The result is checked rather than
 * ignored: a silently-failed clear leaves stray rows that break the next test's
 * premise and fail it as "empty state not visible", pointing at the wrong code.
 */
export async function clearPairEvents(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  partnerId: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('events').delete().in('user_id', [userId, partnerId]);
  if (error) {
    throw new Error(`Failed to clear events for the worker pair: ${error.message}`);
  }
}

/** Resolve this worker's pair and clear both halves in one call — the shape an
 * `afterEach` wants. */
export async function clearOwnPairEvents(supabaseAdmin: TypedSupabaseClient): Promise<void> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  await clearPairEvents(supabaseAdmin, userId, partnerId);
}

/** Overridable fields for {@link seedEvent}. `userId` and `label` have no
 * sensible default — the row's owner and its identity are what the test is
 * about. */
export interface SeedEventOverrides {
  userId: string;
  label: string;
  /** A bare `"YYYY-MM-DD"`. `event_date` is a Postgres `date`, not a
   * timestamptz. Defaults to 30 days out. */
  eventDate?: string;
  description?: string | null;
  icon?: EventIcon;
}

/**
 * Seed one `public.events` row directly and return its id.
 *
 * API-first setup, per `data-factories.md`: a test whose subject is the *read*
 * path, or the partner's view, should not spend a UI round trip creating its
 * premise. Columns are snake_case because this goes to PostgREST, not through
 * `eventsService`.
 *
 * Deliberately does NOT default `icon`: omitting it is how a test exercises the
 * column's server-side `default 'calendar'`
 * (`20260818000002_create_events_table.sql:22`), and a client-side default here
 * would hide that.
 */
export async function seedEvent(
  supabaseAdmin: TypedSupabaseClient,
  overrides: SeedEventOverrides
): Promise<string> {
  const { userId, label, eventDate = isoDateDaysFromNow(30), description, icon } = overrides;

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({
      user_id: userId,
      label,
      event_date: eventDate,
      ...(description !== undefined ? { description } : {}),
      ...(icon !== undefined ? { icon } : {}),
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to seed event "${label}": ${error?.message ?? 'no row returned'}`);
  }

  return data.id;
}

/**
 * A `"YYYY-MM-DD"` calendar date `dayOffset` days from today, from LOCAL
 * components.
 *
 * Delegates to the production `formatDateISO` rather than re-padding by hand.
 * The two specs that reached this module had one hand-rolled copy each — one
 * padding manually, one already calling `formatDateISO` — and a second
 * implementation of a date rule is exactly where an off-by-one gets in. Never
 * `toISOString().split('T')[0]`: that is UTC-based and names the next day east
 * of UTC and the previous one west of it, which is the off-by-one this whole
 * feature exists to avoid (`src/utils/dateUtils.ts:126-128`,
 * `AnniversarySettings.tsx:103`).
 */
export function isoDateDaysFromNow(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return formatDateISO(date);
}

/**
 * A `Date` at LOCAL midnight for a bare `"YYYY-MM-DD"`, ready for
 * `formatDateLong`.
 *
 * Never `new Date(isoDate)`: the date-only string form is ECMA-262's UTC-midnight
 * parse and names the previous day west of UTC — the single bug
 * `src/services/eventsService.ts:1-24` exists to prevent.
 */
export function localDateFromIso(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}
