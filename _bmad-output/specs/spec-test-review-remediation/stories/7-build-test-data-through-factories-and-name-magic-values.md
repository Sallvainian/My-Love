---
title: 'Build test data through factories and name magic values'
type: 'refactor'
created: '2026-09-25'
status: 'done'
baseline_revision: 'ae2b37b432bfb19b293b868d79473f325df36bf3'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
  - '{project-root}/.claude/skills/bmad-testarch-test-review/steps-c/criteria-registry.md'
warnings: ['oversized']
deferred:
  - summary: >-
      A fresh TEA re-review may flag M2/L6 instances that no catalog row names, such as the couple-settings server answer built about seven times in tests/unit/stores/coupleSettings.test.ts.
    evidence: |-
      This story fixed every catalog row. It did not sweep the files for repeated shapes or literals that no row names. The implementer noted the coupleSettings server answer, `{ relationshipStart, weddingDate }`, as one such repeat. To settle it, run bmad-testarch-test-review on tests/unit, src, tests/e2e and tests/api + tests/integration, and count the M2/L6 rows it reports.
    location: >-
      tests/unit/stores/coupleSettings.test.ts
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The 2026-09-25 test reviews flag every M2 row (the same domain payload is built inline three or more times, or an existing repo factory is bypassed) and every L6 row (an unexplained literal carries domain meaning) across the five `findings-*.md` catalogs, about 100 distinct rows in about 70 files.

**Approach:** For each M2 row, build the payload through the existing factory in `tests/support/factories/`, or through one named builder or constant in the file or a shared unit helper. For each L6 row, give the literal a name. Use an exported production constant where one exists. Otherwise use a local `const` with a comment naming its source `path` (and symbol). Work folder by folder, with one commit per folder × rule group.

## Boundaries & Constraints

**Always:**
- Keep every test proving what it proves today. A builder produces the same values the assertions depend on: ids, tokens, dates, `toEqual` key sets, and absent keys. Never weaken, skip or delete a test.
- Locate rows by content, because catalog line numbers are stale. Rows that appear in both the folder-run and suite-run tables are fixed once.
- `corrections.md` wins over a row's suggested fix. For the `handler.test.ts` `'60'` row, the constant is `CONFIG.RATE_LIMIT_WINDOW_MS`. `handler.ts` hard-codes `'Retry-After': '60'` too, so derive both from the constant. That change is its own commit, typed `refactor(upload-love-note-image)`.
- Match the surrounding style by hand. Never run `prettier --write`.
- Use relative imports in `src/`; the `@/` alias is allowed in tests. Every new `eslint-disable` carries a ` -- ` reason.
- Rows already fixed by earlier stories need no edit. Confirm each one with grep: `src/utils/__tests__/moodGrouping.test.ts` M2/L6 and `src/utils/__tests__/dateUtils.test.ts` L6.

**Never:**
- Do not export a module-private production constant just to import it, or otherwise change app code. The one exception is the corrections-mandated `handler.ts` Retry-After line.
- Do not change the defaults of `makePersistedBlob`, `SEEDED_SETTINGS` or `SEEDED_MESSAGE_HISTORY`, which e2e depends on.
- Do not touch other stories' rules (H5 splits, selectors, names), `tests/e2e-archive/`, or pgTAP files.
- Do not introduce a live-clock value into an asserted field. A factory default that reads `Date.now()` may be used only where the clock is pinned or nothing reads the field.

</intent-contract>

## Code Map

Current line numbers from the planning investigation, `~` = approximate. "local" = file-scope builder/const in that file.

