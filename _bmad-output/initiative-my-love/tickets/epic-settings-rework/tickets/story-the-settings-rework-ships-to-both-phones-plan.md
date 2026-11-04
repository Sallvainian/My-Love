---
title: "The Settings rework ships to both phones"
ticket: 17
status: done
---

How each was checked:

1. Shell: built from main `3895b3c0` (every swipe fix, `a9906618` the last) and installed over the top on the owner's Duo at build number 1 on 2026-11-04; no native file changed on main since. The partner's iPhone had not had the reinstall when the epic closed; the owner marked it done on 2026-11-04 (retrospective action item 2).
2. Flow 1 (fix an event date from Home, Duo folded): the owner, on the Duo. The first run failed: a swipe from the Dates page did not go back to Home, because a live update applied on Home had turned the back swipe off on every page above Home. That led to `69dfb58c`. After the fix it passed.
3. Flow 2 (Remind me on a birthday): the iPhone Duo simulator, signed in as the partner fixture. Remind me turned on, "A month and a week before." showed under it, and it was still on after a relaunch. Not run on the partner's iPhone.
4. Flow 3 (log out of all devices): the simulator, with the test accounts so the partner's phone stayed signed in. The confirmation showed and Log out everywhere went to the sign-in screen.
5. Flow 4 (add an anniversary from Dates, Duo folded): the owner, on the Duo. Passed.
6. DW-425's real-finger cases 1 and 2: the owner, on the Duo. Both passed; DW-425 is closed.
