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
origin: spec-deferred fb06d3399a77
location: src/services/customMessageService.ts:313
source_spec: `1-make-every-test-able-to-fail.md`
severity: low
reason: src/validation/schemas.ts:139 is z.literal('1.0'), so a 2.0 file is refused by the schema ("Invalid version. Please select a valid option.") before src/services/customMessageService.ts:313-315 runs; no test reaches that message. Pre-existing, not caused by this story.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): the unreachable version branch in customMessageService.planImport is deleted; CustomMessagesExportSchema's z.literal('1.0') is the one check.

### DW-248: authServices tests restore their console.error spy only at the end of each test, so a failing test leaves console.error silenced for later tests.
origin: spec-deferred c286f2f5216b
location: src/api/auth/__tests__/authServices.test.ts
source_spec: `1-make-every-test-able-to-fail.md`
severity: low
reason: src/api/auth/__tests__/authServices.test.ts calls errorLog.mockRestore() as the last statement (pattern predates this story); vitest.config.ts sets no restoreMocks. Cleanup-on-failure belongs to story 4 (H4).
status: done 2026-09-26
resolution: already fixed in c2933427 (PR #375): authServices.test.ts:127-131 restores every spy in afterEach(vi.restoreAllMocks); no inline mockRestore remains.

### DW-249: The stale playwright-utils deviation comment in events-persistence.spec.ts survives in the submitNewEvent docblock.
origin: spec-deferred 4ba33866b90d
location: tests/e2e/settings/events-persistence.spec.ts:122
source_spec: `1-make-every-test-able-to-fail.md`
severity: low
reason: corrections.md lists it (real waitForResponse calls are at 135/177/208/338); it is a recorded-deviation (M9) item owned by story 6, not a story-1 category.
status: done 2026-09-26
resolution: already fixed in c2933427 (story 6, 9e4b271f): the submitNewEvent docblock at events-persistence.spec.ts:123-129 no longer names a deviation or waitForResponse.

### DW-250: interactionsSubscription.test.ts drains a fixed 2-3 microtasks before asserting, which may pass vacuously if the async chain is longer.
origin: spec-deferred 64dd49e27fb0
location: tests/unit/stores/interactionsSubscription.test.ts:394
source_spec: `1-make-every-test-able-to-fail.md`
reason: Unit advisory marks it UNVERIFIED (lines ~394-401, 439-443, 498-508). Settle by lengthening the chain in the SUT locally and checking the negative assertions still fail. Timing work is owned by story 2.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): the three one-step `await partnerLookups.at(-1)` waits are macrotask flushes; mutation (bug + one extra await in the slice) now fails the test the old wait let pass.

### DW-251: getDateLabel counts elapsed ms / 86400000 from local midnight, so just after spring-forward it labels yesterday "Today".
origin: spec-deferred b2f5f39a2d35
location: src/utils/moodGrouping.ts:66
source_spec: `1-make-every-test-able-to-fail.md`
severity: medium
reason: src/utils/moodGrouping.ts:66; found during planning (now = 2026-03-09 00:30 EDT gives diff 0 for Mar 8). Story 1's rewritten tests avoid DST; story 2 owns the DST row at src/utils/__tests__/moodGrouping.test.ts:8.
status: done 2026-09-26
resolution: already fixed in c2933427 (G6): moodGrouping.ts:71-75 compares Date.UTC stamps of the local dates with Math.round; DST rows in moodGrouping.test.ts:64-78; reproduced under TZ=America/New_York at 2026-03-09 00:30 -> Mar 8 'Yesterday'.

### DW-252: Fixed `await Promise.resolve()` hop counts remain in realtimeLeaveContract and moodSyncSubscription (fireReopen / replacement-SUBSCRIBED).
origin: spec-deferred 74ecfb5c4a83
location: tests/unit/api/realtimeLeaveContract.test.ts:200; tests/unit/api/moodSyncSubscription.test.ts:947
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
reason: Same fragility as the interactionsSubscription advisory fixed here; no catalog row names them. Found during implementation.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): drains directly after advanceTimersByTimeAsync removed (it already yields a native macrotask); the realtimeLeaveContract negative case waits a macrotask.

### DW-253: dateUtils getDaysSince and formatMessageTimestamp share the elapsed-ms / 24 h DST flaw fixed in moodGrouping (G6).
origin: spec-deferred d4bd7164a9b7
location: src/utils/dateUtils.ts:61
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: medium
reason: Both floor (todayMidnight - dayMidnight) / 86400000; the day after spring-forward that is 23 h, so yesterday's items read as today. No row's test exposes them; fixing needs new coverage (SPEC non-goal).
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): calendarDaysBetween in dateUtils.ts (Date.UTC of local components, Math.round) now backs getDaysSince, formatMessageTimestamp, moodGrouping.getDateLabel and getCalendarDaysDiff; six DST rows failed before the fix.

### DW-254: e2e waitForLoadState('networkidle') gates on pages with an open Realtime socket.
origin: spec-deferred 1fe048f751f0
location: tests/e2e/notes/love-notes-realtime.spec.ts:152; tests/e2e/partner/partner-mood-realtime.spec.ts:152
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
reason: Advisory timing item; it is a readiness gate owned by story 3 (M1/readiness).
status: done 2026-09-26
resolution: already fixed in c2933427 (story 3, 193537b5): no waitForLoadState('networkidle') remains outside tests/e2e-archive; the two sites now await the specific read's 200. Premise also wrong: Playwright's network-idle counts frame._inflightRequests only, and WebSockets are tracked separately, so an open Realtime socket never blocked it.

### DW-255: dbSchema.test.ts fails about 1 run in 4 under --sequence.shuffle, also before this story.
origin: spec-deferred 301cde1beb10
location: tests/unit/services/dbSchema.test.ts
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: medium
reason: An earlier case leaves happy-dom window.location invalid, so importing src/api/supabaseClient.ts throws Invalid URL. Test isolation, owned by story 4 (H4).
status: done 2026-09-26
resolution: already fixed in c2933427: afterEach vi.unstubAllGlobals() in dbSchema.test.ts and the split files; pre-PR copy failed 8/20 shuffled seeds, current files 0/20.

### DW-256: useRealtimeMessages keeps one real setImmediate as its unhandled-rejection checkpoint.
origin: spec-deferred 59c6de880162
location: src/hooks/__tests__/useRealtimeMessages.test.ts:1181
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
reason: It is the only signal Node gives before reporting an unhandled rejection; not a catalog row. Pre-existing.
status: done 2026-09-26
resolution: accepted, not a sleep: Node emits unhandledRejection only after a macrotask boundary and vitest fakes setImmediate by default, so the real setImmediate (now useRealtimeMessages.retriedJoin.test.ts:449) is a safety net for the rejection checkpoint; mutation (catch rethrows) still fails both checkpoint tests. Kept.

### DW-257: interceptNetworkCall routes in partner-kit / partner-mood are still registered asynchronously and may race page.goto.
origin: spec-deferred a98e5c01b508
location: tests/e2e/partner/partner-kit.spec.ts:91; tests/e2e/partner/partner-mood.spec.ts:55
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
reason: Pre-existing: playwright-utils registers the route inside an async test.step. This story made a miss fail loudly (awaited with a 15 s timeout) instead of silently; guaranteeing registration before goto needs an awaited page.route (M9, story 6) or a library hook.
status: done 2026-09-26
resolution: accepted: fulfillOn is an alias of interceptNetworkCall, whose route registration runs inside test.step, but every matched URL is a REST read sent after HTML, modules and auth bootstrap, and a miss throws after the awaited 15 s timeout rather than passing silently. An awaited page.route with a deviation comment remains available if a hard guarantee is ever wanted.

### DW-258: Review: dateUtils formatMessageTimestamp / getDaysSince DST mislabel (same as the earlier dateUtils item).
origin: spec-deferred e2f980c69ff1
location: src/utils/dateUtils.ts:204
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: medium
reason: Blind Hunter re-raised it; pre-existing app bug not exposed by any row test.
status: done 2026-09-26
resolution: duplicate of DW-253 (same functions, same flaw); resolved with it.

### DW-259: Review: the remaining real setImmediate in useRealtimeMessages contradicts the literal AC 'no setImmediate waits remain'.
origin: spec-deferred 35aa4b255079
location: src/hooks/__tests__/useRealtimeMessages.test.ts:1181
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
severity: low
reason: Edge Case Hunter claim finding; pre-existing test design, not a catalog row.
status: done 2026-09-26
resolution: duplicate of DW-256; closed with it.

