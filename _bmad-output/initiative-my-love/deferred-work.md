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
status: done 2026-10-29
resolution: fixed on fix/native-google-sign-in: in the shell, signInWithGoogle (src/api/auth/nativeGoogleSignIn.ts) opens the provider in ASWebAuthenticationSession through the app-local NativeAuth plugin (ios/App/App/NativeAuth.swift) and exchanges the returned code in the web view; dev.sallvain.mylove://auth-callback was added to the hosted redirect allow list on 2026-10-29.

### DW-324: Password-reset emails sent from the native shell link to capacitor://localhost.
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
location: src/api/auth/actionService.ts:96-98
severity: medium
reason: resetPasswordForEmail builds redirectTo from window.location.origin, which is capacitor://localhost in the shell, so the emailed link points nowhere a mail app can open. Fix: in the shell, use the site's https origin (the reset then completes on the website), or add a Universal Link that opens the app's reset-password view.
status: done 2026-10-29
resolution: unreachable: resetPassword has no caller in the UI (only actionService.ts and the re-export in authService.ts), and the app has no reset-password view, so the shell never sends a reset email. Revisit when a reset UI is added: the redirect must then return to the app, like Google sign-in's dev.sallvain.mylove://auth-callback.

### DW-325: Haptics do nothing on iPhone, in the PWA and in the native shell alike.
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
location: src/utils/haptics.ts; src/hooks/useVibration.ts
severity: low
reason: Both call navigator.vibrate, which Safari on iOS does not implement (from memory, UNVERIFIED on iOS 27), so the mood-save and love-note vibrations never fire on iPhone. The shell can fix it with @capacitor/haptics behind a check that the installed shell has the plugin (an older shell installed before the plugin was added will not).
status: done 2026-10-29
resolution: fixed 2026-10-29 on fix/native-haptics. Every buzz now goes through playHaptic in src/utils/haptics.ts, which in the native shell plays Apple's haptics through @capacitor/haptics (success and error as notification haptics, a selection as a light impact, an arriving love note as a medium one) and elsewhere keeps navigator.vibrate. useVibration and the incoming-note buzz in useRealtimeMessages route through it. The home-screen PWA on iPhone is unchanged (still no navigator.vibrate).

