# Review C — test effectiveness, base-path refactor, new E2E spec, deferred-work ledger

Reviewer scope: `src/utils/basePath.ts`, `src/stores/slices/navigationSlice.ts`, `src/App.tsx`,
`tests/unit/utils/basePath.test.ts`, `tests/e2e/partner/partner-mood-realtime.spec.ts`,
`tests/unit/stores/settingsSlice.initializeApp.test.ts`, `tests/unit/a11y/whiteOnColorContrast.test.ts`,
`tests/unit/api/partnerServiceDisplayName.test.ts`, and
`_bmad-output/implementation-artifacts/deferred-work.md`.

Branch `fix/connection-recovery-user-facing`, baseline `3f0d951b`.

Realtime internals (DW-109/110/112/113) and the auth/callback work (DW-131/132) are other reviewers'
lanes; I read them only where a claim crossed into mine.

Working tree was clean at start. Every mutation below was applied with `perl -pi` and reverted with
`git checkout --` in the same command. **Mid-review, `tests/unit/a11y/whiteOnColorContrast.test.ts`
was rewritten on disk by someone else** — `git status` now shows it as `M` (uncommitted, outside
`git diff 3f0d951b`). I left that edit alone, re-ran my mutations against it, and split the contrast
findings into "as committed" (C-2) and "against the working tree" (C-2a, C-9, C-10). Nothing else in
the tree is modified by me.

Non-destructive checks run: `npx tsc -b --force` (exit 0), `npm run lint` (clean),
`npx vitest run` (102 files / 1924 passed). Playwright was **not** run.

---

## Summary

The three new unit suites are genuinely non-vacuous — I killed the mutants the ledger names, plus
several it does not, and reproduced the "9 of 14" figure exactly. DW-135/136/137's supersession claim
holds under independent mutation. Every contrast figure in DW-134/139/140 reproduces to the hundredth.
The base-path extraction is behaviourally identical at both bases.

Ten findings, none of them a behaviour regression. The ones that matter are **C-1** (the new E2E spec
ships four line citations that the same commit invalidates) and **C-9** (the rewritten contrast guard
allowlists two pairings against ledger ids `DW-141`/`DW-142` that do not exist in the ledger).
**C-2** — the committed guard's stated scope was measurably false — has already been fixed in the
working tree while I was reviewing; I verified the fix and recorded what it did and did not close
(C-2a).

| id | title | severity | confidence | introduced? |
|----|-------|----------|------------|-------------|
| C-1 | Four `moodSyncService.ts` citations in the new E2E spec are stale at HEAD | medium | high | introduced |
| C-2 | Contrast guard (as committed) misses all 130 `className={` sites | medium | high | introduced — **fixed in working tree**, see C-2a |
| C-2a | Rewritten guard still misses a template literal left open on the line | low | high | working tree |
| C-9 | Allowlist cites `DW-141`/`DW-142`; neither exists in the ledger | medium | high | working tree |
| C-10 | DW-140's "the worst contrast in the tree" is now false (coral-500 is 1.99:1) | low | high | working tree exposed it |
| C-3 | `basePath.ts` docblock claims a normalisation neither it nor Vite performs | low | high | introduced |
| C-4 | E2E teardown comment's premise about `saveForDate` is false on the E2E path | low | high | introduced |
| C-5 | `global-setup.ts:151` does not link anything | low | high | pre-existing (copied) |
| C-6 | `moodSlice.ts:70` is a comment; `saveForDate` is at `:71` | low | high | introduced |
| C-7 | "never exactly one" comment contradicts the `toHaveLength(1)` beneath it | low | high | introduced |
| C-8 | DW-137's `messagesSlice.ts:104-107` overshoots the catch; test-double "faithful" overstated | low | high | introduced |

---

## C-1 — Four `moodSyncService.ts` citations in the new E2E spec are stale at HEAD

**Severity** medium · **Confidence** high · **Introduced by this change** · **DW-123**

**Files/symbols** `tests/e2e/partner/partner-mood-realtime.spec.ts:7`, `:31`, `:99`, `:100`, `:173`;
`src/api/moodSyncService.ts`.

**What I found.** The spec cites four line numbers in `src/api/moodSyncService.ts`:

- `tests/e2e/partner/partner-mood-realtime.spec.ts:7` — `" * notes only; \`src/api/moodSyncService.ts:257\` runs the same composition --"`
- `:31` — `" * \`moodSyncService.ts:681\`: that one is \`logger.debug\`, which is stripped"`
- `:99` — `"      // topic (\`moodSyncService.ts:257\`) while the receiver joins its OWN"`
- `:100` — `"      // (\`:595\`) -- the same value seen from the two ends of the pair."`
- `:173` — `"        // \`moodSyncService.ts:222\` swallows its rejection, so checking the"`

All four were correct at the baseline and all four are wrong at HEAD. Measured with
`git show 3f0d951b:src/api/moodSyncService.ts | sed -n '<L>p'` against `sed -n '<L>p' src/api/moodSyncService.ts`:

| cited | baseline `3f0d951b` | HEAD |
|---|---|---|
| `:222` | `console.error('[MoodSyncService] Background broadcast failed:', err);` | `// Broadcast to partner after successful sync (fire-and-forget).` |
| `:257` | ``await sendEphemeralBroadcast(`mood-updates:${partnerId}`, 'new_mood', {`` | `logger.debug('[MoodSyncService] Skipping broadcast - device is offline');` |
| `:595` | ``const topic = `mood-updates:${currentUserId}`;`` | `const currentUserId = session?.user?.id;` |
| `:681` | `logger.debug('[MoodSyncService] Broadcast subscription status:', status);` | `if (!mood) {` |

The true HEAD locations are `:232` (the swallow), `:267` (the send), `:587` (`subscribeMoodUpdates`),
and the status `logger.debug` further down.

**Trigger.** Open the spec at HEAD and follow any of the five citations.

**Why it matters / underlying cause.** `src/api/moodSyncService.ts` is modified in this very diff
(`git diff 3f0d951b --stat` → `src/api/moodSyncService.ts | 45 ++--`), shifting everything below the
broadcast block by ~10 lines. The spec was written against the baseline file and landed in the same
commit that invalidated it. This is precisely the defect class DW-114 and DW-115 exist for, and the
ledger's own DW-115 resolution states the remedy at
`_bmad-output/implementation-artifacts/deferred-work.md:1166`:
`"now name symbols rather than line numbers or nothing, which is what survives an edit to the file"`.
The same commit that adopts that rule for the ledger breaks it in the new spec.

**Resolution.** Re-point all five to symbols with the baseline noted, matching the form the ledger
just adopted — e.g. `` `moodSyncService.syncMoodWithRetry`'s `sendEphemeralBroadcast` (baseline 3f0d951b:257) ``,
`` `subscribeMoodUpdates`'s own-topic composition ``, `` the fire-and-forget `.catch()` in `syncMoodWithRetry` ``.

**Test that would demonstrate the fix.** A grep-based unit guard over `tests/e2e/**` and
`_bmad-output/implementation-artifacts/deferred-work.md` that extracts every `` `<path>:<n>` `` citation,
reads that line, and fails when it is blank or a comment-only line. That is a larger change than this
finding warrants; the minimum is a re-read of each citation against HEAD before merge.

---

## C-2 — The contrast guard misses `className={...}` forms while claiming to cover every pairing

**Severity** medium · **Confidence** high (proved by surviving mutant) · **Introduced** · **DW-134/139/140**

**File/symbol** `tests/unit/a11y/whiteOnColorContrast.test.ts:160` (`findWhiteOnColourPairings`).

**What I found.** The header claims total coverage at `tests/unit/a11y/whiteOnColorContrast.test.ts:13`:

> `" * this is here instead, and it generalises the entry rather than restating it: every \`text-white\` + \`bg-<colour>-<shade>\` pairing in \`src/\` is"`

(continuing `:13-14` `"measured against the real palette, so a NEW button below the floor fails without anyone having to remember this rule."`)

The extractor is `tests/unit/a11y/whiteOnColorContrast.test.ts:160`:

```
      for (const classAttr of text.matchAll(/className=["`]([^"`]*)["`]/g)) {
```

The character immediately after `className=` must be `"` or a backtick. A `className={` — the brace
form used for every conditional/interpolated class string — never matches.

**Reproduction (mutation, survived).** Applied to a `className={` template and ran the suite:

```
perl -pi -e 's/bg-gray-700 px-4 py-3 text-white/bg-green-500 px-4 py-3 text-white/' \
  src/components/PhotoEditModal/PhotoEditModal.tsx
npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts
```

Result: `Test Files 1 passed (1) / Tests 4 passed (4)`. `green-500` is 2.22:1 — the worst ratio in the
tree, the one DW-140 was raised for — and the guard did not see it. The mutated line is
`src/components/PhotoEditModal/PhotoEditModal.tsx:247`:
``"              className={`w-full rounded-lg border bg-gray-700 px-4 py-3 text-white ${"``

Control mutants both died, so the guard does work on quoted attributes:
- regressing `src/components/Settings/AnniversarySettings.tsx:207` to `bg-red-500` → `1 failed | 3 passed`, `AssertionError: expected [ Array(1) ] to deeply equal []`
- introducing `bg-orange-500` in `src/components/PhotoGallery/PhotoViewer.tsx:671` → `1 failed | 3 passed`

**Two further scope holes in the committed version, same function.**
1. `tests/unit/a11y/whiteOnColorContrast.test.ts:165` is `/(?<![\w:-])bg-([a-z]+-\d{3})\b/g` — exactly
   three digits, so `-50` shades cannot match; and the `\b` boundary rejects an opacity modifier like
   `bg-blue-500/90`.
2. Only Tailwind's built-in palette was read. `src/index.css:4` is
   `"@config '../tailwind.config.js';"`, which extends the theme with the project's own brand families
   — a guard blind to them reports clean over most of the design system.

**Why it matters.** The value the header claims for this file over "a test that asserts two class
strings" is exactly that a *new* button below the floor fails automatically. For the brace form —
which is what a button with a conditional style is written in — it did not.

**Status: already fixed in the working tree.** See C-2a. The fix widened the scan from
`className="…"` to every string literal on the line, widened `\d{3}` to `\d{2,3}`, replaced the `\b`
boundary with `(?![\w-])` so an opacity modifier is measured at full opacity, and added a
`tailwind.config.js` palette reader. I verified all of it below.

---

## C-2a — The rewritten guard still misses a template literal left open on the line

**Severity** low · **Confidence** high (proved by surviving mutant) · **Working-tree edit, not committed**

**File** `tests/unit/a11y/whiteOnColorContrast.test.ts:231` (`findWhiteOnColourPairings`).

**What the rewrite fixed — verified.** Against the working-tree version:

- Baseline `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` → `Tests 5 passed (5)`.
- **Mutant B1 dies.** Changing the single-line conditional at
  `src/components/PhotoGallery/PhotoGridItem.tsx:100`
  (`"            photo.isOwn ? 'bg-pink-600 text-white' : 'bg-blue-500/90 text-white'"`)
  to `'bg-lime-400 text-white'` gives `Tests 1 failed | 4 passed`, with the offender named precisely:
  `"src/components/PhotoGallery/PhotoGridItem.tsx:100 bg-lime-400 1.54:1"`. The committed version
  could not see that line at all.
- Its own measured claim at `:31-32` — `" * \`className=\"\` against 130 \`className={\`"` (roughly
  1300 vs 130) — is **exact**: `grep -rho --include='*.tsx' 'className="' src/ | wc -l` → `1300`;
  same for `'className={'` → `130`.
- The project-palette reader works and its three new figures are exact. Parsing
  `tailwind.config.js` the same way the test does and computing contrast against white:
  `coral-500 #ffa07a 1.99:1`, `coral-900 #c44536 4.94:1`, and `coral-900` is the **only** coral shade
  that clears 4.5 — matching `:57` `"every coral shade fails except coral-900 (4.94:1)"` exactly.
  `blue-500 #2b7fff 3.76:1` matches `:68`. `sunset-500` and `ocean-500` are both defined, as the new
  case at `:277` asserts.
- Both new allowlist locations are real: `src/components/love-notes/MessageInput.tsx:269` is the
  `bg-coral-500 … text-white` send button; `src/components/PhotoGallery/PhotoGridItem.tsx:100` is the
  `bg-blue-500/90 text-white` arm.

**What it did not fix.** `tests/unit/a11y/whiteOnColorContrast.test.ts:231` is

```
      for (const literal of text.matchAll(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g)) {
```

Every alternative requires a **closing** delimiter on the same line. A `className={` that opens a
template literal and interpolates — the exact form the rewrite's own comment names as the motivating
case — has no closing backtick on its first line, so the literal never matches.

**Reproduction (mutant still survives).**

```
perl -pi -e 's/bg-gray-700 px-4 py-3 text-white/bg-green-500 px-4 py-3 text-white/' \
  src/components/PhotoEditModal/PhotoEditModal.tsx
npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts   # Tests 5 passed (5)
```

The mutated line is `src/components/PhotoEditModal/PhotoEditModal.tsx:247`:
``"              className={`w-full rounded-lg border bg-gray-700 px-4 py-3 text-white ${"``

**Exposure is now two lines and zero real defects.** `grep -rn --include='*.tsx' 'text-white' src/ |
grep -v scripture-reading | grep -E 'className=\{\`' | grep -vE '\`[^\`]*\`' | wc -l` → `2`, both the
`PhotoEditModal.tsx` inputs above, both `bg-gray-700`, which clears AA comfortably. That is why this is
low, not a repeat of C-2.

**Why it still matters.** The comment at `:229-231` documents a *different* limitation — `" * Known
limitation: a pairing split across two literals (\`${base} text-white\`, with the background in
\`base\`) is not seen."` — and does not mention this one, so a reader has no warning that the brace
form is still partly uncovered.

**Resolution.** Either add the unterminated-opener alternative (`` `[^`\n]* ``) to the literal regex,
or scan the whole file text with an offset→line map so multi-line literals are handled properly.
Whichever is chosen, extend the `:229-231` comment to name it.

**Test that would demonstrate the fix.** Re-run the mutation above and require it red.

---

## C-9 — The allowlist cites `DW-141` and `DW-142`; neither exists in the ledger

**Severity** medium · **Confidence** high · **Working-tree edit, not committed**

**Files** `tests/unit/a11y/whiteOnColorContrast.test.ts:57`, `:68`;
`_bmad-output/implementation-artifacts/deferred-work.md`.

**What I found.**

- `:57` — `"      note: 'coral-500 at 1.99:1 — the love-notes send button, and the worst in the tree. DW-141. Not a shade bump: every coral shade fails except coral-900 (4.94:1), so this is a brand decision.',"`
- `:68` — `"      note: 'blue-500 at 3.76:1 on text-xs, measured at full opacity though the class is bg-blue-500/90 over a photo — DW-142.',"`

`grep -n "### DW-14[0-9]" _bmad-output/implementation-artifacts/deferred-work.md` returns one line:
`"1381:### DW-140: The partner-mood action button pairs white text with bg-green-500, at 2.22:1 — the worst contrast in the tree."`
The file has 1386 lines and its last entry is DW-140. `grep -rn "DW-141\|DW-142"` across the repo
matches only those two allowlist strings.

**Why it matters.** The allowlist's whole contract is stated at `:47-50`:
`" * Listed, not silently skipped: each carries its measured ratio so the debt is legible, and anything NOT on this list fails. Adding an entry here is a deliberate act a reviewer can see, which is the property an allowlist has to have to be worth anything."`
Two real AA failures — one of them the worst in the tree at 1.99:1 — are suppressed by pointers into
a ledger that does not contain them, so the debt is legible nowhere. DW-139 and DW-140 were filed
alongside their allowlist entries in the same change; these two were not.

**Caveat on timing.** This edit is uncommitted and post-dates my read of the ledger, so it may simply
be in flight. Verify immediately before commit.

**Resolution.** Append DW-141 (coral-500, `src/components/love-notes/MessageInput.tsx:269`, 1.99:1,
brand decision — only coral-900 clears) and DW-142 (blue-500,
`src/components/PhotoGallery/PhotoGridItem.tsx:100`, 3.76:1 at full opacity over a photo) in the same
commit as the allowlist entries, in the shape DW-139 and DW-140 use.

**Test that would demonstrate the fix.** Extend the existing "keeps the allowlist honest" case to
parse each note's `DW-\d+` id and assert a matching `### <id>:` heading exists in
`_bmad-output/implementation-artifacts/deferred-work.md`. That turns "allowlisted with a ledger id"
into something the suite enforces rather than something a reviewer has to remember to check.

---

## C-10 — DW-140's "the worst contrast in the tree" is now false

**Severity** low · **Confidence** high · **DW-140**

`_bmad-output/implementation-artifacts/deferred-work.md:1381` —
`"### DW-140: The partner-mood action button pairs white text with bg-green-500, at 2.22:1 — the worst contrast in the tree."`
and its reason repeats the ranking.

That was true against the committed guard's field of view, which read only Tailwind's built-in palette.
The working-tree guard reads `tailwind.config.js` too and surfaces `coral-500` at **1.99:1**
(`src/components/love-notes/MessageInput.tsx:269`), which the new allowlist note at `:57` itself calls
`"the worst in the tree"`. The two statements now contradict each other.

**Resolution.** Fold this into the C-9 ledger append: when DW-141 is filed, amend DW-140's title and
reason to drop the superlative — the 2.22:1 figure and the two-step green-700 argument are both still
correct and are what the entry is actually for.

---

## C-3 — `basePath.ts` docblock claims a normalisation neither it nor Vite performs

**Severity** low · **Confidence** high · **Introduced** · **DW-125**

**File/symbol** `src/utils/basePath.ts:26`, `currentBase()`.

**What I found.**

- `src/utils/basePath.ts:26` — `"/** The configured base, normalised so it always ends in exactly one \`/\`. */"`
- `src/utils/basePath.ts:28` — `"  return import.meta.env.BASE_URL || '/';"`

No normalisation happens. The claim only survives because something upstream is assumed to guarantee
the trailing slash, and Vite does not. `node_modules/vite/dist/node/chunks/node.js:37053` is
`"	const BASE_URL = resolvedBase;"`, and `resolveBaseUrl` at `:37253` warns on a missing leading slash
and runs the value through `new URL(base, "http://vite.dev").pathname` — it never appends a trailing
slash. So `base: '/My-Love'` yields `BASE_URL === '/My-Love'`, and then
`src/utils/basePath.ts:39` `"  return base === '/' ? routePath : base.slice(0, -1) + routePath;"`
emits `/My-Lov/photos`, while `stripBasePath('/My-Love/photos')` slices at `base.length - 1 = 7` and
returns `e/photos`.

**Trigger.** Drop the trailing slash in `vite.config.ts:11`.

**Why it matters — and why it is low.** The defect is latent, not live: `vite.config.ts:11` is
`"  base: mode === 'production' ? '/My-Love/' : '/',"` and the new test pins that literal at
`tests/unit/utils/basePath.test.ts:48` (`expect(viteConfig?.config.base).toBe(PRODUCTION_BASE)`) inside
`beforeAll`, so the edit above turns the whole file red. The guard exists; it is the *comment* that is
untrue, and an untrue comment is what would authorise the edit.

**Resolution.** Either make `currentBase()` do what the comment says —
`const base = import.meta.env.BASE_URL || '/'; return base.endsWith('/') ? base : base + '/';` — or
change the comment to `"The configured base as Vite resolved it. Vite does not add a trailing slash;
vite.config.ts:11 supplies one and tests/unit/utils/basePath.test.ts:48 pins it."`

**Test that would demonstrate the fix.** A case stubbing `BASE_URL` to `'/My-Love'` (no trailing
slash) and asserting `withBasePath('/photos') === '/My-Love/photos'` and
`stripBasePath('/My-Love/photos') === '/photos'`. Today that case fails; after normalising it passes.

---

## C-4 — The E2E teardown comment's premise about `saveForDate` is false on the E2E path

**Severity** low · **Confidence** high · **Introduced** · **DW-123**

**File** `tests/e2e/partner/partner-mood-realtime.spec.ts:216-217`.

**What I found.**

```
216	        // `moodSlice.ts:70` writes through `saveForDate`, so a second run on the
217	        // same day UPDATES the existing row rather than inserting beside it.
```

`saveForDate` keys on IndexedDB's `by-user-date` index (`src/services/moodService.ts:128`:
`"    const existing = await tx.store.index('by-user-date').get([userId, date]);"`). Playwright's
storage state carries cookies and localStorage only — `grep -c indexedDB
.auth/local/worker-0-partner/storage-state.json` → `0`, and the file's top-level keys are `cookies`
and `origins[].localStorage`. So a fresh context starts with an empty IndexedDB, `existing` is
`undefined`, `mood.supabaseId` is unset, and the sync takes `moodApi.create`, which upserts on
`(user_id, created_at)` where `created_at` is the per-save `new Date()` at millisecond precision
(`src/services/moodSyncPayload.ts:70` → `toCreatedAt`). Every run inserts a **new** row.

**Why it matters.** The conclusion drawn from the false premise is at `:218-220`:
`"        // The marker still identifies it, but the count that proves a\n        // mis-resolved identity in the notes spec cannot transfer: the row it\n        // would be counting may predate this test."`
The `toHaveLength(1)` at `:224` is in fact sound — but for the opposite reason to the one recorded.
A future reader following this comment would weaken or delete the strongest teardown assertion in the
file on the belief that it cannot hold.

**Resolution.** Replace `:213-220` with the measured mechanism: a fresh Playwright context has no
IndexedDB, so `saveForDate` finds no local row, `moodApi.create` upserts at millisecond-precision
`created_at`, and exactly one row is created and deleted per run.

**Test that would demonstrate the fix.** None needed — the assertion is already correct. The fix is
to the prose. A reader-level check: run the spec twice in a row on the same day and confirm
`toHaveLength(1)` both times (which the current comment predicts it would not).

---

## C-5 — `global-setup.ts:151` does not link anything

**Severity** low · **Confidence** high · **Pre-existing** (copied verbatim from the DW-90 sibling)

**File** `tests/e2e/partner/partner-mood-realtime.spec.ts:35`, and
`tests/e2e/notes/love-notes-realtime.spec.ts:23`.

**What I found.** `tests/e2e/partner/partner-mood-realtime.spec.ts:34-35`:
`" * Identities are this worker's own pooled pair, linked once by\n * \`tests/support/auth/global-setup.ts:151\`."`

`sed -n '151p' tests/support/auth/global-setup.ts` → `"  // Create legacy users"`. The linking is
`linkUserPair`, declared at `:110` and called for the worker pool at `:171`
(`"    await linkUserPair(admin, getWorkerEmail(i), getWorkerPartnerEmail(i));"`).

**Why it matters.** The claim carrying the AGENTS.md worker-pool guarantee — "nothing here links,
unlinks or resets an account" — is backed by a citation that points at a comment. The guarantee itself
is **true**: I checked every write in the spec and the only one is the `moods` DELETE at `:201-206`,
filtered on `.eq('note', moodNote)` **and** `.in('user_id', [userId, partnerId])` from
`resolveOwnPair`, which reads `getWorkerPairEmails()` keyed on `TEST_WORKER_INDEX`
(`tests/support/helpers/events.ts:70-79`). No partner link, no password reset, no shared row nulled.

**Resolution.** Cite `tests/support/auth/global-setup.ts` `linkUserPair` (`:110`, called at `:171`) in
both specs.

**Test that would demonstrate the fix.** Same grep guard proposed under C-1.

---

## C-6 — `moodSlice.ts:70` is a comment; `saveForDate` is at `:71`

**Severity** low · **Confidence** high · **Introduced**

`tests/e2e/partner/partner-mood-realtime.spec.ts:216` cites `` `moodSlice.ts:70` ``.
`sed -n '70p' src/stores/slices/moodSlice.ts` →
`"      // on disk atomically so replacing a hidden row cannot collide with it."`.
`grep -n saveForDate src/stores/slices/moodSlice.ts` → `71` and `105`. Off by one; fold into the C-4
rewrite.

---

## C-7 — "never exactly one" contradicts the `toHaveLength(1)` three lines below it

**Severity** low · **Confidence** high · **Introduced**

`tests/e2e/partner/partner-mood-realtime.spec.ts:213` —
`"        // At most one row, never exactly one. Unlike \`love_notes\`, \`moods\` is"`

`:221-224` —
```
        if (moodRowCommitted) {
          expect
            .soft(deleted ?? [], 'Teardown must not match rows outside this pair')
            .toHaveLength(1);
```

The `moodRowCommitted` guard reconciles the two — "at most one in general, exactly one once a row is
known committed" — but the comment says the opposite of the code it annotates and never states the
reconciliation. Reword to name the guard explicitly: *"At most one row in general; exactly one once
`moodRowCommitted` is raised, which is why the assertion sits inside that guard."*

---

## C-8 — DW-137's cited swallow range overshoots, and the test double is not quite "faithful"

**Severity** low · **Confidence** high · **Introduced** · **DW-137**

**What I found.** Two places cite the production swallow as `messagesSlice.ts:104-107`:
- `_bmad-output/implementation-artifacts/deferred-work.md:1365` (DW-137 resolution) — `"(messagesSlice.ts:104-107)"`
- `tests/unit/stores/settingsSlice.initializeApp.test.ts:128` — `"     * (\`src/stores/slices/messagesSlice.ts:104-107\`), which is precisely why"`

The catch is `105-107`. `sed -n '104p' src/stores/slices/messagesSlice.ts` →
`"      if (stillCurrent() && !get().currentMessage) get().updateCurrentMessage();"` — the line before
it, and the one whose throw the catch exists to absorb. `grep -n "catch (error)"` →
`105:    } catch (error) {`; `grep -n "Error loading messages"` → `106`.

Separately, `tests/unit/stores/settingsSlice.initializeApp.test.ts:125` opens
`"     * Faithful to \`messagesSlice.loadMessages\`, including the try/catch."` while the double logs
`console.error('[MessagesSlice] Failed to load messages:', error)` and production logs
`console.error('Error loading messages:', error)` (`messagesSlice.ts:106`). No test asserts on either
string, so nothing breaks — but "faithful" is doing more work than the code supports. Say "faithful in
the one respect that matters: it swallows".

---

## Verified claims (independently reproduced, no finding)

**DW-135 / DW-136 / DW-137 — superseded by `dfca89a9`, verified by mutation.** I mutated
`src/stores/slices/settingsSlice.ts` and ran `tests/unit/stores/settingsSlice.initializeApp.test.ts`
(baseline: 8 passed).

| entry | mutation | ledger claim | measured |
|---|---|---|---|
| DW-135 | `stillCurrent` → `get().userId === requestedBy` (drop the version half) | "turns three cases red" | `3 failed \| 5 passed` ✓ |
| DW-136 | delete the inner `userId`/`authSessionVersion` recheck in the `.then()` (`settingsSlice.ts:180`) | "turns it red" | `1 failed \| 7 passed` ✓ |
| DW-137 | delete the `.catch()` (`settingsSlice.ts:187-189`) | "turns … red" | `1 failed \| 7 passed` ✓ |

`git show --stat dfca89a9` confirms `tests/unit/stores/settingsSlice.initializeApp.test.ts | 52 ++++`
and `git show dfca89a9 -- <that file>` shows it adding exactly the three named cases
(`rejects a version-only stale initialization…`, `withholds the handoff completion when a second
version-only change lands`, `handles a thrown handoff completion without an unhandled rejection`).
DW-137's second half — the double rethrowing where production swallows — is genuinely fixed in this
diff, and the `.catch()` mutant still dies afterwards, so the case is green for the right reason.

**`tests/unit/utils/basePath.test.ts` — non-vacuous.** Four of five mutants died:

| mutant | result |
|---|---|
| `base + routePath` (the doubled separator DW-125 measured) | `3 failed \| 4 passed` |
| `stripBasePath` → `return pathname` | `2 failed \| 5 passed` |
| `pathname.slice(base.length)` (off-by-one) | `2 failed \| 5 passed` |
| drop the `pathname.startsWith(base)` guard | `1 failed \| 6 passed` |
| `import.meta.env.BASE_URL` without `\|\| '/'` | **survived** (7 passed) |

The survivor is not a defect: `BASE_URL` is always defined by Vite
(`node_modules/vite/dist/node/chunks/node.js:37053`), so the `|| '/'` arm is unreachable in both dev
and build. Worth knowing; not worth a case.

Supporting citations in that file's header all check out: `vite.config.ts:11` is
`"  base: mode === 'production' ? '/My-Love/' : '/',"`; `playwright.config.ts:178` is
`"    command: 'npx vite --mode test',"`; `supabaseClientAuthFlow.test.ts:31-40` is exactly the
`PRODUCTION_BASE` docblock plus its constant; `:125` is `"    vi.unstubAllEnvs();"` and `:132` is
`"    expect(import.meta.env.BASE_URL).toBe('/');"`. `ROUTES` at `:38` matches `navigationSlice`'s
`pathMap` entry-for-entry (7 routes, `home`…`settings`).

**The base-path extraction is behaviour-preserving.** `git diff 3f0d951b -- src/App.tsx
src/stores/slices/navigationSlice.ts` shows the two inline bodies moved verbatim into
`withBasePath`/`stripBasePath`; the branch structure, the `base.slice(0, -1)` and the
`base.length - 1` are unchanged. Moving to module scope does not change when `BASE_URL` is read —
`currentBase()` reads it per call (`basePath.ts:28`), which is what lets `vi.stubEnv` work; Vite
inlines the expression textually at build time wherever it appears, so module scope versus function
scope is irrelevant to the build. `tsc -b --force` and `npm run lint` are both clean.

**`App.tsx`'s two non-helper path sites — checked, benign.**
`src/App.tsx:169` is `"  const [showAdmin, setShowAdmin] = useState(() => window.location.pathname.includes('/admin'));"`
— `includes` is base-agnostic and correct at both bases (`/My-Love/admin`.includes(`/admin`) is true).
`src/App.tsx:658` is `"    window.history.pushState({}, '', window.location.pathname.replace('/admin', ''));"`,
which at the production base writes `/My-Love` — a path `stripBasePath` will not strip, because
`'/My-Love'.startsWith('/My-Love/')` is false. It falls through the view chain to `'home'`
(`App.tsx:200`), which is the intended destination, and a reload at `/My-Love` is redirected to
`/My-Love/` by GitHub Pages. Same shape at `src/components/AdminPanel/AdminPanel.tsx:47`. Pre-existing
and without user-visible effect; I am recording it rather than raising it.

**`tests/unit/api/partnerServiceDisplayName.test.ts` — "9 of its 14 cases fail against the old chain"
is exact.** Reverting `src/api/partnerService.ts` to
`const partnerName = partnerRecord.display_name || partnerRecord.email || 'Partner';` gives
`Tests 9 failed | 5 passed (14)`. The three `PartnerMoodView` renders the header cites are verbatim:
`:536` `"                    {partner.displayName}'s Moods"`, `:566`
`"                <p className=\"text-gray-600\">Connected with {partner.displayName}</p>"`, `:629`
`"                  {partner.displayName} hasn't logged any moods yet."`. The new
`partnerRecord.display_name?.trim() ?? 'Partner'` tail at `partnerService.ts:99` is unreachable
(`isSeedFallbackName` returns true for `null`, `''` and whitespace — `supabaseClient.ts:414-421`), so
the empty-string regression I looked for does not exist.

**DW-134 / DW-139 / DW-140 — every figure reproduces.** I re-implemented the test's oklch→sRGB→contrast
pipeline against `node_modules/tailwindcss/theme.css` and got:
`red-500 #fb2c36 3.82:1`, `red-600 #e7000b 4.76:1`, `purple-500 #ad46ff 4.12:1`,
`purple-600 5.53:1`, `green-500 #00c950 2.22:1`, `green-600 3.22:1`, `green-700 #008236 4.94:1`.
Every hex and every ratio in DW-134, DW-139 and DW-140 matches, including DW-140's two-step argument
(green-600 still fails, green-700 clears) and DW-139's "purple-600 or darker". Enumerating all
pairings the **committed** test's regex finds gives exactly four below the floor —
`InteractionHistory.tsx:183 purple-500 4.12`, `PartnerMoodView.tsx:497 green-500 2.22`, and two in
`src/components/scripture-reading/reflection/DailyPrayerReport.tsx` (`:115`, `:146`) — matching DW-134's
`"Four pairings were already below the floor; two are in the frozen scripture feature"`. (That count is
a property of the narrow extractor, not of the tree: the working-tree rewrite finds two more real
failures, which is C-9/C-10.) Both allowlisted code quotes are verbatim: `InteractionHistory.tsx:183` is
`"                          <div className=\"rounded-full bg-purple-500 px-3 py-1 text-xs font-medium text-white\">"`
and `PartnerMoodView.tsx:497` is
`"                          className=\"flex items-center gap-1 rounded-lg bg-green-500 px-3 py-2 font-medium text-white transition-colors hover:bg-green-600\""`.

**DW-105's restored severity is the source value.**
`_bmad-output/specs/spec-security-remediation/stories/8-separate-profile-names-from-auth-identity.md:37`
is `"    severity: medium (unverified)"`, sitting under `location: >-` /
`"      src/components/DisplayNameSetup/DisplayNameSetup.tsx (zero-row branch)"` at `:35-36`. The
ledger now carries it at `deferred-work.md:1071`. The resolution's own citation of `:37` is exact.

**DW-121's supersession holds.** `grep -rn "\.moods && .*\.moods\.length" src/` returns nothing
(exit 1). `src/services/moodSyncPayload.ts:57` is
`"  const normalized = normalizeMoodValues(mood.mood, mood.moods);"`, imported at `:21`.
`src/types/moods.ts:29` is `"  const valid = Array.isArray(moods) ? moods.filter(isMoodType) : [];"` —
the single array-shape decision, as claimed. `5dd934b0` is
`fix(mood): normalize mood values at every display and sync boundary`.

**The new header paragraph contradicts nothing I could find.** `deferred-work.md:3-11` assigns
`status:`/`resolution:` and appends to the closing run, and everything else — another entry's severity
or `location:` — to the orchestrator. This diff's edits all fall on the orchestrator side of that
line: DW-105's severity, and the `location:` repairs on DW-87, DW-91, DW-109, DW-110, DW-111, DW-113
and DW-114. The DW-116 reason it paraphrases ("closed two entries and appended six") is consistent with
its own recorded evidence at `:1173`.

**The E2E spec's remaining citations are verbatim.** `PartnerMoodView.tsx:206` is
`"          logger.info('[PartnerMoodView] Realtime status changed:', status);"`; `:194-196` is the
`setTimeout(…, 5000)` auto-hide; `:200` is `"          fetchPartnerMoods(30).catch((err) => {"`; `:579`
is `"                  data-testid=\"partner-mood-refresh-button\""`; `src/utils/logger.ts:10-12` is the
unconditional `console.info`; `src/api/ephemeralBroadcast.ts:77` is
`"const BROADCAST_TIMEOUT_MS = 15_000;"`; `20260726000000_moods_unique_user_created_at.sql:72` is
`"      add constraint moods_user_id_created_at_key unique (user_id, created_at);"`;
`playwright.config.ts:119` is `"  timeout: 60 * 1000, // Test timeout: 60s"`;
`tests/support/fixtures/together-mode.ts:165` is `"      await partnerContext.close().catch(() => {});"`.
All six `data-testid`s the spec locates exist in `src/`.

**The E2E spec's mechanism holds without running it.** I traced the three things that would make it
fail outright:
1. *The broadcast really is an HTTP POST.* `src/api/ephemeralBroadcast.ts:128` is
   `"    const result = await channel.httpSend(event, payload, { timeout: BROADCAST_TIMEOUT_MS });"`.
2. *The expected path and `private=true` are right.* `RealtimeChannel.js:448-452` builds
   `url.pathname += \`/${encodeURIComponent(this.subTopic)}/events/${encodeURIComponent(event)}\`` and
   sets `private=true` when the channel is private (`ephemeralBroadcast.ts:99` passes
   `{ config: { private: true } }`). I reproduced the URL in node: the spec's
   `` `${BROADCAST_PATH}${encodeURIComponent(`mood-updates:${partnerId}`)}/events/new_mood` `` is a
   substring of the built URL (`…/broadcast/mood-updates%3Aabc-123/events/new_mood?private=true`), and
   `searchParams.get('private')` is `'true'`.
3. *The toast actually contains the note.* `PartnerMoodView.tsx:361-363` renders
   `{notification.note && <p className="mt-1 line-clamp-2 text-sm text-pink-100">{notification.note}</p>}`,
   fed from `newMood.note` at `:190`. `line-clamp-2` is CSS-only and does not affect `textContent`, so
   `toContainText(moodNote)` is sound for the 57-character marker.
4. *`moodRowCommitted` is raised at the right moment.* `moodSyncService.ts:229-234` fires
   `broadcastMoodToPartner` only after `syncedMood` resolves, so observing the POST does imply the row
   is committed.

**Worker-pool rules, re-checked line by line.** The spec performs exactly one write against shared
state — the `moods` DELETE at `:201-206` — double-filtered on the test's own uuid and on
`[userId, partnerId]` from `resolveOwnPair`. No `partner_id` UPDATE, no password reset, no nulled
shared row, no `auth.users` touch. `resolveOwnPair` keys on `getWorkerPairEmails()` →
`TEST_WORKER_INDEX`, not `TEST_PARALLEL_INDEX`. Fixtures come from
`tests/support/merged-fixtures.ts:43`, not `@playwright/test` (the `@playwright/test` import at `:40`
is `import type`, which is fine). The `[P1]` tag routes correctly —
`package.json:29` is `"test:p1": "playwright test --grep '\\[P0\\]|\\[P1\\]'"` — and
`tests/e2e/partner/` falls under the `chromium` project's `testDir: './tests/e2e'`.

**Privacy.** `git diff 3f0d951b -- _bmad-output/` contains no email address (grep for an address
pattern returns nothing). The only `@example.com` strings are four fixtures in
`tests/unit/api/partnerServiceDisplayName.test.ts`, which is source, not `_bmad-output/`.

---

## Notes on flakiness (E2E), below the finding bar

Every substantive wait is explicitly bounded: `:129` (`timeout: 30_000` on the SUBSCRIBED console
event) and `:165` (`timeout: 30_000` on the broadcast response, deliberately not the 15s
`actionTimeout` that equals `BROADCAST_TIMEOUT_MS`). The 180s describe-level budget at `:71` clears the
sequential worst case. Two wrinkles I looked at and am not raising:

- `:141` `await partnerPage.waitForLoadState('networkidle');` carries no explicit timeout, so it
  inherits `navigationTimeout: 30_000` (`playwright.config.ts:130`) rather than being "bounded on its
  own" as `:67` claims. The report still names it on failure, so the stated purpose is met. `networkidle`
  with a live Realtime WebSocket is the classic flake source, but the subscription has already
  succeeded by that line, so it is observing an already-settled page.
- `:151` `page.getByRole('button', { name: /happy/i }).click()` is the one locator in the file that is
  not a testid, and `src/components/MoodTracker/MoodButton.tsx:37` already exposes
  `data-testid={\`mood-button-${mood}\`}`. Strict mode is safe today — of the twelve labels in
  `MoodTracker.tsx:41-56` only `Happy` contains the substring — but `getByTestId('mood-button-happy')`
  is both the repo idiom and immune to a future label like "Unhappy".

## What I could not rule out

- DW-123's `"Verified non-vacuous: with the sender untouched and the receiver listening for a different
  event name, the send still answers 202 and the delivery assertion fails."` — I was instructed not to
  run Playwright, so this remains the author's claim. Everything it depends on (the 202 path, the
  topic/event composition, the toast content) I verified statically above, and the mutation described
  is plausible, but I did not execute it.
- DW-109's, DW-110's and DW-112's SDK-internal citations (`@supabase/phoenix` `channel.js`,
  `RealtimeChannel.js`, `RealtimeClient.js`) are another reviewer's lane; I spot-checked only
  `RealtimeChannel.js:435-465` (`httpSend`) and `:448-452`, both of which matched.
- The contrast enumeration relies on the test's own extractor. The working-tree rewrite closed most of
  C-2's blind spots, but C-2a's (a literal left open on the line) remains, and a pairing split across
  two literals is documented as out of scope — so there may still be below-floor pairings neither the
  guard nor I counted.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` was being edited while I reviewed it. My C-2a, C-9 and
  C-10 findings describe the file as it stood at the end of my session; re-check them against whatever
  is actually committed.
- I did not evaluate coverage thresholds or `test.yml` path gating for this diff; the change touches
  `src/` broadly, so the `e2e` and `app` gates will both be true.
