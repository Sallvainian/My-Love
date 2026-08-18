# Data model — the watermark and the counts

Companion to `SPEC.md`. One new table, four count queries, one new index, and the pgTAP file. Everything else in this feature is client code.

## `public.feature_seen`

One row per (user, feature): "when did this user last look at this feature". Modelled on `20260817000000_love_note_removals.sql`, the house style for a small per-user side table (explicit `to authenticated`, `(select auth.uid())`, explicit `revoke all` + narrow grant).

```sql
create table if not exists public.feature_seen (
  user_id uuid        not null references auth.users(id) on delete cascade,
  feature text        not null check (feature in ('notes', 'photos', 'events', 'interactions')),
  seen_at timestamptz not null default now(),
  constraint feature_seen_pkey primary key (user_id, feature)
);

alter table public.feature_seen enable row level security;

create policy "feature_seen_select"
  on public.feature_seen
  as permissive
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "feature_seen_insert"
  on public.feature_seen
  as permissive
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "feature_seen_update"
  on public.feature_seen
  as permissive
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.feature_seen from anon, authenticated;
grant select, insert, update on public.feature_seen to authenticated;

-- The server clock is authoritative for seen_at. Every count compares it
-- against server-written created_at defaults, so a client-supplied value from
-- a device running minutes fast would permanently swallow everything the
-- partner creates in that window, and a slow clock would re-badge seen items.
-- The trigger overwrites whatever the client sends -- on both the INSERT and
-- the merge path of an upsert -- so the client payload is just
-- { user_id, feature } and skew is impossible rather than unlikely.
create or replace function public.touch_feature_seen()
returns trigger
language plpgsql
as $$
begin
  new.seen_at := now();
  return new;
end;
$$;

create trigger feature_seen_touch
  before insert or update on public.feature_seen
  for each row execute function public.touch_feature_seen();

-- The interactions count query below has no covering index: the base
-- (from_user_id, to_user_id, created_at) index was dropped by
-- 20251206024345_remote_schema.sql:47, and the live ones cover
-- (from_user_id) and (to_user_id, viewed) only (:71,:73).
create index if not exists idx_interactions_to_user_created
  on public.interactions using btree (to_user_id, created_at desc);
```

Notes that bind:

- **RLS in the same migration**, because `20260725170000_grant_api_roles_on_public.sql:35,40-41` grants ALL on all present and future public tables to `anon`/`authenticated`/`service_role`. `20260817000000:64-68` states it: *"a new public table without RLS is readable and writable by every authenticated user. RLS is the gate."*
- **Strictly private — no partner arm.** Unlike `events`, a watermark is nobody else's business; every policy is `(select auth.uid()) = user_id` and the partner never reads it.
- **No DELETE policy and no DELETE grant.** A watermark is upserted forward, never removed; the `on delete cascade` on `user_id` handles account deletion.
- **The UPDATE policy states `with check` as well as `using`** — omitting it makes Postgres reuse `using` as the check (`20260818000001:234-243` records this repo being bitten), and here the check stops a user re-keying their row to someone else.
- **The `feature` CHECK pins the enum** in the `valid_mime_type` style of `photos:24`. Adding a fifth feature later is one migration line plus the client union.
- **The primary key `(user_id, feature)` is the upsert conflict target**: `.upsert({ user_id, feature }, { onConflict: 'user_id,feature' })` — a plain constraint, usable by PostgREST's `on_conflict`, per the rule recorded at `20260727000000_love_notes_idempotency.sql:45-47`. Unlike the notes idempotency upsert this one **wants** the merge (`ignoreDuplicates` stays false, the default): the merge path is what re-fires the `before update` trigger, which is what advances `seen_at`. The client never sends `seen_at` at all — see the trigger above.

## The four count queries

All use supabase-js's count-only form. **No precedent exists in this repo** — every current read fetches rows (a grep for `count: 'exact'` finds nothing) — so the shape is stated here once: `select('*', { count: 'exact', head: true })` returns `{ count }` and zero rows.

**Love notes** — the explicit filter is mandatory, not belt-and-braces. The live SELECT policy (`20251206024345_remote_schema.sql:255-260`) is `using (((( SELECT auth.uid() AS uid) = from_user_id) OR (( SELECT auth.uid() AS uid) = to_user_id)))`, so RLS alone admits the user's own sent notes into the count:

```js
supabase.from('love_notes')
  .select('*', { count: 'exact', head: true })
  .eq('to_user_id', userId)
  .gt('created_at', seenAt)
```

Served by `idx_love_notes_to_user_created` — `20251206024345_remote_schema.sql:77`: `CREATE INDEX idx_love_notes_to_user_created ON public.love_notes USING btree (to_user_id, created_at DESC);`. Already exists; no migration.