### DW-260: Same-class timing sites with no catalog row may still be scored by a re-review (hop-count drains, fixed act loops, live-clock start dates, lastWelcomeView stamps).
origin: spec-deferred 4c7cadc73a15
location: n/a
source_spec: `2-remove-clock-timing-and-async-nondeterminism.md`
reason: UNVERIFIED. Intent auditor listed realtimeLeaveContract, photoImageCache, EventsSettings hop counts; PhotoGridItem.recovery and usePhotoImage act loops; couple-start-date.spec.ts:89 and couple-settings-offline.spec.ts:110,161 start dates; lastWelcomeView = Date.now() in 33 e2e files. The e2e advisories mark the last two 'not fired'. Settle by running bmad-testarch-test-review on each folder.
status: done 2026-10-29
resolution: settled 2026-10-29 by the fresh bmad-tea-test-review runs (tests/e2e and tests/api + tests/integration on 2026-10-28, src and tests/unit on 2026-10-29): none of the four reports has an H1, H2, M1 or M6 row (epic retrospective A6).

### DW-261: Returning to Settings mid-test by dock click is not gated on Settings' own mount read.
origin: spec-deferred 766cc171c57d
location: tests/e2e/settings/events-crud.spec.ts; tests/e2e/settings/events-persistence.spec.ts
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
severity: low
reason: events-crud (~164, ~201) and events-persistence (~324) click a row control right after navigateTo(settings) while the mount GET is in flight. Pre-existing and not an M1 row; row ids are stable, so the click still lands.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): returnToSettings() in tests/support/helpers/settings-screen.ts gates the dock return on Settings' own mount read (after Home's read settles); used in events-crud and events-persistence.

### DW-262: Non-retrying reads remain in touched specs outside the M1 rows.
origin: spec-deferred 5fb54d78dc27
location: tests/e2e/settings/events-history-pagination.spec.ts; tests/e2e/offline/love-notes-offline-send.spec.ts; tests/e2e/account-data/cross-device.spec.ts
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
severity: low
reason: events-history-pagination one-shot evaluateAll order check (~196-198) and hand-rolled waitForResponse; love-notes-offline-send allTextContents()/queuedContents (~143-148); cross-device textContent() (~85). None is named by an M1 row; they fall under M9 or other rows.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): recurseUntil around the events-history-pagination order check and the love-notes-offline-send queue reads; cross-device reads the favorite text after the 'Remove from favorites' assertion.

### DW-263: Navigating e2e specs with no M1 row were not audited, so a fresh re-review may still score M1 somewhere.
origin: spec-deferred 3454ff3c90a8
location: tests/e2e/
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
reason: About 25 navigating spec files carry no M1 row and are untouched. Settle by running bmad-testarch-test-review on tests/e2e/.
status: done 2026-10-29
resolution: settled 2026-10-29: the fresh 2026-10-28 bmad-tea-test-review run on tests/e2e has no M1 row (epic retrospective A6).

### DW-264: account-data.spec.ts A/B/A favorites fails about 1 run in 6 on a 406 partner-record read during sign-out/sign-in switching.
origin: spec-deferred a50ae7184099
location: tests/e2e/account-data/account-data.spec.ts; src/api/partnerService.ts
source_spec: `3-wait-for-data-before-interacting-in-e2e-specs.md`
severity: medium
reason: Reproduced on the unchanged baseline spec (git show ad5115cd copy, --repeat-each=6: 1 failed with the same GET 406 users?select=id,email,display_name,birthday). Looks like the partner lookup (single()) racing a sign-out; app-side, not caused by this story.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): getPartner(userId), lookupPartnerId and lookupOwnDisplayName read with maybeSingle and re-check the session after each read through a shared sessionMismatch helper, answering error (never unlinked/unset) when the session ended or changed; the partner display-name read uses maybeSingle; the users?select=partner network-monitor exclusion is removed and the fake-token specs stub the partner reads.

