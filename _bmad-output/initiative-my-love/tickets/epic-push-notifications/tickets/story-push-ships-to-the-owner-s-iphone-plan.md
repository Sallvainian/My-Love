---
title: "Push ships to the owner's iPhone"
ticket: 11
status: done
---

## Result

Run by the owner with the coordinator on 2026-11-01 (06:30–07:20 UTC), against production after PR #431 merged as `1b08965e`.

**Ship:** deploy run `41281199857` on `1b08965e`: Apply Migrations, Deploy Edge Functions, build, deploy and health-check all succeeded; `updates/latest.json` names `1b08965e`. Hosted, read-only: the five push tables and 11 push triggers exist.

**Install:** a shell built from `1b08965e` (`fnox exec -- npm run ios:sync`, then `xcodebuild` Debug with `CURRENT_PROJECT_VERSION=2`) installed over the existing shell on the owner's iPhone with `xcrun devicectl device install app`; never uninstalled. The owner signed out of their own account online and signed in as Claude Bot; the partner side was the website signed in as Claude Partner (headed Playwright).

**Done when, on the owner's iPhone:**
- Love note: "Claude Partner / Push check 3.11 note one" shown, badge 1.
- Badge clears: opening Love Notes cleared it. With Love Notes in front, a partner note showed in the thread with no banner and left no badge (settles DW-361 on a device: the 1 s second clear held).
- Mood ("Logged a mood: Grateful"), poke ("Poked you"), kiss ("Sent you a kiss"), photo ("Added a photo") and date ("Added an event: Push check trip") each shown; badge stayed 0.
- Notification Center held two My Love stacks: love notes, and everything else.
- Taps: the photo opened Photos, the mood Partner, a love note Love Notes, the event Home, the kiss Partner.
- Switches: with all six off (hosted `push_preferences` row all false), a love note, a photo and an event pushed nothing (no `push_requests` row) and the phone showed nothing. Switched back on, the next note pushed with badge 2 (it and the one sent while off).
- Sign-out: an online sign-out removed the device's registration (0 rows for Claude Bot), and the next note to Claude Bot pushed nothing.
- Website: Settings shows no push section, no console errors. CI on `1b08965e`: Tests, CodeQL, Lighthouse and Deploy succeeded (Dependabot Updates fails on the repo-wide `minimatch` alert, as on every run since 2026-10-31).

**Not checked on the device, by the owner's decision (2026-11-01), relying on the stories' own simulator checks:** partner request and acceptance pushes (story 3.6), an older shell updated by live update (story 3.7), the Home Screen web app. Not exercised alone: the moods switch (a second mood the same day updates the row, and an update never pushes) and the pokes and kisses switch (the app's 20-minute cooldown); the owner recorded pokes and kisses as working.

**Cleanup (owner approved):** the test rows between the fixture accounts deleted: 6 love notes, 1 mood, 2 interactions, 2 photos and their storage objects, 2 events, 2 date changes and 9 `push_requests`. The owner signed back in to their own account.

**Found:** DW-363 (a picture-only love note is refused) holds on production too: hosted `love_notes_content_check` is `char_length(content) >= 1 AND <= 1000`.
