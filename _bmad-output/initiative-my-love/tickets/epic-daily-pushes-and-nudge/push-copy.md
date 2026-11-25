# Push copy and switches

Every push has the title and body below. `{Partner}` is the other partner's display name, or the sender's existing fallback "Your partner". `{question}` is worded as Daily words it: "{This} or {that}?". `{held}` and `{run}` come from the recipient's streak (spine AD-7). The nudge and both 8 PM reminders play the default notification sound (`sound: default`, as date reminders do); the other three play none, like every other push. Every push keeps the badge (unread love notes), as every push does, and the `partner-activity` lock-screen group, as every push but a love note does. A tap on any of them opens Daily. Source: design, board `Notification.dc.html` (screen The nudges), except where marked.

| Kind | When | Title | Body |
| --- | --- | --- | --- |
| `daily_question` | 8 AM | {question} | Today's question is here. Day {held + 1} is waiting. |
| `daily_partner_picked` | The partner picked first | {Partner} made their pick | Pick yours to see what they chose. |
| `daily_nudge` | The partner nudged | {Partner} nudged you | Your {held}-day streak needs your pick today. |
| `daily_nudge` | Same, `held` is 0 (approved 2026-11-25) | {Partner} nudged you | Your streak needs your pick today. |
| `daily_reminder` | 8 PM, recipient has not picked (parent R14; wording approved 2026-11-25) | You haven't done your daily yet | {question} It takes two taps. |
| `daily_reminder` | 8 PM, only the recipient has picked (parent R14; wording approved 2026-11-25) | {Partner} hasn't done their daily | Nudge them before midnight. |
| `daily_both_answered` | The partner picked second | {run} days in a row | You both answered. See {Partner}'s pick. |
| `daily_both_answered` | Same, `run` is 1 (approved 2026-11-25) | 1 day in a row | You both answered. See {Partner}'s pick. |
| `daily_both_answered` | Same, `run` is 0 (approved 2026-11-25) | You both answered | See {Partner}'s pick. |
| `daily_both_answered` | A late pick: the day is not the recipient's current date (owner) | as above, by `run` | "See {Partner}'s pick." is replaced by "That day counts." |

The evening row with the mock-up's "Your streak goes cold at midnight" is replaced by parent R14, which decides the 8 PM push by who has picked.

## Settings > Notifications

The five switches sit under "Notify me about", after Partner requests, each on by default (labels approved 2026-11-25):

| Switch | Kind |
| --- | --- |
| New question | `daily_question` |
| Partner picked | `daily_partner_picked` |
| Nudges | `daily_nudge` |
| Evening reminder | `daily_reminder` (both 8 PM variants) |
| Both answered | `daily_both_answered` |
