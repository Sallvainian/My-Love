---
title: 'Pin iceberg-js to 0.8.1 in the Edge Functions supabase-js import'
type: 'chore'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'dfa049e597b07b9256ff9337dbb50086bddb3563'
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
deferred: []
---

<intent-contract>

## Intent

**Problem:** The pinned `https://esm.sh/@supabase/supabase-js@2.118.0` bundle still floats one transitive dependency: esm.sh's `storage-js@2.118.0` imports `/iceberg-js@^0.8.1`, a range resolved per request, so a new iceberg-js 0.8.x can reach both Edge Functions on the next deploy with no reviewed change (DW-410).

**Approach:** Per the owner's 2026-11-02 pin-iceberg decision, append `?deps=iceberg-js@0.8.1` to the supabase-js import URL in `supabase/functions/send-push/index.ts:19` and `supabase/functions/upload-love-note-image/index.ts:22`, so esm.sh builds storage-js against iceberg-js 0.8.1 exactly, finishing the DW-355 pin.

</intent-contract>

## Implementation Notes

Oneshot: a two-line import change. Investigation at baseline: `package-lock.json` resolves `node_modules/iceberg-js` to 0.8.1 and declares `@supabase/storage-js` 2.118.0's dependency as `"iceberg-js": "^0.8.1"`; npm publishes 0.8.0, 0.8.1 and 1.0.0 (latest), so the range resolves 0.8.1 today. On 2026-11-02, `https://esm.sh/@supabase/supabase-js@2.118.0?deps=iceberg-js@0.8.1` answered with a module that imports `/@supabase/storage-js@2.118.0/X-ZGljZWJlcmctanNAMC44LjE/es2022/storage-js.mjs` (the marker decodes to `diceberg-js@0.8.1`), and that storage-js build imports `iceberg-js@0.8.1/es2022/iceberg-js.mjs`; the unpinned storage-js build imports `iceberg-js@^0.8.1?target=es2022`. No other file imports supabase-js from esm.sh.

Implemented: both imports now read `https://esm.sh/@supabase/supabase-js@2.118.0?deps=iceberg-js@0.8.1` (`supabase/functions/send-push/index.ts:19`, `supabase/functions/upload-love-note-image/index.ts:22`); the line is 96 characters, inside the 100-column print width. `deno info --no-lock` on each entrypoint lists `iceberg-js@0.8.1` as the only iceberg-js version, through `storage-js@2.118.0/X-ZGljZWJlcmctanNAMC44LjE/denonext/storage-js.mjs` and `iceberg-js@0.8.1/denonext/iceberg-js.mjs` (types `iceberg-js@0.8.1/dist/index.d.ts`), and no esm.sh URL in either graph holds a `^` or `~` range. `deno check --no-lock` on both entrypoints passed; `deno test --no-lock` passed 5 tests (51 steps) in `upload-love-note-image/` and 99 in `send-push/`; no `deno.lock` was written.

Correction from review: the changed import line is 98 characters, not 96; still inside the 100-column print width.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` Implementation Notes give the changed import line as 96 characters; it is 98 — verified with `awk length` on both lines. Its only fix is editing this build's plan, so rejected; a correction line was appended to Implementation Notes. Both lines stay inside `printWidth: 100`.

## Verification

**Commands:**
- `grep -rn "supabase-js@" supabase/functions` -- expected: two lines, both `@2.118.0?deps=iceberg-js@0.8.1`
- `deno info --no-lock supabase/functions/send-push/index.ts | grep -o 'iceberg-js@[^/ ]*' | sort -u` (and the same for `upload-love-note-image/index.ts`) -- expected: only `iceberg-js@0.8.1`, no `^` range
- `deno check --no-lock supabase/functions/send-push/index.ts supabase/functions/upload-love-note-image/index.ts` -- expected: success
- `deno test --no-lock supabase/functions/upload-love-note-image/` -- expected: all pass; no `deno.lock` written

## Auto Run Result

Status: built

**Summary:** Appended `?deps=iceberg-js@0.8.1` to both Edge Functions' esm.sh supabase-js 2.118.0 import, so esm.sh builds `storage-js` 2.118.0 against `iceberg-js` 0.8.1 exactly instead of resolving its `^0.8.1` range per request (DW-410, owner decision 2026-11-02 pin-iceberg, finishing the DW-355 pin).

**Files changed:**
- `supabase/functions/send-push/index.ts` — supabase-js import pins `iceberg-js@0.8.1` through `?deps=`.
- `supabase/functions/upload-love-note-image/index.ts` — same change.
- `_bmad-output/initiative-my-love/plan-dw-edge-pin-iceberg-js.md` — this plan.

**Review (quick):** 1 finding. Patches applied: 0. Deferred: 0. Rejected: 1 — `[low]` the plan misstated the import line length (98, not 96); its only fix edits this plan, so rejected, with a correction line appended to Implementation Notes.

**Follow-up review recommended:** false — no entries were patched (high 0, medium 0, low 0).

**Verification:**
- `grep -rn "supabase-js@" supabase/functions` — two lines, both `@2.118.0?deps=iceberg-js@0.8.1`.
- `deno info --no-lock` on each entrypoint — the only iceberg-js URLs are `iceberg-js@0.8.1/denonext/iceberg-js.mjs` and `iceberg-js@0.8.1/dist/index.d.ts`; no esm.sh URL in either graph carries a `^` or `~` range.
- `deno check --no-lock` on both entrypoints — exit 0.
- `deno test --no-lock supabase/functions/upload-love-note-image/` — 5 passed (51 steps), 0 failed; `send-push/` — 99 passed, 0 failed; no `deno.lock` written.

**Residual risks:** the pin depends on esm.sh honouring `?deps=` at deploy time (it did on 2026-11-02); esm.sh availability at deploy time is unchanged, as DW-355 already records.
