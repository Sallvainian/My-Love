# PR #113 — Comprehensive Review Report

**Branch:** `epic-4/together-mode-synchronized-reading` → `main`
**Date:** 2026-03-03
**Scope:** 450 files, +53,424 / -11,699 lines
**PR URL:** https://github.com/Sallvainian/My-Love/pull/113

## Review Team

| Agent                | Aspect                                                                | Model |
| -------------------- | --------------------------------------------------------------------- | ----- |
| code-reviewer        | CLAUDE.md compliance, security, React patterns, state management      | Opus  |
| error-hunter         | Silent failures, swallowed errors, reconnection logic, auth guards    | Opus  |
| test-analyzer        | Coverage gaps, edge cases, test quality, mock realism                 | Opus  |
| type-analyst         | Type invariants, encapsulation, discriminated unions, Zod consistency | Opus  |
| comment-reviewer     | Comment accuracy, stale docs, TODO items, SQL comments                | Opus  |
| root-cause-analyst   | Systemic root cause analysis across all findings                      | Opus  |
| adversarial-reviewer | Cynical adversarial review of source code and migrations              | Opus  |

---

## Executive Summary

The PR is well-structured with solid fundamentals — thorough auth guards, optimistic UI with rollback, structured error system with Sentry + PII stripping, and excellent test coverage (1:1 component-to-test mapping). However, the review uncovered **2 critical issues**, **12 important issues**, and **20 suggestions**, traceable to **5 systemic root causes**. The highest-leverage fix is a single command (`supabase gen types typescript --local`) that resolves 5 findings at once.

---

## Critical Issues (2)

### C1. Duplicate `SessionRole` type — drift risk

- **Source:** Type Design, Root Cause 1
- **Files:** `src/services/dbSchema.ts:36`, `src/stores/slices/scriptureReadingSlice.ts:25`
- **Description:** `dbSchema.ts` defines `ScriptureSessionRole = 'reader' | 'responder'` and `scriptureReadingSlice.ts` independently defines `SessionRole = 'reader' | 'responder'`. These are identical string literal unions today, but neither imports from the other. If one changes (e.g., a third role is added), the other won't fail at compile time.
- **Fix:** The slice should import and re-export `ScriptureSessionRole` from `dbSchema.ts`.

### C2. `onBroadcastReceived` processes broadcasts when `session` is null

- **Source:** Adversarial Review
- **File:** `src/stores/slices/scriptureReadingSlice.ts:759`
- **Description:** If `session` is null, the version check short-circuits and the handler sets stale partner state (`partnerJoined: true`, etc.) after the session was already cleared by `exitSession()`. Reconnection broadcasts arriving between state reset and hook unmount cause state pollution.
- **Fix:** Add an early return when `session` is null before any state updates.

---

## Important Issues (12)

### I1. `callLobbyRpc` untyped RPC wrapper bypasses type safety

- **Source:** Code Quality, Type Design, Root Cause 1
- **File:** `src/stores/slices/scriptureReadingSlice.ts:50-61`
- **Description:** The `callLobbyRpc` function uses `as unknown as UntypedRpc` to circumvent Supabase's typed RPC interface. The comment says "Remove once `supabase gen types typescript --local` is run after migration" — but the migration has already landed. All callers use unsafe casts (lines 593, 643, 844, 937, 986).
- **Fix:** Regenerate `database.types.ts` to get typed RPCs and remove this wrapper.

### I2. Dual `triggeredBy` / `triggered_by` fields in StateUpdatePayload

- **Source:** Code Quality, Type Design, Comments, Root Cause 1
- **File:** `src/stores/slices/scriptureReadingSlice.ts:38-39, 750-752`
- **Description:** `StateUpdatePayload` carries both camelCase `triggeredBy` and snake_case `triggered_by` for the same value. The consumer checks both (line 750-752), but only `triggered_by` is ever sent. The "Backward compatibility" comment doesn't apply since no prior consumers existed.
- **Fix:** Pick one convention (snake_case to match DB) and remove the other.

### I3. Hardcoded step boundary constant in SQL coupled to frontend

