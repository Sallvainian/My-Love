# Verification

All commands run from the repo root on `fix/connection-recovery-user-facing`, baseline `3f0d951b`.

## Final results

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc -b --force` | clean, no output |
| Lint | `npm run lint` | clean, 0 problems |
| Whitespace | `git diff --check 3f0d951b` | clean |
| Unit suite | `npx vitest run` | **103 files, 1935 tests, all passed** (after review and re-check fixes) |
| Browser | `npx playwright test <7 affected specs> --project=chromium --workers=2` | **16 passed** |
| Production build | `fnox exec -- npm run build` | built; `dist/assets/*.js` carries the inlined project URL, so the env really was injected |

E2E specs run: `partner/partner-mood-realtime`, `notes/love-notes-realtime`, `auth/callback-messages`,
`auth/implicit-fragment-rejection`, `auth/login`, `partner/partner-mood`, `mood/mood-tracker` — the
new spec plus every spec whose premise this change could have disturbed.

Test delta, measured from `git diff --name-status` and a count of `it`/`test` declarations: 5 files
added (4 unit, 1 E2E), 4 modified, **31 cases added and 2 replaced**.

## Red before green

No regression here is trusted because it passed. Each was run against a deliberately broken source
and required to fail first. Every mutation was reverted and the suite re-run green afterwards.

| Mutation | Expected to break | Result |
| --- | --- | --- |
| CLOSED removed from the recovery branch | the unsolicited-close case | 2 failed |
| Give-up release removed | the max-retries case | included above |
| Stale-source guard removed | the replaced-channel case | 1 failed |
| Terminal status report removed | the status-transitions case | 1 failed |
| `stillCurrent()`'s version half deleted | DW-135's case | 3 failed |
| Inner recheck in the `.then()` deleted | DW-136's case | 1 failed |
| `.catch()` on the handoff chain deleted | DW-137's case | 1 failed |
| `code-expired` classification reverted | the exchange-failure case | 1 failed |
| The sign-in `else` removed | the dead-end case | 1 failed |
| `code-expired` copy duplicated from `provider-error` | the distinct-copy cases | 2 failed |
| `BASE_URL` dropped from the reset link | the reset-link case | 1 failed |
| Seed rule reverted to the `||` chain | the seed table | 9 of 14 failed |
| Anniversary button back to `bg-red-500` | the contrast invariant | 1 failed, naming the file, line and ratio |
| `withBasePath` rewritten to `base + routePath` | DW-125's first named mutant | 3 failed |
| `stripBasePath` rewritten to `return pathname` | DW-125's second named mutant | 2 failed |
| E2E: receiver listens for a different event, sender untouched | live delivery | send still answered 202; the delivery assertion failed |
| The `gaveUp` flag not honoured by in-flight opens (A-6) | the resurrection case | 1 failed, a sixth channel created |
| The two `LoveNotes` notice states swapped (A-8) | the notice cases | 2 failed |
| The `LoveNotes` notice element deleted (A-8) | the notice cases | 4 failed |
| `getAuthCallbackOutcome` short-circuiting before the session read (B3) | the signed-in case | 1 failed |
| The contrast scanner reverted to `className="…"` only (B1) | the canary and the allowlist | 2 failed |
| Gradient stops no longer scanned (B-R1) | the gradient canary and allowlist | 2 failed |

## One case that does not kill a mutant, stated rather than implied

`"does not reopen the topic when the close is this hook's own teardown"` survives every mutation of
the code this change added — and it also survives deleting the pre-existing `subscriptionActive`
guard in the retry timer. The path is additionally protected by `cancelled` inside `openChannel`,
which predates this work. It is a **regression guard, not a mutant-killer**: it documents that
CLOSED handling must not resurrect a torn-down mount, and today three independent mechanisms
enforce that. Recorded here because a test that cannot fail is exactly what DW-135, DW-136 and
DW-137 were raised about, and claiming otherwise for a test of my own would be the same defect.

## What was NOT verified

- **No deployed-site evidence.** DW-125's coverage is unit-level, with `BASE_URL` stubbed under
  happy-dom. No browser in this repo runs at the production base: `vite.config.ts:11` serves `/`
  outside production and `playwright.config.ts:178` boots `vite --mode test`. The deployed-origin
  round trip remains operator work under DW-93. This is the same substitution DW-126 was raised
  about, recorded this time rather than left in a triage log.
- **No installed-PWA or real-Google evidence.** DW-93 and DW-98 need a consent round-trip this
  session has no authorized path to. They stay open.
- **DW-106** needs hosted evidence that reaches the project only through `deploy.yml` on merge.
- **No axe scan** covers either button DW-134 names. The contrast claim rests on a computation
  against the installed palette, now encoded as a test, not on a browser scan.
- **`moodSyncService` still has no rejoin** for an unsolicited CLOSED. Raised as DW-138.
- **Five contrast failures are allowlisted, not fixed**, with measured ratios: DW-139 through DW-143.
  The two that matter are the love-notes send button at 1.99:1 and the app's primary gradient CTA,
  which fails at every point along the sweep in ten components. Both are design decisions rather
  than class edits, which is why they are raised rather than changed.

## Hosted check performed

DW-85 asked for one read against the linked project after the deploy:
`select count(*) from public.claude_bot_config where key = 'test_password'`, expecting 0. Run
read-only; the result was **0**. Only the count is recorded — the repo is public.
