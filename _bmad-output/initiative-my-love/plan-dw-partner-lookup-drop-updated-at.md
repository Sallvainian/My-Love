---
title: 'DW-429: drop the unused users.updated_at from getPartner'
type: 'refactor'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: 'ad00d983070fea012a3ece9969d808ebf39673e7'
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
      The partner-mood.spec.ts comment on loadPartner's reads is stale beyond the column this change fixed.
    evidence: |-
      tests/e2e/partner/partner-mood.spec.ts:46-48 says loadPartner makes 2 sequential GET /rest/v1/users calls and names the second select=id,email,display_name; getPartner also reads partner_requests (src/api/partnerService.ts:151-160) and the second users read selects id, email, display_name, birthday (src/api/partnerService.ts:137). Predates this change.
    location: >-
      tests/e2e/partner/partner-mood.spec.ts:46
    severity: low
---

<intent-contract>

## Intent

**Problem:** `partnerService.getPartner`'s first `users` read (`src/api/partnerService.ts:116`) still selects `partner_id, updated_at`, though the link date now comes from the accepted `partner_requests` row (`PartnerInfo.linkedSince`). The column stayed only because `tests/e2e/partner/partner-connect.spec.ts:60` (`PARTNER_LOOKUP`) waits on that exact URL, and `tests/unit/api/partnerServiceDisplayName.test.ts:357` ("never takes the link date from the profile row's updated_at") guards a column that would no longer be read.

**Approach:** Select only `partner_id`. In `partner-connect.spec.ts`, replace the URL wait — which would then also match `lookupPartnerId`'s identical `users?select=partner_id` read — with a store wait: the account's partner lookup has answered when the store holds `partnerKnown: true`, `isLoadingPartner: false`, `partnerLoadError: false`. In a fresh context `partnerKnown` is set only by a successful server answer or by the saved copy that answer wrote, so it proves the same thing the 200 did. Remove the unit test at :357. Fixtures that still return `updated_at` stay.

</intent-contract>

## Tasks

- `src/api/partnerService.ts` -- `.select('partner_id')` in `getPartner`'s first read.
- `tests/e2e/partner/partner-connect.spec.ts` -- drop `PARTNER_LOOKUP`; `signInToPartnerTab` waits, after `navigateTo`, through `recurseUntil` on a store reader (same `page.evaluate` import pattern as `storePartnerId`) for `{ known: true, loading: false, failed: false }`; update its doc comment.
- `tests/unit/api/partnerServiceDisplayName.test.ts` -- delete the `never takes the link date from the profile row's updated_at` test.
- `tests/e2e/partner/partner-mood.spec.ts:47` -- the comment naming `select=partner_id,updated_at` names `select=partner_id`.

## Implementation Notes

Oneshot: four files, under 30 changed lines, no behaviour change in the app. Every other E2E route on this read uses `users?select=partner_id*`, which matches the URL with or without the column, so only `partner-connect.spec.ts` needs a new signal. A network wait cannot single out the Partner tab's read once the URLs are identical, and the old wait could already latch onto the sign-in refresher's `loadPartner` read (`registerLocalCopy(PARTNER_COPY_KIND, …)`, `partnerSlice.ts:139`), so the store signal is no weaker.

