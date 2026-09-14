---
title: 'DW-89: Array.isArray guards at the four remaining mood sites'
type: 'refactor'
created: '2026-09-14'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      An eighth site, src/services/moodSyncPayload.ts:58, reads MoodEntry.moods with the same
      bare truthy-plus-length idiom and was left unguarded.
    evidence: |-
      `const moodTypes = mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood];` reads the
      same field as the seven converted sites. Its output is both the sync request body
      (src/api/moodSyncService.ts:197, src/sw.ts:169) and the change-detection fingerprint
      (moodSyncPayload.ts:85-86), so a truthy non-array would be sent to the server verbatim.
      Pre-existing and outside this bundle's four named sites: it feeds a payload, not a
      MOOD_CONFIG deref. No local writer can produce a non-array today -- addMoodEntry takes
      MoodType[] (moodSlice.ts:38). Every existing test feeds it a real array or undefined.
    location: >-
      src/services/moodSyncPayload.ts:58
    severity: low
  - summary: >-
      The guard tests the container, not the elements: a genuine MoodType[] holding an unknown
      mood string still throws at every one of the seven sites.
    evidence: |-
      MoodDetailModal.tsx:152-157 runs `MOOD_CONFIG[m].icon` per element, CalendarDay.tsx:103 runs
      `MOOD_CONFIG[primaryMood].bgColor`, and MoodTracker.tsx renders
      `selectedMoods.map((m) => MOOD_CONFIG[m].label)`. Array.isArray says nothing about element
      validity. The Supabase path is protected by MoodTypeSchema, but the IndexedDB path that feeds
      these three components applies no schema. Pre-existing and identical at the three sites that
      adopted the guard earlier, so not caused by this change. What would settle reachability: whether
      a stored IndexedDB row can hold a mood string outside the MOOD_CONFIG keys -- for example a
      retired mood key left behind by an older app version.
    location: >-
      src/components/MoodHistory/MoodDetailModal.tsx:152, src/components/MoodHistory/CalendarDay.tsx:103
    severity: medium
  - summary: >-
      The offline-first IndexedDB read path normalizes nothing, so the three components that read it
      each carry their own per-consumer guard instead.
    evidence: |-
      moodSlice.loadMoods (moodSlice.ts:160-171) calls moodService.getAllForUser
      (src/services/moodService.ts:255-264), which filters by userId and returns raw rows with no
      shape check, and the same is true of getMoodsInRange as called from
      MoodHistoryCalendar.tsx:81. The Supabase side is normalized at its boundary; the larger path is
      not. Deferred rather than fixed because the intent scoped this bundle to four named consumer
      sites and framed the work as defensive hardening at those sites.
    location: >-
      src/services/moodService.ts:255
    severity: low
  - summary: >-
      DW-117 dismisses itself with an argument DW-119 contradicts: moodSyncPayload is fed from the
      unvalidated IndexedDB path, not from addMoodEntry, so its real exposure is higher than filed.
    evidence: |-
      DW-117 argues "No local writer can produce a non-array today -- addMoodEntry takes MoodType[]".
      That reasons about the writer's signature, but the read path is IndexedDB:
      src/api/moodSyncService.ts:337 `const unsyncedMoods = await moodService.getUnsyncedMoods(currentUserId);`
      feeds :186 `const moodInsert: MoodInsert = moodSyncPayload(mood, mood.userId);`. That is the same
      path DW-119 says normalizes nothing. Either the IndexedDB path can hold a non-array -- in which
      case moodSyncPayload ships it into the request body and the change fingerprint, a worse outcome
      than a render crash -- or it cannot, in which case the four guards this bundle added are equally
      unreachable. The two entries argue from mutually exclusive premises. Secondary: the cited
      signature is at moodSlice.ts:39, not :38 (:38 is the comment `// Actions`), and reads
      `MoodEntry['mood'][]`. Not fixed here: the intent forbids touching moodSyncPayload.ts:58, and
      this run is directed not to edit the ledger.
    location: >-
      src/services/moodSyncPayload.ts:58, src/api/moodSyncService.ts:337
    severity: medium
  - summary: >-
      Nothing pins the Array.isArray idiom, so the consistency this bundle bought decays on the next
      PR that copies the surviving truthy form.
    evidence: |-
      The change's only stated value is that "a reader copying the idiom can no longer copy the wrong
      one", but the wrong one is still in the tree: src/services/moodSyncPayload.ts:58 reads
      `const moodTypes = mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood];`. No lint rule,
      no-restricted-syntax entry, or grep-based test enforces the invariant. Not fixed here: any
      enforcement is config surface beyond the intent's "one-expression shape guard per site", and the
      rule would immediately flag the one line the intent forbids touching.
    location: >-
      eslint.config.js, src/services/moodSyncPayload.ts:58
    severity: low
  - summary: >-
      Seven hand-rolled copies of one expression and four separate MOOD_CONFIG definitions mean
      DW-118's element validation would need four key sets rather than one.
    evidence: |-
      All seven guarded sites hand-roll `Array.isArray(x) && x.length > 0 ? x : [fallback]`:
      moodSlice.ts:394, CalendarDay.tsx:79, MoodDetailModal.tsx:97, PartnerMoodView.tsx:673,
      PartnerMoodDisplay.tsx:112, MoodTracker.tsx:177, MoodHistoryItem.tsx:44. MOOD_CONFIG is itself
      defined four times -- MoodDetailModal.tsx:27, CalendarDay.tsx:23, PartnerMoodView.tsx:35,
      MoodTracker.tsx:57 (measured with grep). A single normalizeMoods() would collapse the expression
      and turn DW-118 into a one-line change. Not fixed here: the intent scopes this to a one-expression
      shape guard per site and forbids type-level changes, so extracting a shared normalizer is a
      different piece of work.
    location: >-
      src/components/MoodHistory/CalendarDay.tsx:23, src/components/MoodTracker/MoodTracker.tsx:57
    severity: low