### DW-265: Catch-then-cleanup teardown is skipped when Playwright times the test out.
origin: spec-deferred 7cc3807d2e26
location: tests/api/*.spec.ts; tests/e2e/auth/display-name-setup.spec.ts
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: A timeout abandons the test body, so cleanup placed after a catch never runs (the display-name-setup `renamed` docblock explains this). Affected sites: display-name-setup nameless accounts (~102, ~164); couple-broadcast-authorization outsiders; interaction-authorization; interaction-record-ownership (~64/~97); profile-name-email-ownership; events-write-wire-shape `runWithPairCleanup`. Fixing it means moving each cleanup to `test.afterEach`. No H4 row or corrections item names these; found by a planning audit.
status: done 2026-09-26
resolution: fixed in PR #377 (squash 6be94f31): tests/support/fixtures/cleanup.ts adds cleanup.defer(label, fn), torn down LIFO in its own 60 s slot with a 15 s limit per fn, depending on page/apiRequest/supabaseAdmin so order can't be wrong; every body cleanup in tests/api and tests/e2e moved onto it. Proof: an injected hang left the throwaway account and row on the old code and removed both on the new.

### DW-266: Seeding helpers leak what they already created when a later step of the seed fails.
origin: spec-deferred 5b4d24474152
location: tests/e2e/offline/photos-offline.spec.ts; tests/e2e/offline/birthdays-wedding-offline.spec.ts; tests/e2e/auth/implicit-fragment-rejection.spec.ts
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: photos-offline `seedPhotos` (~111-143) leaks objects and rows because `seeded` is assigned only once the helper returns. birthdays-wedding-offline `setValues` (~118, ~180) makes three writes before its `try`. implicit-fragment-rejection `createForeignSession` (~40-43) throws after creating the account. Found by a planning audit; no row names them.
status: done 2026-09-26
resolution: fixed in PR #377 (squash 6be94f31): seedPhotos, birthdays-wedding-offline setValues and implicit-fragment-rejection createForeignSession defer each undo before or right after the step that creates it.

### DW-267: birthdays-wedding resets the pair to null instead of restoring its prior values, and leaves the couple_settings row in place.
origin: spec-deferred f41bef60c847
location: tests/e2e/settings/birthdays-wedding.spec.ts:33
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: `resetPair` (~33-52) sets both birthdays and wedding_date to null. The couple_settings row is the pair's one shared settings row, and couple-start-date also upserts it, so the row is not an entity created by the test. It is left in a neutral state.
status: done 2026-09-26
resolution: false premise: global setup never writes birthdays or wedding_date (global-setup.ts:83/117/123), the spec resets to null at start and asserts 'Not set yet', and home-kit asserts 'Date TBD'; null IS the untouched state, and restoring prior values would re-plant a failed run's leak. couple-start-date and couple-settings-offline delete the couple_settings row before use.

### DW-268: love-notes-offline-send teardown deletes while the page is back online, so a queued note can still flush after the delete.
origin: spec-deferred c7445457a073
location: tests/e2e/offline/love-notes-offline-send.spec.ts:205
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: The `finally` block runs `setOffline(false)` before `deleteNotes`. This only happens when the test fails partway through the flush. The fix would close the page, or keep it offline, before deleting. Found by a planning audit.
status: done 2026-09-26
resolution: fixed in PR #377 (squash 6be94f31): the deferred teardown closes the page's context first (guarding unrouteAll on a closed page), deletes by stamp, re-queries after 2 s and asserts nothing remains.

### DW-269: The shuffled-order guarantee is checked only by hand; no CI or npm script runs vitest shuffled.
origin: spec-deferred bc655d22f0e1
location: .github/workflows/test.yml; package.json
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: medium
reason: Found by the verification-gap review. `test:unit` and CI's `test:unit:coverage` run in declaration order, which passed even before this story. Reverting `resetAllMocks` or `unstubAllGlobals` would pass CI again. The fix is a fixed-seed `vitest run --sequence.shuffle --sequence.seed=1` step in `test.yml` or `scripts/ci-local.sh`. This story's spec forbids config changes.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): test:unit:coverage runs --sequence.shuffle with the seed from SEED (github.run_number in CI, printed and replayable, default 1); ci-local.sh adds a shuffled run. restoreMocks: true in vitest.config.ts prevents the spy-leak class outright.

### DW-270: The G6 e2e teardowns still sit in `finally` blocks, which a Playwright timeout skips.
origin: spec-deferred 20515cd268c8
location: tests/e2e/account-data/cross-device.spec.ts; tests/e2e/account-data/account-data.spec.ts; tests/e2e/offline/account-data-offline-copy.spec.ts; tests/e2e/offline/love-notes-offline-send.spec.ts
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: Found in review. The `finally` teardowns in cross-device, the account-data mood test, the three account-data-offline-copy tests and love-notes-offline-send run only when the body throws, not when it times out. G5 moved note deletion to `test.afterEach` for this reason; these were not moved. The first deferred entry names this same class for the api specs.
status: done 2026-09-26
resolution: closed with DW-265 in PR #377 (squash 6be94f31) (duplicate class).

### DW-271: The account-data mood teardown checks the delete's error but not how many rows it deleted.
origin: spec-deferred cb54a952fffc
location: tests/e2e/account-data/account-data.spec.ts:292
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: This predates the story. The delete, keyed on `user_id` plus `created_at`, would also answer `error: null` if its filter matched nothing. G5's note teardown checks the count for this reason.
status: done 2026-09-26
resolution: fixed in PR #377 (squash 6be94f31): the account-data mood delete selects ids and soft-checks exactly one row when the save committed; sibling by-id deletes use the count-checked deleteRowById (tests/support/helpers/teardown.ts).

### DW-272: Isolation advisories that carry no rule id are fixed by no story.
origin: spec-deferred 3d5f22cdb7d6
location: tests/unit/services/customMessageService.ownership.test.ts:82; tests/api/check-constraint-error-mapping.spec.ts:241
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: Found by the intent audit. None has an H4 id: - unit: `customMessageService.ownership.test.ts:82` replaces `globalThis.indexedDB` and never restores it; `accountDataSlices.test.ts` has console.error spies. - api: the `check-constraint-error-mapping.spec.ts:241-280` fixed-per-worker leak advisory. - e2e: the "readers that rely on other tests' try/finally restores" advisory (home-kit, mood-kit, persisted-events-strip, photos-offline). Story 4's intent is H4 rows plus the corrections items.
status: done 2026-09-26
resolution: fixed: unit part in PR #376 (restoreMocks: true; indexedDB via vi.stubGlobal), api/e2e part in PR #377 (squash 6be94f31) (per-run probe ids and labels plus an exact-row deferred delete in check-constraint-error-mapping; writer cleanup survives timeouts; mood-kit comment corrected).

### DW-273: Two specs outside this diff still throw a bare `AggregateError`, which hides the assertion it wraps in Playwright reports.
origin: spec-deferred fe232ea2e183
location: tests/api/interaction-record-ownership.spec.ts:108; tests/e2e/auth/display-name-setup.spec.ts:154
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: low
reason: `interaction-record-ownership.spec.ts` (~108) and `display-name-setup.spec.ts` (~154, ~229) predate this story and are outside its sites. The new `throwCollected` helper (`tests/support/helpers/collected-failures.ts`) is the fix.
status: done 2026-09-26
resolution: false premise on the installed Playwright 1.63.0: TestInfo records each AggregateError child as its own error (workerProcessEntry.js visit(child) over error.errors, since 1.61), and every configured reporter reads errors. Stale rationale comments in collected-failures.ts and rls-security.ts are corrected with DW-265.

### DW-274: A LoveNoteMessage image-cache session test failed once under full-suite load.
origin: spec-deferred 05ac70a1571d
location: src/components/love-notes/__tests__/LoveNoteMessage.test.tsx:452
source_spec: `4-isolate-tests-and-make-cleanup-failure-proof.md`
severity: medium
reason: Seen during this story's verification. "drops a cache read that resolves after a sign-out and back in (new session)" reported that `createObjectURL` was called once. It then passed 8 of 8 runs alone, a full `test:unit` rerun, and 15 shuffled seeds. The file is untouched by this story; this is timing nondeterminism, story 2's class.
status: done 2026-09-26
resolution: already fixed in c2933427: the test waits for the image spinner before switching session and pins mockReadCachedImage to one call; 0/30 idle, 0/30 under load. The leftover .animate-spin lookup is switched to love-note-image-loading with the DW fixes PR.

### DW-275: LoginScreen's empty-fields check cannot be reached from the UI, so its kit test covers it only through a raw form submit.
origin: spec-deferred 2ff2ecdd08c8
location: src/components/LoginScreen/LoginScreen.tsx:107
source_spec: `5-drive-component-tests-through-user-event.md`
severity: low
reason: The submit button is disabled while either field is empty (src/components/LoginScreen/LoginScreen.tsx:276), and a browser refuses implicit submission when the default button is disabled. The "Please enter both email and password" branch (LoginScreen.tsx:107-110) runs only under a synthetic submit event, which LoginScreen.kit.test.tsx:97 keeps with a same-line reason. Pre-existing: either the branch is dead code or the test premise needs a product decision.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): the unreachable empty-fields branch in LoginScreen is deleted; the kit error-surface test reaches its error through user-event with no synthetic submit.

### DW-276: The 2026-10-29 src re-review scored two of the commented raw submits this story kept as M5 rows.
origin: spec-deferred 2b1d4cbb8c95
location: src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx:90; src/components/shared/__tests__/kitSurfaces.test.tsx:409
source_spec: `5-drive-component-tests-through-user-event.md`
reason: The registry's M5 rule (criteria-registry.md:169) has no exemption mechanism. The folder-run workers did not score fireEvent.submit past native validation, click-without-focus cases, img error or window online (test-review-target-src.md:398), which covers most kept lines, but the same-batch refresh.click() pairs in EventsSettings.test.tsx were scored (folder row at :1422 at 92f1c517). Settle by running bmad-testarch-test-review on src/ and tests/unit/ and reading the M5 rows. Rescoped 2026-10-29 (epic retrospective A6): the fresh src run scores exactly two M5 rows, both `fireEvent.submit` calls that get past native `minLength` so the component's own length rule runs; tests/unit has none. Both are Medium, outside the epic's Boundaries. The reviewer's fix for each: prefill or type a name that passes native `minLength={3}` but fails the component's trimmed 3-30 rule (for example `'ab '`), then submit with `user.click`.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e

### DW-277: AGENTS.md does not record that user-event hangs under Vitest fake setTimeout without both advanceTimers and a jest-global shim.
origin: spec-deferred 4656b1984f27
location: AGENTS.md
source_spec: `5-drive-component-tests-through-user-event.md`
severity: low
reason: Testing Library only recognises Jest fake timers (jestFakeTimersAreEnabled checks a `jest` global plus setTimeout.clock, which vi's faked setTimeout carries). PhotoUpload.autoClose.test.tsx needed userEvent.setup({ advanceTimers }) and vi.stubGlobal('jest', …); the next file that fakes setTimeout will hit the same hang. The fix edits an agent-context file.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): AGENTS.md 'Maintained by hand' records the user-event hang under a faked setTimeout and both remedies.

### DW-278: The two offline reconnect-read waits now resolve on the first matching GET, so a failed read in that window would throw where waitForResponse skipped it.
origin: spec-deferred 45ba081d0688
location: tests/e2e/offline/interactions-offline-copy.spec.ts:164; tests/e2e/offline/love-notes-offline-copy.spec.ts:252
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
reason: interceptNetworkCall observe mode resolves on the first matching request and throws "No response received" when that request fails. page.waitForResponse ignored failed requests. The arm is set while offline, just before goOffline(false). To settle it, confirm the app sends no interactions or love_notes_visible GET between the arm and the reconnect (it passed 3 runs). If one can fail there, keep waitForResponse with a deviation comment.
status: done 2026-09-26
resolution: fixed in PR #377 (squash 6be94f31) (25c9db41): a fetchNotes started by the page load can still be in its partner lookup when the device goes offline, so its love_notes_visible read goes out offline and fails inside the arm window (logged 2/30 locally). Both reconnect waits (love-notes-offline-copy, interactions-offline-copy) now use page.waitForResponse on method, URL and ok() with a deviation comment; forced race: old wait 10/10 failed, new 30/30 passed; 120/120 clean.
reopened: 2026-09-26 -- the "false premise" closure was wrong: PR #377 burn-in shard 3 (run 36234555916) failed love-notes-offline-copy.spec.ts:222 with "NetworkInterceptError: No response received for the request" on the Observe GET **/rest/v1/love_notes_visible?* wait.

### DW-279: No fresh TEA re-review has confirmed the M9 fixes: recurseUntil call sites never name recurse, the deviation comments sit on the line above, and one reason repeats about 30 times.
origin: spec-deferred d55a2645e7e9
location: tests/support/helpers/recurse.ts; tests/e2e/; tests/api/
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
reason: The registry row says the comment must be "on the line"; the mandate's Deviation Protocol says "a one-line comment above the code", and the diff follows the mandate. CAP-5's gate is a fresh bmad-testarch-test-review run on tests/e2e and tests/api reporting zero M9 and L9 rows. Running it settles this.
status: done 2026-10-29
resolution: settled 2026-10-29: the fresh 2026-10-28 bmad-tea-test-review runs on tests/e2e and on tests/api + tests/integration have no M9 or L9 row (epic retrospective A6).