**Shared support changes**
- `tests/support/factories/auth-bootstrap-notification-order.ts` -- add optional `refreshToken?`, `expiresAt?` to `createAuthBootstrapSession` options (defaults unchanged), so token-asserting Session rows can adopt it. `createAuthBootstrapEvent` may gain optional `id?`/`date?` if App.eventsSession needs them.
- `tests/support/factories/interaction-record-ownership.ts` -- add `createInteractionInsert(overrides)` = `createInteractionRecord` minus `created_at`: the `authenticated` role's column grant (`20260912020000_partner_only_immutable_interactions.sql:123`) omits `created_at`, and the server default `now()` keeps new rows newest.
- `tests/unit/helpers/persistedBlob.ts` (new) -- builds on `tests/support/helpers/persisted-blob.ts` (`makePersistedBlob`, `STORAGE_KEY`, `PERSIST_VERSION`, `SEEDED_SETTINGS`), with deterministic `PERSISTED_EVENT`/`PERSISTED_MOOD` and a `persistedBlob(extra)` that passes strip-free `settings` and a minimal `messageHistory`, so `persistedBlobContract`'s zero-serialization case holds.

**tests/api (M2, L6)**
- `check-constraint-error-mapping.spec.ts` -- events body ×3 (~133, 294, 328 w/ bad icon) → local `eventBody(userId, overrides)` + `FAR_FUTURE_EVENT_DATE`; photos/love_notes/partner_requests bodies (163–237) → `createCheckWritePayload(table, userId, partnerId, {field})`, self-row cases override `to_user_id: userId`.
- `couple-broadcast-authorization.spec.ts` -- 14 `{ message: { id, content } }` + 2 id-only → `notePayload(id, content?)` that omits `content` when undefined (exact `toEqual` at ~347, 541–544).
- `events-wire-contract.spec.ts` -- 5-row seed (~426–464) and 2-row seed (~545–551) → `seedEvents` (import only `seedEvents`/`EventSpec` from `factories/events`; the helpers module owns a different `clearPairEvents`). Keep ~333 literal (asserts omitted icon/description defaults); request bodies under test at 254/701/722 may stay.
- `interaction-authorization.spec.ts` -- bodies ~75, 101, 194, 262 → `createInteractionInsert`.
- `photos-keyset-paging.spec.ts` ~105 -- `createCheckWritePayload('photos', …, { storage_path: prefix…, created_at, … })`; keep the `keyset-paging-` prefix; cast to the photos Insert type if needed.
- `upload-love-note-image-limits.spec.ts` ~292 -- bare PNG bytes inside `page.evaluate` → pass `Array.from(PNG_MAGIC)` (defined ~37) as an evaluate argument.
- `supabase/functions/upload-love-note-image/handler.ts` ~381, `handler.test.ts` ~649 -- `String(CONFIG.RATE_LIMIT_WINDOW_MS / 1000)`.

**tests/e2e**
- `home/home-kit.spec.ts` ~119, 168–174; `navigation/kit-chrome.spec.ts` ~64–71 -- named kit type-scale consts (`KIT_COUNTDOWN_VALUE`, `DAILY_MESSAGE_TYPE`, `WORDMARK_TYPE`); pass the `fonts.load` string into `evaluate` as an argument.
- `partner/interaction-record-ownership.spec.ts` ~74, 146, 206, 228 -- `mappedInteraction(record, overrides?)`; keep explicit `viewed: false` at the null-mapping site.
- `settings/events-accessibility.spec.ts` ~109, 156, 210 -- one `seedA11yEvent(admin, userId)`.
- `settings/events-history-pagination.spec.ts` -- `PAGE_SIZE = 50` (eventsService `DEFAULT_EVENTS_PAGE_SIZE`, private), derive 51/52/100/200/208/104, name the -500/-1000 offsets, and `ROW_PREFIX.length` instead of `.slice(10)`.
- `home/events.spec.ts` ~481, `settings/events-crud.spec.ts` ~474 -- `createDatabaseErrorEnvelope({ message, details: '', hint: '' })`; keep the messages (asserted).
- `offline/interactions-offline-copy.spec.ts` ~69, `offline/needs-a-connection.spec.ts` ~420 -- `createInteractionInsert({ type, from_user_id: partnerId, to_user_id: userId })`.

