---
title: 'Bound image upload request buffering'
type: 'bugfix'
created: '2026-09-12'
status: ready-for-dev
baseline_revision: 34c01f545967222dfb6d873822278c168325cb97
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `supabase/functions/upload-love-note-image/index.ts:191` runs `new Uint8Array(await req.arrayBuffer())` (and `:180` `req.formData()`) before the size check at `:195`, and never reads `Content-Length`. Any authenticated caller (auth at `:147`, 10 uploads/min per isolate at `:157`) can make the worker hold an arbitrarily large body in memory before it is rejected (CAP-10 / F10).

**Approach:** Check the declared length first, then read `req.body` as a stream, counting bytes and cancelling the reader the moment the running total passes `CONFIG.MAX_FILE_SIZE_BYTES`. Only a body that finished under the cap is assembled and handed to the existing magic-byte check and Storage upload. The unused `multipart/form-data` branch is removed and answered with 415. Everything after the body read (`:207-258`) stays as it is.

## Boundaries & Constraints

**Always:**
- Strict contract from `SPEC.md` assumptions: reject an absent `Content-Length` with 411, a non-integer or negative one with 400, and one over the cap with 413 — all before a single byte of body is read.
- Stream `req.body` with `getReader()`; check the cumulative size **before** retaining each chunk; on overflow call `reader.cancel()` and return 413. Never call `arrayBuffer()`, `formData()`, `text()` or `json()` on the request.
- Keep the 5 × 1024 × 1024 limit, the 413 body shape (`error`, `message`, `maxSize`), CORS/preflight, 405, 401, 429 with `Retry-After`, the magic-byte 415, the uploader-prefixed path from `generateStoragePath` and the success payload with `X-RateLimit-Remaining`.
- Accept exactly the two client call sites' format: `application/octet-stream` with a `Blob` body (`src/services/loveNoteImageService.ts:139-145` and `:194-200`). Browsers set `Content-Length` for a `Blob` body; the client must not synthesise the header.
- Record the measured `Content-Length` behaviour of a real browser upload in **Verification**. If real traffic omits it, stop and record a bounded-stream-only exception before relaxing the 411; do not silently accept header-less bodies.

**Never:**
- Rebuild the per-isolate rate limiter, change the limit, add a new upload format, or touch the Storage bucket policies.
- Claim a hosted worker crash was reproduced; the finding is buffering-before-validation, not a measured outage.
- Run `npm run deploy`. Edge Functions ship separately (see **Code Map**).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Over-limit declaration | `Content-Length: 5242881`, any body | 413 before any read; `reader.read()` never called | Zero Storage calls |
| Absent length | no `Content-Length` | 411 before any read | Zero Storage calls |
| Invalid length | `abc`, `-1`, `1.5` | 400 before any read | Zero Storage calls |
| Header lies small | `Content-Length: 10`, stream of 6 MiB | Reader cancelled at the first chunk that crosses the cap; 413 | Zero Storage calls; retained bytes ≤ cap + one chunk |
| Exact limit | `Content-Length: 5242880`, 5 MiB valid PNG | Accepted; upload proceeds | — |
| Limit plus one | `Content-Length: 5242881` | 413 before read | — |
| Truncated body | declared 1 MiB, stream ends at 100 KiB | 400 (short body), no upload | Zero Storage calls |
| Client disconnect mid-stream | reader throws | 400 or 499-class response, no upload; error logged once | Zero Storage calls |
| Multipart | `Content-Type: multipart/form-data` | 415 before any read | Zero Storage calls |
| Wrong magic bytes | octet-stream, valid length, text bytes | 415 (unchanged) | Zero Storage calls |
| Unauthenticated | no/invalid bearer | 401 before body handling (unchanged) | — |
| Normal upload and retry | app path via `uploadLoveNoteImage` and `uploadCompressedBlob` | 200 with `storagePath` under `<uid>/…`, as today | — |

</intent-contract>

## Code Map