### DW-280: The favorites waits in account-data-offline-copy now resolve on the first matching GET, so a failed or cancelled read in the arm window would throw where waitForResponse skipped it.
origin: spec-deferred bc6e87ea2a2b
location: tests/e2e/offline/account-data-offline-copy.spec.ts:209; tests/e2e/offline/account-data-offline-copy.spec.ts:231; tests/e2e/offline/account-data-offline-copy.spec.ts:268
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
reason: Same mechanism as the reconnect-read entry above, at two more sites. At ~231 the arm is set while offline, just before goOffline(false). At ~209 and ~268 the arm is set just before page.reload(), so a favorites refresh from the first load that is sent after the arm would be cancelled by the reload. Observe mode then gets a null response() and throws "No response received". To settle it, confirm that no FAVORITES_READ can be sent inside either window. If one can, keep waitForResponse with a deviation comment, or await the first-load read before arming. The spec passed in this run.
status: done 2026-09-26
resolution: reload sites already fixed in c2933427 (87d8ce25): the cold-start FAVORITES_READ is awaited before arming, and a cold start sends exactly one (messagesSlice.ts refresher waits for seeding; authSessionVersion changes only with the user). Reconnect site is a false premise: fetchFavoriteKeys requireOnline() and messagesSlice isOnline() guards.

### DW-281: Hand-rolled page.on request/response listeners and a page.waitForEvent('requestfailed') have no deviation comment, and the acceptance grep does not look for them.
origin: spec-deferred c7c485ff65ff
location: tests/e2e/ (page.on('request'|'response'|'requestfinished'|'requestfailed') sites); tests/e2e/settings/events-history-pagination.spec.ts:241
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
reason: These are pre-existing and none of the 50 M9 rows names them, but a fresh bmad-testarch-test-review might flag them as M9. Sites: display-name-setup ~173, partner-mood-realtime ~152-159, love-notes-realtime ~144-151, needs-a-connection ~95, account-data-offline-copy ~312, photos-offline ~328, and events-history-pagination ~241 (waitForEvent). The mandate lists page.on('response') under the network-error-monitor row. To settle it, run the CAP-5 re-review and check whether it reports any of these sites.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): a `// playwright-utils deviation:` comment sits on the line above every hand-rolled page.on / waitForEvent network listener (12 lines, 8 files) and the auth-bootstrap fixture's stub.

### DW-282: account-data.spec still asserts response.ok() on the body-matched mood save wait instead of the exact status.
origin: spec-deferred c53bfe914423
location: tests/e2e/account-data/account-data.spec.ts:299
source_spec: `6-adopt-playwright-utils-in-playwright-specs.md`
severity: low
reason: This is pre-existing: line 262 at the baseline, and the story only added a deviation comment above the wait. The story's exact-status rule was applied only to converted waits. `.ok()` accepts any 2xx, so the test proves slightly less than an exact 201 would. The fix is to assert the status the run returns (expected 201 for the POST upsert; confirm it on a run).
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): the mood repair save asserts status 201 (a 200 control failed with 'Received: 201').

### DW-283: A fresh TEA re-review may flag M2/L6 instances that no catalog row names, such as the couple-settings server answer built about seven times in tests/unit/stores/coupleSettings.test.ts.
origin: spec-deferred 99dfd8ac8662
location: tests/unit/stores/coupleSettings.test.ts
source_spec: `7-build-test-data-through-factories-and-name-magic-values.md`
reason: This story fixed every catalog row. It did not sweep the files for repeated shapes or literals that no row names. The implementer noted the coupleSettings server answer, `{ relationshipStart, weddingDate }`, as one such repeat. To settle it, run bmad-testarch-test-review on tests/unit, src, tests/e2e and tests/api + tests/integration, and count the M2/L6 rows it reports.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): serverAnswer() beside linked() in coupleSettings.test.ts replaces the seven repeated answers.

### DW-284: Lines that no catalog row names still carry the story's defect kinds in files this story edited, so a fresh TEA re-review may flag them.
origin: spec-deferred af8d5ee23b56
location: src/components/LoginScreen/__tests__/LoginScreen.kit.test.tsx, tests/unit/App.eventsSession.test.tsx, and the other files listed
source_spec: `8-fix-names-selectors-markers-and-test-structure.md`
reason: This story fixed catalog rows only; its spec forbids sweeping unnamed lines. Reviewers found these leftovers: - LoginScreen.kit.test.tsx finds the wordmark and tagline with getByText, although login-wordmark and login-tagline now exist. - App.eventsSession.test.tsx still has 8 getByText('Loading...') lookups. - Several "should ..." test names remain in MessageInput, LoveNoteMessage, useNetworkStatus, backgroundSync, ImagePreview and FullScreenImageViewer. - Some e2e selectors still use structure: h3 + div, h3 ~ span, firstElementChild and [data-testid^=...] prefixes. - Other lookups: dbSchema getBlockedDialog uses querySelector, AnniversarySettings.writes uses queryByText, FullScreenImageViewer finds its overlay by tagName, and LoveNotes.realtimeStatus uses getByText('Connected'). - photoDialogsA11y has two tests with the same name, and a PhotoImageStates if (confirm) step can silently not run. - Names that state constants, such as "names the database 'my-love-db'", might count as L5.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): countdown parts, panels and tiles found by test id (17 sibling selectors, 3 firstElementChild), 8 'Loading...' lookups by auth-loading-screen, wordmark/tagline by test id, dbSchema dialog by role, the PhotoImageStates `if (confirm)` step is an assertion (the Delete button is provably gone), implementation-named tests renamed. Kept: LoveNotes.realtimeStatus getByText('Connected') (the line deliberately has no role or id), `.locator('h3')` card labels and data-testid prefix selectors; the photoDialogsA11y duplicate-name item was false (different describes). The e2e checker run (DW-263/279) judges what remains.

### DW-285: PhotoViewer.focus resets deletePhotoMock inline at the end of each pending-delete test, so a failed assertion leaves a pending mockReturnValue for later tests.
origin: spec-deferred e4f57b3211b4
location: src/components/PhotoGallery/__tests__/PhotoViewer.focus.test.tsx
source_spec: `8-fix-names-selectors-markers-and-test-structure.md`
severity: low
reason: The original single test used the same inline mockReset. Splitting it into two tests doubled the number of places this can happen. It matters only after a test has already failed, where it can cause cascading failures. The fix is an afterEach(() => deletePhotoMock.mockReset()) in that describe.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): one afterEach resets deletePhotoMock in PhotoViewer.focus; the ten inline resets are gone.

### DW-286: src/stores/slices/authSlice.ts:98 still names loaderIdentityGuards.test.ts, which this story split into loaderIdentityGuards.*.test.ts; the comment is app code, which this story may not touch.
origin: spec-deferred 088b893a1578
location: src/stores/slices/authSlice.ts:98
source_spec: `9-split-oversize-test-files.md`
severity: low
reason: The comment reads "are covered by `loaderIdentityGuards.test.ts`". That file no longer exists; its tests are in the seven loaderIdentityGuards.*.test.ts files. SPEC.md limits app-code changes to test hooks and bug fixes, so the comment was left as is.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): the authSlice comment names tests/unit/stores/loaderIdentityGuards.*.test.ts.

### DW-287: EventsSettings.errorIsolation, .focus, .lifetime and .pagination still keep their own copies of helpers that eventsSettingsKit.tsx now exports (makeEvent, renderSection, fillForm and others).
origin: spec-deferred 2c4526a62b93
location: src/components/Settings/__tests__/EventsSettings.{errorIsolation,focus,lifetime,pagination}.test.tsx
source_spec: `9-split-oversize-test-files.md`
severity: low
reason: The duplication predates this story: each sibling hand-copied the harness from EventsSettings.test.tsx. This story created the shared kit, but its spec forbade editing the siblings. The copies differ in places (the setStore behaviour, and makeEvent signatures in lifetime and pagination), so consolidating them is a separate change.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): the .focus and .errorIsolation suites import the byte-equivalent helpers from eventsSettingsKit.tsx; lifetime/pagination and each suite's setStore keep their differing variants.

### DW-288: Coverage counts non-test helper modules under src/**/__tests__/ as app source, and this story adds two (eventsSettingsKit.tsx, realtimeMessagesKit.ts).
origin: spec-deferred df7482a0823c
location: vitest.config.ts coverage.exclude
source_spec: `9-split-oversize-test-files.md`
severity: low
reason: vitest.config.ts coverage.exclude lists only src/**/*.test.ts(x), so a helper in a __tests__ folder counts toward coverage as covered app code. src/components/PhotoGallery/__tests__/fakePhotoStore.ts already did this before this story. The fix is a config change: add 'src/**/__tests__/**' to coverage.exclude.
status: done 2026-09-26
resolution: fixed in PR #376 (squash 273fbf2c): coverage.exclude adds src/**/__tests__/**; the three harness files no longer appear in coverage-final.json and thresholds hold.

