# Independent integration review C — interrupted, reconstructed

## Why this file exists

Reviewer C never wrote its report. Its session ended on a provider usage limit mid-investigation:

> `Agent errored: You've hit your usage limit.`

The only surviving record of its work is the coordinating note in `progress.md`:

> Reviewer C reports candidate draft-loss regression and is completing transaction-failure investigation.

Its finding text is not recoverable. The two leads named in that sentence were therefore re-derived
against the same diff and the same baseline (`be4e7a69940c180acfbe2033e6c675c741181f13`), and each was
carried to a verdict below. **This is a reconstruction of two named leads, not a substitute for C's full
integration lens** — whatever else C had inspected and cleared is unrecorded, so the three-lens protocol
stands at two complete lenses (A, B) plus this partial third.

## C-1 — Draft loss: a background sync erased the mood the user was typing — CONFIRMED, fixed

- **Severity:** medium (P2). **Confidence:** high; reproduced by unit regression.
- **File/symbol:** `src/components/MoodTracker/MoodTracker.tsx`, the render-time seeding block.
- **Introduced vs. pre-existing:** **introduced by this change.** The `else` branch below is new in the diff.

The block is triggered by `moods` array identity, `MoodTracker.tsx:163`:

```
  if (moods !== seededFrom) {
```

This change added a clearing `else`:

```
    } else {
      setSelectedMoods([]);
      setNote('');
      setIsEditing(false);
    }
```

That identity churns without any user action. `loadMoods` ends in an unconditional write,
`src/stores/slices/moodSlice.ts:145`:

```
      set({ moods: allMoods });
```

and `syncPendingMoods` calls it after every pass that acquires the lock, including one that synced
nothing (`moodSlice.ts:287`). `App.tsx:483-492` drives `syncPendingMoods` from a 5-minute `setInterval`
whenever `isOnline && session`, and `App.tsx:447` from the `online` reconnect handler.

**Failure scenario.** A user who has not yet logged a mood today — the ordinary first-entry case — opens
Log Mood, taps two moods, expands the note field and starts typing. Within five minutes, or the instant
Wi-Fi reconnects, the interval fires: `syncPendingMoods` → `loadMoods` → a fresh `moods` array →
reseeding runs → `getMoodForDate(today)` returns nothing, because nothing is saved → the new `else`
clears both selections and the note text mid-keystroke. `showNoteField` is not reset, so the user is left
typing into a textarea that silently emptied. Before this change the block did nothing in that case and
the draft survived.

Second path into the same branch: an existing row for today that normalizes to nothing is now hidden from
`getMoodForDate` (`moodSlice.ts:96`), so a user repairing that day also got the wipe.

**Fix applied.** The `else` branch is removed and the reason recorded in place. Reseeding overwrites the
form only when there is a saved entry to overwrite it with — the behaviour the block has always had. The
`else` was not required by any test: `moodArrayGuards.test.tsx`'s tracker case renders fresh, where
`selectedMoods` and `note` are already empty.

**Regression.** New file `src/components/MoodTracker/__tests__/MoodTracker.draftPreservation.test.tsx`,
two cases: an unsaved selection and note survive a `moods` array replacement, and a saved entry still
seeds the form. The second is the control — without it a guard that simply never reseeds would pass the
first and silently break editing.

## C-2 — Unsurfaced IndexedDB transaction failure — REFUTED

Every `readwrite` transaction in the newly changed code awaits `tx.done` on **every** exit path, early
returns included — `storage.ts:263-318`, `customMessageService.ts:260-391`, `moodService.ts:126-143` and
`:353-368`. No write resolves before its transaction commits.

The `void tx.done.catch(() => {})` idiom (e.g. `moodService.ts:127`) swallows nothing: it attaches a no-op
handler to a *derived* promise purely to suppress `unhandledrejection` while a request is awaited. The
original `tx.done` is still awaited and still rejects. Its own comment says so, `storage.ts:264`:

```
    // A failed request also rejects tx.done; observe both failure channels.
```

Two deliberate catches were checked and cleared:

- `matchesMoodSyncFingerprint`'s bare `catch { return false; }` (`moodSyncPayload.ts:96-100`) is
  conservative in the safe direction — it keeps a newly corrupted row **dirty** rather than falsely
  marking it synced.
- `messagesSlice.toggleFavorite`'s `catch` is unchanged context. It has a new way to throw, since
  `storage.toggleFavorite` now refuses a signed-out caller, and `DailyMessage.tsx:291` adds
  `disabled={!userId}` for exactly that. The `set()` is after the `await`, so a refused write leaves no
  lying optimistic state.

**No change made.**

## C-3 — New timestamp rejection in the sync payload — REFUTED as unreachable

Found while re-deriving the above, not named by C. `moodSyncFields` now throws on a timestamp that is
neither `Date` nor `string` (`src/services/moodSyncPayload.ts:62-64`), where the pre-existing
`toCreatedAt` (`:51-53`) passed anything `new Date()` could parse — so in principle a numeric epoch
timestamp would go from syncing to permanently stuck dirty.

No writer can produce one. `MoodEntry.timestamp` is typed `Date` (`src/types/index.ts:80`), both writers
in `moodService` supply `new Date()` (`moodService.ts:78` and `:136`), and IndexedDB round-trips a `Date`
as a `Date`. The `string` case the check does admit is the persisted-JSON rehydration path the existing
`toCreatedAt` comment already documents. The narrowing is unreachable, and in the reachable corrupt cases
it fails before the network rather than sending an `Invalid Date` — which is the approved design.

**No change made.**

## Observation, not a finding

The diff replaced the 30-line explanatory docblock at the top of
`src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` with a one-line summary. Nothing breaks,
and the rewritten file covers strictly more behaviour, but the removed text recorded *why* `Array.isArray`
rather than a truthy check — the kind of reasoning this repository otherwise keeps next to the code.
Raised for the record; not fixed here, as it is outside the change's scope.

## Checks

`npx vitest run tests/unit/stores/moodSlice.test.ts src/components/MoodTracker/__tests__/MoodTracker.draftPreservation.test.tsx`
was run against the code with the fixes reverted and with them applied: **7 failed** before, **40 passed**
after. Full validation is recorded in [verification.md](verification.md).