- `supabase/functions/upload-love-note-image/index.ts:18-24` `CONFIG`; `:106` `Deno.serve(async (req) => …)` is the whole handler in one closure; `:176-192` the body read to replace; `:195-204` the post-hoc size check to delete; `:207-216` magic bytes; `:222-227` `storage.from(...).upload(storagePath, fileBuffer, …)`; `:243-258` success response. Extract the request handling into an exported `handleUpload(req, deps)` (Supabase client factory injected) in a sibling module so it can be tested; `index.ts` keeps `Deno.serve`.
- `src/services/loveNoteImageService.ts:139-145`, `:194-200` — the two fetch sites; both send `application/octet-stream` with a `Blob`. Read-only evidence of the format the function must keep accepting. `:157-163` maps 429/413/415 to messages; the retry site `:206-210` maps none — leave as is unless a test needs the 413 text.
- `src/services/__tests__/loveNoteImageService.test.ts` — existing client tests (`:214` 413 case); unchanged unless the client changes.
- No test runner exists for the function today (`find supabase -name '*.test.ts'` → none). `deno` 2.9.3 is installed via mise. Put `deno test` cases beside the handler; inject a fake Supabase client that records `upload` calls and a `ReadableStream` whose `cancel` and `pull` are counted, so cancellation and zero writes are asserted directly.
- `supabase/config.toml:357-358` `[edge_runtime] enabled = true` — `supabase start` serves the function locally at `${SUPABASE_URL}/functions/v1/upload-love-note-image`, so a `tests/api/` Playwright spec (merged fixtures, worker token) can drive the real endpoint for the exact-limit, over-limit and normal rows and list `love-note-images/<uid>/` through `supabaseAdmin` to prove no object was written.
- Deployment: no workflow in `.github/` deploys functions (`grep -rn 'functions deploy' .github scripts package.json` → none); `deploy.yml` ships Pages and migrations only. Ship with `supabase functions deploy upload-love-note-image` against the linked project and record the command result. If the session lacks project access, finish the code and use `awaiting-operator` per `rollout.md`.

## Tasks & Acceptance

**Execution:**
- `supabase/functions/upload-love-note-image/` — extract and rewrite the body handling per **Always**; delete the multipart branch; keep every other status path byte-for-byte.
- Add handler tests (`deno test`) covering every matrix row that a fake stream can express, asserting `cancel` count, `pull` count and `upload` call count — not just the status.
- Add `tests/api/upload-love-note-image-limits.spec.ts` against the local stack: normal upload, exact limit, limit plus one, multipart, unauthenticated; assert Storage listing before/after.
- Measure and record: does the app's real browser upload carry `Content-Length`? (Playwright request interception on the dev server, one row in **Verification**.)
- Deploy the function and demonstrate on the hosted endpoint: one supported upload succeeds through the app; one over-limit request returns 413 and the bucket listing is unchanged. Record both, or the concrete access blocker.

**Acceptance Criteria:**
- Given an over-limit, absent or invalid `Content-Length`, when the request arrives, then the response is 413/411/400 respectively and the body reader is never created.
- Given a small declared length and an over-limit stream, when the cap is crossed, then the reader is cancelled, 413 is returned, and no Storage call is made.
- Given a valid image at exactly the cap, when uploaded through either client site, then the response and stored object are as before the change.
- Given `multipart/form-data`, then 415 with no body read.
- Given `npm run lint`, `npm run typecheck`, `npm run test:unit`, the new `deno test` suite and the new API spec, when they run, then all pass.
- Given the deployed function, when the hosted checks above run, then the results (status codes, listing counts, the Content-Length observation) are recorded in **Verification** with no credential values.

## Spec Change Log

## Design Notes

- Counting before retaining is what bounds memory; a `chunks.push` followed by a check still holds the oversize chunk. Cap the total retained at the limit and cancel on the chunk that would exceed it.
- The 411/400 statuses for the header contract are this story's choice; `remediation.md` fixes only 413 for over-limit and 415 for multipart.

## Verification

```
npm run lint && npm run typecheck && npm run test:unit
deno test supabase/functions/upload-love-note-image/
supabase start && fnox exec -- npx playwright test tests/api/upload-love-note-image-limits.spec.ts
supabase functions deploy upload-love-note-image
```