### DW-289: InteractionHistory labels a poke "Yesterday" by elapsed hours, not calendar days.
origin: orchestrator triage 2026-09-26
location: src/components/InteractionHistory/InteractionHistory.tsx:69
source_spec: n/a
severity: low
reason: formatTimestamp floors (now - date) / 86400000, so "Yesterday" means 24-48 hours ago: a poke from 23:00 yesterday reads as "Xh ago" at 08:00, while love-note and mood timestamps use calendar days (dateUtils). Found during the DW-253 investigation; it is an elapsed-time label by design, so whether it should switch to calendar days is a consistency choice, not a DST bug.
status: done 2026-09-26
resolution: fixed in PR #378 (squash): InteractionHistory day labels count calendar days via calendarDaysBetween; minutes stay elapsed and hours show only within today. Tests failed 5/9 before.

### DW-290: LoginScreen's "Password must be at least 6 characters" branch is probably unreachable for typed input.
origin: orchestrator triage 2026-09-26
location: src/components/LoginScreen/LoginScreen.tsx:118
source_spec: n/a
severity: low
reason: The password input carries minLength={6} (:285) and the form has no noValidate, so native constraint validation should block a typed short password before the submit handler runs, the same way `required` made the empty-fields branch dead (DW-275). UNVERIFIED: tooShort applies only to user-edited values, so confirm in a browser before deleting.
status: done 2026-09-26
resolution: kept, not dead: a Playwright check showed typed, pasted and fill() values are blocked by native tooShort, but a value set by script (as a password manager or autofill can) skips it and reaches the branch, which then shows the message. The branch stays.

### DW-291: playwright-utils' interceptNetworkCall fixture drops the timeout option.
origin: orchestrator triage 2026-09-26
location: node_modules/@seontechnologies/playwright-utils/dist/esm/intercept-network-call/intercept-network-call-fixture.js
source_spec: n/a
severity: low
reason: The fixture forwards only { method, url, fulfillResponse, handler } to interceptNetworkCall, so a timeout passed through the fixture is silently ignored; specs that need one call the standalone function (fulfillOn in tests/support). Upstream library issue; nothing in this repo is broken while specs use fulfillOn.
status: done 2026-09-26
resolution: won't fix here -- upstream library behaviour. Nothing in this repo is affected: specs needing a timeout call the standalone function through fulfillOn (tests/support), and the fixture's dropped option is documented there. Raise with @seontechnologies/playwright-utils if it matters again.

### DW-292: sendPartnerRequest's "This user already has a partner" check can never fire, because RLS hides the target's row.
origin: orchestrator review 2026-09-26
location: src/api/partnerService.ts:222-231
source_spec: n/a
severity: low
reason: The read `users.select('partner_id').eq('id', toUserId).single()` targets a user who is neither the caller nor their partner; the users SELECT policy returns own and partner rows only, so the answer is always PGRST116 (HTTP 406), targetUserRecord is null, and the message is unreachable. Whether a partnered target is refused server-side (partner_requests policy or accept_partner_request) was not checked. With the users?select=partner monitor exclusion gone, a future e2e that sends a real request without skipNetworkMonitoring will trip on the 406.
status: done 2026-09-26
resolution: fixed in PR #378 (squash): the target-row read (always hidden by RLS, always 406) is removed; accept_partner_request already refuses the link ('One or both users already have a partner', confirmed locally), and acceptPartnerRequest now shows that as a readable message. The own-row read uses maybeSingle plus the sessionMismatch re-check.

### DW-293: partnerService.hasPartner has no callers.
origin: orchestrator review 2026-09-26
location: src/api/partnerService.ts (hasPartner)
source_spec: n/a
severity: low
reason: Nothing in src or tests calls it; partnerSlice has its own hasPartner() over store state. The DW-264 fix had to add a userId parameter only to keep it compiling. Dead code to delete.
status: done 2026-09-26
resolution: fixed in PR #378 (squash): partnerService.hasPartner deleted.

### DW-294: Partner search cannot find anyone, because the users SELECT policy hides every row but the caller's own and their partner's.
origin: orchestrator review 2026-09-26
location: src/api/partnerService.ts searchUsers (~:152-194); users SELECT policy "Users can view self and partner profiles"
source_spec: n/a
severity: high
reason: searchUsers queries users directly with email/display_name ilike, and its comment says "RLS policy allows authenticated users to search", but the only SELECT policy (local and hosted, read from pg_policies 2026-09-26) is id = auth.uid() OR id = get_my_partner_id() OR partner_id = auth.uid(). An unlinked user's search therefore returns nothing, so a new couple cannot connect through the app. E2E specs stub the search response, which is why nothing caught it. The fix is a SECURITY DEFINER search RPC (a migration), which needs a product decision on what a search may reveal about other accounts (exact-email match only vs substring on email/name).
status: done 2026-09-26
resolution: fixed in PR #379 (squash 35cbd323): searchUsers calls the new SECURITY DEFINER find_partner_by_email, which matches the exact sign-in email only (case-insensitive, trimmed) and returns no row, an unlinked account's id and name, or is_taken with no id or name. The unstubbed E2E tests/e2e/partner/partner-connect.spec.ts covers found, taken, missing and self.

### DW-295: A partner request to someone already partnered is accepted at insert and stays pending forever.
origin: orchestrator review 2026-09-26
location: supabase partner_requests INSERT policy; src/api/partnerService.ts sendPartnerRequest
source_spec: n/a
severity: low
reason: The partner_requests INSERT policy checks only the sender (WITH CHECK auth.uid() = from_user_id), and the client cannot see the target's partner_id (DW-292), so the request is inserted. The recipient never sees it (the connect UI is hidden once linked) and the sender sees it pending indefinitely; accept_partner_request would refuse it. Refusing at insert needs a migration (a check on the target's partner_id inside a SECURITY DEFINER function or trigger).
status: done 2026-09-26
resolution: fixed in the app by PR #379 (squash 35cbd323), not at insert: find_partner_by_email returns no id for an account that already has a partner, so the Connect screen can no longer send it a request, and accept_partner_request already declines every other pending request of both users when a couple links, so a request sent before its target linked elsewhere does not stay pending either. The INSERT policy is unchanged, so only a request inserted outside the app, with a partnered user's id, still stays pending, in the sender's own list.

### DW-296: A received partner request shows only the name the sender chose, and one tap on Accept links the accounts for good, so a stranger can pose as the partner.
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
location: src/components/PartnerMoodView/PartnerMoodView.tsx:586 (name) and :595 (Accept)
source_spec: n/a
severity: medium
reason: The card renders `other_display_name ?? other_email`, so once a sender sets a display name their email is never shown, and Accept calls acceptPartnerRequest with no confirmation. The link cannot be undone: the client cannot update partner_id and there is no unlink RPC. Since #379 any signed-in account that knows the recipient's email can send a request, so a stranger who names themselves after the partner gets the couple's notes, moods and photos after one tap. Fix: always show other_email on received (and sent) requests, and confirm before Accept, naming that email.
status: done 2026-10-28
resolution: won't fix -- accepted 2026-10-28 by the owner: the owner and their partner are the app's only users and are already linked to each other, and a received request is shown and accepted only while the recipient has no partner (accept_partner_request refuses a link to anyone who already has one), so no stranger can reach either account. Reopen if other couples are ever invited to use the app.

### DW-297: Partner search matches an email address nobody proved they own, so an account registered with the partner's address before they sign up is offered as the partner.
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
location: supabase/migrations/20260926000000_find_partner_by_email.sql (the users.email match); hosted Auth email-confirmation setting
source_spec: n/a
severity: medium
reason: find_partner_by_email matches public.users.email with no check of auth.users.email_confirmed_at. Local supabase/config.toml has enable_confirmations = false; the hosted setting is UNVERIFIED, though the hosted auth users' aggregate fits auto-confirm. The fix has two parts in order: the owner turns on email confirmations for the hosted project in the Supabase dashboard, then a migration filters on email_confirmed_at IS NOT NULL (under auto-confirm the filter alone changes nothing).
status: done 2026-10-28
resolution: won't fix -- accepted 2026-10-28 by the owner: the owner and their partner are the app's only users and are already linked to each other, and the partner already has an account under their own address, so it can no longer be claimed first; the hosted email-confirmation setting stays as it is. Reopen if other couples are ever invited to use the app.

