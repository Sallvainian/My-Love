# Findings 2026-10-28: tests/unit and src, High rows and tests that cannot fail

Verbatim copy of the High rows and seven advisory notes from the 2026-10-28 TEA test reviews of `tests/unit/` (`test-review-target-tests-unit.md`) and `src/` (`test-review-target-src.md`), both in the gitignored `_bmad-output/test-artifacts/test-review/`. Every item here is in scope. The reports' Medium and Low rows and their other advisory notes are not. Rule ids (H3, H4, H10) are defined in TEA's criteria registry, `.claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md`. `corrections.md` covers only 2026-09-25 rows and names none of these. Line numbers match main at 6103e00a (spot-checked; its tree equals 04acfef7, the last change before the reviews ran); locate each finding by its content.

## tests/unit: 9 High rows (8 H10, 1 H3)

### 1. Shape-only assertion in `broadcastSchemas.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/api/broadcastSchemas.test.ts:104`
**Row**: H10

**Issue**: Test 'strips a forged imagePreviewUrl' (lines 95-107) makes only presence and key-absence claims about the parsed note: `not.toBeNull()` (104), `not.toHaveProperty('imagePreviewUrl')` (105), and `Object.keys(parsed!)).not.toContain('imagePreviewUrl')` (106). No assertion pins the returned note itself (id, from_user_id, to_user_id, content, created_at), so any non-null object that lacks the key passes, including `{}` or a note whose content or sender was altered. None of the four exemptions applies: no assertion on this subject pins its value, the whole value is predictable from the `note()` fixture, the subject is not a UI element, and the test is not a type-assignability check.

**Fix**: Assert the whole value. One assertion then proves both that the forged field was stripped and that the other fields survived: expect(parsed).toEqual({ id: NOTE_ID, from_user_id: PARTNER, to_user_id: ME, content: 'thinking of you', created_at: '2026-09-12T10:00:00.000Z' }). The sibling test at line 121 confirms these five keys are the parser's whole output for this fixture.

### 2. Shape-only assertion in `AdminPanel.accountData.test.tsx`

**Severity**: P1 (High)
**Location**: `tests/unit/components/AdminPanel.accountData.test.tsx:270`
**Row**: H10

**Issue**: Test 'keeps the row on disk and in the store after a failed delete' (line 268) has two assertions, and both check only presence. `diskRow(aId)` must be defined (line 270) and `customMessages.some(m => m.id === aId)` must be true (line 271). Nothing checks the content of the kept row: its text, serverId, userId and category. A failed-delete path that leaves a changed or blanked row under id 1000, on disk or in the store, still passes. The sibling test at line 292 shows how the content can be checked.

**Fix**: Check the kept row's content on both sides, as line 292 does: `expect(await diskRow(aId)).toMatchObject({ id: aId, text: 'Account A message', serverId: aServerId, userId: A, category: 'custom' })`, and `expect(useAppStore.getState().customMessages.find((m) => m.id === aId)).toMatchObject({ text: 'Account A message', serverId: aServerId })`.

### 3. Shape-only assertion in `moodSlice.sync.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/stores/moodSlice.sync.test.ts:91`
**Row**: H10

**Issue**: In 'sets isSyncing during sync and clears after' (line 81), the only assertion on `syncStatus.lastSyncAt`, a value the slice writes with `new Date()`, is a bare `toBeInstanceOf(Date)`. The beforeEach pins Date with `vi.setSystemTime(NOW)` (line 58), so the exact value is predictable, and no comment on the line explains why only the type is checked. Any Date passes, including a stale one carried over from an earlier sync. The `isSyncing` value assertion is about a different subject, so it does not exempt this one. Value never constrained: lastSyncAt.

**Fix**: Assert the value: `expect(get().syncStatus.lastSyncAt).toEqual(NOW)`. The clock is already pinned by the beforeEach.

### 4. Shape-only assertion in `moodSlice.sync.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/stores/moodSlice.sync.test.ts:353`
**Row**: H10

**Issue**: In 'still completes normally for an uninterrupted session' (line 344), the control case for the session guard, `lastSyncAt` is checked only with a bare `toBeInstanceOf(Date)`. Date is pinned to NOW by the outer beforeEach, so the stamp is predictable, and nothing on the line says otherwise. A guard that stamped the wrong time, or left a stale Date in place, still passes this control. Value never constrained: lastSyncAt.

**Fix**: Use `expect(get().syncStatus.lastSyncAt).toEqual(NOW)`, so the control also proves the completion wrote this batch's stamp.

