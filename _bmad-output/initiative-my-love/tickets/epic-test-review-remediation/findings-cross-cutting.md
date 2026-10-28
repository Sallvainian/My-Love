# Findings: cross-cutting and outside the four folders

Verbatim copy of the 2026-09-25 TEA test-review findings for the whole suite. Rule ids (C#, H#, M#, L#) are defined in the adopted registry companion. Every row is in scope, including advisories and rows the suite run removed by normalization. The folder run and the suite run overlap: the same defect can appear in both tables at nearby lines, so fix it once. `corrections.md` overrides any row or suggested fix it names.

## Suite run: advisory observations

ℹ️ The three "Memory Leak Prevention" tests in `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` (assertions at 755, 812, 851) filter `console.error` for "Can't perform a React state update". React 18 removed that warning and the project runs React 19, so these assertions cannot fail. No registry row covers it, so it is unscored, but it is the same defect class as the critical findings.
ℹ️ `tests/e2e/auth/login.spec.ts:143`: the test named "should persist session across page reloads" never creates a session. It checks that an unauthenticated reload still shows the login screen.
ℹ️ `tests/e2e/home/error-boundary.spec.ts` is byte-identical to `tests/e2e/home/routing.spec.ts` and never triggers a render error.
ℹ️ `tests/unit/utils/offlineErrorHandler.test.ts:56`: the `afterEach` restore of `navigator.onLine` never runs. happy-dom defines `onLine` on the prototype, so `getOwnPropertyDescriptor(navigator, 'onLine')` is `undefined`.
ℹ️ Cross-file harness duplication has no registry row: the EventsSettings store double is copied into 5 files, the App `vi.mock` harness (~100 lines) into 3, `goOffline()` into 10 E2E specs, and hand-rolled `indexedDB.open('my-love-db')` readers into 13.
ℹ️ Live-clock "today" fixtures (moodGrouping, MoodHistoryTimeline, moodService, the birthdays-wedding specs and others) can flip if a run crosses local midnight. They were excluded from H2 (see Normalization), but `vi.useFakeTimers({ toFake: ['Date'] })`, as `MoodTracker.todayLabel.test.tsx:104` does, would remove the risk.
ℹ️ `tests/api/upload-love-note-image-limits.spec.ts:81` uses raw `request.post` with no `// playwright-utils deviation:` comment. M9 could not score it because the convention baseline is unavailable (see below).
ℹ️ Run-level line for the mandate-backed convention: playwright-utils is installed and `tea_use_playwright_utils` is true. The corpus outside the review set was too small to measure adoption, so M9 and L9 passed as n/a without being measured.

## Suite run: scored findings outside tests/ and src/ (3 rows)

| File | Line | Severity | Criterion | Issue | Fix |
| ---- | ---- | -------- | --------- | ----- | --- |
| `supabase/functions/upload-love-note-image/handler.test.ts` | 196 | P2 | M4 Ungrouped suite | The file registers 26 `Deno.test` calls at top level (33 cases once the 8-case loop at line 290 is expanded) with no describe/grouping construct. The section s… | Group the cases by section with `describe`/`it` from `jsr:@std/testing/bdd`, or with `Deno.test` plus `t.step… |
| `supabase/functions/upload-love-note-image/handler.test.ts` | 554 | P2 | M3 Multi-concern test | One success test asserts the storage path, size, rate-limit body field and header, the CORS header and the stored content type — rate limiting and CORS are sep… | Move rate-limit and CORS header assertions into their own tests. |
| `supabase/functions/upload-love-note-image/handler.test.ts` | 649 | P3 | L6 Magic value | '60' is the Retry-After window in seconds; unlike RATE_LIMIT_MAX_UPLOADS it is not read from CONFIG or named. | Assert against the CONFIG window value (e.g. String(CONFIG.RATE_LIMIT_WINDOW_SECONDS)) or a named constant. |