- **Source:** Code Quality, Adversarial Review, Root Cause 3
- **File:** `supabase/migrations/20260303000100_hardening_chunks_1_4.sql:105`
- **Description:** `v_max_step_index CONSTANT INT := 16` is coupled to `MAX_STEPS = 17` in frontend code (`src/data/scriptureSteps.ts`). If steps are added/removed, the SQL boundary silently becomes incorrect.
- **Fix:** Add a pgTAP test asserting the step boundary matches, or accept `max_step` as an RPC parameter.

### I4. `.env.local` deletion leaves encrypted secrets in git history

- **Source:** Code Quality
- **File:** git history
- **Description:** The `.env.local` file (dotenvx-encrypted values) was previously tracked. This PR correctly deletes it for the fnox migration, but the encrypted values + `DOTENV_PUBLIC_KEY_LOCAL` remain in git history.
- **Fix:** Not blocking. Consider a future `git filter-repo` cleanup.

### I5. Unbounded retry loop in useScriptureBroadcast and useScripturePresence

- **Source:** Error Handling, Adversarial Review, Root Cause 2
- **Files:** `src/hooks/useScriptureBroadcast.ts:215-283`, `src/hooks/useScripturePresence.ts:176`
- **Description:** Both hooks use `setRetryCount((c) => c + 1)` on CHANNEL_ERROR/CLOSED with no maximum retry limit, no exponential backoff, and no delay between retries. Persistent server failure creates a hot loop of subscribe-fail-cleanup-subscribe that burns CPU and floods Sentry. Compare to `useRealtimeMessages.ts` which has `RETRY_CONFIG.maxRetries` with exponential backoff.
- **Fix:** Add a max retry count (e.g., 5) with exponential backoff. After max retries, set an error state and stop.

### I6. `useScripturePresence.sendPresence()` swallows all send errors

- **Source:** Error Handling, Root Cause 2
- **File:** `src/hooks/useScripturePresence.ts:76-86`
- **Description:** `void channel.send({...})` with no `.catch()` handler. If the channel send rejects, the promise rejection is completely swallowed. Fires every 10 seconds via heartbeat. Contrast with `useScriptureBroadcast.ts:181-197` which properly handles both sync throws and async rejections.
- **Fix:** Add `.catch()` to the `channel.send()` call with at minimum a `console.warn`.

### I7. `useScripturePresence` removeChannel error swallowed on CHANNEL_ERROR

- **Source:** Error Handling, Adversarial Review, Root Cause 2
- **Files:** `src/hooks/useScripturePresence.ts:174`
- **Description:** `void supabase.removeChannel(channel)` without `.catch()`. If `removeChannel` rejects, the channel leaks. The broadcast hook properly catches this at lines 238-250.
- **Fix:** Add `.catch()` to `removeChannel`, matching the broadcast hook's pattern.

### I8. `ended_early` status not tested in validation schema

- **Source:** Test Coverage, Root Cause 4
- **File:** `src/validation/schemas.ts:284`
- **Description:** The `SupabaseSessionSchema` was updated to add `'ended_early'` to the status enum, but no test asserts this value is accepted.
- **Fix:** Add a test case asserting `ended_early` passes Zod validation.

### I9. `sentry.ts` completely untested

- **Source:** Test Coverage, Root Cause 4
- **File:** `src/config/sentry.ts`
- **Description:** 54-line file with `Sentry.init()` config, PII stripping in `beforeSend` (deletes `email` and `ip_address`), user context management, and `ignoreErrors` regex patterns. No unit test exists. The PII-stripping logic is security-relevant.
- **Fix:** Write unit tests for `beforeSend` PII stripping and `ignoreErrors` patterns.

### I10. `lockIn()` both_locked success branch not tested

- **Source:** Test Coverage, Root Cause 4
- **File:** `src/stores/slices/scriptureReadingSlice.ts:846-873`
- **Description:** The `lockIn()` action's `both_locked === true` path (advances step, resets lock flags, broadcasts `state_updated`) is the core together-mode interaction — but no test covers it. Only the RPC call, optimistic update, and error paths are tested.
- **Fix:** Add a test for the `both_locked === true` success branch.