baseline_revision: '45041a4f623c7c0f6aa6c471528d13ea11ca8b49'
---

<intent-contract>

## Intent

**Problem:** Three mood sites were hardened to `Array.isArray(x) && x.length > 0` before an unconditional `MOOD_CONFIG[allMoods[0]]` deref; four siblings sharing the identical idiom still use the bare `x && x.length > 0`, which cannot tell an array from a truthy string, so a string `moods` is indexed character-by-character and the lookup yields `undefined` whose `.icon` / `.bgColor` / `.label` throws and takes the view down.

**Approach:** Replace the truthy check with `Array.isArray(...) && ....length > 0` at the four sites, each carrying the short rationale comment the adopted sites already carry, and extend `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` so each newly guarded site has a non-array case pinned alongside a well-shaped multi-mood case.

## Boundaries & Constraints

**Always:** Behaviour for well-shaped data is unchanged — a real `MoodType[]` still takes the array branch and a `null`/`undefined`/`[]` still takes the legacy single-mood fallback. Each changed line keeps its existing fallback expression exactly as written; only the shape test in front of it changes. Every guard gets a comment in the shape of `src/components/PartnerMoodView/PartnerMoodView.tsx:669-672`, naming the concrete deref it protects. New tests are anchored on `moodArrayGuards.test.tsx` and must not disturb the two describe blocks already there; a case whose file-level mocks would change what those two render goes in a sibling file instead.

**Never:** Do not touch `src/services/moodSyncPayload.ts:58` — it shares the idiom but is outside this bundle's four named sites and feeds a sync payload, not a `MOOD_CONFIG` deref. Do not add runtime validation, schema parsing, error boundaries, logging or type-level changes; this is a one-expression shape guard per site. Do not edit the deferred-work ledger. Do not widen `MoodEntry['moods']` or any DB type.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Genuine multi-mood array | `moods: ['happy','tired']` | Array branch taken; both moods render/propagate | No error expected |
| Legacy null/absent | `moods: null` or `undefined` | Fallback to `[mood]` / `[mood_type]` | No error expected |
| Empty array | `moods: []` | Fallback to the single mood | No error expected |
| Non-array string | `moods: 'happy'` | Fallback to the single mood; no character-wise indexing | Render must not throw |
| Non-array number | `moods: 7` | Fallback to the single mood | Render must not throw |

</intent-contract>

## Code Map

