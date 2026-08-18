---
id: SPEC-partner-activity
companions:
  - data-model.md
  - integration-points.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Partner Activity

## Why

An opportunity to capture, proposed by Sallvain while deciding how the new events feature should reach the other partner. This is a two-person app for a long-distance couple, and today one partner's action is invisible to the other until they happen to look: a new love note, a new photo, or (once `../spec-dynamic-events/` ships) a new event produces no signal of any kind. Every realtime receiver the app has is mounted inside a tab-gated lazy view — interactions at `PokeKissInterface.tsx:134`, mounted only at `PartnerMoodView.tsx:572`; love notes via `useLoveNotes.ts:141`, Notes tab only; moods at `PartnerMoodView.tsx:179` — so even the live paths only fire when the receiver is already parked on the right tab. `App.tsx:10` records that the one app-level notification surface was deliberately vacated: `// PokeKissInterface moved to PartnerMoodView`.

The design is Sallvain's, chosen over full live-sync: the broadcast carries a **signal, not data**. Tapping it navigates and refetches; nothing ever merges a payload into a list, so the server stays the single source of truth and a dropped message means *stale*, never *divergent*. Two halves, built in this order: a **badge** (an unseen count per feature, computed when the app opens — no realtime needed, works however far apart the couple's schedules are) and a **live toast** (a tappable banner for the moments both partners are actually on at once). Sallvain approved both; the badge leads because a backgrounded PWA is frozen by the OS and its Realtime socket drops within seconds, so a toast-only version fires only when both apps are foregrounded simultaneously — for this couple, the exception.

## Capabilities

### Badge

- **CAP-1**
  - **intent:** When a user opens the app, each feature shows how many things their partner added since the user last looked at that feature.
  - **success:** Partner A adds two photos while B's app is closed. B opens the app: the Photos destination shows 2. The count is derived from a per-user watermark, so it is identical on any device B signs into.

- **CAP-2**
  - **intent:** The user can tell something is new without opening the navigation tray.
  - **success:** With the tray closed and any unseen count non-zero, the hamburger button carries a visible indicator. With every count zero, it carries none.

- **CAP-3**
  - **intent:** Looking at a feature marks it seen.
  - **success:** B opens Photos; the Photos count clears and the hamburger indicator updates, on this device and (after next load) on B's other devices. A's counts are unaffected.

- **CAP-4**
  - **intent:** Counts refresh at the moments they can have changed: app open and network reconnect.
  - **success:** With the app already open and offline, B reconnects; counts refresh without a manual reload.

### Live toast

- **CAP-5**
  - **intent:** When the partner adds a love note, photo, event, or poke/kiss while the user has the app foregrounded, a tappable banner appears naming the partner and the feature.
  - **success:** A sends a note while B is on the Mood tab. B sees a banner ("Gracie sent a love note"); tapping it lands B on Notes with the new note visible via a fresh fetch. Dismissing it instead leaves B on Mood with the Notes badge showing 1.

- **CAP-6**
  - **intent:** A signal for the view the user is already on refetches silently instead of toasting.
  - **success:** B is on Notes when A sends a note. No banner appears; the thread updates.

### Both halves

- **CAP-7**
  - **intent:** All partner-activity state is account-scoped and vanishes on sign-out.
  - **success:** Sign out and sign in as an unrelated account on the same browser: no counts, no toast, no watermark from the previous couple. With no partner linked, no badge or indicator renders at all — not a zero.

## Constraints

- **The broadcast payload carries no row content.** The channel is public (matching every non-scripture channel in the app), so the payload is at most `{ feature }` — the toast's text comes from `partner.displayName` already in the store (`partnerService.ts:24-29`), and the content arrives only via the authenticated refetch. This is also what keeps refetch-don't-merge honest: there is nothing to merge. For interactions it means the banner names the feature, never poke-vs-kiss — the type is row content.

- **The watermark is its own table, never a viewed-flag column.** `love_notes` deliberately carries no UPDATE policy — `20260727000000_love_notes_idempotency.sql:15-19`: *"Deliberately NOT paired with an UPDATE policy. love_notes grants only INSERT and SELECT … Adding UPDATE purely to support merge-duplicates would also let a user edit notes they had already sent"* — and a flag column needs exactly that grant. `photos` likewise has only SELECT/INSERT/DELETE policies (`20251203190800:50-73`). Table shape in `data-model.md`.

- **The notes and interactions counts must filter `to_user_id` explicitly — RLS alone counts the wrong rows.** Both live SELECT policies (`20251206024345_remote_schema.sql:255-260` for notes, `:237-242` for interactions) admit `from_user_id = me OR to_user_id = me`, so an unfiltered count includes the user's own sent rows. Exact queries in `data-model.md`; the notes and photos indexes already exist (`20251206024345:77`, `20251203190800:37-38`), while interactions lost its `created_at` index (`20251206024345:47`) and gets a new one in this spec's migration.

- **The server clock is authoritative for the watermark.** The client never sends `seen_at`; a `before insert or update` trigger stamps it server-side (`data-model.md`). The counts compare the watermark against server-written `created_at` values, so a device clock running minutes fast would otherwise permanently swallow everything the partner creates in that window.

- **The subscription must survive StrictMode's double-invoked effects.** Two effect runs arming one topic put two owners on one deduped channel — the `interactionService.ts:181-184` failure, *"the first teardown closes it under the second"* — so the channel lives behind a refcounted registry in the `moodSyncService.ts:94` style, never a bare `channel()` call inside the effect.