### DW-298: The "request accepted" broadcast can be missed, and the sender then sees the link only after a reload.
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
location: src/hooks/usePartnerLinkListener.ts:30-37 (gate) and :49-58 (subscribe); src/api/moodSyncService.ts subscribeMoodUpdates
source_spec: n/a
severity: medium
reason: The partner_linked broadcast is ephemeral and never replayed, and three paths leave the listener's channel unjoined when it arrives. (1) It joins only after loadPartner answers unlinked, and subscribeMoodUpdates awaits the session, the partner lookup, setAuth and the socket first. (2) Every loadPartner sets isLoadingPartner, which turns settledUnlinked false and releases the subscriber, so on Home and Love Notes the channel is torn down and re-joined on every start, reconnect and Partner-tab mount, while the Partner tab's own subscriber passes no onPartnerLinked. (3) It passes no onStatusChange, so a Realtime reconnect never re-reads the partner. Fix: on each SUBSCRIBED call lookupPartnerId() and loadPartner() only when it answers linked (calling loadPartner directly loops through the gate), and gate on partner === null && !partnerLoadError once the first load has settled.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-partner-link-listener-rearm
resolution-undo: 557e899a12936f0cb7f42633f9a2e20bad2908fd238445bf694e1a34e5e9c84b 2026-10-29 7374617475733a206f70656e

### DW-299: get_my_pending_partner_requests returns the name and email of the other side even when that account already has a partner.
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
location: supabase/migrations/20260926010000_my_pending_partner_requests.sql (the select); partner_requests INSERT policy
source_spec: n/a
severity: low
reason: The reviewer's rolled-back probe inserted a pending request to a linked user's id (the INSERT policy checks only auth.uid() = from_user_id, the gap DW-295 leaves at the database), and the RPC then returned that user's name and email, undoing the is_taken redaction in find_partner_by_email. The linked target never sees the request, so the sender can keep it pending and keep reading the target's current name. Fix: null both columns when the other side has partner_id IS NOT NULL, or refuse at insert a request to a partnered account or from a partnered caller, through a SECURITY DEFINER helper.
status: done 2026-10-28
resolution: won't fix -- accepted 2026-10-28 by the owner: the owner and their partner are the app's only users and are already linked to each other, and find_partner_by_email never returns the id of an account that already has a partner, so reading either one's name and email this way needs their internal id from elsewhere. Reopen if other couples are ever invited to use the app.

### DW-300: Partner search tells any signed-in caller whether an email has an account and whether its owner has a partner, with no rate limit.
origin: security review of PR #379 2026-09-26, recorded 2026-10-28
location: supabase/migrations/20260926000000_find_partner_by_email.sql (is_taken)
source_spec: n/a
severity: low
reason: A documented design choice in #379, not a defect: find_partner_by_email answers is_taken to any authenticated caller, and PostgREST does not rate-limit the call, so with open signup anyone can bulk-check addresses for an account and a relationship. Needs an owner decision: rate-limit the call, or report a taken account the same way as a missing one.
status: done 2026-10-28
resolution: won't fix -- accepted 2026-10-28 by the owner: the owner and their partner are the app's only users and are already linked to each other, and the search is kept as #379 designed it, because its "already connected with a partner" answer is the one that would reveal an unexpected link. Reopen if other couples are ever invited to use the app.

### DW-301: Two OfflineError tests in offlineErrorHandler.test.ts assert the same default fields, so "creates an error with default message" proves nothing that "is an instance of Error" does not.
origin: spec-deferred b4fe790b514f
location: tests/unit/utils/offlineErrorHandler.test.ts:15
source_spec: `tickets/epic-test-review-remediation/tickets/story-fix-the-2026-10-03-tests-unit-findings-plan.md`
severity: low
reason: At the baseline both tests already asserted name, isRetryable and the default message (per-field toBe at :17-20, toMatchObject at :32-37); only the operation string differs, and only the second adds toBeInstanceOf(Error). The L7 conversion made the overlap visible but did not create it.
status: done 2026-10-28
resolution: fixed 2026-10-28: "is an instance of Error" now asserts only toBeInstanceOf(Error), and "creates an error with default message" keeps the name, operation, isRetryable and default-message checks; removing `extends Error` from OfflineError fails only the instanceof test. 2026-10-29: the epic retrospective (R1, A2) found the same overlap in the withOfflineCheck describe, where 'includes operation name in thrown error' was a subset of 'throws OfflineError when offline'; it is now a second operation inside that test, and the file's two hand-typed offline messages use OFFLINE_RETRY_MESSAGE.

### DW-302: AdminPanel's failed-delete test checks that an alert appears, not what it says.
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
location: tests/unit/components/AdminPanel.accountData.test.tsx:264
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: 'reports a failed delete accessibly and leaves cancel enabled' asserts only getByRole('alert') toBeInTheDocument, so an empty alert or one with the wrong message passes. Fix: assert the alert's text.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e

### DW-303: upload-love-note-image-limits checks x-ratelimit-remaining only against the limit, which holds by construction.
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
location: tests/api/upload-love-note-image-limits.spec.ts:134
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: medium
reason: After one accepted upload the case asserts Number(remaining) < RATE_LIMIT_MAX_UPLOADS and that the header equals the body's count, because other cases in the worker share the minute window. A counter that never decrements still passes. Fix: read the count before and after a second upload in the same case and assert it fell by exactly one.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e

### DW-304: LoveNoteMessage's retry test cannot see the forceRefresh argument.
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4); plan 1.13 Residual risks (A6)
location: src/components/love-notes/__tests__/LoveNoteMessage.test.tsx (the image-service mock); src/services/loveNoteImageService.ts:235
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: The file's mock of the image service forwards only the path, so a retry that reused the cached signed URL instead of passing forceRefresh = true would pass. Fix: let the mock record its second argument and assert true on the retry.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e

### DW-305: PokeKissInterface's useState setter spy has no positive control while the component is mounted.
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
location: src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx:7-25
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: stateSetterCalls observes every useState setter so the unmount cases can assert no late update. No case shows the spy records a set while mounted, so a spy that recorded nothing would pass the same negative checks. Fix: assert at least one recorded set before unmount.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e

### DW-306: The loaderIdentityGuards.events leak checks use JSON.stringify(state), which cannot see inside an Error, Map or Set.
origin: epic-test-review-remediation retrospective 2026-10-29 (R3, A4)
location: tests/unit/stores/loaderIdentityGuards.events.test.ts:414,476,495,513,529
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: JSON.stringify writes an Error, a Map and a Set as {}, so the previous account's label or failure text held in one of those shapes would not be found. Fix: serialize with a replacer that expands them, or assert the specific fields.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e

### DW-307: events.spec.ts hard-codes the plural "days" in the expected countdown.
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
location: tests/e2e/home/events.spec.ts:142-144
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: The expected text is `${FUTURE_MEETUP.daysFromNow - 1} days`, while eventCountdownHelpers.ts:60 writes "1 day" for one, so setting daysFromNow to 2 fails against correct output. Fix: build the expected text with the same singular rule.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e

### DW-308: notesSlice.idempotency takes a note's tempId before the queue drain settles.
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
location: tests/unit/stores/notesSlice.idempotency.test.ts:287,308,339,360
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: The retries read store.getState().notes[0].tempId without first waiting for the drain, so the cases depend on that row not having been replaced yet. Fix: wait for the drain to settle, then read the key.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e

### DW-309: usePhotoImage.test.ts shares one hoisted PHOTO object across tests.
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
location: tests/unit/hooks/usePhotoImage.test.ts:20-22
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: The store mock and every beforeEach put the same object in photos, so a test or hook that mutated it would leak into the tests after it in shuffled order. Fix: put a fresh copy in the store in beforeEach.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e

### DW-310: photoImageCache.test.ts settles a fill by joining a second run, which relies on the module's private coalescing.
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4); plan 1.13 Residual risks (A4)
location: tests/unit/services/photoImageCache.test.ts:598,649
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: "Joining the run settles any fill a wrong resume started" holds only while requestPhotoImageFill coalesces overlapping calls into one run, an internal detail; and plan 1.13 notes that a resume deferred by two or more microtasks starts after the join and goes uncaught. Fix: settle on an observable signal, such as the cached notice or the download mock's settled calls.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-store-service-test-determinism
resolution-undo: 586fbb89547b50ef9f599adfac8aedcbd188d1801c992d99e3d69d0854f5440b 2026-10-29 7374617475733a206f70656e

### DW-311: settleNameLookups never settles when the own-name lookup rejects.
origin: epic-test-review-remediation retrospective 2026-10-29 (R4, A4)
location: src/components/love-notes/__tests__/OwnDisplayName.test.tsx:87; src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx:94
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: The helper waits for getPartnerDisplayName, which LoveNotes asks only after the own-name branch, so a case whose own-name lookup rejects fails on a waitFor timeout that names the wrong lookup. The helper is also pasted into both files (DW-313). Fix: wait on both lookups' settled results.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-component-test-assertion-hardening
resolution-undo: 3da91037a69193af16a9360685d3c0a3dde510dd5ca9044c03deebc356ece734 2026-10-29 7374617475733a206f70656e