- `src/components/PartnerMoodView/PartnerMoodView.tsx:669-673` -- read-only reference. The exact guard shape and comment style to copy; do not modify.
- `src/components/MoodTracker/MoodHistoryItem.tsx:40-46` and `src/components/MoodTracker/PartnerMoodDisplay.tsx:107-114` -- read-only reference. The other two adopted sites, already covered by the test file.
- `src/stores/slices/moodSlice.ts:382-386` -- site 1. Inside `fetchPartnerMoods` (declared :356); `record.mood_types && record.mood_types.length > 0 ? record.mood_types : [record.mood_type]` builds `MoodEntry.moods` for `partnerMoods` state. No `MOOD_CONFIG` deref here — a non-array leaks into store state and the downstream `MoodCard` only survives it because that site is already guarded. Guard normalizes at the boundary.
- `src/components/MoodHistory/MoodDetailModal.tsx:90-91` -- site 2. `MoodDetailContent` (:79). Deref at `:93` `MOOD_CONFIG[allMoods[0]]` then `primaryMoodConfig.color` at `:161`; also `allMoods.map` at `:147` and `:163`. Assertion target: `data-testid="modal-mood-type"` (:163) holds the joined labels. The public wrapper `MoodDetailModal` (:203) renders `MoodDetailContent` only when `mood` is truthy.
- `src/components/MoodHistory/CalendarDay.tsx:71-76` -- site 3. `primaryMood = allMoods.length > 0 ? allMoods[0] : undefined` (:79); first deref is `MOOD_CONFIG[primaryMood].bgColor` at `:103` inside `dayClasses`, before render; also `:136`, `:139`, and `allMoods.join` in the `aria-label` at `:115`. Assertion target: the `aria-label` on `data-testid={`calendar-day-${dateKey}`}` (:112). Guard must keep the existing three-way `hasMood` ternary intact.
- `src/components/MoodTracker/MoodTracker.tsx:169-174` -- site 4. Inside the render-phase seeding block gated on `moods !== seededFrom` (:162); `setSelectedMoods(existingMood.moods)` puts a non-array into `selectedMoods`, and `selectedMoods.map((m) => MOOD_CONFIG[m].label)` at `:504` (guarded only by `.length > 0` at `:502`) throws `selectedMoods.map is not a function`. `existingMood` comes from `getMoodForDate(today)` (:167).
- `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` -- the file to extend. Existing `moodRecord()` helper (:29) and the deliberate `as` cast with its comment (:34-36) are the established pattern for feeding a lying value. Existing describes at `:48` and `:68`.
- `src/components/MoodTracker/__tests__/MoodTracker.syncBadge.test.tsx:26-66` -- read-only reference. Working mock set for rendering `MoodTracker`: `storeState` object + `useAppStore` selector-aware mock, `useAuth`, `../../../api/supabaseClient` (`getPartnerId` resolving `null`, which keeps `PartnerMoodDisplay` at `MoodTracker.tsx:382` unmounted), `../../../utils/backgroundSync`.
- `src/components/MoodHistory/__tests__/MoodDetailModal.focus.test.tsx:20-26` -- read-only reference. The `framer-motion` mock shape (`m.div`, `AnimatePresence`) these components need under happy-dom.
- `tests/unit/stores/moodSlice.test.ts:36-55, 423-492` -- read-only reference. `createTestStore()` harness and the existing `fetchPartnerMoods` cases showing how `moodSyncService.fetchMoods` is stubbed with `as never`.
- `src/types/index.ts:87` -- `moods?: MoodType[]`, so `Array.isArray(x)` narrows without a cast at the three `MoodEntry` sites. `record.mood_types` in `moodSlice` is the DB row type; follow whatever the existing expression already does about casts.

## Tasks & Acceptance

**Execution:**
- `src/stores/slices/moodSlice.ts` -- change the `:384` condition to `Array.isArray(record.mood_types) && record.mood_types.length > 0`, and replace the `:382` comment with one naming why the shape test is needed -- a non-array reaches `partnerMoods` state and every consumer must then defend itself.
- `src/components/MoodHistory/MoodDetailModal.tsx` -- change the `:91` condition to `Array.isArray(mood.moods) && mood.moods.length > 0`, extending the `:90` comment to name the unconditional `MOOD_CONFIG[allMoods[0]]` at `:93`.
- `src/components/MoodHistory/CalendarDay.tsx` -- change the `:72` condition to `hasMood && Array.isArray(mood.moods) && mood.moods.length > 0`, keeping the three-way `hasMood` ternary and its `[]` branch, and extend the `:70` comment to name the `MOOD_CONFIG[primaryMood].bgColor` deref at `:103`.
- `src/components/MoodTracker/MoodTracker.tsx` -- change the `:170` condition to `Array.isArray(existingMood.moods) && existingMood.moods.length > 0`, with a comment naming `selectedMoods.map` at `:504` as what a non-array breaks.
- `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` -- add one describe per newly guarded site covering the matrix rows, leaving the two existing describes untouched. Extend the file's header block to say the file now covers all seven sites and that these four read the offline-first IndexedDB path rather than a broadcast. Reuse the `MoodTracker.syncBadge` mock set for the `MoodTracker` case and the `framer-motion` mock for the two `MoodHistory` components; the store-slice case drives `fetchPartnerMoods` through a store built the way `tests/unit/stores/moodSlice.test.ts` builds one. If a file-level `vi.mock` needed by one describe would change what the existing two describes render, put that case in its own new test file next to this one instead and say so in both files' headers.

