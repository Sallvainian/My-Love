# Integration points

Companion to `SPEC.md`. Every file this work has to touch, with the exact line the change lands on and the reason it is not optional. Ordered by layer: service, store, Home render, Settings mount.

## 1. Service — `src/services/eventsService.ts` (new)

Model is `src/services/photoService.ts`: a class exported as a singleton, importing the shared client.

- `:22` `import { supabase } from '../api/supabaseClient';`
- `:96` `class PhotoService {`
- `:609` `export const photoService = new PhotoService();`

Method signatures to mirror:

| photoService | line |
|---|---|
| `async getPhotos(limit: number = 50, offset: number = 0): Promise<PhotoWithUrls[]>` | `:241` |
| `async getPhoto(photoId: string): Promise<PhotoWithUrls \| null>` | `:529` |
| `async deletePhoto(photoId: string): Promise<boolean>` | `:470` |
| `async updatePhoto(photoId: string, updates: Partial<SupabasePhoto>): Promise<boolean>` | `:569` |

**Pick an error convention deliberately — the codebase has two.** `AGENTS.md:48` warns that the Supabase API layer "is not consistent about this". `photoService` swallows: `:255-258` and `:278-281` both `return []` after a `console.error`, `:542-544` returns `null`, `:517-520` returns `false`. The `src/api/*` layer throws instead: `moodApi.ts:137-140` throws `handleNetworkError` when offline and `:161` throws `ApiValidationError`; `interactionService.ts:261-268` rethrows through `handleSupabaseError`/`handleNetworkError`.

CAP-7 ("a creating user is told when an event failed to save") is easier to satisfy on the throwing convention, since a swallowed write returns `false` and loses the reason.

## 2. Store — `src/stores/slices/eventsSlice.ts` (new)

Registered in `src/stores/useAppStore.ts:69-81`, alongside the eleven existing spreads — e.g. `:80` `...createNotesSlice(set, get, api),`. `appSlice` must stay first (`:68-69`).

Three rules bind the slice:

- **`signedOutState()`.** Every events key — the array, the loading flag, the error, any write lock — goes into `src/stores/slices/authSlice.ts:54-124` in the same commit. `:35-37` states the enforcement: *"ADDING STATE? If it is derived from the signed-in user or their partner, add it here. signOutClearsAccountState.test.ts asserts that every key in this object is reset, so DELETING or renaming one fails there."* `:39-42` extends it to flags: *"A stranded flag is a dead screen for the next account."* The consumer is `discardAccountState` at `:152-163`, ending `:162` `set({ ...identity, ...signedOutState() } as Partial<AppState>);`.
- **No persistence.** `useAppStore.ts:151-177` `partialize` returns only `settings` (`:154`), `isOnboarded` (`:155`) and `messageHistory` (`:157-163`). Do not add events. `:164-168` records the cost of getting this wrong for `moods`.
- **The user-swap guard.** `AGENTS.md:53`: any async action that `set()`s after an `await` must first re-check `if (get().userId !== capturedUserId) return`. The AGENTS list of sites that *lack* it — `addMoodEntry`, `sendNote`, `uploadPhoto`, `selectRole` "and every `messagesSlice` loader" — is a list of things not to copy.

**Realtime is assessed, not built — see section 8.** CAP-1 is written to reload-based freshness; section 8 carries the answer to "how complicated is it to wire this in".

## 3. Home render — `src/App.tsx`

Replace `:547-555`:

```jsx
                  {RELATIONSHIP_DATES.visits.map((visit) => (
                    <EventCountdown
                      key={visit.id}
                      label={visit.label}
                      icon="plane"
                      date={visit.date}
                      description={visit.description}
                    />
                  ))}
```

with a store-driven map, filtered so past events do not render (CAP-3).

Leave untouched in the same block: `:529` `<TimeTogether />`, `:535-536` the two `BirthdayCountdown` cards, `:541-546` the Wedding `EventCountdown`. The grid comment at `:531` reads `{/* Countdown timers grid: Birthdays (left) | Wedding+Visits (right) */}` and will need its wording updated.