### I11. `scripture_create_session` uses SECURITY DEFINER

- **Source:** Adversarial Review
- **File:** `supabase/migrations/20260301000100_fix_scripture_create_session_together_lobby.sql:17`
- **Description:** `scripture_create_session` is `SECURITY DEFINER` while every other scripture RPC uses `SECURITY INVOKER`. This means it executes with the function owner's privileges (typically `postgres`), bypassing all RLS policies. This is a privilege escalation vector if the function is ever modified.
- **Fix:** Audit whether `SECURITY DEFINER` is required. If not, change to `SECURITY INVOKER`.

### I12. Default `isPartnerConnected: true` hides real disconnections for 20 seconds

- **Source:** Adversarial Review
- **File:** `src/hooks/useScripturePresence.ts:53`
- **Description:** Default state sets `isPartnerConnected: true`. If the partner is actually disconnected on mount, the transition to `false` only happens after `STALE_TTL_MS` (20s) elapses, creating a 20-second window with no disconnection indication.
- **Fix:** Default to `isPartnerConnected: false` and let the first presence event set it to `true`.

---

## Suggestions (20)

| #   | Suggestion                                                                                   | Source             | File                                                                  |
| --- | -------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| S1  | `handleScriptureError` repetitive 66-line switch — simplify to severity-based conditional    | Code               | `scriptureReadingService.ts:49-115`                                   |
| S2  | Missing return type annotation on `LockInButton`                                             | Code               | `LockInButton.tsx:25`                                                 |
| S3  | `scriptureTheme` object duplicated across 3 component files — extract to shared constants    | Code, RCA-5        | `ReadingContainer.tsx`, `LobbyContainer.tsx`, `ScriptureOverview.tsx` |
| S4  | Presence channel retry lacks backoff — tight loop on persistent error                        | Code, Error        | `useScripturePresence.ts`                                             |
| S5  | `DisconnectionOverlay` computed boolean in useEffect dependency array                        | Code               | `DisconnectionOverlay.tsx:63`                                         |
| S6  | `lockIn` 409 detection by string matching — fragile                                          | Code, Adversarial  | `scriptureReadingSlice.ts:882`                                        |
| S7  | Background refresh methods have empty catch blocks (`// Silent failure`)                     | Error              | `scriptureReadingService.ts:820-855`                                  |
| S8  | Zod `.parse()` throws without `VALIDATION_FAILED` error code — Sentry won't tag              | Error              | `scriptureReadingService.ts:247,381,...`                              |
| S9  | `checkForActiveSession` only checks solo sessions — together-mode not resumable              | Error, Adversarial | `scriptureReadingSlice.ts:307`                                        |
| S10 | Edge function catch-all missing CORS headers                                                 | Error              | `upload-love-note-image/index.ts:267`                                 |
| S11 | `LobbyContainer` async handlers don't catch — unhandled promise rejections                   | Error              | `LobbyContainer.tsx:68-81`                                            |
| S12 | Mixed naming conventions (semantic vs positional) for role/ready fields                      | Type               | `dbSchema.ts:53-58`                                                   |
| S13 | `PartnerPresenceInfo` mixed absence signals — consider discriminated union                   | Type               | `useScripturePresence.ts:25-30`                                       |
| S14 | `_broadcastFn` non-serializable in Zustand state — document persistence exclusion            | Type               | `scriptureReadingSlice.ts:124`                                        |
| S15 | `NetworkStatusIndicator` and `SyncToast` lack unit tests                                     | Test               | `src/components/shared/`                                              |
| S16 | `convertToSolo()` error path untested                                                        | Test               | `scriptureReadingSlice.ts:708-716`                                    |
| S17 | `endSession()` `isSyncing` guard untested                                                    | Test               | `scriptureReadingSlice.ts:973`                                        |
| S18 | `Countdown` calls `onComplete` in useEffect without mounted guard — stale closure risk       | Adversarial        | `Countdown.tsx:50-51, 58-59`                                          |
| S19 | RLS policies on `realtime.messages` do unindexed scan on `user1_id`                          | Adversarial        | migration SQL                                                         |
| S20 | Migration chain has fragile intermediate state — partial rollback restores broken broadcasts | Adversarial        | `20260228000001` → `20260301000200`                                   |