**Acceptance Criteria:**
- Given a `MoodEntry` whose `moods` is the string `'happy'`, when `MoodDetailModal` renders it, then it does not throw and `modal-mood-type` reads the single-mood label rather than per-character labels.
- Given a `MoodEntry` whose `moods` is the string `'happy'`, when `CalendarDay` renders it with `mood` set, then it does not throw and the cell's `aria-label` names one mood.
- Given `getMoodForDate` returns an entry whose `moods` is the string `'happy'`, when `MoodTracker` renders, then it does not throw and the "Selected:" line names the single mood.
- Given `moodSyncService.fetchMoods` resolves a record whose `mood_types` is the string `'happy'`, when `fetchPartnerMoods` runs, then `partnerMoods[0].moods` equals `['happy']`.
- Given well-shaped input at each of the four sites, when it renders or runs, then the multi-mood output is identical to before this change.
- Given the whole change, when `npm run lint`, `npm run typecheck` and `npm run test:unit` run, then all three pass and no pre-existing test changes its result.

## Spec Change Log

## Review Triage Log

### 2026-09-14 — Review pass
- verdicts: 26 findings — high 0, medium 8, low 15, false 3, maybe-false 0
- findings:
  - `[low]` `[patch]` Only the string rows go red pre-fix; number/empty/absent/multi-mood rows pass with and without the guard — true, measured: `(7).length` is undefined so `7 && undefined > 0` is false and the old code already fell back. The rows are honest regression coverage, not reproductions; the header now says so and the missing reproduction row was added under the next finding.
  - `[medium]` `[patch]` All four new describes dropped the array-like-object row that both pre-existing guard files pin — confirmed at `src/components/PartnerMoodView/__tests__/MoodCard.moodArray.test.tsx:37` and the original `moodArrayGuards.test.tsx:52`. `{0:'happy',length:1}` is the row that most needs `Array.isArray`: truthy, has a length, and indexes to a valid mood. Fix: added to all four new describes via a shared `NON_ARRAY_ROWS`; red-then-green re-measured at 8 failures pre-fix instead of 4.
  - `[low]` `[patch]` Three inline test comments asserted a pre-fix throw above `it.each` blocks that also cover the number row — true. Fix: each claim now names the rows it holds for.
  - `[low]` `[patch]` Two new source comments stated a false mechanism (`MoodDetailModal`'s "a number yields undefined ... `primaryMoodConfig.color` throws"; `MoodTracker`'s unqualified "a non-array ... throws") — true. Fix: all four comments rewritten from measured throws; the implementer's measurement also corrected `MoodDetailModal` to `allMoods.map` (the icon row evaluates before the title className, so `primaryMoodConfig` is never reached) and caught a fifth over-broad comment in `CalendarDay`.
  - `[low]` `[defer]` An eighth site, `src/services/moodSyncPayload.ts:58`, carries the identical idiom unguarded — true. The guard itself is outside the intent's four named sites and feeds a sync payload, not a `MOOD_CONFIG` deref, so it is pre-existing and deferred; the half of the claim this change caused (headers asserting a complete sweep) was patched.
  - `[low]` `[patch]` The "seven sites" accounting was wrong in both headers and the third guard test file went unmentioned — true: the file had four describes while claiming five, and `MoodCard.moodArray.test.tsx` covers the seventh site. Fix: header now states six of seven in this file, names the `MoodCard` file, and calls out `moodSyncPayload.ts:58`.
  - `[medium]` `[patch]` The new `MoodHistory` test file sat under `MoodTracker/__tests__/` while testing `MoodHistory/` components, though `src/components/MoodHistory/__tests__/` already exists — true, and it dissolved with the merge below: all six describes now live in the single file the intent named.
  - `[low]` `[patch]` `createTestStore` was copied verbatim with dead parts — true: `extraState` was never passed and the returned `set` never destructured. Fix: both removed.
  - `[low]` `[reject]` Two new `fetchPartnerMoods` cases duplicate `tests/unit/stores/moodSlice.test.ts:424-444` and `:474-492` — true, but rejected: those rows are the per-site legacy-and-well-shaped coverage the intent's "must not change behaviour for well-shaped data" calls for, and deleting them would drop I/O-matrix rows. Duplication across files is negligible harm.
  - `[low]` `[patch]` The copied harness lost the `afterEach` its source pairs with (`moodSlice.test.ts:84-86`), leaving `navigator.onLine` redefined and `getMoodForDate`'s return value unrestored — true. Fix: per-describe cleanup added; the implementer correctly noted `restoreAllMocks()` alone is insufficient in Vitest 4 and added an explicit `onLine` reset plus `mockReset()`.
  - `[low]` `[defer]` Boundary normalization is argued at the Supabase path but not applied at the symmetric IndexedDB path (`moodService.getAllForUser`, `moodSlice.loadMoods`) — the asymmetry is real. The comment half was patched (it no longer generalizes); guarding the read path is outside the intent's four named sites, so deferred.
  - `[medium]` `[defer]` The guard tests the container, not the elements: a well-shaped `MoodType[]` holding an unknown mood string still throws, and the IndexedDB path is unvalidated — true and pre-existing, identical at the three already-adopted sites. Deferred; element validation is a different defect from array shape and the intent scoped this to shape.
  - `[low]` `[patch]` The `moodEntry()` helper was duplicated across the two test files with divergent `userId` fixtures — true; collapsed into one shared helper by the merge.
  - `[medium]` `[defer]` `CalendarDay`: a genuine array whose first element is not a `MOOD_CONFIG` key throws at `MOOD_CONFIG[primaryMood].bgColor` — true, pre-existing, same root cause as the container-vs-elements entry above.
  - `[medium]` `[defer]` `MoodDetailModal`: an unknown mood string in the array, or an unknown `mood.mood`, throws at the icon row and title — true, pre-existing, same root cause.
  - `[medium]` `[defer]` `MoodTracker`: an unknown mood in the seeded array throws at `selectedMoods.map((m) => MOOD_CONFIG[m].label)` — true, pre-existing, same root cause.
  - `[false]` `[reject]` "The moodSlice guard is unreachable in production, so the reader trusts a guard that never fires" — the unreachability is true and I confirmed it (`moodApi.ts:156` parses `MoodArraySchema`; `supabaseSchemas.ts:115` types `mood_types` as `z.array(...)`), but it does not make the change defective: the ledger stated that same fact and the intent ordered defensive hardening anyway. The comment that overstated it was patched.
  - `[low]` `[patch]` Test-file headers overstate the sweep given `moodSyncPayload.ts:58` — true; corrected in the header rewrite.
  - `[low]` `[defer]` Missing-adoption gap: `moodSyncFields` at `moodSyncPayload.ts:58` shares the expression on the same field and feeds the request body and change-detection fingerprint, and no test feeds it a truthy non-array — filed pre-verified, with `defer` as the layer's own disposition. Deferred for the guard; the docs half was patched.
  - `[low]` `[patch]` Both new headers claimed a complete sweep — true; corrected.
  - `[medium]` `[patch]` The stated reason for splitting the test file is unsupported by the code it names — confirmed by measurement, not argument: I built the merged arrangement and ran it, 28/28 passing including the `PartnerMoodDisplay` describe, because the mock spreads `data-testid`/`role`/`aria-label`/children through. Fix: the sibling file was merged into `moodArrayGuards.test.tsx` and deleted, which also satisfies the intent's literal "extend that file".
  - `[false]` `[reject]` "The ledger's question — does the IndexedDB read path need the same guard — was answered by assertion rather than examination" — the intent itself answered it: it names four consumer sites, states the four read the offline-first IndexedDB path, and calls the work defensive hardening. The decision was made upstream of this build, not skipped by it.
  - `[false]` `[reject]` "MoodTracker is guarded upstream at the seed rather than at the `:502` deref the intent pointed at" — no bad outcome: `selectedMoods` is `useState<MoodType[]>([])` and its only other writer is the functional `setSelectedMoods((prev) => ...)`, so guarding the seed fully protects the deref. The auditor reached the same conclusion.
  - `[medium]` `[patch]` Test location diverges from the intent's single named file — true, and fixed by the merge rather than by argument.
  - `[low]` `[patch]` The moodSlice case pins a state its own production path forbids — true; the guard stays (the intent ordered it) and the comment now says so explicitly, citing `moodApi.ts:156` and `supabaseSchemas.ts:115`.
  - `[low]` `[reject]` The spec's Verification line predicts "only the four source files and the test file(s)" while the diff also carries the spec file — true but rejected: the fix would edit this build's spec, and the spec file is workflow output, not a code change.

