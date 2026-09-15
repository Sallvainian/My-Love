---
title: Account data, favorites, admin messages, and mood validation
type: bugfix
created: '2026-09-15'
status: complete
route: dispatch
baseline_commit: be4e7a69940c180acfbe2033e6c675c741181f13
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="Approved in conversation; implement request received 2026-09-15">

## Intent

Implement the remaining account-data/favorites, admin-message, and mood-validation work in three sequential groups. DW-100/101 are already implemented; retain their guards and extend relevant coverage. DW-102/103, DW-117–122, DW-127–129 are open. Treat descriptions as claims, not unquestioned requirements.

## Boundaries & Constraints

- Read AGENTS.md. Work on the existing clean `fix/account-data-mood-validation` branch at the recorded baseline. Preserve unrelated work, the dirty Cursor worktree, all loop state, and the live ledger. Do not start/stop/modify any loop, push, merge, deploy, stage, or commit. Do not invoke bmad-build recursively.
- Implement and test each group before the next. Keep a resumable record in this directory. Match surrounding style; repository has no formatter. No secrets or personal data in artifacts. Use fnox for the production build.
- Preserve DW-100/101's userId plus authSessionVersion checks, stale initialization handoff, second handoff check, shared-default seeding, and loading/latch behavior.
- DW-129 migration approved: version 8→9, centralized in dbSchema.ts, existence-gated. Configuration alone cannot partition the shared flag. Retain favorites from custom rows with known owners; reset unattributed shared daily favorites. Never assign ambiguous state to the current user. Preserve original message rows and ownerless custom rows (still hidden). Legacy row flags are no longer authoritative.
- Invalid mood decision approved: retain recognized array values in order, including duplicates; if none, use valid scalar; preserve valid scalar primary, otherwise first valid array element. No coercion/invented mood. If neither valid, preserve raw row, exclude display/upload, keep pending accounting, allow replacement that day. Preserve an existing hidden row's note unless nonempty replacement text is supplied; normal visible-row editing retains its existing clear-note semantics.
- No server-schema change, scripture changes, visual redesign, general cleanup, or broad API redesign. DW-120 overlaps the sync-boundary work. DW-121's speculative spelling/lint enforcement is proposed deferred; behavioral regression tests and helper adoption are in scope.

## I/O & Edge-Case Matrix

| Scenario | Expected behavior |
| --- | --- |
| A favorites shared daily, switches to B, reloads, returns to A | B sees its own favorites only; A's selection survives locally |
| Signed out | Shared daily readable, favorite writes refused; account favorite projections empty |
| Favorite write spans switch or same-account re-login | Disk mutation belongs only to captured owner; stale continuation never updates new session |
| v8 legacy favorites | Known-owner custom favorites carried over once; shared/global unattributed favorites not assigned |
| Generic update/delete of shared, missing, or another owner's row | No mutation; write refuses; protected fields cannot change |
| Admin A→B→A | A's messages disappear for B and reappear for A; old message dialog disappears on identity change |
| Admin deletion pending/fails/retries | No early closure or duplicate submit; accessible error and retry/cancel; close only after success |
| Malformed mood container/elements | Valid elements/scalar recover into safe copies; raw data unchanged on read |
| Entirely invalid saved mood | Not displayed/uploaded; remains pending; other rows still sync |
| Repair hidden same-day mood | Update same owner/date row, preserve identity/timestamp/server ID; no unique-key collision; repaired row enters UI |
| Mood edited or corrupted during upload | Save returned server ID, leave changed/invalid row dirty; worker and foreground agree |

</frozen-after-approval>

## Code Map

- `src/services/dbSchema.ts`: MyLoveDBSchema, DB_VERSION=8, STORE_NAMES, shared upgradeDb. Every opener delegates here; preserve existing repair branches.
- `src/services/storage.ts`: generic message visibility reads/writers and favorite toggle. `src/services/customMessageService.ts`: stricter owner/allowlist transaction examples and custom deletion.
- `src/stores/slices/messagesSlice.ts`, `settingsSlice.ts`, `authSlice.ts`, `src/stores/useAppStore.ts`: favorite projections, initialization, signedOutState/discardAccountState and hydration/partialize. `src/components/DailyMessage/DailyMessage.tsx` reads favoriteIds.
- `src/components/AdminPanel/`: panel local dialogs retain message previews; DeleteConfirmDialog currently calls success without await/catch.
- `src/types/index.ts`, `src/validation/schemas.ts`, `src/api/validation/supabaseSchemas.ts`: duplicated twelve-key mood vocabulary. Introduce one pure worker-safe canonical definition; keep UI-specific configuration.
- `src/services/moodService.ts`: raw display reads, raw pending queue, markAsSynced. `src/services/moodSyncPayload.ts`: shared payload/fingerprint. `src/sw-db.ts`, `src/sw.ts`, `src/api/moodSyncService.ts`: worker/foreground raw queues, per-row failure accounting, atomic mark-synced. Do not hide invalid pending entries by filtering queues.
- `src/stores/slices/moodSlice.ts`: add/update currently find existing rows in UI array; hidden-row repair needs atomic owner/date save and session guards. Seven consumer expressions: moodSlice partner transform, CalendarDay, MoodDetailModal, PartnerMoodView MoodCard, PartnerMoodDisplay, MoodTracker, MoodHistoryItem.

