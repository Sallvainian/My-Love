---
title: 'DW-81: Preserve newer auth notifications during bootstrap'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: 'ae77186cb053d48ddcb47cef460972b3c71dcfd6'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** App applies an awaited initial session snapshot whenever it is mounted, even if its auth listener has already installed a newer identity. A delayed null or different-user result can replace the current session and reset account state.

**Approach:** Track auth notification ownership inside the mount effect and discard an initial snapshot once a notification supersedes it. Complete authentication loading normally even when the initial snapshot is discarded.

## Boundaries & Constraints

**Always:** Give every mounted auth listener notification precedence over the pending initial lookup, including sign-out and same-user updates. Protect both App session state and the composed store identity. Preserve normal initial authenticated/unauthenticated loads, lookup error completion, listener display-name handling, session-version behavior, and cleanup safety.

**Never:** Edit the deferred-work ledger, generated files, archived E2E tests, auth service contracts, persistence, or unrelated loaders. Expand this change into general authentication hardening or alter display-name refresh behavior outside the mount effect.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initial authenticated load | Lookup returns a session without any notification | App renders Home and installs the returned user in the store | No error expected |
| Initial unauthenticated load | Lookup returns null without any notification | App renders Sign in and clears store auth | No error expected |
| Stale null snapshot | Listener supplies user B, then pending initial lookup returns null | Home and user B survive; auth loading finishes without resetting B's session ownership or events | Discard the stale snapshot |
| Stale different-user snapshot | Listener supplies user B, then lookup returns user A | Home and store retain B without starting another account load | Discard the stale snapshot |
| Newer sign-out | Listener supplies null, then lookup returns user A | App renders Sign in and store stays signed out | Discard the stale snapshot |
| Lookup rejection | Initial lookup rejects, with or without a newer notification | Loading finishes; the listener's state, if any, survives | Preserve existing error reporting |
| Effect cleanup | Lookup settles after the effect is cleaned up | No old effect may update App or the shared store | Preserve unsubscribe and mounted checks |

</intent-contract>

## Code Map