### DW-312: Two auth specs pin "the login screen is gone" in two different ways.
origin: epic-test-review-remediation retrospective 2026-10-29 (R5, A4)
location: tests/e2e/auth/login.spec.ts:135; tests/e2e/auth/bootstrap-notification-order.spec.ts:188,218
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: login.spec asserts toHaveCount(0) on the login-screen test id, while bootstrap-notification-order asserts not.toBeVisible(), which also passes when the screen is still mounted but hidden. Fix: use one form for the one contract in both specs.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e

### DW-313: Shared test fixtures and constants were invented file by file during the epic; one refactor story should consolidate them.
origin: epic-test-review-remediation retrospective 2026-10-29 (D-dup1 to D-dup7, P-div1, A5)
location: see reason
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: (1) Three photo-row builder patterns: six src files spread createPhotoInsert with an unexplained file_size: 68, photosSlice.localCopy.test.ts casts as SupabasePhoto, loaderIdentityGuards.photos uses a third. (2) Four copies of the hoisted vi.mock('react') useState observer (EventsSettings.pagination, EventsSettings.lifetime, PokeKissInterface, LoveNoteMessage). (3) SQLSTATE constants declared per file (CHECK_VIOLATION_CODE, NOT_NULL_VIOLATION, INSUFFICIENT_PRIVILEGE, CONNECTION_FAILURE), with '23514' and '08006' still literal in places. (4) loadFailure() adopted in three EventsSettings files; five siblings build { status: 'failure', error } by hand. (5) settleNameLookups pasted into OwnDisplayName.test.tsx and LoveNotes.realtimeStatus.test.tsx. (6) dbSchema.v15MessageData.test.ts hard-codes the store list storageSchema.test.ts holds as ALL_STORES. (7) Ten hand-rolled IndexedDB opens across nine e2e specs read stores savedLocalCopy cannot; logout.spec.ts:28, love-notes-offline-send.spec.ts:52 and photos-offline.spec.ts:61 skip the indexedDB.databases() guard. (8) stalePersistedMood() still defaults anchor to new Date() (tests/support/helpers/persisted-blob.ts:180), relied on by persisted-events-strip.spec.ts:214. Fix as one story: shared photo-row factories, a react-state-spy module, a SQLSTATE constants module, loadFailure everywhere, a love-notes test kit, one ALL_STORES, a guarded generic IndexedDB store reader, and a required anchor.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-shared-test-fixture-consolidation
resolution-undo: 22822117b68bd746577b22173040aca409577ba4671f1daaa8fc98c208919c3b 2026-10-29 7374617475733a206f70656e

### DW-314: No audit checks that a full e2e run leaves behind no rows it created.
origin: epic-test-review-remediation retrospective 2026-10-29 (S4, A8)
location: tests/support/auth/worker-pool.ts; tests/e2e/
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: medium
reason: R3's success clause "a full e2e run leaves behind no rows it created" was verified only for three love_notes content prefixes across the specs story 1.4 changed (plan 1.4 Verification). PR #377 moved cleanup into fixture teardown, but no full run has been audited across tables. Fix: a post-run check that counts the rows the worker-pool accounts own in each seeded table before and after a full run.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-leftover-row-audit
resolution-undo: e8079d4aacc37483c3f121fc445fe62d877dd171df3ac0b5b397ab71b1b36ac0 2026-10-29 7374617475733a206f70656e

### DW-315: A history read that started before a poke was marked as seen can undo the mark when it answers, so the badge comes back.
origin: investigation of the partner-connect poke flake 2026-10-29
location: src/stores/slices/interactionsSlice.ts (markInteractionViewed; loadInteractionHistory)
source_spec: n/a
severity: low
reason: markInteractionViewed sets viewed: true only after the server confirms, but loadInteractionHistory replaces the whole list with its answer, so an answer read before the mark carries viewed: false and puts the poke back in the unviewed count until the next read. Reads run on signed-in start, on reconnect, when History opens and, since the poke catch-up fix, each time the Partner tab's subscription is confirmed; the mark is written when the poke animation completes (PokeKissInterface.tsx:289). Read from the code, not reproduced. Fix: note the ids marked viewed while a read is in flight, as readsInFlight does for accepted rows, and keep viewed: true for them when the answer lands.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-interaction-viewed-read-race
resolution-undo: 72a6b01666ede192297badccb8fbc90e19ec25f8443762e8246c2745fddcfa79 2026-10-29 7374617475733a206f70656e

### DW-316: About ten corrections.md items were never re-checked against the code, so Done when 2 is unproven for them.
origin: epic-test-review-remediation retrospective 2026-10-29 (S2)
location: _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/corrections.md
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: The retrospective checked about 30 of the file's roughly 40 items against HEAD and found every one resolved, but it does not list which ones it checked. It names the items it did not re-check one by one: the four false positives (notesSlice.offlineQueue.test.ts:312 M3, coupleSettingsService.test.ts:157 L7, DisplayNameSetup.test.tsx:183 L5, MoodHistoryTimeline.test.tsx:68 L3), EventsSettings.test.tsx:1493, EventsSettings.focus.test.tsx:363 and useNetworkStatus.test.ts:321-341. Settle by checking every item in corrections.md against HEAD, locating each by content because its line numbers predate the epic, and recording each as resolved or still open with its location. Fix what is still open under the epic's Constraints: a fix keeps or strengthens what the test proves, and a verified false positive gets a harmless change so the rule stops firing.
status: done 2026-10-29
resolution: already resolved: All seven items the retrospective left unchecked are resolved at HEAD, located by content: notesSlice.offlineQueue.test.ts:147-189 split the M3 reconnect test into five single-subject tests (254dbd93); coupleSettingsService.test.ts:155-162 uses one rejects style and keeps toBeInstanceOf(AccountDataError); DisplayNameSetup.test.tsx:187 is named for behaviour ('offline: refuses before reading the session or writing...'); MoodHistoryTimeline.test.tsx:76 reads notes via the mood-note test id; EventsSettings :1493 moved to EventsSettings.reconciliation.test.tsx:346 asserting the loadingDuringRetry column; EventsSettings.focus.test.tsx:412-418 asserts openerSurvives and loadingAfterRefresh unconditionally; useNetworkStatus.test.ts:332,338 asserts vi.getTimerCount() 1 then 0. Spot re-checks of the rest also hold (login.spec.ts:138-163 signs in and checks the stored session across reload; token-persistence-overlap.spec.ts:238-239 pins the action-started list; love-notes.spec.ts:27 deletes sent notes; moodGrouping.test.ts has no 86400000; updateCurrentMessageStaleCache.test.ts pins NOW).

### DW-317: Decision record D1 (e2e page clocks anchor at the live day, never a fixed date) is only half written down where agents read it.
origin: epic-test-review-remediation retrospective 2026-10-29 (S6, D1)
location: tests/support/helpers/events.ts:190-205 (clockAnchor)
source_spec: `tickets/epic-test-review-remediation/epic-test-review-remediation-retrospective.md`
severity: low
reason: clockAnchor's JSDoc already records that the anchor is the latest local noon at or before now, so it sits behind real time and never ahead, because a page clock ahead of the session's mint time makes supabase-js refresh the token. It does not record why a fixed calendar date was rejected: plan 1.2's Review Triage Log (story-remove-clock-timing-and-async-nondeterminism-plan.md:235) says a fixed date "would put the page clock arbitrarily far behind server timestamps" and collide unique created_at rows across reruns. The retrospective proposed a separate adr-e2e-page-clock-anchors-at-the-live-day.md beside the helper, but AGENTS.md keeps durable agent-facing prose in AGENTS.md and forbids generated documentation files. So add the missing reason to clockAnchor's JSDoc, and, if every e2e spec that seeds calendar-day rows must use clockAnchor, say so in one AGENTS.md line, rather than adding a new file.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-e2e-assertion-precision
resolution-undo: bae70ce172193d022d55f6da23bc5231d7981439422286568aefcb7168984175 2026-10-29 7374617475733a206f70656e