---

## Comment Issues

| #   | Severity   | Issue                                                                                               | File                             |
| --- | ---------- | --------------------------------------------------------------------------------------------------- | -------------------------------- |
| CM1 | Important  | Misleading comment: `session.userId` is "always `user1_id`" — only true for together-mode load path | `scriptureReadingSlice.ts:761`   |
| CM2 | Suggestion | `callLobbyRpc` "Remove once..." comment lacks tracking mechanism                                    | `scriptureReadingSlice.ts:47-49` |
| CM3 | Suggestion | Dual key pattern lacks deprecation intent documentation                                             | `scriptureReadingSlice.ts:38-39` |
| CM4 | Positive   | eslint-disable comments have inline justifications — good pattern to emulate                        | `useScripturePresence.ts:215`    |

---

## Root Cause Analysis (5 systemic causes)

### RC1. Stale Generated Types — Migration Shipped Without Regenerating `database.types.ts`

- **Issues resolved:** C1, I1, I2, CM2, CM3
- **Priority:** HIGH
- **Fix effort:** One command + cleanup

The migration `20260303000100_hardening_chunks_1_4.sql` introduced new RPCs but `database.types.ts` was never regenerated. This cascaded into the `callLobbyRpc` unsafe wrapper, duplicate `SessionRole` type, and dual `triggeredBy`/`triggered_by` keys — all workarounds for missing generated types.

**Fix:** `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`

### RC2. Inconsistent Realtime Channel Resilience Patterns

- **Issues resolved:** I5, I6, I7, S4
- **Priority:** MEDIUM-HIGH
- **Fix effort:** Backport guards or extract shared utility

`useScriptureBroadcast` evolved through Story 4.3 hardening; `useScripturePresence` (Story 4.2) was written earlier and never updated to match. The broadcast hook has `isRetryingRef` guards, error-handled `channel.send()`, and error-handled `removeChannel()` — the presence hook has none of these.

**Fix:** Extract a shared `createRealtimeChannel()` utility, or backport broadcast hook's guards into presence hook.

### RC3. Cross-Layer Constants Without Shared Source of Truth

- **Issues resolved:** I3, S6
- **Priority:** MEDIUM
- **Fix effort:** pgTAP test + structured error codes

Frontend `MAX_STEPS = 17` and SQL `v_max_step_index = 16` are coupled only by a comment. The `lockIn` 409 detection uses string matching because there's no shared error code contract between SQL RPCs and TypeScript consumers.

**Fix:** Add pgTAP assertion for step boundary. Return structured error codes from RPCs.

### RC4. Test Coverage Gaps in Infrastructure Code

- **Issues resolved:** I8, I9, I10, S15, S16, S17
- **Priority:** MEDIUM
- **Fix effort:** ~5 test files

Gaps cluster in infrastructure/config code (`sentry.ts`) and together-mode happy-path branches (`both_locked === true`, `ended_early`). The untested `beforeSend` PII stripping is a privacy-sensitive gap.

**Fix:** Prioritize tests for: (1) `sentry.ts` `beforeSend`, (2) `lockIn()` `both_locked` branch, (3) `ended_early` Zod validation.

### RC5. Incremental Code Duplication Across Stories

- **Issues resolved:** S1, S3, S12
- **Priority:** LOW
- **Fix effort:** Refactor in follow-up PR

Stories 4.1-4.3 were built incrementally, each adding components with slightly different patterns. `scriptureTheme` is defined in 3 files, `handleScriptureError` has a repetitive 66-line switch, and role/ready fields mix naming conventions.

**Fix:** Extract shared constants, simplify error switch, document naming convention.

---

## Recommended Action Order

