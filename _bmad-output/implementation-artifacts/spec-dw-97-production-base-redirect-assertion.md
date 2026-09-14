---
title: 'DW-97: pin the authorize redirect_to against the production base path'
type: 'chore'
created: '2026-09-14'
status: 'done'
baseline_revision: '456ed858c5a65902d741f30ee8b9e1674fcd03b0'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      `resetPasswordForEmail` composes the same `origin + BASE_URL` prefix as the
      Google flow, but its composed link is asserted at no base, production or dev.
    evidence: |-
      `src/api/auth/actionService.ts:97` is
      ``redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password` ``,
      and the path join is correct only because `BASE_URL` ends in `/`.
      Measured: `grep -rn "reset-password" tests/ src/` (excluding `tests/e2e-archive/`)
      returns that one source line and nothing under `tests/`; the only other
      reference, `src/api/auth/__tests__/authServices.test.ts:41`, registers
      `resetPasswordForEmail` as a mock and never inspects its options.
      Pre-existing: the DW-97 intent names only the authorize URL's `redirect_to`,
      so this change neither caused nor exposed it. Settle by adding a sibling case
      that stubs `BASE_URL` to the production base and asserts the reset link is
      `http://localhost:3000/My-Love/reset-password`.
    location: >-
      src/api/auth/actionService.ts:97
    severity: low
  - summary: >-
      `navigationSlice.setView`'s production branch and `App.getRoutePath`'s
      base-stripping branch read the same `import.meta.env.BASE_URL` this story
      pinned for the authorize URL, and neither branch is asserted at the
      deployed base.
    evidence: |-
      `src/stores/slices/navigationSlice.ts:63` is
      `const fullPath = base === '/' ? basePath : base.slice(0, -1) + basePath;`
      and `src/App.tsx:179-180` is
      `if (base !== '/' && pathname.startsWith(base)) { return pathname.slice(base.length - 1); }`.
      Both are production-only branches: every test runs at `BASE_URL === '/'`,
      which takes the other arm each time. Demonstrated by the review's
      verification-gap layer -- rewriting `navigationSlice.ts:63` to
      `base + basePath` and `App.tsx:180` to `return pathname;` left
      `npx vitest run` at 91 files / 1705 passed, both mutants green. On the
      deployed site those two edits emit `/My-Love//photos` and then fail
      base-stripping on reload, so no `currentView` arm matches and the app
      resets to home. E2E cannot reach it either: `playwright.config.ts:178` is
      `command: 'npx vite --mode test'` and `vite.config.ts:11` serves `/` off
      production. Pre-existing: this story's intent names only the authorize
      URL's `redirect_to` and its Never forbids touching `src/`, so the change
      neither caused nor exposed these. Settle with a `tests/unit/stores/` case
      that stubs `BASE_URL` to the config's production base, calls
      `setView('photos')`, and asserts `window.location.pathname` is
      `/My-Love/photos`, plus a sibling asserting `getRoutePath('/My-Love/photos')`
      resolves to `/photos`.
    location: >-
      src/stores/slices/navigationSlice.ts:63, src/App.tsx:179-180
    severity: medium
  - summary: >-
      DW-97's ledger entry names two files and is closed whole, but only the
      unit half was addressed and the resolution line records neither the
      carve-out nor the substituted settle mechanism.
    evidence: |-
      DW-97's `location:` is
      `tests/unit/api/supabaseClientAuthFlow.test.ts / tests/e2e/auth/google-oauth.spec.ts`
      and its reason covers `both new assertions`. Verified:
      `tests/e2e/auth/google-oauth.spec.ts:68` still reads
      `expect(authorizeParams.get('redirect_to')).toBe(appBaseUrl + '/');` and
      this story's Never excludes it deliberately (`the deployed-origin
      round-trip stays operator work under DW-93`). Separately, DW-97's reason
      ends `Settle by asserting the authorize URL's redirect_to once against a
      production-mode build, or by reading it during the outstanding
      deployed-site sign-in.` -- what shipped is a stubbed `BASE_URL` under
      happy-dom bound to `vite.config.ts` via `loadConfigFromFile`, which is
      neither. The rationale for accepting that substitution lives only in this
      spec's triage log, not in the ledger a later sweep reads. Not fixable from
      this session: the orchestrator owns ledger entry status and resolution
      text, and this story's Never forbids editing the ledger. Settle by
      extending DW-97's `resolution:` to name the E2E half as carried by DW-93
      and to state that the production base was pinned by config-bound stub
      rather than by a production-mode build.
    location: >-
      _bmad-output/implementation-artifacts/deferred-work.md (DW-97)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Every `redirect_to` assertion runs where `import.meta.env.BASE_URL` is `/`, so the deployed base is pinned nowhere — `grep -rn "My-Love/" tests/ | wc -l` returns `0`. `vite.config.ts:11` is `base: mode === 'production' ? '/My-Love/' : '/',` and `playwright.config.ts:178` is `command: 'npx vite --mode test',`, so `tests/unit/api/supabaseClientAuthFlow.test.ts:176-178` and `tests/e2e/auth/google-oauth.spec.ts:68` can only observe the dev base.

**Approach:** Add one unit case to the existing CAP-13 suite that stubs `BASE_URL` to the production value, drives the real `signInWithGoogle` through the real SDK, and asserts the built authorize URL's `redirect_to` against a literal.

## Boundaries & Constraints

**Always:** Assert on a real authorize URL built by the installed SDK, not a mocked `signInWithOAuth`, and reach it through `src/api/auth/actionService.ts:119` rather than restating the template in the test. Restore the stub and any spy in `afterEach`.

**Never:** Do not touch `vite.config.ts`, `playwright.config.ts`, `tsconfig.*.json`, `vitest.config.ts` or `src/`. Do not import `vite.config.ts` from a test — measured: `npx tsc -b --force` raises `TS6307`, because that file belongs to `tsconfig.node.json` while tests build under `tsconfig.test.json`. Do not add or change an E2E assertion — Playwright's dev server serves base `/`, and the deployed-origin round-trip stays operator work under DW-93. Do not edit the deferred-work ledger.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Production base | `BASE_URL` stubbed to `/My-Love/`, page at `http://localhost:3000/My-Love/` | `signInWithGoogle()` returns `null`; exactly one URL reaches `window.location.assign`, and its `redirect_to` is `http://localhost:3000/My-Love/` | No error expected |
| Base dropped | Same, but `actionService.ts:119` drops `BASE_URL` | `redirect_to` is `http://localhost:3000/`, so the case fails | Assertion failure |

