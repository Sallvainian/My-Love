/**
 * Events Test Factory
 *
 * Pure functions for anchored batch seeding of `public.events` rows for the
 * running worker's own couple. Single-row specs use
 * `tests/support/helpers/events.ts`; constraint-focused specs may keep smaller
 * self-contained setup when adopting the fixture would add unrelated scope.
 *
 * This remains the shared module for specs that need one stable clock anchor,
 * deterministic bulk insertion, or the `coupleEvents` fixture. It complements
 * the single-row helper instead of replacing it.
 *
 * Pure function → fixture wrapper, per `fixture-architecture.md`: nothing here
 * touches Playwright. The fixture that owns setup and teardown is
 * `coupleEvents` in `../fixtures/index.ts`.
 *
 * ## Why the day offsets take an anchor
 *
 * Every date here is derived from ONE `Date` the caller supplies, never from a
 * fresh `new Date()` per row. A spec that seeds "today" and then reads its own
 * clock again is one local-midnight tick away from disagreeing with itself, and
 * the specs this serves are specifically about which side of today a row falls
 * on. The anchor is also what a `page.clock`-driven spec pins the browser to,
 * so the seeded rows and the faked clock share a single reading.
 *
 * ## Why writes go through the admin client
 *
 * `events_insert` is `with check ((select auth.uid()) = user_id)`
 * (`supabase/migrations/20260818000002_create_events_table.sql:74-79`), so a
 * user-scoped client cannot seed the partner's half of a couple. Seeding is
 * setup, not the behaviour under test; the reads these rows serve are issued
 * under a real user JWT, which is where RLS is exercised.
 */
import type { Database } from '../../../src/types/database.types';
import { formatDateISO } from '../../../src/utils/dateUtils';
import { getWorkerPairEmails } from '../auth/worker-pool';
import type { TypedSupabaseClient } from './index';

type EventInsert = Database['public']['Tables']['events']['Insert'];

/** The icon set the `events.icon` CHECK constraint allows. */
export type SeedEventIcon = 'ring' | 'plane' | 'calendar';

/** Which half of the couple owns a seeded row. */
export type SeedEventOwner = 'self' | 'partner';

/** Both halves of this worker's couple, as `public.users.id`s. */
export interface WorkerPairIds {
  userId: string;
  partnerId: string;
}

/**
 * One row to seed, described relative to the anchor day rather than as a date.
 *
 * `dayOffset: 0` is the anchor's own calendar day — the boundary
 * `getEvents`' `gte`/`lt` split lands on, and the one App's `>= 0` filter
 * keeps.
 */
export interface EventSpec {
  /** Calendar days from the anchor. Negative is already-passed. */
  dayOffset: number;
  /** Must be unique within a single `seedEvents` call. */
  label: string;
  description?: string | null;
  icon?: SeedEventIcon;
  /** Defaults to `'self'`. */
  owner?: SeedEventOwner;
  /**
   * Explicit `created_at`, for pinning the same-day tiebreak both windows
   * order on. Left out, the column default applies and two rows seeded in one
   * statement can share an instant — which is exactly the tie a tiebreak test
   * must not leave to chance.
   */
  createdAt?: string;
}

/** A row after it landed, with the id its cleanup and its assertions need. */
export interface SeededEvent {
  id: string;
  label: string;
  /** The `YYYY-MM-DD` actually written, so assertions never re-derive it. */
  eventDate: string;
  ownerId: string;
}

/**
 * `email` → `public.users.id`.
 *
 * Mirrors the unexported `resolveAppUserIdByEmail` in `./index.ts`. Kept here
 * rather than exported from there so this module stays the one place the
 * events specs reach for identity.
 */
async function resolveAppUserId(
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
 * Throws outside a worker rather than falling back to a shared identity: a
 * silent fallback hands two workers the same rows, and the failure then shows
 * up as another spec's premise breaking.
 */
export async function resolveWorkerPairIds(
  supabaseAdmin: TypedSupabaseClient
): Promise<WorkerPairIds> {
  const pair = getWorkerPairEmails();
  if (!pair) {
    throw new Error('resolveWorkerPairIds: no worker identity (TEST_WORKER_INDEX unset)');
  }

  const [userId, partnerId] = await Promise.all([
    resolveAppUserId(supabaseAdmin, pair.user1Email),
    resolveAppUserId(supabaseAdmin, pair.user2Email),
  ]);

  return { userId, partnerId };
}

/** The anchor's calendar day plus `dayOffset`, as a local `YYYY-MM-DD`. */
export function eventDateFrom(anchor: Date, dayOffset: number): string {
  // Local components, and never `toISOString().split('T')[0]` — the UTC trap
  // `src/utils/dateUtils.ts:126-128` records. Built from the anchor's own
  // Y/M/D so a `setDate` roll-over lands on the right calendar day.
  return formatDateISO(
    new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dayOffset)
  );
}

/** One spec → the row PostgREST is asked to insert. */
export function eventInsert(spec: EventSpec, pair: WorkerPairIds, anchor: Date): EventInsert {
  return {
    user_id: spec.owner === 'partner' ? pair.partnerId : pair.userId,
    label: spec.label,
    event_date: eventDateFrom(anchor, spec.dayOffset),
    description: spec.description ?? null,
    icon: spec.icon ?? 'calendar',
    ...(spec.createdAt ? { created_at: spec.createdAt } : {}),
  };
}

/**
 * Seed every spec in ONE statement, and return the rows in the order given.
 *
 * One statement rather than a loop: the specs that use this seed up to fifty
 * rows to reach the read cap, and fifty round trips would put the seed on the
 * critical path of a test whose subject is elsewhere.
 *
 * Labels are required to be unique within a call, because that is the key the
 * returned rows are matched back on. A duplicate would silently hand two specs
 * the same id and make a later assertion about "the fourth event" untrue.
 */
export async function seedEvents(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds,
  specs: EventSpec[],
  anchor: Date
): Promise<SeededEvent[]> {
  if (specs.length === 0) return [];

  const labels = specs.map((spec) => spec.label);
  const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `seedEvents: duplicate labels in one call: ${[...new Set(duplicates)].join(', ')}`
    );
  }

  const payload = specs.map((spec) => eventInsert(spec, pair, anchor));

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert(payload)
    .select('id, label, event_date, user_id');

  if (error) {
    throw new Error(`seedEvents: insert failed: ${error.message}`);
  }
  if (!data || data.length !== specs.length) {
    throw new Error(`seedEvents: expected ${specs.length} rows back, got ${data?.length ?? 0}`);
  }

  // Matched by label rather than trusting the returned order: PostgREST's
  // representation order for a bulk insert is not part of its contract, and a
  // spec asserting on "the third seeded event" must not depend on it.
  const byLabel = new Map(data.map((row) => [row.label, row]));

  return specs.map((spec) => {
    const row = byLabel.get(spec.label);
    if (!row) {
      throw new Error(`seedEvents: no row came back for "${spec.label}"`);
    }
    return { id: row.id, label: row.label, eventDate: row.event_date, ownerId: row.user_id };
  });
}

/**
 * Remove every event owned by either half of this worker's pair.
 *
 * Checked, for the reason `tests/e2e/home/events.spec.ts:100-102` gives: a
 * silently-failed clear leaves stray rows that break the NEXT test's premise,
 * and that test then fails pointing at the wrong code.
 */
export async function clearPairEvents(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('events')
    .delete()
    .in('user_id', [pair.userId, pair.partnerId]);

  if (error) {
    throw new Error(`clearPairEvents: failed to clear the worker pair's events: ${error.message}`);
  }
}
