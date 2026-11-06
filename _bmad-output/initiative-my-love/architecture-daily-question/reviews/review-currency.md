# Review: currency and reality checks, Daily Question architecture spine

- **Spine:** `_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md` (draft, 2026-11-05)
- **Lens:** every decision checked against the web, the current docs, the repo and the running stacks, rather than taken from memory. Is each named technology still current, does it fit, and do the defaults the spine relies on hold?
- **Reviewed:** 2026-11-05
- **Evidence used:** the local Docker stack (`supabase_db_My-Love`). The hosted project (`xojempkrugifnaveqtqc`), read through catalog SELECTs only, with nothing written. Playwright's WebKit 27.2 and Chromium 156 builds. Upstream release lists through `gh`. The vendor docs linked under each item. Every local test that created something ran inside `begin … rollback`.

## Verdict

Most mechanisms the spine relies on are current and behave as it assumes: pg_cron's upsert by job name, pg_net sending after commit, `AT TIME ZONE` across DST, `httpSend` in supabase-js 2.118, and AFTER INSERT triggers skipping `ON CONFLICT DO NOTHING`. But the Stack table describes the local stack, not production. Hosted runs older Postgres and pg_net builds, and its time-zone list differs from local in ways that matter to AD-2. Two other things the spine depends on have current vendor guidance it does not reflect: the service-role key is being deprecated, and `cron.job_run_details` is never pruned automatically.

## Findings

### F1 (medium): The Stack table shows local versions; hosted is older

| Component | Spine | Local (measured) | Hosted (measured) | Upstream latest |
| --- | --- | --- | --- | --- |
| Postgres image | 17.11.0.006 | `public.ecr.aws/supabase/postgres:17.11.0.006`, `PostgreSQL 17.11` | **17.6.1.048** (`PostgreSQL 17.6`) | 17.11.0.018 (2026-11-03) |
| pg_cron | 1.6.4 (hosted UNVERIFIED) | 1.6.4 available, not installed | **1.6.4 available, not installed; no `cron` schema** | 1.6.8 (2026-09-08) |
| pg_net | 0.20.4 | 0.20.4, installed (`extensions`) | **0.19.5**, installed (`extensions`) | 0.20.5 (2026-07-09) |

- pg_cron on hosted is now confirmed at 1.6.4 (`pg_available_extensions`), so the spine's UNVERIFIED can be dropped. The extension is not installed on hosted (`relation "cron.job" does not exist`; no `cron` namespace).
- pg_net 0.19.5 → 0.20.4 is safe for this design. The 0.20.0–0.20.4 release notes list only perf work, refactors, build fixes and a worker crash-loop fix; `net.http_post`'s signature is unchanged, and `notify_push` already runs on hosted 0.19.5.
- **Fix:** give the Stack table both a Local column and a Hosted column, or label the current one "local (CI)" and add the hosted values. The time-zone difference in F2 is a direct result of this gap.

### F2 (medium): AD-2's `pg_timezone_names` check gives different answers locally and in production

The spine says "the server rejects any zone missing from `pg_timezone_names`". Measured:

