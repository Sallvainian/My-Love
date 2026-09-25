---
id: SPEC-unified-data-storage
companions:
  - brownfield.md
  - ../../../AGENTS.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Unified data storage: server truth, offline copy everywhere

## Why

A pain and a vision. The owner wants the app to work offline, with offline data always coming from the server. Today each kind of data follows one of four storage models (brownfield.md): most screens go blank offline, and every extra model is another rule an agent can get wrong. One model replaces them. Supabase holds the truth. Each device keeps a per-account copy that it shows at once and refreshes from the server (stale-while-revalidate). Saving uses one of two modes.

## Capabilities

- **CAP-1**
  - **intent:** Every screen that shows account or couple data opens on its last saved copy at once, online or offline, and swaps in server data when the server is reachable. This covers photos, love notes, the poke/kiss history, events, your own and your partner's mood, anniversaries, message favorites, custom messages and the partner profile.
  - **success:** After one online session, with the device then offline, each covered screen shows the data it last loaded.
- **CAP-2**
  - **intent:** Local copies refresh on app start and sign-in, when the connection returns, and on Realtime events.
  - **success:** A server change made while the device was offline appears after reconnect without a reload.
- **CAP-3**
  - **intent:** Mood entries and love-note text can be saved offline. They appear at once, marked as pending, and send automatically once online, in order and exactly once.
  - **success:** Three notes sent offline reach the partner after reconnect, in order, with no duplicates across retries and reloads. A failed note that is resent also reaches the partner live; today `retryFailedMessage` never sends the partner broadcast.
- **CAP-4**
  - **intent:** Every other write is refused up front when offline, with a clear "needs a connection" message and no change to the local copy.
  - **success:** Offline, each such control shows the message and the local copy stays unchanged.
- **CAP-5**
  - **intent:** Every photo can be viewed offline: the gallery list plus every photo's image. Only when the browser refuses more storage are the oldest images dropped, and those show a placeholder. The list itself is always kept.
  - **success:** After one online session, the whole gallery displays offline. With storage refusal forced in a test, the oldest images drop first and the gallery still lists every photo.
- **CAP-6**
  - **intent:** Your own mood history is filled from the server, so a new device shows past moods.
  - **success:** Signing in on a fresh device shows earlier moods in the calendar.
- **CAP-7**
  - **intent:** Local copies are kept per account. On a shared device, one account never sees another account's cached data. Sign-out removes that account's cached copies but keeps its unsent queued writes.
  - **success:** A signs out and B signs in, and no data of A's appears. A signs back in, and A's pending writes still send.
- **CAP-8**
  - **intent:** While showing saved data offline, the app makes clear that the device is offline and the data may be out of date.
  - **success:** Offline, every data screen shows an offline indicator.
- **CAP-9**
  - **intent:** The couple's relationship start date is stored on the server as one date both partners share. Either partner can edit it in Settings, and it drives daily-message rotation.
  - **success:** When one partner changes the date, the other's phone shows the new date, rotation and Home "Together for" count after a refresh. Offline, both phones show the last saved date.
- **CAP-10**
  - **intent:** The app never names the partner from a hard-coded value. Every partner name comes from the partner's own display name.
  - **success:** When partner B logs a mood, partner A's pop-up shows B's display name. No source file carries a hard-coded partner name. Story 3 fixed the pop-up at `PartnerMoodView.tsx:361`, and story 4 replaced the birthday cards that took first names from `relationshipDates.ts`.
- **CAP-11**
  - **intent:** Each partner's birthday is stored on their own account and set by them in Settings. The wedding date is one shared couple setting either partner can set, change or clear. Home's birthday and wedding cards read these values; nothing is hard-coded.
  - **success:** When a partner sets their birthday, both phones show the countdown, labelled with that partner's display name, after a refresh. With no wedding date saved, Home shows "Date TBD"; once either partner sets one, both phones count down to it. Offline, both show the last saved values.

## Constraints