**src (component/service tests)**
- `api/auth/__tests__/authServices.test.ts` -- 3 Sessions → `createAuthBootstrapSession` with explicit `accessToken`/`refreshToken`/`expiresAt` (asserted at ~150, ~191).
- `PhotoGallery/__tests__/PhotoGridItem.recovery.test.tsx` -- `PHOTO_REFS` from `PHOTO`/`PATH` (the hoisted `vi.mock` site at ~38 moves its pair into `vi.hoisted`, or stays with a comment). `PhotoViewer.focus.test.tsx` -- `TWO_PHOTOS`.
- `RelationshipTimers/__tests__/CountdownCards.test.tsx` -- hoist `LINKED` to module scope; `SAM` profile const + spreads. `Settings.birthdayWedding.test.tsx` -- `NO_PROFILE`. `Settings.togetherSince.test.tsx` -- `LINKED`.
- `Settings/__tests__/EventsSettings.test.tsx`, `EventsSettings.focus.test.tsx` -- local `writeFailure(code, error)` (+ `UNREADABLE`/`STALE` consts).
- `love-notes/__tests__/LoveNoteMessage.test.tsx` -- `withImage(path?)`; `3600000` → `IMAGE_STORAGE.SIGNED_URL_EXPIRY_SECONDS * 1000` (`src/config/images.ts:50`). `MessageInput.test.tsx` -- `jpegFile()`. `NoteRemoval.test.tsx` -- `unsent(flags)`.
- `hooks/__tests__/usePartnerMood.test.ts` -- `moodRecord(overrides)`. `services/__tests__/loveNoteImageService.test.ts` -- `jpegFile()`, `edgeError(status, error, message)`. `utils/__tests__/backgroundSync.test.ts` -- `syncCompleted(successCount, failCount)`.
- L6: `InteractionHistory.test.tsx` `HISTORY_PAGE_SIZE = 100` (InteractionHistory.tsx:47); `PartnerMoodView.kit.test.tsx` `PARTNER_MOOD_LIMIT = 30` (PartnerMoodView.tsx:96); `PokeKissInterface.test.tsx` `COOLDOWN_MS` (PokeKissInterface.tsx:37) for `1_800_000`/`1_799_000`; `EventCountdown.test.tsx` `MAX_CARDS = 3` (test cap; Home uses 6) and a named-args `slot({ raw, upcoming, settled, failed })`; `photoDialogsA11y.test.tsx` `MAX_PHOTO_TAGS = 10` (PhotoUpload.tsx:230) and build the 11-tag value from it.