- **Hosted has no `America/Coyhaique`** (added in tzdata 2025b). Local has it. Playwright's WebKit 27.2 returns `America/Coyhaique` from `Intl.DateTimeFormat().resolvedOptions().timeZone` for that zone. So a valid device zone can pass every local and CI test and still be rejected in production, and nothing in CI would catch it.
- Hosted lists 1194 names, 597 of them `posix/…` duplicates. Local lists 598, with no `posix/` entries. Hosted therefore accepts zone strings that local rejects. This is harmless, but it is another way the two stacks differ.
- `Etc/Unknown` is in neither list. Whether WebKit can return it is UNVERIFIED (the search found no evidence either way). If it can, it would be rejected.
- The spine does not say what happens after a rejection. AD-3 has every day fetch and every pick upsert the zone, so a rejected zone could block Daily entirely for that user, and AD-12 would leave a queued pick that never drains. A fallback is needed: record UTC with a flag (consistent with AD-3's "no row → UTC" rule) instead of failing the call, or let the client resend with `UTC`.
- Cost: an exact lookup in `pg_timezone_names` took 7–8 ms locally per call (the view reads the tz directory each time). That is acceptable per call, but say so in the spine, or cache the names in a table refreshed by migration.
- Case: `AT TIME ZONE` accepts `america/new_york` case-insensitively, while an exact match against `pg_timezone_names` rejects it. Intl returns canonical case, so this is fine as long as the check is an exact match. Do not loosen it to `ILIKE`.

### F3 (medium): Supabase is deprecating the service-role key that AD-10 relies on

- AD-10 says "`send-push` resolves each row with the service role". Today `supabase/functions/send-push/index.ts:34` builds its client from `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase's API-keys guide (current) says it is "deprecating the `anon` and `service_role` keys by the end of 2026", about eight weeks from today. It also says that reading `SUPABASE_SERVICE_ROLE_KEY` in an Edge Function "keeps you on the deprecated path", and that new code should read `SUPABASE_SECRET_KEYS` or use `@supabase/server`'s `withSupabase({ auth: 'secret' })`. The legacy keys keep working until they are disabled in the Dashboard.
- This predates the spine, but epic 8 adds more privileged reads to `send-push`. The spine should name the key it assumes, or add a Deferred entry that ties the move to `SUPABASE_SECRET_KEYS` to epic 8. The trigger path itself (`x-push-secret` from `push_sender_settings`) does not use the service-role key and is unaffected.

### F4 (low–medium): The spine never says how pg_cron gets installed, or how to remove the job

- Hosted has no `cron` schema (F1), so the epic 8 migration must create the extension itself. Verified as possible: on hosted, `shared_preload_libraries` includes `pg_cron` and `supautils.privileged_extensions` lists `pg_cron`, so the `postgres` role that `supabase db push` runs as (`deploy.yml` migrate job) can create it. Supabase's install guide gives `create extension pg_cron with schema pg_catalog;` (plus `grant usage on schema cron to postgres`). A local rolled-back test placed it in `pg_catalog` with `if not exists`.
- **Idempotency confirmed:** `cron.schedule('<name>', …)` with an existing name upserts. Supabase's quickstart says it "will replace the existing job via upsert", and a local test returned the same `jobid` both times with the second command stored. The pg_cron README does not state this. A migration that re-schedules by name is therefore safe. Supabase also notes that job names are case-sensitive.
- **Removal is not idempotent:** `cron.unschedule('no-such-job')` raises `could not find valid entry for job 'no-such-job'` (local, pg_cron 1.6.4). Any epic 10 or rollback migration that removes the job must guard it with `where exists (select 1 from cron.job where jobname = …)`.
- Cadence: `*/5 * * * *` is the exact example in Supabase's quickstart. Supabase recommends at most 8 concurrent jobs and at most 10 minutes per job, and this job is far below both. `cron.timezone` is `GMT` on both stacks, which is irrelevant here because `enqueue_daily_reminders` computes local time per user. A push can arrive up to 5 minutes after 08:00 or 20:00; the spine should state that as accepted.
- Local stack claim ("on a local or test stack the cron job inserts reminder rows"): plausible and partly verified. The `pg_cron launcher` backend is running locally, `cron.use_background_workers=off` with `cron.host=localhost`, and `pg_hba` trusts `127.0.0.1`. No job was actually run, so actual execution is UNVERIFIED. A consequence the spine leaves out: the job will fire during pgTAP and E2E runs on CI's stack with real `now()`. Tests over `daily_reminders` must tolerate rows the job inserts, or the job must check for a setting before it does anything.

### F5 (low): Nothing prunes `cron.job_run_details`

- Supabase's quickstart: the records "are not cleaned up automatically. They are also not removed when jobs are unscheduled". It recommends a scheduled cleanup (its example deletes rows older than 7 days). The pg_cron README says the same (`cron.log_run` defaults to on, confirmed on hosted).
- At a 5-minute cadence that is 288 rows a day, about 105k a year. Supabase's upgrade guide warns that an in-place Postgres upgrade duplicates this table and that a large one can make the upgrade fail.
- The Deferred entry "Observability of the cron job: read `cron.job_run_details`" should also commit to retention: a second named job in the same migration, or `cron.log_run` left on and a pruning step in `enqueue_daily_reminders`.

## Items confirmed as the spine states

| Spine claim | Status | Evidence |
| --- | --- | --- |
| AD-2 `(now() at time zone z)::date`, `(picked_at at time zone z)::date` | Confirmed | PG 17 docs: `timestamptz AT TIME ZONE zone` → local `timestamp`. Local: `2026-03-08 06:59:59Z` → `01:59:59`, `07:00:00Z` → `03:00:00` (NY spring-forward). |
| AD-7 "local midnight ending d" as an instant | Confirmed; DST edge noted | `((d+1)::timestamp at time zone z)` gave `2026-03-09 04:00Z` for NY. A gap time resolves to the pre-transition offset and an ambiguous time to standard time (PG docs B.1; tested: `02:30` → `07:30Z`, `01:30` on fall-back → `06:30Z`). A zone whose DST jump falls at midnight (`America/Santiago`, 2026-09-06) gives a 23-hour day without error. |
| Intl `timeZone` gives IANA names in WebKit | Confirmed on WebKit 27.2 (macOS); **iOS WKWebView UNVERIFIED** | Playwright WebKit returned `Asia/Kolkata` for `Asia/Calcutta`, `Europe/Kyiv` for `Europe/Kiev`, and `America/New_York` for `US/Eastern`. Chromium returned the legacy `Asia/Calcutta` and `Europe/Kiev`. The TC39 canonical-tz proposal README says Safari returns `Asia/Calcutta`; current WebKit does not, so older iOS versions may. Both spellings of each are in both Postgres catalogs, so either passes. The sim driver has no JS eval, so the shell's WKWebView was not tested. |
| pg_net from a trigger is async and never blocks the insert | Confirmed | Supabase pg_net docs: "HTTP requests are not started until the transaction is committed", suited to triggers, default `timeout_milliseconds` 2000, at most 200 req/s, responses kept 6 h (`pg_net.ttl`). `notify_push` (`20261031020000_…sql`) already follows this pattern on hosted. |
| AD-9/AD-10: a duplicate reminder or pick sends no second push | Confirmed | A local rolled-back test showed that an AFTER INSERT row trigger fired once across three `ON CONFLICT DO NOTHING` inserts of the same key. The PG trigger docs cover only `DO UPDATE`, so this rests on the test. |
| AD-11 `sendEphemeralBroadcast` over REST `httpSend` | Confirmed current | Installed `@supabase/realtime-js` 2.118.0 has `httpSend`; it resolves `{success:true}` on 202 and rejects otherwise (404 → "requires Realtime server v2.97.0 or newer"). Supabase Broadcast docs: `httpSend()` "always uses the REST API", needs supabase-js ≥ 2.76.0. Local Realtime image is v2.147.1. Production already uses this path. |
| Library versions | Confirmed current | npm latest = installed: react 19.3.1, zustand 5.0.16, idb 8.0.4, @capacitor/push-notifications 8.1.3. supabase-js is 2.118.0 installed against 2.119.0 latest, which the caret covers. |
| Supabase CLI 2.122.0 | Confirmed as a deliberate pin | `.mise.toml` and `setup-supabase/action.yml` pin 2.122.0. npm `supabase` latest is 3.0.0, and GitHub has v3.1.0 betas and v4.0.0-next pre-releases. AGENTS.md records that 3.x rejects `config.toml`, so staying on 2.x is correct and not stale. |
| Deploy path | Confirmed | `deploy.yml` migrate job runs `supabase db push` (lines 85–89) before Edge Functions and the site, which matches the spine's deployment paragraph. |

## Sources

- Supabase Cron overview (limits, `cron.job_run_details`): https://supabase.com/docs/guides/cron
- Supabase Cron install (`create extension pg_cron with schema pg_catalog`): https://supabase.com/docs/guides/cron/install
- Supabase Cron quickstart (upsert by name, unschedule, `*/5` example, cleanup job): https://supabase.com/docs/guides/cron/quickstart
- Supabase upgrade caveats (`pg_cron` records duplicated on upgrade): https://supabase.com/docs/guides/platform/upgrading
- pg_cron README (`job_run_details` not cleaned, `cron.log_run`, `cron.timezone`): https://github.com/citusdata/pg_cron/blob/main/README.md
- pg_cron releases (1.6.8 latest): https://github.com/citusdata/pg_cron/releases
- Supabase pg_net docs (after-commit, triggers, TTL, 200 req/s, 2000 ms default): https://supabase.com/docs/guides/database/extensions/pg_net
- pg_net releases 0.19.5–0.20.5: https://github.com/supabase/pg_net/releases
- Supabase postgres releases (17.11.0.018): https://github.com/supabase/postgres/releases
- PostgreSQL 17 date/time functions (`AT TIME ZONE`): https://www.postgresql.org/docs/17/functions-datetime.html
- PostgreSQL 17 invalid/ambiguous timestamps: https://www.postgresql.org/docs/17/datetime-invalid-input.html
- PostgreSQL 17 `pg_timezone_names`: https://www.postgresql.org/docs/17/view-pg-timezone-names.html
- PostgreSQL 17 trigger behaviour: https://www.postgresql.org/docs/17/trigger-definition.html
- TC39 canonical time zone proposal (engine name divergence): https://github.com/tc39/proposal-canonical-tz
- Supabase Realtime Broadcast (`httpSend`, versions): https://supabase.com/docs/guides/realtime/broadcast
- Supabase API keys (service_role deprecation by end of 2026, `SUPABASE_SECRET_KEYS`): https://supabase.com/docs/guides/api/api-keys
- Repo: `package.json`, `.mise.toml`, `.github/actions/setup-supabase/action.yml`, `.github/workflows/deploy.yml`, `supabase/migrations/20261031000000_push_devices.sql`, `supabase/migrations/20261031020000_push_moods_photos_interactions.sql`, `supabase/functions/send-push/index.ts`, `src/api/ephemeralBroadcast.ts`, `node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js`
