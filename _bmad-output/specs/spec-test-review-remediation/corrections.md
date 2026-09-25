# Corrections to the TEA findings

Results of a code audit of the five reports on 2026-09-25 (192 findings checked: 134 real, 54 overstated, 4 false positive). This file overrides the finding catalogs where they disagree. An "overstated" verdict does not exempt a finding: fix it.

## False positives

The code is already correct. Make a harmless change so the rule stops firing; never weaken the test.

- `tests/unit/stores/notesSlice.offlineQueue.test.ts:312`, M3: asserts one invariant; M3 needs unrelated subjects.
- `tests/unit/services/coupleSettingsService.test.ts:157`, L7: L7 needs an `assertionStyle` baseline, and the report records none.
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx:183`, L5: the name already states behaviour.
- `src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx:68`, L3: `getByText` on note text is the right query.

## Suggested fixes that are wrong

- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx:676-681` (C3): the suggested `querySelector('p.text-base')` is dead too. The component no longer has `text-base`; it uses `text-[15px]` (`LoveNoteMessage.tsx:411`). Assert on a test id on the text bubble.
- `tests/unit/api/offlineMessageHonesty.test.ts:131` (CRITICAL): do not delete it. It is the only guard against `it.each([])`, which registers zero tests and passes silently. Keep the guard, and satisfy the rule another way, e.g. assert the list against an explicit expected count.
- `src/utils/__tests__/backgroundSync.test.ts:351` (M6): adding `await` hangs the test forever, because `ready` never resolves. Restructure so the promise settles. `:354` (H1) cannot fail either way; fix it in the same change.
- `supabase/functions/upload-love-note-image/handler.test.ts:649` (L6): the suggested `CONFIG.RATE_LIMIT_WINDOW_SECONDS` does not exist; the constant is `RATE_LIMIT_WINDOW_MS`. `handler.ts:381` hard-codes `'60'` too; derive both from the constant.
- API M9 binary bodies (`upload-love-note-image-limits.spec.ts:81`): settled, not UNVERIFIED. `apiRequest` passes `body` through as Playwright's `data` (`playwright-utils` `api-request.js:115`), so a Buffer works.

## Convention baselines

Re-derived with TEA's upstream `convention-baseline.js` against main at 92f1c517.
- **e2e, src and api baselines:** match the rules. One small discrepancy: the api sample took ranks 19 and 24 where the stride gives 20 and 25, but every count is the same.
- **unit baseline:** dropped `tests/e2e-archive/` from the corpus, which the rules don't allow. It makes no difference to deductions.
- **Why the baselines look odd:** the rules sample only files outside the review set (`step-02-discover-tests.md:118`). A whole-folder review therefore takes its house style from a different test layer: Playwright style applied to Vitest, and UI style applied to the api folder.
- **Effect of measuring each folder against its own style:**
  - No row disappears.
  - e2e M9 would be LOW rather than MEDIUM (46 rows).
  - api M9 would be MEDIUM rather than LOW (4 rows).
  - Every row is fixed regardless of severity, so none of this changes the work.
- **L2 has no owner:** no `step-03` worker handles L2, so it only fires when the orchestrator assigns it (e2e: 28 rows). Unit and src markers are a non-goal (see `SPEC.md`).

## Report statements that are wrong

Do not rely on these.

- The src report's H3 code sample (report lines 285-289, `STALE_COPY`/`NOT_FOUND_COPY`) does not exist. The real code is at `src/components/Settings/__tests__/EventsSettings.test.tsx:1039`.
- Unit report line 296: of the `offlineErrorHandler` tests, only `:112` and `:177` can pass with zero assertions. `:152`, `:157` and `:165` assert unconditionally.
- Unit report: `formatDateISO` is tested in `tests/unit/utils/messageRotation.test.ts:30-40`, not `dateUtils.test.ts`.
- API advisory citing `check-error-write-boundaries.spec.ts:128`: the literal `400` is at `:66`.
- API report "340 expect call sites": `grep` finds 334.
- E2E baseline "testIds 1 of 8 sampled": 58 of 59 e2e files use `getByTestId`.
- E2E report line 369 (leftover notes break `needs-a-connection`): unsupported. Lines 26-27 there are a coverage exclusion.
- E2E "~12 specs" copy the IndexedDB reader: it is 13.
- Suite report: `home/error-boundary.spec.ts` is not byte-identical to `home/routing.spec.ts` (header comments differ), but the test bodies are identical.

