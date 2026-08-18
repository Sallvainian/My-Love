# Data model — `public.events`

Companion to `SPEC.md`. Holds the table shape, the policy set, and the pgTAP obligations. Every pattern below is quoted from a migration already in the repo; the policy behaviour was additionally measured against this project's running local stack inside a rolled-back transaction.

## Name is free

No `events` table exists. `to_regclass('public.events')` returns empty against the running local stack, a grep of `supabase/migrations/` finds no `create table … events`, and `src/types/database.types.ts` enumerates thirteen tables — `claude_bot_config`, `interactions`, `love_note_removals`, `love_notes`, `moods`, `partner_requests`, `photos`, `scripture_bookmarks`, `scripture_messages`, `scripture_reflections`, `scripture_sessions`, `scripture_step_states`, `users` — with no `events` among them.

## The date column is a `date`, not a `timestamptz`

This is the one place the spec deliberately departs from `deferred-work.md:25`, which lists "event timestamp". Sallvain's answer — each partner's own timezone decides when a card disappears — forces it.

A `timestamptz` stores **one absolute instant**; Postgres does not retain a zone. Measured on this project's database: `to_json('2026-09-12 00:00:00-04'::timestamptz)` returns `"2026-09-12T04:00:00+00:00"`. supabase-js hands that ISO string to `new Date(iso)`, and `getFullYear`/`getMonth`/`getDate` then project it onto each browser's own wall clock. So for an event given a real time of day — 8 PM Eastern, stored as `2026-09-13T00:00:00.000Z`:

- New York computes `Sat Sep 12 2026 20:00:00 GMT-0400`, `getDate()` = 12 → "Today! 🎉"
- Berlin computes `Sun Sep 13 2026 02:00:00 GMT+0200`, `getDate()` = 13 → "1 day"

Same row, two different dates. The general rule: two zones separated by Δ disagree about the calendar date of a stored instant whenever that instant's local time-of-day falls within Δ of a midnight. With `timestamptz` the *date itself* becomes viewer-dependent, which is a worse failure than a shifted boundary.

A `date` column comes back from PostgREST as a bare `"YYYY-MM-DD"` string — verified end to end against the local stack, `select=…,as_date:created_at::date` returning `"as_date":"2026-08-18"` beside `"created_at":"2026-08-18T04:36:30.107073+00:00"`. Every viewer reads the same calendar day, and `EventCountdown`'s existing local-component comparison (`EventCountdown.tsx:70-73`) then flips each card at each viewer's own local midnight. Both properties Sallvain asked for, with **no change to `computeEventCountdownState`**.

**The client parse is mandatory and non-obvious:**

```js
const [y, m, d] = row.event_date.split('-').map(Number);
const eventDate = new Date(y, m - 1, d);
```

`new Date('2026-09-12')` is the ECMA-262 date-**only** form and is parsed as UTC midnight: in `America/New_York` that is `Fri Sep 11 2026 20:00:00 GMT-0400`, `getDate()` = 11. The split form matches an idiom already in the repo, `src/utils/countdownService.ts:83` `const [, month, day] = dateString.split('-').map(Number);`.

**This bug is already live in the file DW-3 says to copy.** `src/components/Settings/AnniversarySettings.tsx:103` renders `{formatDateLong(new Date(anniversary.date))}` over `src/types/index.ts:64` `date: string; // ISO date string`. Measured: `America/New_York` renders "November 14, 2025" for a stored `2025-11-15`, while `Europe/Berlin` renders "November 15, 2025". Model the *shape* of that component, not its date handling.

The write path has the mirror trap, recorded at `src/utils/dateUtils.ts:127`: `"toISOString().split('T')[0] which is UTC-based — at 11 PM EST"`. Either pass the `<input type="date">` string straight through untouched (`AnniversarySettings.tsx:349` `type="date"`) or go through `formatDateISO` (`dateUtils.ts:134-137`, which builds from `date.getFullYear()` at `:135`).