**tests/unit**
- `App.eventsSession.test.tsx`, `App.localCopyRefresh.test.tsx` -- `session()` → `createAuthBootstrapSession({ userId, accessToken?, email, displayName: null })`; `event()` → `createAuthBootstrapEvent` with `id: label` and its date pinned (called after `vi.setSystemTime`, or via the optional `date`).
- `api/supabaseClientAuthFlow.test.ts` -- `seedVictimSession` builds via the factory with `accessToken: 'victim.access.token'`; `invalidGrantResponse(description?)` returns a new `Response` per call.
- `api/errorHandlers.test.ts` -- local `unmapped(fields)` with `UNMAPPED_CODE = 'XX000'`, no default message (not `createDatabaseErrorEnvelope`, whose blank default would change the missing-message cases).
- `api/interactionService.test.ts` ~146 -- `createInteractionRecord({ id: 'incoming-1', from_user_id, to_user_id })`. `api/ownDisplayNameContract.test.ts` -- `profileRow(display_name)`.
- L6 in api: `ephemeralBroadcast.test.ts` `BROADCAST_TIMEOUT_MS` (ephemeralBroadcast.ts:77); `partnerLookupContract.test.ts` `LOOKUP_BACKOFF_MS` (supabaseClient.ts:229) with derived margins; `realtimeLeaveContract.test.ts` `FIRST_MOOD_REOPEN_DELAY_MS`; `moodSyncSubscription.test.ts` `MOOD_RETRY` mirror of `RETRY_CONFIG` (moodSyncService.ts:106) and the derived schedule.
- `config/playwrightReporting.test.ts` -- `SHARD_MEASUREMENT_RUN_ID`, `HISTORICAL_BASELINE_RUN_ID` (cited in `.github/workflows/test.yml`). `hooks/usePhotoImage.test.ts` -- `PAST_EVERY_RETRY_MS` from exported `ERROR_RETRY_DELAYS_MS`. `scripts/provision-claude-bot.test.ts` -- `botEnv(url, overrides)`; keep the missing-key cases inline.
- services: `accountDataApis` `anniversaryInput(o)`; `coupleSettingsService` `settingsRow(o)` (keep expected upsert payloads inline); `customMessageService.ownership` `BUNDLED_ID_FLOOR` (366, messagesSlice `minNewCustomId`) and a named `1000`; `dbSchema` `legacyMessage`, `legacyMood`, `swAuthRow`; `eventsService` `PAGE_SIZE`, `permissionDenied(message?)`, `eventInput(o)`; `imageCache` `LEGACY_QUOTA_EXCEEDED_ERR = 22`; `photoService.idempotency` `STORAGE_QUOTA_BYTES`, `CHECK_VIOLATION`, `NOT_NULL_VIOLATION`; `storageSchema` `message(o)` with a fixed `CREATED_AT`.
- stores: `accountDataSlices` `anniversary(...)`/hoisted server `row`, `VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH + 1`, `exportFile(texts, extra)`; `coupleSettings` `linked(start, wedding?)` + `LINKED_LOOKUP` (leave the malformed ~187 inline); `interactionsSlice.localCopy` `record()` wraps `createInteractionRecord` keeping PARTNER→USER_A and `2026-09-21T08:00:00.000Z`; `loaderIdentityGuards` `quota(percent, warning)` (do not derive `warning`) and `coupleEvent(o)`; `moodSlice` `syncResult(o)` and `toHaveLength(MOOD_HISTORY_PAGE_SIZE + 1)` (exact, 501 distinct local dates); `notesSlice.localCopy` `pendingNote(tempId, o)`; `notesSlice.offlineQueue` `queued(id, content, o)`, `serverRow`, `SAVED_COPY_ROW`, `INSUFFICIENT_PRIVILEGE = '42501'`; `partnerSlice.localCopy` `linked(partner)`; `settingsSlice.initializeApp` `message(id, text, o)`; `signOutClearsAccountState` `accountNote(o)`, `sharedDaily()`, `ownCustom()` (fresh objects: `currentMessage` must not alias); `persisted{Anniversaries,BlobContract,Events,Moods,SettingsThemeKeys}.test.ts` -- the new unit helper; keep the deliberate invalid blobs inline.

## Tasks & Acceptance

**Execution:**
- `tests/support/factories/*.ts`, `tests/unit/helpers/persistedBlob.ts` -- the shared support changes above -- factories every group below needs.
- `tests/api/**` -- M2 rows, then L6 -- commit `test(api): …` per rule.
- `supabase/functions/upload-love-note-image/handler.ts` and `handler.test.ts` -- derive Retry-After -- own commit.
- `tests/e2e/**` -- M2, then L6 -- one commit per rule.
- `src/**/__tests__/**` -- M2, then L6 -- one commit per rule.
- `tests/unit/**` -- M2, then L6 -- one commit per rule.