## Tasks & Acceptance

- [x] Group 1: add `message-favorites` keyed `[messageId,userId]`, indexed by account; one-time approved migration. Separate owner-only update/delete from visible-message favorite writes. Whitelist editable fields and reject protected updates; write failures throw. Atomic toggle returns committed boolean, never optimistic inverse of stale UI. Project account-specific values in all message readers. Keep messages/currentMessage/favoriteIds coherent, scrub sign-out, stop persisting/hydrating global favoriteIds. Update DailyMessage signed-out behavior.
- [x] Group 1 tests: fresh/v8/partial schema and different first openers; migration once, rows retained; owner isolation, reload, sign-out and session races, concurrent toggle, failed writes. Preserve baseline guard tests; add initialization version-only race, second handoff race, catch.
- [x] Group 2: await delete, pending state/dismissal guard, accessible failure and retry/cancel, identity-bound panel previews and completion callbacks. Test real fake-IndexedDB→store→rendered AdminPanel A/B/A plus deletion success/failure/pending/retry and stale completion.
- [x] Group 3: canonical mood vocabulary/normalizer, normalized display copies and all seven consumers, validated shared payload/fingerprint with safe mark-synced on newly invalid row. Preserve raw pending queues and fail-before-network behavior. Add atomic owner/date hidden-row repair and add/update session guards.
- [x] Group 3 tests: malformed array/scalar/mixed values, valid legacy/order/duplicates, purity, raw storage retention, owner scope, hidden-row repair; outgoing bodies and invalid sibling batches in both writers; fingerprints and concurrent edits/corruption; affected components.
- [x] Add meaningful Chromium tests under tests/e2e with merged-fixtures for actual IndexedDB favorites/account switching and mood recovery; confirm store and rendered UI after persistence. Use existing fixture account pool without changing shared partner/password state. Coordinate browser tests with root; do not run them concurrently against shared service state.
- [x] Run focused tests after each group; update progress with exact commands/results and remaining work. Root owns final independent review and broad validation.

Acceptance: every matrix behavior has a meaningful exercised regression; no stale account state or invented mood; all approved data handling follows the recorded choices.

## Implementation Notes

Initial baseline clean; no active candidate in inspected loop records. Other Cursor worktree contains preserved unrelated changes. Baseline guard check passed 117 tests across loaderIdentityGuards and settingsSlice.initializeApp. Research agents were not independent reviewers.

## Verification

Focused Vitest after each group with `--reporter=default` to avoid shared junit output. Final `npm run test:unit`, `npm run lint`, `npm run typecheck`, relevant Chromium/integration checks, `fnox exec -- npm run build`. Local Supabase CLI 2.117.0 and containers are available; do not reset/reconfigure services. Report mocked vs real boundary coverage accurately.

## Spec Change Log

## Review Triage Log

Three reviewers were launched with fresh context. A and B reported; C's session ended on a provider usage
limit before it wrote a report, and only the two leads named in `progress.md` were recoverable. Those were
re-derived against the same diff and dispositioned in [review-c-integration.md](review-c-integration.md).

| Finding | Source | Verdict | Disposition |
| --- | --- | --- | --- |
| A-1 — `syncPendingMoods` writes completion state with no session guard | A | Accepted; pre-existing at baseline, but a gap against this spec's mood account-race invariant | Fixed in `moodSlice.ts`; six regressions in `tests/unit/stores/moodSlice.test.ts` |
| Mood normalization, persistence and sync boundaries | B | No actionable findings | None |
| C-1 — new clearing `else` in the MoodTracker seeding block wipes an unsaved draft on the 5-minute sync timer | C (reconstructed) | Confirmed; introduced by this change | Fixed in `MoodTracker.tsx`; two regressions in `MoodTracker.draftPreservation.test.tsx` |
| C-2 — unsurfaced IndexedDB transaction failure | C (reconstructed) | Refuted — every readwrite transaction awaits `tx.done` on every exit path | No change |
| C-3 — new timestamp rejection in the sync payload | Found during reconstruction | Refuted as unreachable — no writer produces a non-`Date` timestamp | No change |

Full results in [verification.md](verification.md).