**Home is not lazy-loaded.** `:525`: `{/* Home view - inline, not lazy-loaded, always works offline */}`, gating `:526` `{currentView === 'home' && (`. Events are Supabase-only per SPEC.md's non-goals, so the event cards will be empty offline where the hardcoded ones were not. That is a deliberate, recorded regression, not an oversight.

Then delete the `visits` array at `src/config/relationshipDates.ts:48-61`. Keep the rest of the file: `TimeTogether.tsx:21` reads `RELATIONSHIP_DATES.datingStart`, and `App.tsx:535-536,544` read `birthdays` and `wedding`.

## 4. Auto-hide — `src/components/RelationshipTimers/EventCountdown.tsx`

`:156-158` is the branch to retire:

```jsx
        ) : timeDiff && timeDiff.isPast ? (
          // Event has passed
          <p className="text-lg text-gray-500 dark:text-gray-400">Event passed</p>
```

The filter must not reuse `timeDiff.isPast`. `:147` tests `isEventToday` *before* `:156` tests `isPast`, and `isEventToday` is the local y/m/d equality at `:70-73`, and is bound as `isToday` at `:70-73` before being returned under the `isEventToday` key at `:78`, so an event timed earlier today is `isPast` while still legitimately showing `Today! 🎉` at `:154`. Filter on the same local-midnight comparison the component already computes at `:64-68`:

```js
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysDiff = Math.round(
    (targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );
```

`daysDiff >= 0` is the keep condition, evaluated against a `Date` built from the row's `"YYYY-MM-DD"` string as local components — `const [y, m, d] = row.event_date.split('-').map(Number); new Date(y, m - 1, d)` — never `new Date(row.event_date)`, which parses as UTC midnight and lands a day early in western timezones. See `data-model.md`. Because every viewer builds that `Date` from their own local components, each partner's card flips at their own local midnight, which is what CAP-3 asks for.

Whether the Wedding card keeps the `Event passed` branch is a call for the implementer — the branch is reachable from `:541-546` too, though `RELATIONSHIP_DATES.wedding` is `null` today (`relationshipDates.ts:45`).

## 5. Mounting Settings (CAP-5)

Covered in full by `navigation.md`. In short: `Settings.tsx` is dead code that nothing in the repo imports,
it is shaped as a full-screen view rather than a modal, and mounting it costs the five hand-maintained view
registration edits at `AGENTS.md:25`. Sallvain resolved the two questions that used to sit here — the bottom
tab bar is being removed entirely in favour of a hamburger tray (CAP-8), and the Settings sign-out is the one
that survives (CAP-9).

One thing to check before deleting the App-level sign-out wiring: `Settings.tsx:37` calls
`authService.signOut()` while the live path is `App.tsx:130` `await signOut();` from `api/auth/actionService`.
These are two different code paths, not two buttons on one path. Confirm the surviving one reaches the same
`signedOutState()` reset, or CAP-6 and CAP-9 both fail quietly on a shared device.

## 6. Events CRUD UI — `src/components/Settings/EventsSettings.tsx` (new)

`AnniversarySettings.tsx` is the **UI-shape** model and explicitly *not* the data model — and explicitly not its date handling either. `:103` renders `{formatDateLong(new Date(anniversary.date))}` over `src/types/index.ts:64` `date: string; // ISO date string`, which is the UTC-midnight off-by-one `data-model.md` rules out: measured, `America/New_York` renders "November 14, 2025" for a stored `2025-11-15`. Copy the layout, not the parse.

Shape to copy — local state at `:22-24`:

```jsx
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
```

with an inline list (`:79-133`), an Add button (`:69-75`) and per-row Edit (`:113-119`), a form rendered as a fixed overlay under `AnimatePresence` (`:136-138`, overlay class at `:285-286`), and a separate delete-confirmation modal (`:164-172`, driven by `:38-47`).

