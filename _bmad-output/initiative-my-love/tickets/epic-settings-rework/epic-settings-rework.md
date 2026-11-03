---
type: epic
title: "Settings Rework"
parent: initiative-my-love
covers: []
sources: [_bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md, _bmad-output/initiative-my-love/ux-settings-page/DESIGN.md, _bmad-output/initiative-my-love/deferred-work.md]
companions: [_bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md, _bmad-output/initiative-my-love/ux-settings-page/DESIGN.md]
after: []
refined: false
risk: medium
---

# Settings Rework

## Description

Today's Settings page is long and disorganized: dates live in three places (Account, Countdowns, a list of reminder switches), date editors are always open with their own Save buttons, some fields spill past the card edge, and labels such as "Pushes" read like engineering. When this epic is done, Settings is a stack of pages: the top page holds only one-line rows (Profile, Partner, Dates, Notifications, Photos, Replay welcome message, Log out, Log out of all devices), each row opens its own page, every field is edited on a one-field page with Save in the bar, and switches save on tap. Each date (events, anniversaries, Together since, Wedding, both birthdays) gets one page that holds its edit, its delete and its Remind me switch, reached from its Home card or from the Dates list, and Home's Add button opens the New event form directly. The owner also decided on 2026-11-02 that adding or changing a date sends no push (DW-416), reversing the date part of epic-push-notifications R1, and the rework is where `settingsSlice.ts` gets split (DW-399). The look and behavior come from the owner's Settings UX run of 2026-11-02, in `ux-settings-page/` beside the initiative file.

## Outcome

The owner and the partner find every setting and every date in one short Settings that looks like a production app. The signal is the four Key Flows in EXPERIENCE.md running end to end on the owner's iPhone Duo and the partner's iPhone.

## Done when

- On the deployed site and in the iOS shell, in the bottom-dock and Duo column forms, every page in EXPERIENCE.md's Information Architecture opens from its row and matches DESIGN.md and EXPERIENCE.md, and back returns exactly one level.
- Every date is edited, deleted where its owner may, and reminded from its own page, reached from its Home card and from the Dates list; Home's Add opens New event; the old Account date fields, the Countdowns section and the reminder-switch list are gone.
- Adding or changing a date sends no push: a migration removes the server-side date-change path, send-push has no date kind, the client has no `dates` push preference or Dates switch, the pgTAP pins match, and `database.types.ts` is regenerated (DW-416 closed; its full list of parts is in Notes).
- `settingsSlice.ts` is split the way this epic's refinement decides (DW-399 closed).
- "Log out" replaces "Sign out" everywhere in the UI.
- The rework is deployed through `deploy.yml` and reaches both installed shells, by live update, or by a reinstall on both phones if any part needs native code. A person runs the Key Flows on the owner's Duo (Flows 1, 3, 4) and on the partner's iPhone with the bottom dock (Flow 2).

## Boundaries

- In this epic beyond Settings: Home's date cards and Upcoming Add button (they open a date's page and the New event form), and the partial log-out notice the login screen shows (its string lives at `src/components/Settings/Settings.tsx:484`).
- Not in this epic: a new dock destination, a second partner connect flow, an unlink action, a two-pane layout, a new palette, and any change to which writes need a connection (EXPERIENCE.md, Interaction Primitives and State Patterns).
- Must not change: when date reminders fire (epic-date-reminders R1–R5), and every push type other than dates.
- Changes epic-date-reminders behavior: a date's Remind me switch is disabled while Date reminders is off (EXPERIENCE.md, State Patterns), where story 4.3 kept the per-date rows usable (`src/components/Settings/CountdownMarks.tsx:8`); the per-date setting is still kept.
- Touch point: the Partner view's connect flow — opened from the not-linked Partner page, unchanged; owner: no epic (it predates the ticket tree).

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md (no Requirements yet; see its Notes)
- design — _bmad-output/initiative-my-love/ux-settings-page/DESIGN.md (how Settings looks)
- design — _bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md (how Settings works)
- design — _bmad-output/initiative-my-love/ux-settings-page/mockups/key-settings-v2.html and key-settings-v1.html (composition; the spines win on conflict)
- deferred work — _bmad-output/initiative-my-love/deferred-work.md, DW-399 (split settingsSlice.ts) and DW-416 (remove the date-change push)

## Notes

- Decision: 2026-11-02 one epic, not two (owner). The likely 12–14 stories run past the usual count; a split into "the Settings stack" and "every date has its own page" was declined because both halves need the same page stack and top page, and the first would ship an interim Settings with the old date editors.
- Decision: 2026-11-02 DW-416 is a story in this epic, ordered early, before any date page, because tap-to-edit saves each field separately and every save would otherwise send a push (owner). It is ordered against the `settingsSlice.ts` split, since both change `PUSH_PREFERENCE_KEYS` (`src/stores/slices/settingsSlice.ts:355`).
- Decision: 2026-11-02 no `bmad-architecture` run (owner). Refining this epic writes `Decision:` lines here for: the subpage URL scheme, what a reload restores, and where back goes from a date page opened from Home; and the `settingsSlice.ts` split boundaries, by domain (DW-399). The edge swipe back is a spike: the shell enables no WKWebView back-forward gesture today (no `allowsBackForwardNavigationGestures` in `ios/` or `capacitor.config.ts`), and turning it on natively needs a reinstall on both phones.
- Decision: 2026-11-02 the foundation story's Done when adds an AGENTS.md rule for adding a Settings subpage (owner).
- Open question: whether DW-416's migration also drops the `date_changes` table and the `push_preferences.dates` column, or only the triggers and function. Settled at refinement.
- Open question: "Linked since" on the Partner page has no data behind it. No column stores a link date; `partner_requests` has only `created_at` and `updated_at` (`src/types/database.types.ts:470-478`). EXPERIENCE.md hides the row when the date is unknown, so without new work it is always hidden. Settled at refinement: derive it, add it, or drop the row.
- Source conflict: DW-416 location — the ledger entry misses parts of the date push: the tap route `date: 'home'` (`src/services/pushNotifications.ts:161`), `date_change_id` in `push_requests_source_check` (`supabase/migrations/20261031040000_push_partner_requests.sql:65-71`), the `dates` pins in `supabase/tests/database/36_push_preferences.sql:109,129,139,161`, and the regenerated `src/types/database.types.ts`. This epic removes them with the entry's own list.
- Open question: the Photos row is hidden on iPhone on the assumption that Safari and the shell never report the connection type; EXPERIENCE.md marks this UNVERIFIED on device. A story checks it on a device.