### 5. Shape-only assertion in `notesSlice.idempotency.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/stores/notesSlice.idempotency.test.ts:236`
**Row**: H10

**Issue**: The test 'a CHECK failure on send marks the note failed, keeps its image and shows the friendly banner' (line 232) checks the kept image only with `toBeDefined()`. The other assertions are about different subjects (`failed.error`, `notesError`). The blob is predictable, because the `compressImage` mock returns the File it was given. Any blob passes, including one that is not the image the user picked. Line 251 in the same file shows that an identity check is possible. Value never constrained: failed.imageBlob.

**Fix**: Have failCheckSend return the File it sends (or build it in the test) and assert `expect(failed.imageBlob).toBe(file)`.

### 6. Shape-only assertion in `notesSlice.idempotency.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/stores/notesSlice.idempotency.test.ts:365`
**Row**: H10

**Issue**: 'sends a note with the composed message tempId as its idempotency key' (line 357) says the key IS the note's tempId. The only assertion about the key is `toMatch(/^temp-/)`, which checks the format and not the value. A key from any other `temp-…` string passes, for example one regenerated per attempt. That is the exact defect the comment on lines 362-363 says the test protects against. The tempId is random, but the test can read it, as line 262 does with `toBe(failed.tempId)`. No comment on the line says the format is all that can be asserted. Value never constrained: the idempotency_key's identity with the note's tempId.

**Fix**: Capture the note's tempId while it is still queued (or failed, as the case at line 254 does) and assert `expect(backend.rows[0].idempotency_key).toBe(tempId)`.

### 7. Shape-only assertion in `notesSlice.localCopy.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/stores/notesSlice.localCopy.test.ts:174`
**Row**: H10

**Issue**: 'offline with no copy: empty with an error, as today' (line 167) checks the error banner only with `toBeTruthy()`. Any non-empty string passes, including the wrong sentence (for example 'Partner not configured', or an offline refusal written by hand). The value is predictable: `goOffline()` makes the lookup fail with reason 'TypeError: Failed to fetch', and notesSlice.offlineQueue.test.ts:747 asserts the same fetchNotes path's reason verbatim. The other assertions (`notes`, `writeLocalCopy`) are about other subjects. Value never constrained: notesError.

**Fix**: Assert the exact banner, e.g. `expect(store.getState().notesError).toBe('TypeError: Failed to fetch')`.

### 8. Shape-only assertion in `messageRotation.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/utils/messageRotation.test.ts:96`
**Row**: H10

**Issue**: Test 'defaults to today when no date provided' (line 93) has one assertion: the result must be one of the 5 pool messages. That is the same check the test 'returns a message from the pool' already makes at line 66. The behaviour this test names, that the default date is today, is never checked. If the default were any other date (the epoch, yesterday, a fixed date), the function would return a different pool message and the test would still pass. The `getDailyMessage` describe also runs on the live clock, with no fake timers, so the expected 'today' message cannot be written down as it stands.

**Fix**: Freeze the clock the way the `getAvailableHistoryDays` block does (`vi.useFakeTimers({ toFake: ['Date'] })` plus `vi.setSystemTime(NOW)`, and `vi.useRealTimers()` in afterEach). Then assert the exact value: `expect(getDailyMessage(messages)).toBe(getDailyMessage(messages, NOW))`. Pick NOW so that its message differs from the message for at least one other date, so the assertion can fail.

### 9. Conditional assertion in `notesSlice.offlineQueue.test.ts`

**Severity**: P1 (High)
**Location**: `tests/unit/stores/notesSlice.offlineQueue.test.ts:404`
**Row**: H3

**Issue**: In 'server rejection: Retry resends under the same key and clears the failure' (line 396), the per-note check `notes.every((n) => !n.error && !n.queued)` is a loop over `store.getState().notes`, and nothing in this test pins how many notes there are. Lines 401-402 count the server rows, not state. On an empty array `every` returns true, so if a retry dropped the thread from state, the check runs zero times and passes. This is the 'loop over data that may run zero times' shape, written as `.every`. Lines 162 and 285 use the same idiom safely, because the assertion just before each pins the list (lines 161 and 284).

**Fix**: Pin the list first, e.g. `expect(store.getState().notes.map((n) => n.content)).toEqual(['one', 'two', 'three'])`, or assert the notes with `toEqual([expect.objectContaining({ error: false }), ...])`.

## src: 3 High rows (2 H10, 1 H4)