</intent-contract>

## Code Map

- `tests/unit/api/supabaseClientAuthFlow.test.ts` (286 lines) -- the only file to edit. Drives the REAL installed SDK against the real `src/api/supabaseClient.ts` (header, lines 1-17). Reuse: `APP_ORIGIN = 'http://localhost:3000'` (24), `setUrl()` (40-42, wraps `window.happyDOM.setURL`), `importAppClient()` (67-69), the `clients` array + `stopAutoRefresh` teardown (80, 94-102), and the `fetchSpy` that rejects every request (89-91). The `/`-base sibling case is 155-189, its `redirect_to` assertion 176-178.
- `src/api/auth/actionService.ts:114-139` -- `signInWithGoogle`. Line 119 is ``redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,``; it passes no `skipBrowserRedirect`.
- `vite.config.ts:11` -- source of the `/My-Love/` literal. Read-only, and not importable from a test (see Never).
- `vitest.config.ts:12-17` -- `define` covers only `VITE_SUPABASE_URL` and the publishable key, so `BASE_URL` stays a runtime property. Measured: it defaults to `"/"` and `vi.stubEnv` overrides it.
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:4067-4068` -- `_handleProviderSignIn` calls `window.location.assign(url)` unless `skipBrowserRedirect`. Measured: under happy-dom that is a writable, configurable prototype method, so `vi.spyOn` captures the URL and suppresses navigation.
- `tests/e2e/auth/google-oauth.spec.ts:68` -- `expect(authorizeParams.get('redirect_to')).toBe(appBaseUrl + '/');`. Context only; do not edit.

## Tasks & Acceptance

**Execution:**
- `tests/unit/api/supabaseClientAuthFlow.test.ts` -- add a production-base constant; extend the existing `afterEach` to unstub envs and restore a `window.location.assign` spy; append one `it(...)` after the line-155 sibling that stubs `BASE_URL`, spies on `window.location.assign`, imports the app client and then `signInWithGoogle`, and asserts the captured URL. One file: this suite is the only place the real SDK builds an authorize URL.

**Acceptance Criteria:**
- Given `BASE_URL` is stubbed to `/My-Love/`, when `signInWithGoogle()` runs, then `window.location.assign` is called exactly once and the URL's `redirect_to` is the literal `http://localhost:3000/My-Love/`.
- Given `src/api/auth/actionService.ts:119` is temporarily edited to drop `${import.meta.env.BASE_URL}`, when the suite runs, then the new case fails — and passes again once reverted.
- Given the new case has run, when the file's other cases run, then none sees a stubbed `BASE_URL` or a spied `window.location.assign`.