Neither the type system nor a code review will catch a regression here: `src/types/database.types.ts:167` `updated_at: string | null` shows every Postgres temporal column becomes plain `string`.

## Columns

`deferred-work.md:25` specifies: *"owner user id, couple/partner visibility, label, event timestamp, optional description, icon kind, created/updated timestamps"* — with "timestamp" superseded above, and "couple/partner visibility" being a policy rather than a column.

Take the column idiom from `photos`, `supabase/migrations/20251203190800_create_photos_table.sql:13-25`:

```sql
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ...
  caption TEXT CHECK (char_length(caption) <= 500),
  ...
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT valid_mime_type CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
);
```

Notes that bind:

- **`id`** is `uuid … default gen_random_uuid()`. It cannot be the locally-sequential `number` that `settingsSlice.ts:213` mints for anniversaries — `const newId = Math.max(0, ...settings.relationship.anniversaries.map((a) => a.id)) + 1;`.
- **`user_id`** references `auth.users(id) on delete cascade`, matching `photos:15` and `love_note_removals` (`20260817000000:46`).
- **Text length limits** use `CHECK (char_length(...) <= N)`, as `photos:18` does for `caption` and `moods` does for `note` (`20251203000001_create_base_schema.sql:68`).
- **Icon kind** should be constrained to the three the renderer knows. `EventCountdown.tsx:14` declares `type IconType = 'ring' | 'plane' | 'calendar';` and `:24-28` maps exactly those to `Gem`, `Plane`, `Calendar`. A `CHECK (icon IN (...))` in the `valid_mime_type` style of `photos:24` keeps the DB and the union in step.
- **No `couple_id` column.** Partner visibility is a policy — see below.

## Index

The events read is "my events and my partner's, soonest first", so the useful index is on the event date, not `created_at`. The shape to follow is `photos:37-38`:

```sql
CREATE INDEX IF NOT EXISTS idx_photos_user_created
  ON photos (user_id, created_at DESC);
```

## RLS

Mandatory, in the creating migration. `20251203190800_create_photos_table.sql:47`:

```sql
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
```

Because `20260725170000_grant_api_roles_on_public.sql:35,40-41` grants ALL on all public tables — present and future — to `anon`, `authenticated` and `service_role`.

## Policies — creator-only writes, both partners read

Four policies, all `to authenticated`, named on the `love_note_removals` convention (`<table>_<cmd>`). **Do not model these on `photos`,** whose partner-read policy reads `public.users` directly (`20251203190800:55-63`); the current direction is the helper.

```sql
create policy "events_select"
  on public.events
  as permissive
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  );

create policy "events_insert"
  on public.events
  as permissive
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "events_update"
  on public.events
  as permissive
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "events_delete"
  on public.events
  as permissive
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
```

Four things about that set are load-bearing:

1. **`to authenticated`, not implicit PUBLIC.** The SELECT arm calls `get_my_partner_id()`, on which anon holds no EXECUTE since `20260818000000`. `20260818000001:205-210` records the consequence: a PUBLIC policy makes an anon request fail with `"permission denied for function get_my_partner_id"` instead of a clean row-level-security denial.

2. **The UPDATE policy states `with check` as well as `using`.** Omitting it makes Postgres reuse `using` as the check — the shape `20260818000001:234-243` records this repo as having been bitten by. Here the check is what stops a creator donating a row by rewriting `user_id` to their partner's.

3. **Plain `=` against `get_my_partner_id()`, deliberately not `is not distinct from`, and no `is not null` guard is needed.** The function is `SELECT partner_id FROM public.users WHERE id = auth.uid();` (`20260205000001:20`) with no COALESCE, so an unlinked caller gets NULL; `user_id = NULL` evaluates to NULL; and RLS admits a row only on TRUE, so NULL denies. Measured live: an unlinked user saw only their own rows, and a linked partner saw own-plus-partner and none of the unlinked user's. `is not distinct from` would instead make NULL match NULL. Note this is the **opposite** of the RPC guard at `20260818000001:126`, where `is distinct from` is required because there NULL must fire the exception rather than fall through.

