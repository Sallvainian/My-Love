# Deferred Work

Who may edit what. A run closing its own bundle writes two things here and
nothing else: `status:`/`resolution:` on the entries it actually resolved, and
new entries appended for what it deferred. Everything else -- another entry's
status, reason or severity, and any repair to an entry's `location:` -- belongs
to the orchestrator, because a run has neither the context to judge another
bundle's entry nor a way to tell the next reader it did so. Several entries
below say "this run is directed not to edit the ledger" while sitting in a diff
that closed two entries and appended six; both are true of different edits, and
this paragraph is the distinction they were missing (DW-116).

### DW-1: Calendar vs Timeline date grouping mismatch (UTC vs local)

status: done 2026-03-20
origin: migrated from legacy ledger ("From: Mood Tracker State Issues (2026-03-20)"), 2026-08-17
archived: 2026-09-25

### DW-2: Stale visit events on Home dashboard

status: done 2026-03-20
origin: migrated from legacy ledger ("From: Mood Tracker State Issues (2026-03-20)"), 2026-08-17
archived: 2026-09-25

### DW-3: Dynamic events system

status: done 2026-08-19
origin: migrated from legacy ledger ("From: A+B Patch (2026-03-20)"), 2026-08-17
archived: 2026-09-25

### DW-4: CI never applies migrations to production

status: done 2026-08-17
origin: migrated from legacy ledger ("From: Mood Duplicate Entries (2026-07-26)"), 2026-07-26
source_spec: _bmad-output/implementation-artifacts/spec-mood-duplicate-log-entries.md
archived: 2026-09-25

### DW-5: Pending moods are not scoped to the signed-in user

status: done 2026-08-17
origin: migrated from legacy ledger ("From: Mood Stale Sync Discards Edit (2026-07-26)"), 2026-07-26
source_spec: _bmad-output/implementation-artifacts/spec-mood-stale-sync-discards-edit.md
archived: 2026-09-25

### DW-6: updateMood's split-transaction read/write can clobber a freshly synced supabaseId

status: done 2026-08-19
origin: migrated from legacy ledger ("From: Mood Stale Sync Discards Edit (2026-07-26)"), 2026-07-26
source_spec: _bmad-output/implementation-artifacts/spec-mood-stale-sync-discards-edit.md
archived: 2026-09-25

### DW-7: handleNetworkError promises "Your changes will be synced when you're back online", which is false for events — there is no offline queue, IndexedDB mirror or retry.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-offline-message-honesty
resolution-undo: 5c46b35490321cbf6fdd6bc5255a477608d829bd27ecbf075ab278ce08b5c8f2 2026-08-19 7374617475733a206f70656e
origin: spec-deferred 67d2bdb34631
source_spec: `2-events-service-and-store-slice.md`
severity: medium
archived: 2026-09-25

### DW-8: A CHECK-constraint violation (23514) is unmapped, so an over-length label or description reaches the user as raw Postgres constraint text.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-check-constraint-error-mapping
resolution-undo: cb693b6131bc19853836c66541daaed38f371857c1a417872aed38cbb28440ec 2026-08-19 7374617475733a206f70656e
origin: spec-deferred d44dacbe0efd
source_spec: `2-events-service-and-store-slice.md`
severity: medium
archived: 2026-09-25

### DW-9: eventsService.getEvents applies no limit or pagination.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-read-cap-and-pagination
resolution-undo: 529326357e46ff317c67b4b965b0aadeeac222881428309d7abbd8fad3749743 2026-08-19 7374617475733a206f70656e
origin: spec-deferred 25448caba914
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-10: Two events on the same date have no deterministic order.

status: done 2026-08-19
origin: spec-deferred 3c6d3601f0c8
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-11: Overlapping loadEvents calls are last-writer-wins; the guard compares userId only.

status: done 2026-08-19
origin: spec-deferred 27d87ebc0b13
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-12: A double-submitted addEvent creates two rows.

status: done 2026-08-19
origin: spec-deferred 3ef25a69c45f
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-13: EventWriteError is unexported and EventWriteResult carries no machine-readable code, so callers must string-match English prose to tell "not yours" from a transport failure.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-write-error-codes
resolution-undo: a56e133f78fb9ed825473b5a7526f95d98b1b0ae337b60eaae078e8a484b671c 2026-08-20 7374617475733a206f70656e
origin: spec-deferred 87c45d388242
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-14: A persisted blob that already contained an events key would be rehydrated; only moods is stripped on read.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-persisted-events-key-strip
resolution-undo: ddb7df62ab97dd5914d84da1658d2bfa011c9cce356a202cdd1b9be1033c6c85 2026-08-19 7374617475733a206f70656e
origin: spec-deferred 09851f20d430
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-15: A row with an unparseable event_date is silently dropped from the list with only a console.error; nothing surfaces to eventsError or any user-visible state.

status: done 2026-08-19
origin: spec-deferred 27703d86d257
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-16: A CHECK-constraint violation (23514) — including a blank or over-length label/description — is unmapped, so it reaches the user as raw Postgres text.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-check-constraint-error-mapping
resolution-undo: cb693b6131bc19853836c66541daaed38f371857c1a417872aed38cbb28440ec 2026-08-19 7374617475733a206f70656e
origin: spec-deferred f5a93068dc47
source_spec: `2-events-service-and-store-slice.md`
severity: medium
archived: 2026-09-25

### DW-17: Overlapping loadEvents calls are last-writer-wins; the identity guard compares userId only.

status: done 2026-08-19
origin: spec-deferred d1a10b88a17a
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-18: handleNetworkError's offline message promises a sync that cannot happen for events.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-offline-message-honesty
resolution-undo: 5c46b35490321cbf6fdd6bc5255a477608d829bd27ecbf075ab278ce08b5c8f2 2026-08-19 7374617475733a206f70656e
origin: spec-deferred a118de54f9a8
source_spec: `2-events-service-and-store-slice.md`
severity: medium
archived: 2026-09-25

### DW-19: EventWriteError is unexported and EventWriteResult carries no machine-readable code, so callers must string-match English prose to distinguish outcomes.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-write-error-codes
resolution-undo: a56e133f78fb9ed825473b5a7526f95d98b1b0ae337b60eaae078e8a484b671c 2026-08-20 7374617475733a206f70656e
origin: spec-deferred 5652fe1c2471
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-20: Persistence omission from partialize only prevents new writes; a pre-existing persisted blob with an events key would still rehydrate.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-persisted-events-key-strip
resolution-undo: ddb7df62ab97dd5914d84da1658d2bfa011c9cce356a202cdd1b9be1033c6c85 2026-08-19 7374617475733a206f70656e
origin: spec-deferred 0f9e6e1214d8
source_spec: `2-events-service-and-store-slice.md`
severity: low
archived: 2026-09-25

### DW-21: Overlapping loadEvents() calls from rapid Home revisits have no in-flight/sequence guard, so an out-of-order response could show stale data for a moment.

status: done 2026-08-19
origin: spec-deferred 5c30b7108a47
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
archived: 2026-09-25

### DW-22: No cap or pagination on the events rendered on Home; the right-hand grid column grows unbounded against the fixed 2-card birthdays column.

status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-read-cap-and-pagination
resolution-undo: 529326357e46ff317c67b4b965b0aadeeac222881428309d7abbd8fad3749743 2026-08-19 7374617475733a206f70656e
origin: spec-deferred b8c2e0998b06
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
archived: 2026-09-25

### DW-23: EventCountdown's data-testid is derived from label text with no uniqueness guarantee, so a future user-created event labeled "Wedding" would collide with the fixed Wedding card's testid.

status: done 2026-08-19
origin: spec-deferred 17f1ada12518
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
archived: 2026-09-25

### DW-24: No test renders App.tsx at all, so its composition is exercised only by Playwright and a green `npm run test:unit` says nothing about it.

status: done 2026-08-19
origin: spec-deferred 657f5db9659f
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
archived: 2026-09-25

### DW-25: Follow-up review still recommended for 3 after the damping cap was spent

status: done 2026-08-19
origin: review-budget-followup
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
archived: 2026-09-25

### DW-26: A save that fails while the first load is still in flight makes the list paint a false "we couldn't load your events" notice after that load succeeds.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-error-attribution
resolution-undo: 967f607d893782fd21a702cf860f2384988b9ba6aceeda5267c395049534142b 2026-08-20 7374617475733a206f70656e
origin: spec-deferred 110da53662a7
source_spec: `5-manage-events-in-settings.md`
severity: low
archived: 2026-09-25

### DW-27: Once the Settings events load fails, nothing re-fires it: the notice and the empty list persist until the user reloads the page.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-settings-load-retry
resolution-undo: 433cb6cdb4b7a3a109c2c9469796fa50d337228f20bc12a5857dcfafb8a9ccf3 2026-08-20 7374617475733a206f70656e
origin: spec-deferred 289bbe236935
source_spec: `5-manage-events-in-settings.md`
severity: low
archived: 2026-09-25

### DW-28: The three primary buttons this section adds are white text on `bg-pink-500`, which measures 3.58:1 against the 4.5:1 WCAG AA requirement.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-pink-primary-button-contrast
resolution-undo: 1f1ce66048fcb7a2fbfadd78a511a0aa0175348f683c99cc90ca35cd1aef7178 2026-08-20 7374617475733a206f70656e
origin: spec-deferred d52fd5748eef
source_spec: `5-manage-events-in-settings.md`
severity: medium
archived: 2026-09-25

### DW-29: A write that lands while the first load is still in flight is discarded by that load, so a saved edit or a new event silently reverts on screen.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-error-attribution
resolution-undo: 967f607d893782fd21a702cf860f2384988b9ba6aceeda5267c395049534142b 2026-08-20 7374617475733a206f70656e
origin: spec-deferred a015b45b45be
source_spec: `5-manage-events-in-settings.md`
severity: medium
archived: 2026-09-25

### DW-30: Roughly 4,000 lines of measured tests shipped in this change set are matched by no test runner and execute nowhere.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-activate-parked-event-tests
resolution-undo: 17ce3b66d18c0b51d563a4a8722d775298fe4d3f3192f08273b06052a5fbaf4f 2026-08-20 7374617475733a206f70656e
origin: spec-deferred cb64960af166
source_spec: `5-manage-events-in-settings.md`
severity: low
archived: 2026-09-25

### DW-31: markAsViewed resolves successfully when its UPDATE matches zero rows, so a row the caller may not update is reported as marked.

status: done 2026-08-19
origin: spec-deferred 1a8de2676ad0
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
archived: 2026-09-25

### DW-32: getInteractionHistory, getUnviewedInteractions and markAsViewed have no isOnline() guard, so an offline caller gets a mid-flight message.

status: done 2026-08-19
origin: spec-deferred 1effec975be0
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
archived: 2026-09-25

### DW-33: The write-error class and networkFailure builder now exist in two copies, one per Supabase-only feature.

status: done 2026-08-19
origin: spec-deferred fb1db7ca9280
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
archived: 2026-09-25

### DW-34: The new interactionService test file covers the failure surface only; the success paths of the three read/update methods stay untested.

status: done 2026-08-19
origin: spec-deferred 498cf9493c5a
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
archived: 2026-09-25

### DW-35: subscribeInteractions has no error handling — a failed subscribe only logs its status and the returned unsubscribe still looks healthy.

status: done 2026-08-20
resolution: resolved by sweep bundle dw-interaction-subscribe-error-surfacing
resolution-undo: 2b166d2a835fd67e36fae399847dd6a6dbf4ddc63c28d08a577652ead0c14b78 2026-08-20 7374617475733a206f70656e
origin: spec-deferred 0f06e1c320a7
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
archived: 2026-09-25

### DW-36: The SQLSTATE lookup walks Object.prototype, so a code of toString, constructor, valueOf or hasOwnProperty returns an inherited function and renders it to the user as the error message.

status: done 2026-08-19
origin: spec-deferred d3c350f0c7d6
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: low
archived: 2026-09-25

### DW-37: Sibling SQLSTATEs that also carry raw Postgres text are still unmapped, so the same leak class this story closed for 23514 remains open for them.

status: done 2026-08-19
origin: spec-deferred 4115baed8bbf
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: medium
archived: 2026-09-25

### DW-38: Four CHECK-carrying write paths never reach handleSupabaseError, so the SQLSTATE map cannot protect them however many codes it maps.

status: done 2026-09-11
resolution: resolved by sweep bundle dw-check-error-path-consistency
resolution-undo: e6195a259cb9d15982632c3e6d4cddb9316f11afe7e8f29ae8f4aac5e9a2e827 2026-09-11 7374617475733a206f70656e
origin: spec-deferred 613aa9858056
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: medium
archived: 2026-09-25

### DW-39: A PostgrestError with a missing or empty message takes the fallback and surfaces the bare string "Database error: " with nothing after the colon.

status: done 2026-09-11
resolution: resolved by sweep bundle dw-empty-database-error-fallback
resolution-undo: e3a692278d474f40ee244679eb6d6ad33513dc3e08354984bb02e9c81c6da4b3 2026-09-11 7374617475733a206f70656e
origin: spec-deferred e9534049eabc
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: low
archived: 2026-09-25

### DW-40: SoloReadingFlow.test.tsx is flaky under the full suite, failing about one run in five while passing in isolation.

status: done 2026-09-11
resolution: resolved by sweep bundle dw-solo-report-test-synchronization
resolution-undo: 1fab1f23a7e64ee869a98f06387b24c37f5d019856a0b920ead1e0a39c18af1f 2026-09-11 7374617475733a206f70656e
origin: spec-deferred ef241b3821d3
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: low
archived: 2026-09-25

### DW-41: Settings has no way to reach events the read cap truncates, so past roughly 50 past events the oldest ones become uneditable from the UI.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-decision-dw-41
resolution-undo: 11a3495e84f703f2c798e725ed4ccea80dcb1f63e9048f8904475ed7271cc247 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 9ee0fff5525a
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: medium
archived: 2026-09-25

### DW-42: A row whose date cannot be parsed still consumes a slot inside the capped window before it is dropped client-side, so garbage can push a real event off the page.

status: done 2026-09-12
origin: spec-deferred 6ae6d93ad3e8
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
archived: 2026-09-25

### DW-43: Three separate literals encode the single product decision "how many countdown cards a column shows".

status: done 2026-09-12
origin: spec-deferred 9fcc81a217ea
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
archived: 2026-09-25

### DW-44: An event saved with a date beyond the past read window appears in Settings immediately and then silently disappears on the next load.

status: done 2026-09-12
origin: spec-deferred 6e4344fda920
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: medium
archived: 2026-09-25

### DW-45: The two-window read is two requests, so a row whose date is edited across today between them can come back in neither page, or come back as the pre-edit copy.

status: done 2026-08-19
origin: spec-deferred b8ca2f59b73d
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
archived: 2026-09-25

### DW-46: Neither window requests a row count, so nothing can tell that truncation happened — which the deferred "load more" control would need.

status: done 2026-09-12
origin: spec-deferred 3eedd014be6b
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
archived: 2026-09-25

### DW-47: The new API spec re-issues the production query chain by hand, so the two copies can drift if a change is made to both.

status: done 2026-08-19
origin: spec-deferred 71695d066668
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
archived: 2026-09-25

### DW-48: The read-side strip covers the `events` key only; a persisted blob carrying `eventsIsLoading` or `eventsError` would still rehydrate those two.

status: done 2026-09-11
origin: spec-deferred ed3babe6b83b
source_spec: `spec-dw-14-20-persisted-events-key-strip.md`
severity: low
archived: 2026-09-25

### DW-49: An invalid-response write can already have landed, but Settings still offers the same write control and a create retry can duplicate the event.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-decision-dw-49
resolution-undo: 5978483b28512c6b5e1f3ce7a7cecad6eb9f4cce3c4aa2f746285eb1c55c8e39 2026-09-12 7374617475733a206f70656e
origin: spec-deferred db701c73ed1f
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: medium
archived: 2026-09-25

### DW-50: The EventsSlice interface comment says `eventsError` is raised only by loads even though writes also park messages there.

status: done 2026-09-11
origin: spec-deferred ce0f9f82f812
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: low
archived: 2026-09-25

### DW-51: A load outcome can be misreported when an event write settles in the narrow window before Settings snapshots the shared error field.

status: done 2026-09-11
origin: spec-deferred a61e4d489ca9
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: medium
archived: 2026-09-25

### DW-52: Invalid-response writes keep the write control even though the mutation may already have landed.

status: done 2026-09-11
origin: spec-deferred 7567c0b98908
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: medium
archived: 2026-09-25

### DW-53: Transport wrapping drops the original non-PostgREST network error as an Error cause.

status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-transport-error-cause
resolution-undo: 3dd40b40769bee717376c7b1b12a8e1da3afdbc2619c849abc2abf476b1e51bf 2026-09-11 7374617475733a206f70656e
origin: spec-deferred 2d2ac9a00a50
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: low
archived: 2026-09-25

### DW-54: User-id-only event load ownership can admit a pre-sign-out response after signing back into the same account.

status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-load-session-ownership
resolution-undo: 3b9cbe14c278fe58eeb36f2bec269a9c112a29bf26ee5e0dbaacf33079abba46 2026-09-11 7374617475733a206f70656e
origin: spec-deferred f281396e181b
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: medium
archived: 2026-09-25

### DW-55: A prior-session event load can still own state after signing back into the same account.

status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-load-session-ownership
resolution-undo: 3b9cbe14c278fe58eeb36f2bec269a9c112a29bf26ee5e0dbaacf33079abba46 2026-09-11 7374617475733a206f70656e
origin: spec-deferred d08cc52656ce
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: medium
archived: 2026-09-25

### DW-56: A prior-session event load can still own the reset list after signing back into the same account.

status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-load-session-ownership
resolution-undo: 3b9cbe14c278fe58eeb36f2bec269a9c112a29bf26ee5e0dbaacf33079abba46 2026-09-11 7374617475733a206f70656e
origin: spec-deferred a52c0c10748d
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: medium
archived: 2026-09-25

### DW-57: A manual stale-row refresh can settle after Events Settings unmounts and call its local state setters.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-refresh-unmount-guard
resolution-undo: 43f8322f8e9453ab7fae582d3293bad815aac27fdbba3dcfbf3ddf12734f027c 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 0c21a7d01775
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: low
archived: 2026-09-25

### DW-58: Follow-up review still recommended for dw-events-error-attribution after the damping cap was spent

status: done 2026-09-12
origin: review-budget-followup
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: low
archived: 2026-09-25

### DW-59: The translucent own-photo badge can still miss WCAG AA over a bright photo.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-own-photo-badge-contrast
resolution-undo: ec432d0278a3fa08017a373672da1b3036f4a4639752cce7124810859e34903d 2026-09-12 7374617475733a206f70656e
origin: spec-deferred c395d4263ff0
source_spec: `spec-dw-28-pink-primary-button-contrast.md`
severity: medium
archived: 2026-09-25

### DW-60: The UI/SQL validation mirror test compares against the original create migration, not the effective constraint after all migrations have run.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e
origin: spec-deferred eb5b0fb56687
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
archived: 2026-09-25

### DW-61: Repeated date-helper calls can derive different calendar anchors if a seeding batch crosses local midnight.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-test-date-anchors
resolution-undo: 97b97851d902cda684f6d7a952dfa833a050c31e1b11ef4ff6bbc3cda802a21c 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 07bf0f3e8d6a
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-62: Historical story acceptance criteria AC4 and AC6 still pin obsolete test totals and the pre-activation file boundary.

status: done 2026-09-11
origin: spec-deferred 0bff1e60324b
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-63: The validation drift guard reads the original events migration instead of the effective schema after every migration.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 8995c6651fba
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
archived: 2026-09-25

### DW-64: Repeated event-date helper calls can use different calendar anchors across local midnight.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-test-date-anchors
resolution-undo: 97b97851d902cda684f6d7a952dfa833a050c31e1b11ef4ff6bbc3cda802a21c 2026-09-12 7374617475733a206f70656e
origin: spec-deferred f5a669342ad5
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-65: Story 5 acceptance criteria AC4 and AC6 describe the pre-activation test totals and file boundary.

status: done 2026-09-11
origin: spec-deferred 7792fe01375e
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-66: The validation drift guard reads one historical migration instead of the effective constraint installed by the complete migration chain.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 4abe4f39af4c
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
archived: 2026-09-25

### DW-67: The icon extractor can silently omit database values containing non-letter characters.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 0fdd766222cc
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
archived: 2026-09-25

### DW-68: The validation mirror checks constant declarations but not the validation branches that consume them.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e
origin: spec-deferred aa42fa28a662
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
archived: 2026-09-25

### DW-69: Repeated date-helper calls can anchor one setup batch to different local days at midnight.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-test-date-anchors
resolution-undo: 97b97851d902cda684f6d7a952dfa833a050c31e1b11ef4ff6bbc3cda802a21c 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 48f645dfe7e2
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-70: The anonymous-write isolation check can fail on a stale row from an interrupted prior run.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-wire-contract-fidelity
resolution-undo: c4828021067babf12116479690590415b10721d96a8ca12d9d16f45a0fc9e054 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 1f8f5181ea11
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
archived: 2026-09-25

### DW-71: Outsider account cleanup ignores a returned deletion error when sign-in setup fails.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-outsider-setup-cleanup-errors
resolution-undo: 0ff32d336aaa8e746d9aea6f42cd2b250588938c82ff6e059de3598a09c53c07 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 588dd42563e8
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
archived: 2026-09-25

### DW-72: The test-local event row schema accepts undeclared response columns despite its exact-schema claim.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-wire-contract-fidelity
resolution-undo: c4828021067babf12116479690590415b10721d96a8ca12d9d16f45a0fc9e054 2026-09-12 7374617475733a206f70656e
origin: spec-deferred ebb7963b5d9c
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-73: The persistence suite header overstates reload coverage for the cleared-description case.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-source-test-contract-comments
resolution-undo: a76a4c8413ab1f9522820a2ace3807a71cfccc9190e72bb3e41b1435e26c2a3c 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 5000b9059f98
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-74: Story 5 acceptance criteria AC4 and AC6 remain pinned to the pre-activation test inventory and file boundary.

status: done 2026-09-11
origin: spec-deferred 41994f83a590
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
archived: 2026-09-25

### DW-75: Incoming interaction callbacks can still write records from a previous account after the active user changes or teardown begins.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-interaction-record-ownership
resolution-undo: 36085192bfdd9a00d2e10275fcf8718ec07ee7b516b36fc6c20e3e9e0882adaa 2026-09-12 7374617475733a206f70656e
origin: spec-deferred cdf80216e859
source_spec: `spec-dw-35-interaction-subscribe-error-surfacing.md`
severity: high
archived: 2026-09-25