## Design Notes

The guard shape, verbatim from `src/components/PartnerMoodView/PartnerMoodView.tsx:669-673`:

```ts
// Read moods array, fall back to [mood] for legacy entries.
//
// Array.isArray, not a truthy check. `MOOD_CONFIG[allMoods[0]]` below is
// dereferenced unconditionally, so a non-array `moods` took the whole view
// down: a string yields a single character, a number yields undefined, and
// either way `primaryConfig.icon` throws.
const allMoods = Array.isArray(moodEntry.moods) && moodEntry.moods.length > 0 ? moodEntry.moods : [mood];
```

Why this is defensive rather than a live bug fix: no Realtime broadcast reaches these four. `moodSlice.fetchPartnerMoods` consumes `moodSyncService.fetchMoods` output, and the `MoodHistory` pair plus `MoodTracker` read the offline-first IndexedDB path. The value in fixing them is that the idiom is now inconsistent across seven sites that look identical, which is how the next reader copies the wrong one.

## Verification

**Commands:**
- `npm run test:unit -- src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` -- expected: all cases pass, including the two pre-existing describes.
- `npm run test:unit -- tests/unit/stores/moodSlice.test.ts` -- expected: the existing `fetchPartnerMoods` suite still passes unchanged.
- `npm run test:unit` -- expected: exit 0, no new failures anywhere.
- `npm run typecheck` -- expected: exit 0.
- `npm run lint` -- expected: exit 0.
- `git diff --stat` -- expected: only the four source files and the test file(s) named above.