| Order | Action                                                 | Resolves    | Effort       |
| ----- | ------------------------------------------------------ | ----------- | ------------ |
| 1     | Regenerate `database.types.ts`                         | C1, I1, I2  | 1 command    |
| 2     | Add null-session guard to `onBroadcastReceived`        | C2          | 3 lines      |
| 3     | Backport retry cap + backoff to presence hook          | I5, I6, I7  | ~30 min      |
| 4     | Audit `SECURITY DEFINER` on `scripture_create_session` | I11         | ~15 min      |
| 5     | Default `isPartnerConnected: false`                    | I12         | 1 line       |
| 6     | Add tests: Sentry PII, `both_locked`, `ended_early`    | I8, I9, I10 | ~2 hr        |
| 7     | Add pgTAP test for step boundary constant              | I3          | ~15 min      |
| 8     | Remaining suggestions                                  | S1-S20      | Follow-up PR |

---

## NFR Assessment Integration

This section cross-references the PR code review findings with the NFR Assessment (2026-03-03, post-hardening Chunks 1+4). The NFR assessment scored **20/29 criteria (PASS with CONCERNS)** across 8 ADR categories. Several PR review findings directly correlate with NFR gaps, deferred hardening items, or contradict NFR PASS ratings.

### NFR Scorecard

| Category                      | NFR Score      | PR Review Correlation                                                       |
| ----------------------------- | -------------- | --------------------------------------------------------------------------- |
| 1. Testability & Automation   | PASS (4/4)     | Confirmed — strong test coverage                                            |
| 2. Test Data Strategy         | PASS (3/3)     | Confirmed                                                                   |
| 3. Scalability & Availability | CONCERNS (1/4) | Confirmed — by-design for MVP (2-user channels)                             |
| 4. Disaster Recovery          | CONCERNS (2/3) | Confirmed — RTO/RPO undefined, platform-managed                             |
| 5. Security                   | PASS (4/4)     | **Challenged** — I11 found `SECURITY DEFINER` on `scripture_create_session` |
| 6. Monitorability             | CONCERNS (2/4) | **Challenged** — I9 found Sentry PII stripping is untested                  |
| 7. QoS & QoE                  | CONCERNS (2/4) | Confirmed — no formal latency measurement                                   |
| 8. Deployability              | PASS (2/3)     | Confirmed                                                                   |

### Cross-Reference: PR Findings vs. NFR Assessment

#### Security (NFR-S1, S2) — NFR says PASS, PR review challenges

The NFR assessment states: _"All 6 scripture RPCs now consistently SECURITY INVOKER; `scripture_end_session` regression to DEFINER reverted (AC-12)."_

However, the adversarial review found **I11**: `scripture_create_session` still uses `SECURITY DEFINER` (in `20260301000100_fix_scripture_create_session_together_lobby.sql:17`). This was not caught by the NFR assessment or the hardening tech spec adversarial review. The NFR's security PASS should be qualified — while 6 of 7 RPCs are correctly `SECURITY INVOKER`, the session creation RPC runs with elevated privileges.

**NFR Impact:** Security score should be CONCERNS (3/4) pending audit of whether `SECURITY DEFINER` is required for `scripture_create_session`.

#### Reliability (NFR-R1, R3) — NFR says PASS, PR review finds gaps

The NFR assessment gives Reliability a PASS across error handling, reconnection, and race conditions. The PR review found two issues that directly undermine these ratings:

- **C2 (null session broadcast processing):** `onBroadcastReceived` processes broadcasts when `session` is null, causing state pollution. This contradicts the NFR-R3 claim of "zero double-advances" — stale broadcasts can set `partnerJoined: true` after session exit.
- **I5 (unbounded retry loop):** Both realtime hooks retry infinitely without cap or backoff. The NFR assessment notes this is deferred to **Chunk 2 (Reconnection Resilience)** but rates the category PASS. The PR review considers this IMPORTANT because it can cause client-side resource exhaustion.

**NFR Impact:** Reliability error handling sub-category should be CONCERNS pending Chunk 2 implementation.

#### Monitorability — NFR says CONCERNS, PR review deepens the concern

The NFR assessment already flags monitorability as CONCERNS (2/4 criteria met). The PR review adds:

- **I9 (Sentry config untested):** The `beforeSend` PII-stripping logic in `sentry.ts` — which deletes `email` and `ip_address` from error events — has zero unit tests. The NFR assessment gives Sentry integration a PASS ("Sentry now wired — error observability operational"), but the PII stripping correctness is unverified.