**Acceptance Criteria:**
- Given the catalogs, when each M2/L6 row's file is re-read, then no payload shape from the row is built inline three or more times, no row bypasses a factory that fits, and every flagged literal is named or commented.
- Given the changed tests, when their suites run, then every test that passed before passes, with the same assertions on the same values.
- Given the repo, when lint and typecheck run, then both are clean.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- verdicts: 29 findings — high 0, medium 0, low 20, false 8, maybe-false 1
- findings:
  - `[low]` `[patch]` usePhotoImage `PAST_EVERY_RETRY_MS` (420 s) is shorter than the old 600 s no-retry window — Patched: it is now 20 × sum(`ERROR_RETRY_DELAYS_MS`), which is 840 s, still derived from the schedule (ef74eb37).
  - `[low]` `[patch]` The Retry-After test repeats the handler's own expression, and a non-integer window would give a decimal header — A decimal cannot happen with today's 60 000 ms, but the test had no independent check. Patched: added `assertMatch(…, /^\d+$/)`; handler.ts is unchanged (3f652ef5).
  - `[low]` `[reject]` The 429 message "Please wait a minute" is hard-coded next to the derived header — This predates the story and matches the fixed 60 s window. Deriving the wording would change app code beyond the corrections mandate.
  - `[low]` `[patch]` Literals left next to newly named constants: moodSlice 500s, EventCountdown `toHaveLength(3)`, and the pagination spec's `6`/`slice(0, 6)` — Patched: `MOOD_HISTORY_PAGE_SIZE`, `MAX_CARDS`, and a named `HOME_MAX_EVENT_CARDS` mirror (62b76c4e, 322f6739, ef74eb37).
  - `[low]` `[patch]` `ROW_PREFIX` is used once while 14 locators hard-code `event-row-` — Patched: `ALL_ROWS` and `rowTestId()` are built from `ROW_PREFIX` (62b76c4e).
  - `[low]` `[patch]` The `mappedInteraction` comment says `viewed` passes through, but the service maps `?? false` (interactionService.ts:403) — Patched: the helper mirrors `?? false` and its comment is corrected; the explicit override at the null site stays (62b76c4e).
  - `[low]` `[patch]` SQLSTATE codes have duplicate local names; `CHECK_VIOLATION_CODE` is already exported — Patched: photoService.idempotency imports `CHECK_VIOLATION_CODE`. The other `42501` names are left as they are: they are fixed Postgres codes that never drift (ef74eb37).
  - `[low]` `[reject]` Builders and mirrors copied across files (writeFailure in two EventsSettings suites; `PAGE_SIZE`/`RETRY_CONFIG` mirrors) — Each mirror fails loudly when production drifts. A shared module is new structure, more than a direct correction.
  - `[low]` `[reject]` Four near-identical message-row builders in different suites — They build different shapes (legacy IndexedDB rows vs `Message`). Merging them is a cross-suite refactor. The live `new Date()` in settingsSlice.initializeApp predates this story, and nothing asserts it.
  - `[false]` `[reject]` The mood `PAST_EVERY_BACKOFF_MS` equals the cap, so "past" is wrong — `fireReopen` advances the delay plus `socket.windowMs + 20`, so the wait does go past every backoff. The name is the catalog row's own suggestion.
  - `[low]` `[patch]` `eventBody`'s doc says each case overrides only its own column, but the icon probe must also override the label — Patched: the doc now states that the defaults are the label-check case's body (ac0bcf4b).
  - `[low]` `[patch]` The `as PhotoInsert` cast lets mistyped override keys compile — Patched: the overrides object uses `satisfies Partial<PhotoInsert>` (ac0bcf4b).
  - `[low]` `[patch]` authServices sessions lost their original emails and gained a 'Bootstrap User' display name — Patched: each passes its original email and `displayName: null` (322f6739).
  - `[low]` `[patch]` `tests/unit/helpers/persistedBlob.ts` re-exports an unused `PERSIST_VERSION` — Patched: removed; Knip is clean (ef74eb37).
  - `[low]` `[reject]` `PRE_COUPLE_SETTINGS` now carries `SEEDED_SETTINGS` values ('09:00'/true) rather than '21:30'/false — Those keys are stripped and asserted only by their absence. The M2 row asked the file to reuse `SEEDED_SETTINGS`.
  - `[low]` `[patch]` (edge) Retry-After could be a decimal, and the test is circular — Grouped with the Retry-After entry above; the same whole-seconds assertion was added.
  - `[low]` `[reject]` (edge) photoDialogsA11y tag letters run past 'z' if `MAX_PHOTO_TAGS` ≥ 26 — Unreachable: the local mirror is 10, matching PhotoUpload.tsx.
  - `[false]` `[reject]` (edge) Pagination microseconds overflow if `PAGE_SIZE` ≥ 998 — `PAGE_SIZE` mirrors the service's 50, so the case cannot arise and nothing overflows.
  - `[false]` `[reject]` (edge) `mappedInteraction` on a null-viewed record without an override expects null — No call site does this; the only null-viewed site passes `{ viewed: false }`. The helper now mirrors `?? false` anyway.
  - `[low]` `[patch]` (edge) The moodSlice fixture length and call expectations still use literal 500 — Grouped with the literals entry; replaced with `MOOD_HISTORY_PAGE_SIZE` (ef74eb37).
  - `[false]` `[reject]` (edge) moodSlice's assertion changed from `> 400` to an exact length — The L6 row's own fix asks for the exact count. It is stricter: 501 distinct local dates.
  - `[low]` `[patch]` (verification-gap) Retry-After regression gap — Grouped with the Retry-After entry; the `/^\d+$/` assertion was added.
  - `[low]` `[patch]` (verification-gap) usePhotoImage window weakened — Grouped with the first entry; now 840 s.
  - `[low]` `[reject]` (verification-gap, other) The 429 message and the header can disagree — Same as the message entry above: predates the story, and the window is a fixed 60 s.
  - `[maybe-false]` `[defer]` (intent) M2/L6 instances that no catalog row names were not swept, so a re-review may still flag some — To settle, run the four per-folder test reviews. Recorded in `deferred` as medium (unverified).
  - `[false]` `[reject]` (intent) Some assertions changed (moodSlice exact count; `seedError` checks removed) — The count is stricter. `seedEvents` throws on an insert error or a row-count mismatch (factories/events.ts), so the removed checks still run.
  - `[false]` `[reject]` (intent) Expected values now come from the same builders as the inputs — `mappedInteraction` and the other builders spell out the expected shape independently of production code, so a mapping regression still fails. The fixed values are unchanged.
  - `[false]` `[reject]` (intent) Shared factory changes have no tests of their own — The defaults are unchanged. The new options only pass through the value given, and every consuming suite passes.
  - `[false]` `[reject]` (intent) The story spec file is untracked — It is committed during finalization.