### 1. Enter-to-send never checks what was sent

**Severity**: P1 (High)
**Location**: `src/components/love-notes/__tests__/MessageInput.test.tsx:518`
**Row**: H10

**Issue**: "should send on Enter (without Shift)" asserts only `expect(mockSendNote).toHaveBeenCalled()`. The component calls `sendNote(sanitizedContent, selectedImage || undefined)` (`MessageInput.tsx:137`), so an Enter path that sends an empty, truncated or stale string still passes. The Send-button test pins the argument; this path does not.

**Fix**: `await waitFor(() => expect(mockSendNote).toHaveBeenCalledWith('Hello', undefined));`, optionally with `toHaveBeenCalledTimes(1)`.

### 2. Channel release never checks which channel

**Severity**: P1 (High)
**Location**: `src/hooks/__tests__/useRealtimeMessages.test.ts:387`
**Row**: H10

**Issue**: "releases the love-notes channel on unmount" asserts only `expect(supabase.removeChannel).toHaveBeenCalled()`. The hook passes the channel it is releasing (`useRealtimeMessages.ts:114`), and the test never pins which one, so releasing the wrong channel passes.

**Fix**: Capture the channel `supabase.channel` returned and assert `expect(supabase.removeChannel).toHaveBeenCalledWith(thatChannel)`.

### 3. A linked partner leaks into the first suite under shuffle

**Severity**: P1 (High)
**Location**: `src/components/love-notes/__tests__/OwnDisplayName.test.tsx:217`
**Row**: H4

**Issue**: "re-reads the partner name when the store learns of a partner" sets the module-level `storeState.partner` and never restores it. Only the second describe's `beforeEach` (line 204) resets it, so under CI's `--sequence.shuffle` the first describe's eight tests can mount with a partner already linked. No current assertion changes, because `LoveNotes.tsx` ignores a partner present at mount, but those tests no longer run in the unlinked state they assume.

**Fix**: Reset `storeState.partner = null` in a file-level `beforeEach`, or in an `afterEach` inside the second describe.

## Advisory notes: tests that cannot fail

Each note describes a test that passes while the behaviour it names is broken. The notes carry no row id or severity in the reports; the ids A1–A7 are this file's.

### tests/unit

**A1**: `tests/unit/stores/loaderIdentityGuards.events.test.ts:479`, `:513` and `:543`: the three "does not paint the previous account's failure onto the new one" tests seed C with `eventsError: null`, and their only assertion is that it stays `null`. That holds whether or not the guard exists. Seed a sentinel error, or assert the call the guard should stop.

**A2**: `tests/unit/stores/moodSlice.sync.test.ts:202` asserts that `moodService.getAll` was not called, but `moodSlice` never calls `getAll`, so the assertion cannot fail. Point it at the reload path the slice actually uses.

**A3**: `tests/unit/services/dbSchema.v15MessageData.test.ts:247` checks `.every((row) => !row.isCustom)`, which is also true for an empty store. Add the bundled-row count, as the v14 sibling does.

**A4**: `tests/unit/services/photoImageCache.test.ts:600` and `:648` assert `download` was not called after a single `await Promise.resolve()`. A wrong resume that needs more than one microtask would still pass. Settle the started fill before the negative assertion.

### src

The src notes name bare file names. `OwnDisplayName`, `LoveNotes.realtimeStatus` and `LoveNoteMessage` tests are in `src/components/love-notes/__tests__/`, `PokeKissInterface.test.tsx` is in `src/components/PokeKissInterface/__tests__/`, and `backgroundSync.test.ts` is in `src/utils/__tests__/`.

**A5**: Some tests can pass before the behaviour they name has run, because the expected fallback name is also the component's initial state (`LoveNotes.tsx:101`, `:103`): `OwnDisplayName.test.tsx:120-124`, `:165-179`, `:191-192` and `LoveNotes.realtimeStatus.test.tsx:111-117`, `:136-146`. Assert on the lookup having settled (the mock having been called) before asserting the fallback.

**A6**: `LoveNoteMessage.test.tsx:777-822` never checks that the retry request was made before unmount, so it still passes if the retry code is deleted. `PokeKissInterface.test.tsx:130` asserts after `unmount()` and cannot fail (the test's real check is at `:136`).

**A7**: `backgroundSync.test.ts:165`, `:172`, `:179` use `.resolves.not.toThrow()`: only the `.resolves` half can fail. `.resolves.toBeUndefined()` states the same claim falsifiably.
