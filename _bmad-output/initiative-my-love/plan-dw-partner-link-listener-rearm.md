---
title: 'DW-298: re-arm the partner-link listener so a missed accept broadcast is recovered'
type: 'bugfix'
ticket: ''
created: '2026-10-29'
status: 'built'
baseline_revision: '7c218e3a0dd3158e6e8b4583a2e21fea8e532bfb'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
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

**Problem:** `src/hooks/usePartnerLinkListener.ts` can miss the ephemeral `partner_linked` broadcast, and nothing recovers it, so the sender sees the link only after a reload (DW-298). Its gate includes `!isLoadingPartner`, so every `loadPartner` (each start, reconnect and Partner-tab mount) tears the subscriber down and re-joins it. It joins only after an async session/partner/setAuth chain. It passes no `onStatusChange`, so a Realtime re-join never re-reads the partner.

**Approach:** Gate the subscriber on `userId && isOnline && partner === null && !partnerLoadError` once this account's first partner load has settled. A render-time latch, keyed on `userId` + `authSessionVersion`, records that the load settled, so a later `isLoadingPartner` no longer releases the subscriber. Pass an `onStatusChange` that, on each `SUBSCRIBED`, calls `lookupPartnerId()` and calls `loadPartner()` and `loadPendingRequests()` only when it answers `linked`. The replayed `SUBSCRIBED` on attaching to an open channel also covers a broadcast missed during the join. Never call `loadPartner` straight from the status callback. Unit tests in `src/hooks/__tests__/usePartnerLinkListener.test.ts` cover the `SUBSCRIBED` re-read (`linked` runs both loads; `unlinked`, `error` and other statuses run neither), the subscriber surviving an in-flight `loadPartner`, and no join before the first load settles.

</intent-contract>

## Implementation Notes

Oneshot: two files, about 100 lines, one hook and its unit test. The latch uses React's "store information from previous renders" pattern (a conditional `setState` during render). That avoids `useAppStore.getState()`, which `no-restricted-properties` forbids in hooks, and setState inside an effect, which `react-hooks/set-state-in-effect` forbids. A load counts as having started when `isLoadingPartner` is seen true, or when `partner` or `partnerLoadError` is set, since both are written only by a finished load.

Implemented (files: `src/hooks/usePartnerLinkListener.ts`, `src/hooks/__tests__/usePartnerLinkListener.test.ts`):
- The `settledUnlinked` selector and the effect's `getState()` re-read are gone. The latch makes the same-commit guard unnecessary: it needs to see a load start, so the first render (store idle, the load not yet started) never counts as settled.
- `session` (`userId:authSessionVersion`) is an effect dependency as well as the latch key, so an in-place account switch or a same-account re-login re-subscribes on the new account's topic instead of keeping the old one.
- `lookupPartnerId()` never rejects (it catches internally and answers `error`), so the status callback needs no `.catch`. Each async step re-checks `active` before loading.
- Existing tests now drive a first load (`renderSettled`) before expecting a subscribe. That is the new contract: an idle store with no load seen opens nothing. 7 of the 15 tests fail against the baseline hook and all 15 pass against the new one.
- Observation, not changed: `tests/support/harnesses/auth-bootstrap-notification-order.tsx:206-211` says the listener "always" subscribes there. With the latch it no longer does, because the harness's partner refresher is a no-op, so no load is seen. The stub it installs is still harmless.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 3 findings — high 0, medium 1, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The harness comment at `tests/support/harnesses/auth-bootstrap-notification-order.tsx:206-211` still says the listener "always" subscribes there, which this change made false. The harness's partner refresher is a no-op, so no load is seen and the listener stays closed. — Fixed by correcting the comment in place: it now says the listener stays closed there and the stub keeps it closed if a partner load ever runs. That is a direct correction caused by this change, so it needs no ledger entry.
  - `[medium]` `[patch]` One `lookupPartnerId()` per `SUBSCRIBED` does not retry, and a healthy socket emits no further `SUBSCRIBED`. A transient read failure during the join that missed the broadcast therefore still loses the link until a reload. — Verified: `lookupPartnerId` (`src/api/supabaseClient.ts:340`) catches every failure and answers `error` once. Fixed by calling `resolvePartnerLookupForDelivery()` instead. It runs `lookupPartnerId()` up to 3 times with 300/600 ms backoff, skips the retry offline, and returns the same `PartnerLookup` status, so "re-read only on linked" is unchanged.
  - `[low]` `[patch]` The non-`SUBSCRIBED` test checked only that no lookup ran, not that neither load ran, and tried only `CHANNEL_ERROR`. — Fixed: the test now runs over `CHANNEL_ERROR`, `TIMED_OUT` and `CLOSED` with a `linked` lookup mocked, and asserts that neither load ran.

## Verification

**Commands:**
- `npx vitest run src/hooks/__tests__/usePartnerLinkListener.test.ts` -- expected: all pass
- `npx eslint src/hooks/usePartnerLinkListener.ts src/hooks/__tests__/usePartnerLinkListener.test.ts` -- expected: no errors
- `npm run typecheck` -- expected: no new errors beyond the worktree TS2883 baseline

## Auto Run Result

Status: built

**Summary:** `usePartnerLinkListener` now joins the shared mood channel once this session's first partner load has settled, and stays joined while the store holds no partner and no load error. A later `loadPartner` (each reconnect or Partner-tab mount) no longer tears the channel down. Every `SUBSCRIBED` asks the server, with retries, whether the account is now linked. That covers the first join, each Realtime re-join, and the replay a subscriber gets when it attaches to an open channel. The partner and the pending requests are re-read only on a `linked` answer, so a missed ephemeral `partner_linked` broadcast is recovered without a reload (DW-298).

**Files changed:**
- `src/hooks/usePartnerLinkListener.ts` -- a first-load latch per session (render-time state), the new gate, the `onStatusChange` re-read, and `session` as an effect dependency.
- `src/hooks/__tests__/usePartnerLinkListener.test.ts` -- drives a first load before expecting a join. Adds tests for the `SUBSCRIBED` re-read (linked, unlinked, error), three other statuses, surviving an in-flight load, no join before the first load, and re-keying on a new session.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx` -- comment corrected for the new gate.

**Review findings:** 3 patches applied (1 medium, 2 low), 0 deferred, 0 rejected.

**Follow-up review recommended:** false. This was a first pass that patched 0 high and 1 medium.

**Verification:**
- `npx vitest run src/hooks/__tests__/usePartnerLinkListener.test.ts`: 17 passed. Before the review patches, 7 of the then 15 tests failed against the baseline hook.
- `npm run test:unit`: 198 files and 3104 tests passed. This ran before the review patches, which touch only the hook, its test and a harness comment.
- `npx eslint` on the three changed files: no errors.
- `npm run typecheck`: exit 0.

**Residual risks:**
- The latch has to see a partner load start (`isLoadingPartner` true) or finish (a partner or a load error) in a render. If React ever batched a load's raise and release into a single render, an unlinked session would not listen until its next `loadPartner`. The baseline gate had the same dependence.
- Not exercised end-to-end against Realtime. The coverage is unit-level, with `moodSyncService` and the lookup mocked.