### DW-318: Sign-out leaves the outgoing account's synced mood rows on the device.
origin: AGENTS.md context refresh 2026-10-29
location: src/stores/slices/authSlice.ts:47-67 (deleteAccountData); src/services/moodService.ts
source_spec: n/a
severity: low
reason: deleteAccountData() deletes the outgoing account's local copies and cached images and nothing else. Its JSDoc keeps "unsynced `moods` rows" for their owner to send on the next sign-in, and AGENTS.md ("Maintained by hand", sign-out rule) allows only a queue of unsent writes to stay. But the `moods` store holds synced rows (`synced: true`) beside the queue, and those stay too. The app never shows them to the next account, because every read is scoped by userId (moodService.getAllForUser), but they remain in the device's IndexedDB, unlike every other per-account copy. Nothing records keeping them on purpose: 771a93b7 says sign-out "keeps queued moods", and DW-5 (archived) proposed clearing the store before its fix scoped the reads instead. Fix: in deleteAccountData, also delete the outgoing user's `moods` rows whose `synced` is true, and keep every `synced: false` row. Nothing is lost, because the signed-in backfill (moodSlice.ts:575-590) pages through the whole server history and refills the store. Cover the boot with no session that the `my-love-account-owner` marker drives, and decide what to do with a row whose sync finishes after sign-out and marks it synced.
status: done 2026-10-29
resolution: resolved by sweep bundle dw-synced-moods-signout-delete
resolution-undo: bec72ab16700c1eded375e3e02307c506b8c273be1c6fcc7faa6ebc0a5a14733 2026-10-29 7374617475733a206f70656e

### DW-319: A mood row the service worker's background sync marks synced after sign-out stays on the device until that account's next sign-out there.
origin: spec-deferred 77375ef75a5a
location: src/sw-db.ts:97 (markMoodSynced); src/stores/slices/authSlice.ts (deleteAccountData)
source_spec: `plan-dw-synced-moods-signout-delete.md`
severity: low
reason: sw-db.ts markMoodSynced has no session check, and discardAccountState clears the my-love-account-owner marker on sign-out, so when another account signs in next, nothing deletes the row. Reads stay scoped by userId, so the row is never shown to that account. The intent accepted "the row is left for the next deletion"; recording it so a sweep sees it.
status: done 2026-10-29
resolution: closed by human decision: Accepted residual: the row is never read by another account and is deleted at its owner's next sign-out on the device.
decision: 2026-10-29 Close: accept the residual row as the approved intent did — Accepted residual: the row is never read by another account and is deleted at its owner's next sign-out on the device.

### DW-320: The same JSON.stringify(state) leak check, blind to Error/Map/Set, is used outside the events file.
origin: spec-deferred b8c7828c1182
location: tests/unit/stores/loaderIdentityGuards.moods.test.ts:214
source_spec: `plan-dw-store-service-test-determinism.md`
severity: low
reason: grep finds it at tests/unit/stores/loaderIdentityGuards.moods.test.ts:214,242, loaderIdentityGuards.partner.test.ts:225,251,322,395 and signOutClearsAccountState.test.ts:340,479,555,563; DW-306 names only the events file. They can adopt serializedStore() from loaderIdentityGuardsFixture.ts.
status: done 2026-10-29
resolution: duplicate of DW-321, which lists every location here and more; tracked there.

### DW-321: Complete list of the leak checks outside the events file that still use plain JSON.stringify on store state (it supersedes the incomplete item above).
origin: spec-deferred a4946ac45884
location: tests/unit/stores/loaderIdentityGuards.customMessages.test.ts:284
source_spec: `plan-dw-store-service-test-determinism.md`
severity: low
reason: These are blind to an Error, Map or Set, as DW-306 was. Found with `grep -rn "JSON.stringify(" tests/unit` on 2026-10-29. On useAppStore, so they can adopt serializedStore() from loaderIdentityGuardsFixture.ts: - loaderIdentityGuards.moods.test.ts:214,242 - loaderIdentityGuards.partner.test.ts:225,251,322,395 - loaderIdentityGuards.customMessages.test.ts:284,326,395 - loaderIdentityGuards.notes.test.ts:232,271 - loaderIdentityGuards.photos.test.ts:277,341,472 - loaderIdentityGuards.messages.test.ts:251,559 - signOutClearsAccountState.test.ts:340,479,555,563,646 On a local store or a slice of state, so they need the replacer to take a value: - interactionsSubscription.test.ts:634,656 - notesSlice.localCopy.test.ts:517 - partnerSlice.localCopy.test.ts:213 - notesSlice.sessionGuard.test.ts:216 - settingsSlice.initializeApp.test.ts:307,392,447,470 - notesSlice.localCopyWrites.test.ts:174
status: done 2026-10-29
resolution: resolved by sweep bundle dw-leak-check-serialized-store
resolution-undo: 80c135a45c09b0270df5e1f44af4223ebd5ce9cde626d4c69b7c9b5915e434ba 2026-10-29 7374617475733a206f70656e

### DW-322: upload-love-note-image's 10-per-minute-per-user rate limit is kept in isolate memory, so it is not enforced once one user's requests spread across isolates.
origin: spec-deferred cdcdf5b24fcb
location: supabase/functions/upload-love-note-image/handler.ts:113-115
source_spec: `plan-dw-e2e-assertion-precision.md`
severity: medium
reason: rateLimitStore is a module-level Map; two consecutive uploads over the wire failed a decrement assertion 9 of 9 serial runs locally (edge-runtime 1.77.8, policy = "per_worker"). Whether hosted functions spread one user's requests the same way is UNVERIFIED. Fix needs an owner decision on a shared store (DB table or RPC).
status: done 2026-10-29
resolution: resolved by sweep bundle dw-love-note-upload-shared-rate-limit
resolution-undo: 45d6f6c51380300a04d0a207ec090ed080e768bd967ac55b5520acba78842457 2026-10-29 7374617475733a206f70656e
decision: 2026-10-29 build: shared database counter — keep each user's upload count in a database table, checked and incremented atomically by one RPC the function calls, so every isolate enforces the same 10-per-minute limit.

### DW-323: Google sign-in cannot work inside the native iOS shell.
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
location: src/api/auth/actionService.ts:116-125
severity: medium
reason: signInWithGoogle runs Supabase's OAuth redirect inside the page, and in the shell the page is a WKWebView on capacitor://localhost. Google refuses sign-in from embedded web views (from memory, UNVERIFIED on iOS 27), and redirectTo is built from window.location.origin, which is capacitor://localhost there, so the callback could not return to the app either. Fix: in the shell, open the provider in the system browser (ASWebAuthenticationSession, e.g. via @capacitor/browser) and return through a custom URL scheme or Universal Link that hands the session to supabase-js. Email and password sign-in is unaffected.
status: done
resolution: fixed on fix/native-google-sign-in: in the shell, signInWithGoogle (src/api/auth/nativeGoogleSignIn.ts) opens the provider in ASWebAuthenticationSession through the app-local NativeAuth plugin (ios/App/App/NativeAuth.swift) and exchanges the returned code in the web view; dev.sallvain.mylove://auth-callback was added to the hosted redirect allow list on 2026-10-29.

### DW-324: Password-reset emails sent from the native shell link to capacitor://localhost.
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
location: src/api/auth/actionService.ts:96-98
severity: medium
reason: resetPasswordForEmail builds redirectTo from window.location.origin, which is capacitor://localhost in the shell, so the emailed link points nowhere a mail app can open. Fix: in the shell, use the site's https origin (the reset then completes on the website), or add a Universal Link that opens the app's reset-password view.
status: done
resolution: unreachable: resetPassword has no caller in the UI (only actionService.ts and the re-export in authService.ts), and the app has no reset-password view, so the shell never sends a reset email. Revisit when a reset UI is added: the redirect must then return to the app, like Google sign-in's dev.sallvain.mylove://auth-callback.

### DW-325: Haptics do nothing on iPhone, in the PWA and in the native shell alike.
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
location: src/utils/haptics.ts; src/hooks/useVibration.ts
severity: low
reason: Both call navigator.vibrate, which Safari on iOS does not implement (from memory, UNVERIFIED on iOS 27), so the mood-save and love-note vibrations never fire on iPhone. The shell can fix it with @capacitor/haptics behind a check that the installed shell has the plugin (an older shell installed before the plugin was added will not).
status: open

### DW-326: The native shell still uses the HTML dock; the iPhone Duo layout needs Apple's own tab bar.
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
location: src/components/Navigation/AppNavigation.tsx; ios/App/App
severity: low
reason: The shell exists so the five DESTINATIONS can move into iOS's right-hand system column on iPhone Duo (folded and inner landscape), as Instagram, Netflix and others do; iOS keeps web content out of that column, so only a native UITabBar/TabView gets there. Research: _bmad-output/initiative-my-love/research-iphone-duo-pwa-support/. Not yet proven that a native tab bar around one shared WKWebView lands in the column; prove that first. The shell also still has Capacitor's default app icon and splash.
status: open