### DW-76: The subscribeInteractions JSDoc example does not match the method's required arguments.

status: done 2026-09-11
origin: spec-deferred 81acc5a7d387
source_spec: `spec-dw-35-interaction-subscribe-error-surfacing.md`
severity: low
archived: 2026-09-25

### DW-77: The existing error-handler test header incorrectly says four callers never import the handler.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-source-test-contract-comments
resolution-undo: a76a4c8413ab1f9522820a2ace3807a71cfccc9190e72bb3e41b1435e26c2a3c 2026-09-12 7374617475733a206f70656e
origin: spec-deferred daacdcd2980b
source_spec: `spec-dw-39-empty-database-error-fallback.md`
severity: low
archived: 2026-09-25

### DW-78: Errors that omit message or code entirely can bypass database classification in service callers.

status: done 2026-09-12
origin: spec-deferred e6d9258059df
source_spec: `spec-dw-39-empty-database-error-fallback.md`
severity: low
archived: 2026-09-25

### DW-79: Auth token persistence may race between overlapping auth events and the duplicate action-service writes.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-decision-dw-79
resolution-undo: 977f0a57bd3de369e757ae7c4e0d16f435a03d43904b8da6a9062c4a084f34f8 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 5d23934f706e
source_spec: `spec-dw-54-55-56-event-load-session-ownership.md`
archived: 2026-09-25

### DW-80: A replacement same-user session without an observed sign-out is not distinguished from a same-session update.

status: done 2026-09-11
origin: spec-deferred 883a7daa57da
source_spec: `spec-dw-54-55-56-event-load-session-ownership.md`
severity: medium
archived: 2026-09-25

### DW-81: A delayed initial getSession result can overwrite a newer auth-listener identity.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-auth-bootstrap-notification-order
resolution-undo: 30550be193d560a0999139ba0de7bc8c278b2e00d6da154dbe892975020e2218 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 70b954c2c502
source_spec: `spec-dw-54-55-56-event-load-session-ownership.md`
severity: medium
archived: 2026-09-25

### DW-82: The interactions slice header incorrectly describes its cross-slice dependencies as self-contained.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-source-test-contract-comments
resolution-undo: a76a4c8413ab1f9522820a2ace3807a71cfccc9190e72bb3e41b1435e26c2a3c 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 37d6cf07740f
source_spec: `spec-dw-75-interaction-record-ownership.md`
severity: low
archived: 2026-09-25

### DW-83: EventsSettings counts UTF-16 code units while PostgreSQL char_length counts Unicode characters.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-unicode-character-limits
resolution-undo: 0be197926a87be6e2c1fbbaed78db765bec7e69a592d2449494dfec36cb22e27 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 40fa82030481
source_spec: `spec-dw-60-63-66-67-68-events-validation-guard-fidelity.md`
severity: medium
archived: 2026-09-25

### DW-84: The helper's existing time-of-day arithmetic can skip a calendar day in a late-evening DST gap.

status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-helper-calendar-day-offsets
resolution-undo: f1f54829eeec8a92362ccf7d56827785f3782bece2e52d1232ce15cc31764d98 2026-09-12 7374617475733a206f70656e
origin: spec-deferred 7ad2fd885b7b
source_spec: `spec-dw-61-64-69-event-test-date-anchors.md`
severity: low
archived: 2026-09-25

### DW-85: The forward DELETE migration is only ever verified on a fresh replay, where the row it deletes never exists.

status: done 2026-09-15
origin: spec-deferred ee22b3cb6330
source_spec: `1-contain-the-exposed-bot-credential.md`
severity: low
archived: 2026-09-25

### DW-86: AGENTS.md carries no durable prose about the bot credential being provisioned out of band or the rotation command.

status: done 2026-09-13
origin: spec-deferred 77116e136280
source_spec: `1-contain-the-exposed-bot-credential.md`
severity: low
archived: 2026-09-25

### DW-87: The retry's re-subscribe cannot rejoin an errored channel at all, because the SDK gates the whole of subscribe() on the channel already being closed.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-realtime-channel-rejoin-lifecycle
resolution-undo: 0cc4137f6b281b58f559fe5e6b090ec351e5bf79bc001829e38a38cee52e68d1 2026-09-14 7374617475733a206f70656e
origin: spec-deferred 7f2be02c1cc5
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: medium
archived: 2026-09-25

### DW-88: getPartnerId() returning null for a transient error is indistinguishable from "unlinked", and would drop every note and mood for the life of the channel.

status: done 2026-09-14
origin: spec-deferred 2f395306ff06
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
archived: 2026-09-25

### DW-89: The Array.isArray guard was adopted at the three broadcast-facing mood sites and not at the four siblings that share the identical idiom.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-mood-array-shape-guards
resolution-undo: db52fa9894ee31ba5b66017c3aac8ac433ce45263c21a54d94782f0a1386fd0a 2026-09-14 7374617475733a206f70656e
origin: spec-deferred c4d4e08547c9
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: low
archived: 2026-09-25

### DW-90: No E2E drives the app's own Realtime clients in a browser against the new policies; live evidence stops at the raw SDK.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-realtime-browser-e2e
resolution-undo: 5c15a4b3473ab95dce8d5efbbfbf9ea1f4df3395307ef5d5fdbbbf666e03049e 2026-09-14 7374617475733a206f70656e
origin: spec-deferred 4e2d371094d1
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: low
archived: 2026-09-25

### DW-91: An effect re-run that lands while the previous run's un-awaited removeChannel is still deregistering is handed the dying channel.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-realtime-channel-rejoin-lifecycle
resolution-undo: 0cc4137f6b281b58f559fe5e6b090ec351e5bf79bc001829e38a38cee52e68d1 2026-09-14 7374617475733a206f70656e
origin: spec-deferred 76257cdda80f
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: low
archived: 2026-09-25

### DW-92: getSignedInUserId() returning null for a transient getSession error is read as "the account changed", which mutes the mood channel until a fresh subscriber re-arms it.

status: done 2026-09-14
origin: spec-deferred e08d417d905d
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
archived: 2026-09-25

### DW-93: The PKCE callback is never exercised against the deployed site: no real Google consent round-trip, and the hosted redirect-URL allow list was not read.

status: done 2026-09-15
origin: spec-deferred 5ada678c7e15
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: medium
archived: 2026-09-25

### DW-94: A PKCE sign-in cannot complete where localStorage is unavailable, which the previous implicit flow tolerated.

status: done 2026-09-14
origin: spec-deferred 33150c174af6
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
archived: 2026-09-25

### DW-95: A code callback that finds no verifier is ignored in silence, with nothing shown to the person who just came back from the provider.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-auth-callback-messages
resolution-undo: 45d33d5c56801a82a03ab02c9101da88d2a9561d993b000e83b939dfb8c7330f 2026-09-14 7374617475733a206f70656e
origin: spec-deferred f540b6e377f9
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
archived: 2026-09-25

### DW-96: The provider-denial callback is as silent as the missing-verifier one, and only the second was recorded.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-auth-callback-messages
resolution-undo: 45d33d5c56801a82a03ab02c9101da88d2a9561d993b000e83b939dfb8c7330f 2026-09-14 7374617475733a206f70656e
origin: spec-deferred 34a72182aa5f
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
archived: 2026-09-25

### DW-97: Every redirect_to assertion runs where BASE_URL is "/", so the production "/My-Love/" base path is pinned nowhere.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-production-base-redirect-assertion — closed on the unit half only, and by a substituted mechanism. This entry's `location:` named two files; `tests/e2e/auth/google-oauth.spec.ts:68` still reads `expect(authorizeParams.get('redirect_to')).toBe(appBaseUrl + '/')` and was deliberately excluded, the story's Never recording that "the deployed-origin round-trip stays operator work under DW-93". The reason text asked this be settled by asserting `redirect_to` against a production-mode build or by reading it during the outstanding deployed-site sign-in; what shipped is neither, but a stubbed `BASE_URL` under happy-dom bound to `vite.config.ts` through `loadConfigFromFile`. That is unit-level evidence, not deployed-site evidence, and DW-93 still carries the hosted half. Recorded here rather than left in the bundle's triage log (DW-126).
resolution-undo: 9a82e817c408383cfb4ee4e071886a4e6b282feec426a7f3d34cf8aab443dba0 2026-09-14 7374617475733a206f70656e
origin: spec-deferred 90661930e678
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
archived: 2026-09-25

### DW-98: Whether an installed PWA returns from Google consent into the same storage partition that wrote the verifier was not established.

status: done 2026-09-15
origin: spec-deferred 194da630c317
source_spec: `3-require-browser-initiated-auth-callbacks.md`
archived: 2026-09-25

### DW-99: storageService.getMessage / updateMessage / deleteMessage / toggleFavorite still reach any row in the messages store by id with no ownership check.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-message-store-ownership-scoping
resolution-undo: ea1805a2ada35a4f2bffdb6ddfe19f128423b1fb03cc6e8e6f4e08bc94b3c14d 2026-09-14 7374617475733a206f70656e
origin: spec-deferred f5bbde9a7366
source_spec: `7-partition-custom-messages-by-account.md`
severity: medium
archived: 2026-09-25

### DW-100: messagesSlice.toggleFavorite set()s after an await with no identity capture or recheck.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-store-identity-guard-gaps
resolution-undo: 5ed869dbc9cc632ed55dafb4788b27e92f4377b334530e348b14959aaeb28d6d 2026-09-14 7374617475733a206f70656e
origin: spec-deferred 50b8808c997c
source_spec: `7-partition-custom-messages-by-account.md`
severity: medium
archived: 2026-09-25

### DW-101: settingsSlice.initializeApp reads get().userId live at two points separated by an await, with no identity capture or recheck around its set({ messages }).

status: done 2026-09-14
resolution: resolved by sweep bundle dw-store-identity-guard-gaps
resolution-undo: 5ed869dbc9cc632ed55dafb4788b27e92f4377b334530e348b14959aaeb28d6d 2026-09-14 7374617475733a206f70656e
origin: spec-deferred c9cd7a4ea314
source_spec: `7-partition-custom-messages-by-account.md`
severity: low
archived: 2026-09-25

### DW-102: The intent's I/O matrix states outcomes at three surfaces (service, store, UI) but the tests occupy two; the "AdminPanel shows none" half of row 1 is unasserted.

status: done 2026-09-15
origin: spec-deferred cd5ea7d12745
source_spec: `7-partition-custom-messages-by-account.md`
severity: low
archived: 2026-09-25

### DW-103: DeleteConfirmDialog calls deleteCustomMessage without await or catch, so a rejected delete closes the dialog as if it succeeded and surfaces as an unhandled rejection.

status: done 2026-09-15
origin: spec-deferred 3c0512dcb4a2
source_spec: `7-partition-custom-messages-by-account.md`
severity: low
archived: 2026-09-25

### DW-104: An unnamed partner is rendered as their full email address in the chat, while the own-name path falls back to the email prefix.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-display-name-edit-and-fallback
resolution-undo: 2a5be6a21fc8557ab95cbf923102fd327464ac93f3ac85eee86f2e3bd7896463 2026-09-14 7374617475733a206f70656e
origin: spec-deferred a5c51df004b8
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
archived: 2026-09-25

### DW-105: If a public.users row were ever absent while its auth user exists, the setup modal could never be satisfied, and the users INSERT policy now has no client caller.

status: done 2026-09-14
origin: spec-deferred 05606ebe644a
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: medium (unverified)
archived: 2026-09-25

### DW-106: Hosted evidence for the migration has not been recorded.

status: done 2026-09-15
origin: spec-deferred 930d06819af2
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
archived: 2026-09-25

### DW-107: The acceptance criterion "the name shows in chat after reload" is not covered end to end.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-display-name-edit-and-fallback
resolution-undo: 2a5be6a21fc8557ab95cbf923102fd327464ac93f3ac85eee86f2e3bd7896463 2026-09-14 7374617475733a206f70656e
origin: spec-deferred 02bb20c02356
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
archived: 2026-09-25

### DW-108: The ledger entry migrated from this story's second deferred item lost its severity when it was written to deferred-work.md.

status: done 2026-09-15
origin: spec-deferred 67f592004a06
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
archived: 2026-09-25

### DW-109: A phx_leave answered 'error' leaves the channel stuck in `leaving`, yet removeChannel still resolves, so the leave-wait clears and the reopen is handed a channel whose subscribe() is gated shut.

status: done 2026-09-15
origin: spec-deferred ab6f498a5c7a
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: medium
archived: 2026-09-25

### DW-110: CLOSED remains an unhandled terminal status, so a close the hook did not ask for leaves the topic permanently silent with no retry scheduled.

status: done 2026-09-15
origin: spec-deferred 2b5328606176
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: medium
archived: 2026-09-25

### DW-111: This is a third uncoordinated per-topic leave registry, against the repo's stated direction to route Realtime work through a shared one.

status: done 2026-09-14
origin: spec-deferred 5770bf9b09b4
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
archived: 2026-09-25

### DW-112: realtimeSocket.ts's header rationale quotes SDK behaviour that no longer matches the installed realtime-js, and this change newly depends on it.

status: done 2026-09-15
origin: spec-deferred c8dd2018bb24
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
archived: 2026-09-25

### DW-113: Giving up after five retries is entrenched with no exit and no signal to the UI, and closingNoteChannels is unobservable from tests.

status: done 2026-09-15
origin: spec-deferred a9a9ffc293cb
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
archived: 2026-09-25

### DW-114: Both DW ledger entries' `location:` fields point at the wrong code, so a future reader reconciling the bundle against the ledger lands in the wrong block.

status: done 2026-09-15
origin: spec-deferred 35b1312c2b70
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
archived: 2026-09-25

### DW-115: The `location:` fields this bundle wrote into the DW ledger are unreliable: one points into a gitignored run directory that cannot be opened later, and the rest land on comment lines or carry no line

status: done 2026-09-15
origin: spec-deferred 169b5ae59949
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
archived: 2026-09-25

### DW-116: The ledger's own reason text states that the run must not edit the ledger, while the same change rewrites two entry statuses and appends six new entries to it.

status: done 2026-09-15
origin: spec-deferred e17ee324ad13
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
archived: 2026-09-25

### DW-117: An eighth site, src/services/moodSyncPayload.ts:58, reads MoodEntry.moods with the same bare truthy-plus-length idiom and was left unguarded.

status: done 2026-09-15
origin: spec-deferred 717f9a6f63ec
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
archived: 2026-09-25

### DW-118: The guard tests the container, not the elements: a genuine MoodType[] holding an unknown mood string still throws at every one of the seven sites.

status: done 2026-09-15
origin: spec-deferred cc319fe80d55
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: medium
archived: 2026-09-25

### DW-119: The offline-first IndexedDB read path normalizes nothing, so the three components that read it each carry their own per-consumer guard instead.

status: done 2026-09-15
origin: spec-deferred 7af76122fac6
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
archived: 2026-09-25

### DW-120: DW-117 dismisses itself with an argument DW-119 contradicts: moodSyncPayload is fed from the unvalidated IndexedDB path, not from addMoodEntry, so its real exposure is higher than filed.

status: done 2026-09-15
origin: spec-deferred 23b5564b69a8
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: medium
archived: 2026-09-25

### DW-121: Nothing pins the Array.isArray idiom, so the consistency this bundle bought decays on the next PR that copies the surviving truthy form.

status: done 2026-09-15
origin: spec-deferred 40c86f3fe220
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
archived: 2026-09-25

### DW-122: Seven hand-rolled copies of one expression and four separate MOOD_CONFIG definitions mean DW-118's element validation would need four key sets rather than one.

status: done 2026-09-15
origin: spec-deferred 0ac06de3be9c
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
archived: 2026-09-25

### DW-123: The sibling private-broadcast path, mood-updates:<partnerId>, still has no browser-level Realtime coverage; DW-90 is closed for love notes only.

status: done 2026-09-15
origin: spec-deferred de21e27d0575
source_spec: `spec-dw-90-realtime-browser-e2e.md`
severity: low
archived: 2026-09-25

### DW-124: `resetPasswordForEmail` composes the same `origin + BASE_URL` prefix as the Google flow, but its composed link is asserted at no base, production or dev.

status: done 2026-09-15
origin: spec-deferred 6d932a2a3909
source_spec: `spec-dw-97-production-base-redirect-assertion.md`
severity: low
archived: 2026-09-25

### DW-125: `navigationSlice.setView`'s production branch and `App.getRoutePath`'s base-stripping branch read the same `import.meta.env.BASE_URL` this story pinned for the authorize URL, and neither branch is

status: done 2026-09-15
origin: spec-deferred 198ce5879b5a
source_spec: `spec-dw-97-production-base-redirect-assertion.md`
severity: medium
archived: 2026-09-25

### DW-126: DW-97's ledger entry names two files and is closed whole, but only the unit half was addressed and the resolution line records neither the carve-out nor the substituted settle mechanism.

status: done 2026-09-15
origin: spec-deferred 59ad7c8a9014
source_spec: `spec-dw-97-production-base-redirect-assertion.md`
severity: low
archived: 2026-09-25

### DW-127: storageService.updateMessage merges `updates` unfiltered, so a caller who may see a row can reassign its owner or convert a shared daily row into a private one.

status: done 2026-09-15
origin: spec-deferred 33d30b016bed
source_spec: `spec-dw-99-message-store-ownership-scoping.md`
severity: medium
archived: 2026-09-25

### DW-128: Shared daily rows stay arbitrarily updatable and deletable by every caller, signed out included, because the by-id guard enforces visibility rather than ownership.

status: done 2026-09-15
origin: spec-deferred 831a770c8b3c
source_spec: `spec-dw-99-message-store-ownership-scoping.md`
severity: medium
archived: 2026-09-25

### DW-129: One row-level isFavorite flag is shared by every account on a device, so each partner sees and can clear the other's favorited daily messages.

status: done 2026-09-15
origin: spec-deferred c98a4ba7aa0c
source_spec: `spec-dw-99-message-store-ownership-scoping.md`
severity: medium
archived: 2026-09-25

### DW-130: A display name can be set once at signup and never changed, because the only form that writes it is unreachable afterwards.

status: done 2026-09-14
resolution: resolved by sweep bundle dw-display-name-edit-and-fallback
resolution-undo: 2a5be6a21fc8557ab95cbf923102fd327464ac93f3ac85eee86f2e3bd7896463 2026-09-14 7374617475733a206f70656e
origin: operator report during post-merge verification of sweep 7, 2026-09-14
severity: medium
archived: 2026-09-25

### DW-131: A `?code=` whose exchange fails in the browser that started the flow -- the ordinary expired-or-reused code -- still ends on the login screen with nothing to read.

status: done 2026-09-15
origin: spec-deferred 1af676a73b92
source_spec: `spec-dw-95-96-auth-callback-messages.md`
severity: medium
archived: 2026-09-25

### DW-132: A password sign-in that resolves with neither an error nor a session leaves the login screen with no feedback at all, and now also clears the callback notice.

status: done 2026-09-15
origin: spec-deferred 50f5b0ba3a4a
source_spec: `spec-dw-95-96-auth-callback-messages.md`
archived: 2026-09-25

### DW-133: A third reader of `users.display_name` still renders a seeded partner's own email address as their name, on the partner-mood surface.

status: done 2026-09-15
origin: spec-deferred 6ea62add7c44
source_spec: `spec-dw-104-107-130-display-name-edit-and-fallback.md`
severity: medium
archived: 2026-09-25

### DW-134: Two sibling destructive buttons still fail WCAG AA contrast with white text on `bg-red-500`.

status: done 2026-09-15
origin: spec-deferred b30b9041cf61
source_spec: `spec-dw-104-107-130-display-name-edit-and-fallback.md`
severity: low
archived: 2026-09-25

### DW-135: initializeApp's mid-flight cases all change userId as well as authSessionVersion, so dropping the version half of stillCurrent() in settingsSlice stays green.

status: done 2026-09-15
origin: spec-deferred c2486f7a296d
source_spec: `spec-dw-100-101-store-identity-guard-gaps-2.md`
severity: medium
archived: 2026-09-25

### DW-136: No case changes identity a second time while the stale-path loadMessages() handoff is in flight, so deleting the inner pair recheck in the .then() stays green.

status: done 2026-09-15
origin: spec-deferred 2102472b0dc6
source_spec: `spec-dw-100-101-store-identity-guard-gaps-2.md`
severity: low
archived: 2026-09-25

### DW-137: Nothing makes the initializeApp stale-path handoff chain reject, so deleting its .catch() stays green. The test double's loadMessages also does not swallow errors the way production does.

status: done 2026-09-15
origin: spec-deferred 8dae3341d08c
source_spec: `spec-dw-100-101-store-identity-guard-gaps-2.md`
severity: low
archived: 2026-09-25

### DW-138: moodSyncService reports an unsolicited CLOSED but has no rejoin for it, so a mood topic closed by the server stays silent for the life of the page.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-dw-mood-channel-closed-rejoin
resolution-undo: 51b235da13de19eaafbd6598d967c09b0a0ea129dff00b8d127e53b16b7dc772 2026-09-15 7374617475733a206f70656e
origin: raised while closing DW-110, 2026-09-15
severity: medium
archived: 2026-09-25

### DW-139: A non-destructive badge pairs white text with bg-purple-500, at 4.12:1.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-dw-badge-contrast-shades
resolution-undo: 8f95a4b0e2a9d093a35cedfb5015a1e19979fec05a43e48b1f65f7842ad21ff3 2026-09-15 7374617475733a206f70656e
origin: raised while closing DW-134, 2026-09-15
severity: low
archived: 2026-09-25

### DW-140: The partner-mood action button pairs white text with bg-green-500, at 2.22:1.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-decision-dw-140
resolution-undo: 41a640e02e5ef2a3bfed871e706e818fa110f554685606288daf3cae7e548eb0 2026-09-15 7374617475733a206f70656e
origin: raised while closing DW-134, 2026-09-15
severity: medium
archived: 2026-09-25

### DW-141: The love-notes send button pairs white text with bg-coral-500, at 1.99:1 — the worst contrast in the app, and not fixable by a shade bump.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-decision-dw-141
resolution-undo: 3a81584d964cd09861eb5d3d1b59ee312b892f68054f4b2bec7ae3c377aeb673 2026-09-15 7374617475733a206f70656e
origin: raised while closing DW-134, 2026-09-15
severity: medium
archived: 2026-09-25

### DW-142: The photo owner badge pairs white text with bg-blue-500/90 over a photograph, at 3.76:1 even before the photo shows through.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-dw-badge-contrast-shades
resolution-undo: 8f95a4b0e2a9d093a35cedfb5015a1e19979fec05a43e48b1f65f7842ad21ff3 2026-09-15 7374617475733a206f70656e
origin: raised while closing DW-134, 2026-09-15
severity: low
archived: 2026-09-25