**What not to copy:** its persistence. `:141-158` routes saves through `updateSettings`/`addAnniversary`, which write to the Zustand `settings` blob — `settingsSlice.ts:213` mints `const newId = Math.max(0, ...settings.relationship.anniversaries.map((a) => a.id)) + 1;` and `useAppStore.ts:154` persists `settings: state.settings` to `localStorage`. That is device-local, numerically keyed, and never cleared on sign-out. Events are UUID-keyed, couple-shared, Supabase-backed, and must be cleared (CAP-6).

Validation in `AnniversarySettings` is hand-rolled in `handleSubmit` (`:223-278`, e.g. `:238` `} else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {`). The repo also has Zod schemas at `src/validation/schemas.ts` and `src/api/validation/supabaseSchemas.ts`.

Anniversaries themselves keep working and are out of scope: they render through `DailyMessage.tsx:359,366` (`<CountdownTimer anniversaries={settings.relationship.anniversaries} maxDisplay={3} />`), which is unaffected by anything here.

## 7. Tests

**Nothing existing breaks.** A grep for `RELATIONSHIP_DATES`, `Next Visit`, `Following Visit` and `Event passed` across `tests/` and `src/` returns production source only — `App.tsx:7,535,536,544,547`, `relationshipDates.ts:25,51,57`, `EventCountdown.tsx:158`, `TimeTogether.tsx:14,21`. No test file matches. There is no `__tests__` directory under `src/components/RelationshipTimers/` or `src/components/Settings/`.

The only related spec is archived and skipped — `tests/e2e-archive/home-view.spec.ts:31-36`, `'[P0] should display countdown timers'` whose body is `test.skip();`. `AGENTS.md:13` forbids repairing anything in `tests/e2e-archive/`; new coverage goes in `tests/e2e/`, importing `{ test, expect }` from `tests/support/merged-fixtures.ts` and never from `@playwright/test` (`AGENTS.md:26`).

The navigation change's own test impact — 15 `nav-*` references and 14 `bottom-navigation` readiness checks — is inventoried in `navigation.md`.

Two E2E constraints apply to a two-partner feature: accounts come from the per-worker pool in `tests/support/auth/worker-pool.ts` keyed on `TEST_WORKER_INDEX`, and **a spec must not link or unlink partners** — those rows belong to other workers (`AGENTS.md:62`). And after a mutation that changes both server and client state, wait on all three layers: the RPC response, then the Zustand store, then the UI assertion (`AGENTS.md:49`).

## 8. Live partner updates — assessment, not a requirement

Sallvain asked *"It would be nice to not have to reload, how complicated is it to wire this in?"* This section answers that. Nothing here is in scope until the question in `SPEC.md` is decided.

**The short answer: it depends sharply on the verb, and the plumbing is the easy part.**

### Adding an event: small

The send helper needs no changes at all. `src/api/ephemeralBroadcast.ts:115-119` already exposes `sendEphemeralBroadcast(topic, event, payload): Promise<void>`, and the write-then-broadcast pairing is `notesSlice.ts:554-560`, seven lines that treat a failed broadcast as non-fatal:

```js
      try {
        await sendEphemeralBroadcast(`love-notes:${partnerId}`, 'new_message', { message: data });
        logger.debug('[NotesSlice] Broadcast sent to partner:', partnerId);
      } catch (broadcastError) {
        // Non-fatal - message is saved, just realtime failed
        console.warn('[NotesSlice] Broadcast failed (non-fatal):', broadcastError);
      }
```

The receive side is one new hook modelled on the 147-line `src/hooks/useRealtimeMessages.ts`, mounted with one line. Topic scheme copies Love Notes: send to `events:${partnerId}`, listen on `events:${userId}` — asymmetric, so a client never receives its own broadcast. Realistically one new hook file, one new test file, ~8 lines in the events slice, one mount line. **Roughly a day.**

### Editing and deleting: meaningfully more

There is **no in-repo template**. Love Notes is a create-only precedent: `notesSlice` has no update action at all, and its `removeNote` is a per-user hide that deliberately never reaches the partner and never broadcasts. So edit and delete are new design, and three specific problems have to be solved rather than copied:

1. **The receive reducer must be last-writer-wins.** `notesSlice.ts:348-360` is first-writer-wins by id (`if (exists) … return state`), which is exactly inverted for edits — a late-arriving broadcast for a known event id would be discarded rather than applied. Carry `updated_at` from the server row and compare. For delete, keep a tombstone id list the way `notesPendingRemoval` does, so an in-flight fetch cannot resurrect a deleted event.
2. **Broadcast a discriminated payload** (`{ op: 'upsert' | 'delete', event }`) rather than three event names — one listener, one reducer.
3. **Order matters and nothing enforces it.** Two edits racing between two phones have no ordering discipline today.

**Roughly three to five days**, and the cost is in semantics, not wiring.

### Three hazards that decide whether it is worth it

- **There is no catch-up on reconnect.** A partner whose phone was asleep stays stale until something remounts the view. The cheap fix is to refetch on `SUBSCRIBED` unconditionally — that single change turns every missed broadcast into a self-healing case, and it is the highest-value line in the whole feature.
- **Broadcast failure is silent by design.** `notesSlice.ts:557-559` catches and `console.warn`s. The writer's UI shows success while the partner's screen never changes, and neither user is told.
- **The existing retry does not actually recover.** `useRealtimeMessages.ts:85-118` looks like exponential-backoff reconnect, but its only action is `channelRef.current.subscribe();` at `:116`, and `RealtimeChannel.subscribe` gates its entire body on the channel being *closed*. After `CHANNEL_ERROR` or `TIMED_OUT` the channel is *errored*, not closed, so that call falls through silently. Do not copy it believing it works.

Two more, if this proceeds: **"live" is tab-scoped**, since `App.tsx:576` mounts `LoveNotes` only while that view renders, so anything like "badge the events tab" needs a mount point above the view chain that does not exist; and **copying `useRealtimeMessages`'s teardown copies its hazard** — its cleanup calls `supabase.removeChannel(...)` without awaiting, which is what `moodSyncService.ts:584-587` fixes by storing the leave promise. (`interactionService.ts:181-184` warns about a different hazard — two overlapping subscriptions for one user sharing a channel object, so that *"the first teardown closes it under the second"*.)

### The framing worth stating plainly

A reload-based version can be **stale but is never wrong**. A live version **can be wrong** — the two phones can disagree and neither user is told, because the failure path is a `console.warn`. Refetch-on-`SUBSCRIBED` is what buys that guarantee back, which is why the live version should not ship without it.

### Recommendation

Ship the events feature reload-based first, then add create-only live updates as a follow-up with refetch-on-`SUBSCRIBED` included. That gets most of the felt benefit — "my partner added something and it just appeared" — for about a day of work, without taking on convergence semantics that have no precedent in this codebase.

Not counted above and worth flagging: **two-context E2E does not exist for realtime.** `tests/e2e/notes/love-notes.spec.ts` is 79 lines and never opens a second browser, so existing realtime delivery is untested, and the two-partner fixture is scripture-coupled. Verifying live delivery rather than assuming it is another day or two.

## Suggested sequencing

Two independent tracks. `deferred-work.md:25` closes with: *"This is the largest of the three options and should be sequenced migration + service + slice first, UI second, if it does not fit one session."*

**Events track** — migration and pgTAP first, then `eventsService` and `eventsSlice` with the `signedOutState()` entry in the same commit, then the Home render swap (CAP-4, CAP-3, CAP-10), then the Settings CRUD (CAP-1, CAP-2, CAP-7).

**Navigation track** — the tray plus the `settings` view registration, then the five hardcoded offsets, then the sign-out consolidation, then the test rewrites. Ships before or after the events track; nothing in it depends on the events table.

The one ordering constraint between them: CAP-5 (reach Settings and manage events there) needs both. If the events track lands first, its CRUD has no reachable home until the navigation track ships — which is the state the app is in today, so it is not a regression, just an unfinished feature.

**Optional follow-up, not in scope:** create-only live partner updates per section 8.
