# UI Test Findings — 2026-03-20

Tested with two accounts: `claude-bot@test.example.com` (user1) and `claude-bot-partner@test.example.com` (user2) on production site (`https://sallvainian.github.io/My-Love/`).

## Home Dashboard

- **OK**: Time Together countdown (151 days) — live updating, accurate
- **OK**: Frank's Birthday (111 days), Gracie's Birthday (355 days) — countdowns working
- **OK**: Wedding — shows "Date TBD" with XX:XX:XX placeholder
- **ISSUE**: "Next Visit" (November) and "Following Visit" (December) both show **"Event passed"** — stale events that should be updated or hidden
- **OK**: Daily love message with favorite/share buttons, swipe hint, welcome replay button

## Love Notes (Chat)

- **FIXED**: Chat scrolled to top on re-entry — now scrolls to bottom (committed `76b22b2`)
- **OK**: Message sending, real-time sync, empty state, timestamps, input with attach

## Mood Tracker — State Issues

### BUG: Multi-mood selection only displays first mood everywhere

- **Repro**: Select Excited + Grateful → Log Mood → success toast appears
- **DB**: `mood_types` array correctly stores `["excited", "grateful"]`
- **UI**: Every view only reads `mood_type` (singular text field), ignoring the `mood_types` array
- **Affected views**: Mood Timeline, Mood Calendar, Calendar detail modal, Partner's current mood widget, Partner tab mood history
- **Severity**: Medium — data is saved correctly but never fully displayed

### BUG: No own-mood confirmation after logging

- After logging a mood, the mood selector stays fully active with all buttons unselected
- No "You're feeling: Excited, Grateful" state shown — only feedback is a transient toast
- Navigating away and back shows the same empty selector
- Expected: Show the logged mood and disable/change the selector until tomorrow

### BUG: Duplicate mood entries in database

- Logging mood once created 2 identical rows in `moods` table (same mood_type, mood_types, ~1 min apart)
- These duplicates show in Timeline view as two identical entries
- Also visible in Partner tab mood history
- May be a double-submit from the UI or a realtime echo creating a second insert

### BUG: Partner tab — mood name and date label concatenated

- Partner mood history entries show "ExcitedYesterday" and "HappyWed, Mar 18" — no space or separator between the mood name and the date grouping label
- Affects both users' Partner views

### BUG: Date grouping inconsistency (timezone)

- Moods logged at ~2:40 AM UTC (today, March 20) show as "Yesterday" in both Timeline and Partner views
- The browser's local timezone (US Eastern = UTC-4) means 2:40 AM UTC = 10:40 PM March 19 local, so "Yesterday" is technically correct from the user's perspective
- However, the Calendar shows these moods on March 20 (UTC date), creating an inconsistency between Calendar (UTC) and Timeline/Partner (local time)

## Partner Tab

- **OK**: Real-time connection, partner name, refresh button, FAB menu (Poke/Kiss/Fart/History)
- **OK**: Poke interaction works — "Poke sent! 👆"
- **ISSUE**: Mood name + date label concatenated (see above)
- **ISSUE**: Only shows first mood from multi-select (see above)
- **ISSUE**: Duplicate entries visible from double-submit bug (see above)

## Photos

- **OK**: Empty state with Upload Photo button

## Scripture

- **OK**: Overview with stats, mode selection (Solo/Together), reading flow, bookmark, navigation, exit

## Console Errors

- **0 errors, 0 warnings** across both accounts after full testing session

## Summary

| #   | Issue                                                      | Severity | Location                                                  |
| --- | ---------------------------------------------------------- | -------- | --------------------------------------------------------- |
| 1   | Multi-mood only shows first mood                           | Medium   | Mood Timeline, Calendar, Partner mood widget, Partner tab |
| 2   | No own-mood state after logging                            | Medium   | Mood Log tab                                              |
| 3   | Duplicate mood DB entries on single log                    | High     | Mood service / realtime handler                           |
| 4   | Mood + date label concatenated                             | Low      | Partner tab mood history                                  |
| 5   | Calendar vs Timeline date grouping mismatch (UTC vs local) | Low      | Mood Calendar vs Timeline                                 |
| 6   | Stale visit events on Home                                 | Low      | Home dashboard config                                     |
