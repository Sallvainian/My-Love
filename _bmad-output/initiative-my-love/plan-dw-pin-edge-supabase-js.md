---
title: 'Pin the Edge Functions supabase-js import to 2.118.0'
type: 'chore'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'cea7c85853afd3c70fa8fbae5062747cf8356491'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      The pinned esm.sh supabase-js 2.118.0 bundle still floats one transitive dependency: storage-js 2.118.0 imports iceberg-js through the range ^0.8.1.
    evidence: |-
      package-lock.json declares @supabase/storage-js 2.118.0 dependency "iceberg-js": "^0.8.1" (every other sub-package dependency is exact: tslib 2.8.1, @supabase/phoenix 0.4.5). esm.sh's built https://esm.sh/@supabase/storage-js@2.118.0/es2022/storage-js.mjs imports "/iceberg-js@^0.8.1?target=es2022", a range esm.sh resolves per request, so a new iceberg-js 0.8.x can reach both Edge Functions on the next deploy with no reviewed change. Pre-existing and outside the owner's 2026-11-02 decision, which pins supabase-js only. A fix would add ?deps=iceberg-js@0.8.1 to both import URLs (or vendor the import), which needs an owner call.
    location: >-
      supabase/functions/send-push/index.ts:19; supabase/functions/upload-love-note-image/index.ts:22
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Both Edge Function entrypoints import `https://esm.sh/@supabase/supabase-js@2`, which `supabase functions deploy --use-api` resolves at every deploy, and `deploy.yml` deploys every function on every push to main, so a new supabase-js 2.x can reach production with no reviewed change (DW-355).

**Approach:** Per the owner's 2026-11-02 pin-and-keep-every-run decision, change the import in `supabase/functions/send-push/index.ts:19` and `supabase/functions/upload-love-note-image/index.ts:22` to `https://esm.sh/@supabase/supabase-js@2.118.0`, the version `package-lock.json` resolves for the app. Leave `.github/workflows/deploy.yml`'s functions job ungated.

</intent-contract>

## Tasks & Acceptance

**Execution:**
- [x] `supabase/functions/send-push/index.ts` -- change `@2` to `@2.118.0` in the supabase-js import -- exact pin
- [x] `supabase/functions/upload-love-note-image/index.ts` -- same change -- exact pin

**Acceptance Criteria:**
- Given the repository, when searched for `supabase-js@`, then every Edge Function import reads `@2.118.0` and none reads a bare `@2`.
- Given `package-lock.json`, when its `node_modules/@supabase/supabase-js` entry is read, then its version equals the pinned one.
- Given `.github/workflows/deploy.yml`, when diffed against the baseline, then it is unchanged.

## Implementation Notes

Oneshot: a two-line import change. Investigation: `package-lock.json` resolves `@supabase/supabase-js` 2.118.0, and its five sub-packages (`auth-js`, `functions-js`, `postgrest-js`, `realtime-js`, `storage-js`) are declared at exactly 2.118.0, so the esm.sh bundle's supabase code no longer floats. `curl -sI https://esm.sh/@supabase/supabase-js@2.118.0` answered HTTP 200 on 2026-11-02. No other file imports supabase-js from esm.sh; `test.yml:196` and `.github/codeql/codeql-config.yml:19` mention esm.sh only in comments that stay true.

Implemented: both imports now read `https://esm.sh/@supabase/supabase-js@2.118.0` (`send-push/index.ts:19`, `upload-love-note-image/index.ts:22`). `deno check --no-lock` on both entrypoints resolved the pinned URL and passed; `deno test --no-lock` on both function folders passed 104 tests; no `deno.lock` was written.

Correction from review: "no longer floats" holds for the `@supabase/*` packages only. `storage-js` 2.118.0 still imports `iceberg-js@^0.8.1` through esm.sh; recorded in `deferred`.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 1 findings — high 0, medium 1, low 0, false 0, maybe-false 0
- findings:
  - `[medium]` `[defer]` The pinned bundle still floats `iceberg-js` through `storage-js`'s `^0.8.1` range — verified: the lockfile declares `"iceberg-js": "^0.8.1"` and esm.sh's built `storage-js@2.118.0` imports `/iceberg-js@^0.8.1`; every other sub-package dependency resolves exact. Pre-existing and outside the owner's decision (pin supabase-js), so deferred to frontmatter `deferred`; Implementation Notes corrected.

## Verification

**Commands:**
- `grep -rn "supabase-js@" supabase/functions` -- expected: two lines, both `@2.118.0`
- `node -e "console.log(require('./package-lock.json').packages['node_modules/@supabase/supabase-js'].version)"` -- expected: `2.118.0`
- `git diff --exit-code cea7c85853afd3c70fa8fbae5062747cf8356491 -- .github/workflows/deploy.yml` -- expected: exit 0
- `deno check --no-lock supabase/functions/send-push/index.ts supabase/functions/upload-love-note-image/index.ts` -- expected: success (resolves the pinned URL)
- `deno test --no-lock supabase/functions/upload-love-note-image/ supabase/functions/send-push/` -- expected: all pass

## Auto Run Result

Status: built

**Summary:** Pinned both Edge Functions' supabase-js import from `https://esm.sh/@supabase/supabase-js@2` to `@2.118.0`, the version `package-lock.json` resolves for the app (DW-355, owner decision 2026-11-02 pin-and-keep-every-run). `.github/workflows/deploy.yml` is untouched, so every function still deploys on every run.

**Files changed:**
- `supabase/functions/send-push/index.ts` — supabase-js import pinned to 2.118.0.
- `supabase/functions/upload-love-note-image/index.ts` — supabase-js import pinned to 2.118.0.
- `_bmad-output/initiative-my-love/plan-dw-pin-edge-supabase-js.md` — this plan.

**Review (quick):** 1 finding. Patches applied: 0. Deferred: 1 (medium) — the pinned bundle's `storage-js` 2.118.0 still imports `iceberg-js@^0.8.1` through esm.sh, so that one transitive dependency can still move between deploys; pre-existing and outside the owner's decision, recorded in frontmatter `deferred`. Rejected: 0.

**Follow-up review recommended:** false — no entries were patched (high 0, medium 0, low 0).

**Verification:**
- `grep -rn "supabase-js@" supabase/functions` — two lines, both `@2.118.0`.
- lockfile `node_modules/@supabase/supabase-js` version — `2.118.0`.
- `git diff --exit-code <baseline> -- .github/workflows/deploy.yml` — exit 0.
- `deno check --no-lock` on both entrypoints — exit 0; the pinned URL resolved from esm.sh.
- `deno test --no-lock supabase/functions/upload-love-note-image/ supabase/functions/send-push/` — 104 passed, 0 failed; no `deno.lock` written.

**Residual risks:** the `iceberg-js` range above; esm.sh availability at deploy time is unchanged (the pin does not remove the CDN dependency DW-355 also names, and the owner chose to keep the job ungated).