- **The app-level channel uses a fresh topic, `partner-activity:${userId}`.** `supabase.channel()` dedupes by topic and returns the already-registered object, so reusing `love-notes:${userId}` hands this host the very channel `useRealtimeMessages.ts:68` opens on the Notes tab, and the first teardown closes it under the second — the failure documented at `interactionService.ts:181-184`. Send through `sendEphemeralBroadcast` (`ephemeralBroadcast.ts:115-119`); never hand-roll `supabase.channel()` (`AGENTS.md:57`).

- **The host splits: subscription in a hook at the top of `App()`, toast UI rendered in the shell.** The UI mounts beside `SyncToast` (`App.tsx:520`), after all six early-return guards and outside the `ViewErrorBoundary` (`:566`). But nothing rendered there runs during the splash (`:491`) or admin (`:502`) alternate trees, so the subscribe/fetch half must be a hook alongside the other top-level effects, or it silently dies on those screens.

- **Count refreshes fire from the two hook points that already exist:** the mount effect at `App.tsx:256-264` (session-guarded, StrictMode-safe) and the online handler at `App.tsx:308-319`. Only the first is session-gated — the online listener's effect (deps at `:340`) runs before the `!session` early return, so it fires on the login screen too; the real gate is `refreshUnseenCounts()`'s own no-`userId`/no-`partner` early return, which is a correctness requirement, not defensive style. No new lifecycle plumbing.

- **Every new store key goes into `signedOutState()` in the same commit** (`authSlice.ts:35-37`, test-enforced by `signOutClearsAccountState.test.ts`); no partner-activity state is persisted (`useAppStore.ts:151-177` `partialize` stays three keys); and any action that `set()`s after an `await` re-checks `if (get().userId !== capturedUserId) return` (`AGENTS.md:53`) — `partnerSlice.ts:57` records the exact race for partner data.

- **The toast dwells exactly 5 seconds — Sallvain's call, matching platform banner conventions.** `SyncToast.tsx:39`'s default `autoDismissMs = 5000` already matches; what changes is behavior, not timing: the whole surface is the tap target (SyncToast has no tap action), and a missed banner is safe because the badge preserves it. Reuse SyncToast's fixed top-center `z-[100]` positioning (`:131`).

- **Announcements are `aria-live="polite"`,** the tested house convention (`MoodHistoryCalendar.tsx:255`; asserted at `MessageCompose.test.tsx:226-231` and `DisconnectionOverlay.test.tsx:66`). The count indicator carries an `aria-label` in the existing badge's idiom (`PokeKissInterface.tsx:421`).

- **Badge placement is bound to the tray spec.** `../spec-dynamic-events/navigation.md` ("The tray must carry a badge slot") defines the two surfaces: the aggregate indicator on the hamburger button and per-destination counts inside the open tray. This spec fills those slots; it does not redefine them.

## Non-goals

- No Web Push, lock-screen, or OS notifications. Sallvain wants those only after a future move from PWA to a native app; nothing here builds scaffolding for that platform before it is chosen. (The watermark table itself carries over to that future unchanged.)
- No per-item read tracking. The watermark is per feature — "I looked at Photos", not "I saw photo 41". Coarse by design.
- No notification inbox or history. A missed toast leaves the badge; nothing else is recorded.
- No signals for edits or deletions. Only additions count and toast; an edited event does not re-notify.
- No retirement of the legacy per-row interactions pipeline. Interactions join the badge and toast as the fourth feature, but `markAsViewed`, `unviewedCount`, the in-tab badge, and the history modal stay untouched; folding them onto the watermark is follow-up work.
- No sound or vibration.
- No changes to `useRealtimeMessages` — the in-thread live insert on the open Notes tab keeps working as is; CAP-6 sits above it, not instead of it.

## Success signal

Gracie uploads two photos on Tuesday night while Frank's phone is in his pocket. Wednesday morning Frank opens the app: a dot on the hamburger, "2" beside Photos in the tray, tap, photos, gone. That evening they're both on the app at once; Gracie adds "Flight lands 3pm" to events and a banner slides onto Frank's screen naming her — one tap and he's looking at it. Neither of them ever refreshed anything by hand.

## Assumptions

- The badge clears when the user opens the destination view (watermark set to now on view entry) — the messaging-app convention. Glancing is treated as seeing; the per-feature watermark is coarse by design and the content is on screen at that moment.
- The four features are love notes, photos, interactions, and events; the first three activate at launch, events when `../spec-dynamic-events/` lands its table, and nothing here blocks on it.
- The toast shows one signal at a time; a newer signal replaces an older undismissed one (the badge preserves anything replaced).
- **First-open bootstrap accepts a one-time loss.** A user's very first read of a feature writes `seen_at = now()`, so anything the partner added before that first-ever open is never counted — including, at rollout, anything added the night before the deploy. CAP-1 holds from the first watermark row onward. The alternative (counting all history) fails worse and repeatedly; `data-model.md` carries the full trade-off, and downstream must not "fix" the first-open 0 by counting history.

## Open Questions

None. Both prior questions were resolved by Sallvain: the toast dwells exactly 5 seconds (now a constraint), and interactions joined as the fourth feature (their legacy per-row pipeline stays, per the non-goal).