### DW-143: The app's primary call-to-action is a gradient whose every point fails AA, in ten components, while its own hover state passes.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-decision-dw-143
resolution-undo: dd676099fa1be563a5689ab4e6a46363e0c539df80e00b09b29992dc1215c901 2026-09-15 7374617475733a206f70656e
origin: raised while closing DW-134, 2026-09-15
severity: medium
archived: 2026-09-25

### DW-144: Own-message bubbles still drop below 4.5:1 while isSending applies opacity-70.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-decision-dw-144
resolution-undo: 61e3014acdf427ed3ea44edf2c0c87f856e373f0388f8ba816b0e287173aca1a 2026-09-15 7374617475733a206f70656e
origin: spec-deferred 7390a9ee0dac
source_spec: `spec-dw-141-love-notes-send-button-contrast.md`
severity: low
archived: 2026-09-25

### DW-145: Admin panel title icon still pairs white text with the old pink-500 / rose-500 gradient.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-dw-admin-title-icon-gradient-600
resolution-undo: f3c026f60b04855fe1eac063972140e27f6466a97ff4626e6347a8ad9e184001 2026-09-15 7374617475733a206f70656e
origin: spec-deferred adccd24143eb
source_spec: `spec-dw-143-promote-resting-gradient-to-600.md`
severity: medium
archived: 2026-09-25

### DW-146: Sending... caption remains text-gray-400 on Love Notes #FFF5F5 at 2.433:1.

status: done 2026-09-15
resolution: resolved by sweep bundle dw-sending-caption-contrast
resolution-undo: c0cd6e970276c3ee6a22291708bddd699135932cedb36f245cc7fc9c74ca96e2 2026-09-15 7374617475733a206f70656e
origin: spec-deferred b7c31fb127b5
source_spec: `spec-dw-144-love-notes-sending-opacity.md`
severity: low
archived: 2026-09-25

### DW-147: Leftover scripture test docs and helpers still name deleted modules (tests/README.md tree, example-rpc, factories seed/cleanup, scripture-cache, reflection).

status: done 2026-09-16
origin: spec-deferred 42650e8d0a15
source_spec: `2-remove-scripture-from-the-application.md`
severity: medium
archived: 2026-09-25

### DW-148: AGENTS.md still says five modules open my-love-db after scriptureReadingService was removed.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-agents-md-stale-context
resolution-undo: 6a857189626a77e23877d3615f2c6bd8d1dd610b72319b687a5f0ed94145b639 2026-09-16 7374617475733a206f70656e
origin: spec-deferred 73f04c4b6c19
source_spec: `2-remove-scripture-from-the-application.md`
severity: low
archived: 2026-09-25

### DW-149: AGENTS.md still points the untypechecked render chain at App.tsx (~724); the surviving currentView arms are around :786-797.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-agents-md-stale-context
resolution-undo: 6a857189626a77e23877d3615f2c6bd8d1dd610b72319b687a5f0ed94145b639 2026-09-16 7374617475733a206f70656e
origin: spec-deferred e7ea07c7c0dc
source_spec: `2-remove-scripture-from-the-application.md`
severity: low
archived: 2026-09-25

### DW-150: playwright.config.ts still explains shard policy with scripture specs sorting into one contiguous block.

status: done 2026-09-16
origin: spec-deferred a843636f65c9
source_spec: `2-remove-scripture-from-the-application.md`
severity: low
archived: 2026-09-25

### DW-151: README.md still says 21 migrations; supabase/migrations/ has 38 files.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-readme-migration-count
resolution-undo: c0657b4e23f010076c16d66c6e167b8c45b31c565f8f4166f07460ea6a137870 2026-09-16 7374617475733a206f70656e
origin: spec-deferred 4d45bee2999d
source_spec: `2-remove-scripture-from-the-application.md`
severity: low
archived: 2026-09-25

### DW-152: tests/support/helpers/scripture-cache.ts and reflection.ts remain on disk with zero live importers; scripture-cache still calls indexedDB.deleteDatabase('my-love-db').

status: done 2026-09-16
origin: spec-deferred 16a62f0fd06d
source_spec: `3-drop-the-scripture-database-objects.md`
severity: low
archived: 2026-09-25

### DW-153: tests/api/check-constraint-error-mapping.spec.ts still inventories scripture_reflections among uncovered CHECKs after the envelopes comment was updated to 13 rows.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-leftover-scripture-comments
resolution-undo: 32ee3f03777cb76a29ae46602a76a0ac800096833f47018609f42d291dcb58d0 2026-09-16 7374617475733a206f70656e
origin: spec-deferred 3ecf2c676f0f
source_spec: `3-drop-the-scripture-database-objects.md`
severity: low
archived: 2026-09-25

### DW-154: rls-security.ts and persisted-blob.ts comments still name scripture after the DB objects are gone.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-leftover-scripture-comments
resolution-undo: 32ee3f03777cb76a29ae46602a76a0ac800096833f47018609f42d291dcb58d0 2026-09-16 7374617475733a206f70656e
origin: spec-deferred 9724daa27986
source_spec: `3-drop-the-scripture-database-objects.md`
severity: low
archived: 2026-09-25

### DW-155: Successful openMyLoveDB connections never register idb blocking/versionchange, so the next version bump can hang on these long-lived holders the same way v9 hangs on the service worker.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-idb-live-handle-blocking
resolution-undo: 57b1be35c19d4c129fc00a01979c707214a8d5cfaceb76453d4f5955934dafd9 2026-09-16 7374617475733a206f70656e
origin: spec-deferred feef7bb9b913
source_spec: `4-remove-the-scripture-indexeddb-object-stores.md`
severity: low
archived: 2026-09-25

### DW-156: STORE_NAMES core-names test still omits MESSAGE_FAVORITES, the fifth survivor.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-store-names-favorites-test
resolution-undo: c92cd01649f5d33922d41bddc7ea9142b7324384e347795f1767cfa5799df86c 2026-09-16 7374617475733a206f70656e
origin: spec-deferred 92e581f40d1d
source_spec: `4-remove-the-scripture-indexeddb-object-stores.md`
severity: low
archived: 2026-09-25

### DW-157: window.confirm from the IndexedDB blocked listener is not a user gesture; some browsers may suppress the dialog and take the dismiss path.

status: done 2026-09-16
resolution: resolved by sweep bundle dw-decision-dw-157
resolution-undo: 0456ae08d7694b93ce5b825997a769499223a36191d708b74de857b116d948c5 2026-09-16 7374617475733a206f70656e
origin: spec-deferred 85fc8e2635c1
source_spec: `4-remove-the-scripture-indexeddb-object-stores.md`
archived: 2026-09-25

### DW-158: tests/unit/services/dbSchema.test.ts still says five modules open this database after scriptureReadingService was removed.

status: done 2026-09-16
origin: spec-deferred daeb1a075ba2
source_spec: `spec-dw-148-149-agents-md-stale-context.md`
severity: low
archived: 2026-09-25

### DW-159: tests/e2e/navigation/tray.spec.ts cites the five-place registration bullet at AGENTS.md:25; that line is the Where things are heading and the bullet is :28.

status: done 2026-09-16
origin: spec-deferred 5edb4251adcc
source_spec: `spec-dw-148-149-agents-md-stale-context.md`
severity: low
archived: 2026-09-25

### DW-160: tests/README.md:5 still says Vite 7 while package.json depends on Vite 8.

status: done 2026-09-16
origin: spec-deferred adc3b5235ada
source_spec: `spec-dw-151-readme-migration-count.md`
severity: low
archived: 2026-09-25

### DW-161: README.md:118 key-tables list still omits events.

status: done 2026-09-16
origin: spec-deferred 81e09e60d583
source_spec: `spec-dw-151-readme-migration-count.md`
severity: low
archived: 2026-09-25

### DW-162: README.md project-structure supabase tree still omits functions/, config.toml, and seed.sql.

status: done 2026-09-16
origin: spec-deferred 7e69a56ce63f
source_spec: `spec-dw-151-readme-migration-count.md`
severity: low
archived: 2026-09-25

### DW-163: The rewritten REJECTIONS comment still says the six uncovered CHECKs none of which route through the mapper, but photos, love_notes, and partner_requests write paths call handleSupabaseError on 23514.

status: done 2026-09-16
origin: spec-deferred 026d18064ec4
source_spec: `spec-dw-153-154-leftover-scripture-comments.md`
severity: low
archived: 2026-09-25

### DW-164: Other live tests/api comments still cite deleted scripture specs.

status: done 2026-09-16
origin: spec-deferred f4fcf4981e16
source_spec: `spec-dw-153-154-leftover-scripture-comments.md`
severity: low
archived: 2026-09-25

### DW-165: STORE_NAMES core-names it is five independent toBe asserts, not an exact key set, so extra keys still pass.

status: done 2026-09-16
origin: spec-deferred 7d861b21c35f
source_spec: `spec-dw-156-store-names-message-favorites.md`
severity: low
archived: 2026-09-25

### DW-166: Dock badge counts are never announced, because each dock button's aria-label overrides its content.

status: done 2026-09-22
origin: spec-deferred spec-bottom-dock-navigation, 2026-09-22
source_spec: `spec-bottom-dock-navigation.md`
severity: low
archived: 2026-09-25

### DW-167: AGENTS.md lacks the --dock-clearance rule for fixed-bottom elements and the dock's five-slot limit.

status: done 2026-09-22
origin: spec-deferred spec-bottom-dock-navigation, 2026-09-22
source_spec: `spec-bottom-dock-navigation.md`
severity: low
archived: 2026-09-25

### DW-168: The PWA manifest keeps pink theme_color and background_color, so in dark mode the installed app launches on a pink splash and a pink status bar.

status: done 2026-09-22
origin: spec-deferred ecc80ac034fc
source_spec: `1-style-kit-foundation-and-chrome.md`
severity: low
archived: 2026-09-25

### DW-169: Birthday countdowns count whole 24-hour periods while event countdowns count calendar days, so the same date can read one day apart on Home now that the hh:mm:ss remainder is gone.

status: done 2026-09-22
origin: spec-deferred 711080ac4f4d
source_spec: `2-home-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-170: Frustrated and Angry share the lucide Angry icon, so icon-only surfaces (calendar day cell, timeline icon strip, Partner MoodCard) cannot tell them apart now that per-mood colour is gone.

status: done 2026-09-22
origin: spec-deferred 13d541c1c60e
source_spec: `3-mood-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-171: mood-kit.spec.ts Happy-tile test may flake if today's saved entry re-seeds the form after the test reads aria-pressed or clicks.

status: done 2026-09-22
origin: spec-deferred 27ca4e8fc806
source_spec: `3-mood-on-the-kit.md`
archived: 2026-09-25

### DW-172: The Love Notes error banner has no role or aria-live, so an error that appears without user action is shown but never announced; the realtime notice comment in LoveNotes.tsx claims it matches the

status: done 2026-09-22
origin: spec-deferred eb2d2987cbcf
source_spec: `4-love-notes-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-173: The white-on-colour contrast guard only matches palette shades (bg-<colour>-<shade>), so text-white on a kit token such as bg-partner or bg-fill is never checked in either theme.

status: done 2026-09-22
origin: spec-deferred 2ef2e6965019
source_spec: `4-love-notes-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-174: The unviewed-count badge (the only path that marks an interaction viewed) is a pointer-only span inside the History button, so keyboard and screen-reader users cannot play or clear unviewed

status: done 2026-09-22
origin: spec-deferred 3d9a6c589ed1
source_spec: `5-partner-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-175: whiteOnColorContrast guard cannot measure white text on kit tokens (bg-fill, bg-partner) in either theme.

status: done 2026-09-22
origin: spec-deferred 0c2ed2d61a91
source_spec: `6-photos-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-176: Deleting a photo in PhotoViewer leaves the gallery grid and its count stale.

status: done 2026-09-22
origin: spec-deferred 8903a5279f13
source_spec: `6-photos-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-177: PhotoViewer's inline delete confirm lacks role="dialog", aria-modal and aria-labelledby.

status: done 2026-09-22
origin: spec-deferred da067f212c82
source_spec: `6-photos-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-178: whiteOnColorContrast.test.ts fails with ENOENT in loop worktrees.

status: done 2026-09-22
origin: spec-deferred 2bc119a78139
source_spec: `6-photos-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-179: A failed "load more" in the photo grid is silent, and the scroll trigger keeps retrying.

status: done 2026-09-22
origin: spec-deferred e426c56252ea
source_spec: `6-photos-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-180: The upload modal has no dialog semantics, focus trap or Escape handling.

status: done 2026-09-22
origin: spec-deferred 02d7773d7b3f
source_spec: `6-photos-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-181: The photo viewer's "Photo N of M" counts only the loaded page, so it reads "of 20" for a larger album.

status: done 2026-09-22
origin: spec-deferred 418cb2f2dae1
source_spec: `6-photos-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-182: Error text in the photo upload, edit and delete dialogs is not announced to screen readers.

status: done 2026-09-22
origin: spec-deferred 14867947b6db
source_spec: `6-photos-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-183: A grid tile's caption overlay shows on hover only, never on keyboard focus.

status: done 2026-09-22
origin: spec-deferred 79999ad30b44
source_spec: `6-photos-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-184: Anniversary add/edit and delete dialogs have no role="dialog", aria-modal, aria-labelledby, focus trap, Escape handling or focus return.

status: done 2026-09-22
origin: spec-deferred 0c5b21a8cdf5
source_spec: `7-settings-on-the-kit.md`
severity: medium
archived: 2026-09-25

### DW-185: About row shows a hard-coded "Version 1.0.0" while package.json says 0.0.0.

status: done 2026-09-22
origin: spec-deferred 15e4df806f7d
source_spec: `7-settings-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-186: Kit class strings live in src/components/Settings/kitClasses.ts while PhotoEditModal/PhotoDeleteConfirmation and SECTION_LABEL (MoodTracker, PartnerMoodView, Settings) keep their own copies.

status: done 2026-09-22
origin: spec-deferred 9f0e4dc7db78
source_spec: `7-settings-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-187: Anniversary form field and save errors are not linked or announced (no aria-invalid, aria-describedby, role="alert").

status: done 2026-09-22
origin: spec-deferred b1cf425c9ef7
source_spec: `7-settings-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-188: Every anniversary row's Edit and Delete buttons share the accessible names "Edit anniversary" / "Delete anniversary".

status: done 2026-09-22
origin: spec-deferred c812313e2e2f
source_spec: `7-settings-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-189: Kit input and unselected-option boundaries (ring-line on bg-field over bg-card) are about 1.1:1, below WCAG 1.4.11's 3:1.

status: done 2026-09-22
origin: spec-deferred ed020dce1b27
source_spec: `7-settings-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-190: Dialog backdrops pad with p-4 and ignore safe-area insets under viewport-fit=cover.

status: done 2026-09-22
origin: spec-deferred a0c5d3a0813e
source_spec: `7-settings-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-191: Anniversary delete dialog keeps Cancel enabled while a delete is in flight (Events disables it).

status: done 2026-09-22
origin: spec-deferred 6f4debacd574
source_spec: `7-settings-on-the-kit.md`
severity: low
archived: 2026-09-25

### DW-192: DisplayNameSetup input shows no danger ring while aria-invalid is true.

status: done 2026-09-22
origin: spec-deferred d91f8052dfbf
source_spec: `8-sign-in-and-remaining-surfaces.md`
severity: low
archived: 2026-09-25

### DW-193: ErrorBoundary fallback crashes if a non-Error value is thrown.

status: done 2026-09-22
origin: spec-deferred b08454a7162b
source_spec: `8-sign-in-and-remaining-surfaces.md`
severity: medium
archived: 2026-09-25

### DW-194: Kit dialogs (DisplayNameSetup included) cannot scroll when the panel is taller than a short viewport.

status: done 2026-09-22
origin: spec-deferred 23630a5c419a
source_spec: `8-sign-in-and-remaining-surfaces.md`
severity: low
archived: 2026-09-25

### DW-195: ErrorBoundary error message box has no height limit and centres monospace text.

status: done 2026-09-22
origin: spec-deferred 5ea90f06a664
source_spec: `8-sign-in-and-remaining-surfaces.md`
severity: low
archived: 2026-09-25

### DW-196: "Loading your data..." screen has no test on its kit heart.

status: done 2026-09-22
origin: spec-deferred 557c699cba97
source_spec: `8-sign-in-and-remaining-surfaces.md`
severity: low
archived: 2026-09-25

### DW-197: "Contact admin" stays enabled while the Google redirect is pending.

status: done 2026-09-22
origin: spec-deferred c33cdad02a59
source_spec: `8-sign-in-and-remaining-surfaces.md`
severity: low
archived: 2026-09-25

### DW-198: The pre-kit theme system is dead code that still writes the old pink/gold palette inline on <html>.

status: done 2026-09-23
origin: reviewer note during PR #334 (group E), verified 2026-09-23
severity: low
archived: 2026-09-25

### DW-199: Playing the last unviewed interaction from the Partner badge drops keyboard focus to <body>.

status: done 2026-09-23
origin: reviewer note during PR #334 (group D), verified 2026-09-23
severity: medium
archived: 2026-09-25

### DW-200: The Partner unviewed badge is a 20x20px tap target 2px from History.

status: done 2026-09-23
origin: reviewer note during PR #334 (group D), verified 2026-09-23
severity: low
archived: 2026-09-25

### DW-201: In an album of 41 or more photos, "load more" loads photos 21-40 and the gallery then snaps back to the first 20.

status: done 2026-09-23
origin: reviewer note during PR #334 (group H), verified 2026-09-23
severity: high
archived: 2026-09-25

### DW-202: A photo rejected by validation (over 25 MB, or an unsupported format) shows no error in the upload dialog.

status: done 2026-09-23
origin: reviewer note during PR #334 (group H2), verified 2026-09-23
severity: low
archived: 2026-09-25

### DW-203: After the first upload into an empty album, keyboard focus falls to <body> when the upload dialog closes.

status: done 2026-09-23
origin: reviewer note during PR #334 (group H2), verified 2026-09-23
severity: low
archived: 2026-09-25

### DW-204: The photo carousel, its edit and delete dialogs, and the usePhotos hook are unreachable dead code.

status: done 2026-09-23
origin: investigation of DW-201 to DW-203, verified 2026-09-23
severity: low
archived: 2026-09-25

### DW-205: The upload dialog's 3-second auto-close timer is never cleared, so it can close or reset a newly reopened upload.

status: done 2026-09-23
origin: reviewer note while reviewing DW-201 to DW-203, verified 2026-09-23
severity: low
archived: 2026-09-25

### DW-206: Tapping outside the photo upload dialog does nothing, unlike every other kit dialog.

status: done 2026-09-23
origin: reviewer note while reviewing DW-205, verified 2026-09-23
severity: low
archived: 2026-09-25

### DW-207: `partnerSlice.loadPendingRequests` and `searchUsers` re-check only `userId` after their await, not `{ userId, authSessionVersion }` as AGENTS.md requires.