## Design Notes

A factory that fits "almost" is adopted through overrides or a thin local wrapper, never by changing what is asserted. Example (interactionsSlice.localCopy): `const record = (id, o = {}) => createInteractionRecord({ id, from_user_id: PARTNER, to_user_id: USER_A, created_at: INCOMING_AT, ...o })`. When a production constant is module-private, the test names a local mirror with its source: `const BROADCAST_TIMEOUT_MS = 15_000; // src/api/ephemeralBroadcast.ts BROADCAST_TIMEOUT_MS (module-private)`. If the production value changes, the test fails and points at the source.

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errors.
- `npm run typecheck` -- expected: clean, apart from the documented worktree-only TS2883 baseline, if present.
- `npx vitest run <changed unit and src test files>` -- expected: all pass.
- `deno test --no-lock supabase/functions/upload-love-note-image/` -- expected: pass.
- `npx playwright test <changed e2e and api specs>` with `supabase start` running -- expected: pass. If the local stack cannot run, record that.

## Auto Run Result

Status: done

**Summary:** Every M2 and L6 row in the five `findings-*.md` catalogs is fixed. Repeated payloads now go through the existing factories in `tests/support/factories/` or through one named builder per file. Flagged literals now have names: an exported production constant where one exists, otherwise a local mirror with a comment naming its source. Two rows were already fixed by earlier stories and needed no change: `src/utils/__tests__/moodGrouping.test.ts` (M2/L6) and `dateUtils.test.ts` (L6). The only app-code change is the one `corrections.md` requires: `handler.ts` Retry-After is now derived from `CONFIG.RATE_LIMIT_WINDOW_MS`.