### 2026-09-14 — Review pass (follow-up)
- verdicts: 35 findings — high 0, medium 7, low 24, false 4, maybe-false 0
- findings:
  - `[low]` `[reject]` DW-89 is closed while DW-119 re-defers the very question DW-89's `reason` says must be settled, and neither entry points at the other — true, read both. Rejected: the fix edits the deferred-work ledger, which this run is directed not to modify; recorded here so the orchestrator can cross-reference them.
  - `[medium]` `[defer]` DW-117 dismisses itself with an argument DW-119 contradicts in the same diff — verified: `moodSyncService.ts:337` `getUnsyncedMoods(currentUserId)` feeds `:186` `moodSyncPayload(mood, mood.userId)`, so the payload builder reads the unvalidated IndexedDB path, not `addMoodEntry`'s argument. The two entries argue from mutually exclusive premises. Deferred as a new entry: the intent forbids touching `moodSyncPayload.ts:58`.
  - `[low]` `[defer]` The "no local writer" argument rests on a compile-time signature inside a bundle built on the premise that types lie (`moodArrayGuards.test.tsx:178-179`) — true; grouped with the entry above, same root cause.
  - `[low]` `[reject]` DW-118's citations are pre-change coordinates — confirmed: `MOOD_CONFIG[primaryMood].bgColor` is now `CalendarDay.tsx:110` (the diff inserted 7 comment lines above it), not `:103`. Rejected: the fix edits the orchestrator-owned ledger; the correction is recorded here and under Residual risks.
  - `[low]` `[reject]` DW-117 cites `moodSlice.ts:38` for `addMoodEntry` — confirmed wrong: `:38` is `  // Actions` and the signature at `:39` reads `MoodEntry['mood'][]`. Rejected for the same reason; folded into the deferred entry's evidence instead.
  - `[low]` `[reject]` DW-118's `location:` omits `MoodTracker`, which its own reason text names — true. Rejected: ledger edit.
  - `[low]` `[reject]` DW-117's "reads the same field as the seven converted sites" is wrong twice (four were converted, three already adopted; only three of seven read `mood_types`) — true. Rejected: ledger edit.
  - `[low]` `[reject]` The spec's `Never: Do not edit the deferred-work ledger` sits in the same commit as ledger mutations — true of the commit, but the ledger hunk is the orchestrator's own harvest of this spec's `deferred:` block, not a write by this build. Rejected: not this run's edit to undo, and reverting it is explicitly out of bounds.
  - `[false]` `[reject]` Frontmatter disagrees with the body (`review_loop_iteration: 0`, `status: in-review` above a completed pass) — not a defect: step-01 resets the counter to 0 for a follow-up pass and step-04 sets `in-review` while the pass runs, then `done`. Both were mid-run states, observed by the reviewer in flight.
  - `[false]` `[reject]` `## Spec Change Log` is an empty heading — correct as empty: the workflow writes that section only on a `bad_spec` loopback, and no pass has had one.
  - `[low]` `[reject]` The I/O matrix and all six acceptance criteria never gained the array-like-object row that the shipped header calls decisive — true. Rejected: the matrix and the ACs both sit inside `<intent-contract>`, which review may not amend, and the coverage itself is in place.
  - `[low]` `[reject]` The prior triage log's "28/28" is stale and `## Verification` records no observed result — the count is indeed stale (33 now). Rejected: the fix edits this build's spec's own log; observed results for every command are recorded under `## Auto Run Result` below.
  - `[medium]` `[patch]` `PartnerMoodDisplay`'s describe was the only mood-array guard describe in the repo without the array-like-object row, while the file header this change wrote claims "Each site gets the non-array rows pinned" — confirmed at `moodArrayGuards.test.tsx:223-227`. Fix: both pre-existing describes now consume `NON_ARRAY_ROWS`. Red-then-green re-measured: reverting `PartnerMoodDisplay.tsx:112` now reds 2 rows where it previously redded 1.
  - `[medium]` `[patch]` `NON_ARRAY_ROWS` was introduced as canonical and then applied to only four of six describes, leaving a duplicated inline list in `MoodHistoryItem` — true; same root cause as above, fixed by the same change, which deleted the duplicate.
  - `[low]` `[reject]` The `git diff --stat` verification line is false of the shipped commit — true, and carried from the prior pass's identical row. Rejected again: the fix edits this build's spec.
  - `[low]` `[defer]` Nothing pins the idiom — no lint rule or grep test, and `moodSyncPayload.ts:58` still carries the truthy form (verified verbatim) — true. Deferred: enforcement is config surface beyond the intent's "one-expression shape guard per site", and the rule would flag the one line the intent forbids touching.
  - `[low]` `[defer]` No shared normalizer — seven hand-rolled copies and four `MOOD_CONFIG` definitions (measured by grep: `MoodDetailModal.tsx:27`, `CalendarDay.tsx:23`, `PartnerMoodView.tsx:35`, `MoodTracker.tsx:57`) — true. Deferred: extraction is a different piece of work than a per-site shape guard.
  - `[low]` `[patch]` The `moodSlice` comment cites `moodApi.ts:156` and `supabaseSchemas.ts:115`; both are accurate today (verified verbatim) but nothing enforces them, and DW-118 in the same diff is already 7 lines stale — the drift is demonstrated, not hypothetical. Fix: the comment now names `MoodArraySchema` and `SupabaseMoodSchema` instead of line numbers.
  - `[medium]` `[defer]` `CalendarDay`: a mood value outside the `MOOD_CONFIG` keys reaches `MOOD_CONFIG[primaryMood].bgColor` and throws — carried: same location and claim as the prior pass's `[medium]` `[defer]` row, and the code still reads as that row describes. Already filed as DW-118.
  - `[low]` `[reject]` `CalendarDay`: an absent `mood.mood` on a truthy `mood` yields `allMoods = [undefined]`, so the cell reports `data-has-mood="true"` with no colour — measured false as stated: `:105` reads `hasMood && primaryMood ? MOOD_CONFIG[primaryMood].bgColor : 'bg-gray-50…'`, so `undefined` is caught by the truthiness test and degrades to grey rather than throwing. Rejected: `MoodEntry.mood` is a required `MoodType`, the residue is cosmetic, and the fix adds a filter.
  - `[medium]` `[defer]` `MoodDetailModal`: an element outside the `MOOD_CONFIG` keys throws at the icon row — carried from the prior pass's identical `[medium]` `[defer]` row; DW-118.
  - `[medium]` `[defer]` `MoodTracker`: a seeded element outside the `MOOD_CONFIG` keys throws at `selectedMoods.map` — carried from the prior pass's identical `[medium]` `[defer]` row; DW-118.
  - `[false]` `[reject]` `moodSlice`'s fallback `[record.mood_type]` is unchecked and could store `[null]` — disproved: `database.types.ts:197` types `mood_type` as `string`, not nullable, and the posited unvalidated caller was never shown to exist. Separately the intent's Always clause requires each fallback expression be kept "exactly as written".
  - `[low]` `[reject]` The ledger was edited against the spec's `Never` clause — duplicate of the row above; same disposition.
  - `[low]` `[reject]` The intent's stated mechanism (".icon / .bgColor / .label throws") holds at only one of four sites; three throw "map is not a function" first — true, and carried: the prior pass already rewrote all four source comments from measurement. Rejected now because the remaining half of the claim is about the intent's own prose.
  - `[false]` `[reject]` `MoodDetailModal`'s comment names `allMoods.map` rather than the `MOOD_CONFIG[allMoods[0]]` the spec's task line named — not a defect: the prior pass measured that the icon row evaluates before the title's className, so `primaryMoodConfig` is never reached. The comment is right and the task line is the stale half.
  - `[low]` `[reject]` The spec's task line says all four newly guarded sites "read the offline-first IndexedDB path", but `fetchPartnerMoods` reads Supabase — true of the spec; the shipped header already says "the three components read the offline-first IndexedDB path and `fetchPartnerMoods` transforms schema-validated `moodApi.fetchByUser` output". Rejected: the code is correct and the fix edits this build's spec.
  - `[low]` `[defer]` Missing-adoption gap: `moodSyncFields` at `moodSyncPayload.ts:58` still uses the truthy check on the same field and no test feeds it a non-array — pre-verified by the gap layer and carried from the prior pass's identical row; already filed as DW-117.
  - `[medium]` `[patch]` `PartnerMoodDisplay` is the only guard describe without the object row, leaving three divergent row lists for one concept — filed by the gap layer as an `Other finding`; same root cause as the patch above and fixed by it.
  - `[low]` `[defer]` The intent's expectations sit at the ingress surface while the tests inject at the consumer surface with every producer mocked — carried: this is the prior pass's `[low]` `[defer]` boundary-normalization row, already filed as DW-119.
  - `[low]` `[reject]` The `moodSlice` test mocks `moodSyncService.fetchMoods`, one layer below the validator that makes the guard unreachable — carried: the prior pass rendered this `false` and separately patched the comment to state the unreachability outright, which `moodSlice.ts:384-392` now does.
  - `[low]` `[reject]` The merged file's file-level `vi.mock('framer-motion')` now covers a pre-existing describe that previously rendered through the real library — true as a substrate change. Rejected: the gap layer measured that reverting `PartnerMoodDisplay.tsx:112` still reds its rows, so the regression power survives, and re-splitting the file was measured and rejected in the prior pass.
  - `[low]` `[reject]` The stated failure mechanism holds at one site of four — duplicate of the mechanism row above; same disposition.
  - `[low]` `[reject]` The diff never states which reading of "do not edit the ledger" it operates under — duplicate of the ledger row above; the ambiguity is already filed as DW-116 and belongs to the orchestrator.
  - `[low]` `[reject]` The intent's "three hardened + four remaining" arithmetic omits the eighth site its own `Never` names — true of the intent; carried, and the shipped header already reconciles the count and names `moodSyncPayload.ts:58` explicitly. Rejected: the fix edits `<intent-contract>`.