- **One mechanism.** A single shared local-copy mechanism serves every data kind. No feature keeps its own cache or loads Supabase straight into screen state. The mechanism exposes a small API, documented in its module header, because every later story plugs into it.
- **Where local copies come from.** Only three sources fill them: server responses, Realtime events, and the user's own writes, confirmed or queued.
- **Retry keys.** A queued write reuses one client-generated key across attempts, backed by a DB `UNIQUE` constraint and `upsert` with `ignoreDuplicates`. Mood keeps `(user_id, created_at)`; love notes keep `idempotency_key`.
- **IndexedDB schema.** Changes go only in `src/services/dbSchema.ts`: bump `DB_VERSION` and gate each branch on whether the store exists. The dead `photos` store is either reused or dropped there.
- **Realtime.** New Realtime work goes through `moodSyncService`'s registry or `sendEphemeralBroadcast()`, never `supabase.channel()` directly.
- **Account checks after an await.** A store write after an `await` re-checks `{ userId, authSessionVersion }`. New account-scoped state goes into `signedOutState()` in the same change.
- **Image cache key.** Images are cached by storage path, never by signed URL. Signed URLs change on every signing and expire after 3600 s.
- **Queued notes and the partner lookup.** Sending a queued love note must not depend on a network partner lookup, because `getPartnerId` returns `null` offline. A failed read is never treated as "unlinked" (`lookupPartnerId`).
- **Where offline behaviour lives.** It lives in app code and is testable with Playwright `setOffline`, because E2E runs Vite in dev mode with no service worker. The service worker may add to it but is never required.
- **New refreshers in the fake-session specs.** Two E2E specs sign in with a fake token, so any server read on a signed-in start gets a 401 there and fails the network-error monitor. Every change that adds a `registerLocalCopy` refresher, or another read on signed-in start, stubs it in both in the same change:
  - `tests/support/harnesses/auth-bootstrap-notification-order.tsx`: register a no-op for the kind next to the others and restore the store's refresher on dispose.
  - `tests/e2e/auth/login.spec.ts`: add the table to the `interceptNetworkCall` loop.

  Stories 6 (#346) and 7 (#347) each failed CI once for missing this. Never add the table to `excludePatterns` in `merged-fixtures.ts` instead, because that would hide real 401s in every spec.
- **Persist version.** Zustand persist `version` stays `0`, which the E2E fixtures pin. A removed settings key is stripped on load through `STALE_PERSISTED_SETTINGS_KEYS` in `useAppStore.ts`.
- **Removed settings.** Remove `notificationTime` and `notifications` (no reminder feature reads them), `APP_CONFIG.defaultPartnerName`, `APP_CONFIG.defaultStartDate` and `PARTNER_NAME` (`src/config/constants.ts`), and `src/config/relationshipDates.ts`.

## Non-goals

- Offline create, edit or delete for anything except mood entries and love-note text.
- Conflict handling beyond last-write-wins.
- Any change to the bundled daily messages.
- Offline sign-in or sign-up.
- A love note with a picture sent offline. It needs a connection; only text queues.
- Daily reminder notifications.
- Changes to partner linking. Search, request and accept already exist server-side; there is no unlink path, and this spec adds none.

## Success signal

Both phones are used normally, then put in airplane mode. Every screen still shows its last-loaded data. A mood and three love notes written offline reach the partner automatically, once each and in order, after the connection returns. Every other action taken offline says it needs a connection.

## Assumptions

- Photos are cached as the existing compressed images (max 2048 px). No new server-side thumbnails are generated.
- The note queue drains while the app is open: at start, on the `online` event, and on an interval. Mood keeps its existing service-worker Background Sync; notes don't need one.
- These landed before this work on main `95e50742`; `brownfield.md` is updated for them and for stories 1 (#340, `581d7c9a`) 2 (#341, `65dabce8`) 3 (#342, `70d75643`), 4 (#343, `21a72147`), 5 (#345, `b76d059c`), 6 (#346, `e0ea8055`), 7 (#347, `cea179df`), 8 (#348, `7cfee5c4`) 9 (#349, `bfea93ad`) and 10 (#350, `719d92dc`):
  - #338 removed the one-time upload, the Pages bridge, `migrationService` and the production-only tables.
  - #339 dropped the dead `photos` IndexedDB store (`DB_VERSION` 11) and completed the `notesSlice` session guards.
- A shared start date needs a couple-level home on the server, because partners are linked only through `users.partner_id`. Story 3 put it in `public.couple_settings`; story 4's wedding date is a column on the same table.