## Real defects no scored row captures

Fix these too.

**tests/api**
- `couple-broadcast-authorization.spec.ts:425`, `:448`: the anon websocket result and REST status are only logged, never asserted, although the file's own comment (`:427-429`) says a 500 "would make this prove nothing". The header claim (`:27-29`) that the `send()` difference "is asserted below" is untrue, because `:300` only logs.
- Cleanup is skipped or masked on failure:
  - Throwaway accounts are created before the `try` (`interaction-authorization.spec.ts:50-53, 142-145`; `profile-name-email-ownership.spec.ts:47-61, 146-149`).
  - `upload-love-note-image-limits.spec.ts:281-284` registers cleanup after its assertions.
  - An `expect` in `finally` masks the original error (`check-error-write-boundaries.spec.ts:89, 129`).
- Premise checks that pass vacuously:
  - `profile-name-email-ownership.spec.ts:61` compares undefined with undefined when the read fails.
  - `pkce-code-exchange.spec.ts:180, 198` assert only that `error` is non-null.

**tests/e2e**
- `home/error-boundary.spec.ts` never triggers a render error, so it provides false coverage.
- Readiness gates that accept a screen that isn't ready:
  - `navigation/theme-sweep.spec.ts:70-75` accepts the error state.
  - The `openSettings` `aria-busy='false'` check (`tests/e2e/settings/events-history-pagination.spec.ts:15`) can pass before loading starts.
  - The `tests/e2e/photos/photo-upload.spec.ts:14` gate passes on the loading skeleton (`PhotoGallery.tsx:191-194`).
- `auth/token-persistence-overlap.spec.ts:69`: the `action-started` loop has no count check.
- Love-note rows are never deleted: `tests/e2e/notes/love-notes.spec.ts:51-77`, `tests/e2e/notes/notes-kit.spec.ts:130-161`, `auth/display-name-setup.spec.ts:341-360`.
- `auth/login.spec.ts:143` is named "persist session" but never creates a session.
- `tests/e2e/settings/events-persistence.spec.ts:102-104` is a stale deviation comment; the real `waitForResponse` calls are at 135/177/208/338.

**tests/unit**
- `tests/unit/services/swMoodSync.test.ts:90-104`: `fireBackgroundSync` swallows errors by default, so tests like "never reads the moods store" (`:238-258`) pass even if the worker crashes. Make swallowing opt-in.
- `tests/unit/api/partnerService.check.test.tsx:163`: `requests.length > 0` is always met, because the mock records `getUser` (`:10`).
- `tests/unit/stores/signOutClearsAccountState.test.ts:832`: a 50 ms sleep before a "nothing deleted" check.
- `tests/unit/a11y/whiteOnColorContrast.test.ts:643`: runs zero assertions while both allowlists (`:72`, `:351`) are empty.
- `tests/unit/stores/updateCurrentMessageStaleCache.test.ts:46`: computes "today" once, when the module loads.
- `tests/unit/utils/dateFormat.test.ts` and `moodGrouping.test.ts` are `expect(true).toBe(true)` placeholders (lines 15, 22 in each). Replace each body with real assertions against the function its name claims. The real `groupMoodsByDate` suite is `src/utils/__tests__/moodGrouping.test.ts`.

**src**
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx:749-755`, `806-812`, `845-851`: the React 19 "update on unmounted component" checks cannot fail.
- `src/components/love-notes/__tests__/MessageInput.test.tsx:486-493`: named "Shift+Enter", but only calls `fireEvent.change`, so no key is ever pressed.
- `src/hooks/__tests__/useNetworkStatus.test.ts:321-341`: no assertion on what the test name claims.
- `useRealtimeMessages.test.ts`:
  - `:416-443` uses real sleeps against 10 ms polling and does not restore `userId`.
  - `:162` replaces a factory default that `clearAllMocks` keeps, so results depend on test order.
- `src/components/Settings/__tests__/EventsSettings.test.tsx:1493`: the add row asserts nothing at that step. `src/components/Settings/__tests__/EventsSettings.focus.test.tsx:363` also skips a check.
- `src/utils/__tests__/moodGrouping.test.ts:8`: "yesterday" as `Date.now() - 86400000` is the wrong day around DST under the pinned America/New_York zone.