## Auto Run Result

Status: done

**Summary.** This was a follow-up review pass on an already-`done` spec; no new feature work. Four review layers filed 35 findings against the committed change. Two entries were patched, three new items were deferred, and the rest were rejected on verification. The four `Array.isArray` guards themselves were confirmed in place and unchanged.

**Files changed this pass.**
- `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` — both pre-existing describes (`MoodHistoryItem`, `PartnerMoodDisplay`) now consume the `NON_ARRAY_ROWS` constant this change introduced, which adds the array-like-object row to `PartnerMoodDisplay` and deletes a duplicated inline row list.
- `src/stores/slices/moodSlice.ts` — the guard comment now names `MoodArraySchema` and `SupabaseMoodSchema` instead of `moodApi.ts:156` / `supabaseSchemas.ts:115`.
- `_bmad-output/implementation-artifacts/spec-dw-89-mood-array-shape-guards.md` — this triage log, three appended `deferred:` entries, and this section.

**Review findings breakdown.** 35 findings — high 0, medium 7, low 24, false 4. Patched: 2 grouped entries (1 medium, 1 low). Deferred: 3 new entries — DW-117's reachability argument being contradicted by DW-119 (medium), the absence of any enforcement pinning the idiom (low), and the missing shared normalizer against four `MOOD_CONFIG` definitions (low). Five findings were carried unchanged from the prior pass (the three element-validity rows, the `moodSyncPayload` adoption gap, and the IndexedDB boundary row) and re-route to their existing DW-117/118/119 entries without being re-filed. Rejections, each with its recorded reason, are itemised row by row in the triage log above; the recurring reasons are that the fix would edit this build's own spec, that the fix would edit the orchestrator-owned deferred-work ledger, or that verification disproved the claim.

