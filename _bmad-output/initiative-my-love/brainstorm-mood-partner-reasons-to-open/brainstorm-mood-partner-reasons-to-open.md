# Intent: Daily this-or-that question with a shared streak

Source: brainstorming session log `.memlog.md` (status complete, 2026-11-05). Owner = Casey (builds the app); partner = Jessie.
Mock-up canvas (12 phone screens, approved by the owner as it stands): https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh
Screens: today unanswered, waiting on partner, streak +1 animation, reveal, write tomorrow's question, missed day, 25-day milestone, notifications, Partner page, past questions, Love Notes replying, Love Notes reply sent.

## Why

- The Mood and Partner pages are read-only mirrors: you log into a void and read the other person's log, so nothing is ever waiting for you. The reason to open is an open loop from your partner.
- The owner sees no value in logging a mood ("you can just say it over text") and wants the page reworked.
- The owner says streaks (Snapchat, TikTok, Duolingo) are what bring people back. This overrules the session's earlier "streaks are guilt" view.
- Answering blind and revealing together is the mechanic that gives each person a reason to open.

## Decided (owner's word)

**The daily question**
- Each day the couple gets one question, and answering it is the main thing you do on the page.
- Answers are multiple choice: simple this-or-that preferences (cold or hot, winter or summer, coffee or tea, hiking or movie night), framed as how well you know each other.
- Each person picks only their own option. There is no guessing the partner's answer (this replaces the coach's pick-and-guess flow).
- Your partner's answer stays hidden until you have answered too.
- There is no mood step. Moods are dropped completely; the owner says they serve no purpose.
- The question pool must be large, because a small pool runs out. The coach writes it.
- Each day a person is asked "Write tomorrow's question?". Yes lets them type one. No gives a random question from the pool.

**Streak**
- The couple shares one streak.
- Colours: grey until today's question is done, fire orange once it is done, blue (cold) on a missed day.
- A missed day never resets the streak. The count holds at its value, does not go up, and stays blue through missed days in a row.
- A second counter shows the current run: days in a row with no misses. It resets to zero on a miss and is shown next to the held total.
- After each finished day, a short Duolingo-style animation shows the streak going up by one.
- Milestones come every 25 days (25, 50, 75, 100, 125 and so on). This replaces the coach's 7/30/100.
- The milestone symbol is an emoji-style heart wrapped in flames, animated so the flames flicker and the heart beats. Drawings with the flames behind the heart were rejected. The owner approved the milestone screen layout. The flaming heart appears only on milestones; the streak counter, the +1 animation and the dock keep the plain flame.
- The milestone reward is the badge itself: each milestone has a flaming-heart badge, greyed out while locked and in full colour once reached.

**Reveal and reply**
- The reveal has one action, Reply in Love Notes, which spans the full width of its card. There is no send-a-heart button.
- Reply opens Love Notes with the reply visibly attached to that day's question, like replying to a specific message in iPhone Messages.

**Partner page**
- The Partner page becomes the home of the streak and the past questions. They replace the partner's mood card and the recent-moods list.
- Poke, Kiss and Fart are removed completely.
- Past questions mark each day Same (both picked the same option) or Different, with a running count ("Same pick on 9 of your 13 days"). This is the "how well you know each other" measure; the milestone recap reuses it.

## Mock-up assumptions (from the coach; the owner has not contradicted them)

- The Mood dock tab becomes **Daily**.
- A day counts toward the streak only when both partners have picked. That makes "done" and "missed" mean both partners, which the owner's colour rule does not say.
- The waiting screen has a **Nudge** button that sends the partner a push.
- Notifications:
  - a new question at 8 AM
  - the partner has picked
  - the partner nudged you
  - an 8 PM reminder when nobody has answered
  - both have answered
- Push copy pattern: "Jessie answered - answer to see it and keep your 14-day streak".
- Write tomorrow's question takes two options (This / That), or "No thanks, pick one for us".
- The +1 animation plays at once for whoever answers second, and on the next open for whoever answered first.
- Question bank details (the owner decided only that the coach writes it):
  - about 500 this-or-that questions, more than a year without a repeat
  - no question repeats until every question has been used
  - questions partners write are added to the pool

## Open questions

None blocking. One note:

- Not taken up: the streak freeze (one free missed day a month) is missing from the owner's keep list. The held count already means a miss never wipes out the streak.

## Consequences for existing code

- The whole mood system is removed, and all stored mood history is deleted (owner's decision):
  - the mood check-in (12 moods, note, Timeline, Calendar)
  - the partner's mood card and recent-moods list
  - mood realtime and mood notifications
  - mood rows on the server and the device's offline mood copies
- Poke/Kiss/Fart and their interaction history are removed too.
- The hidden answer must be enforced by the server: RLS withholds the partner's answer row until your own exists. Hiding it in the UI is not enough.
- Push (`send-push`) and Broadcast realtime already exist, so the nudge, "partner picked" and "both answered" can be built on them.
- Love Notes needs a reply that carries a link to a day's question and shows it attached.
- Renaming Mood to Daily keeps the dock at five destinations, so no sixth slot is needed.
