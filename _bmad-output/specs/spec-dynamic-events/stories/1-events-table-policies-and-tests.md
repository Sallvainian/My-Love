---
title: 'Events table, security policies, and database tests'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: '07ff7f29cedd1fa1a14c9ff5d944ec8c589162c5'
context:
  - '{project-root}/_bmad-output/specs/spec-dynamic-events/data-model.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dynamic-events feature (spec-dynamic-events, CAP-1/2/3/6) needs a couple-shared `public.events` table, and none exists — the Home dashboard's visit cards are compiled into the bundle. This story lays the data foundation; nothing visible ships.

**Approach:** One migration creates `public.events` with a `date` column (not `timestamptz`), enables RLS in the same migration, and declares exactly four creator-write / partner-read policies plus the revoke/grant pair. A new pgTAP file pins the policy set and proves the sharing behaviour. Types are regenerated, never hand-edited.

## Boundaries & Constraints

**Always:**
- `event_date` is a Postgres `date`. `data-model.md` records why: `timestamptz` makes the calendar date viewer-dependent.
- `alter table … enable row level security` in the creating migration — `20260725170000_grant_api_roles_on_public.sql:35,40-41` grants ALL on present and future public tables.
- All four policies `to authenticated` (the SELECT arm calls `get_my_partner_id()`, on which anon holds no EXECUTE); UPDATE states `with check` as well as `using`; plain `=` against `get_my_partner_id()` with no null guard — NULL denies. Use the policy text in `data-model.md` verbatim.
- `revoke all … from anon, authenticated; grant select, insert, update, delete … to authenticated;` — and a migration comment saying creator-only lives entirely in the four predicates, since grants cannot distinguish creator from partner.
- pgTAP asserts `policies_are` with exactly the four policy names, and asserts **row counts, not `throws_ok`,** for partner UPDATE/DELETE (measured: they filter to zero rows silently; only cross-user INSERT and a donating UPDATE raise 42501).
- pgTAP helpers declared inline with the file's own `select plan(N)` — `00_helpers.sql` rolls its schema back before other files run.
- `src/types/database.types.ts` regenerated via `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`.

**Ask First:**
- Any edit to an existing migration or existing pgTAP file — none is expected (verified: the seven `policies_are` call sites cover no new table).
- Any deviation from the four-policy set or the column list below.