- `src/App.tsx:232-299` — mount auth effect; `checkAuth` currently sets session, loading, and store identity after await with only `isMounted`. The listener synchronously updates identity, display-name setup, and sign-out event settlement. Keep ownership local to this effect instance.
- `src/App.tsx:420-448, 506-552` — Home event loading observes store user/session ownership; rendered auth loading, Sign in, Home, and display-name branches expose bootstrap outcomes.
- `tests/unit/App.eventsSession.test.tsx` — existing rendered App harness retains real composed store/auth actions and Home event UI. Reuse `auth.getSession`, captured `auth.listener`, `deferred`, `session`, and `controlHomeLoads`; extend identity fixtures only as needed.
- `src/api/auth/sessionService.ts:getSession,onAuthStateChange` — read-only evidence: lookup returns Session/null (normally catches errors), listener forwards every event synchronously before token storage. App still has its own catch path to preserve.
- `src/stores/slices/authSlice.ts:setAuthUser,clearAuth` — read-only evidence: real actions maintain runtime session ownership and reset account data. Tests should observe these real transitions instead of mocking store setters.
- `vitest.config.ts`, `package.json`, `AGENTS.md` — test setup and required verification conventions; build requires `fnox exec --`.

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/App.eventsSession.test.tsx` — add deterministic deferred-lookup regressions for the matrix, asserting rendered auth/Home outcomes and real store identity/ownership; preserve existing event-session tests and prove stale snapshot cases fail before the fix.
- [x] `src/App.tsx` — record notification ownership synchronously in the mount listener, gate initial identity/session application on current ownership, and finish auth loading on both accepted and discarded lookup completion without updating an unmounted effect.

**Acceptance Criteria:**
- Given a pending initial auth lookup, when a listener notification arrives before its result is applied, then the rendered App and composed store reflect the notification after lookup completion and the authentication spinner is gone.
- Given the listener has started a Home event load, when a superseded initial snapshot arrives, then the load and session ownership remain current and its eventual result renders normally.
- Given no notification supersedes the initial lookup, when it settles, then App leaves authentication loading for the appropriate Home or Sign in surface.
- Given an auth effect has been cleaned up, when its pending lookup settles, then the shared store and any new mounted App retain their own state.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 6 findings — high 0, medium 2, low 1, false 3, maybe-false 0
- findings:
  - `[medium]` `[patch]` Verification-gap reviewer: first null notification lacked a discriminating bootstrap regression — the existing sign-out case first delivered an authenticated notification, so moving ownership marking into the authenticated branch would evade it. Added the first-and-only null notification case with signed-out store/ownership, Sign in, loading completion, and no initialization, sync, or event-load assertions.
  - `[medium]` `[patch]` Blind hunter: first null notification lacked coverage — the same verified gap as the verification reviewer; resolved by the same added test, grouped as one patch entry.
  - `[false]` `[reject]` Blind hunter: full remount coverage cannot detect ownership surviving StrictMode replay through a ref — production ownership is a lexical variable initialized inside each effect invocation, not a retained ref. Both old callbacks and lookups check their own mounted flag. There is no retained ownership defect in this implementation; the proposed test targets a hypothetical different implementation.
  - `[low]` `[patch]` Blind hunter: the different-user case did not independently observe App's local session — the generic authenticated surface and store assertions alone do not distinguish two authenticated local sessions. Added direct before/after call-count assertions on the existing session-dependent sync effect; stale completion now proves it does not restart that effect.
  - `[false]` `[reject]` Blind hunter: separate named/unnamed cases do not exercise clearing an existing display-name prompt — every listener callback still unconditionally derives needsDisplayName from its own metadata, and bootstrap does not write that field. The tests exercise both resulting branches after superseded lookup completion; no new unprotected transition or display-name defect was identified.
  - `[false]` `[reject]` Blind hunter: a nonempty event result does not prove the retained request settles App's empty/error UI — that heading alone does not observe settlement, but the bootstrap regression also verifies unchanged ownership and request count, so the event effect retains its active continuation. Existing same-user update and Home tests exercise empty and error settlement through that same continuation. No missing guard or stranded settlement was demonstrated.
- Edge-case hunter: no findings.
- Intent-alignment auditor: no material divergence; the implementation and rendered tests exercise App's auth-consumer boundary. Actual Supabase notification scheduling and token persistence are outside this controlled ordering test.
- Grouped outcome: two test-only patch entries (high 0, medium 1, low 1), zero deferrals, three rejected findings. No production patch or spec loopback was required.

## Verification

**Commands:**
- `npx vitest run tests/unit/App.eventsSession.test.tsx src/api/auth/__tests__/authServices.test.ts tests/unit/stores/signOutClearsAccountState.test.ts` — new ordering regressions and existing auth/session behavior pass.
- `npm run typecheck` and `npm run lint` — no errors; report existing warnings separately.
- `npm run test:unit` — complete unit suite passes.
- `fnox exec -- npm run build` — production build succeeds with injected configuration.
- `git diff --check` — no whitespace errors; confirm deferred-work ledger unchanged.


## Auto Run Result

Status: done

### Summary

Implemented DW-81. Every mounted auth notification now supersedes the pending initial session lookup, including null and same-user updates. Superseded lookups cannot replace App's local session or store identity. Loading finishes in a mounted-only finally block for accepted, discarded, and rejected results.

### Files changed

- `src/App.tsx` — effect-local notification ownership and unconditional mounted loading completion after bootstrap settles.
- `tests/unit/App.eventsSession.test.tsx` — 13 added bootstrap regressions, retaining the seven existing Home session tests and the real composed auth/event store.
- `spec-dw-81-auth-bootstrap-notification-order.md` — implementation contract, review triage, and verification record.

### Review outcome

Applied two test-only patch entries: first-null notification coverage (medium) and local-session sync observation (low). No findings were deferred. Rejected the StrictMode retained-ref concern because ownership is local to each effect invocation; the display-name transition concern because every callback already derives the prompt from current metadata; and the settlement concern because unchanged ownership retains the tested continuation, with existing empty/error coverage. Full evidence is recorded in the six triage rows above.

Follow-up review recommended: false. Patched entry counts: high 0, medium 1, low 1. No specific unverified production risk was identified.

### Verification

- Before the production fix, five added tests failed against the baseline: stale null, stale different user, stale authenticated result after sign-out, and both same-user email-update variants. The implementation agent recorded 14 passing tests in that red run.
- After review patches, the focused command in Verification passed all 59 tests across three files; the App file ran all 20 tests without skips.
- Matrix audit: initial authenticated/null tests cover ordinary bootstrap; the two stale-result cases cover null/different-user ownership plus retained real event loads; both first-null and sign-in-then-null cases cover newer sign-out; both rejection variants cover loading/error completion; all three cleanup/remount variants cover stale success/null/rejection and late unsubscribed callbacks. Every covering test ran and passed.
- `npm run test:unit` — 100 files, 1,656 tests passed after review patches.
- `npm run typecheck` — passed.
- `npm run lint` — passed with zero errors and three pre-existing react-refresh export warnings in unchanged `src/components/RelationshipTimers/EventCountdown.tsx`.
- `fnox exec -- npm run build` — passed with injected configuration; existing PWA inlineDynamicImports deprecation warning remains.
- `git diff --check` and the staged equivalent — passed. The deferred-work ledger is unchanged from the full baseline revision recorded above.

### Residual risks

No known defect remains in the requested bootstrap ordering boundary. Verification controls auth callbacks at App's consumer boundary; no live Supabase/browser authentication journey was run. Auth loading retains its existing behavior of finishing when the initial lookup settles.