### DW-326: The native shell still shows Capacitor's default splash screen.
origin: raised 2026-10-29 while adding the Capacitor shell (feature/capacitor-shell)
location: src/components/Navigation/AppNavigation.tsx; ios/App/App
severity: low
reason: The shell exists so the five DESTINATIONS can move into iOS's right-hand system column on iPhone Duo (folded and inner landscape), as Instagram, Netflix and others do; iOS keeps web content out of that column, so only a native UITabBar/TabView gets there. Research: _bmad-output/initiative-my-love/research-iphone-duo-pwa-support/. Not yet proven that a native tab bar around one shared WKWebView lands in the column; prove that first. The shell also still has Capacitor's default app icon and splash. 2026-10-30: the owner's Duo shows the current shell drawing web content into the column (index.html has set viewport-fit=cover since 2026-08-18), so the premise that only a native tab bar reaches it no longer holds; the dock half is now epic-iphone-duo-native-tab-bar (retitled iPhone Duo Side-Column Dock), which moves the app's own HTML dock into the column. Open here: the default app icon and splash. 2026-10-31: the app icon is now the Two Hearts mark (public/icons/icon.svg rendered at 1024, fix/ios-app-icon); only Capacitor's default splash remains open. 2026-11-02: fix/ios-splash replaces the splash with the mark centred on the SplashBackground colour set (the --kit-page light and dark values). It is unseen: on the iPhone Duo simulator iOS draws no launch screen for this app at all, before or after the change (splashboardd: "Estimated size (29900800) is over limit (25000000)", the same figure for both images, so it does not depend on the image), and the launch shows black. Close this once the owner has seen the mark on their phone after the next reinstall; if the phone shows black too, the cause is that limit, not the image.
status: done 2026-11-02
resolution: fix/ios-splash (#445) put the Two Hearts mark on the launch screen, centred on the SplashBackground colour set. Owner, 2026-11-02, after a reinstall from main: the phone shows the hearts. The simulator's black launch is the simulator's own limit, not seen on the phone. The app loads fast enough that the hearts show for under a second; the owner is fine with that.
decision: 2026-11-02 build-outside-loop — the splash becomes the Two Hearts mark (public/icons/icon.svg, as fix/ios-app-icon made the icon) on the app's light and dark background colours; done interactively, because the launch screen shows only after a reinstall and a person has to look at it.

### DW-327: The dock's unseen-count badges are never fed, so the dock never shows one.
origin: raised 2026-10-29 while slicing epic-iphone-duo-native-tab-bar
location: src/App.tsx (`<AppNavigation>`); src/components/Navigation/AppNavigation.tsx (`badgeCounts`)
severity: low
reason: AppNavigation renders a badge per destination from its `badgeCounts` prop, but its only caller in App.tsx passes none, so no badge has ever shown. The owner parked badges until a feature supplies real counts; when it does, the column dock from epic-iphone-duo-native-tab-bar shows them too.
status: done 2026-11-02
resolution: moved to the backlog story `_bmad-output/backlog/story-dock-shows-unread-counts.md`: the owner wants unread counts on the dock buttons, which is a feature, not a defect.
decision: 2026-11-02 move-to-backlog — owner, 2026-11-02.

### DW-328: The column rule's "both side insets non-zero means no column" case is unmeasured on a non-Duo iPhone.
origin: raised 2026-10-30 by the quick review of epic-iphone-duo-native-tab-bar story 7 (the side-column detection spike)
location: _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-find-how-the-web-code-learns-the-side-column-s-position-and-plan.md (Findings, detection method)
severity: medium (unverified)
reason: Story 7's rule gives the page a column only when exactly one of env(safe-area-inset-left/right) is non-zero, because a notched or Dynamic Island iPhone in landscape is expected to inset both sides; the shell allows landscape on iPhone (Info.plist) and index.html sets viewport-fit=cover. The iPhone 18 Pro simulator rendered the readout build blank on iOS 27.0 and 27.2, so no non-Duo iPhone was measured. If such an iPhone inset only one side, story 2 would draw a column dock there. Proven by reading both side insets in the shell on a non-Duo iPhone simulator in each landscape direction; story 2's verify names a non-Duo iPhone simulator but not landscape.
status: done 2026-10-30
resolution: measured 2026-10-30 by epic-iphone-duo-native-tab-bar story 9 through scripts/sim-driver/sim with story 7's readout, in the shell on the iPhone 17 simulator (iOS 27.2), which renders it: portrait 62/0/34/0 (T/R/B/L, page 402x874), landscape-primary (device landscapeLeft) 0/62/20/62 and landscape-secondary (device landscapeRight) 0/62/20/62 (page 874x402). Both side insets are non-zero in each landscape, so the exactly-one-side rule gives this iPhone no column and story 2 keeps its bottom dock there.

### DW-329: The sim driver's work dir is shared, so two runs on simulator clones would clobber each other.
origin: raised 2026-10-30 by the quick review of epic-iphone-duo-native-tab-bar story 9 (the simulator driver)
location: scripts/sim-driver/sim (WORK, sync_stage, ensure_runner, drive, SERVE_PID); AGENTS.md, Maintained by hand (the sim driver line)
severity: medium
reason: AGENTS.md says to run one Duo story at a time "or each on its own xcrun simctl clone", but every sim invocation defaults to the one $SIM_DRIVER_WORK: sync_stage empties $WORK/stage/tree, ensure_runner removes $WORK/runner/src, the app's derived data is always $WORK/derived/app, every drive step writes and then parses $WORK/logs/drive.log, and serve.pid is a single file. Two stories driving two clones at once would wipe each other's stage and runner and read each other's drive output. Fix by keying the work dir's per-run parts on the device UDID, or by having the AGENTS.md line and the sim header require a separate SIM_DRIVER_WORK per clone; deferred because the review workflow routes agent-context edits to the ledger.
status: done 2026-10-31
resolution: fixed 2026-10-31 by epic-iphone-duo-native-tab-bar story 4 (the refactor sweep): scripts/sim-driver/sim's default work dir is now ~/Library/Caches/my-love-sim-driver/<checkout name>-<8 hex of the checkout's path hash>, so two stories in two worktrees, each on its own simulator clone, never share a stage, runner, derived data, log or serve.pid, and a worktree no longer runs a runner another worktree built; SIM_DRIVER_WORK still overrides it. AGENTS.md's sim-driver line says so, and that each concurrent story needs its own clone and serve-update port. Checked on the iPhone Duo simulator: build, the runner build and every drive step ran in the worktree's own folder.

### DW-330: The sim driver's default work dir is shared by every run, so two stories driving two simulator clones at once (which AGENTS.md now allows) would clobber each other's stage, runner, drive log and
origin: spec-deferred 9ebb86d180dd
location: scripts/sim-driver/sim (WORK, sync_stage, ensure_runner, drive, SERVE_PID); AGENTS.md Maintained by hand
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-simulator-driver-is-a-repo-tool-plan.md`
severity: medium
reason: sync_stage empties $WORK/stage/tree, ensure_runner removes $WORK/runner/src, the app's derived data is always $WORK/derived/app, drive writes and parses $WORK/logs/drive.log, and serve.pid is one file; none is keyed on the device. The fix edits AGENTS.md (or keys the work dir on the UDID), so it is deferred; recorded as DW-329 in the deferred-work ledger.
status: done 2026-10-31
resolution: duplicate of DW-329 (the same review finding, carried in from story 9's plan frontmatter); fixed by the same change: fixed 2026-10-31 by epic-iphone-duo-native-tab-bar story 4 (the refactor sweep): scripts/sim-driver/sim's default work dir is now ~/Library/Caches/my-love-sim-driver/<checkout name>-<8 hex of the checkout's path hash>, so two stories in two worktrees, each on its own simulator clone, never share a stage, runner, derived data, log or serve.pid, and a worktree no longer runs a runner another worktree built; SIM_DRIVER_WORK still overrides it. AGENTS.md's sim-driver line says so, and that each concurrent story needs its own clone and serve-update port. Checked on the iPhone Duo simulator: build, the runner build and every drive step ran in the worktree's own folder.

### DW-331: A browser that reports one small side inset (likely Android Chrome in landscape with a one-sided display cutout, under viewport-fit=cover) would get the column form, with 44 px buttons spilling out of
origin: spec-deferred a700fe97b803
location: src/hooks/useSideColumn.ts (sideColumnFromInsets); src/components/Navigation/AppNavigation.tsx (column capsule width)
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-dock-becomes-a-capsule-in-the-side-column-without-coveri-plan.md`
severity: medium
reason: sideColumnFromInsets switches to the column form for any single non-zero side inset, and the capsule is exactly w-[env(safe-area-inset-left|right)] while each button is w-11 (44 px); index.html sets viewport-fit=cover. Unverified: no Android device or emulator was measured. Settle it by reading env(safe-area-inset-left/right) in Android Chrome in landscape on a punch-hole phone; if one side is non-zero and small, add a minimum column width (for example a button's 44 px) to the rule, which the ticket's "exactly one non-zero" wording does not settle. (declared severity: medium (unverified))
status: done 2026-11-02
resolution: already resolved by ab3b0abb (2026-10-30): sideColumnFromInsets takes the column form only from a 44 px inset, and since ee0edd39 the capsule is 40 px, so a small one-sided Android cutout keeps the bottom dock; found by the 2026-11-02 ledger triage.

### DW-332: The sim driver's signin appends to whatever the login fields already hold, so a retry after a failed first attempt types onto the leftover email and is refused.
origin: spec-deferred 45d95a4edb9e
location: scripts/sim-driver/RunnerUITests/Drive.swift:59
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-settings-is-the-sixth-button-in-the-column-dock-plan.md`
severity: medium
reason: scripts/sim-driver/RunnerUITests/Drive.swift signIn taps the first web text field and calls typeText(email) with no clear first. In story 8's run `sim signin` exited 1 on its first try right after `sim build` on both the Duo and the iPhone 17 simulators (no assertion message in the drive log); on the iPhone 17 the retry produced `…comsest.example.com` and "Invalid email or password", and only `xcrun simctl terminate` plus `sim launch` recovered. The first-try failure itself is not yet explained.
status: done 2026-10-31
resolution: fixed 2026-10-31 by epic-iphone-duo-native-tab-bar story 4 (the refactor sweep): Drive.swift's signIn relaunches the shell (terminate, activate) when either login field holds text other than its placeholder, so a retry types into an empty form; clearing by keystrokes was tried and failed, because the leftover email overflows the field and no tap puts the cursor at its end. sim's drive prints the log's last 15 lines when a failed step has no error: or XCTAssert line, so a first-try failure like story 8's is no longer silent; it did not recur on the iPhone Duo simulator, where each of four sign-in attempts made straight after `sim build` reached and filled the form. Checked there: a wrong-password sign-in, then sim signin, exited 0 after relaunching, while the same sequence with the previous Drive.swift ended in "Invalid email or password".

### DW-333: Story 8's column-form clause on AGENTS.md's "A new view is registered in five hand-maintained places" line sits inside the bmad:context managed block, so a context refresh may drop it.
origin: spec-deferred 4aaacfef0310
location: AGENTS.md:27
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-settings-is-the-sixth-button-in-the-column-dock-plan.md`
severity: low
reason: AGENTS.md lines 1-2 open the managed block ("edits inside this block are replaced on refresh") and it closes at line 90; the edited bullet is line 27. The Maintained-by-hand dock paragraph carries the same fact outside the block, so the rule survives there, but a refresh that rewrites line 27 from older wording would again say Settings is never a dock item. Fix by having the next refresh keep the column-form exception, or by dropping the clause from line 27 and relying on the hand-maintained paragraph; deferred because the fix edits agent-context files.
status: done 2026-10-31
resolution: fixed 2026-10-31 by epic-iphone-duo-native-tab-bar story 4 (the refactor sweep): AGENTS.md's view-registration line no longer states where Settings sits; it points to the dock paragraph under Maintained by hand, outside the managed block, which carries both forms. A refresh that rewrites the line has no Settings fact to get wrong.

### DW-334: The sim driver cannot switch Device Hub's window, so `ax` reaches a non-Duo simulator only after someone selects it there.
origin: raised 2026-10-31 by epic-iphone-duo-native-tab-bar story 4 (the refactor sweep), from story 9's and story 2's residual risks
location: scripts/sim-driver/sim (cmd_rotate, the pose and state commands, every `ax` call)
severity: low
reason: `ax` drives the device whose window Device Hub shows, and sim takes --device but never selects that device in Device Hub, so on an iPhone 17 beside the Duo, `sim rotate` and `sim state` act on whichever phone the window shows. Story 2 switched the window with System Events selecting the sidebar row for its iPhone 17 rotations and switched it back to the Duo afterwards, by hand; story 8 used the iPhone 17 in portrait only and recorded no switch. Fix by having sim select --device's row in Device Hub before an `ax` call (and saying so in its help), or by refusing when `ax state`'s device is not --device. 2026-11-02 triage: `ax` 0.2.2's help and error strings suggest that with --device it looks up that device's window and exits 4 ("No Device Hub window shows X") rather than acting on another phone, and that Device Hub can hold several device windows; neither is checked on a simulator. Absorbs DW-337: settle both with one hand test (boot a clone beside the Duo, open both in Device Hub, run `sim --device <clone> rotate` with the Duo in front); if ax refuses or drives the right window, the fix is wording only (AGENTS.md's sim-driver line says each clone needs its own Device Hub window, plus a clearer sim error), else sim selects --device's row first. Outside the loop: needs a simulator and edits AGENTS.md.
status: done 2026-11-02
resolution: checked on the simulators 2026-11-02, no driver change needed. With the iPhone Duo and an iPhone 17 (iOS 27.2) booted and Device Hub showing one window per device (File > New Window, then the device selected in that window's sidebar), `sim --device <iPhone 17> rotate` with the Duo's window in front turned only the iPhone 17 (unknown to landscapeLeft) and left the Duo in portrait. With no window showing the iPhone 17, `ax` refused it ("No Device Hub window shows iPhone 17 …") instead of acting on the Duo. AGENTS.md's sim-driver line now says each concurrent device needs its own Device Hub window.

### DW-335: AGENTS.md's "never write an email address into `_bmad-output/`" rule cannot be followed as written: fictional fixture addresses and the required commit trailer already break it.
origin: raised 2026-10-30 by the quick review of epic-iphone-duo-native-tab-bar story 9 (rejected there, because the fix edits that build's own plan); recorded 2026-10-31 by story 4 (the refactor sweep)
location: AGENTS.md (Policy, the public-repo line; inside the generated block)
severity: low
reason: AGENTS.md Policy says never to write an email address into `_bmad-output/`. The two addresses are fictional (`test.example.com`, local stack only) and also appear in scripts/sim-driver/sim, provision.ts and AGENTS.md itself, and other epics' plans and findings files in `_bmad-output/` already hold fictional test addresses, so whether the rule covers fictional fixture addresses is the owner's call. The line sits inside the plan's `<intent-contract>`, which only a person may change; if the rule covers them, replace the addresses there with "the sim driver's two fixture accounts", or reword the Policy line to exempt fictional `test.example.com` fixtures. 2026-11-02 triage: the cited line in story 9's plan was already reworded by 31eafa9b; 19 addresses remain in 10 tracked _bmad-output files (7 at test.example.com, 8 at example.com, 4 noreply@anthropic.com), and every commit carries the required noreply@anthropic.com trailer.
status: done 2026-11-02
resolution: AGENTS.md's public-repo Policy line now forbids real addresses only: addresses at RFC 2606 reserved names (example.com, example.org, example.net and their subdomains, *.test, *.example, *.invalid) and the commit trailer's noreply@anthropic.com are allowed, any other address counts as real. Edited in place in the generated block, as the owner decided; the fixture addresses in _bmad-output need no change.
decision: 2026-11-02 reword-rule — owner, 2026-11-02: the Policy line forbids real addresses only; addresses at reserved domains (example.com, example.org, *.test, *.invalid, RFC 2606) and the commit trailer noreply@anthropic.com are allowed, any other address counts as real. The line sits in AGENTS.md's generated block, so the edit goes through bmad-project-context, outside the loop; with it, the fixture addresses in story-partner-requests-push-plan.md:49 and elsewhere need no change.

### DW-336: The sim driver's old shared folders at the cache root are orphaned since the work dir became per checkout.
origin: raised 2026-10-31 by the quick review of epic-iphone-duo-native-tab-bar story 4 (the refactor sweep), which moved the default work dir (DW-329)
location: ~/Library/Caches/my-love-sim-driver (stage/, runner/, derived/, logs/, serve/, serve.pid at its root)
severity: low
reason: Before story 4 every checkout used ~/Library/Caches/my-love-sim-driver itself; it now uses a <checkout>-<hash> folder inside it, so the root-level stage/, runner/, derived/, logs/ and serve/ (about 1.6 GB on 2026-10-31, mostly the stage's node_modules and derived data) are read by no code path. Story 4 ran unattended and left them, since deleting is the owner's call. Fix: once no update server started by the old driver runs (`pgrep -fl ThreadingHTTPServer` prints nothing), delete those five folders and serve.pid from the cache root, keeping every <checkout>-<hash> folder and any folder another session made there.
status: done 2026-11-02
resolution: already resolved: on 2026-11-02 the cache root holds only per-checkout folders (no stage/, runner/, derived/, logs/, serve/ or serve.pid) and `pgrep -fl ThreadingHTTPServer` prints nothing; found by the 2026-11-02 ledger triage.

### DW-337: AGENTS.md's sim-driver line says concurrent Duo stories may each run in their own worktree on their own simulator clone, but the driver's `ax` commands may reach only the device Device Hub's window
origin: spec-deferred f5609f6c2d08
location: AGENTS.md, Maintained by hand (the sim-driver line); scripts/sim-driver/sim (cmd_rotate and the ax calls)
source_spec: `tickets/epic-iphone-duo-native-tab-bar/tickets/story-refactor-sweep-plan.md`
severity: medium
reason: Story 9's residual risks say a non-Duo phone is reachable by ax only while Device Hub's window shows it, and sim never selects --device's window (DW-334); pose, rotate, state, background and screenshot all go through ax. The "each on its own xcrun simctl clone" wording predates this change (story 9); story 4 split the work dir per checkout, which removes the shared-files clash only. Unverified: whether Device Hub can show two device windows at once and ax then drives each by --device. Settle it by booting a clone beside the Duo, opening both in Device Hub, and running `sim --device <clone> rotate` while the Duo's window is in front; if the clone does not rotate, AGENTS.md's line must say one Duo story at a time until DW-334 is fixed. The fix edits AGENTS.md, so it is deferred. (declared severity: medium (unverified))
status: done 2026-11-02
resolution: duplicate of DW-334, which now carries both the driver fix and the AGENTS.md wording; one cause (sim never selects --device in Device Hub).

### DW-338: The sim driver's `center` reads Notification Center past one screen unreliably: its scroll-and-merge code is unproven and can merge, split or cut short groups
origin: spec-deferred story-3.12 review
location: scripts/sim-driver/RunnerUITests/Notify.swift (center, merge, screenGroups)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-and-taps-notifications-plan.md`
severity: medium
reason: Story 12's review found, by reading the code, that the multi-screen path has four faults. The read-and-scroll loop stops after 30 screens and still exits 0 with partial groups. Groups on different screens count as one when they share any notification text, so two threads with identical wording merge, and duplicates collapse. A stacked cell that is never reachable is reported as one notification. `merge`'s return value is unused, although the plan said to scroll "until none is new". center is unchanged since 4c089033 and story 3.14's 8-group runs used that code, but the multi-screen path has never run. The owner moved the multi-group case to story 3.14 on 2026-10-31; 3.14 reads up to 8 groups unfolded in portrait, on one screen, so these faults stay open past 8 groups. Settle it with a run of more groups than fit on the unfolded inner display, plus one thread whose expanded group is taller than a drag step.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-one-screen
resolution-undo: 2ecb451ec71336ba2dd3eb5040fb949b8b3ed6d86f65b7e6cff0c86cc597792d 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 one-screen-limit — owner, 2026-11-02: `center` reads one screen only and exits non-zero with a clear message when Notification Center holds more than fits (no ticket needs more than 8 groups); remove the multi-screen scroll-and-merge path, update `sim help` and test-center-exit.zsh, then close this and DW-345.

### DW-339: sim center's multi-screen read (scroll and merge) is unproven and can cut groups short, merge two threads with identical text, collapse duplicates, or count an unreachable stack as one notification.
origin: spec-deferred cbe0cc5a3421
location: scripts/sim-driver/RunnerUITests/Notify.swift (center, merge, screenGroups)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-and-taps-notifications-plan.md`
severity: medium
reason: By reading Notify.swift: the read-and-scroll loop stops at 30 screens and exits 0; cross-screen merge matches any shared text; an unreachable stacked cell is reported with count 1; merge's return value is unused. The scrolling code changed after its only 8-group run. The owner moved the multi-group case to story 3.14 (2026-10-31), which reads up to 8 groups on one unfolded screen, so these stay open past 8 groups. Recorded as DW-338. Settle with a run of more groups than fit on the unfolded inner display, including one group taller than a drag step.
status: done 2026-10-31
resolution: duplicate of DW-338 (the same review finding, carried in from story 3.12's plan frontmatter); tracked there.

### DW-340: send-push claims a (note, device) row before the APNs call, so a sender killed mid-send drops that push and nothing retries
origin: spec-deferred story-3.1 review
location: supabase/functions/send-push/handler.ts
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium
reason: The handler inserts the push_requests row, then sends. If the isolate dies or times out between the two, the row blocks every later call for that note and device, and pg_net calls the sender once per insert, so no retry exists. A failed APNs answer releases its claim, but nothing calls again. Settle it with story 13's real APNs run and a choice between a pending state that a later call may retake and a retrier.
status: done 2026-11-02
resolution: accepted by the owner: a push lost when send-push dies between its claim and the APNs call loses only the banner; the note itself still arrives in the app, and no failure has been seen.
decision: 2026-11-02 accept-and-close — owner, after the 2026-11-02 triage; no retrier and no pending state.

### DW-341: send-push treats a picture-only note as one with an image and blank text, but the real stand-in text is unverified
origin: spec-deferred story-3.1 review
location: supabase/functions/send-push/payload.ts (hasCaption)
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium (unverified)
reason: MessageInput.tsx sends '' for a picture-only note, while love_notes_content_check needs at least one character, and no substitute was found in notesSlice.ts. A non-blank stand-in would be pushed as the note's text instead of "Sent you a picture". Settle it by sending a picture-only note from the app against the local stack and reading the stored content.
status: done 2026-11-01
resolution: settled by story 3.10's sweep from the code and the local database rather than a send from the app: no stand-in exists. `MessageInput.tsx` (`handleSend`) passes '' for a picture-only note, `notesSlice.sendNote` inserts it unchanged, and a rolled-back local insert of '' with an `image_url` fails `love_notes_content_check` (23514). So no picture-only note reaches `love_notes` from the app, and send-push's picture-only branch is reached only by rows a test inserts with ' '. The refused send is DW-363.

### DW-342: A send-push claim is inserted before the APNs call, so an isolate killed between claim and send drops that push for good, and nothing re-calls the sender for a released claim.
origin: spec-deferred a15d99cc6689
location: supabase/functions/send-push/handler.ts
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium
reason: handler.ts claims (note, token) before sending; pg_net fires once per insert and nothing retries. Settles with a real APNs run (story 13) and a decision on a pending state or a retrier.
status: done 2026-10-31
resolution: duplicate of DW-340 (the same review finding, carried in from story 3.1's plan frontmatter); tracked there.

### DW-343: Picture-only detection assumes the stand-in text is blank; the composer sends an empty string and love_notes_content_check needs at least one character, so the real stand-in is unverified.
origin: spec-deferred 431bc8339dd8
location: supabase/functions/send-push/payload.ts (hasCaption)
source_spec: `tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md`
severity: medium
reason: MessageInput.tsx sends '' for a picture-only note; the table check requires char_length(content) >= 1; no substitute was found in notesSlice.ts. A non-blank stand-in would be pushed as text. Settle by sending a picture-only note from the app against the local stack and reading the row. (declared severity: medium (unverified))
status: done 2026-10-31
resolution: duplicate of DW-341 (the same review finding, carried in from story 3.1's plan frontmatter); tracked there.

### DW-344: sim banner --tap cold on the unfolded Duo can miss once: the banner is gone before the tap reaches it
origin: spec-deferred story-3.14 review
location: scripts/sim-driver/RunnerUITests/Notify.swift (banner)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium
reason: In unfolded portrait, the first `sim banner FILE --host --tap cold` read the banner's label, printed `before tap: notRunning`, then failed with "Failed to tap NotificationShortLookView … No matches found": the banner had gone before the tap. The next three cold runs and the background run passed. `banner` was not changed by story 3.14, so this is pre-existing timing between the read, the state check and the tap, and a later story's unattended check could fail once on it. Settle it by running `--tap cold` ten times unfolded and folded; if misses recur, tap the element found at read time immediately, or re-wait for the banner before tapping.
status: done 2026-11-02
resolution: not reproduced. `sim banner FILE --host --tap cold` ran 10 times folded and 10 times unfolded on the iPhone Duo simulator on 2026-11-02 and passed all 20; the driver is left as it is. Reopen if a cold tap misses again.

### DW-345: sim center drops "+N from <app>" summary cells; past 8 groups a summary may stand for groups that are not listed, undercounting silently
origin: spec-deferred story-3.14 review
location: scripts/sim-driver/RunnerUITests/Notify.swift (screenGroups, isSummary)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium (unverified)
reason: Story 3.14 found that on the first opening after a delivery Notification Center keeps a summary cell (body `phraseThatEnumeratesAllRemainingNotificationsInSection`, "+6 from Runner") beside the 8 expanded groups, and `center` printed it as a 9th group; `screenGroups` now ignores such cells unless they are stacked "Grouped" cells. With 8 groups every notification the summary stood for was also read as its own cell. Past 8 groups (the DW-338 multi-screen case) a summary might stand for notifications never listed, and dropping it would undercount with no warning. Settle it with the DW-338 run of more groups than fit the unfolded inner display, comparing the total count with the notifications pushed.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-one-screen
resolution-undo: 2ecb451ec71336ba2dd3eb5040fb949b8b3ed6d86f65b7e6cff0c86cc597792d 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 one-screen-limit — owner, 2026-11-02: settled with DW-338's one-screen limit; when a summary cell ("+N from <app>") is present, `center` reports it rather than dropping it silently, so an undercount is never quiet.

### DW-346: sim banner --tap cold on the unfolded Duo can miss once because the banner is gone before the tap reaches it.
origin: spec-deferred 4e4a0337de4b
location: scripts/sim-driver/RunnerUITests/Notify.swift (banner)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium
reason: First cold run in unfolded portrait: banner label read, before tap: notRunning, then "Failed to tap NotificationShortLookView ... No matches found"; the next three cold runs passed. banner is unchanged by this story, so the timing is pre-existing. Recorded as DW-344. Settle with ten cold runs unfolded and folded.
status: done 2026-10-31
resolution: duplicate of DW-344 (the same review finding, carried in from story 3.14's plan frontmatter); tracked there.

### DW-347: center drops "+N from <app>" summary cells; past 8 groups a summary may stand for groups never listed, undercounting silently.
origin: spec-deferred 2e36cea7cace
location: scripts/sim-driver/RunnerUITests/Notify.swift (screenGroups, isSummary)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium
reason: At 8 groups every notification the summary stood for was also read as its own cell. Past 8 groups (DW-338) this is untested. Recorded as DW-345. Settle with the DW-338 run of more groups than fit the unfolded inner display, comparing the total count with the pushes. (declared severity: medium (unverified))
status: done 2026-10-31
resolution: duplicate of DW-345 (the same review finding, carried in from story 3.14's plan frontmatter); tracked there.

### DW-348: center's coordinate-tap fallback logs nothing, and test-center-exit.zsh never stubs a phone with only Rotate Left, so neither path can be shown to work.
origin: spec-deferred c0f2e3e5b8e2
location: scripts/sim-driver/sim (rotate_to, center_restore); scripts/sim-driver/RunnerUITests/Notify.swift (tap)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: medium (unverified)
reason: No run so far has used either path. The 8-group runs passed, but nobody observed whether any tap went through displayInUse()'s coordinate fallback. The restore's rotate_to path through cmd_rotate on a phone with only Rotate Left (iPhone 17) was not run. If either is wrong, a read past a shrunk cell misses, or a phone is left turned. Settle it with one center run that taps a shrunk cell at the list's bottom edge on the unfolded Duo (log whether the fallback ran), and one center --host started in landscape on an iPhone 17 simulator, comparing ax state before and after. 2026-11-02 triage: the coordinate fallback (Notify.swift tap) logs nothing, so no run can show whether it was used, and test-center-exit.zsh never stubs a phone with only Rotate Left and no fold. This entry is the code half: log a line when the fallback taps, and add the Rotate-Left-only stub to test-center-exit.zsh. The two simulator runs move to DW-403.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-one-screen
resolution-undo: 2ecb451ec71336ba2dd3eb5040fb949b8b3ed6d86f65b7e6cff0c86cc597792d 2026-11-02 7374617475733a206f70656e

### DW-349: AGENTS.md's sim-driver clause says center puts the pose and orientation back, without sim help's exception for a folded landscape.
origin: spec-deferred 5cff3711aeb0
location: AGENTS.md (Maintained by hand, sim-driver paragraph)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: low
reason: sim help says a folded landscape comes back only when the shell, the host app, Settings or Safari was in front. With another app in front, center exits 1 after a good read and says why. The AGENTS.md clause states the restore with no exception, so an agent that reads only AGENTS.md expects the folded landscape back. The fix edits an agent-context file, so it is deferred rather than patched.
status: done 2026-11-01
resolution: AGENTS.md's sim-driver clause now states the folded-landscape exception (story 3.10).

### DW-350: center leaves the Home Screen in front after a folded-portrait or unfolded start; only a folded-landscape start brings its front app back.
origin: spec-deferred 14bd1d434eba
location: scripts/sim-driver/sim (cmd_center, center_restore)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: low
reason: center presses Home before its read and again after it, as story 12's center already did at the baseline (sim:641 and sim:648 at c9bf63ec), so the shell or host app that was in front is not brought back. The new restore relaunches the front app only for a folded landscape, because only there is it needed for the orientation. Neither sim help nor AGENTS.md says the front app is not restored. A check that expects the shell in front after center finds the Home Screen.
status: done 2026-11-01
resolution: documented in `sim help`'s center line and AGENTS.md's sim-driver clause (story 3.10). Behavior kept: only a folded-landscape start relaunches the front app, because only there does the orientation need it, and asking for the front app costs a runner step.

### DW-351: sim banner exits 130 on TERM as well as INT, while center now exits 143 on TERM.
origin: spec-deferred 05678d9d50dc
location: scripts/sim-driver/sim:600 (cmd_banner)
source_spec: `tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-notification-center-on-the-unfold-plan.md`
severity: low
reason: banner's trap is `trap '[[ -n $STEP_PID ]] && kill $STEP_PID 2>/dev/null; exit 130' INT TERM` (sim:600), unchanged since the baseline c9bf63ec. center's traps set 130 for INT and 143 for TERM. A caller telling the two signals apart by exit code gets 130 from banner for both.
status: done 2026-11-01
resolution: banner's trap is split: INT exits 130 and TERM 143, as center does (story 3.10).

### DW-352: Sign-out leaves the outgoing account's delivered notifications (love-note pushes and date reminders) in Notification Center, so the next person on a shared device can read them.
origin: spec-deferred story-3.2 plan
location: src/services/pushNotifications.ts (stopDevicePushes)
source_spec: `tickets/epic-push-notifications/tickets/story-sign-out-stops-a-device-s-pushes-plan.md`
severity: low
reason: Sign-out now removes the device's registration, unregisters from APNs and clears the badge, but the ticket does not ask for delivered notifications to go, and stopDevicePushes deliberately avoids the push plugin's removeAllDeliveredNotifications(), which rejects unless register() ran this launch. Each banner already delivered keeps its sender's name and note text in Notification Center after sign-out. Settle it in a later story with a native removal (UNUserNotificationCenter removeAllDeliveredNotifications) gated on its own plugin check, and a decision on whether a sign-out should empty the app's whole Notification Center group.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-clears-notifications
resolution-undo: b04da7f46545fbcaa346ae11efa04b980a6f5b208f9ab1392bb4755eae75bae2 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 clear-whole-group — owner, 2026-11-02: sign-out removes every delivered notification of the app, pushes and date reminders alike (retro L7), using @capacitor/local-notifications' removeAllDeliveredNotifications(), which needs no register() this launch, behind its own Capacitor.isPluginAvailable check; web-only, no new Swift. A simulator check of the shell is a follow-up outside the loop.

### DW-353: A push_devices row outlives the install or session that registered it (reinstall, offline sign-out, or a session ended elsewhere), and only an APNs 410 removes it, which may never come.
origin: review story-3.2
location: supabase/functions/send-push/handler.ts (410 branch, row selection); supabase/migrations/20261031000000_push_devices.sql (register_push_device); src/services/pushNotifications.ts (removePushRegistration); src/api/auth/actionService.ts (signOut everywhere); scripts/sim-driver (provision)
source_spec: `tickets/epic-push-notifications/tickets/story-sign-out-stops-a-device-s-pushes-plan.md`
severity: low
reason: Sign-out removes only the row for the token this install stored. An uninstall and reinstall gets a new APNs token, so the old row stays registered to the account. With a real APNs key the next send to it answers 410 and the sender deletes it; on the local stack there is no key, so the stale row stays, and every `sim build` (which uninstalls first) leaves one. Story 3.2's simulator check deleted one such row by hand before it ran. Settle it with a decision: either the driver clears the fixture accounts' push_devices rows when it provisions or reinstalls, or registration drops the account's other rows for this device (which needs a device identity APNs does not give). Absorbs DW-356 (an offline sign-out's old token: APNs answered 200 for about 30 minutes, never 410) and DW-384 (a session ended by the SDK or a global sign-out elsewhere leaves the row). Registration bumps updated_at on every online signed-in start with permission (App.tsx:443-449 -> register_push_device), not on a foreground return. "Sign out of all devices" removes only the calling device's row, so a lost phone keeps receiving love-note pushes until its app runs again (from the code; not checked on a device).
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-everywhere
resolution-undo: 051accdf846088fbef5b51bd6f3357876d3a16d827d043cb8100d2787d2fb8df 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 prune-and-sign-out-everywhere — owner, 2026-11-02, after Firebase's token-management guidance (timestamp each registration, prune stale ones, delete on an invalid-token answer): (1) send-push skips and deletes any push_devices row whose updated_at is older than one month; (2) "Sign out of all devices" deletes every push_devices row of the account through a SECURITY DEFINER RPC before the global sign-out (pgTAP for the RPC and its grants); (3) on the local stack, `sim provision` deletes the fixture accounts' push_devices rows so each `sim build` reinstall starts clean.

### DW-354: A reinstalled shell leaves its old token's push_devices row on the account; only the sender's APNs 410 cleanup removes it, which never runs on the local stack.
origin: spec-deferred 24a607eba37a
location: src/services/pushNotifications.ts (removePushRegistration); supabase/functions/send-push/handler.ts (410 branch)
source_spec: `tickets/epic-push-notifications/tickets/story-sign-out-stops-a-device-s-pushes-plan.md`
severity: low
reason: Sign-out removes only the stored token's row; a reinstall gets a new APNs token. The story's simulator check found one such stale row from story 1's install and deleted it by hand. Ledger DW-353.
status: done 2026-11-01
resolution: duplicate of DW-353 (the same review finding, carried in from story 3.2's plan frontmatter); tracked there.

### DW-355: Every push to main now rebuilds both Edge Functions from the unpinned esm.sh import, so production functions can change with no reviewed change, and an esm.sh outage blocks a frontend-only site deploy.
origin: review story-3.3
location: .github/workflows/deploy.yml (functions job); supabase/functions/send-push/index.ts:19; supabase/functions/upload-love-note-image/index.ts:22
source_spec: `tickets/epic-push-notifications/tickets/story-every-edge-function-deploys-from-deploy-yml-plan.md`
severity: medium (unverified)
reason: Both entrypoints import `https://esm.sh/@supabase/supabase-js@2`, and `supabase functions deploy --use-api` resolves that on Supabase's side at every deploy. Story 3.3's ticket asks for every function on every run, and for `build` to need the function deploy, so a newer 2.x on esm.sh reaches production on the next frontend-only push, and an esm.sh or bundler outage stops the site deploy. test.yml leaves `index.ts` out of `deno test` to avoid exactly this CDN dependency. That the resolved version drifts between deploys is unverified; compare the deployed bundle's supabase-js version across two runs to settle it. To fix, decide between pinning the import to an exact version in both functions and deploying functions only when `supabase/functions/**` or `supabase/config.toml` changed (which needs the owner to amend the "every run" decision).
status: done 2026-11-02
resolution: resolved by sweep bundle dw-pin-edge-supabase-js
resolution-undo: c5ac684b11adaf4e0287144b8d69060bbd70dab23125f5b61f135345802238d2 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 pin-and-keep-every-run — owner, 2026-11-02: pin `https://esm.sh/@supabase/supabase-js@2` to one exact 2.x version in both entrypoints (the version package-lock.json resolves for the app is the natural choice); keep deploying every function on every run, so the deploy.yml job stays ungated.

### DW-356: A device that signs out offline leaves its old token's push_devices row, APNs keeps accepting pushes to that unregistered token with 200 instead of 410, so the sender never deletes it and sends to it on every note.
origin: story-3.13
location: supabase/functions/send-push/handler.ts (410 branch); src/services/pushNotifications.ts (removePushRegistration)
source_spec: `tickets/epic-push-notifications/tickets/story-pushes-arrive-through-apns-on-a-device-and-from-the-hosted-p-plan.md`
severity: low
reason: Story 3.13's device run on 2026-11-01: after two offline sign-outs, the iPhone got a new APNs token on each sign-in, and the fixture account kept both old rows. For about 30 minutes, APNs answered 200 to every push for them, never 410, while the phone showed nothing for them, so nothing leaked on screen. Each stale row costs one APNs request per note, and any further rows a reinstall leaves (DW-353) add to that. A row deleted only on a 410 may never be deleted. Settle it with a decision: prune a registration not re-registered within some age (registration bumps `updated_at` on every signed-in start), or have the client remove its previous token's row on the next online sign-in (it would need to keep that token across sign-out). Whether APNs ever answers 410 for these tokens is unverified; re-read the fixture rows' send results after a day.
status: done 2026-11-02
resolution: merged into DW-353 (one stale push_devices problem with three causes: reinstall, offline sign-out, a session ended elsewhere); the owner chose one fix for all three there.

### DW-357: `src/types/database.types.ts` is not what AGENTS.md's regeneration command writes: since story 3.1 each regeneration has been reformatted to the file's style with the CLI's `ComputedFields: never` lines dropped, so the documented command now rewrites the whole file.
origin: review story-3.4
location: src/types/database.types.ts; AGENTS.md (Policy, the regeneration command)
source_spec: `tickets/epic-push-notifications/tickets/story-moods-photos-pokes-and-kisses-push-plan.md`
severity: low
reason: On 2026-10-31 with CLI 2.122, `supabase gen types typescript --local | grep -v '^Connecting to'` differed from the committed file by 1268 diff lines, both at the story's baseline (74897fd9) and after it. Story 3.4's diff to the file is only the `push_requests` columns and relationships, matching the migration. Stories 3.1, 3.2 and 3.4 all reformatted the output by hand, against "never hand-edit" and the Prettier rule against reformatting untouched code, because the raw output would rewrite the whole file. Settle it with a decision: commit the raw output once, as its own commit, and keep it raw from then on; or document the formatting step in AGENTS.md beside the command.
status: done 2026-11-01
resolution: the CLI prints its types unformatted by design (it says to run oxfmt). `npm run db:types` now formats them with the pinned oxfmt (no semicolons, 80 columns), which reproduces the file's layout; the file was regenerated once with it, restoring the CLI 2.122 `ComputedFields: never` lines. CI's Database Tests job regenerates and fails on any difference, and the CI CLI pins moved to 2.122.0 to match.

### DW-361: A push that arrives while Love Notes is in front can leave its badge showing on a real iPhone, because the second badge clear waits a fixed 1 s that was measured only on the simulator.
origin: review story-3.8
location: src/hooks/useLoveNotesReadMarker.ts (FOREGROUND_BADGE_RECLEAR_MS)
source_spec: `tickets/epic-push-notifications/tickets/story-love-notes-stack-apart-and-the-badge-counts-unread-notes-plan.md`
severity: medium (unverified)
reason: The push plugin's willPresent tells the web view about the push and then returns the badge option, and iOS applies the payload's badge after the first clear. On the iPhone Duo simulator a second `AppBadge.clear()` 1 s later left the badge clear on every run. No device has been checked, and a slower one could apply the badge after the second clear; the badge would then show until Love Notes is next opened or brought to the front. Settle it on the owner's iPhone in story 3.11: with Love Notes in front, a note from the partner must leave the badge clear. If it does not, clear the badge natively (for example in a willPresent wrapper told by the web view that Love Notes is on screen) rather than lengthening the wait.
status: done 2026-11-01
resolution: settled on the owner's iPhone in story 3.11: with Love Notes in front, a partner note showed no banner and left no badge, so the 1 s second clear held (story-push-ships-to-the-owner-s-iphone-plan.md, Result).

### DW-363: A picture-only love note sent from the app is refused by love_notes_content_check: the composer clears as if it sent, the note shows as failed, and Retry fails the same way
origin: story-3.10
location: src/components/love-notes/MessageInput.tsx (handleSend); src/stores/slices/notesSlice.ts (sendNote, picture path); supabase/migrations/20251206024345_remote_schema.sql (love_notes_content_check)
source_spec: `tickets/epic-push-notifications/tickets/story-refactor-sweep-plan.md`
severity: medium
reason: Found while settling DW-341. With no text, `handleSend` passes '' as the content beside the picture, and `sendNote` uploads the picture and then inserts '' unchanged. `love_notes_content_check` requires `char_length(content) >= 1`, so the insert fails with 23514. `sendNote` removes the uploaded object, sets `notesError` to `CHECK_CONSTRAINT_MESSAGE` ("Some values are not allowed - check length and format limits"), marks the note failed and returns without throwing, so `handleSend` fires the success vibration and clears the text and the picture as if the note had gone; the message shows only in Love Notes' page banner (`notes-error-banner`). `retryFailedMessage` re-inserts the same '' and fails the same way, so the note can never be sent. A rolled-back insert of '' with an `image_url` on the local stack, run on 2026-11-01, failed the constraint. No E2E or api spec sends a picture-only note through the app: the push spec inserts ' '. That the hosted constraint is the same is UNVERIFIED; read `pg_get_constraintdef` for `love_notes_content_check` read-only to settle it. Fixing it is a behavior change, outside a cleanup sweep, and needs a choice: allow empty content when `image_url` is set (a migration, plus `love_notes_visible` and every reader of `content`), or have the client send a stand-in, which send-push's `hasCaption` would then push as text.
status: done 2026-11-02
resolution: moved to the P1 backlog bug `_bmad-output/backlog/bug-a-picture-only-love-note-never-sends.md`, which carries the reproduction and acceptance criteria; the hosted `love_notes_content_check` was read on 2026-11-02 and matches the migration (`char_length(content) >= 1 AND <= 1000`).

### DW-364: sim help and AGENTS.md say center "ends on the Home Screen, except that a folded-landscape start gets its front app back", which misses a landscape start on a phone with no pose and a front step that found no app.
origin: spec-deferred 608c912c1e07
location: scripts/sim-driver/sim (help, center line; cmd_center; center_restore); AGENTS.md (Maintained by hand, sim-driver paragraph)
source_spec: `tickets/epic-push-notifications/tickets/story-refactor-sweep-plan.md`
severity: low
reason: cmd_center asks for the front app whenever `$CENTER_POSE != unfolded && $CENTER_ORIENT != portrait`, which includes an empty pose (a phone with no pose, such as an iPhone 17). center_restore relaunches only when CENTER_FRONT is set and not `none`, so when `notify front` fails nothing is relaunched; center only says the folded landscape may not come back. Found by story 3.10's review. The fix edits AGENTS.md, so it is deferred: reword both to "a landscape start that is not unfolded gets back the shell, the host app, Settings or Safari when the front step found one".
status: done 2026-11-02
resolution: `sim help` (center) and AGENTS.md's sim-driver paragraph now say a landscape start that is not unfolded (a folded Duo, or a phone with no pose) comes back only when the shell, the host app, Settings or Safari was in front, and that such a start gets that app back; behaviour unchanged.

### DW-365: `scripts/sim-driver/pending.py` checks no record-level schema marker, so an iOS release that keeps the pending archive's key names but changes their meaning would decode without error
origin: story-4.7
location: scripts/sim-driver/pending.py (pending, trigger_of)
source_spec: `tickets/epic-date-reminders/tickets/story-the-simulator-driver-lists-an-app-s-scheduled-reminders-plan.md`
severity: medium (unverified)
reason: Found by story 4.7's review. Each record in the fixture `PendingNotifications.plist` carries about 60 keys, `SchemaVersion` 11 and `TriggerRepeatInterval` 0 among them, but the mapper reads only the identifier, text, thread and trigger keys and fails loudly only when one of those is missing or holds an unknown shape. Whether an iOS release changes a key's meaning while keeping its name is UNVERIFIED. To settle it, decode a pending archive from a later simulator runtime (`python3 -I scripts/sim-driver/pending.py --raw FILE`) and compare it with the fixture. If it is real, the fix is to require the measured `SchemaVersion` and `TriggerRepeatInterval` 0.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-pending-schema-markers
resolution-undo: 29c914fde9708340ccb345f20f477c926e50327447685d7ef04c2cee1d2d3ad4 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 Require the markers now — In scripts/sim-driver/pending.py, require each record's SchemaVersion to equal the measured 11 and TriggerRepeatInterval to be 0, failing loudly (exit 1 with the record's identifier and the found value) otherwise, matching the decoder's existing fail-loudly rule; extend scripts/sim-driver/test-pending.zsh with fixtures for a changed SchemaVersion and a non-zero TriggerRepeatInterval.

### DW-366: AGENTS.md's sentence on `sim schedule`/`sim unschedule` omits two side effects: both launch the host app and bring it to the front, and `sim permission reset --host` uninstalls the host and so wipes its pending requests
origin: story-4.7
location: AGENTS.md (Maintained by hand, sim-driver paragraph); scripts/sim-driver/sim (host_apply, cmd_permission)
source_spec: `tickets/epic-date-reminders/tickets/story-the-simulator-driver-lists-an-app-s-scheduled-reminders-plan.md`
severity: low
reason: Found by story 4.7's review. `host_apply` runs `xcrun simctl launch --terminate-running-process` on the host, which leaves the host in front where a check may expect the shell, and `permission reset` runs `simctl uninstall`. Both appear in `sim help`, not in AGENTS.md. The fix edits AGENTS.md, so it is deferred: add both to the sim-driver paragraph.
status: done 2026-11-01
resolution: story 4.4: AGENTS.md's sim-driver paragraph now says `schedule` and `unschedule` launch the host, leaving it in front of the shell, and that `sim permission reset --host` uninstalls the host and wipes its pending requests.

### DW-369: The AGENTS.md sentence on `sim schedule` does not say the host needs `sim permission allow --host` first, so a later story's first schedule exits 1 and has to be rerun.
origin: spec-deferred e0029a1bba77
location: AGENTS.md (Maintained by hand, sim-driver paragraph)
source_spec: `tickets/epic-date-reminders/tickets/story-the-simulator-driver-lists-an-app-s-scheduled-reminders-plan.md`
severity: low
reason: host_apply dies with "the host has no notification permission: run sim permission allow --host" when the host's result file reads "not authorized", and `sim help` says so, but AGENTS.md's sim-driver paragraph does not. The fix edits AGENTS.md, so it is deferred.
status: done 2026-11-01
resolution: story 4.4: AGENTS.md's sim-driver paragraph now says `schedule` needs `sim permission allow --host` first.

### DW-370: On a first sign-in the launch plan can find notification permission not yet granted, and nothing re-plans once the person taps Allow until the next launch.
origin: spec-deferred ec751e5258fa
location: src/App.tsx:418-424, src/services/dateReminders.ts scheduleDateReminders
source_spec: `tickets/epic-date-reminders/tickets/story-the-planner-schedules-every-date-s-day-before-and-on-the-day-plan.md`
severity: low
reason: dateReminders.ts schedules only when checkPermissions().display is 'granted' and never prompts; story 3.1's alert is often still up when refreshLocalCopies() resolves on the first signed-in start. Story 4.6 owns the re-plan triggers (foreground, sign-in, date change). Whether its foreground trigger fires when the system permission alert closes is unverified; story 4.6 should check a re-plan after the first-sign-in permission answer.
status: done 2026-11-01
resolution: story 4.6: App's push effect re-plans the date reminders, with the start's captured identity, when `startPushRegistration()` resolves 'registering' (the permission is granted), covered by `tests/unit/App.localCopyRefresh.test.tsx`.

### DW-371: The `sim help` text and the AGENTS.md sim-driver sentence say `sim dates kinds|many` replace only the seeded events, but they first clear both people's anniversaries, the pair's couple_settings row
origin: spec-deferred 356b1422e4d3
location: scripts/sim-driver/sim:67-75, AGENTS.md (sim-driver paragraph)
source_spec: `tickets/epic-date-reminders/tickets/story-the-planner-schedules-every-date-s-day-before-and-on-the-day-plan.md`
severity: low
reason: scripts/sim-driver/sim:71-72 reads "kinds and many first remove the seeded events"; AGENTS.md's sim-driver paragraph reads "replacing the seeded events"; scripts/sim-driver/dates.ts runs clearDates before kinds and many, as its own header states. The fix edits AGENTS.md, an agent-context file.
status: done 2026-11-01
resolution: story 4.4: `sim help` and AGENTS.md now say `kinds` and `many` first do what `clear` does (both people's events and anniversaries, the pair's couple settings, both birthdays), and that their event and birthday writes send the other person date-change pushes (story 4.1's residual risk).

### DW-372: `sim pending` can report "nothing has been scheduled since ... installed" (and []) while requests are pending, because the simulator writes PendingNotifications.plist some time after `schedule`
origin: spec-deferred 533ac45bf375
location: scripts/sim-driver/sim cmd_pending
source_spec: `tickets/epic-date-reminders/tickets/story-the-planner-schedules-every-date-s-day-before-and-on-the-day-plan.md`
severity: low
reason: Found during this pass's simulator verification, not by a review lens. After the first sign-in and a network-off relaunch, `sim pending` 15 s after launch said the plist did not exist; the next launch's console showed LocalNotifications.getPending returning 11 pending requests. Later launches rewrote the plist within 25 s. A check that reads the list right after the first schedule on a fresh install can see a false empty list. Story 7's reader (scripts/sim-driver) could wait for the plist's mtime to pass the launch, as the previous pass did by hand.
status: done 2026-11-01
resolution: story 4.4: documented, behaviour kept. `sim help`, pending.py's missing-file note and AGENTS.md say iOS writes PendingNotifications.plist some time after a schedule, after a fresh install's first one sometimes not until the app's next launch, so an empty or stale list read right after one is not proof (the earlier "up to about 25 s" bound was dropped by DW-382). A wait would need the schedule's time, which `sim pending` does not know.

### DW-373: A re-plan cancels only the ids `getPending` reports, so if a follow-up re-plan's `getPending` misses requests the previous run just scheduled, ids above the new N stay pending.
origin: spec-deferred 4cdc45753d6d
location: src/services/dateReminders.ts scheduleDateReminders
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-re-plan-on-every-change-stop-at-sign-out-stack-wit-plan.md`
severity: medium
reason: Quick review finding, verdict maybe-false. The plugin's `schedule` calls `center.add` and resolves without waiting for its completion (LocalNotificationsPlugin.swift:211-227), and this story makes back-to-back re-plans routine (single-flight follow-up, copy-write bursts). Whether a `getPendingNotificationRequests` issued right after can miss an `add` still in flight is undocumented. On the simulator in this pass, a delete took the list from 12 to 10 and both stale ids were cancelled, but a single run does not settle the race. To settle it, schedule N and then immediately run getPending in a loop on a device or simulator and check whether it ever lists fewer than N. The fix, if needed, is the sign-out cancel's id union (1..64 plus pending) in scheduleDateReminders' cancel step. (declared severity: medium (unverified))
status: done 2026-11-01
resolution: `scheduleDateReminders` now cancels the same id union as `cancelDateReminders` (ids 1..64 plus every pending id, through `reminderIdsToCancel`), so a re-plan, and the story 4.3 Settings switch turned off, also cancels a fresh schedule the pending list has not caught up with. Whether iOS's `getPending` can lag an `add` stays unmeasured; the re-plan no longer depends on the pending list, though like the sign-out cancel it still assumes iOS applies a removal after an `add` already in flight (unverified).

### DW-374: `src/types/database.types.ts` gets each new table's block inserted in the committed file's style, because `supabase gen types typescript --local` on CLI 2.122.0 no longer reproduces the committed
origin: spec-deferred 8482db9d6aac
location: src/types/database.types.ts, AGENTS.md (Policy, database.types.ts)
source_spec: `tickets/epic-date-reminders/tickets/story-dates-marked-for-the-countdown-remind-a-month-and-a-week-bef-plan.md`
severity: low
reason: Quick review finding. On CLI 2.122.0 the command prints unformatted output, 621 lines against the committed 977, with `ComputedFields: never` in all 22 tables. A whole-file regeneration would rewrite every table's lines. Story 3.8 (b430cde6) and this story both inserted only their own table's block, which matches the generator's Row/Insert/Update shape. Settling it is a decision for the owner: either commit one full regeneration on the current CLI and run Prettier on that generated file, or amend the AGENTS.md rule. The rule edit touches an agent-context file.
status: done 2026-11-02
resolution: duplicate of DW-357, fixed by 9717aa5d (`npm run db:types` formats with the pinned oxfmt and CI checks the committed file) and 5cc03752 (the missing ComputedFields line); story 4.3 then regenerated on the pinned CLI and changed only its own lines, and the types check passes on main.

### DW-375: The iOS simulator ignores a host clock jump until it is rebooted, and the sim driver has no step for it, so a check that moves the Mac clock to make a reminder fire sees nothing fire.
origin: story 4.8 simulator checks, 2026-11-01
location: scripts/sim-driver/sim
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
reason: Observed in story 4.8's first pass: with the Mac clock set to 11-02 08:58:30 by `sudo /bin/date`, the 8 reminders due at 09:00 stayed pending; after a simulator reboot at 08:57 all 8 fired at 09:00. Every firing check in that story rebooted the simulator by hand after each clock jump. A `sim` command that reboots the simulator (or sets the clock and reboots) would make the step repeatable. The device check in story 5 is unaffected.
status: done 2026-11-02
resolution: `sim reboot` shuts the simulator down and boots it again (`simctl shutdown`, then `simctl bootstatus -b`), returning once it has booted; run it after each `sudo /bin/date` (plan-dw-375-376-sim-reboot-and-watch.md).

### DW-376: A date reminder firing while the shell is in the foreground was never observed; the plugin's default `willPresent` should show a banner, but no check confirms it.
origin: story 4.8 simulator checks, 2026-11-01
location: src/services/dateReminders.ts, @capacitor/local-notifications (willPresent presentation options)
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
reason: In every story 4.8 firing run the shell was backgrounded or terminated at 9:00, so only background delivery, the stacking in the one My Love group and the tap to Home were seen. Whether a reminder due while the shell is in front shows a banner (the plugin's default presentation) is unverified. A check needs the shell in front across 9:00, after the simulator reboot DW-375 describes: set the clock, `sim reboot`, `sim launch`, then `sim watch --front --for 180` started by 8:58, since the runner takes 6-12 s to start and first waits up to 20 s for any earlier banner to clear. `sim banner FILE --front` does not fit, because it pushes FILE and watches only 20 s.
status: done 2026-11-02
resolution: observed on the iPhone Duo simulator 2026-11-02, after DW-390 shipped: with the shell (built from main at 646facdf) in front and the Mac clock set to 2026-11-04 08:55 followed by `sim reboot`, `sim watch --front` saw the banner at 09:00:02 ("MY LOVE, now, Tomorrow: Lake weekend"). The plugin's default presentation shows the banner in front. The sound was not heard: the simulator's audio is not checked.
decision: 2026-11-02 observe-with-sound — owner, 2026-11-02: keep the plugin's banner when the shell is in front, and give reminders a sound (DW-390); check both together in one device or simulator run after DW-390 ships and the shell is reinstalled. Outside the loop: the run moves the Mac clock with sudo.

### DW-377: An offline sign-out leaves the account's refresh token valid on the server indefinitely, because nothing revokes it once the device is back online and no session timebox is set.
origin: story 4.8 thorough review, 2026-11-01
location: src/api/auth/actionService.ts (signOut, retryable fallback); supabase/config.toml ([auth.sessions] commented out)
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
reason: The owner chose a device-only sign-out when the server is unreachable (story 4.8 decisions). The device deletes its stored session, so the token is gone from that phone; the server session stays usable by anyone who already holds the refresh token. Settling it means either a revoke of the previous refresh token at the next online start (the token would have to be kept somewhere after sign-out) or an `[auth.sessions]` timebox/inactivity timeout in the hosted project; the hosted setting is unverified.
status: done 2026-11-02
resolution: accepted by the owner: the hosted project offers no session timebox or inactivity timeout on its plan (Auth settings show only access-token expiry 3600 s, refresh-token reuse interval 10 s and compromised-token detection on), and "Sign out of all devices" (d47ea7c5) revokes an orphaned session from any signed-in device.
decision: 2026-11-02 accept-and-close — owner, 2026-11-02; keeping the old refresh token after sign-out to revoke it later was rejected, because it leaves a credential on a shared device.

### DW-378: While the app runs on a stored session the SDK cannot use, Realtime channels may join with the publishable key and stay muted after the token renews.
origin: story 4.8 thorough review, 2026-11-01
location: src/api/interactionService.ts and src/stores/slices/interactionsSlice.ts (partner check after renewal, about :451-520); src/hooks/usePartnerMood.ts:89-96 (error never cleared); src/api/supabaseClient.ts (guard covers HTTP fetch only)
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
reason: The session guard wraps global.fetch, which the Realtime WebSocket never uses, so with a null INITIAL_SESSION channels join as anon until TOKEN_REFRESHED calls realtime.setAuth. 2026-11-02 triage: supabase-js re-sends the new token to joined channels and rejoins refused private ones, and a local-stack probe saw both the private mood channel and the interactions postgres_changes recover about 5 s after the token arrived. Mood (3f551b1b) and love notes (b64ceb38, ccf6ab2d) were since fixed. Two gaps remain, from reading the code: (1) pokes and kisses: the partner check stays empty after renewal because no second SUBSCRIBED fires, so live interactions are dropped as from no partner (interactionsSlice.ts:451-520); (2) usePartnerMood sets "Real-time connection lost. Refresh to reconnect." on CHANNEL_ERROR and never clears it on a later SUBSCRIBED, so the card stays on its error after delivery recovers. Fix both, with a local-stack E2E that blocks the token endpoint, lets the token renew, and sees a partner mood, note and poke arrive live.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-realtime-recovery-after-renewal
resolution-undo: db00046158db0bae449549e28442c6371d4363a2028fc0fa225a0e94cabb8016 2026-11-02 7374617475733a206f70656e

### DW-379: AGENTS.md does not yet state the session rules story 4.8 introduced.
origin: story 4.8 thorough review, 2026-11-01
location: AGENTS.md (Known pitfalls)
source_spec: `tickets/epic-date-reminders/tickets/story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md`
severity: low
reason: Three rules a later agent needs are only in code comments: only an empty SDK session store means signed out (`readStoredSession`, `src/api/authStorage.ts`); `getSession` can return a stored session whose access token has expired while the server is unreachable, so code that sends `session.access_token` itself must expect a 401; and the session guard fails a data request with a synthetic `TypeError('Failed to fetch')` even when the network is up (the SDK's 60 s refresh cooldown, or GoTrue down). The edit touches an agent-context file, so it is deferred.
status: done 2026-11-01
resolution: story 4.4: the three session rules are a Maintained-by-hand bullet in AGENTS.md (outside the generated block, so a context refresh keeps them).

### DW-380: A countdown mark on the partner's birthday is keyed `partner-birthday`, not by the partner, so after an unlink and a link to someone else it marks the new partner's birthday.
origin: story 4.2 residual risk, carried in by story 4.4, 2026-11-01
location: src/services/dateReminders.ts (MARK_KEYS); the countdown marks table and its local copy (story 4.2)
source_spec: `tickets/epic-date-reminders/tickets/story-dates-marked-for-the-countdown-remind-a-month-and-a-week-bef-plan.md`
severity: low
reason: Story 4.2 keys the fixed dates `relationship-start`, `wedding`, `own-birthday` and `partner-birthday`, so a mark outlives the link it was made under; the same holds for `relationship-start` and `wedding`, which are the couple settings of whichever pair the person is in. Whether a mark should carry over to a new partner is an owner decision; a fix would key the partner-scoped marks by the partner's id (or clear them in `accept_partner_request`) and needs a migration. Recorded only in the plan's residual risks until now.
status: done 2026-11-02
resolution: closed as unreachable: the app has no unlink, and accept_partner_request refuses when either person already has a partner, so a role-keyed mark (partner-birthday, and equally relationship-start and wedding, retro finding L13) can never meet a second partner; reopen if an unlink is ever built.
decision: 2026-11-02 close-unreachable — owner, 2026-11-02; covers retro L13 too.

### DW-381: Offline, or after a failed read, Settings shows the "Date reminders" switch on (disabled) while the saved copy says off, because nothing seeds the store's push preferences from the `push-preferences` local copy.
origin: story 4.3 review (rejected there under its unchanged-load-behaviour rule), carried in by story 4.4, 2026-11-01
location: src/components/Settings/CountdownMarks.tsx (the switch's `?? true` default; PushSettings.tsx's six rows the same); src/stores/slices/settingsSlice.ts `loadPushPreferences`
source_spec: `tickets/epic-date-reminders/tickets/story-a-settings-switch-turns-date-reminders-off-plan.md`
severity: low
reason: `loadPushPreferences` returns early offline and the row renders `?? true`, the same as story 3.7's six push rows. Planning is unaffected, because the re-plan reads the copy, so no reminder is scheduled; only the switch's shown state is wrong. A fix seeds the store from the copy before the online read, for all seven rows, which is a load-behaviour change and not cleanup.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-preferences-saved-copy
resolution-undo: 56a0a8b609c0d775e125b17c47bb18a344e21e1a0204ed542d96495a1d8e50d6 2026-11-02 7374617475733a206f70656e

### DW-382: The docs this sweep added for DW-372 say iOS writes PendingNotifications.plist "up to about 25 s after a schedule", but no measurement bounds the lag on a fresh install's first schedule.
origin: spec-deferred 8a19bda4005c
location: AGENTS.md (Maintained by hand, sim-driver paragraph); scripts/sim-driver/sim (help, pending); scripts/sim-driver/pending.py (missing-file comment); _bmad-output/initiative-my-love/deferred-work.md
source_spec: `tickets/epic-date-reminders/tickets/story-refactor-sweep-plan.md`
severity: low
reason: DW-372 and story 4.1's plan record the only measurements: on the first schedule after a fresh install the plist still did not exist 15 s after launch and appeared only by the next launch; "within 25 s" was seen on later launches, timed from launch, not from the schedule. So a later agent can wait 25 s and still read a false empty list. Found by story 4.4's quick review. The fix rewords `sim help` (pending), the comment in scripts/sim-driver/pending.py, AGENTS.md's sim-driver paragraph and DW-372's resolution to drop the bound: "iOS writes the file some time after a schedule, on a first install sometimes not until the next launch, so an empty or stale list right after one is not proof". It edits AGENTS.md, so it is deferred. 2026-11-02 triage: rewording DW-372's resolution line is an orchestrator edit, so do it in the same interactive docs commit as the AGENTS.md change, not in a loop session.
status: done 2026-11-02
resolution: `sim help` (pending), pending.py's missing-file note, AGENTS.md's sim-driver paragraph and DW-372's resolution drop the 25 s bound: iOS writes the file some time after a schedule, after a fresh install's first one sometimes not until the app's next launch.

### DW-383: A device clock far ahead of real time, online, makes supabase-js refresh the session in a loop until GoTrue answers 429, and the SDK then signs the device out.
origin: spec-deferred story-4-5-ship
location: src/api/auth/sessionService.ts; node_modules/@supabase/auth-js (GoTrueClient `_callRefreshToken`)
source_spec: `tickets/epic-date-reminders/tickets/story-date-reminders-ship-to-the-owner-s-iphone-plan.md`
severity: low
reason: Seen on the owner's iPhone on 2026-11-02 against production: with the clock five days ahead and Wi-Fi still on, every token the server issued already looked expired to the device, so it refreshed about 30 times in 3 s (06:11:49-52 UTC, all 200), then GoTrue answered 429 `over_request_rate_limit`. A 429 is not an `AuthRetryableFetchError`, and with the access token expired by the device's clock `_callRefreshToken` calls `_removeSession()`, which emits SIGNED_OUT. Only a wrong device clock reaches it, and iOS sets the clock itself unless the person turns that off. Settle it with a decision: accept it, or treat a 429 refresh like an unreachable server (keep the stored session) in the app's auth layer.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-session-device-relative-expiry
resolution-undo: ce31c7258ea1b5ae305ceb0e442d53638df4b42816fb54983de29c8dfd29184f 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 fix-device-relative-expiry — owner, 2026-11-02 (well-built clients tolerate a wrong device clock): in the app's session-guarded fetch wrapper (supabaseClient.ts createSessionGuardedFetch), strip expires_at from GoTrue token responses so auth-js computes expiry from expires_in on the device's own clock (@supabase/auth-js 2.118.0 lib/fetch.js:140); the server still checks expiry with its own clock. Unit-test a token response with expires_at days in the past and a clock days ahead; no refresh loop and no SIGNED_OUT.

### DW-384: A session that ends without the app's Sign out (a refresh the SDK gives up on, or a sign-out of all devices from elsewhere) leaves the device's push_devices row on the account.
origin: spec-deferred story-4-5-ship
location: src/services/pushNotifications.ts (removePushRegistration); src/api/auth/actionService.ts (signOut)
source_spec: `tickets/epic-date-reminders/tickets/story-date-reminders-ship-to-the-owner-s-iphone-plan.md`
severity: low
reason: Only the app's own Sign out calls `removePushRegistration()` while the session still exists. On 2026-11-02 two Claude Bot rows were left on production by sessions that ended otherwise (the DW-383 sign-out, and a global sign-out from the simulator); story 4.5's cleanup deleted them. The rows keep pushing to a device that is signed out of the account until APNs answers 410. Related to DW-353 (a reinstall's old row). Settle it with DW-353's decision on who removes a device's stale rows.
status: done 2026-11-02
resolution: merged into DW-353 (one stale push_devices problem with three causes); the owner chose one fix for all three there.

### DW-385: AGENTS.md's sim-driver paragraph does not name `sim reboot` or `sim watch`.
origin: plan-dw-375-376-sim-reboot-and-watch review, 2026-11-02
location: AGENTS.md (Maintained by hand, the sim-driver paragraph)
source_spec: `plan-dw-375-376-sim-reboot-and-watch.md`
severity: low
reason: The paragraph lists the driver's notification commands and names `banner FILE --front` for watching while the shell is in front, which covers a push only. It does not say that a Mac clock jump needs `sim reboot` before a scheduled notification fires, or that `sim watch [--front] [--for SECONDS]` watches for a banner with nothing pushed. `sim help` lists both. The edit touches an agent-context file, so it is deferred. 2026-11-02: the same paragraph's `sim dates` sentence must also say that clear removes both people's countdown marks and resets the date-reminders switch once DW-397 lands.
status: done 2026-11-02
resolution: AGENTS.md's sim-driver paragraph now names `sim watch [--front] [--for SECONDS]` (a banner with nothing pushed) and `sim reboot` (needed after each `sudo /bin/date` before a scheduled notification fires), and its `sim dates` sentence says clear also deletes both people's countdown marks and turns both people's date reminders back on.

### DW-386: "Sign out of all devices" reports success when only this device was signed out.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L1, 2026-11-02
location: src/api/auth/actionService.ts:99-109 (signOut, retryable fallback); src/components/Settings/Settings.tsx:548
severity: medium
reason: Settings refuses the row only when isOnline() is false. With the browser online but the auth server unreachable, signOut({ everywhere: true }) turns the AuthRetryableFetchError into error = null, or falls back to a local sign-out, and Settings reports success although the other devices stay signed in. The only test of { everywhere: true } uses error: null. It is in d47ea7c5, pushed without review.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-everywhere
resolution-undo: 051accdf846088fbef5b51bd6f3357876d3a16d827d043cb8100d2787d2fb8df 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 report-partial — owner, 2026-11-02: when the global sign-out meets a retryable error, sign this device out as now but tell the person the other devices could not be signed out and to try again online; add a test with a retryable error on { everywhere: true }. Fits one bundle with DW-353 and DW-387.

### DW-387: "Sign out of all devices" acts on one tap, with no confirmation.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L16, 2026-11-02
location: src/components/Settings/Settings.tsx (the row, d47ea7c5)
severity: low
reason: The row sits directly under Sign out, so one wrong tap signs the account out on every phone, simulator and browser.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sign-out-everywhere
resolution-undo: 051accdf846088fbef5b51bd6f3357876d3a16d827d043cb8100d2787d2fb8df 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 confirm-first — owner, 2026-11-02: a confirmation dialog, "Sign out on every device? You'll need to sign in again on each one.", with Cancel and Sign out everywhere.

### DW-388: App.tsx's auth-check comment says a present session means the callback outcome is null, which is false for an implicit-grant error redirect.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L17, verified 2026-11-02
location: src/App.tsx:262-266; src/api/supabaseClient.ts:200-206 (getAuthCallbackOutcome)
severity: low
reason: getAuthCallbackOutcome returns 'provider-error' or 'cancelled' for an AuthImplicitGrantRedirectError before it reads the session, so a signed-in person landing on an error redirect gets a notice, contrary to the comment. Decide while fixing whether a signed-in person should see that notice (getAuthCallbackOutcome already returns null for a code callback with a session); then make the code and the comment agree, with a unit test.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-auth-callback-comment
resolution-undo: e6ab390a78d48124a9fdc780e475154c434db77610befa807d870188423dccbc 2026-11-02 7374617475733a206f70656e

### DW-389: A device that is only resumed keeps planning date reminders from stale copies: a mark, switch or partner birthday changed elsewhere arrives only after a full restart or reconnect.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A6/L3, 2026-11-02
location: src/services/dateRemindersAtLaunch.ts:179-182 (visibilitychange re-plan); src/App.tsx:434 and :500 (copy refreshes); src/hooks/useRealtimeMessages.ts:711 (only TOKEN_REFRESHED listener)
severity: medium
reason: The epic defines open as every launch and every return to the foreground, but story 4.6's frozen intent says no server refresh on foreground, so visibilitychange re-plans from unchanged copies; copies refresh only on a signed-in start, on online, and when a view loads, and nothing refreshes after TOKEN_REFRESHED. So the partner changing their birthday, or the person marking a date on another device, reaches a resumed phone only at its next cold start.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-replan-timing
resolution-undo: bef106d32d6d3e89afddaca578b91d4c6b34a9a99e40b6aa110e3f7db7e29975 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 refresh-on-foreground — owner, 2026-11-02 (supersedes story 4.6's "no server refresh on foreground" for this purpose): on a return to the foreground while online, and after TOKEN_REFRESHED, refresh the seven date-reminder copies (throttled to at most once every few minutes) and then re-plan; offline it keeps planning from the saved copies.

### DW-390: Date reminders fire with no sound.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L2, 2026-11-02
location: src/services/dateReminders.ts (scheduleDateReminders); capacitor.config.ts (LocalNotifications); node_modules/@capacitor/local-notifications ios LocalNotificationsPlugin.swift:472-473, LocalNotificationsHandler.swift:35
severity: medium (unverified)
reason: scheduleDateReminders passes no sound, and the plugin sets content.sound only for a non-empty string, so reminders are most likely silent; story 4.5's device run did not record sound. In front, reminders use the plugin's default [.badge, .sound, .banner, .list] while pushes use presentationOptions ['badge'].
status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-default-sound
resolution-undo: 4c116e065311b4a915de0daf0a0c2bc8378770ff6ce0121464318a44c7512fe7 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 default-sound-keep-banner — owner, 2026-11-02: reminders play the default notification sound (the plugin's supported way to request it), and a reminder due while the shell is in front keeps showing a banner. Unit-test the scheduled payload; the audible check on a device after a reinstall belongs to DW-376's run, outside the loop.

### DW-391: The love-notes re-arm can get stuck reconnecting when its openChannel rejects.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L4, 2026-11-02
location: src/hooks/useRealtimeMessages.ts:685-701 (rearm)
severity: low
reason: rearm() sets gaveUp = false and reports 'reconnecting' before openChannel; if that rejects, the catch only logs, so every later rearm() sees gaveUp false with a zero retry count and returns, and the feed stays reconnecting with no channel until Love Notes remounts. Fix: in the catch, restore gaveUp = true and report disconnected, with a test for a rejected openChannel. Fits one bundle with DW-378.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-realtime-recovery-after-renewal
resolution-undo: db00046158db0bae449549e28442c6371d4363a2028fc0fa225a0e94cabb8016 2026-11-02 7374617475733a206f70656e

### DW-392: Turning date reminders off cancels nothing while any other saved copy is missing.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A7, 2026-11-02
location: src/services/dateRemindersAtLaunch.ts:96 (planOnce)
severity: low
reason: planOnce returns before anything when any of the seven copies is null, so switching the reminders off while another copy is missing or malformed leaves every pending reminder scheduled, against R6 ("off cancels every scheduled reminder"). Fix: when the push-preferences copy says off, cancel without needing the other copies; unit-test it.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-off-cancels-alone
resolution-undo: ac06a2ca4ec8837963f0ec6925b2f1334207ebbcd80800986a1e27e7948e4d78 2026-11-02 7374617475733a206f70656e

### DW-393: A failed background refresh of the push settings disables an open Settings section.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L5, 2026-11-02
location: src/stores/slices/settingsSlice.ts:1024-1031 (loadPushPreferences catch)
severity: low
reason: Story 4.3 made loadPushPreferences the push-preferences refresher, so it runs on every signed-in start and reconnect; a failed read sets pushPreferences: null and pushPreferencesLoadFailed: true, and an open Settings section then shows its load failure and disables all seven rows although the saved copy is fine. Same function as DW-381: fix together, so a failed read falls back to the saved copy and only a missing copy shows the failure.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-preferences-saved-copy
resolution-undo: 56a0a8b609c0d775e125b17c47bb18a344e21e1a0204ed542d96495a1d8e50d6 2026-11-02 7374617475733a206f70656e

### DW-394: PushSettings.test.tsx asserts only that console.error was called.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A5, 2026-11-02
location: src/components/Settings/__tests__/PushSettings.test.tsx:357
severity: low
reason: The bare expect(console.error).toHaveBeenCalled() has passed vacuously twice when a newly mounted native module logged an unrelated error (4.6's local-notifications mock, 4.2's countdown-marks mock). Assert the expected message instead. Fits the DW-381 bundle.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-preferences-saved-copy
resolution-undo: 56a0a8b609c0d775e125b17c47bb18a344e21e1a0204ed542d96495a1d8e50d6 2026-11-02 7374617475733a206f70656e

### DW-395: The countdown marks list offers dates that can never schedule a reminder.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A4/L10, 2026-11-02
location: src/components/Settings/CountdownMarks.tsx:75-87; src/services/dateRemindersAtLaunch.ts:79-117 (planOnce); src/services/dateReminders.ts:193-285 (reminderDateEntries, planDateReminders, :263)
severity: low
reason: Two builders of the planner's input diverge: planOnce builds ReminderDates from the saved copies, CountdownMarks from the store, and each kind has its own eligibility rule, so the list offers rows the planner skips (an event tomorrow after 9:00 today, a relationship start dated today or later). Fix: one shared builder and eligibility rule for both, so the list shows only dates that can remind; unit-test the two examples.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-countdown-marks-list-matches-plan
resolution-undo: 96b338e4fac679710e3c04d2e8768cec101b1f4fe642204ed96b1344e5dcdbae 2026-11-02 7374617475733a206f70656e

### DW-396: The date reminders switch says "At 9:00 before each date.", but birthdays and anniversaries also remind on the day.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L11, 2026-11-02
location: src/components/Settings/CountdownMarks.tsx:40 (REMINDERS_HELPER)
severity: low
reason: The helper text describes only the day-before reminder.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-countdown-marks-list-matches-plan
resolution-undo: 96b338e4fac679710e3c04d2e8768cec101b1f4fe642204ed96b1344e5dcdbae 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 reword — owner, 2026-11-02: "At 9:00 the day before, and on the day for birthdays and anniversaries." Update any test that pins the old text.

### DW-397: `sim dates kinds|many|clear` leaves countdown marks and the date-reminders switch behind.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L6, 2026-11-02
location: scripts/sim-driver/dates.ts:53-63 (clearDates); scripts/sim-driver/sim (help, dates)
severity: low
reason: clearDates deletes events, anniversaries, couple_settings and birthdays but not countdown_marks or push_preferences.date_reminders, so leftovers from a 4.2 or 4.3 check change later seeds. Fix: delete both people's countdown_marks and reset date_reminders to true, and update `sim help`. The AGENTS.md sentence is DW-385's, outside the loop.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-dates-clear-marks
resolution-undo: bc6330b9d88371af0a1a8d44a6c0475988b2b4ec8826a2b408f3f7723e3dd3c7 2026-11-02 7374617475733a206f70656e

### DW-398: AGENTS.md does not warn that every date-reminder re-plan cancels every pending local notification.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L14, 2026-11-02
location: src/services/dateReminders.ts (reminderIdsToCancel); AGENTS.md (Known pitfalls)
severity: low
reason: reminderIdsToCancel adds every pending id, which is correct today because the shell schedules no other local notification (story 4.1's review), but a future local-notification feature would have its notifications cancelled on every re-plan. Accepted as design; the remedy is a pitfall line telling such a feature to reserve an id range or tag and narrow the cancel. Outside the loop: it edits AGENTS.md.
status: done 2026-11-02
resolution: AGENTS.md (Maintained by hand) now warns that every re-plan cancels ids 1 to MAX_SCHEDULED_REMINDERS and every pending local notification, and that a new local-notification feature must reserve an id range or tag and narrow that cancel in the same change. Placed outside the generated block so a context refresh keeps it.

### DW-399: settingsSlice.ts has grown to 1116 lines with six registerLocalCopy kinds.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding A2, 2026-11-02
location: src/stores/slices/settingsSlice.ts
severity: low
reason: It grew from 930 lines at 58da06ce as stories 4.2, 4.3 and 4.6 added the countdown-marks and push-preferences copies, readers, refreshers and setters. A split candidate (copy kinds and readers by domain), not broken; a refactor story if ever, not a sweep bundle.
status: done 2026-11-03
resolution: story 5.3: settingsSlice.ts split into datesSlice, profileSlice and notificationsSlice; settingsSlice keeps start-up, device settings and onboarding; the anniversaries mirror's residue is DW-426.
decision: 2026-11-02 hold-for-settings-rework — owner, 2026-11-02: not a sweep bundle. Keep it open as an input to the owner's planned Settings page rework, which will decide how the slice splits; a sweep should leave it untouched until that work is planned.

### DW-400: The launch re-plan of date reminders waits for the slowest copy refresher, and the partner lookup has no request timeout.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L9, 2026-11-02
location: src/App.tsx:434; src/stores/slices/settingsSlice.ts:836-837
severity: low (unverified)
reason: The re-plan is chained onto refreshLocalCopies(), so a stalled connection the browser reports as online can hold the launch plan until a foreground return. Plausible from the code, not reproduced. Settle it with a unit test that stalls one refresher and checks when the re-plan runs; if it waits, plan from the saved copies first and re-plan after the refresh.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-date-reminders-replan-timing
resolution-undo: bef106d32d6d3e89afddaca578b91d4c6b34a9a99e40b6aa110e3f7db7e29975 2026-11-02 7374617475733a206f70656e

### DW-401: Date reminders may never fire on a device set to a non-Gregorian calendar.

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L12, 2026-11-02
location: node_modules/@capacitor/local-notifications ios LocalNotificationsPlugin.swift:576-579 (DateComponents with no calendar)
severity: low (unverified)
reason: The plugin builds DateComponents with no calendar, so a device on a Buddhist or Japanese calendar might read year 2026 in that calendar and the reminders never fire. Settle it on a simulator set to another calendar with `sim pending` after a schedule; outside the loop.
status: done 2026-11-02
resolution: won't fix -- owner, 2026-11-02: neither the owner's nor the partner's phone uses a non-Gregorian calendar, so the case does not apply. Not checked on a simulator. Reopen if anyone using the app sets their phone to another calendar.

### DW-402: A lost phone keeps its scheduled date reminders after "Sign out of all devices".

origin: epic-date-reminders retrospective (tickets/epic-date-reminders/epic-date-reminders-retrospective.md), finding L8, 2026-11-02
location: src/services/dateReminders.ts (cancel on sign-out)
severity: low
reason: Reminders are local to the phone and are cancelled only by its own JavaScript after it sees the sign-out, so up to 64 stay scheduled on a lost phone.
status: done 2026-11-02
resolution: accepted by the owner; recorded so later retros stop re-flagging it.
decision: 2026-11-02 accept-and-close — owner, 2026-11-02: apps do not normally reach a lost phone's local notifications (a silent push is not reliably delivered); the remedy is Find My's Erase iPhone, and DW-353 stops new pushes.

### DW-403: center's restore on a Rotate-Left-only phone and tap(_:)'s coordinate fallback on the inner display have never been observed on a simulator.

origin: split from DW-348 by the 2026-11-02 ledger triage
location: scripts/sim-driver/sim (rotate_to, center_restore); scripts/sim-driver/RunnerUITests/Notify.swift (tap)
severity: medium (unverified)
reason: Needs two runs after DW-348 lands its fallback log line: one center run that taps a shrunk cell at the list's bottom edge on the unfolded Duo (read whether the fallback ran), and one `center --host` started in landscape on an iPhone 17 simulator, comparing `ax state` before and after (the iPhone 17 needs selecting in Device Hub, DW-334). Outside the loop.
status: done 2026-11-02
resolution: checked on the simulators 2026-11-02. The restore on a Rotate-Left-only phone first failed: `ax state` says "pose: n/a" on the iPhone 17, so center tried to unfold it and died ("could not unfold"); test-center-exit.zsh's stub printed no pose line and so passed. Fixed at 646facdf (center treats n/a as no pose; the stub prints "pose: n/a" and fails without the fix). After the fix a `center --host` started in landscapeLeft with Settings in front ended in landscapeLeft. The coordinate fallback was never needed: in 10 runs with a stacked group placed 7th to 11th, XCUITest called the stack hittable every time and tapped it directly, so no fallback note was printed. The fallback stays as it is, unobserved.

### DW-404: A failed center's restore skips its "could not restore" report: when die's exit (nested below cmd_center) runs center's EXIT trap, zsh 5.9 ends the trap as soon as a function it calls directly
origin: spec-deferred 9f0d4541ec07
location: scripts/sim-driver/sim (center_restore, die); scripts/sim-driver/test-center-exit.zsh
source_spec: `plan-dw-sim-center-one-screen.md`
severity: low
reason: Reproduced in plain zsh 5.9: with `f() { trap restore EXIT; die; }` and `die() { exit 1; }`, `restore() { inner || print report; print after; exit 7; }` runs inner's whole body, then stops (exit 1, no "report", no "after"); with `exit 1` called in f directly it prints both and exits 7. In sim, center_restore's only direct function call is `rotate_to` (sim:824), so a failed read still turns the device back, but a restore failure on that path is never reported and CENTER_DONE is never set. In test-center-exit.zsh ax, xcrun and sleep are stub functions, so a failed read's restore stops at its first stubbed call; a phone read-fails case starting in landscape ended in portrait for that reason and was left out. Fix: call rotate_to in a subshell, `( rotate_to $CENTER_ORIENT )`, and make the stubbed restore checkable.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-sim-center-restore-subshell
resolution-undo: 52a3cbe47b39286c8cb6953e0f685f3409c738a1713e9c550f0323a99e5e80c8 2026-11-02 7374617475733a206f70656e

### DW-405: center's one-screen check (no stacked cell left, and neither a drag nor a swipe down the list moves a cell) has not been run on a simulator.
origin: spec-deferred f1809e113bbf
location: scripts/sim-driver/RunnerUITests/Notify.swift (center)
source_spec: `plan-dw-sim-center-one-screen.md`
severity: low
reason: The drag-then-swipe sequence is the one every passing 8-group run ended on, and those runs printed no extra stacked-cell group, so neither check should fire at 8 groups; a run with 8 groups (exit 0) and one with more than fit (exit 1 with the message) would prove it. Needs the Duo simulator, like DW-403.
status: done 2026-11-02
resolution: run on the iPhone Duo simulator 2026-11-02, after two faults the first runs found were fixed at 646facdf (displayInUse() read SpringBoard's windows one query at a time and failed on a vanished index right after a burst of pushes; a fresh Notification Center at times opened with the new notifications in the bottom pile, so center read too few). Then: 7 groups with one stack of 2 exit 0 twice (the stack counted 2); 8 single groups exit 0; 14 groups exit 1 with "a drag down the list moved it (13 cells before, 14 after)". The Duo was put back folded and in portrait each time. The check counts every app's cells, not only the app's: DW-414.

### DW-406: After "Sign out everywhere", another device whose access token has not yet expired can re-register its push_devices row, so a lost phone opened within about an hour keeps receiving pushes until an
origin: spec-deferred 15f1bfb60d36
location: supabase/migrations/20261031000000_push_devices.sql (register_push_device); src/api/auth/actionService.ts (signOut, everywhere)
source_spec: `plan-dw-sign-out-everywhere.md`
severity: medium
reason: Global sign-out revokes refresh tokens, but access tokens stay valid until they expire (supabase/config.toml jwt_expiry = 3600). register_push_device checks only auth.uid() (20261031000000_push_devices.sql), and App.tsx re-registers on every signed-in start with permission. The same happens if a registration lands in the up-to-3 s gap between unregister_all_push_devices() and the global sign-out. Pre-existing: register_push_device never checked whether the caller's session was revoked. Settling it needs a server-side check that the JWT's session_id still exists in auth.sessions, or an owner decision to accept the window.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-push-register-session-check
resolution-undo: 0a5864b1b6284bf808388361b35ec0695f3ddb78b43e86ad46388a30fc0f93fb 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 server-session-check — owner, 2026-11-02: register_push_device refuses a caller whose JWT session_id no longer exists in auth.sessions, so a device signed out by "Sign out of all devices" cannot re-register while its access token is still valid; this also covers a registration landing between unregister_all_push_devices() and the global sign-out. Keep jwt_expiry as is. Scope is push registration only: a still-valid access token reading app data until it expires is accepted.

### DW-407: DW-352's native removal is unverified on a shell: no simulator check yet shows sign-out emptying Notification Center of delivered pushes and date reminders.
origin: spec-deferred e63b7bcda168
location: src/services/pushNotifications.ts (stopDevicePushes)
source_spec: `plan-dw-sign-out-clears-notifications.md`
severity: low
reason: The intent names a simulator check of the shell as a follow-up outside the loop. Unit tests mock the plugin, so they cannot show that `Capacitor.isPluginAvailable('LocalNotifications')` is true in the installed shell or that the plugin's iOS method (`UNUserNotificationCenter.removeAllDeliveredNotifications()`, LocalNotificationsPlugin.swift:879-888) removes delivered APNs pushes there. Settle it with `scripts/sim-driver/sim`: push a love note and let a date reminder fire, sign out, then `sim center` shows no group for the app.
status: done 2026-11-02
resolution: observed on the iPhone Duo simulator 2026-11-02 with the shell built from main at 646facdf, signed in as Casey: a pushed love note showed as a banner, `sim center` then read {"groups":[{"count":1,"text":"Jessie, New love note"}]}; after `sim signout`, `sim center` read {"groups":[]} and `sim badge` none. A date reminder delivered at 09:00 in the DW-376 run was also gone after sign-out, but only the after-read covers it (the before-read was blocked by another app's notifications, DW-414).

### DW-408: An account switch without a sign-out (in place, or a fresh sign-in whose owner marker names another account) leaves the outgoing account's delivered notifications in Notification Center.
origin: spec-deferred ff783ef05e40
location: src/stores/slices/authSlice.ts:331-336, 456-459
source_spec: `plan-dw-sign-out-clears-notifications.md`
severity: low
reason: `discardAccountState` calls `stopPushesForSignOut()` only when `identity.userId === null` (src/stores/slices/authSlice.ts:336), and the fresh-sign-in leftover path calls `deleteAccountData(leftover)` alone (authSlice.ts:457-459). `deleteAccountData` cancels pending date reminders but does not remove delivered ones, so delivered pushes and reminders stay for the incoming account on those paths. This predates DW-352, and the owner's decision covers sign-out only. Reachability is unverified: a device normally goes through signed out, which now runs the removal. The fix would be a removal call on those paths (not the APNs unregister, which would race `startPushRegistration`), plus a decision that a switch should empty Notification Center too.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-account-switch-clears-delivered
resolution-undo: 92e0c22e3cba748ed6298bc6f8c758ca82890213e08ffd6f0f26614b21af443f 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 switch-clears-too — owner, 2026-11-02: any account switch empties the app's delivered notifications from Notification Center, as sign-out does (DW-352): add the delivered-notification removal on the in-place switch and the fresh-sign-in leftover paths, without the APNs unregister, which would race startPushRegistration.

### DW-409: PartnerMoodView.kit.test.tsx "enables refresh when online" failed once under the full unit suite with the refresh button still `aria-busy` and disabled, and passed on 3 isolated reruns and 2 later
origin: spec-deferred 5bd4d01176e8
location: src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx:166
source_spec: `plan-dw-sign-out-clears-notifications.md`
severity: low
reason: First `npm run test:unit` of this run: 1 failed of 3759, `expect(element).toBeEnabled()` at src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx:166, with the button rendered `aria-busy="true" disabled`. `findByTestId` resolves on presence, not enablement, so an in-flight refresh still busy under load fails it. Unrelated to this change, which touches no PartnerMoodView code. Settle by asserting through `waitFor(() => expect(...).toBeEnabled())` after confirming what keeps it busy.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-partner-mood-refresh-test-flake
resolution-undo: 4e6874687b678d5b27c3d7d79dc252b4e1195449554a010f7c0cbdc6540fa67a 2026-11-02 7374617475733a206f70656e

### DW-410: The pinned esm.sh supabase-js 2.118.0 bundle still floats one transitive dependency: storage-js 2.118.0 imports iceberg-js through the range ^0.8.1.
origin: spec-deferred 3f3158bf60a9
location: supabase/functions/send-push/index.ts:19; supabase/functions/upload-love-note-image/index.ts:22
source_spec: `plan-dw-pin-edge-supabase-js.md`
severity: medium
reason: package-lock.json declares @supabase/storage-js 2.118.0 dependency "iceberg-js": "^0.8.1" (every other sub-package dependency is exact: tslib 2.8.1, @supabase/phoenix 0.4.5). esm.sh's built https://esm.sh/@supabase/storage-js@2.118.0/es2022/storage-js.mjs imports "/iceberg-js@^0.8.1?target=es2022", a range esm.sh resolves per request, so a new iceberg-js 0.8.x can reach both Edge Functions on the next deploy with no reviewed change. Pre-existing and outside the owner's 2026-11-02 decision, which pins supabase-js only. A fix would add ?deps=iceberg-js@0.8.1 to both import URLs (or vendor the import), which needs an owner call.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-edge-pin-iceberg-js
resolution-undo: 3e3cad4e23563016d63b082448d5ee7a9cc230415fc6fd9d1dcd33e84bbd304e 2026-11-02 7374617475733a206f70656e
decision: 2026-11-02 pin-iceberg — owner, 2026-11-02: pin iceberg-js to 0.8.1 exactly by adding `deps=iceberg-js@0.8.1` to both Edge Function supabase-js import URLs (send-push, upload-love-note-image), finishing the DW-355 pin.

### DW-411: After a stale-session boot the Mood screen never mounts the partner card, so a later renewal cannot bring it back until the screen is re-entered; the usePartnerMood realtime-lost error is therefore
origin: spec-deferred 22a6050e1943
location: src/components/MoodTracker/MoodTracker.tsx (loadPartnerId effect)
source_spec: `plan-dw-realtime-recovery-after-renewal.md`
severity: low
reason: MoodTracker looks its partner up through lookupPartnerId on mount and again only when store.partner.id changes; on a boot whose stored session the SDK cannot use that lookup fails and nothing re-runs it on TOKEN_REFRESHED. Observed in tests/e2e/partner/realtime-recovery-after-renewal.spec.ts on the local stack: no card and no error card after TOKEN_REFRESHED; Home then Mood mounts it.
status: done 2026-11-02
resolution: resolved by sweep bundle dw-mood-partner-lookup-on-renewal
resolution-undo: 1fef8da71dc9785856aad71f8c8803d5481f487b98c3027a7d1736d3769aa159 2026-11-02 7374617475733a206f70656e

### DW-412: A register_push_device call that lands between unregister_all_push_devices() and the global sign-out still has a live session, so the session check accepts it and its push_devices row outlives "Sign
origin: spec-deferred 716063194f07
location: supabase/migrations/20261102010000_register_push_device_session_check.sql (register_push_device); src/api/auth/actionService.ts (signOut, everywhere)
source_spec: `plan-dw-push-register-session-check.md`
severity: medium
reason: src/api/auth/actionService.ts signOut({ everywhere }) awaits removeAllPushRegistrations() before supabase.auth.signOut({ scope: 'global' }). In that window the other device's auth.sessions row still exists, so the new check in 20261102010000 passes and the insert commits; the later session delete does not touch push_devices, and send-push reads only push_devices. The 2026-11-02 owner decision expected the session check to cover this window, but it closes only registrations after the sign-out. Closing the window needs new state, for example an account-level fence written by unregister_all_push_devices() that refuses sessions created before it, or the registering session id stored on each push_devices row and checked or pruned by send-push. Either needs an owner decision, because the intent limited this change to replacing the function.
status: done 2026-11-02
resolution: owner, 2026-11-02: fix it. "Sign out of all devices" now signs out with scope=global first and calls unregister_all_push_devices() after it, sending the access token read before the sign-out (src/api/auth/actionService.ts signOut, src/services/pushNotifications.ts removeAllPushRegistrations). A registration before the sign-out is removed by that call, and one after it is refused by DW-406's session check, so no row outlives the sign-out. No new state.

### DW-413: On an account switch without a sign-out, a love-note push sent to the outgoing account between the Notification Center clear and the incoming account's `register_push_device` still lands, so it stays
origin: spec-deferred 3168721c2825
location: src/stores/slices/authSlice.ts (clearDeliveredForSwitch callers); src/services/pushNotifications.ts (recordDevice)
source_spec: `plan-dw-account-switch-clears-delivered.md`
severity: low
reason: On the in-place switch and the fresh-sign-in leftover paths nothing deletes this device's `push_devices` row first (only `actionService.signOut` calls `removePushRegistration`, src/api/auth/actionService.ts:100). The token moves to the incoming account only when `register_push_device` upserts it (supabase/migrations/20261102010000_register_push_device_session_check.sql:64-69), after App.tsx's effect re-runs `startPushRegistration()`, APNs answers and `recordDevice` sends the RPC. That is normally seconds. If the RPC fails, `recordDevice` only logs it (src/services/pushNotifications.ts:216-218), and the token stays with the outgoing account until the next signed-in start or the 12-hour foreground renewal. The gap predates DW-408, and the intent rules out the APNs unregister on these paths. Options: a second `clearDeliveredNotifications()` once `recordDevice` succeeds after a switch, or have the switch delete the outgoing row server-side while the outgoing session still exists, which the
status: done 2026-11-02
resolution: owner, 2026-11-02: fix it on PR #444. An account switch's Notification Center clear now passes untilReregistered (src/stores/slices/authSlice.ts clearDeliveredForSwitch), which saves a device flag holding an id unique to that switch (localStorage my-love-push-clear-after-record); the next successful register_push_device record, which moves this device's row to the incoming account, clears Notification Center and the badge once more and drops the flag (src/services/pushNotifications.ts recordDevice). A refused record keeps the flag: every return to the foreground then records again instead of once every 12 hours, and a restart's record still clears because the flag is on disk. A record clears only when the id it read before its request is still the saved one, so a record sent before a switch, including the previous account's still in flight during a second switch, cannot take that switch's clear. Any other clear, sign-out's included, drops the flag. Left as it is: while the app stays open after a refused record, nothing retries until the next return or start.

### DW-414: sim center's one-screen check counts every app's notifications, so another app's pile fails a read and the message blames the app read.
origin: raised 2026-11-02 by the DW-407 simulator check (owner-run session)
location: scripts/sim-driver/RunnerUITests/Notify.swift (center, cellFrames)
severity: low
reason: `cellFrames()` collects every ListCell in Notification Center's combined list, whichever app it belongs to, and the drag and swipe checks compare those. After DW-344's 20 cold taps left 20 Runner notifications, `sim center` for the shell failed with "Notification Center holds more My Love notifications than fit on one screen … (12 cells before, 12 after)" though the shell had none; once the Runner's notifications were wiped (`sim permission reset --host`), the same read gave {"groups":[]}. So any app's leftover notifications block a read, and the message names the wrong app. Options: say "more notifications than fit" without the app's name, or clear other apps first; filtering by app does not work, since an overfull list hides the app's own cells too. Separately, on the iPhone 17 a fresh read with 3 Runner notifications failed the drag check before 646facdf; not re-run after it, so whether center reads on the iPhone 17 at all is unchecked.
status: done 2026-11-02
resolution: the overfull message now says what the check measures and whose cells are there: "Notification Center holds more notifications, from every app together, than fit on one screen … (13 cells before, 14 after; by app: RUNNER 14)" (Notify.swift cellsByApp), and `sim help center` says every app counts and that the runner's go with `permission reset --host`. Checked on the Duo simulator 2026-11-02: 14 Runner notifications with the shell signed out gave that message; after `permission reset --host` the same read gave {"groups":[]}. The iPhone 17 read stays unchecked.

### DW-415: sim signout fails whenever the shell shows its welcome screen.
origin: raised 2026-11-02 by the DW-407 simulator check (owner-run session)
location: scripts/sim-driver/RunnerUITests/Drive.swift (signout); scripts/sim-driver/sim (cmd_signout)
severity: low
reason: `sim signin` dismisses the welcome splash, but the shell shows it again when it opens an hour or more after it last showed (after a clock move, say), and `sim signout` then fails with "no Settings button: signed out already, or the page did not load" (Drive.swift:133), because the splash covers the dock. Tapping the splash's Continue (found with `sim dump`, tapped with `sim tap`) let `sim signout` pass. A check that restarts the simulator before signing out (any clock change does) fails at sign-out. Fix by having signout dismiss the splash the way signin does.
status: done 2026-11-02
resolution: `sim signout` now gets past the splash as `sim signin` does (Drive.swift pastWelcome, shared by both). The splash shows when the app opens an hour or more after it last showed (App.tsx WELCOME_DISPLAY_INTERVAL), not after every restart: the clock moves made that happen. Checked on the Duo simulator 2026-11-02 by setting the shell's lastWelcomeView to 0 while it was closed: the splash showed, and `sim signout` printed "dismissed the welcome splash" and "signed out" (18 s).

### DW-416: Remove the push sent to a partner when a date is added or changed.
origin: owner decision 2026-11-02 during the Settings rework UX run (_bmad-output/initiative-my-love/ux-settings-page/.memlog.md, override entry)
location: supabase/migrations/20261031030000_push_date_changes.sql (notify_date_change, five triggers, date_changes, push_requests.date_change_id); supabase/functions/send-push (the 'date' kind in handler.ts and payload.ts, handler.test.ts); src/services/pushPreferencesService.ts and src/stores/slices/settingsSlice.ts (the 'dates' push preference); src/components/Settings/PushSettings.tsx (the Dates switch); supabase/tests/database/35_push_devices.sql
severity: medium
reason: The owner wants no notification when an event, the wedding date, together-since or a birthday is added or changed; the only date notifications should be epic-date-reminders' upcoming-date reminders. This reverses the date part of epic-push-notifications R1 (owner request 2026-10-29, story 3.5). The rework's Notifications page drops the Dates switch, and with tap-a-row-to-edit each field save would otherwise send its own push. Needs a new migration that drops the triggers and function (and decides whether date_changes and the push_preferences.dates column go), the send-push date kind removed, and the pgTAP pins updated in the same change. Not a sweep bundle: it belongs with the Settings rework's tickets.
status: done 2026-11-04
decision: 2026-11-02 remove — owner, 2026-11-02: "I don't want a notification at all to be pushed when something is added or changed. The only notifications that come from dates should be from like when the date is upcoming."
progress: 2026-11-03 story 5.4 removed the triggers, `notify_date_change()`, `date_changes`, `push_requests.date_change_id`, send-push's `date` kind and the client's use of `dates` (migration `20261103000000_remove_date_change_push.sql`). `push_preferences.dates` and its `36_push_preferences.sql` pins remain for story 18, because installed shells still select and upsert it.
resolution: story 5.18's migration `20261104000000_drop_push_preferences_dates.sql` dropped `push_preferences.dates`, the last part of the date push; the pgTAP pins (`35_push_devices.sql` PUSH-DB-063, `36_push_preferences.sql`) assert its absence and `database.types.ts` was regenerated without it.
progress: 2026-11-05 the "added" half is reversed by owner decision ("I just want notifications for when a date is added, either an event or anniversary"): migration `20261105010000_push_added_dates.sql` adds AFTER INSERT `notify_push` triggers on `events` and `anniversaries`, `push_requests.event_id`/`anniversary_id` and `push_preferences.dates` back; send-push has `event` and `anniversary` kinds and the Notifications page a Dates switch. A change to any date still sends no push. The 2026-11-02 answer that led here (session a81de247) was a typed reply to a question about edit bursts; the option "Push only on new dates" was offered then.

### DW-417: `npm run test:ci-local` skips the send-push Edge Function tests that CI runs.
origin: bmad-project-context refresh, 2026-11-02
location: scripts/ci-local.sh:50; .github/workflows/test.yml:208-209
severity: low
reason: CI runs `deno test --no-lock` on both `supabase/functions/upload-love-note-image/` and `supabase/functions/send-push/` (the second added with 08e8b562), but `scripts/ci-local.sh` still runs only the first, so a local CI pass says nothing about send-push. AGENTS.md's Deno line states the gap until it is fixed; drop that clause in the same change. Triage 2026-11-04: still present (`scripts/ci-local.sh:50-51`); send-push's 89 tests pass run the CI way, with no env or `--allow-*` flags. Outside the loop: one sitting adds send-push to ci-local and drops the `AGENTS.md:42` clause together, since a loop review would refile the AGENTS.md half.
status: done 2026-11-04
resolution: `scripts/ci-local.sh` now runs `deno test --no-lock supabase/functions/send-push/` after the upload-handler tests, as `test.yml` does (89 passed), and AGENTS.md's Deno line no longer says `test:ci-local` runs only the first.
decision: 2026-11-04 outside-the-loop — done in the owner's docs sitting together with the AGENTS.md:42 clause.

### DW-418: Enforce the eslint-disable reason rule with a lint rule.
origin: bmad-project-context refresh, 2026-11-02
location: eslint.config.js; package.json (devDependencies); AGENTS.md (Known pitfalls, eslint-disable line)
severity: low
reason: AGENTS.md requires every `eslint-disable` directive to carry its reason after ` -- ` and says no lint rule enforces it; `eslint.config.js` sets only `reportUnusedDisableDirectives`. `@eslint-community/eslint-plugin-eslint-comments`' `require-description` would fail a directive without one (all 18 current directives comply). Needs the owner's yes for the new devDependency; once the rule is live, the AGENTS.md line goes. Triage 2026-11-04: there are 15 directives, not 18 (14 `eslint-disable-next-line`, 1 block `eslint-disable`), all with a ` -- ` reason; the plugin (4.8.1) supports ESLint 10 and flat config and is not installed yet.
status: done 2026-11-04
resolution: added `@eslint-community/eslint-plugin-eslint-comments` 4.8.1 as a devDependency; `eslint.config.js` sets `require-description` to error for the disable directives (all 15 in the tree pass, and a probe directive without ` -- ` fails), and AGENTS.md's eslint-disable line no longer says no lint rule enforces it.
decision: 2026-11-04 add-plugin — the owner approved `@eslint-community/eslint-plugin-eslint-comments` with `require-description` as a devDependency; done outside the loop in the owner's docs sitting, which also drops the AGENTS.md:91 clause.

### DW-419: The Settings page stack's column-dock form has no end-to-end check.
origin: story 5.1 review (epic-settings-rework), 2026-11-02
location: tests/e2e/settings/settings-stack.spec.ts; src/components/Settings/stack/SettingsStack.tsx (top-page back arrow); src/hooks/useSideColumn.ts
severity: low
reason: The column form (iPhone Duo capsule) is chosen from `env(safe-area-inset-left/right)`, which a desktop Playwright browser cannot set, so the stack's column-form behaviour (no top-page back arrow, a subpage arrow, bar and cards ending at the column's edge) is proven only by unit tests that mock `useSideColumn`. The same holds for every column-form feature. Close it with a sim-driver check on the Duo simulator, or by the ship story's hand run of the Key Flows on the owner's Duo.
status: done 2026-11-04
resolution: sim-driver check on the iPhone Duo simulator, 2026-11-04, shell built from main `210442c0`: folded portrait (capsule on the right, x 404-444 of 466) and folded landscapeLeft (capsule on the left, x 22-62 of 678). In both, the Settings top page has no back arrow, Profile has one, and the bar and cards stop 16pt short of the 84pt column (right form: content ends at 366, column starts at 382; left form: Back starts at 94 and cards at 113, column ends at 84).

### DW-420: No test pins that sign-out keeps the device's photo-download choice.
origin: story 5.1 review (epic-settings-rework), 2026-11-02
location: src/stores/slices/authSlice.ts (deleteAccountData); src/services/photoDownloadPreference.ts (PHOTOS_OVER_MOBILE_DATA_KEY)
severity: low
reason: Epic-settings-rework R12 says the Photos choice survives sign-out, and AGENTS.md says sign-out must not reset it, but no unit or E2E test signs out and then reads `my-love-photos-over-mobile-data`. A future addition to `deleteAccountData()` that clears localStorage wholesale would pass every suite. Add an assertion to the sign-out clearing tests (`signOutClearsAccountState.test.ts`) that the key keeps its value.
status: done 2026-11-03
resolution: story 5.16 added two sign-out tests in signOutClearsAccountState.test.ts: with `my-love-photos-over-mobile-data` at `'true'`, `clearAuth()` and a no-session boot with the owner marker both delete the outgoing account's data and leave the key at `'true'`.

### DW-421: The Settings page stack's column-dock form has no end-to-end check (ledger DW-419).
origin: spec-deferred b9cb78c93e32
location: tests/e2e/settings/settings-stack.spec.ts
source_spec: `tickets/epic-settings-rework/tickets/story-settings-opens-as-a-stack-of-pages-with-the-new-top-page-plan.md`
severity: low
reason: The column form is chosen from env(safe-area-inset-*), which desktop Playwright cannot set; settings-stack.spec.ts runs the bottom dock only and SettingsStack.test.tsx mocks useSideColumn. Pre-existing limitation shared by every column-form feature.
status: done 2026-11-03
resolution: duplicate of DW-419 (the same gap, filed twice by story 5.1); tracked there.

### DW-422: No test pins that sign-out keeps the device's photo-download choice (ledger DW-420).
origin: spec-deferred ab598e369099
location: src/stores/slices/authSlice.ts (deleteAccountData)
source_spec: `tickets/epic-settings-rework/tickets/story-settings-opens-as-a-stack-of-pages-with-the-new-top-page-plan.md`
severity: low
reason: grep finds my-love-photos-over-mobile-data only in photoDownloadPreference.test.ts and this story's tests; none signs out first. Behaviour unchanged by this story.
status: done 2026-11-03
resolution: duplicate of DW-420 (the same gap, filed twice by story 5.1); tracked there.

### DW-423: Nothing ties a subpage row's visibility to its page's `available`, and the AGENTS.md subpage rule does not say to gate the row.
origin: spec-deferred 445948d64bee
location: AGENTS.md (Where things are, Settings subpage rule); src/components/Settings/Settings.tsx (SUBPAGES)
source_spec: `tickets/epic-settings-rework/tickets/story-settings-opens-as-a-stack-of-pages-with-the-new-top-page-plan.md`
severity: low
reason: The Photos row checks canTellMobileData() by hand (Settings.tsx, Preferences group) while its page is gated by `available: canTellMobileData` in SUBPAGES. A later subpage with `available` whose row is not gated shows a row that pushes /settings/<page>, then the stack's redirect replaces that entry with /settings, leaving two top-page entries and one extra Back. The fix is a sentence in the AGENTS.md "Settings subpage" rule (gate the row on the same check), or deriving row visibility from the spec.
status: done 2026-11-03
resolution: story 5.16 added `subpageAvailable(path)` in Settings.tsx, which reads `available` from `SUBPAGES`; the Notifications and Photos rows are gated with it, and the AGENTS.md subpage rule now says to gate such a row that way.

### DW-424: After a live update, the native edge swipe on the first page may reload the app instead of doing nothing.
origin: investigation (spike 5.2, 2026-11-02)
location: ios/App/App/NativeAuth.swift (MainViewController); src/services/nativeUpdates.ts
source_spec: `tickets/epic-settings-rework/tickets/spike-find-how-the-edge-swipe-returns-one-level-in-the-shell-plan.md`
severity: medium (unverified)
reason: Spike 5.2 chose WKWebView's back-forward gesture, which follows the web view's whole back list, not only this document's pushState entries. The live updater loads each new bundle as a new document, so the old document's entries may stay in that list, and a swipe on the first page after an update would then navigate to the old bundle's URL. The trial never applied an update. Story 15 settles it with `sim build --update-port` and `sim serve-update`: apply an update, then `sim swipe back` on the first page; if the page reloads, cancel cross-document back navigations in the shell.
status: done 2026-11-03
resolution: confirmed, then fixed in story 5.15. On the Duo simulator with the gesture alone, Settings → Profile, Refresh in the update toast, then a swipe on the new Home opened the old bundle's Profile. The updater's swap is `webView.load` of the server URL (`CapacitorUpdater.applyCurrentBundleToBridge`), which keeps the old document's entries. `MainViewController` (ios/App/App/NativeAuth.swift) now records the entry that was current when each main-frame `.other` load of an app URL starts (the launch load and every bundle swap, seen through `.capacitorDecidePolicyForNavigationAction`). It turns the gesture off while the back item is that entry or a load is still running, and re-decides on `url`, `canGoBack` and `isLoading`. A reload records nothing, so back across one still works. Rather than cancelling cross-document back navigations, it does not offer the swipe there: cancelling would also block the in-app back arrow after a reload. Checked on the simulator: after an update, 16 pans on the new Home did nothing, and pages pushed in the new bundle swiped back one level each. Re-checked on 2026-11-04 after the shell's own swipe replaced WebKit's (`e1ba2117`) and after `69dfb58c`. The run used the iPhone Duo simulator folded with the column dock, a shell built from main `49006f72`, and `sim serve-update`. With the update applied on Profile, 8 swipes on the new Home did nothing, Profile → Settings → Home went back one level per swipe, and a swipe on Home did nothing. With the update applied on Home (the `69dfb58c` case), the same: 8 swipes on the new Home did nothing, Profile → Settings → Home went back one level per swipe, and a swipe on Home did nothing.

### DW-425: Three native edge-swipe cases no device has checked: the first entry, the column on the left edge, and Home's message card.
origin: review (spike 5.2, 2026-11-02)
location: ios/App/App/NativeAuth.swift (MainViewController); src/components/DailyMessage/DailyMessage.tsx (drag="x"); src/hooks/useSideColumn.ts
source_spec: `tickets/epic-settings-rework/tickets/spike-find-how-the-edge-swipe-returns-one-level-in-the-shell-plan.md`
severity: medium (unverified)
reason: The Duo trial covered Settings pushes and dock views in the bottom dock and folded with the column, side not recorded. The simulator's first-entry result rests on synthesized pans that register about one time in four. Unchecked: (1) a real swipe on the session's first entry stays on the page; (2) with the column on the left edge (one folded landscape, the left pane side by side) the swipe still goes back and the capsule still taps; (3) an edge swipe that starts over Home's message card, which turns to the next message on a right drag, goes back without also turning the card. Story 15 checks all three by hand on the Duo once the Swift line is in.
progress: 2026-11-04 Duo simulator, shell built from main `210442c0` (after story 15's `isLoading` patch, which its plan says was not re-run for cases 2 and 3): (1) on Home, the first entry after a fresh launch, `sim swipe back` exited 1 after 8 pans and Home stayed; (2) folded landscapeLeft with the capsule on the left, Settings > Profile, the swipe returned to Settings in one level (registered on the second pan) and each of the six capsule buttons opened its view; (3) the case as written no longer arises: the dock's Home now walks back to the first history entry (AGENTS.md, Home is the bottom of the history), so a swipe on Home has nothing to go back to and 8 pans starting over the message card left Home showing and the card on the same message. Still owed under a real finger on the Duo: cases 1 and 2, and whether a real edge swipe over the card on Home turns it; these are story 15's plan `operator_actions`.
status: done 2026-11-04
resolution: the owner ran cases 1 and 2 on the iPhone Duo with a real finger on 2026-11-04 and both passed: a swipe on Home, the first entry after a launch, stayed put; with the capsule on the left edge, Settings > Profile went back one level to Settings and every capsule button opened its view. Case 3 as written no longer arises (the dock's Home walks back to the first history entry, so a swipe on Home has nothing to go back to); on the simulator, 8 edge pans over the message card left it on the same message, and no real-finger result for the card was reported.

### DW-426: The anniversaries mirror still sits inside the persisted `settings` object that `settingsSlice` owns, though `datesSlice` now writes it.
origin: spec-deferred (story 5.3, 2026-11-03)
location: src/stores/slices/datesSlice.ts (withAnniversaries and the anniversary actions); src/stores/slices/settingsSlice.ts (`settings`); src/stores/useAppStore.ts (`partialize`, `getItem` blanking); src/stores/slices/authSlice.ts (`discardAccountState`)
source_spec: `tickets/epic-settings-rework/tickets/story-settings-state-splits-into-dates-profile-and-notifications-s-plan.md`
severity: low
reason: Story 5.3 moved the anniversaries kind, reader, refresher and actions into `datesSlice` but left the in-memory list at `settings.relationship.anniversaries`. Giving it a field of its own would change `partialize`, the `getItem` blanking, `discardAccountState` and every test that reads the mirror, which a code-moving refactor that changes only import paths rules out. Until then one slice writes a field inside another slice's persisted object.
status: done 2026-11-04
resolution: closed at the owner's decision: the list is never persisted (`partialize` saves `[]`, `getItem` blanks it, useAppStore.ts:222-232, 269-279) and no user sees a difference, while a move runs through the sign-out state code; `Settings` now holds only this list and `setSettings`/`updateSettings` have no callers outside their slice, so if the cleanup is ever wanted, remove the whole `settings` object rather than move the list.
decision: 2026-11-04 close — not worth touching the sign-out state code for an invisible change.

### DW-427: `DisplayNameSetup`'s `edit` mode, `onCancel` and `initialName` are unused, and its name rules duplicate `profileService.saveDisplayName`.
origin: spec-deferred (story 5.7, 2026-11-03)
location: src/components/DisplayNameSetup/DisplayNameSetup.tsx; src/services/profileService.ts (`saveDisplayName`); src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx
source_spec: `tickets/epic-settings-rework/tickets/story-profile-edits-name-and-birthday-on-one-field-pages-plan.md`
severity: low
reason: Story 5.7 moved the Settings name edit onto the Name page, which writes through `profileSlice.setDisplayName` and `profileService.saveDisplayName`. The signup gate in `App.tsx` is the only caller left, and it passes neither `initialName` nor `onCancel` and stays in `setup` mode, so the `edit` copy, the Cancel control, the Escape handler and the `initialName` prop are dead code. The gate also still holds its own copy of the 3-30 length rule, the account-email and `Unknown` refusals and the `users` update, now the same as `saveDisplayName`'s. The story's "Never" list kept `DisplayNameSetup` and the gate unchanged. The sweep (story 16) removes the dead props and mode, then either points the gate at `setDisplayName` or leaves it with a comment naming `saveDisplayName` as the twin.
status: done 2026-11-03
resolution: story 5.16 removed `initialName`, `onCancel`, `mode`, the Escape handler and the Cancel row from `DisplayNameSetup`, with their tests; the gate keeps its own name rules, and its header now names `profileService.saveDisplayName` as their twin.

### DW-428: `PartnerMoodView` shows the Connect UI for one render before `loadPartner` raises `isLoadingPartner`, because it cannot tell "unanswered" from "unlinked".
origin: spec-deferred (story 5.8, 2026-11-03)
location: src/components/PartnerMoodView/PartnerMoodView.tsx (the `!partner && !isLoadingPartner && !partnerLoadError` branch); src/stores/slices/partnerSlice.ts (`loadPartner`, `partnerKnown`)
source_spec: `tickets/epic-settings-rework/tickets/story-partner-page-shows-who-you-are-linked-to-plan.md`
severity: low
reason: The view renders the Connect UI whenever `partner` is null, no load is running and no error is set; on first open that holds for the render before `loadPartner` sets `isLoadingPartner`. Story 5.8 added `partnerKnown` to `partnerSlice` (true only once a saved copy or a server answer is applied), which separates the two states, but its "Never" list left the Partner view's behaviour unchanged. Gating the Connect UI on `partnerKnown` (and showing the loading state until then) removes the flash; check `PartnerMoodView.*.test.tsx`, which mock the store wholesale and would need the field.
status: done 2026-11-03
resolution: false premise: PartnerMoodView.tsx:123-125 calls loadPartner from a useLayoutEffect, and partnerSlice.ts:168 sets isLoadingPartner before its first await, so the first render is replaced before the browser paints and the Connect UI never shows over a linked user (771a93b7). Closed at the owner's request.

### DW-429: `partnerService.getPartner` still selects `users.updated_at`, now unused.
origin: spec-deferred (story 5.8, 2026-11-03)
location: src/api/partnerService.ts:116 (`getPartner`, `select('partner_id, updated_at')`); tests/e2e/partner/partner-connect.spec.ts:60 (the one route matching `%2Cupdated_at`); tests/unit/api/partnerServiceDisplayName.test.ts:357
source_spec: `tickets/epic-settings-rework/tickets/story-partner-page-shows-who-you-are-linked-to-plan.md`
severity: low
reason: The link date moved to the accepted `partner_requests` row (`PartnerInfo.linkedSince`), so nothing reads `updated_at` from the first `users` read any more. It stays in the select because E2E routes match the URL `select=partner_id%2Cupdated_at`, and the story's "Never" list forbade changing the `users` read columns. A later change drops the column from the select together with those routes and the fixtures that fulfil `updated_at`. Triage 2026-11-04: `needs-a-connection.spec.ts` does not depend on the column; `partner-connect.spec.ts:60` is the only route that matches `%2Cupdated_at`, and without the column the Partner lookup's URL is the same as `lookupPartnerId`'s, so that spec needs another signal to wait on. The 11 fixtures that return `updated_at` are harmless after the drop; `partnerServiceDisplayName.test.ts:357` then tests nothing and changes or goes.
status: done 2026-11-04
resolution: resolved by sweep bundle dw-partner-lookup-drop-updated-at
resolution-undo: 8308f83db6e5b35a306d1b0a75cb3a3ed5018f44d31442e24e30013160d3ab0d 2026-11-04 7374617475733a206f70656e

### DW-430: An event's Icon row shows a text value and its Icon page uses check rows, where DESIGN.md asks for the glyph and the Form page's three-tile picker.
origin: story 5.11 build (epic-settings-rework), 2026-11-03
location: src/components/Settings/EventPages.tsx (EventPage Icon row, EventFieldPage `icon`)
severity: low
reason: DESIGN.md (Components, List row) says "An Icon field row shows the event's glyph in accent in place of a text value", and (One-field edit page) "The icon field is the three-option picker used on the Form page": three equal 48px tiles, glyph and name, the selected one tint-filled with an accent label and 2px accent ring. Story 5.11's plan specified the text value (`Calendar`/`Ring`/`Plane`) and check rows instead, so R18 is not met for the Icon row and page. Story 5.13 builds the Form page's picker; reuse it on the Icon page there and give `SettingsRow` a glyph value for the Icon row.
status: done 2026-11-03
resolution: fixed at the owner's request: the event's Icon row shows its glyph in accent in place of the text value (`SettingsRow` `valueIcon`), as a partner's read-only Icon row does (`ReadOnlyRow` `valueIcon`, the name kept as hidden text), and the Icon page is `IconPicker`, the New event form's three tiles, moved into EventPages.tsx beside `ICON_OPTIONS`.

### DW-431: An event's Icon row shows a text value and its Icon page uses check rows, where DESIGN.md asks for the glyph and the Form page's three-tile picker (ledger DW-430).
origin: spec-deferred 6be699f2d039
location: src/components/Settings/EventPages.tsx
source_spec: `tickets/epic-settings-rework/tickets/story-every-event-has-its-own-page-plan.md`
severity: low
reason: DESIGN.md Components: "An Icon field row shows the event's glyph in accent in place of a text value" and "The icon field is the three-option picker used on the Form page". This plan's matrix specified text values and check rows; the implementer flagged the mismatch. Story 5.13 builds the picker.
status: done 2026-11-03
resolution: duplicate of DW-430 (the same finding, filed twice by story 5.11); fixed with it.

### DW-432: No E2E axe coverage of the new Settings pages since `events-accessibility` was deleted.
origin: story 5.13 build (epic-settings-rework), 2026-11-03
location: tests/e2e/settings/ (deleted `events-accessibility.spec.ts`); tests/unit/a11y/whiteOnColorContrast.test.ts (header)
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
reason: `@axe-core/playwright` ran in exactly one spec, which scanned the events modal and form that the Countdowns section drew. That section is gone, so the spec was deleted, and nothing scans the Settings stack pages (the top page, the Dates list, the date and event pages, the Form pages and the Kind chooser). The plan forbids new axe scans in this story (the owner and partner use no screen reader or keyboard), so the gap is recorded rather than filled; whether a scan is wanted at all is a decision for the owner. The `@axe-core/playwright` dependency (and its `axe-core`) was removed with the spec, since nothing else used it; it comes back if a scan is wanted.
progress: 2026-11-04 the epic-settings-rework retrospective's diff review found the same gap again (its V6). No new entry was filed.
status: done 2026-11-04
resolution: merged into DW-451: a contrast-only axe scan of the same Settings pages rides with the Touch Floor and token spec.
decision: 2026-11-04 merge-into-DW-451 — axe limited to the `color-contrast` rule.

### DW-433: `reminderDateEntries` has no production caller now that `CountdownMarks` is gone.
origin: story 5.13 build (epic-settings-rework), 2026-11-03
location: src/services/dateReminders.ts (`reminderDateEntries`), src/services/__tests__/dateReminders.test.ts (`describe('reminderDateEntries')`)
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
reason: `CountdownMarks` was the only production caller of `reminderDateEntries`, which listed the dates a person could mark for the per-date reminder list. Each date's own page now holds its Remind me switch (`RemindMe`), so the function and its unit tests are dead code. A later change deletes it with its tests, after a check that `planReminders` and its doc comments no longer lean on it.
status: done 2026-11-03
resolution: story 5.16 deleted `reminderDateEntries` and `ReminderDateItem.name` with their tests; the planner's all-marks check is kept as a `planDateReminders` case.

### DW-434: Returning to the Dates list reloads its first window, so rows reached through `Load more`, or a date just added beyond that window, drop out of the list.
origin: story 5.13 build (epic-settings-rework), 2026-11-03
location: src/components/Settings/DatesPage.tsx (the mount effect calling `loadEvents()`); src/components/Settings/stack/SettingsStack.tsx (one page in the DOM, keyed by path, so a pop remounts the page)
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
reason: The Dates list loads events on every mount, and a back from an event page or a Form page remounts it, so the store's paged window is replaced by the server's first page. Since story 5.9 this drops every row reached through `Load more`. Since story 5.13 it also drops a past date added beyond the first window: it shows on the list after Add and vanishes when the reload answers. `events-history-pagination.spec.ts` waits for that reload and pages to the row. A fix keeps the loaded window across a return (for example, load only on a push or a fresh mount, not on a pop), as `EventPage` already skips its load when it holds its event.
status: done 2026-11-03
resolution: fixed at the owner's request: coming back to the Dates list (`arrivedBack`, a pop, from `SettingsPageContext`) no longer reloads its first window while the store holds a server page (`eventsPagination`), so rows reached through `Load more` and a date just added stay listed; a fresh mount, a push and any later connectivity change still load. A refresh skipped while Settings showed (a reconnect on an event page) marks the list stale (`eventsStale`, cleared by the next first page from the server), and a return then loads; a mark set while the list itself shows (the iPhone shell's return to the foreground) loads at once, and a return after the list's own failed load (`eventsError`) loads too. `events-history-pagination.spec.ts` now checks that the return starts no load. A refresh while the list shows still drops `Load more` rows (DW-440).

### DW-435: A date page or New event opened from Home neither slides in nor starts at the top, because the tap mounts the Settings stack fresh.
origin: story 5.14 build (epic-settings-rework), 2026-11-03
location: src/components/Settings/stack/SettingsStack.tsx (`trail`'s initial `direction: null`; the commit effect returns early while `shownPath` is null)
source_spec: `tickets/epic-settings-rework/tickets/story-home-s-date-cards-and-add-button-open-the-date-pages-plan.md`
severity: low
reason: EXPERIENCE.md Flow 1 step 2 says the event page "slides in from the right" when Casey taps the Home card. Settings is not mounted while Home shows, so a Home card or Add mounts `SettingsStack` on the date page. Its first render has no direction, so it gets no slide class, and its commit effect skips the scroll-to-top and title focus that a push within the stack gets. The page appears at once, at Home's scroll position until the shorter page clamps it. Opening Settings from the gear has always behaved the same way. A fix starts `trail` as `push`, and runs the push branch on the first commit, when `settingsPushedPath` equals the mounted path, as story 5.14 already does for the reload check.
status: done 2026-11-03
resolution: fixed at the owner's request: a push that mounts the Settings stack on a subpage (`settingsPushedPath` equals the mounted path) starts as a push, so a date page or New event opened from Home slides in, scrolls to the top and focuses its title. The top page opened from the gear or the dock still appears without a slide, as a view switch does.

### DW-436: A date page or New event opened from Home neither slides in nor starts at the top, because the tap mounts the Settings stack fresh (DW-435).
origin: spec-deferred 70fea21d81f5
location: src/components/Settings/stack/SettingsStack.tsx
source_spec: `tickets/epic-settings-rework/tickets/story-home-s-date-cards-and-add-button-open-the-date-pages-plan.md`
severity: low
reason: SettingsStack's trail starts with direction null and its commit effect returns early while shownPath is null, so a first mount gets no slide class, scroll reset or title focus; EXPERIENCE.md Flow 1 step 2 says the event page slides in.
status: done 2026-11-03
resolution: duplicate of DW-435 (the same finding, filed twice by story 5.14); fixed with it.

### DW-437: DW-425 still names story 15 as the one that checks its three cases by hand on the Duo, and it does not hold this story's simulator results; the ledger reserves that entry's text for the orchestrator.
origin: spec-deferred f577620c7c17
location: _bmad-output/initiative-my-love/deferred-work.md DW-425
source_spec: `tickets/epic-settings-rework/tickets/story-the-edge-swipe-returns-one-level-in-the-shell-plan.md`
severity: low
reason: Story 15 ran the three cases on the Duo simulator: the first entry (exit 1), the column on the left edge (one level, after 17 failed synthesized pans), and Home's message card (one level). It cannot run them under a real finger, and the shell with the Swift line is not on the Duo yet. The hand checks are this plan's operator_actions. The deferred-work.md header leaves another entry's reason to the orchestrator.
status: done 2026-11-04
resolution: DW-425's progress line now holds the 2026-11-04 simulator results for all three cases and names story 15's plan `operator_actions` as the hand checks still owed.

### DW-438: The AGENTS.md Settings subpage rule names `subpageAvailable(path)` for any parent page's row, but the helper is local to `Settings.tsx`, and it overclaims that the row and the page "cannot disagree".
origin: spec-deferred (story 5.16 review, 2026-11-03)
location: AGENTS.md (Where things are, Settings subpage rule); src/components/Settings/Settings.tsx (`subpageAvailable`)
source_spec: `tickets/epic-settings-rework/tickets/story-refactor-sweep-plan.md`
severity: low
reason: Story 5.16 added `subpageAvailable(path)`, a non-exported function in `Settings.tsx`, and an AGENTS.md clause telling a subpage's row on its parent page to use it. Parent pages other than the top page live in their own files (`DatesPage.tsx`, `NotificationsPage.tsx` and others), so a row there cannot follow the rule without exporting the helper. Today only top-page rows have pages with `available`, so nothing is wrong yet. The clause also says the row and page "cannot disagree", but a path missing from `SUBPAGES` counts as available and the path string is separate from the row's `target`; the code comment was corrected in story 5.16, the AGENTS.md wording was not, because the review routes agent-context edits to the orchestrator. Fix: say "a top-page row" (or export the helper) and drop "cannot disagree". Absorbs DW-439 (the same story 5.16 deferral, re-filed by the engine). Triage 2026-11-04: still present (`AGENTS.md:28` says "cannot disagree"; `subpageAvailable` is unexported at `Settings.tsx:312`; only the top page's `notifications` and `photos` have `available`). Replacement clause: "a top-page row whose page has `available` is gated with `subpageAvailable(path)`, which reads that page's own `available` from `SUBPAGES` (the helper is local to `Settings.tsx`, so a row on another parent page needs it exported first, and it counts a path missing from `SUBPAGES` as available and never checks the path against the row's `target`)".
status: done 2026-11-04
resolution: AGENTS.md's Settings subpage rule now carries the recorded replacement clause: it gates a top-page row with `subpageAvailable(path)`, says the helper is local to `Settings.tsx` and must be exported for a row on another parent page, and drops "cannot disagree" for what the helper does not check.
decision: 2026-11-04 outside-the-loop — the owner's docs sitting rewords AGENTS.md:28 with the replacement clause.

### DW-439: The AGENTS.md Settings subpage rule names `subpageAvailable(path)` for any parent page's row, but the helper is local to `Settings.tsx`, and it overclaims that the row and the page "cannot disagree"
origin: spec-deferred d7c5c24911d5
location: AGENTS.md (Where things are, Settings subpage rule)
source_spec: `tickets/epic-settings-rework/tickets/story-refactor-sweep-plan.md`
severity: low
reason: `subpageAvailable` is a non-exported function in src/components/Settings/Settings.tsx; parent pages other than the top page live in their own files, so a row there cannot call it. A path missing from SUBPAGES counts as available. Today only top-page rows have pages with `available`. The fix edits AGENTS.md, which review routes to the orchestrator.
status: done 2026-11-04
resolution: merged into DW-438 (the same finding, filed twice by story 5.16).

### DW-440: A refresh while the Dates list shows, or a return after a refresh was skipped, replaces it with the server's first window, so rows reached through `Load more` drop out until it is tapped again.
origin: settings follow-up fixes on PR #449 (epic-settings-rework), 2026-11-03
location: src/components/Settings/DatesPage.tsx (the connectivity load and the `eventsStale` load); src/stores/slices/eventsSlice.ts (`loadEvents` replaces the list with the first page)
source_spec: `tickets/epic-settings-rework/tickets/story-new-events-and-anniversaries-are-added-from-the-dates-list-plan.md`
severity: low
reason: The list asks the server again on a reconnect, and on the iPhone shell when the app comes back to the foreground (the events refresher marks it `eventsStale`). `loadEvents` answers with the first window only and replaces the list, so the older past dates `Load more` added are hidden until it is tapped again. Nothing is lost on the server. The owner chose an up-to-date list over keeping those rows (2026-11-03). It shows only with more than one window of past dates. A fix re-reads as many windows as were loaded, keeping the cursors' depth. Triage 2026-11-04: the same drop follows a return to the list after a refresh skipped while Settings showed (`DatesPage.tsx:124-128`, the `eventsStale` load). Re-reading as many rows as were loaded keeps the owner's 2026-11-03 choice of an up-to-date list and keeps the rows. It shows only past 50 past or 50 upcoming events (`eventsService.ts:267`). Build with DW-445: both change `eventsSlice`'s paging, `eventsService` and `events-history-pagination.spec.ts`.
status: done 2026-11-04
resolution: resolved by sweep bundle dw-events-paging-keeps-loaded-rows
resolution-undo: e37c31e4934a00a75715488978216525ae72a53a2c0007265b77f8a977cd922a 2026-11-04 7374617475733a206f70656e

### DW-441: The dock's walk back to Home has no way out if the browser never reports the back, which can leave every dock tap doing nothing.
origin: epic-settings-rework retrospective (diff review, findings V1 and V2), 2026-11-04
location: src/stores/slices/navigationSlice.ts (`setView`, the `walkingDown` walk); tests/unit/stores/navigationSlice.settingsStack.test.ts
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: medium
reason: A dock pick above the first history entry sets `walkingDown`, adds a one-shot `popstate` listener and calls `history.go(-depth)`. Only that `popstate` clears `walkingDown`. If it never arrives, every later `setView` just overwrites `pendingView`, so the dock stops working until a reload. That happens when the stored `depth` is larger than the real history, or when the walk crosses a reload such as the live updater's swap. The code path is confirmed; neither trigger has been reproduced. No test covers a second dock tap while a walk is under way: every `setView` test taps once and waits for it to land, so removing either `walkingDown` check fails nothing. Fix: clear the walk on a fallback (a timer, or a `depth` checked against `history.length`) and land the pending view; then test a second tap mid-walk and a walk whose `popstate` never comes. Triage 2026-11-04: `walkingDown` and `pendingView` are module variables (`navigationSlice.ts:72-73`), so any reload, the live updater's swap included, clears them, and that trigger is moot; `history.go()` past the start fires no `popstate`, and neither does a back/forward-cache restore; no normal sequence was found where the stored `depth` exceeds the real history, and any back gesture also frees a stuck walk. Widened: a dock tap just after a reload probably loses the picked view and lands on Home (reasoned from the spec, not run), which the shell meets after iOS kills the page in the background. Fix all three together: reset the walk on `pageshow` with `persisted`, clamp `depth` against `history.length`, and add a timer as the safety net. Test it in a unit test (isolate the module with `vi.resetModules()`, so a stuck walk does not leak into later tests: set a large `depth` with `replaceState`, then tap twice) and in Playwright (the same, plus a reload followed by a dock tap).
status: done 2026-11-04
resolution: resolved by sweep bundle dw-dock-walk-recovery
resolution-undo: 0f35935022d8844b5fb144652561e964626cfcfa86b6a96dda3ba9a24ffcc438 2026-11-04 7374617475733a206f70656e
decision: 2026-11-04 widen, keep medium — severity stays medium until the sweep's new test settles it; the lost pick after a reload is fixed in the same change.

### DW-442: The backlog live-update prompt story still has `hitl: true` and hands its check to a person on the owner's iPhone, though the simulator can run it.
origin: epic-settings-rework retrospective (P1), 2026-11-04
location: _bmad-output/backlog/story-native-shell-live-update-prompt.md (frontmatter `hitl`; Description; the 2026-10-30 risk Decision)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: medium
reason: AGENTS.md (Maintained by hand, hand checks) orders checks Playwright, then the simulator, then a real phone, and forbids `hitl` for a check a machine can run. This story says "A person checks the flow on the owner's iPhone after a deploy" and asks for two deploys in a row on that phone. `sim build --update-port` and `sim serve-update` already apply a downloaded update on the simulator, and the DW-424 re-check of 2026-11-04 used them. Fix: set `hitl: false`, move the check (the toast, Yes applying the update, the next update still arriving by the background swap) to the simulator, and keep a phone step only for something the simulator cannot show, saying why. Triage 2026-11-04: still `hitl: true` (line 9) with the phone check at lines 17 and 100; nothing in it needs a phone (`sim build --update-port`, `sim serve-update`, `sim background` and `sim launch`). `52b71747` already shipped the update toast ("Downloading update…", then a Refresh button), so the story's requirements 1-4 describe a different design, and the refine may close it as superseded.
status: done 2026-11-04
resolution: the backlog story now has `hitl: false`; its Description and the 2026-10-30 risk Decision move the check (the toast, Yes applying the update, the next update still arriving by the background swap) to the Duo simulator through `sim build --update-port`, `sim serve-update`, `sim background` and `sim launch`, with no phone step, since nothing in it needs one. Whether `52b71747`'s shipped toast supersedes the story is left to its refine.
decision: 2026-11-04 po-refine — outside the loop: the PO refines the backlog story (a ticket edit).

### DW-443: The simulator driver tells the reader to run `sudo /bin/date`, which moves the Mac's clock.
origin: epic-settings-rework retrospective (diff review, finding V3), 2026-11-04
location: scripts/sim-driver/README.md:5 (the `sudo /bin/date` and `sim reboot` steps); scripts/sim-driver/sim:97-101 (`sim help`, the `reboot` entry), :832-839 (`cmd_reboot`), :1189 (its dispatch); scripts/sim-driver/RunnerUITests/Notify.swift:464-466 (comment assuming a clock jump)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: high
reason: An iOS simulator has no clock of its own: it reads the Mac's clock. So the README's step, `sudo /bin/date` followed by `sim reboot` so the simulator sees the change, moves the Mac's clock. AGENTS.md forbids changing the date or time on any of the owner's devices, the Mac included, and forbids writing a step that asks for it (corrected on main in `5013b869`, "a simulator has no clock of its own to move"). Moving the iPhone's clock already broke its Watch pairing. Fix: remove the `sudo /bin/date` and `sim reboot` steps from scripts/sim-driver/README.md, and the matching text in `sim help`. Test time-based behaviour three ways instead: fake time in unit tests for the reminder planning; `sim pending` for what the shell has scheduled and when; a notification scheduled a minute or two ahead with `sim watch`, for delivery. History, not templates: these date-reminders files still move a clock, and each now carries a note saying so: `tickets/epic-date-reminders/epic-date-reminders.md` (Done when 1, the 2026-10-30 story 8 decision); its `tickets/tickets.toml` (stories 8 and 5); `story-reminders-fire-at-9-00-and-a-tap-opens-home-plan.md` (`sudo date` on the Mac); `story-date-reminders-ship-to-the-owner-s-iphone-plan.md` (the iPhone's clock, Set Automatically); `plan-dw-375-376-sim-reboot-and-watch.md` (the reboot after a Mac clock jump). Triage 2026-11-04: `cmd_reboot` itself (it prints "the Mac clock reads"), its dispatch and the `Notify.swift` comment carry the same assumption; nothing else calls `sim reboot`, which existed only for the clock jump, so the command goes too. The app's reminders fire only at 9:00, so delivery is proven with a host-app notification scheduled a minute ahead (`sim schedule`, then `sim watch --host`), as AGENTS.md says since `32b748e9`. All five history notes are present (`6014a0a8`). The close supersedes DW-375 and DW-385, which added the reboot step. Build with DW-449 (same script).
status: done 2026-11-04
resolution: removed `sim reboot` (its `sim help` entry, `cmd_reboot` and its dispatch), the README's `sudo /bin/date` and `sim reboot` advice and the clock-jump comment in `Notify.swift`; the README now says a simulator reads the Mac's clock and points time checks at `sim pending` and at `sim schedule` with `sim watch --host`. Supersedes the reboot step DW-375 and DW-385 added.
decision: 2026-11-04 remove-sim-reboot — remove the command, not only its clock advice.

### DW-444: A failed Linked since read fails the whole partner lookup.
origin: epic-settings-rework retrospective (diff review, finding V4), 2026-11-04
location: src/api/partnerService.ts (`getPartner`, the `partner_requests` read)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: `getPartner` returns `{ status: 'error' }` when the accepted-request read for Linked since fails, though the partner's own row loaded. Every reader of `getPartner` then treats the partner as unknown, for one optional date. The strict form may be deliberate: AGENTS.md lets only a successful read overwrite a snapshot. Decide: continue with `linkedSince: null`, or record why the whole lookup must fail.
status: done 2026-11-04
resolution: closed as deliberate: story 5.8's plan (failure table, line 130) specifies `{ status: 'error' }` when the request read fails; the only caller (`partnerSlice.ts:213-223`) then keeps the shown partner and the saved copy, so the error shows only on a device's first load; continuing with `linkedSince: null` would overwrite a saved Linked since, against AGENTS.md's rule that only a successful read overwrites a snapshot.
decision: 2026-11-04 close — the strict lookup is by design.

### DW-445: Reloading the page of an event beyond the first loaded window sends the reader to the Dates list as if the event were deleted.
origin: epic-settings-rework retrospective (diff review, finding V5), 2026-11-04
location: src/components/Settings/EventPages.tsx (the load effect and `useFallBackToDates`)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: On a reload the event page holds no event, so it calls `loadEvents`, which returns the first window only. An older past event reached through `Load more` is not in it, so `answered && event === undefined` falls back to the Dates list. The code path was read but not reproduced. Fix: read the one event by id before falling back. Triage 2026-11-04: lines confirmed (`EventPages.tsx:194-206`, the fallback at 206); `eventsService` has no read by id, so the fix adds one. Anniversaries are read unpaged (`anniversariesService.ts:62-77`) and the other date pages fall back on couple or partner data, so only event pages are affected. Build with DW-440.
status: done 2026-11-04
resolution: resolved by sweep bundle dw-events-paging-keeps-loaded-rows
resolution-undo: e37c31e4934a00a75715488978216525ae72a53a2c0007265b77f8a977cd922a 2026-11-04 7374617475733a206f70656e

### DW-446: No check has scheduled a reminder through a date page's Remind me switch.
origin: epic-settings-rework retrospective (S3), 2026-11-04
location: src/components/Settings/RemindMe.tsx; scripts/sim-driver (`sim pending`)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: Stories 5.10 to 5.12's verify lines ask for Remind me to schedule the month and week reminders on the simulator, and each plan lists that as not run. Flow 2 on the simulator checked the footnote and that the setting survived a relaunch, not what was scheduled. Fix: on the simulator, turn on Remind me on a date page and confirm with `sim pending` that the month and week reminders are scheduled. Triage 2026-11-04: each link is unit-tested (the date pages' switch calls `setCountdownMark`; `countdownMarks.test.ts:222` writes the saved copy; `dateRemindersAtLaunch.test.ts:829` schedules In a month and In a week through the LocalNotifications mock), and story 4.2 passed the chain on the simulator through the old switch, so only the new `RemindMe` in the real shell is unchecked. `sim dates kinds` sets dates 3-8 days out, so the check needs a date more than a month ahead.
status: done 2026-11-04
resolution: checked on the iPhone Duo simulator on 2026-11-04 (shell built from this branch): turning on Remind me on the Cooking class event page (Tue 22 Dec, 48 days out) added two requests to `sim pending`, "In a month: Cooking class" at 2026-11-22 09:00 and "In a week: Cooking class" at 2026-12-15 09:00, beside the six "Tomorrow" ones already there.
decision: 2026-11-04 sim-check-in-DW-448-session — outside the loop: run `sim pending` after turning on Remind me on a date page in the DW-448 simulator session, then close.

### DW-447: The Settings rework solved the same problems several ways across its pages and test files.
origin: epic-settings-rework retrospective (duplication map and test kits), 2026-11-04
location: src/components/Settings/ (ConfirmDialog.tsx, Settings.tsx `SignOutEverywhereConfirmation` and Error box, NewDatePages.tsx `KindChooser`, EventPages.tsx, AnniversaryPages.tsx, DatePages.tsx, ProfilePage.tsx, settingsFields.ts); src/components/DisplayNameSetup/DisplayNameSetup.tsx; src/stores/slices/datesSlice.ts, profileSlice.ts, notificationsSlice.ts; src/components/Settings/__tests__/
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: Dialogs: three confirmation-dialog implementations (`ConfirmDialog`, `SignOutEverywhereConfirmation`, and `KindChooser`, which copies the focus trap and backdrop). Error box: six inline copies, one a hand-typed copy of `FAILURE_BOX` in Settings.tsx. Copied constants: `FIELD_CLASS` identical in 5 files, and `NOT_SET` defined twice. Delete flow: the same shape in EventPages and AnniversaryPages. Display-name rule: in `settingsFields.ts` and `DisplayNameSetup.tsx`. `isOnline()`: a private copy in three new slices, while `api/errorHandlers.ts` exports one. One birthday, two formats: the Profile row shows the long date and the Your birthday page shows "4 Apr". This one is user-visible. Test kits: `setOnline` is reimplemented in `NotificationsPage.test.tsx` and `Settings.profile.test.tsx`, though `tests/unit/stores/accountDataFixtures.ts` exports it. That breaks AGENTS.md's shared-helper rule. `renderAt` is identical in 4 test files, and `setConnection` and `makeEvent` are each copied twice. Fix: one cleanup story: one dialog, one Error box, shared field constants and rules, one birthday format, and the test helpers imported from shared kits.
status: done 2026-11-04
resolution: split at triage into DW-453 (dialogs and the delete flow), DW-454 (Error box, field constants, name rule, `isOnline`), DW-455 (test kits) and DW-456 (date formats), each small enough for one story's budget.
decision: 2026-11-04 split — four entries; the date-format part follows the mock (DW-456) and the name rule is shared (DW-454).

### DW-448: Only the Settings stack has ever been checked in the Duo's column form; every other view is unchecked.
origin: epic-settings-rework retrospective (P5, S4), 2026-11-04
location: every view in src/components (Home, Love Notes, Mood, Photos and the photo viewer, Partner, Settings); scripts/sim-driver
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: medium
reason: In story 5.17's checks the owner found Love Notes not opening at the bottom and the photo viewer's buttons under the column icons. Both were from before this epic (`db5bfb2b`, `0ffa2caf`), and neither view had a column-form test. DW-419's simulator check covered the Settings stack alone, and its own text says the same holds for every column-form feature. Desktop Playwright cannot set `env(safe-area-inset-*)`. Fix: one simulator sweep of every view in both column forms (capsule left and right), with a screenshot of each, fixing what it finds. After that, each epic sweeps the views it changes. Triage 2026-11-04: outside the loop: about 22 screens in both capsule positions (about 44 screenshots to judge), an unmeasured estimate of 2-3 hours plus fixes; only the dock, the Settings stack, `UpdateToast` and `useSideColumn` have column-form tests. DW-446's `sim pending` check runs in the same session, and DW-457 (the love-note picture viewer's Close) is one likely escape already filed.
status: done 2026-11-04
resolution: swept on the iPhone Duo simulator on 2026-11-04, 46 screenshots: capsule on the right (folded portrait) and on the left (folded landscapeLeft) across Home, Mood (Log, Timeline, Calendar, mood detail), Love Notes and its picture viewer, Photos (grid, viewer, delete confirm, upload), Partner and Interaction History, and Settings (top page, Dates, an event page, a field page, Add a date, Log out of all devices). Fixed what it showed, each its own commit: the note picture viewer covered only its message row (`99519f9f`, rendered into `document.body`); the photo upload modal put Close under the status capsule, and centred dialogs spread across the column (`c70bce9a`, every safe-area inset padded); a view opened at the scroll the last one left (`ce22c999`, reproduced in Chromium); and DW-457's Close (`372d39f7`). Rechecked after a rebuild with the capsule on the right; the left-capsule pass ran on that build.
decision: 2026-11-04 outside-the-loop — one simulator session after the sweep, with DW-446.

### DW-449: The simulator driver checks none of its prerequisites up front.
origin: epic-settings-rework retrospective (P6), 2026-11-04
location: scripts/sim-driver/sim (header needs at lines 24-25; `resolve_device`, `require_booted`, `require_window`, `require_stack`)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: During the epic, non-interactive shells got Homebrew's Supabase CLI 3.0.0, which rejects the repo's config, and stories 5.1 and 5.4 worked around it with a shim. The fix then made mise refuse the driver's staged copy until `trusted_config_paths` covered it. `sim` lists its needs but checks them only inside each command, so a wrong environment fails partway through a build. Fix: a `sim doctor` preflight, run before `sim build`. It checks the Supabase CLI on PATH against the `.mise.toml` pin, that mise trusts the staged path, Xcode and Device Hub, and the local stack's health. Triage 2026-11-04: the real cost was a misleading message: with the wrong Supabase CLI the driver says "run supabase start" (`sim:585`). Buildable and testable with stub scripts, no simulator. Build with DW-443.
status: done 2026-11-04
resolution: `sim build`, `sim provision` and `sim dates` now run `require_supabase_cli`, which compares `supabase --version` in the repo with `.mise.toml`'s pin and stops naming both versions (or no working CLI) instead of "run supabase start"; `zsh scripts/sim-driver/test-supabase-pin.zsh` covers pinned, 3.0.0, older and broken CLIs with a stub. No full `sim doctor`, per the decision.
decision: 2026-11-04 narrow-version-check — check the Supabase CLI on PATH against the `.mise.toml` pin before `sim build` and name the mismatch; no full `sim doctor`.

### DW-450: The simulator driver cannot hold a back swipe halfway, so it cannot see the picture that slides in.
origin: epic-settings-rework retrospective (P3), 2026-11-04
location: scripts/sim-driver/sim (the `swipe` command takes only `back`); RunnerUITests/Drive.swift (the pan holds for 0 s); scripts/sim-driver/README.md
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: `sim swipe back` compares the page text after the pan, so it checks where a swipe lands, not what it shows. Two of story 5.15's later bugs were in the picture: WebKit's dark or white page three levels deep (`e1ba2117`), and the Add a date chooser still in the picture (`a9906618`). An agent caught the second only with an ad hoc halfway-hold probe that never entered the driver. Fix: a swipe step that stops halfway and takes a screenshot (for example `sim swipe back --hold PATH`), documented in the README. Triage 2026-11-04: confirmed (`sim:1196-1198` and `Drive.swift:59` accept only `back`; the pan holds 0 s at `Drive.swift:75`). The loop has driven the simulator before (run 20261102-215408-6a69, story 5.15); checking that the screenshot shows the page mid-slide needs the Mac unlocked, Device Hub open and `supabase start`.
status: done 2026-11-04
resolution: added `sim swipe back --hold PATH`: the runner's new `swipe back hold` step pans from the left edge to the web view's middle and holds 3 s, printing "holding" (now flushed) before the press, and the shell saves the active display to PATH 1.2 s into the hold, repeating up to 8 tries until that picture differs from one taken just before the pan; `sim help` and the README describe it. Checked on the Duo simulator on 2026-11-04 from a Settings event page with the capsule on the left: try 1 held, and the picture shows the Dates list sliding in beside the event page.

### DW-451: The Settings Touch Floor and design-token measurement of 2026-11-04 was done once by hand and kept as no test.
origin: epic-settings-rework retrospective (P2), 2026-11-04
location: tests/e2e/settings/ (no spec measures hit areas, field font size or colours)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: R16 (44pt targets, 16px fields) and R18 (DESIGN.md tokens) were "delivered by each story" according to tickets.toml, but no story measured them. The measurement recorded in the epic's Notes on 2026-11-04 walked 25 pages in Playwright, light and dark, and passed, but nothing keeps it. Fix: an E2E spec that walks those pages and asserts every target's hit area is at least 44pt, every field is 16px, and every colour is a DESIGN.md token. Absorbs DW-432 (no E2E axe scan of the Settings pages since `events-accessibility.spec.ts` was deleted): add an axe scan limited to the `color-contrast` rule over the same pages, bringing back `@axe-core/playwright`, because `whiteOnColorContrast.test.ts` covers only white text on colour and the token check proves which colours appear, not which pairs sit together. Triage 2026-11-04: the measurement's scripts are kept outside the repo at `~/.local/share/my-love/r16-probe/` (`measure.mjs`, `analyse.py`, and `seed-extra.mjs`, which seeds the partner event and the past event that `measure.mjs` opens, after `sim provision`). DESIGN.md's front matter lists every colour, type style, radius and the 44px size, so the spec can read them at run time (`js-yaml` is only an `overrides` pin: declare it or parse the front matter directly). Traps: a sr-only radio's hit area is its label, not the 1x1 input; the dialog scrim's colour comes back as `oklab(0 0 0 / 0.5)` and must be read as the 50% black scrim; sr-only text reads as black and must be skipped; Photos shows only when `navigator.connection.type` is stubbed (for example `'wifi'`); Notifications exists only in the shell, so measure it on the simulator.
status: done 2026-11-04
resolution: new `tests/e2e/settings/settings-touch-floor.spec.ts` walks 25 Settings states (the top page, Log out of all devices, Profile with Name and Birthday, Partner, Photos with `navigator.connection.type` stubbed to `wifi`, Dates, the Kind chooser, New event, New anniversary, an own event with its Date, Note and Icon pages and Delete confirm, a partner's event, a past event, an anniversary, Together since and its Date page, Wedding, Your birthday and the partner's birthday), each in light and dark, and asserts every target outside the dock hits 44px both ways (a sr-only radio counts its label), every field is at least 16px, and every colour is a DESIGN.md token read from its front matter at run time (or the 50% black scrim, which reads as `oklab(0 0 0 / 0.5)`); `@axe-core/playwright` is back as a devDependency for a `color-contrast`-only scan of the same states (DW-432). It passes on the local stack in 37 s, and fails as it should on an injected 20px button, a 12px field and an off-palette, low-contrast colour. Notifications (shell only) is left out.
decision: 2026-11-04 build — keep the measurement as a spec, with DW-432's contrast-only axe scan.

### DW-452: A unit test still asserts a bare `console.error` call.
origin: epic-settings-rework retrospective (Date Reminders follow-through, item 6), 2026-11-04
location: tests/unit/stores/moodSlice.historyBackfill.test.ts:221; src/services/__tests__/pushNotifications.test.ts:175, :185, :268
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: AGENTS.md forbids a bare `expect(console.error).toHaveBeenCalled()`, since the bare form passed twice on an unrelated error in epic-date-reminders. `497e2515` fixed 13 such asserts and `2b5f27e7` fixed the one in PushSettings.test.tsx, but this one, `expect(errorSpy).toHaveBeenCalled()`, was missed. Fix: assert the message the code under test logs. Triage 2026-11-04: three more bare asserts on a `console.error` spy sit in `pushNotifications.test.ts` (`errorLog` at :175, :185 and :268); fix all four.
status: done 2026-11-04
resolution: all four asserts now name what the code under test logs: `[MoodSlice] Error loading mood history from the server:` with the read's error in moodSlice.historyBackfill.test.ts, and `[Push] Could not record the device:` with `nope` (twice) and `[Push] Registration did not start:` with the plugin's error in pushNotifications.test.ts; a scan of every `console.error` spy in `src` and `tests` finds no other bare assert.

### DW-453: The Settings rework has three confirmation dialogs and two copies of the date delete flow.
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
location: src/components/Settings/ConfirmDialog.tsx; src/components/Settings/Settings.tsx (`SignOutEverywhereConfirmation`, :100-160); src/components/Settings/NewDatePages.tsx (`KindChooser`); src/components/Settings/EventPages.tsx (:218-250); src/components/Settings/AnniversaryPages.tsx (:127-158)
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: `ConfirmDialog`, `SignOutEverywhereConfirmation` and `KindChooser` each draw a dialog, and `KindChooser` copies the focus trap and backdrop; the event and anniversary pages repeat the same delete flow. Fix: one dialog component the three use, and one delete flow both pages call. Split from DW-447 at triage so each part fits one story's budget.
status: done 2026-11-04
resolution: `KitDialog` (ConfirmDialog.tsx) is the one dialog frame: the kit scrim and panel, the focus trap starting on Cancel, Escape and a scrim tap cancelling, and the stable cancel. `ConfirmDialog` and the Kind chooser draw on it, and Log out of all devices is now a `ConfirmDialog` (its buttons' test ids became `settings-sign-out-everywhere-confirmation-cancel`/`-confirm`; nothing read the old ones). The event and anniversary pages' delete runs through one hook, `useDateDelete`, with the same refusals, messages and test ids. Settings unit tests (442) pass unchanged.

### DW-454: The Settings pages copy the Error box, the field constants, the display-name rule and the online check.
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
location: src/components/Settings/ (six inline Error box copies; the hand-typed `FAILURE_BOX` copy in Settings.tsx:432-440; `FIELD_CLASS` in 5 files, `NOTE_FIELD_CLASS` in 3, `NOT_SET` in 2); src/components/Settings/settingsFields.ts:125 and src/components/DisplayNameSetup/DisplayNameSetup.tsx:56 (name rule); src/stores/slices/datesSlice.ts, profileSlice.ts, notificationsSlice.ts, partnerSlice.ts:96 (private `isOnline`); src/api/errorHandlers.ts:46
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: Six inline Error box copies, one hand-typed and drawn slightly differently; `FIELD_CLASS` identical in 5 files, `NOTE_FIELD_CLASS` in 3 and `NOT_SET` twice; the display-name rule in two places; four private `isOnline` copies in slices while `api/errorHandlers.ts` exports one. Fix: one Error box component, shared field constants, one name rule used by both the Name page and the signup gate (this replaces DW-427's documented-twin choice), and the slices calling the exported `isOnline()`. Split from DW-447 at triage.
status: done 2026-11-04
resolution: one `ErrorBox` (src/components/Settings/ErrorBox.tsx) replaces the six Settings copies, the hand-typed top-page one included; `FIELD_CLASS`, `NOTE_FIELD_CLASS` and `NOT_SET` are exported once from settingsFields.ts; the display-name rule is `displayNameRefusal` and `isDisplayNameLength` in profileService.ts, used by `saveDisplayName`, the Name page and the signup gate (`DisplayNameSetup`), replacing DW-427's documented twin; and the dates, profile, notifications and partner slices call `isOnline()` from api/errorHandlers.ts, which now answers online with no `navigator`, as their copies did. The two non-Settings boxes (LoginScreen, DisplayNameSetup) keep their own markup: they carry `aria-live` and icon test ids.
decision: 2026-11-04 share-name-rule — one name rule in one place, replacing DW-427's documented twin.

### DW-455: The Settings test files copy shared helpers instead of importing them.
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
location: src/components/Settings/__tests__/ (`renderAt` in 4 files, `setConnection` in 5, `makeEvent` in 2); src/components/Settings/__tests__/NotificationsPage.test.tsx:83 and Settings.profile.test.tsx:106 (`setOnline`); tests/unit/stores/accountDataFixtures.ts:33
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: `setOnline` is reimplemented in `NotificationsPage.test.tsx` and `Settings.profile.test.tsx` though `tests/unit/stores/accountDataFixtures.ts` exports it, which breaks AGENTS.md's shared-helper rule (the retro's fix-now item, never done); `renderAt` is identical in 4 test files, `setConnection` in 5 and `makeEvent` in 2. Fix: a shared Settings test kit (a `__tests__/*Kit.ts(x)` file) for `renderAt`, `setConnection` and `makeEvent`, and `setOnline` imported from `accountDataFixtures.ts`. Split from DW-447 at triage.
status: done 2026-11-04
resolution: a new kit, `src/components/Settings/__tests__/settingsPageKit.tsx`, holds `renderAt` (from the 4 page test files), `makeEvent` and `daysFromToday` (the two `makeEvent` copies now keep only their file's defaults); `setConnection` moved beside `setOnline` into a new import-free `tests/unit/stores/navigatorFixtures.ts` (re-exported `setOnline` from accountDataFixtures.ts), and all five `setConnection` copies (2 in Settings, PhotoGridItem.recovery, photoDownloadPreference and photoImageCache) and the two Settings `setOnline` copies import it. The 14 `setOnline` copies outside Settings are filed as DW-459.

### DW-456: The birthday and Linked since dates do not use the mock's format.
origin: triage split of DW-447 (epic-settings-rework retrospective), 2026-11-04
location: src/components/Settings/ProfilePage.tsx:125 (birthday row); src/components/Settings/DatePages.tsx:279 (Your birthday page); src/components/Settings/PartnerPage.tsx:85 (Linked since); _bmad-output/initiative-my-love/ux-settings-page/mockups/key-settings-v2.html:416; _bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md:230-231
source_spec: `tickets/epic-settings-rework/epic-settings-rework-retrospective.md`
severity: low
reason: The Profile row shows the birthday as the long local date, the Your birthday page shows "4 Apr", and Linked since shows "February 3, 2022". The mock that EXPERIENCE.md:75 links specifies `4 Apr 1995` on the Profile row (key-settings-v2.html:416), `4 Apr` on the birthday pages (EXPERIENCE.md:230-231) and `3 Feb 2022` for Linked since. Fix: follow the mock. Split from DW-447 at triage, whose "one birthday format" would have contradicted the mock.
status: done 2026-11-04
resolution: followed the mock: a new `formatDayMonthYear` ("3 Feb 2022") in settingsFields.ts backs `formatDateOnly` (the Profile birthday row, now `4 Apr 1995`), `formatInstantDate` (Linked since, now `3 Feb 2022`) and `formatListDate`'s other-year form; the birthday pages already read `4 Apr` through `yearlyValue`. Unit tests pin both forms, and partner-page.spec.ts reads `[34] Feb 2022`.
decision: 2026-11-04 follow-the-mock — Profile row `4 Apr 1995`, birthday pages `4 Apr`, Linked since `3 Feb 2022`.

### DW-457: The love-note picture viewer's Close button probably sits under the side column on the Duo.
origin: triage of epic-settings-rework deferred work (DW-448 code read), 2026-11-04
location: src/components/love-notes/FullScreenImageViewer.tsx:100
severity: medium
reason: The Close button is placed at `right-4` with no `--dock-right` clearance, the layout `b243a7ce` fixed in the photo viewer (`PhotoGallery/PhotoViewer.tsx`), so in the column form with the capsule on the right it probably sits under the capsule. Found by reading the code, not seen on a screen. Fix: clear the column as `b243a7ce` does for the photo viewer.
status: done 2026-11-04
resolution: Close now sits at `right-[calc(1rem+env(safe-area-inset-right))]`, as `b243a7ce` placed the photo viewer's controls. Checked in the DW-448 simulator sweep with the capsule on the right: Close sits left of the side column, clear of the status capsule. The sweep also found the viewer covering only its message row, fixed in the same branch by rendering it into `document.body`.
decision: 2026-11-04 file-and-sweep.

### DW-458: The partner-mood.spec.ts comment on loadPartner's reads is stale beyond the column this change fixed.
origin: spec-deferred 4c682ad027bb
location: tests/e2e/partner/partner-mood.spec.ts:46
source_spec: `plan-dw-partner-lookup-drop-updated-at.md`
severity: low
reason: tests/e2e/partner/partner-mood.spec.ts:46-48 says loadPartner makes 2 sequential GET /rest/v1/users calls and names the second select=id,email,display_name; getPartner also reads partner_requests (src/api/partnerService.ts:151-160) and the second users read selects id, email, display_name, birthday (src/api/partnerService.ts:137). Predates this change.
status: done 2026-11-04
resolution: the comment now lists getPartner's three reads: the `partner_id` read, the partner's row with `id,email,display_name,birthday`, and the accepted `partner_requests` read for Linked since, which the spec leaves to the local stack.

### DW-459: Fourteen unit test files outside Settings still define their own `setOnline`.
origin: DW-455 fix (chore/resolve-open-dw), 2026-11-04
location: tests/unit/stores/ (interactionsSlice.localCopy, eventsSlice.localCopy, photosSlice.localCopy, birthdaysWedding, coupleSettings, partnerSlice.localCopy, pushPreferences); tests/unit/hooks/usePhotoImage.test.ts; tests/unit/api/interactionService.test.ts; tests/unit/services/ (pushPreferencesService, photoImageCache, accountDataApis, profileService, coupleSettingsService); tests/unit/stores/navigatorFixtures.ts
severity: low
reason: DW-455 moved the `navigator` stubs into `tests/unit/stores/navigatorFixtures.ts` (`setOnline`, `setConnection`) and switched the Settings tests and every `setConnection` copy to it, but these 14 files each keep a local `setOnline`, against AGENTS.md's shared-helper rule. They are not all the same stub: some set `navigator.onLine` with `Object.defineProperty`, some with `vi.spyOn(navigator, 'onLine', 'get')`, so a switch must check each file's teardown. `notesSliceQueueFixture.ts` and `fakeEventsBackend.ts` export their own `setOnline` for their suites. Fix: import `setOnline` from `navigatorFixtures.ts` wherever the stub is the `defineProperty` form, and give the spy form one shared helper too if more than one file needs it.
status: done 2026-11-04
resolution: all 14 files import `setOnline` from `navigatorFixtures.ts`, and `fakeEventsBackend.ts` re-exports it the way `accountDataFixtures.ts` does. The four spy-form files (`pushPreferencesService`, `accountDataApis`, `profileService`, `coupleSettingsService`) moved to the shared `defineProperty` stub, so no spy helper was needed: each resets to online in `beforeEach`, and no other code in them spies on `onLine`. `notesSliceQueueFixture.ts` keeps its own `setOnline`, which drives the stateful getter `stubOnline` installs. Plan: `plan-dw-459-shared-set-online.md`.

### DW-460: The Edge Functions, the site build and the admin scripts sign in with the legacy keys Supabase is retiring.
origin: bmad-architecture review of the Daily Question spine (currency lens), 2026-11-05
location: supabase/functions/send-push/index.ts:34; supabase/functions/upload-love-note-image/index.ts:30; .github/workflows/deploy.yml and bundle-size.yml (`secrets.VITE_SUPABASE_ANON_KEY`); fnox.toml `SUPABASE_SERVICE_KEY` (scripts/provision-claude-bot.mjs, scripts/provision-push-fixtures.mjs)
source_spec: `architecture-daily-question/architecture-daily-question.md` (Deferred)
severity: medium
reason: Supabase's API-keys guide (https://supabase.com/docs/guides/api/api-keys, read 2026-11-05) deprecates the `anon` and `service_role` keys "by the end of 2026"; legacy keys "stay valid until you disable them" under Settings > API Keys. Four things still used them: `send-push` read `SUPABASE_SERVICE_ROLE_KEY`; `upload-love-note-image` read `SUPABASE_ANON_KEY`; the live site bundle shipped the legacy anon JWT, because the deploy's `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` came from the GitHub secret `VITE_SUPABASE_ANON_KEY`, which held it; and fnox's `SUPABASE_SERVICE_KEY` held the legacy service-role JWT. Disabling the legacy keys would have stopped every push, every love-note picture upload, the whole site and the provisioning scripts. The hosted project already has a `default` publishable and a `default` secret key (Management API listing).
status: done 2026-11-05
resolution: both Edge Functions read their key through `supabase/functions/_shared/apiKeys.ts`: the `default` entry of `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS` (hosted injects them), falling back to the legacy variable with a logged warning, because the local CLI 2.122.0 injects only the legacy ones (measured on its edge runtime container); `test.yml` runs the new `_shared` Deno tests. A new GitHub secret `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` holds the `sb_publishable_` key and `deploy.yml` and `bundle-size.yml` read it; against hosted the publishable key answers exactly as the legacy anon key did (auth settings 200; the same 42501 on a revoked table). fnox's `SUPABASE_SERVICE_KEY` now holds the `default` `sb_secret_` key, which the auth admin API accepts in both the `apikey` and the `Authorization: Bearer` header the scripts send. After the deploy, 2026-11-05/06: both functions' fresh boots on hosted logged no fallback warning, and the edge logs showed `send-push` under the `sb_secret_` key; the old `VITE_SUPABASE_ANON_KEY` GitHub secret was deleted (`gh secret delete`); the owner's iPhone shell switched to the `sb_publishable_` key once the live update applied (edge logs, grouped by `request.sb.apikey.apikey.prefix`); then the legacy keys were disabled through the Management API (`PUT /v1/projects/{ref}/api-keys/legacy?enabled=false`, 00:51 UTC on 2026-11-06; `enabled=true` reverts it). Checked after: the publishable key answers auth health and a table read with 200, the secret key an admin read with 200, the legacy anon key 401 "Legacy API keys are disabled", the site 200. The partner's shell was still on the pre-deploy build; its first open after the switch can sign it out once before the update applies, which the owner accepted.

### DW-461: E2E workers will share one coach pool, which clearPairDays cannot clear and NO ACTION keeps from being deleted while any day uses a row.
origin: spec-deferred 0cf81e0eb41d
location: tests/support/factories/daily-question.ts; supabase/migrations/20261105010000_daily_question_days_and_picks.sql:102
source_spec: `tickets/epic-daily-question/tickets/story-the-server-assigns-today-s-question-and-releases-a-pick-s-ch-plan.md`
severity: medium
reason: Coach rows have a null pair (daily_questions_coach_or_written), so a question one worker inserts is drawn by every worker's pair. clearPairDays deletes only the worker pair's couple_days rows. couple_days.question_id is NO ACTION, so deleting a test coach row raises 23503 while another worker's day still asks it. The row audit cannot see coach rows, which have no user column. Story 12's ticket says "Tests insert their own questions", so its specs meet this under parallel workers and burn-in: flaky question text or a failing teardown. The intent hands test-pool seeding to story 12, so this story ships no seeding helper.
resolution: `tests/support/factories/daily-question.ts` now exports `ensureTestCoachQuestions(supabaseAdmin)`, which upserts three fixed-uuid coach rows with `ignoreDuplicates` and never deletes them, so no teardown meets the NO ACTION 23503 and every worker's pair draws from the same idempotent pool; a spec asserts that its pages agree with the question read through the admin client (`readPairQuestionTexts`), never a specific text. Used by `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts` (story 6.12), which passed twice in a row on a local stack.
status: done 2026-11-05

### DW-462: AGENTS.md says useAppStore.ts composes 14 slices; with dailyQuestionSlice it composes 15.
origin: spec-deferred a1bf1d8a5ceb
location: AGENTS.md:26
source_spec: `tickets/epic-daily-question/tickets/story-both-partners-pick-today-s-question-and-see-the-reveal-plan.md`
severity: low
reason: `grep -c "create[A-Za-z]*Slice(set, get, api)" src/stores/useAppStore.ts` gives 15 after this change; AGENTS.md line 26 still reads "composes 14 slices". The fix edits an agent-context file, so it is deferred rather than patched.
status: open

### DW-463: origin/main and this epic each hold a migration at version 20261105010000, so once both reach main the hosted deploy skips one of them.
origin: spec-deferred f2b78a48ca13
location: supabase/migrations/20261105010000_daily_question_days_and_picks.sql
source_spec: `tickets/epic-daily-question/tickets/story-each-partner-s-day-runs-on-their-own-clock-plan.md`
severity: high
reason: `git ls-tree --name-only origin/main supabase/migrations/` lists `20261105010000_push_added_dates.sql` (and `20261105020000_remind_me_on_by_default.sql`); this epic's story 6.1 added `20261105010000_daily_question_days_and_picks.sql`. The migration history keys on the version alone, so whichever lands second is recorded as applied without running. Renaming an applied migration is outside this story; the epic PR must renumber the daily one past every main version before merging.
status: done 2026-11-06
resolution: renumbered to `20261105030000_daily_question_days_and_picks.sql`, after main's `20261105020000` and before this epic's `20261105210000_daily_question_own_clocks.sql`, which builds on it; the two pgTAP header comments that named the version follow, and the shared local stack's `schema_migrations` row was renamed to match. Done on `loop/integration` between stories 6.2 and the next, with the run stopped.

### DW-464: The partner-connect poke test failed once while the realtime-recovery spec ran beside it.
origin: spec-deferred d403f1340407
location: tests/e2e/partner/partner-connect.spec.ts ("a poke reaches each linked partner live")
source_spec: `tickets/epic-daily-question/tickets/story-the-partner-s-pick-shows-without-a-reload-plan.md`
severity: medium (unverified)
reason: During story 6.6 the implementing agent's first combined run of `tests/e2e/daily/`, `partner-connect.spec.ts`, `realtime-recovery-after-renewal.spec.ts` and `login.spec.ts` (chromium, local stack) failed this test once: no `notification-badge` appeared. It passed in two reruns, and in the parent session's two full runs of the same set. The poke path (`interactionService`'s `postgres_changes` subscription) is not touched by that story, and the test was not run on the baseline, so whether it is a load-dependent flake or something else is unverified. To settle it, run `partner-connect.spec.ts` with `--repeat-each=10` next to the recovery spec on the baseline and on this branch. If it does fail, check whether the poke is inserted before the `postgres_changes` confirmation (the AGENTS.md pitfall), the way the recovery spec guards with POKES_ARMED_LOG.
status: open

### DW-465: The partner-connect poke test failed once while the realtime-recovery spec ran beside it (ledger DW-464).
origin: spec-deferred 1e1c7fb40342
location: tests/e2e/partner/partner-connect.spec.ts
source_spec: `tickets/epic-daily-question/tickets/story-the-partner-s-pick-shows-without-a-reload-plan.md`
severity: medium
reason: The implementing agent's first combined Playwright run failed "a poke reaches each linked partner live" once (no notification-badge); two reruns and the parent's two full runs passed. The poke path (interactionService postgres_changes) is untouched by this change and the baseline was not run, so it is unverified. Settle it with partner-connect.spec.ts --repeat-each=10 beside the recovery spec on the baseline and on this branch. (declared severity: medium (unverified))
status: open

### DW-466: 24 existing test-file violations of TEA's write-time hook rules.
origin: installing TEA's write-time enforcement hook (`.claude/hooks/tea-enforce.cjs`, TEA 4.0.0), 2026-11-06
location: H1 hard waits (`await new Promise((resolve) => setTimeout(resolve, N))`): src/components/MoodTracker/__tests__/MoodTracker.partnerLink.test.tsx:73,161,176; src/services/__tests__/dateReminders.test.ts:1080; src/services/__tests__/pushNotifications.test.ts:284,710; tests/api/push-love-note-trigger.spec.ts:247,446,505,837,908 (3 s each); tests/unit/services/nativeUpdates.test.ts:338; tests/unit/stores/countdownMarks.test.ts:76; tests/unit/stores/dateRemindersAtLaunch.test.ts:668,759,926; tests/unit/stores/pushPreferencesCopy.test.ts:74. H5 over 1,000 lines: src/services/__tests__/dateReminders.test.ts (1205), src/services/__tests__/pushNotifications.test.ts (1239), tests/api/push-love-note-trigger.spec.ts (1060), tests/unit/stores/dateRemindersAtLaunch.test.ts (1324), tests/unit/stores/eventsSlice.test.ts (1254), tests/unit/stores/signOutClearsAccountState.test.ts (1070), tests/e2e-archive/scripture-reflection-original.spec.ts (1155, frozen: never edit)
severity: low
reason: The hook's `--pre` blocks only violations a write adds, so these files can still be edited. But `--post` reports the whole file after every edit, and `--stop` sweeps each test file the turn touched and exits 2, so an agent that edits one of them is told to fix the old violations and gets one extra turn before it can stop. That includes a loop session working on something else. Each hard wait should become a wait on the thing it waits for, such as a fake timer, `vi.waitFor` or a polled assertion. Each oversize file should be split by subject. Counts come from running the hook's own `scanFile` over every file its `testGlobs` match.
resolution: 22 findings fixed in #475 (82b77686, merged as 0db0d7b8): every listed H1 hard wait now waits on the condition its test needs, and `dateReminders`, `pushNotifications`, `dateRemindersAtLaunch`, `eventsSlice` and `push-love-note-trigger` are split under 1,000 lines. The `tests/e2e-archive/` spec was deleted in cae2be60. `tests/unit/stores/signOutClearsAccountState.test.ts`'s H5 is excluded in `.tea/enforce-config.json` (8f243e16) until epic 10 splits it; that epic's Done when requires the split and the exclusion's removal. The hook's scan of every tracked test file now reports 0 findings. `settleMs`, a wait the H1 pattern cannot see, is DW-480.
status: done 2026-11-06

### DW-480: The date-copy refresh tests still hard-wait 20 ms through `settleMs`, which the H1 regex cannot see.
origin: DW-466 fix (fix/dw-466-tea-hook-findings), 2026-11-06
location: tests/unit/stores/dateRemindersAtLaunchFixture.ts (`settleMs`); tests/unit/stores/dateRemindersAtLaunch.triggers.test.ts (14 calls); tests/unit/stores/dateRemindersAtLaunch.test.ts (1 call)
severity: low
reason: `settleMs = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms))` waits a fixed time, either before a negative assertion ("runs no refresher", "does nothing for a sign-in") or in an `afterEach` to let a run end. `.claude/hooks/tea-enforce.cjs`'s H1 pattern matches only a literal delay, so it does not flag the variable `ms`, and DW-466 replaced only the waits the hook flags. Fix as DW-466 did the others: the triggers decide before their first await, so a negative step can `mockClear()` `readLocalCopySpy` or a refresher spy and assert at once; the token-renewal cases defer by `setTimeout(0)`, so they need a scoped fake timer, as `MoodTracker.partnerLink.test.tsx` uses; a drain is `await replanDateReminders()`.
status: open