## Spec Change Log

## Review Triage Log

### 2026-09-14 — Review pass
- verdicts: 14 findings — high 0, medium 5, low 6, false 3, maybe-false 0
- findings:
  - `[medium]` `[patch]` blind-hunter: the new case stubs and asserts the same `PRODUCTION_BASE`, so it is invariant to that constant's value — reproduced: setting it to `'/Totally-Wrong-Repo/'` left the suite at 8 passed (8). Fixed by binding the constant to the config (see the group fix below).
  - `[medium]` `[patch]` blind-hunter: nothing tied the `/My-Love/` literal back to `vite.config.ts:11`, and a non-import mechanism was available — confirmed: `loadConfigFromFile({ command: 'build', mode: 'production' }, 'vite.config.ts')` resolves `'/My-Love/'` in 35 ms and raises no TS6307. Fix applied: the case now asserts `viteConfig?.config.base` equals `PRODUCTION_BASE` before stubbing, and the expectation is the hard-coded literal `'http://localhost:3000/My-Love/'`.
  - `[false]` `[reject]` blind-hunter: the DW-97 ledger's "production-mode build or deployed-site sign-in" settle condition is unmet. Refuted by the bundle intent itself, which sanctions the stub — "the cheapest form is a unit case that stubs import.meta.env.BASE_URL to '/My-Love/'" — and assigns the deployed round-trip to DW-93. The residual value-pinning half of the complaint was real and is closed by the two rows above.
  - `[low]` `[reject]` blind-hunter: the Code Map's line anchors cite baseline positions and are stale against the merged file. Rejected because the only fix is to edit this build's spec.
  - `[low]` `[patch]` blind-hunter: the `afterEach` comment credited the `"/"` default to `vitest.config.ts`, which sets no `base` and defines no `BASE_URL` — verified against the file. Fixed: the comment now credits Vite's built-in `base` default.
  - `[low]` `[patch]` blind-hunter: the comment claimed "a literal" while the expectation was the two-constant interpolation `${APP_ORIGIN}${PRODUCTION_BASE}`. Same root cause as row 1; fixed by the hard-coded literal.
  - `[false]` `[reject]` blind-hunter: the new case omits the file's `fetchUrls(fetchSpy)` discriminator. Refuted — `fetchSpy` rejects every call and `signInWithGoogle` converts a throw into a returned `AuthError` (`src/api/auth/actionService.ts:135-138`), so the case's `expect(error).toBeNull()` already fails on any stray request. The docblock's "every case" was also already inaccurate at the baseline: 7 cases, 4 fetch assertions.
  - `[low]` `[defer]` blind-hunter: `resetPasswordForEmail` at `src/api/auth/actionService.ts:97` carries the same production-base exposure and is asserted nowhere. Real but pre-existing and outside the intent's named surface; recorded in frontmatter `deferred`.
  - `[low]` `[reject]` blind-hunter: the spec's **Never … `src/`** contradicts AC 2's temporary mutation, and the frontmatter "pre-declares" the review verdict. First half real, but its only fix edits this build's spec; second half refuted — `review_loop_iteration`, `followup_review_recommended` and the two empty log headings are template defaults this step fills in at the end.
  - `[medium]` `[patch]` edge-case-hunter: a change to `vite.config.ts`'s base would ship green. Same root cause as rows 1-2; closed by the same fix, and confirmed by a fourth mutant — renaming the config's production base to `'/Renamed-Repo/'` now fails the case.
  - `[low]` `[defer]` edge-case-hunter: `resetPasswordForEmail`'s production-base link is untested. Same entry as the row above; recorded once in frontmatter `deferred`.
  - `[false]` `[reject]` edge-case-hunter: a rejection from `stopAutoRefresh` would skip `assignSpy.mockRestore()` and `vi.unstubAllEnvs()` in `afterEach`. Refuted at the source — `stopAutoRefresh` (`GoTrueClient.js:4588-4591`) calls `_removeVisibilityChangedCallback`, whose body is wholly inside a `try/catch` that logs and swallows (`:4442-4449`), then `_stopAutoRefresh`, which only runs `clearInterval`/`clearTimeout` (`:4497-4509`). Neither has a throw path, so the state was never shown reachable.
  - `[medium]` `[patch]` verification-gap: the case pinned a stubbed literal rather than the base the production build uses. Same root cause as rows 1-2; fixed with the layer's own suggested mechanism, `loadConfigFromFile`.
  - `[medium]` `[patch]` verification-gap: the page URL equalled the expected `redirect_to`, so the case could not distinguish `origin + BASE_URL` from `window.location.href` — reproduced: rewriting `src/api/auth/actionService.ts:119` to `` `${window.location.href}` `` left the suite at 8 passed (8). Fixed: the page URL is now `${APP_ORIGIN}${PRODUCTION_BASE}settings`, and that mutant fails.
  - intent-alignment reported no findings — its output is descriptive by design. Its divergence analysis (the literal was hand-copied and unlinked from the config) matched rows 1-2 and 10 and is closed by the same fix.