Done as planned. Files: `src/api/partnerService.ts:116`; `tests/e2e/partner/partner-connect.spec.ts` (`PARTNER_LOOKUP` removed, `signInToPartnerTab` waits on new `storePartnerLookup`, `observeOn` kept for its other uses); `tests/e2e/partner/partner-mood.spec.ts:47` comment; `tests/unit/api/partnerServiceDisplayName.test.ts` (one test removed; the `partnerRow` fixture's `updated_at` stays). Verified: unit file 30/30, `npm run typecheck` exit 0, `npm run lint` exit 0, both E2E specs 7/7 against the local stack.

Review correction: the "no weaker" claim above is wrong when the sign-in refresher has already answered — then the old wait could only match the tab's own read, while the store wait can pass before that read starts. No caller depends on it (each next step auto-waits on the screen); the `signInToPartnerTab` comment now says what the wait proves.

## Plan Change Log

## Review Triage Log

### 2026-11-04 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `signInToPartnerTab`'s wait can pass on the sign-in refresher's answer before the tab's own lookup, while its comment said the tab's read had answered — confirmed at `partnerSlice.ts:139`, `:193-202`, `:230-235`; patched the doc comment (`tests/e2e/partner/partner-connect.spec.ts:181-193`) to say a successful lookup for the account has answered, possibly the refresher's, and why the callers do not need more. The plan's "no weaker" note is corrected in Implementation Notes, not rewritten.
  - `[low]` `[reject]` A failed tab read no longer fails the spec once a saved copy exists (`partnerLoadError` is `!copy && partner === null`, `partnerSlice.ts:222`) — real, but HTTP 4xx/5xx still fail the test through the auto `networkErrorMonitor` fixture (`tests/support/merged-fixtures.ts:17`), only a client-side error such as `sessionMismatch` would pass unseen, which nothing in this spec reaches, and singling out the tab's read needs new machinery (e.g. reading the copy's `savedAt` from IndexedDB) beyond a direct correction.
  - `[low]` `[defer]` The `partner-mood.spec.ts:46-48` comment still says two `users` reads and omits `birthday` — pre-existing, not caused by this change; recorded in `deferred`.

## Verification

**Commands:**
- `npx vitest run tests/unit/api/partnerServiceDisplayName.test.ts` -- expected: all pass
- `npm run typecheck` -- expected: exit 0 (worktree-only TS2883 baseline errors excepted, if present on the baseline too)
- `npm run lint` -- expected: exit 0
- `npx playwright test tests/e2e/partner/partner-connect.spec.ts tests/e2e/partner/partner-mood.spec.ts` (local Supabase running) -- expected: all pass
- `grep -rn "updated_at" src/api/partnerService.ts` -- expected: only the `partner_requests` read's lines

## Auto Run Result

Status: built

**Summary:** `partnerService.getPartner` no longer selects `users.updated_at` (DW-429); the link date already comes from `PartnerInfo.linkedSince`. `partner-connect.spec.ts` waits on the store's partner-lookup state instead of the now-ambiguous URL, and the unit test that guarded the dropped column is removed.

**Files changed:**
- `src/api/partnerService.ts` — first `users` read selects `partner_id` only.
- `tests/e2e/partner/partner-connect.spec.ts` — `PARTNER_LOOKUP` removed; `signInToPartnerTab` polls new `storePartnerLookup` for `partnerKnown` / `isLoadingPartner` / `partnerLoadError`.
- `tests/e2e/partner/partner-mood.spec.ts` — comment names `select=partner_id`.
- `tests/unit/api/partnerServiceDisplayName.test.ts` — removed `never takes the link date from the profile row's updated_at`.

**Review (quick):** 3 findings, all low. Patched 1 (doc comment over-claimed what the wait proves). Deferred 1 (stale pre-existing comment in `partner-mood.spec.ts:46-48`). Rejected 1 (a client-side failure of the tab's own read would no longer fail the spec — unreachable here, HTTP failures still caught by `networkErrorMonitor`, and the fix needs new machinery). The quick lens was first launched with a model override, against the same-capability rule; it reported no findings and was re-run on the session's model, whose three findings are the ones triaged.

**Follow-up review recommended:** false — patched: high 0, medium 0, low 1.

**Verification:** `npx vitest run tests/unit/api/partnerServiceDisplayName.test.ts` 30/30 passed; `npm run typecheck` exit 0; `npm run lint` exit 0; `npx playwright test tests/e2e/partner/partner-connect.spec.ts tests/e2e/partner/partner-mood.spec.ts` 7/7 passed against the local stack, before and after the review patch; `updated_at` in `partnerService.ts` remains only on the `partner_requests` read.

**Residual risk:** the new wait does not single out the Partner tab's own mount read (see the rejected finding); every step after it auto-waits on the screen, so no flake is expected from it.