status: done 2026-09-24
origin: code review during bmad-build of story 1 (PR #340), 2026-09-23
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/1-shared-per-account-local-copy-foundation.md
severity: low
archived: 2026-09-25

### DW-209: AGENTS.md should say that any new account-owned IndexedDB store or local-copy kind must be deleted in `authSlice.deleteAccountData`.

status: done 2026-09-24
origin: code review during bmad-build of story 2 (PR #341), 2026-09-23
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/2-anniversaries-favorites-custom-messages-on-foundation.md
severity: low
archived: 2026-09-25

### DW-210: The AGENTS.md data-model pitfall sits inside the generated `bmad:context` block, so a context refresh may revert its offline-copy wording.

status: done 2026-09-24
origin: code review during bmad-build of story 7 (PR #347), 2026-09-23
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/7-poke-and-kiss-history-offline.md
severity: low
archived: 2026-09-25

### DW-211: AGENTS.md's IndexedDB pitfall miscounted the modules that open `my-love-db`.

status: done 2026-09-24
origin: code review during bmad-build of story 8 (PR #348), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/8-love-notes-readable-offline.md
severity: low
archived: 2026-09-25

### DW-212: The per-account image cache never evicts love-note images: a removed note's image stays on the device and every note image viewed stays cached until sign-out.

status: done 2026-09-24
origin: Claude review of PR #348 at c5e8bfaa (run 35961530433), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/8-love-notes-readable-offline.md
severity: medium
archived: 2026-09-25

### DW-213: A failed love note cannot be dismissed, and a server-rejected queued note comes back on every reload until a Retry succeeds.

status: done 2026-09-24
origin: code review during bmad-build of story 9 (PR #349), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/9-love-note-text-saved-offline-and-sent-later.md
severity: medium
archived: 2026-09-25

### DW-214: With two tabs open, a queued note that the other tab's send got rejected showed "Waiting to send" with no Retry in this tab.

status: done 2026-09-24
origin: follow-up to the two-tab fix on PR #349 (e2e17896), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/9-love-note-text-saved-offline-and-sent-later.md
severity: low
archived: 2026-09-25

### DW-215: When storage is full, the background photo fill re-downloads the same refused photo on every later pass.

status: done 2026-09-24
origin: Claude review of PR #350 at 0c1b68f0 (run 36019833211), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/10-all-photos-viewable-offline.md
severity: low
archived: 2026-09-25

### DW-216: The AnniversarySettings a11y test "after a successful delete removes the opener, focus lands on Add Anniversary" is flaky.

status: done 2026-09-24
origin: CI on PR #351 (failed once, the rerun passed), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-217: Some offline sentences are still written by hand instead of built with `offlineMessage()`, so their wording can drift.

status: done 2026-09-24
origin: code review during bmad-build of story 11 (PR #356), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/11-needs-a-connection-handling-everywhere-else.md
severity: low
archived: 2026-09-25

### DW-218: A custom-message import that fails partway saves some rows on the server but does not show them until the next refresh.

status: done 2026-09-24
origin: code review during bmad-build of story 11 (PR #356), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/11-needs-a-connection-handling-everywhere-else.md
severity: low
archived: 2026-09-25

### DW-219: Offline, the note rate-limit check runs before the connection check, so an offline Retry at the limit shows no message and an offline picture send shows "Failed to send. Try again.".

status: done 2026-09-24
origin: independent review after the story 11 build (PR #356), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/11-needs-a-connection-handling-everywhere-else.md
severity: medium
archived: 2026-09-25

### DW-220: An offline `fetchNotes` clears an existing love-notes error banner before its offline guard, and with notes on screen nothing replaces it.

status: done 2026-09-24
origin: independent review after the story 11 build (PR #356), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/11-needs-a-connection-handling-everywhere-else.md
severity: low
archived: 2026-09-25

### DW-221: Older love notes may be requested when the reader is near the bottom of the thread, not the top, which could page through the whole history.

status: done 2026-09-24
origin: independent review after the story 11 build (PR #356), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/11-needs-a-connection-handling-everywhere-else.md
severity: medium
archived: 2026-09-25

### DW-222: Partner lookups (`GET /rest/v1/users?select=partner_id`) still go out while offline on the Photos and Love Notes screens.

status: done 2026-09-24
origin: independent review after the story 11 build (PR #356), 2026-09-24
source_spec: _bmad-output/specs/spec-unified-data-storage/stories/11-needs-a-connection-handling-everywhere-else.md
severity: low
archived: 2026-09-25

### DW-223: scripts/clear-caches.js is a paste-into-the-console snippet that nothing runs or documents

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-224: scripts/post-deploy-check.cjs lost its only caller when hosting moved to Cloudflare Workers

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-225: scripts/validate-messages.cjs is never run and no longer works against the message file

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-226: src/components/PartnerMoodView/index.ts is a barrel nobody imports

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-227: tests/support/helpers/index.ts is imported only by the frozen e2e archive

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-228: eventsource and dotenv are installed but nothing imports them

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-229: @types/dompurify and @types/react-window are deprecated stubs for libraries that ship their own types

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-230: the service worker imports five workbox packages that package.json does not list

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: medium
archived: 2026-09-25

### DW-231: two unit tests import @supabase/realtime-js, which package.json does not list

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-232: supabaseSchemas.ts carries user, interaction and message schemas and types that nothing uses

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-233: the RelationshipTimers barrel re-exports BirthdayCountdown, which no one imports through it

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-234: defaultMessages.ts exports a messagesByCategory map that nothing reads

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-235: the hooks barrel re-exports the NetworkStatus type, which no one imports through it

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-236: shouldTriggerCelebration and the helper only it uses are dead since the midnight fix

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-237: PhotoUploadInputSchema has had no consumer since the validation barrel was removed

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-238: the test envelope AUTHENTICATED_EVENTS_ICON_CHECK has never been imported

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-239: tests/support/fixtures/index.ts re-exports expect, which nobody takes from there

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-240: eight modules export the same thing both as a named export and as the default

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-241: knip.json ignores four folders that Knip already skips through .gitignore

status: done 2026-09-24
origin: Knip findings audit (knip.json from #352), 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-242: AGENTS.md data-model paragraph says nothing about custom messages and favorites

status: done 2026-09-24
origin: story 12 review (spec-unified-data-storage), 2026-09-24
source_spec: `_bmad-output/specs/spec-unified-data-storage/stories/12-move-custom-messages-and-favorites-onto-the-foundation.md`
severity: low
archived: 2026-09-25

### DW-243: The app animates with framer-motion, which has been renamed to the motion package.

status: done 2026-09-24
origin: outdated-syntax audit, 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-244: Tailwind is still configured partly through the v3-style tailwind.config.js, most of which is unused.

status: done 2026-09-24
origin: outdated-syntax audit, 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-245: The sign-in listener passes an async callback to onAuthStateChange, a pattern Supabase has deprecated.

status: done 2026-09-24
origin: outdated-syntax audit, 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-246: A failed older-notes fetch while online can retry in a loop while the reader stays at the top of the thread.

status: done 2026-09-24
origin: DW-221 fix during the deferred-work clear-out, 2026-09-24
source_spec: none
severity: low
archived: 2026-09-25

### DW-247: planImport's own "Unsupported export version" check is unreachable because the import schema accepts only version 1.0.

status: done 2026-09-26
origin: spec-deferred fb06d3399a77
source_spec: `1-make-every-test-able-to-fail.md`
severity: low
archived: 2026-11-26

### DW-248: authServices tests restore their console.error spy only at the end of each test, so a failing test leaves console.error silenced for later tests.

status: done 2026-09-26
origin: spec-deferred c286f2f5216b
source_spec: `1-make-every-test-able-to-fail.md`
severity: low
archived: 2026-11-26

### DW-249: The stale playwright-utils deviation comment in events-persistence.spec.ts survives in the submitNewEvent docblock.

status: done 2026-09-26
origin: spec-deferred 4ba33866b90d
source_spec: `1-make-every-test-able-to-fail.md`
severity: low
archived: 2026-11-26

### DW-250: interactionsSubscription.test.ts drains a fixed 2-3 microtasks before asserting, which may pass vacuously if the async chain is longer.

status: done 2026-09-26
origin: spec-deferred 64dd49e27fb0
source_spec: `1-make-every-test-able-to-fail.md`
archived: 2026-11-26

### DW-251: getDateLabel counts elapsed ms / 86400000 from local midnight, so just after spring-forward it labels yesterday "Today".

status: done 2026-09-26
origin: spec-deferred b2f5f39a2d35
source_spec: `1-make-every-test-able-to-fail.md`
severity: medium
archived: 2026-11-26

### DW-252: Fixed `await Promise.resolve()` hop counts remain in realtimeLeaveContract and moodSyncSubscription (fireReopen / replacement-SUBSCRIBED).

status: done 2026-09-26
origin: spec-deferred 74ecfb5c4a83
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
archived: 2026-11-26

### DW-253: dateUtils getDaysSince and formatMessageTimestamp share the elapsed-ms / 24 h DST flaw fixed in moodGrouping (G6).

status: done 2026-09-26
origin: spec-deferred d4bd7164a9b7
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: medium
archived: 2026-11-26

### DW-254: e2e waitForLoadState('networkidle') gates on pages with an open Realtime socket.

status: done 2026-09-26
origin: spec-deferred 1fe048f751f0
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
archived: 2026-11-26

### DW-255: dbSchema.test.ts fails about 1 run in 4 under --sequence.shuffle, also before this story.

status: done 2026-09-26
origin: spec-deferred 301cde1beb10
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: medium
archived: 2026-11-26

### DW-256: useRealtimeMessages keeps one real setImmediate as its unhandled-rejection checkpoint.

status: done 2026-09-26
origin: spec-deferred 59c6de880162
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
archived: 2026-11-26

### DW-257: interceptNetworkCall routes in partner-kit / partner-mood are still registered asynchronously and may race page.goto.

status: done 2026-09-26
origin: spec-deferred a98e5c01b508
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
archived: 2026-11-26

### DW-258: Review: dateUtils formatMessageTimestamp / getDaysSince DST mislabel (same as the earlier dateUtils item).

status: done 2026-09-26
origin: spec-deferred e2f980c69ff1
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: medium
archived: 2026-11-26

### DW-259: Review: the remaining real setImmediate in useRealtimeMessages contradicts the literal AC 'no setImmediate waits remain'.

status: done 2026-09-26
origin: spec-deferred 35aa4b255079
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
archived: 2026-11-26

### DW-260: Same-class timing sites with no catalog row may still be scored by a re-review (hop-count drains, fixed act loops, live-clock start dates, lastWelcomeView stamps).

status: done 2026-10-29
origin: spec-deferred 4c7cadc73a15
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
archived: 2026-11-26

### DW-261: Returning to Settings mid-test by dock click is not gated on Settings' own mount read.

status: done 2026-09-26
origin: spec-deferred 766cc171c57d
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
severity: low
archived: 2026-11-26

### DW-262: Non-retrying reads remain in touched specs outside the M1 rows.

status: done 2026-09-26
origin: spec-deferred 5fb54d78dc27
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
severity: low
archived: 2026-11-26

### DW-263: Navigating e2e specs with no M1 row were not audited, so a fresh re-review may still score M1 somewhere.

status: done 2026-10-29
origin: spec-deferred 3454ff3c90a8
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
archived: 2026-11-26

### DW-264: account-data.spec.ts A/B/A favorites fails about 1 run in 6 on a 406 partner-record read during sign-out/sign-in switching.

status: done 2026-09-26
origin: spec-deferred a50ae7184099
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
severity: medium
archived: 2026-11-26

### DW-265: Catch-then-cleanup teardown is skipped when Playwright times the test out.

status: done 2026-09-26
origin: spec-deferred 7cc3807d2e26
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-266: Seeding helpers leak what they already created when a later step of the seed fails.

status: done 2026-09-26
origin: spec-deferred 5b4d24474152
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-267: birthdays-wedding resets the pair to null instead of restoring its prior values, and leaves the couple_settings row in place.

status: done 2026-09-26
origin: spec-deferred f41bef60c847
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-268: love-notes-offline-send teardown deletes while the page is back online, so a queued note can still flush after the delete.

status: done 2026-09-26
origin: spec-deferred c7445457a073
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-269: The shuffled-order guarantee is checked only by hand; no CI or npm script runs vitest shuffled.

status: done 2026-09-26
origin: spec-deferred bc655d22f0e1
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: medium
archived: 2026-11-26

### DW-270: The G6 e2e teardowns still sit in `finally` blocks, which a Playwright timeout skips.

status: done 2026-09-26
origin: spec-deferred 20515cd268c8
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-271: The account-data mood teardown checks the delete's error but not how many rows it deleted.

status: done 2026-09-26
origin: spec-deferred cb54a952fffc
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-272: Isolation advisories that carry no rule id are fixed by no story.

status: done 2026-09-26
origin: spec-deferred 3d5f22cdb7d6
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-273: Two specs outside this diff still throw a bare `AggregateError`, which hides the assertion it wraps in Playwright reports.

status: done 2026-09-26
origin: spec-deferred fe232ea2e183
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
archived: 2026-11-26

### DW-274: A LoveNoteMessage image-cache session test failed once under full-suite load.

status: done 2026-09-26
origin: spec-deferred 05ac70a1571d
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: medium
archived: 2026-11-26

### DW-275: LoginScreen's empty-fields check cannot be reached from the UI, so its kit test covers it only through a raw form submit.

status: done 2026-09-26
origin: spec-deferred 2ff2ecdd08c8
source_spec: `5-drive-component-tests-through-user-event.md`
severity: low
archived: 2026-11-26

### DW-276: The 2026-10-29 src re-review scored two of the commented raw submits this story kept as M5 rows.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e
origin: spec-deferred 2b1d4cbb8c95
source_spec: `5-drive-component-tests-through-user-event.md`
archived: 2026-11-26

### DW-277: AGENTS.md does not record that user-event hangs under Vitest fake setTimeout without both advanceTimers and a jest-global shim.

status: done 2026-09-26
origin: spec-deferred 4656b1984f27
source_spec: `5-drive-component-tests-through-user-event.md`
severity: low
archived: 2026-11-26

### DW-278: The two offline reconnect-read waits now resolve on the first matching GET, so a failed read in that window would throw where waitForResponse skipped it.

status: done 2026-09-26
origin: spec-deferred 45ba081d0688
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
archived: 2026-11-26

### DW-279: No fresh TEA re-review has confirmed the M9 fixes: recurseUntil call sites never name recurse, the deviation comments sit on the line above, and one reason repeats about 30 times.

status: done 2026-10-29
origin: spec-deferred d55a2645e7e9
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
archived: 2026-11-26

### DW-280: The favorites waits in account-data-offline-copy now resolve on the first matching GET, so a failed or cancelled read in the arm window would throw where waitForResponse skipped it.

status: done 2026-09-26
origin: spec-deferred bc6e87ea2a2b
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
archived: 2026-11-26

### DW-281: Hand-rolled page.on request/response listeners and a page.waitForEvent('requestfailed') have no deviation comment, and the acceptance grep does not look for them.

status: done 2026-09-26
origin: spec-deferred c7c485ff65ff
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
archived: 2026-11-26

### DW-282: account-data.spec still asserts response.ok() on the body-matched mood save wait instead of the exact status.

status: done 2026-09-26
origin: spec-deferred c53bfe914423
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
severity: low
archived: 2026-11-26

### DW-283: A fresh TEA re-review may flag M2/L6 instances that no catalog row names, such as the couple-settings server answer built about seven times in tests/unit/stores/coupleSettings.test.ts.

status: done 2026-09-26
origin: spec-deferred 99dfd8ac8662
source_spec: `7-build-test-data-through-factories-and-name-magic-values.md`
archived: 2026-11-26

### DW-284: Lines that no catalog row names still carry the story's defect kinds in files this story edited, so a fresh TEA re-review may flag them.

status: done 2026-09-26
origin: spec-deferred af8d5ee23b56
source_spec: `8-fix-names-selectors-markers-and-test-structure.md`
archived: 2026-11-26

### DW-285: PhotoViewer.focus resets deletePhotoMock inline at the end of each pending-delete test, so a failed assertion leaves a pending mockReturnValue for later tests.

status: done 2026-09-26
origin: spec-deferred e4f57b3211b4
source_spec: `8-fix-names-selectors-markers-and-test-structure.md`
severity: low
archived: 2026-11-26

### DW-286: src/stores/slices/authSlice.ts:98 still names loaderIdentityGuards.test.ts, which this story split into loaderIdentityGuards.*.test.ts; the comment is app code, which this story may not touch.

status: done 2026-09-26
origin: spec-deferred 088b893a1578
source_spec: `9-split-oversize-test-files.md`
severity: low
archived: 2026-11-26

### DW-287: EventsSettings.errorIsolation, .focus, .lifetime and .pagination still keep their own copies of helpers that eventsSettingsKit.tsx now exports (makeEvent, renderSection, fillForm and others).

status: done 2026-09-26
origin: spec-deferred 2c4526a62b93
source_spec: `9-split-oversize-test-files.md`
severity: low
archived: 2026-11-26

### DW-288: Coverage counts non-test helper modules under src/**/__tests__/ as app source, and this story adds two (eventsSettingsKit.tsx, realtimeMessagesKit.ts).

status: done 2026-09-26
origin: spec-deferred df7482a0823c
source_spec: `9-split-oversize-test-files.md`
severity: low
archived: 2026-11-26

### DW-289: InteractionHistory labels a poke "Yesterday" by elapsed hours, not calendar days.

status: done 2026-09-26
origin: orchestrator triage 2026-09-26
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-290: LoginScreen's "Password must be at least 6 characters" branch is probably unreachable for typed input.

status: done 2026-09-26
origin: orchestrator triage 2026-09-26
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-291: playwright-utils' interceptNetworkCall fixture drops the timeout option.

status: done 2026-09-26
origin: orchestrator triage 2026-09-26
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-292: sendPartnerRequest's "This user already has a partner" check can never fire, because RLS hides the target's row.

status: done 2026-09-26
origin: orchestrator review 2026-09-26
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-293: partnerService.hasPartner has no callers.

status: done 2026-09-26
origin: orchestrator review 2026-09-26
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-294: Partner search cannot find anyone, because the users SELECT policy hides every row but the caller's own and their partner's.

status: done 2026-09-26
origin: orchestrator review 2026-09-26
source_spec: n/a
severity: high
archived: 2026-11-26

### DW-295: A partner request to someone already partnered is accepted at insert and stays pending forever.

status: done 2026-09-26
origin: orchestrator review 2026-09-26
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-296: A received partner request shows only the name the sender chose, and one tap on Accept links the accounts for good, so a stranger can pose as the partner.

status: done 2026-10-28
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
source_spec: n/a
severity: medium
archived: 2026-11-26

### DW-297: Partner search matches an email address nobody proved they own, so an account registered with the partner's address before they sign up is offered as the partner.

status: done 2026-10-28
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
source_spec: n/a
severity: medium
archived: 2026-11-26

### DW-298: The "request accepted" broadcast can be missed, and the sender then sees the link only after a reload.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-partner-link-listener-rearm
resolution-undo: 557e899a12936f0cb7f42633f9a2e20bad2908fd238445bf694e1a34e5e9c84b 2026-10-29 7374617475733a206f70656e
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
source_spec: n/a
severity: medium
archived: 2026-11-26

### DW-299: get_my_pending_partner_requests returns the name and email of the other side even when that account already has a partner.

status: done 2026-10-28
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-300: Partner search tells any signed-in caller whether an email has an account and whether its owner has a partner, with no rate limit.

status: done 2026-10-28
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-301: Two OfflineError tests in offlineErrorHandler.test.ts assert the same default fields, so "creates an error with default message" proves nothing that "is an instance of Error" does not.

status: done 2026-10-28
origin: spec-deferred b4fe790b514f
source_spec: `tickets/epic-test-review-remediation/tickets/story-fix-the-2026-10-03-tests-unit-findings-plan.md`
severity: low
archived: 2026-11-26

### DW-302: AdminPanel's failed-delete test checks that an alert appears, not what it says.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-303: upload-love-note-image-limits checks x-ratelimit-remaining only against the limit, which holds by construction.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: medium
archived: 2026-11-26

### DW-304: LoveNoteMessage's retry test cannot see the forceRefresh argument.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4); plan 1.13 Residual risks (A6)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-305: PokeKissInterface's useState setter spy has no positive control while the component is mounted.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-306: The loaderIdentityGuards.events leak checks use JSON.stringify(state), which cannot see inside an Error, Map or Set.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-307: events.spec.ts hard-codes the plural "days" in the expected countdown.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-308: notesSlice.idempotency takes a note's tempId before the queue drain settles.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-309: usePhotoImage.test.ts shares one hoisted PHOTO object across tests.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-310: photoImageCache.test.ts settles a fill by joining a second run, which relies on the module's private coalescing.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4); plan 1.13 Residual risks (A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-311: settleNameLookups never settles when the own-name lookup rejects.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-312: Two auth specs pin "the login screen is gone" in two different ways.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (R5, A4)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-313: Shared test fixtures and constants were invented file by file during the epic; one refactor story should consolidate them.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-shared-test-fixture-consolidation
resolution-undo: 22822117b68bd746577b22173040aca409577ba4671f1daaa8fc98c208919c3b 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (D-dup1 to D-dup7, P-div1, A5)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-314: No audit checks that a full e2e run leaves behind no rows it created.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-leftover-row-audit
resolution-undo: e8079d4aacc37483c3f121fc445fe62d877dd171df3ac0b5b397ab71b1b36ac0 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (S4, A8)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: medium
archived: 2026-11-26

### DW-315: A history read that started before a poke was marked as seen can undo the mark when it answers, so the badge comes back.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-interaction-viewed-read-race
resolution-undo: 72a6b01666ede192297badccb8fbc90e19ec25f8443762e8246c2745fddcfa79 2026-10-29 7374617475733a206f70656e
origin: investigation of the partner-connect poke flake 2026-10-29
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-316: About ten corrections.md items were never re-checked against the code, so Done when 2 is unproven for them.

status: done 2026-10-29
origin: epic-test-review-remediation retrospective 2026-10-29 (S2)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-317: Decision record D1 (e2e page clocks anchor at the live day, never a fixed date) is only half written down where agents read it.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e
origin: epic-test-review-remediation retrospective 2026-10-29 (S6, D1)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
archived: 2026-11-26

### DW-318: Sign-out leaves the outgoing account's synced mood rows on the device.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-synced-moods-signout-delete
resolution-undo: bec72ab16700c1eded375e3e02307c506b8c273be1c6fcc7faa6ebc0a5a14733 2026-10-29 7374617475733a206f70656e
origin: AGENTS.md context refresh 2026-10-29
source_spec: n/a
severity: low
archived: 2026-11-26

### DW-319: A mood row the service worker's background sync marks synced after sign-out stays on the device until that account's next sign-out there.

status: done 2026-10-29
origin: spec-deferred 77375ef75a5a
source_spec: `plan-dw-synced-moods-signout-delete.md`
severity: low
archived: 2026-11-26

### DW-320: The same JSON.stringify(state) leak check, blind to Error/Map/Set, is used outside the events file.

status: done 2026-10-29
origin: spec-deferred b8c7828c1182
source_spec: `plan-dw-store-service-test-determinism.md`
severity: low
archived: 2026-11-26

### DW-321: Complete list of the leak checks outside the events file that still use plain JSON.stringify on store state (it supersedes the incomplete item above).

status: done 2026-10-29
resolution: resolved by sweep bundle dw-leak-check-serialized-store
resolution-undo: 80c135a45c09b0270df5e1f44af4223ebd5ce9cde626d4c69b7c9b5915e434ba 2026-10-29 7374617475733a206f70656e
origin: spec-deferred a4946ac45884
source_spec: `plan-dw-store-service-test-determinism.md`
severity: low
archived: 2026-11-26

### DW-322: upload-love-note-image's 10-per-minute-per-user rate limit is kept in isolate memory, so it is not enforced once one user's requests spread across isolates.

status: done 2026-10-29
resolution: resolved by sweep bundle dw-love-note-upload-shared-rate-limit
resolution-undo: 45d6f6c51380300a04d0a207ec090ed080e768bd967ac55b5520acba78842457 2026-10-29 7374617475733a206f70656e
origin: spec-deferred cdcdf5b24fcb
source_spec: `plan-dw-e2e-assertion-precision.md`
severity: medium
archived: 2026-11-26

### DW-323: Google sign-in cannot work inside the native iOS shell.

status: done 2026-10-29
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
severity: medium
archived: 2026-11-26

### DW-324: Password-reset emails sent from the native shell link to capacitor://localhost.

status: done 2026-10-29
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
severity: medium
archived: 2026-11-26

### DW-325: Haptics do nothing on iPhone, in the PWA and in the native shell alike.

status: done 2026-10-29
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
severity: low
archived: 2026-11-26

### DW-326: The native shell still shows Capacitor's default splash screen.

status: done 2026-11-02
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
severity: low
archived: 2026-11-26

### DW-327: The dock's unseen-count badges are never fed, so the dock never shows one.

status: done 2026-11-02
origin: raised 2026-10-29 while slicing epic-iphone-duo-native-tab-bar
severity: low
archived: 2026-11-26

### DW-328: The column rule's "both side insets non-zero means no column" case is unmeasured on a non-Duo iPhone.

status: done 2026-10-30
origin: raised 2026-10-30 by the quick review of epic-iphone-duo-native-tab-bar story 7 (the side-column detection spike)
severity: medium (unverified)
archived: 2026-11-26

### DW-329: The sim driver's work dir is shared, so two runs on simulator clones would clobber each other.

status: done 2026-10-31
origin: raised 2026-10-30 by the quick review of epic-iphone-duo-native-tab-bar story 9 (the simulator driver)
severity: medium
archived: 2026-11-26

### DW-330: The sim driver's default work dir is shared by every run, so two stories driving two simulator clones at once (which AGENTS.md now allows) would clobber each other's stage, runner, drive log and

status: done 2026-10-31
origin: spec-deferred 9ebb86d180dd
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-simulator-driver-is-a-repo-tool-plan.md`
severity: medium
archived: 2026-11-26

### DW-331: A browser that reports one small side inset (likely Android Chrome in landscape with a one-sided display cutout, under viewport-fit=cover) would get the column form, with 44 px buttons spilling out of

status: done 2026-11-02
origin: spec-deferred a700fe97b803
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-dock-becomes-a-capsule-in-the-side-column-without-coveri-plan.md`
severity: medium
archived: 2026-11-26

### DW-332: The sim driver's signin appends to whatever the login fields already hold, so a retry after a failed first attempt types onto the leftover email and is refused.

status: done 2026-10-31
origin: spec-deferred 45d95a4edb9e
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-settings-is-the-sixth-button-in-the-column-dock-plan.md`
severity: medium
archived: 2026-11-26

### DW-333: Story 8's column-form clause on AGENTS.md's "A new view is registered in five hand-maintained places" line sits inside the bmad:context managed block, so a context refresh may drop it.

status: done 2026-10-31
origin: spec-deferred 4aaacfef0310
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-settings-is-the-sixth-button-in-the-column-dock-plan.md`
severity: low
archived: 2026-11-26

### DW-334: The sim driver cannot switch Device Hub's window, so `ax` reaches a non-Duo simulator only after someone selects it there.

status: done 2026-11-02
origin: raised 2026-10-31 by epic-iphone-duo-native-tab-bar story 4 (the refactor sweep), from story 9's and story 2's residual risks
severity: low
archived: 2026-11-26

### DW-335: AGENTS.md's "never write an email address into `_bmad-output/`" rule cannot be followed as written: fictional fixture addresses and the required commit trailer already break it.

status: done 2026-11-02
origin: raised 2026-10-30 by the quick review of epic-iphone-duo-native-tab-bar story 9 (rejected there, because the fix edits that build's own plan); recorded 2026-10-31 by story 4 (the refactor sweep)
severity: low
archived: 2026-11-26

### DW-336: The sim driver's old shared folders at the cache root are orphaned since the work dir became per checkout.

status: done 2026-11-02
origin: raised 2026-10-31 by the quick review of epic-iphone-duo-native-tab-bar story 4 (the refactor sweep), which moved the default work dir (DW-329)
severity: low
archived: 2026-11-26

### DW-337: AGENTS.md's sim-driver line says concurrent Duo stories may each run in their own worktree on their own simulator clone, but the driver's `ax` commands may reach only the device Device Hub's window

status: done 2026-11-02
origin: spec-deferred f5609f6c2d08
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-refactor-sweep-plan.md`
severity: medium
archived: 2026-11-26

### DW-338: The sim driver's `center` reads Notification Center past one screen unreliably: its scroll-and-merge code is unproven and can merge, split or cut short groups

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-one-screen
resolution-undo: 2ecb451ec71336ba2dd3eb5040fb949b8b3ed6d86f65b7e6cff0c86cc597792d 2026-11-02 7374617475733a206f70656e
origin: spec-deferred story-3.12 review
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-and-taps-notifications-plan.md`
severity: medium
archived: 2026-11-26

### DW-339: sim center's multi-screen read (scroll and merge) is unproven and can cut groups short, merge two threads with identical text, collapse duplicates, or count an unreachable stack as one notification.

status: done 2026-10-31
origin: spec-deferred cbe0cc5a3421
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-and-taps-notifications-plan.md`
severity: medium
archived: 2026-11-26

### DW-340: send-push claims a (note, device) row before the APNs call, so a sender killed mid-send drops that push and nothing retries

status: done 2026-11-02
origin: spec-deferred story-3.1 review
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium
archived: 2026-11-26

### DW-341: send-push treats a picture-only note as one with an image and blank text, but the real stand-in text is unverified

status: done 2026-11-01
origin: spec-deferred story-3.1 review
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-342: A send-push claim is inserted before the APNs call, so an isolate killed between claim and send drops that push for good, and nothing re-calls the sender for a released claim.

status: done 2026-10-31
origin: spec-deferred a15d99cc6689
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium
archived: 2026-11-26

### DW-343: Picture-only detection assumes the stand-in text is blank; the composer sends an empty string and love_notes_content_check needs at least one character, so the real stand-in is unverified.

status: done 2026-10-31
origin: spec-deferred 431bc8339dd8
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium
archived: 2026-11-26

### DW-344: sim banner --tap cold on the unfolded Duo can miss once: the banner is gone before the tap reaches it

status: done 2026-11-02
origin: spec-deferred story-3.14 review
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium
archived: 2026-11-26

### DW-345: sim center drops "+N from <app>" summary cells; past 8 groups a summary may stand for groups that are not listed, undercounting silently

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-one-screen
resolution-undo: 2ecb451ec71336ba2dd3eb5040fb949b8b3ed6d86f65b7e6cff0c86cc597792d 2026-11-02 7374617475733a206f70656e
origin: spec-deferred story-3.14 review
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-346: sim banner --tap cold on the unfolded Duo can miss once because the banner is gone before the tap reaches it.

status: done 2026-10-31
origin: spec-deferred 4e4a0337de4b
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium
archived: 2026-11-26

### DW-347: center drops "+N from <app>" summary cells; past 8 groups a summary may stand for groups never listed, undercounting silently.

status: done 2026-10-31
origin: spec-deferred 2e36cea7cace
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium
archived: 2026-11-26

### DW-348: center's coordinate-tap fallback logs nothing, and test-center-exit.zsh never stubs a phone with only Rotate Left, so neither path can be shown to work.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-one-screen
resolution-undo: 2ecb451ec71336ba2dd3eb5040fb949b8b3ed6d86f65b7e6cff0c86cc597792d 2026-11-02 7374617475733a206f70656e
origin: spec-deferred c0f2e3e5b8e2
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-349: AGENTS.md's sim-driver clause says center puts the pose and orientation back, without sim help's exception for a folded landscape.

status: done 2026-11-01
origin: spec-deferred 5cff3711aeb0
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: low
archived: 2026-11-26

### DW-350: center leaves the Home Screen in front after a folded-portrait or unfolded start; only a folded-landscape start brings its front app back.

status: done 2026-11-01
origin: spec-deferred 14bd1d434eba
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: low
archived: 2026-11-26

### DW-351: sim banner exits 130 on TERM as well as INT, while center now exits 143 on TERM.

status: done 2026-11-01
origin: spec-deferred 05678d9d50dc
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: low
archived: 2026-11-26

### DW-352: Sign-out leaves the outgoing account's delivered notifications (love-note pushes and date reminders) in Notification Center, so the next person on a shared device can read them.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-clears-notifications
resolution-undo: b04da7f46545fbcaa346ae11efa04b980a6f5b208f9ab1392bb4755eae75bae2 2026-11-02 7374617475733a206f70656e
origin: spec-deferred story-3.2 plan
source_spec: `tickets/epic-push-notifications/tickets/story-sign-out-stops-a-device-s-pushes-plan.md`
severity: low
archived: 2026-11-26

### DW-353: A push_devices row outlives the install or session that registered it (reinstall, offline sign-out, or a session ended elsewhere), and only an APNs 410 removes it, which may never come.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-everywhere
resolution-undo: 051accdf846088fbef5b51bd6f3357876d3a16d827d043cb8100d2787d2fb8df 2026-11-02 7374617475733a206f70656e
origin: review story-3.2
source_spec: `tickets/epic-push-notifications/tickets/story-sign-out-stops-a-device-s-pushes-plan.md`
severity: low
archived: 2026-11-26

### DW-354: A reinstalled shell leaves its old token's push_devices row on the account; only the sender's APNs 410 cleanup removes it, which never runs on the local stack.

status: done 2026-11-01
origin: spec-deferred 24a607eba37a
source_spec: `tickets/epic-push-notifications/tickets/story-sign-out-stops-a-device-s-pushes-plan.md`
severity: low
archived: 2026-11-26

### DW-355: Every push to main now rebuilds both Edge Functions from the unpinned esm.sh import, so production functions can change with no reviewed change, and an esm.sh outage blocks a frontend-only site deploy.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-pin-edge-supabase-js
resolution-undo: c5ac684b11adaf4e0287144b8d69060bbd70dab23125f5b61f135345802238d2 2026-11-02 7374617475733a206f70656e
origin: review story-3.3
source_spec: `tickets/epic-push-notifications/tickets/story-every-edge-function-deploys-from-deploy-yml-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-356: A device that signs out offline leaves its old token's push_devices row, APNs keeps accepting pushes to that unregistered token with 200 instead of 410, so the sender never deletes it and sends to it on every note.

status: done 2026-11-02
origin: story-3.13
source_spec: `tickets/epic-push-notifications/tickets/story-pushes-arrive-through-apns-on-a-device-and-from-the-hosted-p-plan.md`
severity: low
archived: 2026-11-26

### DW-357: `src/types/database.types.ts` is not what AGENTS.md's regeneration command writes: since story 3.1 each regeneration has been reformatted to the file's style with the CLI's `ComputedFields: never` lines dropped, so the documented command now rewrites the whole file.

status: done 2026-11-01
origin: review story-3.4
source_spec: `tickets/epic-push-notifications/tickets/story-moods-photos-pokes-and-kisses-push-plan.md`
severity: low
archived: 2026-11-26

### DW-361: A push that arrives while Love Notes is in front can leave its badge showing on a real iPhone, because the second badge clear waits a fixed 1 s that was measured only on the simulator.

status: done 2026-11-01
origin: review story-3.8
source_spec: `tickets/epic-push-notifications/tickets/story-love-notes-stack-apart-and-the-badge-counts-unread-notes-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-363: A picture-only love note sent from the app is refused by love_notes_content_check: the composer clears as if it sent, the note shows as failed, and Retry fails the same way

status: done 2026-11-02
origin: story-3.10
source_spec: `tickets/epic-push-notifications/tickets/story-refactor-sweep-plan.md`
severity: medium
archived: 2026-11-26

### DW-364: sim help and AGENTS.md say center "ends on the Home Screen, except that a folded-landscape start gets its front app back", which misses a landscape start on a phone with no pose and a front step that found no app.

status: done 2026-11-02
origin: spec-deferred 608c912c1e07
source_spec: `tickets/epic-push-notifications/tickets/story-refactor-sweep-plan.md`
severity: low
archived: 2026-11-26

### DW-365: `scripts/sim-driver/pending.py` checks no record-level schema marker, so an iOS release that keeps the pending archive's key names but changes their meaning would decode without error

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-pending-schema-markers
resolution-undo: 29c914fde9708340ccb345f20f477c926e50327447685d7ef04c2cee1d2d3ad4 2026-11-02 7374617475733a206f70656e
origin: story-4.7
source_spec: `tickets/epic-date-reminders/tickets/story-the-simulator-driver-lists-an-app-s-scheduled-reminders-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-366: AGENTS.md's sentence on `sim schedule`/`sim unschedule` omits two side effects: both launch the host app and bring it to the front, and `sim permission reset --host` uninstalls the host and so wipes its pending requests

status: done 2026-11-01
origin: story-4.7
source_spec: `tickets/epic-date-reminders/tickets/story-the-simulator-driver-lists-an-app-s-scheduled-reminders-plan.md`
severity: low
archived: 2026-11-26

### DW-369: The AGENTS.md sentence on `sim schedule` does not say the host needs `sim permission allow --host` first, so a later story's first schedule exits 1 and has to be rerun.

status: done 2026-11-01
origin: spec-deferred e0029a1bba77
source_spec: `tickets/epic-date-reminders/tickets/story-the-simulator-driver-lists-an-app-s-scheduled-reminders-plan.md`
severity: low
archived: 2026-11-26

### DW-370: On a first sign-in the launch plan can find notification permission not yet granted, and nothing re-plans once the person taps Allow until the next launch.

status: done 2026-11-01
origin: spec-deferred ec751e5258fa
source_spec: `tickets/epic-date-reminders/tickets/story-the-planner-schedules-every-date-s-day-before-and-on-the-day-plan.md`
severity: low
archived: 2026-11-26

### DW-371: The `sim help` text and the AGENTS.md sim-driver sentence say `sim dates kinds|many` replace only the seeded events, but they first clear both people's anniversaries, the pair's couple_settings row

status: done 2026-11-01
origin: spec-deferred 356b1422e4d3
source_spec: `tickets/epic-date-reminders/tickets/story-the-planner-schedules-every-date-s-day-before-and-on-the-day-plan.md`
severity: low
archived: 2026-11-26

### DW-372: `sim pending` can report "nothing has been scheduled since ... installed" (and []) while requests are pending, because the simulator writes PendingNotifications.plist some time after `schedule`

status: done 2026-11-01
origin: spec-deferred 533ac45bf375
source_spec: `tickets/epic-date-reminders/tickets/story-the-planner-schedules-every-date-s-day-before-and-on-the-day-plan.md`
severity: low
archived: 2026-11-26

### DW-373: A re-plan cancels only the ids `getPending` reports, so if a follow-up re-plan's `getPending` misses requests the previous run just scheduled, ids above the new N stay pending.

status: done 2026-11-01
origin: spec-deferred 4cdc45753d6d
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-re-plan-on-every-change-stop-at-sign-out-stack-wit-plan.md`
severity: medium
archived: 2026-11-26

### DW-374: `src/types/database.types.ts` gets each new table's block inserted in the committed file's style, because `supabase gen types typescript --local` on CLI 2.122.0 no longer reproduces the committed

status: done 2026-11-02
origin: spec-deferred 8482db9d6aac
source_spec: `tickets/epic-date-reminders/tickets/story-dates-marked-for-the-countdown-remind-a-month-and-a-week-bef-plan.md`
severity: low
archived: 2026-11-26

### DW-375: The iOS simulator ignores a host clock jump until it is rebooted, and the sim driver has no step for it, so a check that moves the Mac clock to make a reminder fire sees nothing fire.

status: done 2026-11-02
origin: story 4.8 simulator checks, 2026-11-01
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
archived: 2026-11-26

### DW-376: A date reminder firing while the shell is in the foreground was never observed; the plugin's default `willPresent` should show a banner, but no check confirms it.

status: done 2026-11-02
origin: story 4.8 simulator checks, 2026-11-01
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
archived: 2026-11-26

### DW-377: An offline sign-out leaves the account's refresh token valid on the server indefinitely, because nothing revokes it once the device is back online and no session timebox is set.

status: done 2026-11-02
origin: story 4.8 thorough review, 2026-11-01
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
archived: 2026-11-26

### DW-378: While the app runs on a stored session the SDK cannot use, Realtime channels may join with the publishable key and stay muted after the token renews.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-realtime-recovery-after-renewal
resolution-undo: db00046158db0bae449549e28442c6371d4363a2028fc0fa225a0e94cabb8016 2026-11-02 7374617475733a206f70656e
origin: story 4.8 thorough review, 2026-11-01
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
archived: 2026-11-26

### DW-379: AGENTS.md does not yet state the session rules story 4.8 introduced.

status: done 2026-11-01
origin: story 4.8 thorough review, 2026-11-01
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
archived: 2026-11-26

### DW-380: A countdown mark on the partner's birthday is keyed `partner-birthday`, not by the partner, so after an unlink and a link to someone else it marks the new partner's birthday.

status: done 2026-11-02
origin: story 4.2 residual risk, carried in by story 4.4, 2026-11-01
source_spec: `tickets/epic-date-reminders/tickets/story-dates-marked-for-the-countdown-remind-a-month-and-a-week-bef-plan.md`
severity: low
archived: 2026-11-26

### DW-381: Offline, or after a failed read, Settings shows the "Date reminders" switch on (disabled) while the saved copy says off, because nothing seeds the store's push preferences from the `push-preferences` local copy.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-preferences-saved-copy
resolution-undo: 56a0a8b609c0d775e125b17c47bb18a344e21e1a0204ed542d96495a1d8e50d6 2026-11-02 7374617475733a206f70656e
origin: story 4.3 review (rejected there under its unchanged-load-behaviour rule), carried in by story 4.4, 2026-11-01
source_spec: `tickets/epic-date-reminders/tickets/story-a-settings-switch-turns-date-reminders-off-plan.md`
severity: low
archived: 2026-11-26

### DW-382: The docs this sweep added for DW-372 say iOS writes PendingNotifications.plist "up to about 25 s after a schedule", but no measurement bounds the lag on a fresh install's first schedule.

status: done 2026-11-02
origin: spec-deferred 8a19bda4005c
source_spec: `tickets/epic-date-reminders/tickets/story-refactor-sweep-plan.md`
severity: low
archived: 2026-11-26

### DW-383: A device clock far ahead of real time, online, makes supabase-js refresh the session in a loop until GoTrue answers 429, and the SDK then signs the device out.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-session-device-relative-expiry
resolution-undo: ce31c7258ea1b5ae305ceb0e442d53638df4b42816fb54983de29c8dfd29184f 2026-11-02 7374617475733a206f70656e
origin: spec-deferred story-4-5-ship
source_spec: `tickets/epic-date-reminders/tickets/story-date-reminders-ship-to-the-owner-s-iphone-plan.md`
severity: low
archived: 2026-11-26

### DW-384: A session that ends without the app's Sign out (a refresh the SDK gives up on, or a sign-out of all devices from elsewhere) leaves the device's push_devices row on the account.

status: done 2026-11-02
origin: spec-deferred story-4-5-ship
source_spec: `tickets/epic-date-reminders/tickets/story-date-reminders-ship-to-the-owner-s-iphone-plan.md`
severity: low
archived: 2026-11-26

### DW-385: AGENTS.md's sim-driver paragraph does not name `sim reboot` or `sim watch`.

status: done 2026-11-02
origin: plan-dw-375-376-sim-reboot-and-watch review, 2026-11-02
source_spec: `plan-dw-375-376-sim-reboot-and-watch.md`
severity: low
archived: 2026-11-26

### DW-386: "Sign out of all devices" reports success when only this device was signed out.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-everywhere
resolution-undo: 051accdf846088fbef5b51bd6f3357876d3a16d827d043cb8100d2787d2fb8df 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L1, 2026-11-02
severity: medium
archived: 2026-11-26

### DW-387: "Sign out of all devices" acts on one tap, with no confirmation.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-everywhere
resolution-undo: 051accdf846088fbef5b51bd6f3357876d3a16d827d043cb8100d2787d2fb8df 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L16, 2026-11-02
severity: low
archived: 2026-11-26

### DW-388: App.tsx's auth-check comment says a present session means the callback outcome is null, which is false for an implicit-grant error redirect.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-auth-callback-comment
resolution-undo: e6ab390a78d48124a9fdc780e475154c434db77610befa807d870188423dccbc 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L17, verified 2026-11-02
severity: low
archived: 2026-11-26

### DW-389: A device that is only resumed keeps planning date reminders from stale copies: a mark, switch or partner birthday changed elsewhere arrives only after a full restart or reconnect.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-replan-timing
resolution-undo: bef106d32d6d3e89afddaca578b91d4c6b34a9a99e40b6aa110e3f7db7e29975 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A6/L3, 2026-11-02
severity: medium
archived: 2026-11-26

### DW-390: Date reminders fire with no sound.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-default-sound
resolution-undo: 4c116e065311b4a915de0daf0a0c2bc8378770ff6ce0121464318a44c7512fe7 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L2, 2026-11-02
severity: medium (unverified)
archived: 2026-11-26

### DW-391: The love-notes re-arm can get stuck reconnecting when its openChannel rejects.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-realtime-recovery-after-renewal
resolution-undo: db00046158db0bae449549e28442c6371d4363a2028fc0fa225a0e94cabb8016 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L4, 2026-11-02
severity: low
archived: 2026-11-26

### DW-392: Turning date reminders off cancels nothing while any other saved copy is missing.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-off-cancels-alone
resolution-undo: ac06a2ca4ec8837963f0ec6925b2f1334207ebbcd80800986a1e27e7948e4d78 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A7, 2026-11-02
severity: low
archived: 2026-11-26

### DW-393: A failed background refresh of the push settings disables an open Settings section.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-preferences-saved-copy
resolution-undo: 56a0a8b609c0d775e125b17c47bb18a344e21e1a0204ed542d96495a1d8e50d6 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L5, 2026-11-02
severity: low
archived: 2026-11-26

### DW-394: PushSettings.test.tsx asserts only that console.error was called.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-preferences-saved-copy
resolution-undo: 56a0a8b609c0d775e125b17c47bb18a344e21e1a0204ed542d96495a1d8e50d6 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A5, 2026-11-02
severity: low
archived: 2026-11-26

### DW-395: The countdown marks list offers dates that can never schedule a reminder.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-countdown-marks-list-matches-plan
resolution-undo: 96b338e4fac679710e3c04d2e8768cec101b1f4fe642204ed96b1344e5dcdbae 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A4/L10, 2026-11-02
severity: low
archived: 2026-11-26

### DW-396: The date reminders switch says "At 9:00 before each date.", but birthdays and anniversaries also remind on the day.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-countdown-marks-list-matches-plan
resolution-undo: 96b338e4fac679710e3c04d2e8768cec101b1f4fe642204ed96b1344e5dcdbae 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L11, 2026-11-02
severity: low
archived: 2026-11-26

### DW-397: `sim dates kinds|many|clear` leaves countdown marks and the date-reminders switch behind.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-dates-clear-marks
resolution-undo: bc6330b9d88371af0a1a8d44a6c0475988b2b4ec8826a2b408f3f7723e3dd3c7 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L6, 2026-11-02
severity: low
archived: 2026-11-26

### DW-398: AGENTS.md does not warn that every date-reminder re-plan cancels every pending local notification.

status: done 2026-11-02
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L14, 2026-11-02
severity: low
archived: 2026-11-26

### DW-399: settingsSlice.ts has grown to 1116 lines with six registerLocalCopy kinds.

status: done 2026-11-03
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A2, 2026-11-02
severity: low
archived: 2026-11-26

### DW-400: The launch re-plan of date reminders waits for the slowest copy refresher, and the partner lookup has no request timeout.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-replan-timing
resolution-undo: bef106d32d6d3e89afddaca578b91d4c6b34a9a99e40b6aa110e3f7db7e29975 2026-11-02 7374617475733a206f70656e
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L9, 2026-11-02
severity: low (unverified)
archived: 2026-11-26

### DW-401: Date reminders may never fire on a device set to a non-Gregorian calendar.

status: done 2026-11-02
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L12, 2026-11-02
severity: low (unverified)
archived: 2026-11-26

### DW-402: A lost phone keeps its scheduled date reminders after "Sign out of all devices".

status: done 2026-11-02
origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L8, 2026-11-02
severity: low
archived: 2026-11-26

### DW-403: center's restore on a Rotate-Left-only phone and tap(_:)'s coordinate fallback on the inner display have never been observed on a simulator.

status: done 2026-11-02
origin: split from DW-348 by the 2026-11-02 ledger triage
severity: medium (unverified)
archived: 2026-11-26

### DW-404: A failed center's restore skips its "could not restore" report: when die's exit (nested below cmd_center) runs center's EXIT trap, zsh 5.9 ends the trap as soon as a function it calls directly

status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-restore-subshell
resolution-undo: 52a3cbe47b39286c8cb6953e0f685f3409c738a1713e9c550f0323a99e5e80c8 2026-11-02 7374617475733a206f70656e
origin: spec-deferred 9f0d4541ec07
source_spec: `plan-dw-sim-center-one-screen.md`
severity: low
archived: 2026-11-26

### DW-405: center's one-screen check (no stacked cell left, and neither a drag nor a swipe down the list moves a cell) has not been run on a simulator.

status: done 2026-11-02
origin: spec-deferred f1809e113bbf
source_spec: `plan-dw-sim-center-one-screen.md`
severity: low
archived: 2026-11-26

### DW-406: After "Sign out everywhere", another device whose access token has not yet expired can re-register its push_devices row, so a lost phone opened within about an hour keeps receiving pushes until an

status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-register-session-check
resolution-undo: 0a5864b1b6284bf808388361b35ec0695f3ddb78b43e86ad46388a30fc0f93fb 2026-11-02 7374617475733a206f70656e
origin: spec-deferred 15f1bfb60d36
source_spec: `plan-dw-sign-out-everywhere.md`
severity: medium
archived: 2026-11-26

### DW-407: DW-352's native removal is unverified on a shell: no simulator check yet shows sign-out emptying Notification Center of delivered pushes and date reminders.

status: done 2026-11-02
origin: spec-deferred e63b7bcda168
source_spec: `plan-dw-sign-out-clears-notifications.md`
severity: low
archived: 2026-11-26

### DW-408: An account switch without a sign-out (in place, or a fresh sign-in whose owner marker names another account) leaves the outgoing account's delivered notifications in Notification Center.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-account-switch-clears-delivered
resolution-undo: 92e0c22e3cba748ed6298bc6f8c758ca82890213e08ffd6f0f26614b21af443f 2026-11-02 7374617475733a206f70656e
origin: spec-deferred ff783ef05e40
source_spec: `plan-dw-sign-out-clears-notifications.md`
severity: low
archived: 2026-11-26

### DW-409: PartnerMoodView.kit.test.tsx "enables refresh when online" failed once under the full unit suite with the refresh button still `aria-busy` and disabled, and passed on 3 isolated reruns and 2 later

status: done 2026-11-02
resolution: resolved by sweep bundle dw-partner-mood-refresh-test-flake
resolution-undo: 4e6874687b678d5b27c3d7d79dc252b4e1195449554a010f7c0cbdc6540fa67a 2026-11-02 7374617475733a206f70656e
origin: spec-deferred 5bd4d01176e8
source_spec: `plan-dw-sign-out-clears-notifications.md`
severity: low
archived: 2026-11-26

### DW-410: The pinned esm.sh supabase-js 2.118.0 bundle still floats one transitive dependency: storage-js 2.118.0 imports iceberg-js through the range ^0.8.1.

status: done 2026-11-02
resolution: resolved by sweep bundle dw-edge-pin-iceberg-js
resolution-undo: 3e3cad4e23563016d63b082448d5ee7a9cc230415fc6fd9d1dcd33e84bbd304e 2026-11-02 7374617475733a206f70656e
origin: spec-deferred 3f3158bf60a9
source_spec: `plan-dw-pin-edge-supabase-js.md`
severity: medium
archived: 2026-11-26

### DW-411: After a stale-session boot the Mood screen never mounts the partner card, so a later renewal cannot bring it back until the screen is re-entered; the usePartnerMood realtime-lost error is therefore

status: done 2026-11-02
resolution: resolved by sweep bundle dw-mood-partner-lookup-on-renewal
resolution-undo: 1fef8da71dc9785856aad71f8c8803d5481f487b98c3027a7d1736d3769aa159 2026-11-02 7374617475733a206f70656e
origin: spec-deferred 22a6050e1943
source_spec: `plan-dw-realtime-recovery-after-renewal.md`
severity: low
archived: 2026-11-26

### DW-412: A register_push_device call that lands between unregister_all_push_devices() and the global sign-out still has a live session, so the session check accepts it and its push_devices row outlives "Sign

status: done 2026-11-02
origin: spec-deferred 716063194f07
source_spec: `plan-dw-push-register-session-check.md`
severity: medium
archived: 2026-11-26

### DW-413: On an account switch without a sign-out, a love-note push sent to the outgoing account between the Notification Center clear and the incoming account's `register_push_device` still lands, so it stays

status: done 2026-11-02
origin: spec-deferred 3168721c2825
source_spec: `plan-dw-account-switch-clears-delivered.md`
severity: low
archived: 2026-11-26

### DW-414: sim center's one-screen check counts every app's notifications, so another app's pile fails a read and the message blames the app read.

status: done 2026-11-02
origin: raised 2026-11-02 by the DW-407 simulator check (owner-run session)
severity: low
archived: 2026-11-26

### DW-415: sim signout fails whenever the shell shows its welcome screen.

status: done 2026-11-02
origin: raised 2026-11-02 by the DW-407 simulator check (owner-run session)
severity: low
archived: 2026-11-26

### DW-416: Remove the push sent to a partner when a date is added or changed.

status: done 2026-11-04
origin: owner decision 2026-11-02 during the Settings rework UX run (_bmad-output/initiative-my-love/ux-settings-page/.memlog.md, override entry)
severity: medium
archived: 2026-11-26

### DW-417: `npm run test:ci-local` skips the send-push Edge Function tests that CI runs.

status: done 2026-11-04
origin: bmad-project-context refresh, 2026-11-02
severity: low
archived: 2026-11-26

### DW-418: Enforce the eslint-disable reason rule with a lint rule.

status: done 2026-11-04
origin: bmad-project-context refresh, 2026-11-02
severity: low
archived: 2026-11-26

### DW-419: The Settings page stack's column-dock form has no end-to-end check.

status: done 2026-11-04
origin: story 5.1 review (epic-settings-rework), 2026-11-02
severity: low
archived: 2026-11-26

### DW-420: No test pins that sign-out keeps the device's photo-download choice.

status: done 2026-11-03
origin: story 5.1 review (epic-settings-rework), 2026-11-02
severity: low
archived: 2026-11-26

### DW-421: The Settings page stack's column-dock form has no end-to-end check (ledger DW-419).

status: done 2026-11-03
origin: spec-deferred b9cb78c93e32
source_spec: `tickets/epic-settings-rework/tickets/story-settings-opens-as-a-stack-of-pages-with-the-new-top-page-plan.md`
severity: low
archived: 2026-11-26

### DW-422: No test pins that sign-out keeps the device's photo-download choice (ledger DW-420).

status: done 2026-11-03
origin: spec-deferred ab598e369099
source_spec: `tickets/epic-settings-rework/tickets/story-settings-opens-as-a-stack-of-pages-with-the-new-top-page-plan.md`
severity: low
archived: 2026-11-26

### DW-423: Nothing ties a subpage row's visibility to its page's `available`, and the AGENTS.md subpage rule does not say to gate the row.

status: done 2026-11-03
origin: spec-deferred 445948d64bee
source_spec: `tickets/epic-settings-rework/tickets/story-settings-opens-as-a-stack-of-pages-with-the-new-top-page-plan.md`
severity: low
archived: 2026-11-26

### DW-424: After a live update, the native edge swipe on the first page may reload the app instead of doing nothing.

status: done 2026-11-03
origin: investigation (spike 5.2, 2026-11-02)
source_spec: `tickets/epic-settings-rework/tickets/spike-find-how-the-edge-swipe-returns-one-level-in-the-shell-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-425: Three native edge-swipe cases no device has checked: the first entry, the column on the left edge, and Home's message card.

status: done 2026-11-04
origin: review (spike 5.2, 2026-11-02)
source_spec: `tickets/epic-settings-rework/tickets/spike-find-how-the-edge-swipe-returns-one-level-in-the-shell-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-426: The anniversaries mirror still sits inside the persisted `settings` object that `settingsSlice` owns, though `datesSlice` now writes it.

status: done 2026-11-04
origin: spec-deferred (story 5.3, 2026-11-03)
source_spec: `tickets/epic-settings-rework/tickets/story-settings-state-splits-into-dates-profile-and-notifications-s-plan.md`
severity: low
archived: 2026-11-26

### DW-427: `DisplayNameSetup`'s `edit` mode, `onCancel` and `initialName` are unused, and its name rules duplicate `profileService.saveDisplayName`.

status: done 2026-11-03
origin: spec-deferred (story 5.7, 2026-11-03)
source_spec: `tickets/epic-settings-rework/tickets/story-profile-edits-name-and-birthday-on-one-field-pages-plan.md`
severity: low
archived: 2026-11-26

### DW-428: `PartnerMoodView` shows the Connect UI for one render before `loadPartner` raises `isLoadingPartner`, because it cannot tell "unanswered" from "unlinked".

status: done 2026-11-03
origin: spec-deferred (story 5.8, 2026-11-03)
source_spec: `tickets/epic-settings-rework/tickets/story-partner-page-shows-who-you-are-linked-to-plan.md`
severity: low
archived: 2026-11-26

### DW-429: `partnerService.getPartner` still selects `users.updated_at`, now unused.

status: done 2026-11-04
resolution: resolved by sweep bundle dw-partner-lookup-drop-updated-at
resolution-undo: 8308f83db6e5b35a306d1b0a75cb3a3ed5018f44d31442e24e30013160d3ab0d 2026-11-04 7374617475733a206f70656e
origin: spec-deferred (story 5.8, 2026-11-03)
source_spec: `tickets/epic-settings-rework/tickets/story-partner-page-shows-who-you-are-linked-to-plan.md`
severity: low
archived: 2026-11-26

### DW-430: An event's Icon row shows a text value and its Icon page uses check rows, where DESIGN.md asks for the glyph and the Form page's three-tile picker.

status: done 2026-11-03
origin: story 5.11 build (epic-settings-rework), 2026-11-03
severity: low
archived: 2026-11-26

### DW-431: An event's Icon row shows a text value and its Icon page uses check rows, where DESIGN.md asks for the glyph and the Form page's three-tile picker (ledger DW-430).

status: done 2026-11-03
origin: spec-deferred 6be699f2d039
source_spec: `tickets/epic-settings-rework/tickets/story-every-event-has-its-own-page-plan.md`
severity: low
archived: 2026-11-26

### DW-432: No E2E axe coverage of the new Settings pages since `events-accessibility` was deleted.

status: done 2026-11-04
origin: story 5.13 build (epic-settings-rework), 2026-11-03
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
archived: 2026-11-26

### DW-433: `reminderDateEntries` has no production caller now that `CountdownMarks` is gone.

status: done 2026-11-03
origin: story 5.13 build (epic-settings-rework), 2026-11-03
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
archived: 2026-11-26

### DW-434: Returning to the Dates list reloads its first window, so rows reached through `Load more`, or a date just added beyond that window, drop out of the list.

status: done 2026-11-03
origin: story 5.13 build (epic-settings-rework), 2026-11-03
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
archived: 2026-11-26

### DW-435: A date page or New event opened from Home neither slides in nor starts at the top, because the tap mounts the Settings stack fresh.

status: done 2026-11-03
origin: story 5.14 build (epic-settings-rework), 2026-11-03
source_spec: `tickets/epic-settings-rework/tickets/story-home-s-date-cards-and-add-button-open-the-date-pages-plan.md`
severity: low
archived: 2026-11-26

### DW-436: A date page or New event opened from Home neither slides in nor starts at the top, because the tap mounts the Settings stack fresh (DW-435).

status: done 2026-11-03
origin: spec-deferred 70fea21d81f5
source_spec: `tickets/epic-settings-rework/tickets/story-home-s-date-cards-and-add-button-open-the-date-pages-plan.md`
severity: low
archived: 2026-11-26

### DW-437: DW-425 still names story 15 as the one that checks its three cases by hand on the Duo, and it does not hold this story's simulator results; the ledger reserves that entry's text for the orchestrator.

status: done 2026-11-04
origin: spec-deferred f577620c7c17
source_spec: `tickets/epic-settings-rework/tickets/story-the-edge-swipe-returns-one-level-in-the-shell-plan.md`
severity: low
archived: 2026-11-26

### DW-438: The AGENTS.md Settings subpage rule names `subpageAvailable(path)` for any parent page's row, but the helper is local to `Settings.tsx`, and it overclaims that the row and the page "cannot disagree".

status: done 2026-11-04
origin: spec-deferred (story 5.16 review, 2026-11-03)
source_spec: `tickets/epic-settings-rework/tickets/story-refactor-sweep-plan.md`
severity: low
archived: 2026-11-26

### DW-439: The AGENTS.md Settings subpage rule names `subpageAvailable(path)` for any parent page's row, but the helper is local to `Settings.tsx`, and it overclaims that the row and the page "cannot disagree"

status: done 2026-11-04
origin: spec-deferred d7c5c24911d5
source_spec: `tickets/epic-settings-rework/tickets/story-refactor-sweep-plan.md`
severity: low
archived: 2026-11-26

### DW-440: A refresh while the Dates list shows, or a return after a refresh was skipped, replaces it with the server's first window, so rows reached through `Load more` drop out until it is tapped again.

status: done 2026-11-04
resolution: resolved by sweep bundle dw-events-paging-keeps-loaded-rows
resolution-undo: e37c31e4934a00a75715488978216525ae72a53a2c0007265b77f8a977cd922a 2026-11-04 7374617475733a206f70656e
origin: settings follow-up fixes on PR #449 (epic-settings-rework), 2026-11-03
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
archived: 2026-11-26

### DW-441: The dock's walk back to Home has no way out if the browser never reports the back, which can leave every dock tap doing nothing.

status: done 2026-11-04
resolution: resolved by sweep bundle dw-dock-walk-recovery
resolution-undo: 0f35935022d8844b5fb144652561e964626cfcfa86b6a96dda3ba9a24ffcc438 2026-11-04 7374617475733a206f70656e
origin: epic-settings-rework retrospective (diff review, findings V1 and V2), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: medium
archived: 2026-11-26

### DW-442: The backlog live-update prompt story still has `hitl: true` and hands its check to a person on the owner's iPhone, though the simulator can run it.

status: done 2026-11-04
origin: epic-settings-rework retrospective (P1), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: medium
archived: 2026-11-26

### DW-443: The simulator driver tells the reader to run `sudo /bin/date`, which moves the Mac's clock.

status: done 2026-11-04
origin: epic-settings-rework retrospective (diff review, finding V3), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: high
archived: 2026-11-26

### DW-444: A failed Linked since read fails the whole partner lookup.

status: done 2026-11-04
origin: epic-settings-rework retrospective (diff review, finding V4), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-445: Reloading the page of an event beyond the first loaded window sends the reader to the Dates list as if the event were deleted.

status: done 2026-11-04
resolution: resolved by sweep bundle dw-events-paging-keeps-loaded-rows
resolution-undo: e37c31e4934a00a75715488978216525ae72a53a2c0007265b77f8a977cd922a 2026-11-04 7374617475733a206f70656e
origin: epic-settings-rework retrospective (diff review, finding V5), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-446: No check has scheduled a reminder through a date page's Remind me switch.

status: done 2026-11-04
origin: epic-settings-rework retrospective (S3), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-447: The Settings rework solved the same problems several ways across its pages and test files.

status: done 2026-11-04
origin: epic-settings-rework retrospective (duplication map and test kits), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-448: Only the Settings stack has ever been checked in the Duo's column form; every other view is unchecked.

status: done 2026-11-04
origin: epic-settings-rework retrospective (P5, S4), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: medium
archived: 2026-11-26

### DW-449: The simulator driver checks none of its prerequisites up front.

status: done 2026-11-04
origin: epic-settings-rework retrospective (P6), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-450: The simulator driver cannot hold a back swipe halfway, so it cannot see the picture that slides in.

status: done 2026-11-04
origin: epic-settings-rework retrospective (P3), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-451: The Settings Touch Floor and design-token measurement of 2026-11-04 was done once by hand and kept as no test.

status: done 2026-11-04
origin: epic-settings-rework retrospective (P2), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-452: A unit test still asserts a bare `console.error` call.

status: done 2026-11-04
origin: epic-settings-rework retrospective (Date Reminders follow-through, item 6), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-453: The Settings rework has three confirmation dialogs and two copies of the date delete flow.

status: done 2026-11-04
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-454: The Settings pages copy the Error box, the field constants, the display-name rule and the online check.

status: done 2026-11-04
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-455: The Settings test files copy shared helpers instead of importing them.

status: done 2026-11-04
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-456: The birthday and Linked since dates do not use the mock's format.

status: done 2026-11-04
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
archived: 2026-11-26

### DW-457: The love-note picture viewer's Close button probably sits under the side column on the Duo.

status: done 2026-11-04
origin: triage of epic-settings-rework deferred work (DW-448 code read), 2026-11-04
severity: medium
archived: 2026-11-26

### DW-458: The partner-mood.spec.ts comment on loadPartner's reads is stale beyond the column this change fixed.

status: done 2026-11-04
origin: spec-deferred 4c682ad027bb
source_spec: `plan-dw-partner-lookup-drop-updated-at.md`
severity: low
archived: 2026-11-26

### DW-459: Fourteen unit test files outside Settings still define their own `setOnline`.

status: done 2026-11-04
origin: DW-455 fix (chore/resolve-open-dw), 2026-11-04
severity: low
archived: 2026-11-26

### DW-460: The Edge Functions, the site build and the admin scripts sign in with the legacy keys Supabase is retiring.

status: done 2026-11-05
origin: bmad-architecture review of the Daily Question spine (currency lens), 2026-11-05
source_spec: `architecture-daily-question/architecture-daily-question.md` (Deferred)
severity: medium
archived: 2026-11-26

### DW-461: E2E workers will share one coach pool, which clearPairDays cannot clear and NO ACTION keeps from being deleted while any day uses a row.

status: done 2026-11-05
origin: spec-deferred 0cf81e0eb41d
source_spec: `tickets/epic-daily-question/tickets/story-the-server-assigns-today-s-question-and-releases-a-pick-s-ch-plan.md`
severity: medium
archived: 2026-11-26

### DW-462: AGENTS.md says useAppStore.ts composes 14 slices; with dailyQuestionSlice it composes 15.

status: done 2026-11-06
origin: spec-deferred a1bf1d8a5ceb
source_spec: `tickets/epic-daily-question/tickets/story-both-partners-pick-today-s-question-and-see-the-reveal-plan.md`
severity: low
archived: 2026-11-26

### DW-463: origin/main and this epic each hold a migration at version 20261105010000, so once both reach main the hosted deploy skips one of them.

status: done 2026-11-06
origin: spec-deferred f2b78a48ca13
source_spec: `tickets/epic-daily-question/tickets/story-each-partner-s-day-runs-on-their-own-clock-plan.md`
severity: high
archived: 2026-11-26

### DW-464: The partner-connect poke test failed once while the realtime-recovery spec ran beside it.

status: done 2026-11-06
origin: spec-deferred d403f1340407
source_spec: `tickets/epic-daily-question/tickets/story-the-partner-s-pick-shows-without-a-reload-plan.md`
severity: medium (unverified)
archived: 2026-11-26

### DW-465: The partner-connect poke test failed once while the realtime-recovery spec ran beside it (ledger DW-464).

status: done 2026-11-06
origin: spec-deferred 1e1c7fb40342
source_spec: `tickets/epic-daily-question/tickets/story-the-partner-s-pick-shows-without-a-reload-plan.md`
severity: medium
archived: 2026-11-26

### DW-466: 24 existing test-file violations of TEA's write-time hook rules.

status: done 2026-11-06
origin: installing TEA's write-time enforcement hook (`.claude/hooks/tea-enforce.cjs`, TEA 4.0.0), 2026-11-06
severity: low
archived: 2026-11-26

### DW-480: The date-copy refresh tests still hard-wait 20 ms through `settleMs`, which the H1 regex cannot see.

status: done 2026-11-06
origin: DW-466 fix (fix/dw-466-tea-hook-findings), 2026-11-06
severity: low
archived: 2026-11-26

### DW-481: AGENTS.md does not describe the daily question's offline model: the data-model paragraph and the "new per-account offline data is a localCopy kind" rule both omit the pick-queue.

status: done 2026-11-06
origin: spec-deferred 9079f1c0545c
source_spec: `tickets/epic-daily-question/tickets/story-a-pick-made-offline-is-sent-when-the-connection-returns-plan.md`
severity: low
archived: 2026-11-26

### DW-482: A pick the server refuses shows a technical message, such as "[DailyQuestionApi.submitDailyPick] Database error: …".

status: done 2026-11-06
origin: story 6.10 refactor sweep, from the residual risks of stories 6.2 and 6.7, 2026-11-06
source_spec: `tickets/epic-daily-question/tickets/story-a-pick-made-offline-is-sent-when-the-connection-returns-plan.md`
severity: low
archived: 2026-11-26

### DW-483: A refused queued pick for a day no longer on screen is shown nowhere, and refused rows are never removed from the device.

status: done 2026-11-26
origin: story 6.10 refactor sweep, from story 6.7's residual risks, 2026-11-06
source_spec: `tickets/epic-daily-question/tickets/story-a-pick-made-offline-is-sent-when-the-connection-returns-plan.md`
severity: low
archived: 2026-11-28

### DW-484: An online pick whose request fails in transit shows a send error instead of being queued, even when the server committed it.
origin: story 6.10 refactor sweep, from the residual risks of stories 6.7 and 6.12, 2026-11-06
location: src/stores/slices/dailyDaySlice.ts:728-736 (`submitDailyPick`, the online branch, rethrows every online failure); src/components/DailyQuestion/DailyQuestion.tsx:343-361 (`DayCard` send)
source_spec: `tickets/epic-daily-question/tickets/story-a-pick-made-offline-is-sent-when-the-connection-returns-plan.md`
severity: low
reason: Send my pick queues only when `isOnline()` is false before the request. When the connection drops during the request, or the server commits the pick but answers after the 30 s `requestTimeout`, the action throws and Daily shows a send error; the pick is not queued. In the committed case the screen keeps offering the pick until the next read (a reload, the next open, or a partner's `daily_pick`), and a second Send returns the stored pick. Queuing on a transport failure would close both, since the RPC is idempotent. 2026-11-26 triage: the code moved to `dailyDaySlice.ts` (bf6a8a2d). Besides the reads named above, the app returning to the front and the 20:00:05 re-read (`useDailyDayRereads`, 54d788c9) also re-read, and the error shown is the technical transport text ("[DailyQuestionApi.submitDailyPick] Network error: …", `accountDataError.ts:106-123`). Waits for story 11.1 (criterion 3, the nudge prompt for an answer sent from the queue): landing first would lose the after-pick nudge offer for a timed-out pick, because a drained pick raises none today. Then a bundle (pick-unknown-send-queued) queues a pick whose request fails with `AccountDataError` code `transport`, with its original `pickedAt` and zone, and starts the drain; `invalid-response` stays an error. 2026-11-28 triage: story 11.1 has landed, so the wait is over: a pick confirmed by the drain raises the nudge prompt (`dailyQueuedPickSent`, dailyDaySlice.ts:521; DailyQuestion.tsx:623-628), and the 20:00:05 re-read named above was removed (6bb34b7c).
status: open

### DW-485: A queued pick waits for the next `online` event or start when another tab held the queue lock and closed before its pass finished.

status: done 2026-11-26
origin: story 6.10 refactor sweep, from story 6.7's residual risks, 2026-11-06
source_spec: `tickets/epic-daily-question/tickets/story-a-pick-made-offline-is-sent-when-the-connection-returns-plan.md`
severity: low
archived: 2026-11-28

### DW-486: A `daily_pick` broadcast that lands while the channel re-joins and re-reads the partner is dropped, so the partner's pick shows only on the next open.

status: done 2026-11-26
origin: story 6.10 refactor sweep, from story 6.6's review (rejected as low, kept as a residual risk), 2026-11-06
source_spec: `tickets/epic-daily-question/tickets/story-the-partner-s-pick-shows-without-a-reload-plan.md`
severity: low
archived: 2026-11-28

### DW-487: A failed IndexedDB read during a Daily copy merge rewrites the copy with only the new day.

status: done 2026-11-25
origin: story 6.10 refactor sweep, from story 6.5's review (rejected as low, kept as a residual risk), 2026-11-06
source_spec: `tickets/epic-daily-question/tickets/story-daily-shows-its-saved-day-offline-and-invites-an-unlinked-ac-plan.md`
severity: low
archived: 2026-11-26

### DW-488: The live check reads both pages after a reload, so a production break in the partner-has-picked update without a reload (R2) still ships unseen.
origin: spec-deferred b8c1506b047a
location: tests/live/daily-question-live.spec.ts:452-457 (B's reload before its pick), :473-478 (A's reload after B's pick)
source_spec: `tickets/epic-daily-question/tickets/story-after-every-deploy-a-test-checks-daily-on-the-real-website-plan.md`
severity: medium
reason: Before this change nothing checked Daily on the live site; this change adds the hidden-pick and reveal checks but each page reads its state after `pageB.reload()` / `pageA.reload()` (tests/live/daily-question-live.spec.ts), so a hosted Realtime or broadcast-authorization break is not caught. tests/e2e/daily/daily-question-live-pick.spec.ts checks the no-reload update locally only. A no-reload step needs the channel-joined wait that spec uses (the `SUBSCRIBED` log), which is more than a trivial addition. 2026-11-26 triage: the `SUBSCRIBED` log the local spec waits on is `logger.debug`, which prints only in DEV (`src/utils/logger.ts:6-8`), so it never prints on the live site; the live check needs a join signal a production build gives, such as the Realtime join reply on `mood-updates:<uid>` with the listener attached before navigation. `tests/**` does not trigger `deploy.yml` (`deploy.yml:14-15`), so the proof on production is the next deploy that is not test-only. Waits for story 11.1, whose criterion 20 rewrites the live check's nudge step (:384-414) to nudge from the prompt and then from the waiting card's button; then it is its own bundle. 2026-11-28 triage: story 11.1 has landed (6bb34b7c), so the wait on it is over; the reloads moved to :452-457 and :473-478.
status: open
decision: 2026-11-28 fix-now — add a no-reload step to the live check: page A waits for its Realtime join, B picks, A shows the reveal without a reload; reload checks kept

### DW-489: Through the mise shims, a local Playwright run aimed at any stack but the default one reaches the default (shared) stack anyway, so a local run of the live spec on an isolated stack signs the bots up

status: done 2026-11-06
origin: spec-deferred 6aa6294b27c9
source_spec: `tickets/epic-daily-question/tickets/story-after-every-deploy-a-test-checks-daily-on-the-real-website-plan.md`
severity: medium
archived: 2026-11-26

### DW-490: An open Daily keeps showing the invitation to link after the partner accepts, until Daily is left and reopened.

status: done 2026-11-06
origin: epic 6 retrospective (Diff-scope review, R1), 2026-11-06
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
archived: 2026-11-26

### DW-491: The write sheet opens after a failed or offline read, though it is meant to wait for the server's answer.

status: done 2026-11-26
origin: epic 6 retrospective (Diff-scope review, R2), 2026-11-06
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
archived: 2026-11-28

### DW-492: Daily's saved copy can show an old pairing's day for today after a relink or `reset_bot_daily_days`.

status: done 2026-11-07
origin: epic 6 retrospective (Diff-scope review, R3), 2026-11-06
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
archived: 2026-11-26

### DW-493: A queued pick confirmed during a same-account re-login is never announced, so the partner sees it only when their Daily next reads the day (an open, a return to the app or a later re-read).

status: done 2026-11-26
origin: epic 6 retrospective (Diff-scope review, R4), 2026-11-06
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
archived: 2026-11-28

### DW-494: "{partner} gets it tomorrow" on the write sheet is false when partners are on different clocks and one is already past midnight.

status: done 2026-11-06
origin: epic 6 retrospective (Diff-scope review, R5), 2026-11-06
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
archived: 2026-11-26

### DW-495: Opening Daily reads the day up to four times, and each linked read takes the pair's advisory lock and every read writes `user_time_zones`.

status: done 2026-11-26
origin: epic 6 retrospective (Diff-scope review, R6), 2026-11-06
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
archived: 2026-11-28

### DW-496: The day-changed notice can stay above a day that needs no pick.

status: done 2026-11-26
origin: epic 6 retrospective (Diff-scope review, R8), 2026-11-06
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
archived: 2026-11-28

### DW-497: The hosted database has never been compared with the migrations as a whole, so objects no migration created can still be there.
origin: owner request during loop run 20261105-224246-5db5 (story 6.11's live check), 2026-11-07
location: the hosted Supabase project; supabase/migrations/
source_spec: none
severity: low
reason: AGENTS.md records that the hosted database carries objects no migration created (tables and a function removed at e5f1ab6d, two photos policies at 8f9d35d4), and each was found only when a migration touched that table. Nothing compares the whole hosted schema with what the migrations build, so a leftover policy, grant or function elsewhere is found only by chance. A one-off, read-only comparison (`supabase db diff --linked`, or the hosted catalog read table by table) would list every difference; each leftover is then dropped by a migration with `drop … if exists` after the owner approves it. The post-deploy live check (story 6.11) covers Daily's gate only, not drift elsewhere. 2026-11-26 triage: `supabase db diff --linked` is not a read-only comparison: the pinned CLI 2.122.0's help says it may need `database_write`, and it builds a shadow database in local Docker (what it writes is UNVERIFIED). Read the hosted catalog with `supabase db query --linked` instead, under an access token scoped to `database_read` only, table by table, and run the same queries on the local stack.
status: open
decision: 2026-11-26 one-sitting — one sitting outside the loop, never while a loop run uses the shared local stack: read the hosted catalog read-only (tables, policies, grants and functions in `public` and `storage`), compare it with the local stack, the owner approves one list, and one migration drops each hosted-only object with `drop … if exists` (or adds what the live app needs); local tests pass, `deploy.yml` applies it, and this entry closes.

### DW-498: The write sheet keeps the day it named when the date the question is asked moves while the sheet is open.
origin: review of the DW-494 fix (fix/daily-pick-refusals-and-write-day), 2026-11-06
location: supabase/migrations/20261127000000_daily_nudge_per_question.sql:389-468 (the current `daily_day_snapshot`, its `write.target_day` walk copied unchanged); src/components/DailyQuestion/WriteQuestionSheet.tsx:79; src/components/DailyQuestion/DailyQuestion.tsx:858
source_spec: `tickets/epic-daily-question/epic-daily-question-retrospective.md`
severity: low
reason: `write.target_day` is computed when the snapshot is read. When the partner whose clock is ahead opens the next date, or another written question takes that date, while the writer's sheet is open, the date the question is asked moves on but the sheet keeps the day it named until the snapshot is read again; the question is then asked a day later than the sheet said. The snapshot the send returns carries the new date, but the sheet closes on that send. 2026-11-26 triage: the reminder schedule moves the date too: on each 08:00 and 20:00 tick `enqueue_daily_reminders` calls `assign_couple_day` for the partner's local date (`20261126000000_daily_reminders_schedule.sql:104`, no branch by slot). Story 11.2 removes the 08:00 one; the 20:00 one stays, though it needs partners about 20 hours apart. This is the epic 8 retrospective's dropped Adversarial 6.
status: open
decision: 2026-11-26 line-after-send — after Send, when the answer's `write.target_day` differs from the date the sheet named, Daily shows one line naming the real day ("{partner} gets it on Sunday."); no migration and no extra request. Built after story 11.1, beside the nudge prompt that follows the sheet (criterion 2).

### DW-499: The live Daily check once stalled on the writer's reload: the page sent no day read and missed the partner's pick broadcast.

status: done 2026-11-26
origin: deploy run 42340556736 (merge of PR #486), Live Daily Check, attempt 1, 2026-11-06; attempt 2 passed unchanged
source_spec: `tickets/epic-daily-question/tickets/story-after-every-deploy-a-test-checks-daily-on-the-real-website-plan.md`
severity: low
archived: 2026-11-26

### DW-500: A linked Partner page shows only the partner's name, with no card, loading block or error, when the slice holds an `unlinked` streak answer (or null with nothing loading) while a partner is shown.

status: done 2026-11-26
origin: spec-deferred df427a169e35
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-shows-the-couple-s-streak-in-place-of-the-p-plan.md`
severity: low
archived: 2026-11-28

### DW-501: The Connect screen's typed email, shown search answer and error line are lost whenever `loadPartner` runs while the account is unlinked.

status: done 2026-11-26
origin: spec-deferred 22a75e44ce54
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-shows-the-couple-s-streak-in-place-of-the-p-plan.md`
severity: low
archived: 2026-11-28

### DW-502: The streak error card offers no Retry, so an online transient failure with nothing shown stays until Realtime re-joins or the page is reopened.

status: done 2026-11-26
origin: spec-deferred 22cfebd7aa4f
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-shows-the-couple-s-streak-in-place-of-the-p-plan.md`
severity: low
archived: 2026-11-28

### DW-503: The interactions local-copy refresher still reads interactions on every signed-in start although no routed screen shows them, and the deleted interaction E2E specs leave that code without browser coverage until epic 10 deletes it.
origin: spec-deferred c9adea711391
location: src/stores/slices/interactionsSlice.ts:235
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-shows-the-couple-s-streak-in-place-of-the-p-plan.md`
severity: low
reason: interactionsSlice.ts:235 `registerLocalCopy(INTERACTIONS_COPY_KIND, ...)` still runs; tests/e2e/partner/interaction-record-ownership.spec.ts and tests/e2e/offline/interactions-offline-copy.spec.ts were deleted with the Poke/Kiss/Fart tiles (the API-level tests/api/interaction-record-ownership.spec.ts stays). The intent keeps the code for epic 10, so removing the refresher is out of this story. 2026-11-26 triage: the title was cut by the harvest's 200-character clamp and is restored. The removal is carried only by epic 10's Description ("each device's mood and interaction copies") and Done when ("A device upgraded from the old build keeps no mood or interaction copy"), which name no DW id; the epic 10 story that deletes the refresher names DW-503 in its verify and declares it in its plan's `closes_deferred`. Not loop work before then: story 7.2 left the interaction code to epic 10.
status: open
decision: 2026-11-26 epic-10 — the PO adds DW-503 to epic 10's Notes; it closes with the epic 10 story that deletes the interactions refresher.

### DW-504: After a relink to a new partner within one session, the previous couple's streak can show under the new partner's name until the new read lands, or for good if it fails.

status: done 2026-11-07
origin: spec-deferred 6244cfdb5f44
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-shows-the-couple-s-streak-in-place-of-the-p-plan.md`
severity: low
archived: 2026-11-26

### DW-505: When `subscribePartnerEvents` rejects, usePartnerStreakListener logs and holds nothing, with no retry, so the Partner page gets no live re-reads until it is reopened, the device reconnects or the session changes.

status: done 2026-11-26
origin: spec-deferred 7a52e464bc0a
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-shows-the-couple-s-streak-in-place-of-the-p-plan.md`
severity: low
archived: 2026-11-28

### DW-506: The week strip's "Today" sits on the server's date for the viewer's stored zone, which can be a day off from the device while travelling until a Daily fetch records the new zone.

status: done 2026-11-26
origin: spec-deferred 0339fde9918d
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-shows-the-couple-s-streak-in-place-of-the-p-plan.md`
severity: low
archived: 2026-11-26

### DW-507: The offline-pick E2E cannot tell the drain's own streak re-read from the refresher's or the Realtime re-join's.

status: done 2026-11-26
origin: spec-deferred 484f89571f2f
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-daily-shows-the-streak-the-week-and-a-missed-day-plan.md`
severity: low
archived: 2026-11-26

### DW-508: The waiting sentence reads "when Your partner answers too." with a capital Y mid-sentence when the partner's name is missing.

status: done 2026-11-07
origin: spec-deferred 254a73a92d5c
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-daily-shows-the-streak-the-week-and-a-missed-day-plan.md`
severity: low
archived: 2026-11-26

### DW-509: A failed IndexedDB read of daily-celebrated is taken as "nothing stored", so the claim re-seeds over a good stored value.

status: done 2026-11-25
origin: spec-deferred 2354bd4b96ec
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-streak-s-1-plays-once-for-each-new-day-plan.md`
severity: low
archived: 2026-11-26

### DW-510: After an in-session unlink and relink to a different partner, the Partner page shows the previous pair's past questions under the new partner's name until the new history read lands, or indefinitely

status: done 2026-11-07
origin: spec-deferred 744eb5a8fd58
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-partner-page-lists-past-questions-marked-same-or-differe-plan.md`
severity: low
archived: 2026-11-26

### DW-511: After an in-session relink to a different partner whose first history page is full, the history merge keeps the previous pair's older rows below it and shows them under the new partner's name.

status: done 2026-11-07
origin: spec-deferred 0672eff09fcf
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-see-all-opens-every-past-question-with-the-running-count-plan.md`
severity: low
archived: 2026-11-26

### DW-512: `daily-question-partner-linked.spec.ts` once failed in a full E2E run because a `get_daily_day` read was still in flight 15 s after A's channel joined.

status: done 2026-11-26
origin: spec-deferred refactor-sweep-7-10
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-refactor-sweep-plan.md`
severity: low
archived: 2026-11-26

### DW-513: After a server-side relink to a different partner, the +1 and milestone stay silent and Daily keeps the old pair's day.

status: done 2026-11-26
origin: epic 7 retrospective (D1 and D2), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md`
severity: low
archived: 2026-11-28

### DW-514: See all shows only its title when there is no past question, and offers no Retry when its first read fails online.

status: done 2026-11-26
origin: epic 7 retrospective (D5 and what is left of D4), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md`
severity: low
archived: 2026-11-28

### DW-515: The cold banner says "Yesterday was missed" when the missed day can be the day before yesterday.

status: done 2026-11-26
origin: epic 7 retrospective (D6), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md`
severity: low
archived: 2026-11-28

### DW-516: A failed partner lookup saves a day, a history page or the streak with no partner tag.

status: done 2026-11-26
origin: epic 7 retrospective (D7), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md`
severity: low
archived: 2026-11-28

### DW-517: The partner tag is asserted with a known partner on two of Daily's merge callers, and Daily's component fixtures use a partner state the app never reaches.

status: done 2026-11-26
origin: epic 7 retrospective (D9 and D10), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md`
severity: low
archived: 2026-11-28

### DW-518: `get_couple_streak` is read from many places at once, and each read walks the pair's whole history.

status: done 2026-11-26
origin: epic 7 retrospective (D11), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md`
severity: low
archived: 2026-11-28

### DW-519: A second celebration claim in one Daily mount can replace the overlay that is playing. PLAUSIBLE, not reproduced.

status: done 2026-11-26
origin: epic 7 retrospective (D12), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md`
severity: low
archived: 2026-11-28

### DW-520: A sign-out between the last session check and the IndexedDB put can recreate the outgoing account's saved copy. UNVERIFIED as reachable.

status: done 2026-11-26
origin: epic 7 retrospective (P1, story 7.3's residual risk), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-streak-shows-offline-from-its-saved-copy-plan.md`
severity: low
archived: 2026-11-26

### DW-521: Offline, a short-lived Daily mount can claim the +1 and unmount before playing it. UNVERIFIED.

status: done 2026-11-26
origin: epic 7 retrospective (P1, story 7.5's residual risk), 2026-11-07; re-checked on main 8696807a, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-the-streak-s-1-plays-once-for-each-new-day-plan.md`
severity: low
archived: 2026-11-28

### DW-522: Offline, Past questions can show fewer days than the count above them.

status: done 2026-11-26
origin: epic 7 closure check, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-past-questions-show-offline-plan.md`
severity: low
archived: 2026-11-28

### DW-523: A milestone screen is lost for good on a device when its +1 is cut short.

status: done 2026-11-25
origin: epic 7 closure check, 2026-11-25
source_spec: `tickets/epic-streak-and-partner-page/tickets/story-every-25-days-the-milestone-screen-shows-its-badge-plan.md`
severity: medium
archived: 2026-11-26

### DW-524: `new-date-forms.spec.ts`'s add-an-anniversary test failed two weekly burn-ins while loading the partner's Dates list.

status: done 2026-11-26
origin: epic 7 closure check, from the scheduled Tests runs, 2026-11-25; not this epic's work
severity: low
archived: 2026-11-28

### DW-525: send-push does not check a pick's is_second against the posted kind, so a mis-posted daily_partner_picked or daily_both_answered sends the wrong copy and, because both kinds share the (daily_pick_id,

status: done 2026-11-26
origin: spec-deferred 3f83caf550f5
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-sender-knows-the-five-daily-pushes-plan.md`
severity: low
archived: 2026-11-26

### DW-526: A daily reminder's sender is users.partner_id while its day and streak come from the reminder's couple_days pair, so a re-pairing between enqueue and send would name the new partner on the old pair's day.

status: done 2026-11-26
origin: spec-deferred 184bc275beae
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-sender-knows-the-five-daily-pushes-plan.md`
severity: low
archived: 2026-11-26

### DW-527: tests/api/push-daily-sender.spec.ts fixes "today" and "two days ago" from the host clock when it seeds the pair, while send-push reads the recipient's date from its own now(), so a run that crosses

status: done 2026-11-26
origin: spec-deferred 5c56c69dc1e9
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-sender-knows-the-five-daily-pushes-plan.md`
severity: low
archived: 2026-11-26

### DW-528: The live daily-reminders cron job (every 5 minutes on real time) can act on api-spec accounts during a host-zone 08:00-08:30 or 20:00-20:30 window, so a tick that lands mid-spec makes push-daily-sender.spec.ts's hand-inserted reminder hit the (user_id, local_date, slot) key or adds daily records to push-partner-activity-trigger.spec.ts's by-token count of six.
origin: spec-deferred 2a1496a6b7b2
location: tests/api/push-daily-sender.spec.ts:99-107 (`addReminder`; the colliding call is :119, Bob today); tests/api/push-partner-activity-trigger.spec.ts:375-381 (the by-token count of six); supabase/migrations/20261126000000_daily_reminders_schedule.sql:206-210 (the daily-reminders job); supabase/tests/database/35_push_devices.sql:292, 307, 320, 349, 392, 407, 420, 441, 586, 602, 614, 627, 639 (unscoped queue reads)
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-8-am-and-8-pm-pushes-are-scheduled-on-each-person-s-cloc-plan.md`
severity: low
reason: push-daily-sender.spec.ts setUpPair links a throwaway pair both ways, registers devices and seedPairDays writes a host-zone user_time_zones row, so enqueue_daily_reminders(now()) treats it as due; addReminder then asserts a null insert error (tests/api/push-daily-sender.spec.ts addReminder). push-partner-activity-trigger.spec.ts reads push_requests by token and expects toHaveLength(6) while the pool pair (linked, a stored zone from get_daily_day) holds devices. 35_push_devices.sql's unscoped net.http_request_queue counts are exposed the same way to a committed cron insert. Needs a tick inside a window during the few seconds a spec holds that state (about 0.1-0.2% of runs). Real low flake, deferred because developers are unlikely to meet it (review 2026-11-26: blind-hunter, edge-case-hunter, verification-gap). Fix: pause the job around the api leg or clear a cron-made row for (user, today, slot) before the spec inserts. 2026-11-26 triage: the title was cut by the harvest's 200-character clamp and is completed from the plan. The partner-activity and pgTAP sites are local-stack only: in CI no api spec writes a pool account's zone, and the Database Tests stack has no eligible account; CI also retries twice (`playwright.config.ts:102`). Pausing the job conflicts with DAILY-REM-011, which pins it active (`48_daily_reminders.sql:151-161`), and with the shared stack, where a killed run would leave it paused; scoping 35's reads by id prefix would weaken PUSH-DB-065 to 067. Waits for stories 11.1 and 11.2, which remove the nudge slots (11.1) and the morning and `evening_partner` kinds that `addReminder` inserts (11.2); 11.1 keeps the 08:00-08:30 window for held nudges (11.1 criterion 12). Then a bundle (api-specs-clear-of-reminder-ticks) waits clear of each */5 tick inside the host's 08:00-08:30 and 20:00-20:30 windows and excludes `daily_reminders` rows from 35's unscoped reads, keeping every "nothing queued" check as strong as before. 2026-11-28 triage: since story 11.2 (3b2261d0) the 08:00-08:30 tick inserts no reminder and only releases held nudges, so the morning half and the `morning`/`evening_partner` inserts are gone. What remains is the 20:00-20:30 tick inserting Bob's `evening_self` for today before the spec's own insert at :119 (the :191 call is two days ago and :222 is Alice, who has picked); `waitClearOfDailyTurns` waits only 10 s past the 20:00 turn (tests/support/helpers/events.ts:215), not the half hour after it. 35's unscoped reads see a committed cron insert for any eligible account, at any host time.
status: open

### DW-529: For partners on clocks four or more hours apart, the 8 PM evening_partner push can tell the earlier partner to nudge about a date the later partner can no longer pick, because the later partner's date

status: done 2026-11-26
origin: spec-deferred 916c1600ab8a
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-8-am-and-8-pm-pushes-are-scheduled-on-each-person-s-cloc-plan.md`
severity: low
archived: 2026-11-26

### DW-530: push-daily-reminders.spec.ts's guard stops the spec when any other linked account with a push device stores a zone due at its Kathmandu instants, such as a pair a killed run left behind.
origin: spec-deferred 64204ccf98b3
location: tests/support/helpers/daily-clock.ts:48-61 (`otherAccountsDueAt`); tests/api/push-daily-reminders.spec.ts:79-91 (the `dailyrem-` pair), :93-100 (the instants and the guard call); tests/api/push-daily-nudge-held.spec.ts:60-61, :131 (the `dailyheld-` pair and the same guard)
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-8-am-and-8-pm-pushes-are-scheduled-on-each-person-s-cloc-plan.md`
severity: low
reason: Pool accounts store the host zone (tests/support/factories/daily-question.ts seedPairDays; get_daily_day on sign-in). otherAccountsDueAt counts them as due and the spec stops before the rpc, loudly. No owner, partner or CI host is in a half-hour zone today. Real low defect, deferred because developers are unlikely to meet it and the fix (choosing the instants from the stored zones) adds logic (review 2026-11-26: intent-alignment). 2026-11-26 triage: the title was cut by the harvest's 200-character clamp (it ended at "Kathmandu 08:25 and") and is rewritten to the confirmed mechanism. The guard counts any account other than the pair that is linked both ways, holds a push device (:62) and stores a zone due at the instant: a throwaway pair or pool device left by a killed run, or a local-stack account with a device in the host's half-hour zone. Pool accounts hold no device while this spec runs, since only the two trigger specs register them and their cleanup deletes them. Absorbs DW-544 (a `dailyrem-` pair left behind by a killed run is counted by the same guard; excluding the prefix alone fails `expect(morning.data).toBe(2)`, because the rpc would also insert the leftover's rows, so the fix is the zone-chosen instant or an age-gated delete of the spec's own stale `dailyrem-` accounts before seeding). Waits for story 11.2, which rewrites this spec's assertions and its morning instant; then one bundle (reminders-spec-instant-from-zones) picks the pair's zone and instant from the zones the other eligible accounts store, keeping the guard as the final check with a message naming the accounts it counted. 2026-11-28 triage: 9f5eca46 moved `otherAccountsDueAt` into tests/support/helpers/daily-clock.ts; story 11.2 (3b2261d0) dropped the morning guard call, since an 08:25 tick now inserts nothing; story 11.1 (6bb34b7c) added the same guard at 08:25 Kathmandu to push-daily-nudge-held.spec.ts:131, whose `dailyheld-` Kathmandu pair a killed run also leaves behind, and each spec's leftover is due at the other's instant.
status: open

### DW-531: tests/api/push-daily-picks.spec.ts fixes today, yesterday and two days ago from the host clock when it seeds the pair, so a run that crosses host-local midnight between the seed and a pick fails

status: done 2026-11-26
origin: spec-deferred cf4802363580
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-picks-push-the-partner-and-both-answered-plan.md`
severity: low
archived: 2026-11-26

### DW-532: A sender whose clock is past midnight while the recipient's is still on the day can nudge about that day in a fresh slot of the sender's new date, which also spends that date's slot before the new day's question.

status: done 2026-11-26
origin: spec-deferred 900939320814
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-server-takes-a-nudge-and-pushes-it-plan.md`
severity: low
archived: 2026-11-26

### DW-533: record_daily_nudge reads the sender's stored zone twice (user_local_date, then daily_nudge_slot), so a zone written between the two statements gives the row a date from one zone and a slot from the other.

status: done 2026-11-26
origin: spec-deferred 54bfbe5d4e23
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-server-takes-a-nudge-and-pushes-it-plan.md`
severity: low
archived: 2026-11-26

### DW-534: tests/api/push-daily-nudge.spec.ts takes today from the host clock before seeding, so a run that crosses host-local midnight between the seed and the nudge fails spuriously.

status: done 2026-11-26
origin: spec-deferred e25547d0886d
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-server-takes-a-nudge-and-pushes-it-plan.md`
severity: low
archived: 2026-11-26

### DW-535: tests/e2e/daily/daily-question-nudge.spec.ts fails when a run crosses 20:00 or host-local midnight between the nudge and the reload.

status: done 2026-11-26
origin: spec-deferred bdab4a51c247
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-waiting-screen-s-nudge-button-nudges-the-partner-plan.md`
severity: low
archived: 2026-11-26

### DW-536: The client keeps nudge.spent per (day_id, slot), while the server spends a slot per (sender-local date, slot), so a sender whose date has passed the shown day sees a greyed button the server would still accept.

status: done 2026-11-26
origin: spec-deferred d00b99c79ea2
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-waiting-screen-s-nudge-button-nudges-the-partner-plan.md`
severity: low
archived: 2026-11-26

### DW-537: After a P0002 refusal (the pair changed) the nudge's re-read of the same day_id fails too, so the stale waiting card keeps an enabled button that fails on every tap.

status: done 2026-11-28
origin: spec-deferred 50678f62b2da
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-waiting-screen-s-nudge-button-nudges-the-partner-plan.md`
severity: low
archived: 2026-11-28

### DW-538: Daily does not re-read at the sender's local midnight, so a page left open and visible across midnight keeps the old day.
origin: spec-deferred 300c948db47a
location: src/hooks/useDailyDayRereads.ts:17-38
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-waiting-screen-s-nudge-button-nudges-the-partner-plan.md`
severity: low
reason: useDailyDayRereads arms only 20:00:05 and visibilitychange; Daily had no midnight re-read before this change either (pre-existing). A pick made then is refused day-changed and re-reads, but the nudge button shows the old day's state until a return or reload (review 2026-11-26: blind-hunter). 2026-11-26 triage: what remains once story 11.1 removes the slots and hides an unsent prompt Nudge and waiting-card button at the question's closing instant (criterion 14): the header, question, chip and week stay on the old day, and an open write sheet stays until its send is refused with DQ006. It waits for story 11.1 only because story 11.1 deletes the 20:00 timer in the same hook. Story 11.1 covers the button, so this fix is only the rest of the stale screen (header, question, chip and week, and the open write sheet): a one-entry bundle (daily-midnight-reread) re-reads the day and the streak just after the device's local midnight, re-armed daily and cleared on unmount or a session change, with one more read a few seconds later if the day is still not the device date; once story 11.1 lands the title drops "and its nudge slot".
status: open
progress: 2026-11-26 epic 8 retrospective (F1e): the partner's midnight is not re-read either, so a page left open across it keeps an enabled Nudge button that DQ009 refuses on every tap. Story 11.1 covers that case: the day's answer gives the instant the question stops taking nudges, the end of that day on the partner's clock, and an unsent button is hidden then with no re-read (criterion 14). The stale day across the sender's own midnight remains.

### DW-539: A nudge request that times out after the server committed it shows "Your nudge could not be sent." although the push went out.

status: done 2026-11-26
origin: spec-deferred 31cd9232798f
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-waiting-screen-s-nudge-button-nudges-the-partner-plan.md`
severity: low
archived: 2026-11-26

### DW-540: The 20:00 re-read uses the device's clock while the server's slot uses the stored zone, which differ when the same account reads Daily from a second device in another zone.

status: done 2026-11-26
origin: spec-deferred 24a822fb1e50
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-waiting-screen-s-nudge-button-nudges-the-partner-plan.md`
severity: low
archived: 2026-11-26

### DW-541: tests/e2e/daily/daily-question-after-pick-nudge.spec.ts fails when a run crosses 20:00 or host-local midnight between the pick and the reload.

status: done 2026-11-26
origin: spec-deferred 038b11dcab84
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-the-app-offers-a-nudge-right-after-a-pick-plan.md`
severity: low
archived: 2026-11-26

### DW-542: The live check's turn guard reads the host clock, so a local run on a host not on UTC can cross the bots' UTC midnight and, on bot A's writing day, fail on the wrong sheet.

status: done 2026-11-26
origin: spec-deferred 04fbea10cd5f
source_spec: `tickets/epic-daily-pushes-and-nudge/tickets/story-after-every-deploy-the-live-check-also-sends-a-nudge-plan.md`
severity: low
archived: 2026-11-28

### DW-543: send-push judges whether a pick's day is the recipient's current date when it sends, not when the pick was made.

status: done 2026-11-26
origin: epic 8 retrospective, 2026-11-26
source_spec: `tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md`
severity: low
archived: 2026-11-26

### DW-544: push-daily-reminders.spec.ts's guard counts a throwaway pair left behind by a killed run. PLAUSIBLE, not reproduced.

status: done 2026-11-26
origin: epic 8 retrospective, 2026-11-26
source_spec: `tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md`
severity: low
archived: 2026-11-26

### DW-545: send-push reads the couple's streak before it checks the recipient's switch.

status: done 2026-11-26
origin: epic 8 retrospective, 2026-11-26
source_spec: `tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md`
severity: low
archived: 2026-11-26

### DW-546: Three daily push api specs hand-write the couple-day lookup and the linked-pair recipe that shared helpers already give.

status: done 2026-11-26
origin: epic 8 retrospective, 2026-11-26
source_spec: `tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md`
severity: low
archived: 2026-11-28

### DW-547: A failed nudge (refused or transport) is logged twice.
origin: epic 8 retrospective, 2026-11-26
location: src/api/dailyQuestionApi.ts:339 (`logSupabaseError` on a refusal); src/services/accountDataError.ts:108 (`toAccountDataError` logs a transport failure); src/stores/slices/dailyDaySlice.ts:875, :880 (`sendDailyNudge` logs both again)
source_spec: `tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md`
severity: low
reason: Retrospective F6 (duplication map). `sendDailyNudge` logs a refusal before throwing `AccountDataError('refused')`, and `nudgeFailureMessage` logs the same failure again on its way to the line it shows. 2026-11-26 triage: a transport failure is logged twice too, by `toAccountDataError` (`accountDataError.ts:108`) and then by `nudgeFailureMessage`. Only `NudgeSheet.test.tsx:115,133,235` assert the second log, and the API's own log is never asserted. Waits for story 11.1, which rewrites the transport handling of both sends, the prompt's and the waiting card's button's (criterion 16); a timed-out send that turns out recorded must not log a failure. Then a small bundle with DW-537 (nudge-failure-path) logs each failed nudge once, where the error is mapped. 2026-11-28 triage: since story 11.1 (6bb34b7c) `sendDailyNudge` answers `failed` or `unchecked` instead of throwing, so `nudgeFailureMessage.ts:17` logs only an unexpected throw; the second log of a refusal or a transport failure is now the slice's (`dailyDaySlice.ts:875`, `:880`), and an `invalid-response` is logged only there.
status: open

### DW-548: Drop the `push_preferences` columns for New question and Partner picked once installed builds have taken story 11.2's update.
origin: epic 8 retrospective, 2026-11-26
location: push_preferences.daily_question, push_preferences.daily_partner_picked; supabase/tests/database/36_push_preferences.sql:111 (PUSH-PREF-009); supabase/tests/database/47_daily_pushes.sql:420-439 (DAILY-PUSH-051, 052, 056, 057); tests/api/push-preferences-old-build.spec.ts; src/types/database.types.ts
source_spec: `tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md`
severity: low
reason: Story 11.2 removes both switches and the pushes they controlled, but keeps the columns (owner, 2026-11-26): installed shells run the old web bundle until they take the live update, and that bundle reads both columns by name, so dropping them in the same deploy would fail its Settings reads. Drop them in a later migration, after the owner's and partner's shells run a bundle from story 11.2 or later, regenerating the types and updating PUSH-PREF-009 in the same change. 2026-11-26 triage: a precondition story 11.2 now states (criterion 6): its deploy stops the client selecting and upserting both columns (`pushPreferencesService.ts:99-100`, `:106`, `:134`, `:162`), since AD-10 (`architecture-daily-question.md:158`) requires stop reading, ship, then drop. Before the drop, read the hosted catalog of `push_preferences` for dependents, read-only (AGENTS.md). No gate line is added: this entry blocks no ticket, and a backlog file name is not a valid gate token. 2026-11-28 triage: story 11.2 (3b2261d0) met its criterion 6: src/services/pushPreferencesService.ts names neither column outside its header comment (:10-11), pinned by tests/unit/services/pushPreferencesService.test.ts:137-138 and :198-202. tests/api/push-preferences-old-build.spec.ts writes both columns as an old build does, so the drop removes or rewrites that spec too.
status: open
decision: 2026-11-26 epic-10 — rides epic 10's second-step `push_preferences` drop: one migration with the moods and pokes-and-kisses columns, one `npm run db:types` and one PUSH-PREF-009 edit; the PO adds it to epic 10's Notes and the drop story declares it in its plan's `closes_deferred`.

### DW-549: With no known partner and no connection, Daily's +1 never plays on that device until a partner is known.

status: done 2026-11-28
origin: review of the deferred-work agent run (bundle daily-celebration-claim-scope, DW-513), 2026-11-26
severity: low
archived: 2026-11-28

### DW-550: cross-device.spec.ts's custom-messages read after goto('/admin') can latch onto Home's refresher read, as DW-524's anniversaries read did.
origin: review of the deferred-work agent run (bundle observe-after-navigation-helper, DW-524), 2026-11-26
location: tests/e2e/account-data/cross-device.spec.ts:189-196 (`observeOn` on `CUSTOM_MESSAGES_READ` before `fresh.goto('/admin')`, after `signInFresh`)
severity: low
reason: `signInFresh` awaits only the favorites read, while sign-in also starts the message-data refresher, whose custom_messages read the navigation to /admin can cut off. `CUSTOM_MESSAGES_READ` ('**/rest/v1/custom_messages?*') pins a query-start '?', which `observeReadAfterNavigation`'s path-only glob refuses, so using the shared helper there needs that glob, or a path form of it, relaxed first. Not reproduced. 2026-11-28 triage: narrowed. The observer uses page.waitForRequest (playwright-utils observe-network-call.js:8), which sees only requests sent after it starts, and the refresher sends the custom_messages read together with the favorites read signInFresh waits for (messagesSlice.ts:346-349), so only a second refresher run in the gap (seeding and sign-in in one render, App.tsx:478-498) can be caught.
status: open

### DW-551: Two offline E2E specs declare their own orderedPair, in a different shape from the one the daily-question factory now exports.
origin: review of the deferred-work agent run (bundle daily-push-specs-shared-pair-setup, DW-546), 2026-11-26
location: tests/e2e/offline/birthdays-wedding-offline.spec.ts:37; tests/e2e/offline/couple-settings-offline.spec.ts:29
severity: low
reason: Each returns an object for the couple_settings pair columns, while tests/support/factories/daily-question.ts exports a tuple, so one shared helper needs a choice of shape (AGENTS.md, Shared test helpers). Outside DW-546's four push specs.
status: open

### DW-552: A failed partner reload over a confirmed unlinked answer can still swap the Connect screen for the load error when the saved partner copy cannot be read.
origin: review of the deferred-work agent run (bundle partner-connect-survives-reload, DW-501), 2026-11-26
location: src/stores/slices/partnerSlice.ts:209, :225 (`partnerLoadError: !copy && get().partner === null`, which ignores `partnerKnown`)
severity: low
reason: After DW-501 a reload keeps PartnerConnect up while `partnerKnown`, but these two failure paths set `partnerLoadError` from the copy read and `partner` alone, so a failed copy read plus a failed server read over an in-memory unlinked answer shows PartnerLoadError and drops the typed email. A confirmed answer always writes a copy, so it needs the copy read itself to fail. 2026-11-28 triage: the premise is narrower than stated. The copy is also missing when the earlier writeLocalCopy of a confirmed answer failed (caught and only logged in loadPartner), not only when the copy read fails; both reach partnerSlice.ts:209 and :225 the same way.
status: open

### DW-553: lookupPartnerId's session reads and supabase-js's token wait before each request are still unbounded, so a stalled token refresh can hold the single-flight Daily read slot.

status: done 2026-11-28
origin: review of the deferred-work agent run (follow-up eb1fd874 to DW-495), 2026-11-26
severity: low
archived: 2026-11-28

### DW-554: On a device with nothing saved, the first +1 is lost when the day finishes before Daily's first claim answers.

status: done 2026-11-28
origin: investigation of a partner-streak.spec.ts:190 failure during the deferred-work agent run, 2026-11-26
severity: low
archived: 2026-11-28

### DW-555: `waitClearOfDailyTurns` still waits out 20:00, a turn that went with the nudge slots, and does not wait out 08:00, the turn a held nudge now has.
origin: build of story 11.1 (two nudges per question, held until the partner's 8 AM), 2026-11-27
location: tests/support/helpers/events.ts:221-285 (`msUntilClearOfDailyTurns`, hours `[0, 20]`; the six Daily specs that call `waitClearOfDailyTurns`); tests/unit/helpers/events.test.ts
severity: low
reason: The 20:00 turn existed because the nudge slot changed there (DW-534); story 11.1 removed the slots and the 20:00:05 re-read, so a run that starts near 20:00 now sleeps for nothing. A nudge the real clock sends is held before 08:00 on the partner's clock, which no spec waits out, so `push-daily-nudge.spec.ts` reads the row's `held` and asserts the branch the host clock is in instead of choosing one. Dropping 20:00 changes `events.test.ts`'s expectations and every spec's wait, so it is a change of its own.
status: open

### DW-556: A device clock behind the server's keeps the nudge controls enabled after the server's closing instant, so each tap gets DQ009 and "Your nudge could not be sent." until the device clock catches up.

status: done 2026-11-28
origin: spec-deferred 1d83c4e1a88d
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-two-nudges-per-question-held-until-the-partner-s-8-am-plan.md`
severity: low
archived: 2026-11-28

### DW-557: A definite PostgREST error on a nudge send (an expired-token 401, a PGRST code) is treated as a lost answer, so a failed re-read shows "couldn't check" instead of "could not be sent".
origin: spec-deferred 95aaaf1f39a2
location: src/api/dailyQuestionApi.ts (isNudgeOutcomeUnknown, sendDailyNudge catch)
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-two-nudges-per-question-held-until-the-partner-s-8-am-plan.md`
severity: low
reason: isNudgeOutcomeUnknown counts every 'transport' AccountDataError as unknown, and toAccountDataError maps non-refusal PostgREST errors to 'transport'. Only the failure wording differs, and Nudge is re-enabled either way. Real, low, rare; the fix adds a classification branch (review 2026-11-27: edge-case-hunter).
status: open
progress: 2026-11-27 epic 11 retrospective (R5): an unreadable reply from send_daily_nudge (invalid-response, dailyQuestionApi.ts:308-313) is the same misclassification family: the re-read settles it when it succeeds, but when the re-read also fails the sender sees "couldn't check" for a nudge the server recorded.

### DW-558: A DQ010 "already sent" ending whose re-read fails marks the source sent only in memory, so an offline reload from the saved copy offers that control again until the next tap.

status: done 2026-11-28
origin: spec-deferred 453b05826acf
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-two-nudges-per-question-held-until-the-partner-s-8-am-plan.md`
severity: low
archived: 2026-11-28

### DW-559: The nudge prompt unmounts at the closing instant even while its send or the re-read after a lost answer is in progress, cutting short criterion 16's disabled-until-re-read.

status: done 2026-11-28
origin: spec-deferred 8aaa08e2e72d
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-two-nudges-per-question-held-until-the-partner-s-8-am-plan.md`
severity: low
archived: 2026-11-28

### DW-560: The story 11.2 migration fails the deploy if an old daily-reminders cron run inserts a morning row between its DELETE and the narrowed kind check, or deadlocks with that run.

status: done 2026-11-28
origin: spec-deferred ee5355ecc051
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-three-daily-pushes-and-three-switches-plan.md`
severity: low
archived: 2026-11-28

### DW-561: After a nudge ends as "already sent" or its answer is lost, the re-read can run under a different account, and the unit test that guarded this was narrowed without a stated reason.
origin: epic 11 retrospective, 2026-11-27
location: src/stores/slices/dailyDaySlice.ts:870 (DQ010 branch), :881 (lost-answer branch); tests/unit/stores/dailyQuestionSlice.nudge.test.ts:352-363
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge-retrospective.md`
severity: low
reason: In sendDailyNudge both branches call readDayById(dayId) without first re-checking that the same session is still signed in; readDayById records whoever is signed in when it starts, so after an account switch it reads the old account's day as the new one. The server refuses that day for a different account, so nothing is written: the cost is a failed request, a logged error and possibly the wrong message. 857be1bf switched the "session changed, so no re-read" test from a network failure to a DQ009 refusal, the one branch that does check, and the commit does not say why it narrows (AGENTS.md, Known pitfalls). Retrospective finding R1.
status: open

### DW-562: A nudge that ends as sent after the fact ("already sent", or found sent by the re-read after a lost answer) never tells the partner's open Daily or the sender's other device.

status: done 2026-11-28
origin: epic 11 retrospective, 2026-11-27
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge-retrospective.md`
severity: low
archived: 2026-11-28

### DW-563: The re-read after a lost nudge answer runs at once, so a connection that fails while the server is still committing can show "Your nudge could not be sent." while the push goes out. PLAUSIBLE, not reproduced.

status: done 2026-11-28
origin: epic 11 retrospective, 2026-11-27
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge-retrospective.md`
severity: low
archived: 2026-11-28

### DW-564: The migration-replay helper's check for a migration's own transaction can be fooled by dollar-quote tags with digits or a stray $$ in a comment.
origin: epic 11 retrospective, 2026-11-27
location: tests/support/helpers/migration-replay.ts:122
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge-retrospective.md`
severity: low
reason: The pattern /(\$[A-Za-z_]*\$)[\s\S]*?\1/ misses tags such as $fn1$, so a valid migration is wrongly rejected; a stray $$ in a comment can blank a real commit;, which the replay would then commit into the shared stack. Test tooling only. Retrospective finding R4.
status: open

### DW-565: Epic 11's tests duplicate the daily seed helpers and build the Sunday-to-Saturday week four times.
origin: epic 11 retrospective, 2026-11-27
location: tests/support/helpers/daily-clock.ts:36-91 (storeZone, seedPairDay) against tests/support/factories/daily-question.ts:91-160 (seedPairDays); tests/api/push-daily-reminders.spec.ts:84-90, :150-156; tests/unit/stores/dailyQuestionFixture.ts:114-121, :127-138; src/components/shared/__tests__/StreakRow.test.tsx:14-30; tests/e2e/partner/partner-streak.spec.ts:126-141
source_spec: `tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge-retrospective.md`
severity: low
reason: seedPairDay and storeZone repeat seedPairDays' assign_couple_day, daily_picks and user_time_zones SQL with a fixed zone instead of the host's, and push-daily-reminders.spec.ts still writes the same inserts inline; the calendar week is built separately in four test files. AGENTS.md's shared-helpers rule (DW-313) asks for one import. Retrospective finding G3.
status: open