4. **The privilege layer cannot restate the rule.** `love_note_removals:105-109` could say "insert-only" twice, in policy and in grant. Here it cannot — UPDATE and DELETE must be granted for the creator to use them, and a grant cannot distinguish creator from partner:

```sql
revoke all on public.events from anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;
```

So the creator-only restriction lives **entirely** in the four predicates, with no second line of defence. Say so in a migration comment; the pgTAP file below is what guards it.

## Idempotency, if the insert is retryable

Client half — `notesSlice.ts:143-170`, `insertNoteOnce`:

```js
  const { data, error } = await supabase
    .from('love_notes')
    .upsert(payload, {
      onConflict: 'from_user_id,idempotency_key',
      ignoreDuplicates: true,
    })
    .select()
    .maybeSingle();
```

followed by a select-by-key fallback, because `ignoreDuplicates` returns no row on a conflict.

Server half — `20260727000000_love_notes_idempotency.sql:48-60` adds a `unique` constraint guarded by a `pg_constraint` existence check, and `:45-47` records why it must be a constraint rather than a partial index:

> `-- A plain constraint rather than a partial index: PostgREST''s on_conflict`
> `-- cannot express an index predicate, so a partial unique index would not be`
> `-- usable as a conflict target.`

`AGENTS.md:59` states the rule generally.

## pgTAP obligations

A new table needs a **new numbered file** in `supabase/tests/database/` — the next number is `20_`, following `17_love_note_removals.sql` (315 lines), `18_function_execute_grants.sql`, `19_together_session_partner_scope.sql`. Run with `npm run test:db` (`package.json:31`).

**Nothing existing breaks — this narrows `AGENTS.md:61`,** which warns that `02_rls_policies.sql` and `16_photos_storage_update_policy.sql` "assert the exact policy set with pgTAP `policies_are`". That applies to policies on tables those arrays already cover; a brand-new table is not one of them. `policies_are` is per-table, and its seven live call sites cover only `scripture_sessions`, `scripture_step_states`, `scripture_reflections`, `scripture_bookmarks`, `scripture_messages` (`02_rls_policies.sql:70,75,80,85,90`), `storage.objects` (`16_…:17`) and `love_note_removals` (`17_…:125`). `has_table` is used per-table only (`01_schema.sql:13-17`, `17_…:110`), and no file calls `tables_are`. `18_function_execute_grants.sql` is unaffected because this change adds no function.

The policy assertion:

```sql
select policies_are('public', 'events',
  array['events_select', 'events_insert', 'events_update', 'events_delete'],
  'EV-DB-004: events carries exactly the select, insert, update and delete policies');
```

Array order is cosmetic — `policies_are` compares as a set — but membership is exact: a fifth policy, or a rename, fails the build. That is the point, given the privilege layer cannot back the predicates up.

**Assert row counts, not `throws_ok`, for the partner-write cases.** Measured: a partner's UPDATE or DELETE against the creator's row is **silently filtered to zero rows** rather than raising, while an INSERT under someone else's `user_id`, or an UPDATE that donates a row, does raise `42501`. A `throws_ok` on the first pair would fail against correct behaviour.

Other assertions to write, following `17_love_note_removals.sql`:

```sql
select is(
  (select relrowsecurity from pg_class where oid = 'public.love_note_removals'::regclass),
  true,
  'LNR-DB-002: row level security is enabled on love_note_removals');
```
(`:115-118`), plus `has_table` (`:110`) and `col_is_pk` (`:120-121`), each assertion carrying a stable id prefix.

Two mechanical requirements: the file opens with its own `select plan(N);` (`17_…:14` is `select plan(19);`), and helpers are declared **inline** rather than pulled from `00_helpers.sql` — `17_…:8-10` records that *"that file creates its schema inside a transaction that rolls back, so the objects do not exist by the time this file runs"*.

## Types

After the migration, regenerate rather than hand-edit (`AGENTS.md:10`):

```
supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts
```