**Follow-up review recommended: false.** This was a follow-up pass and it patched no `high`, so by the workflow's convergence rule the work is done. Both patches were verified by measurement rather than argument.

**Verification performed.** All commands run from the worktree after the patches.
- `npx vitest run src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` — 33 passed (32 before this pass; the new row is the 33rd).
- Red-then-green for the new row: reverting `PartnerMoodDisplay.tsx:112` to the truthy form reds 2 rows where it previously redded 1. Guard restored and confirmed clean afterwards with `git diff --stat`.
- `npm run test:unit` — Test Files 91 passed (91), Tests 1704 passed (1704). No pre-existing test changed result.
- `npm run typecheck` (`tsc -b --force`) — exit 0.
- `npm run lint` — 0 errors; 3 pre-existing `react-refresh` warnings in `src/components/RelationshipTimers/EventCountdown.tsx`, untouched by this change.

**Residual risks.**
- DW-118's recorded coordinates are stale against the shipped tree: the deref it names is now `CalendarDay.tsx:110`, not `:103`, and `allMoods.map` is `MoodDetailModal.tsx:153`. DW-117 cites `moodSlice.ts:38` for a signature that lives at `:39` and reads `MoodEntry['mood'][]`. Both corrections are recorded here because this run may not edit the ledger.
- DW-117 and DW-119 still argue from mutually exclusive premises in the ledger; the newly deferred entry states the measured feed path (`moodSyncService.ts:337` → `:186`) that settles it, but the two ledger entries themselves are unchanged.
- The guard still validates the container, not its elements, at all seven sites — pre-existing, filed as DW-118.
