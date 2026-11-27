# Push copy and switches

Three daily pushes remain (epic 11, story 2; the owner's 2026-11-26 and 2026-11-27 decisions). Every push has the title and body below. `{Partner}` is the other partner's display name, or the sender's existing fallback "Your partner". The nudge and the 8 PM reminder play the default notification sound (`sound: default`, as date reminders do); the both-answered push plays none, like every other push. Every push keeps the badge (unread love notes), as every push does, and the `partner-activity` lock-screen group, as every push but a love note does. A tap on any of them opens Daily. Source: design, board `Notification.dc.html` (screen The nudges), except where marked.

| Kind | When | Title | Body |
| --- | --- | --- | --- |
| `daily_nudge` | The partner nudged (story 11.1; sent at once, or held until the recipient's 8 AM) | {Partner} nudged you | {Partner} answered the daily question and wants to know your answer! |
| `daily_reminder` | 8 PM on the recipient's clock, the recipient has not answered (stored `evening_self`; owner, 2026-11-26) | Time's running out! | Answer your daily question before the day is over! |
| `daily_both_answered` | The partner answered second, on the day or after it (owner, 2026-11-27: one wording, no streak and no late-pick case) | You both answered today's question | Click to see what your partner answered! |

Nothing else about the day's question is pushed: there is no 8 AM new-question push, no push when the partner answers first (the only push that answer can lead to is a nudge the person sends), and no 8 PM push to someone who has answered, whether or not their partner has. The kinds `daily_question` and `daily_partner_picked`, and the stored reminder kinds `morning` and `evening_partner`, are gone: the sender answers 400 to a post of either kind, and `daily_reminders` allows `evening_self` alone.

## Settings > Notifications

The three daily switches sit under "Notify me about", after Partner requests, each on by default (labels approved 2026-11-25):

| Switch | Kind |
| --- | --- |
| Nudges | `daily_nudge` |
| Evening reminder | `daily_reminder` |
| Both answered | `daily_both_answered` |

The `push_preferences.daily_question` and `daily_partner_picked` columns stay in the database, unread and unwritten by the app and by `send-push`, so builds installed before story 11.2 keep loading and saving their Settings; epic 10 drops them (DW-548).
