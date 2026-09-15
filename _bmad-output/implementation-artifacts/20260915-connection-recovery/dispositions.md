# Review triage

Three reviewers with fresh contexts, given the branch, the baseline `3f0d951b`, the DW ids and
their own output path — and none of my conclusions. Reports: `review-a-realtime.md`,
`review-b-auth.md`, `review-c-tests.md`.

Every finding is recorded with its disposition. A refuted finding keeps its evidence.

## Reviewer B — auth, display name, contrast

| id | Finding | Severity | Disposition |
| --- | --- | --- | --- |
| B1 | The contrast guard matched only `className="…"`, never `className={…}` — ~130 of the latter in `src/`, and that is where conditional pairings live. One currently-failing pairing was invisible to it. | medium | **Accepted, fixed** in `6ae4b818` |
| B2 | The guard read only Tailwind's built-in palette and dropped unknown swatches silently, so the project's own `coral`/`sunset`/`ocean` — most of the brand — were never measured. | medium | **Accepted, fixed** in `6ae4b818` |
| B3 | `getAuthCallbackOutcome` returned `code-expired` without reading the session, so someone already signed in opening a reused link would be told to sign in again. | low | **Accepted, fixed** in `6ae4b818` |
| B4 | The `code-expired` branch also catches pre-exchange failures, where "expired or already used" is imprecise. | low | **Accepted as noted.** Already recorded in the source comment and the ledger: the branch is wider than its name, and the recovery is identical whichever the cause. No change. |
| B5 | The `GoTrueClient.js:960-962` citation is said to be wrong; the substitution is claimed to be at 963-966. | low | **REFUTED.** `grep -n "invalidTokenError"` returns 961 and 962, inside the `else if` at 960. The citation is correct as written. |
| B6 | DW-133's "the two readers cannot disagree again" overstates — `partnerService.ts:155` and `:274` still carry the `\|\|` chain, and `searchUsers` renders at `PartnerMoodView.tsx:426`. | low | **Partly accepted.** The claim is narrowed to `PartnerInfo.displayName` in `517c43d3`. Not fixed: in a search-for-someone-to-link-with list the address is the identifier being searched by, not a name standing in for someone already known. |
| B7 | The allowlist keys on `file:swatch`, so a file with two failing pairings stays green after one is fixed. | low | **Accepted, fixed** in `6ae4b818` — each entry now records an expected count, asserted. |
| B8 | DW-124's new assertion pins a link into a route that exists nowhere: `reset-password` is in no `pathMap`, no ternary, no `DESTINATIONS`, and `resetPassword` has no UI caller. | low | **Accepted as noted**, no change. DW-124 asked only that the composed link be pinned at the production base, which it now is. That the route is unreachable is a separate, pre-existing defect and outside this entry; the assertion is still correct about what it measures. |

### What B's findings cost, stated plainly

Two of them falsified claims this change had already written into the ledger. DW-140 called
green-500 "the worst contrast in the tree" — it is not; the love-notes send button is worse, and
that claim was made using a measurement blind to the palette the button is drawn from. DW-134's
resolution undercounted what the guard found. Both are corrected in `517c43d3` rather than quietly
adjusted.

The guard was the weakest thing in the change, and it was the part written to catch a whole class
of defect in future. It is worth saying that the reviewer found it by checking the tool rather than
the fix.

## Reviewer A — realtime lifecycle

A confirmed the core as sound: CLOSED cannot reopen a deliberately released channel on any of the
three release paths, the retry-ceiling release introduces no double-release or leak, the status key
suppresses a previous account's `disconnected`, and every SDK line number in the rewritten comments
is accurate. Ten findings on top of that.

| id | Finding | Severity | Disposition |
| --- | --- | --- | --- |
| A-1 | `realtimeSocket.ts`'s surviving justification for the gate says sign-out disconnects the socket. Nothing in `src/` calls `disconnect()` at all. | low | **Accepted, fixed.** The comment now names what actually reaches CLOSING: the browser closing the transport, or the SDK's own deferred disconnect firing 50s after the last channel goes away. |
| A-2 | `moodSyncService.ts` still carried the "~100ms" teardown claim DW-112 refuted. | low | **Accepted, fixed.** |
| A-3 | `useRealtimeMessages.test.ts`'s harness comment repeated the same refuted claim. | low | **Accepted, fixed.** |
| A-4 | The contract test's "resolves rather than rejects" case is vacuous: phoenix's local `trigger('ok')` runs `cancelRefEvent()` first, so the `'error'` reply matches nothing and the branch is dead. | medium | **Accepted, fixed.** Re-scoped to assert the no-op explicitly — settled before any reply, and the reply changes neither settlement nor state — rather than presenting it as the exercise. |
| A-5 | The unmount case does not isolate the guard its comment credits. | low | **Accepted, fixed.** The comment now says it is a regression guard, not a mutant-killer. This matched the note already in `verification.md`; the test itself was overstating. |
| A-6 | **Giving up was not terminal.** An `openChannel` parked on `setAuth` when the ceiling is hit resumes afterwards and builds a fresh channel — banner reading "not receiving new notes" while a channel is live. | low | **Accepted, fixed.** A `gaveUp` flag is now checked at all six of `openChannel`'s await points. Regression test added; reverting the flag turns it red. |
| A-7 | `setReport` wrote a fresh object for an unchanged status — latent render loop for a caller passing an inline `onNewMessage`. | low | **Accepted, fixed.** Wrapped so an unchanged status keeps the previous object. |
| A-8 | The new `LoveNotes` notice had no test, and the one suite that renders `LoveNotes` omitted `realtimeStatus` from its mock — rendering the component in a state its own type forbids. | medium | **Accepted, fixed.** The mock is repaired and `LoveNotes.realtimeStatus.test.tsx` covers all five states; deleting the element or swapping the two ternary arms turns it red. |
| A-9 | `data-testid="realtime-connection-status"` now named two different feeds. | low | **Accepted, fixed.** The new one is `realtime-connection-status-notes`, with a case asserting the bare id finds nothing in `LoveNotes`. |
| A-10 | A guard comment said "Both release paths"; the change made it three. | low | **Accepted, fixed.** |

