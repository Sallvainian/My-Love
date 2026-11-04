---
id: 18
type: story
title: "The unused dates push preference column is dropped"
parent: epic-settings-rework
covers: [R14]
after: [4, 17]
refined: true
hitl: false
risk: low
---

# The unused dates push preference column is dropped

## Description

The second of DW-416's two deploys (epic Notes, Decision 2026-11-02 two deploys). Story 4 stopped every date change from sending a push and stopped the client reading or writing `push_preferences.dates`, but left the column because installed shells still selected and upserted it. This story drops the column, updates the pgTAP tests that pin it, regenerates the database types, and closes DW-416. It is built and tested on a local stack with no phone; the phones matter only at merge (Notes).

## Requirements

Verify: `supabase test db` passes, the regenerated `database.types.ts` has no `dates` on `push_preferences`, and the unit suite passes; before the PR to main merges, the owner confirms both phones run the update from story 4 or later; after the deploy, the hosted schema has no `push_preferences.dates` and push settings load and save on both phones (hand check, Notes).

1. **The dates column is gone** (R14)
   **Given** a local stack with every migration applied
   **When** the schema of `public.push_preferences` is read
   **Then** it has no `dates` column
   **And** the new migration drops it with `if exists`, so it also runs clean on a stack where the column is already missing

2. **The other switches are untouched** (R14)
   **Given** a `push_preferences` row with a mix of on and off switches, written before the migration runs
   **When** the migration runs
   **Then** that row keeps the same `love_notes`, `moods`, `photos`, `pokes_and_kisses`, `partner_requests` and `date_reminders` values
   **And** the table keeps its three own-row policies, its primary key and each switch column's default of `true`

3. **The pgTAP tests pin the new schema** (R14)
   **Given** the database tests in `supabase/tests/database/`
   **When** `supabase test db` runs
   **Then** it passes, with the test that pinned "`push_preferences.dates` remains" now asserting the column is absent, and no test selecting, inserting or returning `dates` from `push_preferences`
   **And** every file's `plan(n)` matches its count of assertions

4. **The generated types match** (R14)
   **Given** a local stack with every migration applied, on the Supabase CLI version CI pins
   **When** `npm run db:types` runs
   **Then** the committed `src/types/database.types.ts` equals its output and has no `dates` field in `push_preferences`' Row, Insert or Update types
   **And** `npm run typecheck` passes

5. **Nothing still says the column remains** (R14)
   **Given** the repository after the change
   **When** it is searched, outside already-applied migrations, for text saying `push_preferences.dates` stays, is unread, or waits for story 18
   **Then** no code comment, test name or test comment says so; each now says the column is gone or is removed
   **And** no already-applied migration is edited: their comments are history, and the column's own comment goes with the column
   **And** the unit suite (`npm run test:unit`) and the send-push Edge Function tests (`deno test --no-lock supabase/functions/send-push/`) pass

6. **DW-416 is closed** (R14)
   **Given** `_bmad-output/initiative-my-love/deferred-work.md`
   **When** DW-416 is read
   **Then** it reads `status: done <date>` with a `resolution:` line naming this story's migration as the one that dropped `push_preferences.dates`, in the form the ledger's other closed entries use

## Boundaries

- Must not change: what Notifications shows and saves. Push settings still load every switch and save each one alone, and the `push-preferences` local copy still parses copies saved before story 4.
- Must not change: send-push's per-kind switch check, which never reads `dates`.
- Must not change: any other table, policy or function. The migration touches only `push_preferences.dates`.

## References

- parent — _bmad-output/initiative-my-love/tickets/epic-settings-rework/epic-settings-rework.md, section Requirements R14; Notes, Decisions 2026-11-02 (drops `date_changes` and `push_preferences.dates`; two deploys) and 2026-11-04 (merge check)
- ledger — _bmad-output/initiative-my-love/deferred-work.md, DW-416
- sibling — _bmad-output/initiative-my-love/tickets/epic-settings-rework/tickets/story-adding-or-changing-a-date-sends-no-push-plan.md, the first deploy this one finishes

## Notes

- Decision: 2026-11-04 the phone question is a merge check, not a build gate (owner). The loop builds and tests this story with no phone and merges it into `loop/integration`, which nothing deploys. Before the PR to main is merged, the owner confirms both phones run story 4's update or later, because `deploy.yml` applies the migration before the site deploys and a shell still on older code fails every push-settings load and save once the column is gone. The same merge check re-reads the hosted catalog for `push_preferences` read-only, as the epic's 2026-11-02 Decision asks, in case something added since the 2026-11-04 read depends on the column. Supersedes the 2026-11-02 "not built until the owner confirms" decision in the epic's Notes.
- Decision: 2026-11-04 `hitl` is false (owner). No person does any part of the build. Two hand checks run after the merge and deploy, and neither stops the loop: the hosted schema has no `push_preferences.dates`, and on both phones the Notifications page loads its switches and saves a toggle.
- Decision: 2026-11-04 hosted catalog read, read-only, during refinement: `push_preferences.dates` is present (boolean, default true), no function, view, trigger or index depends on it, the three own-row policies do not name it, and the last applied migration is `20261103000000` (story 4). The live update bundle (`updates/latest.json`, version `3895b3c0`) contains story 4's commit. The builder needs no hosted access; `if exists` in criterion 1 covers a stack that differs.
