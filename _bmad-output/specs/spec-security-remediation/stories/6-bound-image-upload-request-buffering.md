---
title: 'Bound image upload request buffering'
type: 'bugfix'
created: '2026-09-12'
status: in-review
baseline_revision: f99300ccab627787d420cc98ec464030f0730a51
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `supabase/functions/upload-love-note-image/index.ts:191` runs `new Uint8Array(await req.arrayBuffer())` (and `:180` `req.formData()`) before the size check at `:195`, and never reads `Content-Length`. Any authenticated caller (auth at `:147`, 10 uploads/min per isolate at `:157`) can make the worker hold an arbitrarily large body in memory before it is rejected (CAP-10 / F10).

**Approach:** Check the declared length first, then read `req.body` as a stream, counting bytes and stopping retention the moment the running total passes `CONFIG.MAX_FILE_SIZE_BYTES` — releasing what is held and discarding the remainder without retaining it. Only a body that finished under the cap is assembled and handed to the existing magic-byte check and Storage upload. The unused `multipart/form-data` branch is removed and answered with 415. Everything after the body read (`:207-258`) stays as it is.

## Boundaries & Constraints

**Always:**
- Strict contract from `SPEC.md` assumptions: reject an absent `Content-Length` with 411, a non-integer or negative one with 400, and one over the cap with 413 — every one of those statuses decided from headers alone, before anything is allocated or retained. A refusal may then discard the body it refuses (see the next bullet); it may never accumulate it.
- Stream `req.body` with `getReader()`; check the cumulative size **before** retaining each chunk; on overflow release everything retained and discard the remainder without retaining it, bounded by `MAX_DISCARD_BYTES`, then return 413. Peak retained bytes stay ≤ cap + one chunk throughout. Never call `arrayBuffer()`, `formData()`, `text()` or `json()` on the request.
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
| Over-limit declaration | `Content-Length: 5242881`, any body | 413 decided from headers alone before any read; nothing allocated or retained; the refused body discarded unread-into-memory, bounded by `MAX_DISCARD_BYTES` | Zero Storage calls |
| Absent length | no `Content-Length` | 411 before any read | Zero Storage calls |
| Invalid length | `abc`, `-1`, `1.5` | 400 before any read | Zero Storage calls |
| Header lies small | `Content-Length: 10`, stream of 6 MiB | Retention stops at the first chunk that crosses the cap — everything held is released and the remainder discarded without retention; 413 | Zero Storage calls; retained bytes ≤ cap + one chunk |
| Exact limit | `Content-Length: 5242880`, 5 MiB valid PNG | Accepted; upload proceeds | — |
| Limit plus one | `Content-Length: 5242881` | 413 decided before read, and delivered to the caller | — |
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
- Given an over-limit, absent or invalid `Content-Length`, when the request arrives, then the response is 413/411/400 respectively, decided from headers alone with nothing allocated or retained, and the response reaches the caller.
- Given a small declared length and an over-limit stream, when the cap is crossed, then retention stops at that chunk, the remainder is discarded without being retained, 413 is returned, and no Storage call is made.
- Given a valid image at exactly the cap, when uploaded through either client site, then the response and stored object are as before the change.
- Given `multipart/form-data`, then 415 with no body read.
- Given `npm run lint`, `npm run typecheck`, `npm run test:unit`, the new `deno test` suite and the new API spec, when they run, then all pass.
- Given the deployed function, when the hosted checks above run, then the results (status codes, listing counts, the Content-Length observation) are recorded in **Verification** with no credential values.

## Spec Change Log

### 2026-09-13 — the read-based contract is restated in terms of retention (operator adjudication)