**Photos** — the row carries no recipient (`20251203190800:13-25` has `user_id` = uploader only), so "unseen" means "uploaded by my partner since I looked":

```js
supabase.from('photos')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', partnerId)
  .gt('created_at', seenAt)
```

Served by `idx_photos_user_created` (`20251203190800:37-38`). Already exists; no migration.

**Interactions** — the notes trap repeats: the live SELECT policy (`20251206024345_remote_schema.sql:237-242`) is `using (((( SELECT auth.uid() AS uid) = from_user_id) OR (( SELECT auth.uid() AS uid) = to_user_id)))`, so the recipient filter is mandatory, not belt-and-braces:

```js
supabase.from('interactions')
  .select('*', { count: 'exact', head: true })
  .eq('to_user_id', userId)
  .gt('created_at', seenAt)
```

Served by `idx_interactions_to_user_created` — **created by this spec's migration** (above); no live index covers `(to_user_id, created_at)` since `20251206024345:47` dropped the base one. Columns per `20251203000001_create_base_schema.sql:149-156` (`from_user_id`, `to_user_id`, `viewed`, `created_at`).

**Events** — same shape as photos once `../spec-dynamic-events/` lands its table (`.eq('user_id', partnerId).gt('created_at', seenAt)`). That spec's index should cover `(user_id, created_at)` for this read in addition to whatever serves its soonest-first Home query — flag it there when implementing.

**Watermark bootstrap — a one-time loss, accepted deliberately.** A user with no `feature_seen` row yet has no `seenAt`. Treat the missing row as `seen_at = now()` written on first read. The alternative — counting from the beginning of time — would greet the very first open with the couple's entire history as "new", which for the existing couple means every note and photo they have ever exchanged. But be honest about what `now()` costs: **anything the partner added before this user's first-ever post-feature open is never counted.** Concretely, at rollout, CAP-1's own scenario fails once — photos uploaded the night before the feature deploys badge as 0, not 2 — and the same window exists for a new account between partner-link and first open. CAP-1 holds from the first `feature_seen` row onward. This fires exactly once per (user, feature), ever: a second device does not re-trigger it, because the row already exists server-side. A defensible trade — the alternative failure is worse and repeats — but downstream should not "fix" the 0 by counting history.

**Partner id** comes from `partnerSlice` — `partnerService.ts:24-29` `PartnerInfo { id, email, displayName, connectedAt }`, loaded at `partnerSlice.ts:61` and set at `:72`. `partner` is `null` when unlinked (`:23,:44`): with no partner, **run no queries and render nothing** (SPEC CAP-7), and guard the async path against the reset race `partnerSlice.ts:57` documents.

## pgTAP — `supabase/tests/database/20_feature_seen.sql`

New numbered file (17/18/19 exist), own `select plan(N);`, helpers declared inline because `00_helpers.sql` rolls its schema back (`17_love_note_removals.sql:8-10`). Assertions, in the `17_` idiom with a stable id prefix (`FS-DB-00N`):

- `has_table('public', 'feature_seen', …)`
- RLS enabled, via the `relrowsecurity` form at `17_…:115-118`
- `col_is_pk('public', 'feature_seen', array['user_id', 'feature'], …)`
- `policies_are('public', 'feature_seen', array['feature_seen_select', 'feature_seen_insert', 'feature_seen_update'], …)` — exact set; a DELETE policy appearing later fails the build
- behavioural: user A upserts a watermark; user B reads zero of A's rows; B's upsert against A's `user_id` raises `42501`; A's second upsert with a later `seen_at` **overwrites** (merge semantics, not ignore)
- the `feature` CHECK rejects an unknown value and accepts all four (`notes`, `photos`, `events`, `interactions`)
- `has_index('public', 'interactions', 'idx_interactions_to_user_created', …)` — the index this migration adds
- the trigger is server-authoritative: an upsert supplying an explicit past or future `seen_at` lands with `seen_at` ≈ server `now()` regardless (assert both the insert path and the conflict-merge path)

**Nothing existing breaks.** `policies_are` is per-table; its seven live call sites cover scripture tables, `storage.objects`, and `love_note_removals` only. No `tables_are` exists anywhere, and no `functions_are` either (grep over `supabase/tests/` returns nothing), so `touch_feature_seen()` breaks no function enumeration; `18_function_execute_grants.sql` asserts revocations on named functions only. Trigger functions are invoked by the trigger, not by clients — still, revoke EXECUTE on it from `anon, authenticated` in the migration, matching the defense-in-depth posture of `20260818000000`.

## Types

After the migration: `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts` (`AGENTS.md:10`). Never hand-edit.