**Files changed (75, plus this spec):**
- `tests/support/factories/auth-bootstrap-notification-order.ts`: optional `refreshToken`/`expiresAt` on the session factory and `id`/`date` on the event factory; defaults unchanged.
- `tests/support/factories/interaction-record-ownership.ts`: new `createInteractionInsert` (the record without `created_at`, which the authenticated role's column grant omits).
- `tests/unit/helpers/persistedBlob.ts` (new): unit builders on top of `makePersistedBlob`, with blobs that have nothing to strip, plus deterministic event and mood fixtures.
- `supabase/functions/upload-love-note-image/handler.ts` and `handler.test.ts`: Retry-After derived from the window; the test also asserts it is whole seconds.
- `tests/api/*` (6 specs): `createCheckWritePayload`, `seedEvents`, `createInteractionInsert`, `notePayload`, `eventBody`, and `PNG_MAGIC` passed into `page.evaluate`.
- `tests/e2e/*` (9 specs): `createDatabaseErrorEnvelope`, `createInteractionInsert`, `mappedInteraction`, `seedA11yEvent`, kit type-scale constants, and page-size-derived pagination counts with `ROW_PREFIX` locators.
- `src/**/__tests__/*` (19 files): local builders (`writeFailure`, `withImage`, `jpegFile`, `edgeError`, `moodRecord`, `syncCompleted`, `LINKED`/`SAM`/`NO_PROFILE`, `TWO_PHOTOS`, `PHOTO_REFS`, `unsent`, `slot`) and named limits.
- `tests/unit/**` (35 files): the shared factories plus local builders, with named timeouts, backoffs, page sizes, run ids and SQLSTATEs.

**Commits:** a61000ab (support), then M2 as 83a1f9f6 (api), 214163ca (e2e), addfe022 (src) and 863f6b3c + 93a1d696 (unit). The Retry-After change is 5e2eaaec. L6 is a52d365c (api), 388e8498 (e2e), 4908fb1a (src) and 11997681 (unit). The review patches are 3f652ef5, ac0bcf4b, 62b76c4e, 322f6739 and ef74eb37.

**Review findings:** 29 in total. 15 low findings, in 11 entries, were patched. The deferred item and every rejection, with its reason, are listed in the Review Triage Log above.
- **Patched:** the usePhotoImage wait window; the Retry-After whole-seconds assertion; literals left next to named constants; `ROW_PREFIX` locators; the `mappedInteraction` `?? false` mapping; `CHECK_VIOLATION_CODE` reuse; `eventBody` doc; the typed photo overrides; the original session emails; the unused re-export; the offline-queue failed-note builder (found in step-03 verification).
- **Deferred (1):** M2/L6 instances that no catalog row names were not swept. Severity medium (unverified).
- **Rejected (5 low + 8 false):**
  - Low: the 429 message wording, builders copied across files, the four message builders, the `PRE_COUPLE_SETTINGS` value change, and the tag-letter overflow above 26.
  - False: the mood `PAST_EVERY_BACKOFF_MS` naming, the microsecond overflow, the null-viewed call site, the moodSlice exact count, the changed assertions, builder-derived expectations, the untested factory options, and the untracked spec.

**Follow-up review recommended:** false. The pass patched 11 entries, all low, with no high or medium among them.

**Verification (after the review patches):**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npx vitest run`: 156 files, 2802 tests passed.
- `deno test --no-lock supabase/functions/upload-love-note-image/`: 33 passed, no `deno.lock` written.
- `npx knip`: exit 0, no findings.
- Playwright `api` (5 changed specs): 26 passed.
- Playwright `chromium` (9 changed e2e specs): 48 passed.
- Playwright `api` `upload-love-note-image-limits.spec.ts`: 6 passed before the review patches, with `supabase functions serve` started for the run and stopped afterwards. The review patches did not touch that spec.

**Residual risks:**
- A fresh re-review may still flag M2/L6 repeats that no row named (see `deferred`).
- Mirrors of module-private production constants fail loudly when production changes, but must be updated by hand.