### 2026-09-14 — Review pass (follow-up)
- verdicts: 17 findings — high 0, medium 2, low 12, false 3, maybe-false 0
- findings:
  - `[false]` `[reject]` blind-hunter: the new case failed once with `expected 'http://localhost:3000/' to be 'http://localhost:3000/My-Love/'` and would not reproduce across 16 later runs, so the `vi.stubEnv` mechanism is not deterministic. Refuted: that was a concurrent reviewer's mutant, not a flake. The verification-gap layer confirmed it held `src/api/auth/actionService.ts:119` at `` `${window.location.origin}/` `` inside the exact window bracketed by its own clean runs, and its run against that mutant printed the byte-identical message and the identical `1 failed | 7 passed (8)`. This session then ran the file five consecutive times with a clean `src/` tree: 8 passed (8) every time.
  - `[low]` `[reject]` blind-hunter: a red `redirect_to` assertion cannot distinguish "the source regressed" from "the stub never applied"; one `expect(import.meta.env.BASE_URL).toBe(PRODUCTION_BASE)` would separate them. Real but rejected: the only instance was the concurrent mutant above, so the confusion is not met in everyday use, and the fix adds an assertion guarding a state never shown reachable.
  - `[medium]` `[patch]` blind-hunter: AC 3 ("none sees a stubbed `BASE_URL` or a spied `window.location.assign`") is asserted nowhere — the sibling cases interpolate `import.meta.env.BASE_URL` on both the input and the expected side, so a leaked stub shifts both together and stays green. Confirmed by mutation: deleting `vi.unstubAllEnvs()` left the file at 8 passed (8) and the whole unit suite at 1169 passed (1169). Fixed: two teardown assertions, `expect(import.meta.env.BASE_URL).toBe('/')` and `expect(vi.isMockFunction(window.location.assign)).toBe(false)`. Both mutants now fail 3 of 8.
  - `[low]` `[patch]` blind-hunter: `loadConfigFromFile` was passed the bare string `'vite.config.ts'`, which resolves against `process.cwd()`. Confirmed at source — `node_modules/vite/dist/node/chunks/node.js:36963` is `if (configFile) resolvedPath = path.resolve(configFile);`, so the `configRoot` parameter is ignored whenever a config file is supplied. Grouped with edge-case-hunter F1; fix recorded there.
  - `[low]` `[reject]` blind-hunter: nothing records that `{ command: 'build', mode: 'production' }` is the pair the deployment actually uses, so a later `--base`/`--mode` in the deploy step would move the shipped base while the case stayed green. The pair was verified correct by two layers (`.github/workflows/deploy.yml:121` runs `npm run build` = `vite build`, no `--mode`), so the defect is a missing comment about a hypothetical future edit — cosmetic, and no present bad outcome.
  - `[low]` `[patch]` blind-hunter: the file docblock's `Every case asserts the number of \`fetch\` calls as well as the session` was made further wrong by the new case. Measured: 8 `it(` blocks, 4 `expect(fetchUrls(fetchSpy)).toEqual([])` assertions (lines 135, 148, 162, 174), all four of them callback cases. Fixed: narrowed to "Every callback case" and added a clause saying the sign-in cases assert the built authorize URL instead.
  - `[low]` `[defer]` blind-hunter: DW-97's ledger entry names both the unit suite and `tests/e2e/auth/google-oauth.spec.ts` and is closed whole, though the E2E half was deliberately left alone and the `resolution:` line carries no carve-out or pointer to DW-93. Verified: `tests/e2e/auth/google-oauth.spec.ts:68` still reads `expect(authorizeParams.get('redirect_to')).toBe(appBaseUrl + '/');`. Grouped with the row below; recorded in frontmatter `deferred`.
  - `[low]` `[defer]` blind-hunter: the settle condition DW-97 records ("against a production-mode build, or ... the outstanding deployed-site sign-in") is not the one that was met, and the ledger does not record the substitution — the rationale lives only in this spec's triage log. Same root cause as the row above: one `resolution:` line that records neither the carve-out nor the mechanism. Recorded once in frontmatter `deferred`.
  - `[low]` `[reject]` blind-hunter: this diff is a second instance of DW-116, which records that the run must not edit the ledger while the same change rewrites entry statuses. The claim holds, but DW-116 is already open against exactly it, and the fix is a ledger edit the invocation reserves to the orchestrator. Rejected as already tracked.
  - `[false]` `[reject]` blind-hunter: the spec frontmatter contradicts the ledger and its own triage log, and `## Spec Change Log` ships empty although the review changed the spec. Refuted: `status: 'in-review'` was this step's own in-flight value captured in the diff, `review_loop_iteration: 0` is the documented reset for a follow-up pass, and `## Spec Change Log` records bad_spec amendments only — no loopback occurred in either pass, so empty is correct.
  - `[low]` `[reject]` blind-hunter: carried — the Code Map's line anchors are stale against the merged file (`wc -l` returns 345, not 286; the sibling case is 177-211, not 155-189). Same claim and location as the previous pass's row; the only fix is to edit this build's spec.
  - `[low]` `[reject]` blind-hunter: DW-124 names neither the cheaper assertion site (`src/api/auth/__tests__/authServices.test.ts` already registers `resetPasswordForEmail` as a mock) nor the root cause (the `origin + BASE_URL` prefix hand-composed twice, at `actionService.ts:97` and `:119`). Wording of an already-materialized ledger entry; the fix edits the ledger, which the invocation reserves to the orchestrator, and the entry's own settle text already names a workable mechanism.
  - `[low]` `[patch]` edge-case-hunter F1: with a working directory other than the repo root the case dies with `UNRESOLVED_ENTRY`, a failure unrelated to `redirect_to`. Reproduced by this session — `cd tests && npx vitest run --root .. unit/api/supabaseClientAuthFlow.test.ts` gave `[UNRESOLVED_ENTRY] Cannot resolve entry module vite.config.ts`, `1 failed | 7 passed (8)`. Grouped with blind-hunter's row above. Fixed with `resolve(dirname(fileURLToPath(import.meta.url)), '../../../vite.config.ts')`; the first attempt, `fileURLToPath(new URL(...))`, threw `TypeError: The URL must be of scheme file` because `vitest.config.ts:20` sets `environment: 'happy-dom'` and the global `URL` is then happy-dom's own class — the shipped form hands `fileURLToPath` the string so Node parses it. Verified green from `tests/` and from `src/`.
  - `[false]` `[reject]` edge-case-hunter F2: the `?.` at `expect(viteConfig?.config.base)` guards a branch that cannot occur, and a config bundling or plugin-construction failure would surface as a `redirect_to` regression. Refuted on both halves: `node_modules/vite/dist/node/index.d.ts:3859-3863` declares the return as `Promise<{ path; config; dependencies } | null>`, so the `?.` is required for `npx tsc -b --force` to pass; and a throw propagates out of the `await` before any `redirect_to` assertion runs, so the reported failure is Vite's own config-load error, which names the config.
  - `[low]` `[reject]` edge-case-hunter F3: the case compares and stubs the raw authored `config.base`, while Vite ships `resolveBaseUrl`'s normalized value (`node.js:36930-36932`, `new URL(base, 'http://vite.dev').pathname`), so a non-canonical base such as `'My-Love/'` would turn the case red though the deployed `redirect_to` is correct. Mechanism verified, but `vite.config.ts:11` is canonical today and Vite warns loudly on a base without a leading slash — a red there would point at a real config smell, not mislead. Unlikely to be met, and the fix adds a normalization step.
  - `[low]` `[reject]` edge-case-hunter F4 (filed as a low-confidence claim): the spec's Execution note calls this suite "the only place the real SDK builds an authorize URL", but `tests/e2e/auth/google-oauth.spec.ts:68` asserts `redirect_to` from the real app in a real browser. The inaccuracy is genuine; the only fix is to edit this build's spec.
  - `[medium]` `[defer]` verification-gap: `navigationSlice.setView`'s production branch (`src/stores/slices/navigationSlice.ts:63`) and `App.getRoutePath`'s base-stripping branch (`src/App.tsx:179-180`) read the same `import.meta.env.BASE_URL` this story pinned, and neither is asserted at the deployed base. Pre-verified by the layer and demonstrated: breaking both branches left `npx vitest run` at 91 files / 1705 passed. Pre-existing — the intent names only the authorize URL and its Never forbids touching `src/`. Recorded in frontmatter `deferred`.
  - intent-alignment reported no prescriptive findings — its output is descriptive by design. Its divergence D5 (the `loadConfigFromFile` call resolves against `process.cwd()`) matched the two rows patched above; D6 (the diff carries ledger edits the Never forbids) matched the DW-116 row; D4 (matrix row 2 predicts `http://localhost:3000/` where the measured value has no trailing slash) restates a residual risk the previous pass already recorded.