**Never:**
- No `couple_id` column — partner visibility is the SELECT policy, via `public.get_my_partner_id()`, never a direct read of `public.users` (photos' partner policy at `20251203190800:55-63` is the anti-pattern).
- No client code, store slice, service, or UI — stories 2–5.
- No seed data, no realtime, no storage policy, no touching `02_rls_policies.sql` or `16_photos_storage_update_policy.sql`.
- No `SECURITY DEFINER` objects, no triggers.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Creator insert | A inserts row with own `user_id` | Row created | N/A |
| Partner read | B (linked to A) selects | Sees A's rows and own | N/A |
| Third-party read | C (unlinked) selects | Zero of A's or B's rows; own only | N/A |
| Partner write | B updates/deletes A's row | Zero rows affected | Silent filter, no error |
| Forged insert | B inserts with A's `user_id` | Rejected | 42501 |
| Row donation | A updates own row's `user_id` to B's | Rejected | 42501 |
| Bad icon | Insert `icon = 'star'` | Rejected | 23514 check violation |

</frozen-after-approval>

## Code Map

- `_bmad-output/specs/spec-dynamic-events/data-model.md` — canonical column rationale and verbatim policy SQL; read first.
- `supabase/migrations/20251203190800_create_photos_table.sql:13-25,37-38,47` — column idiom, index shape `(user_id, created_at DESC)`, RLS enable. Do **not** copy its partner policy.
- `supabase/migrations/20260817000000_love_note_removals.sql:105-109` — policy naming `<table>_<cmd>`, revoke/grant pattern, comment style.
- `supabase/migrations/20260205000001_fix_users_rls_recursion.sql:13-23` — `get_my_partner_id()` definition and its authenticated-only EXECUTE.
- `supabase/migrations/20260818000001_partner_scoped_together_sessions_and_seeder_guard.sql:205-210,234-243` — recorded reasons for `to authenticated` and for UPDATE's `with check`.
- `supabase/tests/database/17_love_note_removals.sql` — model pgTAP: inline helpers (:8-10), `plan` (:14), `has_table` (:110), `relrowsecurity` check (:115-118), `col_is_pk` (:120-121), `policies_are` (:125), stable `XX-DB-NNN` ids.
- `src/components/RelationshipTimers/EventCountdown.tsx:14` — the icon union `'ring' | 'plane' | 'calendar'` the CHECK constraint mirrors.
- Latest migration is `20260818000001_…`; next pgTAP number is `20_`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260818000002_create_events_table.sql` — create `public.events`: `id uuid primary key default gen_random_uuid()`, `user_id uuid references auth.users(id) on delete cascade not null`, `label text not null check (char_length(label) <= 100)`, `event_date date not null`, `description text check (char_length(description) <= 500)`, `icon text not null default 'calendar' check (icon in ('ring','plane','calendar'))`, `created_at timestamptz default now() not null`, `updated_at timestamptz default now() not null`; index on `(user_id, event_date)`; enable RLS; the four policies from `data-model.md` verbatim; revoke/grant; predicate-only comment — the table CAP-1/2/3/6 build on.
- [x] `supabase/tests/database/20_events.sql` — pgTAP `EV-DB-NNN` assertions: `has_table`, `relrowsecurity` true, `col_is_pk('id')`, `policies_are` exactly `events_select/insert/update/delete`, plus every I/O-matrix scenario — proves the security model the grants cannot enforce.
- [x] `src/types/database.types.ts` — regenerate with the canonical command — keeps client types in step without hand edits.

**Acceptance Criteria:**
- Given a fresh `supabase db reset`, when `npm run test:db` runs, then every file passes including the new `20_events.sql`, and no pre-existing pgTAP file needed editing.
- Given the regenerated types, when `npm run typecheck` and `npm run lint` run, then both are clean and `events.Row.event_date` is typed `string`.
- Given the running local stack, when `supabase db lint --schema public --level error --fail-on error` runs, then output is empty.

## Spec Change Log

## Review Triage Log

- **Dismissed — initplan-wrap `get_my_partner_id()` in the SELECT policy** (edge-case-hunter, blind-hunter): the frozen Boundaries require the `data-model.md` policy text verbatim; the bare call matches repo precedent (`20260818000001:227`); rows are couple-scoped so per-row evaluation has no material cost.
- **Dismissed — `if not exists` vs non-idempotent `create policy`** (edge-case-hunter wanted `drop policy if exists`, blind-hunter wanted bare `create table`): migration history is linear, `supabase db reset` applies cleanly, and the shape copies the `photos` migration idiom (`20251203190800:13,47`). The two findings prescribe opposite cures; the repo idiom is the tiebreak. No path to either consequence in any environment this project runs.
- **Dismissed — `icon` should be a Postgres enum for typed clients** (blind-hunter): spec-decided design (text + CHECK mirroring `EventCountdown.tsx:14`); assigning `string` to `IconType` fails typecheck, so story 2 is forced to narrow at the boundary regardless. No consequence at this layer.
- **Dismissed — EV-DB-016's `null` message means any 23514 passes** (blind-hunter): refuted. On that tuple (`label` 8 chars, no description) only the icon CHECK can raise 23514, and dropping the CHECK makes the insert succeed, failing `throws_ok`. Full failure power exists.
- **Dismissed — empty/whitespace `label` admitted** (edge-case-hunter, blind-hunter): no code writes to `events` in this story, so the claimed blank card has no path; input validation belongs to story 5's form; a lower bound later is `ALTER TABLE ADD CONSTRAINT`, not a table rewrite. Carried as an observation for story 5.
- **Dismissed — `event_date` accepts `infinity`** (edge-case-hunter): same no-writer disposal; the only actor able to plant one is a partner sabotaging their own dashboard. Carried as an observation for story 5.

## Verification

**Commands:**
- `supabase db reset` — expected: all migrations apply cleanly, including the new one.
- `npm run test:db` — expected: all 20 files pass; `20_events.sql` green on first principles (its partner-write cases assert row counts).
- `supabase db lint --schema public --level error --fail-on error` — expected: empty output.
- `npm run typecheck` — expected: clean.
- `npm run lint` — expected: clean.

## Suggested Review Order

**The date decision — why the column is a `date`**

- Entry point: the table, with `event_date date` — the calendar day both partners must agree on
  [`20260818000002_create_events_table.sql:16`](../../../../supabase/migrations/20260818000002_create_events_table.sql#L16)

**Security — creator-only lives entirely in the predicates**

- RLS on in the creating migration, against the standing GRANT-ALL default privileges
  [`20260818000002_create_events_table.sql:52`](../../../../supabase/migrations/20260818000002_create_events_table.sql#L52)

- The SELECT arm: own rows, plus partner's via `get_my_partner_id()` — NULL denies unlinked callers
  [`20260818000002_create_events_table.sql:64`](../../../../supabase/migrations/20260818000002_create_events_table.sql#L64)

- UPDATE's `with check` — the one line stopping a creator donating a row to their partner
  [`20260818000002_create_events_table.sql:91`](../../../../supabase/migrations/20260818000002_create_events_table.sql#L91)

- The revoke/grant pair the predicates stand on — grants cannot back the creator-only rule up
  [`20260818000002_create_events_table.sql:106`](../../../../supabase/migrations/20260818000002_create_events_table.sql#L106)

**Contracts for future readers**

- Stored table comment, self-contained once applied to the database
  [`20260818000002_create_events_table.sql:27`](../../../../supabase/migrations/20260818000002_create_events_table.sql#L27)

- `updated_at` is client-maintained on every UPDATE, per the moods precedent — deliberately no trigger
  [`20260818000002_create_events_table.sql:38`](../../../../supabase/migrations/20260818000002_create_events_table.sql#L38)

**Tests — pinning what the grants cannot**

- Exactly four policies, by name — a fifth or a rename fails the build
  [`20_events.sql:110`](../../../../supabase/tests/database/20_events.sql#L110)

- The `date` type pinned — a switch to `timestamptz` passes every behavioural case, this fails it
  [`20_events.sql:117`](../../../../supabase/tests/database/20_events.sql#L117)

- Policies pinned to `authenticated`; anon's zero privileges pinned against ACL re-derivation
  [`20_events.sql:135`](../../../../supabase/tests/database/20_events.sql#L135)

- Partner writes assert row counts, not errors — measured: RLS filters silently here
  [`20_events.sql:247`](../../../../supabase/tests/database/20_events.sql#L247)

- What does raise: forged INSERT and row-donating UPDATE, both 42501
  [`20_events.sql:302`](../../../../supabase/tests/database/20_events.sql#L302)

- Each CHECK has its own case — dropping any one fails exactly one assertion
  [`20_events.sql:324`](../../../../supabase/tests/database/20_events.sql#L324)

- Cascade last: deleting the auth user takes their events with them
  [`20_events.sql:400`](../../../../supabase/tests/database/20_events.sql#L400)

**Peripherals**

- Regenerated types: the `events` block, `event_date` as plain `string`
  [`database.types.ts:55`](../../../../src/types/database.types.ts#L55)