The escalation recorded below was put to the operator, who decided that drain-and-discard
satisfies F10 and that the contract text, not the code, is what was wrong. Amended in this
edit: **Always** bullets 1 and 2, matrix rows "Over-limit declaration", "Header lies small"
and "Limit plus one", the first two **Acceptance Criteria**, and the first **Design Notes**
bullet. Each now states what may be **retained** rather than what may be **read** — the
property `remediation.md:94` actually names ("neither allocation nor copies may grow with
the entire attack body"), and the property the shipped handler and its 29 `deno test` cases
already prove. No code change accompanies this amendment.

The premise was re-measured independently before the decision, against
`public.ecr.aws/supabase/edge-runtime:v1.74.3`, Kong bypassed, on the **pre-fix** tree and
on the handler's 401 path rather than its 413 path — so the result is not an artifact of
this change, of the gateway, or of the refusal branch:

| Request body bytes | Result on the 401 path |
|---|---|
| 262 144 | `status=401 time=0.004298` |
| 1 048 576 | `status=000 time=12.003919` |
| 5 242 881 | `status=000 time=12.004678` |

Any response returned on this runtime with roughly ≥ 1 MiB still unread on the wire is
dropped. Four alternatives were checked concretely and none delivers the 413 while leaving
the body unread: `req.body.cancel()`, read-one-chunk-then-cancel, and a detached drain are
all the same class as the probe above; `Expect: 100-continue` is answered by `Deno.serve`
before the handler runs and is never sent by browser `fetch`, which is the only client
(`src/services/loveNoteImageService.ts:139-145`) and which `:28` forbids changing.
`req.body.pipeTo(new WritableStream())` would satisfy the old wording's letter while doing
the identical drain; it was rejected as letter-gaming, which is itself the evidence that
the old wording was a proxy for a property the code already has.

### 2026-09-12 — an over-limit refusal drains the body it refuses

**Contract text affected.** **Always** bullet 2 ("on overflow call `reader.cancel()` and
return 413"), the matrix rows "Over-limit declaration" (`reader.read()` never called) and
"Header lies small" (reader cancelled at the first chunk that crosses the cap), and the
first **Design Notes** bullet.

**What was measured.** On `supabase-edge-runtime 1.74.3 (compatible with Deno v2.1.4)`, a
response returned while the request body is still in flight never reaches the client. A
temporary probe function was deployed to the local stack with four variants and a
5 242 881-byte POST:

| Probe variant | Result |
|---|---|
| respond without touching `req.body` | client timed out at 20s |
| `await req.body.cancel()` then respond | client timed out at 20s |
| read one chunk, `reader.cancel()`, respond | client timed out at 20s |
| read to `done`, discarding every chunk, respond | `{"mode":"drain","read":5242881,"ms":21}` — HTTP 413 in 169 ms |

The same stall reproduces with Kong out of the path (`curl` from inside
`supabase_network_My-Love` straight at `supabase_edge_runtime_My-Love:8081`: `HTTP 100`
then nothing for 25s; with `Expect:` suppressed, `HTTP 000 time 25.005944`), while a
1 024-byte POST to the same port answers `200` in 95 ms. Plain `deno 2.9.6` running an
equivalent two-line server answers both the no-read and the cancel variant in under 3 ms,
so the stall belongs to that runtime, not to the contract.

**Consequence for the contract as written.** The matrix's "413 before any read" and the
**Tasks** requirement of a passing local API row for "limit plus one" cannot both hold: a
handler that reads nothing returns a 413 the caller never receives, so the API spec row
would hang rather than pass.

**What was implemented instead.** The *decision* is still taken from headers alone —
nothing is read, allocated or retained before the status is chosen. After the decision,
an over-limit refusal drains what is left of the body and **discards every chunk as it
arrives**, so live memory stays one chunk however many bytes are sent. That is the
property F10 names (`remediation.md:94`: "neither allocation nor copies may grow with the
entire attack body"), and it is preserved exactly. The drain is bounded by
`CONFIG.MAX_DISCARD_BYTES` (25 MiB = `IMAGE_VALIDATION.MAX_FILE_SIZE_BYTES`,
`src/config/images.ts:31`, the largest file the client will even attempt) and is skipped
entirely when the declared length is past that ceiling, so an absurd declaration still
costs one header read and nothing else.

**What was *not* relaxed.** Every other refusal — 401, 405, 429, 411, 400 and the
multipart 415 — still reads nothing at all, because none of them is reachable from the
app's own client and none of them needs to deliver a user-facing message. `arrayBuffer()`,
`formData()`, `text()` and `json()` are never called.

### 2026-09-12 — `' 100'` dropped from the invalid-length set

`Headers.set()` strips leading and trailing OWS, so the handler only ever observes
`'100'`. There is no such input to reject and the case was removed rather than asserted.

## Design Notes

- Counting before retaining is what bounds memory; a `chunks.push` followed by a check still holds the oversize chunk. Cap the total retained at the limit, release what is held on the chunk that would exceed it, and discard the rest without retaining it.
- `MAX_DISCARD_BYTES` is a **delivery** knob, not a memory knob. Live memory is one chunk at every value of it; what it governs is which refusals reach the caller, because above it the 413 is correct and undeliverable. Do not tune it expecting a memory effect.
- The discard is bounded in bytes, not time: a client trickling a sub-ceiling body holds a worker until it stops sending. Unchanged from the pre-fix `await req.arrayBuffer()` and orthogonal to F10, which is about retained memory.
- The 411/400 statuses for the header contract are this story's choice; `remediation.md` fixes only 413 for over-limit and 415 for multipart.

**Why `handler.ts` imports nothing remote.** `index.ts` keeps the
`https://esm.sh/@supabase/supabase-js@2` import and the `Deno.serve` binding; everything
else moved to a sibling module behind a structural `UploadSupabaseClient` interface. The
real client satisfies it without a cast (`deno check index.ts` is clean), and `deno test`
never fetches a module, so the suite runs offline and in milliseconds.

**Why a body shorter than its declared length is 400 rather than an image.** `Content-Length`
is not used to bound the read — the cap is, which is what makes a header that lies *small*
end in 413 rather than a length mismatch. It is only compared once at the end, and a
mismatch in either direction is a malformed request. It cannot fire for the app: a `Blob`
body's length is its `size`.

**Why `Number.isSafeInteger` as well as `/^\d+$/`.** `'99999999999999999999'` passes the
pattern and parses to `1e20`, which compares as greater than the cap and would have been a
413 rather than the 400 a nonsense header deserves.

**Why the client was not touched.** `loveNoteImageService.ts:139-145` and `:194-200`
already send `application/octet-stream` with a `Blob`, and a browser sets `Content-Length`
for that body itself — measured below. Asking client code to synthesise the header is
explicitly out of contract, and the 413/415/429 message mapping at `:157-163` is unchanged.

## Verification

```
npm run lint && npm run typecheck && npm run test:unit
deno test --no-lock supabase/functions/upload-love-note-image/
supabase start && npx playwright test --project=api tests/api/upload-love-note-image-limits.spec.ts
supabase functions deploy upload-love-note-image   # NOT RUN — see Outstanding below
```

`--no-lock` is deliberate: a bare `deno test` writes a `deno.lock` at the repo root, and
this story does not introduce one (the repo has no Deno config today, and an untested
lockfile could change what `supabase functions deploy` resolves).

### Results (2026-09-12)

All commands were run on the patched tree, in this worktree, against the local Supabase
stack.

- `deno test --no-lock supabase/functions/upload-love-note-image/` — **29 passed, 0 failed** (16 ms). `deno 2.9.6`.
- `npx playwright test --project=api tests/api/upload-love-note-image-limits.spec.ts --workers=1` — **6 passed** (8.1 s).
- `npm run test:unit` — 112 files, **2090 passed**. The client is unchanged; this is the no-regression check.
- `npm run typecheck` — clean (exit 0, no output). `npm run lint` — **0 errors**, 3 pre-existing `EventCountdown.tsx` `react-refresh/only-export-components` warnings (baseline).
- `deno check supabase/functions/upload-love-note-image/index.ts` — clean against the real `@supabase/supabase-js@2.116.0` types from esm.sh.

**Measured over the wire, local stack, `curl` through Kong** (`$API_URL/functions/v1/upload-love-note-image`, worker-0 bearer token):

| Request | Status | Time | Body |
|---|---|---|---|
| 1 KiB PNG, `application/octet-stream` | 200 | 0.120 s | `storagePath` under `<uid>/`, `size: 1024` |
| 5 242 880 B PNG (exactly the cap) | 200 | 0.082 s | `size: 5242880` |
| 5 242 881 B (cap + 1) | 413 | 0.049 s | `{"error":"File too large","message":"Maximum file size is 5MB","maxSize":5242880,"actualSize":5242881}` |
| `multipart/form-data` | 415 | 0.017 s | `{"error":"Unsupported media type",…}` |
| no `Authorization` | 401 | 0.003 s | `{"error":"Missing authorization header"}` |
| octet-stream, text bytes | 415 | 0.019 s | `{"error":"Invalid file type","detectedType":"unknown"}` |

**Content-Length from a real browser — the measurement `SPEC.md:84` asks for.**
`tests/api/upload-love-note-image-limits.spec.ts` `[P1]` drives a real Chromium on the
Vite dev server and issues the exact call shape of `loveNoteImageService.ts:139-145`
(Authorization + `application/octet-stream`, a `Blob` body, no `apikey`, no hand-set
length) at the local function through Kong. **It answered 200**, not 411 — so the browser
set `Content-Length` and it survived the gateway intact. No bounded-stream-only exception
is needed and the 411 stands. This is a local-stack measurement; the hosted gateway is
still unmeasured (see **Outstanding**).

**Mutation matrix (red-then-green), each guard reverted one at a time:**

| Guard reverted | Deno suite result |
|---|---|
| in-loop cap check disabled (buffer the whole stream, the original F10 shape) | 2 failed — "a header that lies small is still stopped by the cap", "the overflowing chunk itself is never retained" |
| `Content-Length` over-cap precheck disabled | 2 failed — "an over-limit Content-Length is refused with no body present at all", "a declaration past the discard ceiling is refused without any read" |
| absent `Content-Length` defaulted to `'0'` | 1 failed — "an absent Content-Length is refused with 411" |
| multipart 415 removed | 1 failed — "multipart/form-data is refused with 415 before any read" |
| `chunks.push(value)` moved *before* the cap comparison | **0 failed — not detected.** See the gap below. |

### Matrix test audit

Every row of the **I/O & Edge-Case Matrix** is covered and ran. Over-limit declaration,
absent, invalid, header-lies-small, exact limit, limit plus one, truncated body, client
disconnect, multipart, wrong magic bytes, unauthenticated and normal upload are each a
`deno test` case asserting `pulls`, `cancels` and `upload` call count, not just the status;
normal upload, exact limit, limit plus one, multipart and unauthenticated are additionally
driven end to end in `tests/api/upload-love-note-image-limits.spec.ts` with the uploader's
Storage prefix listed before and after each case.

**One gap, measured rather than assumed.** A fake stream cannot distinguish
`chunks.push(value)`-then-check from check-then-`push`: both refuse on the same chunk and
return immediately, so status, `pulls`, `cancels` and `upload` counts are identical — the
mutation above was run and the suite stayed green. The difference is the peak retained set
(≤ cap versus ≤ cap + one chunk), which is not observable from outside the handler without
adding a test-only seam to production code. The implemented form is the check-then-push
one; it rests on review, not on a test.

### Residual risks

- **Nothing is deployed** — see **Outstanding** below. The hosted function is still
  version 4, the pre-fix code, and `rollout.md`'s "Edge Function" row stays open.
- **The hosted gateway's `Content-Length` behaviour is unmeasured.** The 411 rests on a
  local-stack browser measurement. If the hosted path ever strips the header, every upload
  becomes 411 — which is exactly what the post-deploy check below is for, and why it must
  be the first thing run after deploying.
- **The drain ceiling is a judgement, not a measurement.** 25 MiB matches the client's own
  pre-compression ceiling, so no upload the app can produce is affected; a non-app caller
  declaring more than that gets the same stall the runtime produces today.
- **The per-isolate rate limiter is untouched**, by contract. It still resets on cold start
  and is per worker, and `remediation.md:134` records that as out of scope for F10.

### Outstanding — Edge Function deployment (operator action)

Not an access blocker: the CLI *is* authenticated and the project is linked.
`supabase functions list --project-ref xojempkrugifnaveqtqc` returns
`upload-love-note-image`, `status: ACTIVE`, `version: 4`, `verify_jwt: true`.

It was not run because deploying from this loop branch would put unreviewed, unmerged code
into production ahead of the pull request — the one gate `rollout.md` keeps for a human
("Code merged without deployment is not production closure"). After merge, one command
ships it:

```
supabase functions deploy upload-love-note-image --project-ref xojempkrugifnaveqtqc
```

Then, on the hosted endpoint, the two demonstrations this story owes:

1. One supported upload through the app succeeds and the object appears under `<uid>/`.
2. One request with `Content-Length: 5242881` returns 413 and the bucket listing is unchanged.

Rollback is the same command against the pre-change `index.ts` (commit `f99300cc`).