## Design Notes

The `/`-base sibling (155-189) restates `${window.location.origin}${import.meta.env.BASE_URL}` on both sides, so it proves only that the SDK does not mutate the value. Do not copy that shape: the expected side is a literal, the actual side comes from the real `signInWithGoogle`. Comment the literal with its source (`vite.config.ts:11`) and why the config is not imported, matching the file's habit of citing line anchors.

Import order matters — `importAppClient()` first, push to `clients`, then `await import('../../../src/api/auth/actionService')`. `vi.resetModules()` in `beforeEach` cleared the registry, so the second import reuses the client the first built and the existing teardown still covers it.

## Verification

**Commands:**
- `npx vitest run tests/unit/api/supabaseClientAuthFlow.test.ts` -- expected: all cases pass, new one included.
- `npx vitest run tests/unit` -- expected: green, confirming the stub and spy do not leak.
- `npx tsc -b --force` -- expected: no output. Baseline at `456ed858c5a65902d741f30ee8b9e1674fcd03b0` in this worktree: zero errors, including zero `TS2883`.
- `npx eslint tests/unit/api/supabaseClientAuthFlow.test.ts` -- expected: no output.

**Manual checks (if no CLI):**
- Mutation proof for AC 2: drop `${import.meta.env.BASE_URL}` from `actionService.ts:119`, re-run, see the new case fail, `git checkout -- src/api/auth/actionService.ts`, see it pass. `git status --porcelain` must then list only the test file and this spec.


