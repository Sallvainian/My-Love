# Review B — auth callback feedback, sign-in dead end, partner display name, contrast

Scope reviewed: `git diff 3f0d951b` over `src/api/supabaseClient.ts`,
`src/components/LoginScreen/LoginScreen.tsx`, `src/api/partnerService.ts`,
`src/components/Settings/AnniversarySettings.tsx`,
`src/components/PhotoGallery/PhotoViewer.tsx`,
`tests/unit/api/supabaseClientAuthFlow.test.ts`,
`tests/unit/components/LoginScreen.callbackNotice.test.tsx`,
`tests/unit/api/partnerServiceDisplayName.test.ts`,
`tests/unit/a11y/whiteOnColorContrast.test.ts`.
Ledger entries read whole: DW-124, DW-131, DW-132, DW-133, DW-134 (plus DW-104,
DW-130, DW-139, DW-140 for context).

Checks run: `npx vitest run` over the four test files — 4 files / 44 tests passed.
`npx tsc -b --force` — exit 0. `npm run lint` — clean. No Playwright run.
Numeric verification of the contrast maths and the scan regex was done in a
scratchpad script, not by editing any repo file.

---

## B1 — the new contrast guard is blind to the repo's dominant class idiom, and a live AA failure sits inside the blind spot

- **Severity:** medium · **Confidence:** high
- **DW:** DW-134 (the guard is the entry's substituted settle mechanism)
- **Files:** `tests/unit/a11y/whiteOnColorContrast.test.ts:160`, `:165`, `:192`;
  offender at `src/components/PhotoGallery/PhotoGridItem.tsx:100`
- **Introduced by this change** (the guard is new; the offender is pre-existing
  but the guard is asserted to catch exactly this class of thing)

**What I found.** The scan only recognises a class list written as a bare string
literal directly after `className=`:

`tests/unit/a11y/whiteOnColorContrast.test.ts:160` `"      for (const classAttr of text.matchAll(/className=["`]([^"`]*)["`]/g)) {"`

A class list written as a JSX expression — `` className={`… ${cond ? 'a' : 'b'}`} ``
or `className={'…'}` — never matches, because the character after `className=`
is `{`. That is how every conditional/enabled-disabled button in this repo is
written. Measured: `src/**/*.tsx` contains 130 `className={` occurrences against
1300 `className="`, and 28 files combine `className={` with `text-white`.

Re-running the file's own `findWhiteOnColourPairings()` beside a scan that also
looks inside expressions: the shipped scan finds **36** pairings, the wider scan
finds **52**. Sixteen pairings are invisible to the guard, and one of them is
currently below the floor:

`src/components/PhotoGallery/PhotoGridItem.tsx:100` `"            photo.isOwn ? 'bg-pink-600 text-white' : 'bg-blue-500/90 text-white'"`

`blue-500` computes from the installed palette to `#2b7fff`, **3.76:1** against
white — below the 4.5 floor, and the badge is `text-xs` (`PhotoGridItem.tsx:99`),
so the 3:1 large-text allowance does not apply. It is a worse ratio than the
3.82:1 that DW-134 itself was raised for, and the guard shipped green over it.

**Why it matters / underlying cause.** The file's header states the property it
claims to hold — `whiteOnColorContrast.test.ts:13-17` says every pairing in
`src/` is measured "so a NEW button below the floor fails without anyone having
to remember this rule … That is the difference between this and a test that
asserts two class strings". The "Scope, deliberately narrow" block at `:27-32`
discloses only the variant-prefix and `text-white` limits; it does not disclose
that half the class-authoring idiom in the repo is unreachable. A reader of
DW-134's resolution therefore believes in coverage that does not exist.

The canary at `:192` does not catch it — `expect(findWhiteOnColourPairings().length).toBeGreaterThan(10)`
passes at 36.

**Recommended resolution.** Match the class-bearing text rather than the
attribute: collect every single- or double-quoted or backticked string literal on
the line and test each for `text-white` + `bg-…` (the blind spot is per-string,
and `'bg-blue-500/90 text-white'` is itself one literal, so a per-literal scan
catches it). Then either fix `PhotoGridItem.tsx:100` or allowlist it with its
measured ratio and raise it as its own entry, the way `purple-500` and
`green-500` were.

**Test that demonstrates the fix.** Add a case asserting the scan sees a known
expression-form pairing — e.g. that
`findWhiteOnColourPairings()` contains an entry for
`src/components/PhotoGallery/PhotoGridItem.tsx` — and assert the total is at
least 50 rather than at least 10. Both fail against the current regex.

---

## B2 — the guard never reads the project's own palette, so the single worst white-on-colour pairing in the tree is skipped in silence

- **Severity:** medium · **Confidence:** high
- **DW:** DW-134
- **Files:** `tests/unit/a11y/whiteOnColorContrast.test.ts:77`, `:168`;
  offender at `src/components/love-notes/MessageInput.tsx:269`;
  palette at `tailwind.config.js:20-30`, loaded by `src/index.css:4`
- **Introduced by this change**

**What I found.** `readPalette()` reads one file:

`tests/unit/a11y/whiteOnColorContrast.test.ts:77` `"    const css = readFileSync(resolve(repoRoot, 'node_modules/tailwindcss/theme.css'), 'utf8');"`

and an unrecognised swatch is dropped without a word:

`tests/unit/a11y/whiteOnColorContrast.test.ts:168` `"          if (!colour) continue;"`

But this repo extends the palette in a v3-style config that `src/index.css:4`
(`"@config '../tailwind.config.js';"`) pulls in, adding `sunset`, `coral`,
`ocean`, `lavender` and a `rose` override (`tailwind.config.js:6-60`). The scan's
own output includes:

`src/components/love-notes/MessageInput.tsx:269` — `"bg-coral-500 … font-medium text-white …"`

`coral-500` is `#ffa07a` (`tailwind.config.js:26`), which is **1.99:1** against
white. That is the worst white-on-colour pairing in `src/` — worse than the
2.22:1 `green-500` this same change raised as DW-140 and called "the worst in
the tree" (`deferred-work.md`, DW-140 reason) — and it is the primary action of
the love-notes composer. The guard walks straight past it.

**Why it matters / underlying cause.** The header at `:19-22` says the palette is
read from node_modules "rather than hard-coded, so a Tailwind upgrade that moves
a swatch re-checks every pairing instead of leaving this green against stale
constants". The reasoning is right; the source is incomplete. The failure mode of
`if (!colour) continue` is silent under-reporting, which is exactly the property
the allowlist design at `:44-51` was written to avoid elsewhere in the same file.

There is a second, latent hazard from the same cause: `tailwind.config.js`
redefines `rose`, so a `bg-rose-<n>` + `text-white` pairing would be measured
against Tailwind's stock rose rather than the one that actually renders. No such
pairing exists in `src/` today, so this is latent only.

**Recommended resolution.** Merge `tailwind.config.js`'s `theme.extend.colors`
into the palette (config values win on a name collision, matching Tailwind's own
resolution order), and turn the silent skip into a failure: an unresolved swatch
should be reported, not dropped, since an undefined swatch is itself a defect.
Then fix or allowlist-and-raise `coral-500`.

**Test that demonstrates the fix.** `expect(palette.get('coral-500')).toBeDefined()`
and `expect(contrastAgainstWhite(palette.get('coral-500'))).toBeCloseTo(1.99, 1)`,
plus a case asserting that a `text-white` pairing on a swatch absent from every
palette source is reported rather than skipped. Both fail today.

---

## B3 — `getAuthCallbackOutcome` now breaks its own documented invariant: a non-null outcome can be returned while a session exists

- **Severity:** low · **Confidence:** high
- **DW:** DW-131
- **File / symbol:** `src/api/supabaseClient.ts:206`, `getAuthCallbackOutcome`
- **Introduced by this change**

**What I found.** The function's docblock states the rule:

`src/api/supabaseClient.ts:160-161` `" * A session present means the person is not on the login screen, so there is"` /
`" * nowhere to say it and nothing to say: that reads `null`."`

The old guard preserved that, because an errored load fell to `null` before the
session read. The new branch returns before any session read:

`src/api/supabaseClient.ts:206` `"  if (error) return returnedWithCode ? 'code-expired' : null;"`

The reachable shape is documented inside auth-js itself: `GoTrueClient.js:418-420`
— `"// Don't remove existing session on URL login failure."` / `"// A failed attempt (e.g. reused magic link) shouldn't invalidate a valid session."` /
`"return { error };"`. So a signed-in person who opens a reused or expired link
gets `initialize()` → non-null error, `?code=` in the URL, and a perfectly valid
stored session. `getAuthCallbackOutcome()` answers `'code-expired'`.

**Trigger.** Signed-in browser opens `<app>/?code=<already-redeemed>`.

**Why it matters.** Not user-visible today: `src/App.tsx:592` renders
`LoginScreen` only on `!session`, and `src/App.tsx:343-344` clears the outcome on
the session-bearing notification (`"hasSessionNotification = true;"` /
`"setCallbackOutcome(null);"`). The defence is at the caller and depends on
notification ordering, not on the classifier. Any future second caller of
`getAuthCallbackOutcome` — or a change to that ordering — inherits an outcome the
function's contract says it cannot produce. This is a contract/comment divergence,
not a shipped bug.

**Recommended resolution.** Either keep the session check on the error path
(`if (error) { if (!returnedWithCode) return null; const { data } = await supabase.auth.getSession(); return data.session ? null : 'code-expired'; }`),
or amend `:160-161` to say the session rule now holds only for the non-error
paths. The first is the smaller change and preserves the stated contract.

**Test that demonstrates the fix.** A case in
`tests/unit/api/supabaseClientAuthFlow.test.ts` built like the existing
"explains a code this browser started but could not exchange" case, but with a
valid session in storage, asserting `resolves.toBeNull()`. It fails today.

---

## B4 — the `code-expired` branch is wider than its own comment admits: it also catches failures that happen before any exchange

- **Severity:** low · **Confidence:** medium
- **DW:** DW-131
- **File:** `src/api/supabaseClient.ts:198-205` (comment), `:206` (branch)
- **Introduced by this change**

**What I found.** The comment bounds the branch to exchange failures:

`src/api/supabaseClient.ts:200-201` `"  // The name is narrower than the branch. Anything that makes the exchange fail"` /
`"  // lands here, a GoTrue 5xx included, and for those \"expired or already used\""`

I traced `initialize()`'s error sources. Beyond `_getSessionFromURL`
(`GoTrueClient.js:407-420`), `_initialize` has an outer catch that converts
anything thrown earlier into an error result — `GoTrueClient.js:443-445`
`"return this._returnResult({"` / `"    error: new errors_1.AuthUnknownError('Unexpected error during initialization', error),"`.
Everything from `parseParametersFromURL` (`:392`) through
`await this._isPKCECallback(params)` (`:396`) is inside that try, and
`_isPKCECallback` performs a storage read (`GoTrueClient.js:3363-3366`). A browser
where storage access throws — a locked-down private window, a blocked-cookies
context — produces a non-null error on a `?code=` load where **no exchange was
ever attempted**, and now reads `'code-expired'`.

I confirmed the neighbouring worry does *not* apply: `_recoverAndRefresh` swallows
everything it catches (`GoTrueClient.js:4168-4181` ends `"            return;"`),
so the `needs-original-browser` path cannot be stolen this way. That branch is
safe.

**Why it matters.** In the storage-denied case the copy "That sign-in link has
expired or was already used" is wrong in a way that costs the person the
recovery: nothing about the link is wrong, and signing in again below will fail
the same way. This is the one sub-case where the change's "the recovery is
identical whichever it was" argument does not hold.

**Recommended resolution.** Narrow the branch to the classes that actually mean a
failed exchange (`isAuthApiError(error) || isAuthPKCEGrantCodeExchangeError(error)`)
and let `AuthUnknownError` keep the old silent `null`, or widen the copy for the
unknown case. Low priority — the trigger is rare.

**Test that demonstrates the fix.** A case that makes the client's storage
adapter throw on read with `?code=` in the URL, asserting the outcome is not
`'code-expired'`.

---

## B5 — two stale citations of `GoTrueClient.js:960-962`

- **Severity:** low · **Confidence:** high
- **DW:** DW-132
- **Files:** `src/components/LoginScreen/LoginScreen.tsx:124`,
  `tests/unit/components/LoginScreen.callbackNotice.test.tsx` (the DW-132 case's
  header), and DW-132's own `resolution:` line in the ledger
- **Introduced by this change**

**What I found.** The reachability argument is **correct** — I verified it
independently at the installed `@supabase/auth-js@2.116.0`. `signInWithPassword`
has exactly the return paths claimed, and the null-session/null-error shape is
substituted away. But the line numbers point one branch too early:

`src/components/LoginScreen/LoginScreen.tsx:124` `"        // reach a caller (`GoTrueClient.js:960-962`), and all four of its"`

The installed file has at 960-962 the *error* return
(`"            if (error) {"` / `"                return this._returnResult({ data: { user: null, session: null }, error });"` / `"            }"`),
and the substitution at 963-966
(`"            else if (!data || !data.session || !data.user) {"` …
`"                const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();"`).

Separately, the `else` guard is defensible for a reason stronger than the one
given: the component does not call the SDK at all, it calls
`src/api/auth/actionService.ts:7` `signIn`, whose own catch at `:36-43` returns
`err as AuthError`. The SDK argument is one layer removed from the boundary the
`else` actually protects.

**Why it matters.** AGENTS.md and the user's global rules require citations that
quote the source; a line-number drift of three is the thing those rules exist to
prevent, and this citation is repeated in three places including the ledger a
future sweep reads.

**Recommended resolution.** Change all three to `GoTrueClient.js:963-966` and add
one clause noting `actionService.signIn` is the real boundary.

**Test that demonstrates the fix.** None — documentation accuracy.

---

## B6 — DW-133's closing claim overstates coverage: two more readers of the same column, in the same file, still resolve a seeded row to an address

- **Severity:** low · **Confidence:** high
- **DW:** DW-133
- **Files:** `src/api/partnerService.ts:155`, `:274`, rendered at
  `src/components/PartnerMoodView/PartnerMoodView.tsx:426`, `:461`, `:486`
- **Pre-existing; not introduced, and not claimed fixed by the code — but the
  ledger's resolution line reads as though it were**

**What I found.** The change to `getPartner` itself is correct. I checked the
predicate, the arguments and every consumer:

- `isSeedFallbackName(partnerRecord.display_name, partnerRecord.email)` passes the
  **row's own** email, which is what the predicate's docblock requires
  (`src/api/supabaseClient.ts:405-408`), and matches `getPartnerDisplayName`'s
  call at `src/api/supabaseClient.ts:463`.
- `email` is selected at `src/api/partnerService.ts:75` and is readable under the
  users SELECT policy, as `getPartnerDisplayName`'s comment records.
- Every consumer of `PartnerInfo.displayName` is a render site —
  `PartnerMoodView.tsx:536`, `:566`, `:629` and three frozen scripture
  containers. Nothing keys, matches or searches on it, so removing the email
  fallback breaks no caller.

But the ledger's resolution says "so the two readers of that column cannot
disagree again", and `partnerService` has two more:

`src/api/partnerService.ts:155` `"        displayName: user.display_name || user.email || 'Unknown',"`
`src/api/partnerService.ts:274` `"            displayName: user.display_name || user.email || 'Unknown',"`

Both feed the same component DW-133 named. At `PartnerMoodView.tsx:426-427` a
seeded search result prints the address as the name and again as the email on the
line below; `:461` and `:486` print it as the requester's name.

**Judgment.** For the search list this is arguably intentional — you search by
address, and `:461`/`:486` already fall back to the email explicitly. I am **not**
calling these bugs. The finding is that the ledger entry asserts a
one-predicate-for-all-readers property that three of five readers do not have, and
a later sweep reading that line will believe the column is settled.

**Recommended resolution.** Amend DW-133's resolution to say which readers were
unified (`getPartner` and `getPartnerDisplayName`) and which deliberately still
render the address (`searchUsers`, `getPendingRequests`), or raise the latter as
its own entry with the product decision attached.

**Test that demonstrates the fix.** If the decision is to unify: a case in
`tests/unit/api/partnerServiceDisplayName.test.ts` driving `searchUsers` with a
seeded row and asserting `displayName` is not the address. It fails today.

---

## B7 — the allowlist key drops a dimension, so a partly-fixed file can keep an entry alive

- **Severity:** low · **Confidence:** high
- **DW:** DW-134
- **File:** `tests/unit/a11y/whiteOnColorContrast.test.ts:198`, `:211`
- **Introduced by this change**

**What I found.** Both the offender filter and the honesty check key on
`file:swatch`:

`tests/unit/a11y/whiteOnColorContrast.test.ts:198` `"      .filter((pairing) => !KNOWN_BELOW_FLOOR.has(`${pairing.file}:${pairing.swatch}`))"`

`line` is carried on the `Pairing` (`:124`) and used only in the failure message
(`:199`). So if a file gains a second `purple-500` pairing, or one of two is
fixed and the other is not, both the offender filter and the "keeps the allowlist
honest" check at `:204-217` see a single key and stay green. The allowlist's
stated property — "Every recorded pairing must still be present and still be
failing; fix one and this turns red" (`:205-207`) — holds per file-and-swatch, not
per pairing.

Related, same file: the swatch pattern requires three digits —
`tests/unit/a11y/whiteOnColorContrast.test.ts:165` matches `bg-([a-z]+-\d{3})`, so
`bg-<colour>-50` can never be seen, and the negative lookbehind that correctly
rejects `hover:`/`dark:` also rejects responsive prefixes such as `sm:bg-…`, which
*are* resting states at their breakpoint. Neither has an instance in `src/` today;
both are latent.

**Recommended resolution.** Key on `file:line:swatch`, or count occurrences per
key and require the count to match. Widen the shade pattern to `\d{2,3}`.

**Test that demonstrates the fix.** A case asserting that two pairings of the same
swatch in one file produce two distinct allowlist keys.

---

## B8 — DW-124's new assertion is sound but pins a link into a route the app does not have

- **Severity:** low · **Confidence:** high · (observation, not a defect in the change)
- **DW:** DW-124
- **Files:** `tests/unit/api/supabaseClientAuthFlow.test.ts` (the
  password-reset case), `src/api/auth/actionService.ts:97`

**What I found.** The test is well built: it binds `BASE_URL` to the value read
from `vite.config.ts` via `loadConfigFromFile`, sets a URL deeper than the base so
an `href`-vs-`origin` slip would fail, captures `redirect_to` from the real recover
request, and compares against a hard-coded literal rather than restating the
template. It is capable of failing — dropping `BASE_URL` from `actionService.ts:97`
yields a different literal. `vi.unstubAllEnvs()` runs in the file's `afterEach`
(`:125`), so no env leak.

What it protects, though, is unreachable: `resetPassword` has no caller under
`src/components`, `src/stores` or `src/hooks` (only the `src/api/authService.ts:30`
re-export), and `reset-password` appears in none of the five places a view is
registered — it is absent from `pathMap` (`src/stores/slices/navigationSlice.ts:52-60`),
from both URL ternaries in `App.tsx`, from the `currentView` render chain and from
`DESTINATIONS`. A recovery link that landed there would strip to `/reset-password`,
match no arm, and render home.

**Why it matters.** DW-124 is legitimately closed — it asked for the composed link
to be asserted, and it now is. This note is so the next reader does not take the
green test as evidence that password recovery works end to end. Worth its own
ledger entry if password reset is meant to be a live feature.

---

## Assessed and found sound

Recorded so the absence of a finding is legible.

1. **`code-expired` cannot steal `cancelled` or `provider-error`.**
   `_isImplicitGrantCallback` (`GoTrueClient.js:3350-3355`) returns true for
   `params.error || params.error_description || params.error_code` from query *or*
   hash, so a provider-error redirect is classified `implicit` and hits the
   `isAuthImplicitGrantRedirectError` branch first. A URL carrying both `?code=`
   and an error parameter also takes the implicit branch. Precedence is correct.
2. **It cannot steal `needs-original-browser`.** That path runs
   `_recoverAndRefresh`, which swallows every error it catches
   (`GoTrueClient.js:4168-4181`), so `initialize()` answers `{ error: null }` and
   the new branch is not entered.
3. **Neither E2E spec is affected.**
   `tests/e2e/auth/implicit-fragment-rejection.spec.ts` navigates to a URL whose
   fragment carries `access_token`/`refresh_token`/`expires_in`/`token_type` and no
   `code`, so `returnedWithCode` is false and the load stays silent as pinned.
   `tests/e2e/auth/callback-messages.spec.ts` uses `/?code=not-for-this-browser`
   with no verifier, which still reaches `needs-original-browser`; its control case
   (`/`) still yields no notice. I did not run Playwright, per the brief; this is a
   read of the URLs against the traced classifier.
4. **The `else` in `handleSubmit` is genuinely unreachable through the installed
   SDK.** Verified at `@supabase/auth-js@2.116.0`: the only `error: null` return in
   `signInWithPassword` is `GoTrueClient.js:971-974`, guarded by the
   `!data.session` check at `:963`; `actionService.signIn` returns `error: null`
   only on that same path (`src/api/auth/actionService.ts:35`) and its catch always
   populates `error` (`:38-42`). Only the citation is off (B5).
5. **The `else` does not interact badly with surrounding state.**
   `setNoticeDismissed(true)` runs before the request (`LoginScreen.tsx:85`) and is
   unaffected; `setIsLoading(false)` is in `finally` (`:140`); the message goes
   through the same `setError` the error branch uses, rendered in the
   `role="alert"` region at `:194`, distinct from the `role="status"` notice at
   `:174`, so it cannot collide with a callback notice.
6. **The contrast class changes alter colour only.**
   `AnniversarySettings.tsx:207` keeps `transition-colors duration-200` and
   `PhotoViewer.tsx:671` keeps `transition`; both keep their `flex-1 rounded-lg
   px-4 py-2 text-white` and their sibling cancel buttons are untouched. Neither
   had a `disabled:` colour class before or after, so `PhotoViewer`'s
   `disabled={isDeleting}` behaves as it did. `red-700` is 6.42:1, so the new hover
   state is above the floor too. No unit or E2E spec asserts either button's
   classes — `src/components/Settings/__tests__/EventsSettings.test.tsx:1597` is the
   only `bg-red-500` assertion and targets a different button.
7. **The oklch→sRGB→contrast maths is correct.** I reimplemented it independently:
   the OKLab→LMS coefficients (`:95-97`), the LMS→linear-sRGB matrix (`:98-102`),
   the sRGB transfer function (`:105`), the WCAG luminance weights (`:113`) and
   `1.05 / (L + 0.05)` (`:118`) all match CSS Color 4 / WCAG 2. Reproduced from the
   installed `node_modules/tailwindcss/theme.css`: `red-500` `#fb2c36` 3.82:1,
   `red-600` `#e7000b` 4.76:1, `red-700` 6.42:1, `purple-500` `#ad46ff` 4.12:1,
   `green-500` `#00c950` 2.22:1, `green-600` 3.22:1, `green-700` 4.94:1 — every
   figure the change and DW-139/DW-140 record. The gamma-encode-then-decode round
   trip is redundant but not wrong; the clamp at `:104` makes it model
   gamut-clipping, which is what a browser does.
8. **The frozen-scripture exclusion is accurate for what the scan can see.**
   `FROZEN` removes exactly two pairings
   (`src/components/scripture-reading/reflection/DailyPrayerReport.tsx:115` and
   `:146`, both `purple-500`), matching the header's "its two `purple-500`
   pairings". The tree holds six more `purple-500` and three `purple-600` pairings
   under that directory, but all are in expression-form class lists and are
   invisible for the B1 reason, not the `FROZEN` reason.
9. **The new tests are capable of failing.** The DW-132 case would time out on
   `findByRole('alert')` without the `else`; the DW-133 table's seed rows all
   return the address under the old `||` chain; the reset-link case fails if
   `BASE_URL` is dropped from the template; the contrast suite's `offenders` array
   would contain `PhotoViewer.tsx:671` and `AnniversarySettings.tsx:207` at
   `bg-red-500` (3.82:1) — I confirmed both lines are inside the scan's output
   today. The "gives every outcome distinct copy" case fails on any duplicated
   string. The DW-133 test stubs the PostgREST chain rather than the function under
   test, so it asserts behaviour, not implementation.

## Not ruled out

- No browser ran. Everything about rendered contrast, the callback URLs and the
  login-screen notices is reasoned from source and from unit runs, not observed.
- `PhotoGridItem.tsx:100` uses `bg-blue-500/90` over a photograph; I measured the
  swatch at full opacity. The true composite ratio depends on the image beneath and
  could be better or worse than 3.76:1. It is below the floor at full opacity
  either way, which is the guard's own model.
- I did not audit the remaining 15 expression-form pairings the shipped scan
  misses beyond computing their swatch ratios; only `blue-500` fell below 4.5.
- DW-139 and DW-140's own figures were reproduced, but I did not re-verify the
  claim in DW-140 that darkening the ground reads acceptably next to the
  surrounding UI — that is a visual judgment.