## Reviewer C — test effectiveness, base path, E2E, ledger

C independently killed the mutants the ledger names plus several it does not, reproduced the "9 of
14" figure exactly, confirmed DW-135/136/137's supersession under its own mutation, reproduced every
contrast figure to the hundredth, and found the base-path extraction behaviourally identical at both
bases. Ten findings, none a behaviour regression.

| id | Finding | Severity | Disposition |
| --- | --- | --- | --- |
| C-1 | Four `moodSyncService.ts` citations in the new E2E spec were stale **at HEAD** — correct at the baseline, invalidated by this same diff shifting that file by ~10 lines. | medium | **Accepted, fixed.** Re-measured and corrected to `:232`, `:267`, `:605`, `:691`. Exactly the defect class DW-114 and DW-115 exist for, committed by the change that closed them. |
| C-2 | The contrast guard as committed missed all 130 `className={` sites. | medium | **Accepted** — already fixed in response to B1 while C was reviewing; C verified the fix. |
| C-2a | The rewritten guard still misses a template literal left open across lines. | low | **Accepted as a documented limitation.** Both known gaps under-report rather than over-report, and both are now stated in the file. |
| C-3 | `basePath.ts` claimed a normalisation neither it nor Vite performs. | low | **Accepted, fixed.** The docblock now says Vite guarantees the trailing slash and that this relies on it rather than enforcing it. |
| C-4 | The E2E teardown comment's premise about `saveForDate` is false on the E2E path: a Playwright context starts with an empty IndexedDB, so every run inserts rather than updates. | low | **Accepted, fixed.** The `toHaveLength(1)` was sound for the opposite reason to the one recorded — a reader following the old comment would have weakened the strongest teardown assertion in the file. |
| C-5 | `global-setup.ts:151` does not link anything (copied from the notes spec). | low | **Accepted, fixed** to `:171`. |
| C-6 | `moodSlice.ts:70` is a comment; `saveForDate` is at `:71`. | low | **Accepted, fixed.** |
| C-7 | "At most one row, never exactly one" contradicted the `toHaveLength(1)` three lines below it. | low | **Accepted, fixed** along with C-4. |
| C-8 | DW-137's `messagesSlice.ts:104-107` overshoots the catch block. | low | **Accepted, fixed** to `:105-107`. |
| C-9 | The allowlist cited `DW-141`/`DW-142`, which did not exist in the ledger when C read it. | medium | **Accepted** — both entries were appended in `517c43d3`, before C's report was read. Verified present at `deferred-work.md:1388` and `:1395`. |
| C-10 | DW-140's "the worst contrast in the tree" is false. | low | **Accepted** — corrected in `517c43d3`, independently of C, from B2's finding. |

## Reviewer B — re-check of the fixes

B was asked to verify its own findings' fixes rather than take them on trust. It compared
`readProjectPalette()` against actually importing `tailwind.config.js` (50 entries each, no key or
value differing, and the `extend` merge order correct), confirmed the literal scanner is a strict
superset of the attribute scan it replaced, and traced all four auth outcomes plus both pinned E2E
specs against the reordered classifier. It also **withdrew B5**: `dist/module/GoTrueClient.js:960-962`
is correct for the build Vite resolves, and the `963-966` it first measured is the CJS build. Its
suggestion to name the build is taken — all three citations now say `dist/module`.

Two new findings from the re-check:

| id | Finding | Severity | Disposition |
| --- | --- | --- | --- |
| B-R1 | **Gradients were entirely unmeasured**, and the app's primary call-to-action fails. `bg-gradient-to-r from-pink-500 to-rose-500` carries no `bg-<colour>-<shade>`, so ten components sat outside the guard. Measured: pink-500 3.58:1, and rose-500 resolving to the project's own override at 3.67:1 — both ends below the floor, so every point between them is too. | medium | **Accepted, fixed.** The scanner now reads `from-`/`via-`/`to-` stops. The ten sites are allowlisted as one group, keyed by swatch with an expected count, and raised as DW-143. Reverting the gradient scan turns two cases red. |
| B-R2 | A template literal left open across lines is still only judged where both utilities land on the same line; two live sites are affected. | low | **Accepted as a documented limitation**, already stated in the file. Both known gaps under-report rather than over-report. |

B-R1 is the same defect as B1 and B2 one level up: the guard's stated property — that a new failure
fails without anyone remembering the rule — was false for the single most-used button style in the
app, and stayed false through the first round of fixing it. The fix for DW-143 is already written in
the tree and applied to the wrong state: several of those buttons carry
`hover:from-pink-600 hover:to-rose-600`, and those stops clear at 4.54:1 and 4.70:1. The button is
compliant only while the pointer is on it.

## What review changed

Two findings were defects, not documentation: **A-6** (giving up was not terminal, contradicting the
type's own docstring and the UI copy) and **B3** (a signed-in person could be told to sign in again).
Two were tests that did not test what they claimed: **A-4** and **A-8**. Two were measurement tools
blind to most of what they claimed to measure: **B1** and **B2**, which between them hid the worst
contrast failure in the app.

The rest — eleven findings — were citations and comments that were wrong. **C-1** is the one worth
naming: this change closed DW-114 and DW-115, whose entire subject is ledger citations pointing at
the wrong code, and then shipped five stale citations of its own in a file it wrote, invalidated by
its own diff. That is the defect class repeating inside its own fix.