**NFR Impact:** Sentry observability confidence is weaker than the NFR assessment suggests.

#### Performance (NFR-P1) — Both agree: evidence gap

Both the NFR assessment and PR review agree that real-time sync latency (NFR-P1: <500ms) is not formally measured. The NFR assessment infers compliance from architecture ("Supabase Realtime WebSocket latency is well below 500ms for 2-user sessions"). The PR review found no additional performance concerns beyond what the NFR already flagged.

### Deferred Hardening: Chunk 2 & 3 vs. PR Findings

The hardening tech spec explicitly deferred Chunks 2 and 3. Multiple PR review findings map directly to these deferred items:

| Deferred Item                     | Chunk   | PR Finding                                    | Status                                |
| --------------------------------- | ------- | --------------------------------------------- | ------------------------------------- |
| MAX_RETRIES + exponential backoff | Chunk 2 | **I5** (unbounded retry)                      | Unresolved — confirmed by 3 reviewers |
| Presence CLOSED handler hardening | Chunk 2 | **I7** (removeChannel error swallowed)        | Unresolved                            |
| Version guard ordering            | Chunk 3 | **C2** (null session broadcast)               | Unresolved — escalated to Critical    |
| Structured error matching         | Chunk 3 | **S6** (409 detection by string matching)     | Unresolved                            |
| Scoped state reset                | Chunk 3 | **S9** (together-mode sessions not resumable) | Unresolved                            |

**Conclusion:** The PR review validates that Chunks 2+3 are genuinely needed. The retro recommendation to create a quick-spec for these chunks should be prioritized — at least I5 and C2 should be addressed before or alongside merge.

### NFR Thresholds Reference

For context, these are the PRD-defined non-functional requirements for Epic 4:

| NFR    | Threshold                                  | PR Status                              |
| ------ | ------------------------------------------ | -------------------------------------- |
| NFR-P1 | Real-time sync latency < 500ms             | Not measured (architecture inferred)   |
| NFR-P2 | Phase transition < 200ms                   | PASS (synchronous Zustand set)         |
| NFR-P3 | Initial load < 2s on 3G                    | Not measured (no Lighthouse in CI)     |
| NFR-P4 | "Syncing..." indicator, no jitter          | PASS (optimistic UI + version guards)  |
| NFR-S1 | Reflection data: user + partner only (RLS) | PASS                                   |
| NFR-S2 | Session data: participants only            | CONCERNS (I11: SECURITY DEFINER)       |
| NFR-S4 | Encryption at rest + in transit            | PASS (Supabase defaults)               |
| NFR-R1 | Session state recovery 100%                | CONCERNS (C2: null session broadcasts) |
| NFR-R3 | Zero double-advances                       | PASS (server-authoritative versioning) |
| NFR-R5 | Usable if partner offline                  | PASS (solo fallback)                   |
| NFR-R6 | Reflection write idempotency               | PASS (unique constraint)               |
| NFR-A1 | WCAG AA minimum                            | PASS (tested in E2E)                   |

---

## Strengths (consistent across all reviewers)

- **Thorough auth guards** on every store action with proper `UNAUTHORIZED` error propagation
- **Optimistic UI with rollback** — `selectRole`, `toggleReady`, `lockIn`, `undoLockIn` all follow consistent optimistic-update-then-rollback pattern
- **SQL security** — RLS policies validate UUID format with regex, all RPCs use `SECURITY INVOKER` (except `create_session`), `search_path = ''`
- **Structured error system** — `ScriptureErrorCode` enum + `handleScriptureError` + Sentry with PII stripping
- **Excellent documentation** — file-level JSDoc headers, story/AC tracing (`// Story 4.1: AC #2`), "why" not "what" inline comments
- **1:1 component-to-test mapping** with layered store test suites (7 files for `scriptureReadingSlice`)
- **Clean broadcast architecture** bridging React hooks and Zustand via `setBroadcastFn` pattern
- **Disconnection UX** — two-phase overlay, confirmation dialogs, blame-free language, proper focus management
- **Zod validation at service boundaries** preventing corrupted data from propagating
- **Version-checked state updates** rejecting stale broadcasts