## Auto Run Result

Status: done

**Implemented change.** This was a follow-up review pass over the already-merged DW-97 commit `65421955`, not a fresh implementation. The story's deliverable is unchanged: one unit case, `sends the authorize redirect_to to the deployed base path`, that resolves the production `base` from `vite.config.ts`, asserts the suite's `PRODUCTION_BASE` constant equals it, stubs `import.meta.env.BASE_URL` to that value, puts the page deeper than the base, drives the real `signInWithGoogle` through the real Supabase SDK, and asserts the captured authorize URL's `redirect_to` is `http://localhost:3000/My-Love/`. This pass hardened three things around it.

**Files changed.**
- `tests/unit/api/supabaseClientAuthFlow.test.ts` -- the only file changed by this pass. Three patches: (a) the `vite.config.ts` path handed to `loadConfigFromFile` is now absolute, so the case no longer depends on the directory vitest was launched from; (b) two teardown assertions that discharge AC 3 instead of assuming it; (c) the file docblock's `fetch`-count sentence narrowed to the callback cases it actually describes.
- No `src/` file, config or workflow was modified. Four mutants were applied and reverted during verification; `git diff -- src vite.config.ts` is empty.

**Review findings breakdown.** 17 findings from four layers -- high 0, medium 2, low 12, false 3, maybe-false 0.
- *Patched* -- three entries. (a) **medium**: AC 3 was asserted nowhere; deleting either restore in `afterEach` left the whole unit suite green at 1169 passed. Now `expect(import.meta.env.BASE_URL).toBe('/')` and `expect(vi.isMockFunction(window.location.assign)).toBe(false)` run after every case, and each mutant fails 3 of 8. (b) **low**: `loadConfigFromFile` was passed the bare string `'vite.config.ts'`, which Vite resolves against `process.cwd()` while ignoring its `configRoot` parameter (`node.js:36963`); reproduced as `[UNRESOLVED_ENTRY]` from `tests/`, now green from `tests/` and from `src/`. (c) **low**: the docblock's `Every case asserts the number of fetch calls` was made further wrong by the new case (8 cases, 4 fetch-count assertions). Patched counts by verdict: medium 1, low 2.
- *Deferred* -- two entries added to frontmatter `deferred`, joining the `resetPasswordForEmail` item the previous pass recorded. **medium**: `navigationSlice.setView`'s production branch and `App.getRoutePath`'s base-stripping branch read the same `BASE_URL` and are asserted at no deployed base -- breaking both left the full suite at 1705 passed. **low**: DW-97's ledger entry names the E2E spec as well as the unit suite and is closed whole, and its `resolution:` line records neither the E2E carve-out to DW-93 nor the substituted settle mechanism.
- *Rejected* -- twelve findings. Three `[false]`: the reported non-determinism of `vi.stubEnv` (it was a concurrent reviewer's `actionService.ts:119` mutant -- identical message, identical counts, confirmed by that reviewer, and five clean runs here); the "`?.` guards an impossible branch" complaint (the `?.` is required by Vite's declared `| null` return type, `index.d.ts:3859-3863`); and the spec-frontmatter contradiction claim (`status: 'in-review'` was this step's own in-flight value and an empty `## Spec Change Log` is correct with no loopback). Six `[low]` rejected as cosmetic or unreachable: the missing failure-mode discriminator, the undocumented `build`/`production` pair, the raw-versus-normalized `base` comparison, the second DW-116 instance (already open), DW-124's wording, and the stale Code Map anchors (carried from the previous pass). Three more `[low]` were rejected because their only fix edits this build's spec or the orchestrator-owned ledger.

**Follow-up review recommended: false.** This was a follow-up pass and it patched no `high` entry -- one `medium` and two `low`. The work has converged; patch volume is not grounds for another pass. The previous pass's named unverified risk, the `loadConfigFromFile` working-directory dependence, was the concrete defect this pass fixed and verified from two directories.

**Verification performed** (all in this worktree, at the patched tree):
- `npx vitest run tests/unit/api/supabaseClientAuthFlow.test.ts` -- 8 passed (8); run five consecutive times on a clean tree, green every time.
- `npx vitest run tests/unit` -- 54 files, 1169 passed (1169).
- `npx tsc -b --force` -- exit 0, no output.
- `npx eslint tests/unit/api/supabaseClientAuthFlow.test.ts` -- exit 0, no output.
- Working-directory independence: `npx vitest run --root ..` from `tests/` and from `src/` -- 8 passed (8) each, against `1 failed | 7 passed` with `[UNRESOLVED_ENTRY]` before the patch.
- Four mutants, each reverted after its run: drop `${import.meta.env.BASE_URL}` from `actionService.ts:119` -> `expected 'http://localhost:3000' to be 'http://localhost:3000/My-Love/'`, 1 failed | 7 passed; `vite.config.ts:11` base -> `'/Renamed-Repo/'` -> fails at the config guard; delete `vi.unstubAllEnvs()` -> 3 failed | 5 passed (was 8 passed before this pass); delete `assignSpy?.mockRestore()` -> 3 failed | 5 passed (was 8 passed before this pass).

**Residual risks.**
- The I/O matrix's "Base dropped" row predicts `redirect_to` becomes `http://localhost:3000/`; the measured value is `http://localhost:3000`, with no trailing slash, because `window.location.origin` carries none. The row's behavioural claim -- that the case fails -- holds, and the matrix sits inside the read-only `<intent-contract>`, so the wording is corrected here rather than there.
- This closes the in-repo half of DW-97 only. `tests/e2e/auth/google-oauth.spec.ts:68` still asserts `redirect_to` at the dev base, and the deployed-origin round-trip at `https://sallvainian.github.io/My-Love/` remains operator work under DW-93. Nothing here observes the hosted Supabase redirect allow-list.
- The case still pins `vite.config.ts`'s authored `base` rather than the value Vite normalizes and inlines at build time. The two agree today because `/My-Love/` is already canonical.
- Reviewers mutated `src/` concurrently in this shared worktree during the pass. That produced one misleading failure report, refuted above; the tree was confirmed clean of `src/` changes before and after every verification command reported here.
