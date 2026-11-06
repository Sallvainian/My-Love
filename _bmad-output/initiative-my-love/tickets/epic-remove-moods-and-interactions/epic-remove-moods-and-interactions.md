---
type: epic
title: "Remove Moods and Poke/Kiss/Fart"
parent: initiative-my-love
covers: ["R15", "R16", "R19"]
sources: []
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md"]
after: []
refined: false
risk: high
---

# Remove Moods and Poke/Kiss/Fart

## Description

Once Daily and the new Partner page have replaced them, the mood system and Poke/Kiss/Fart go entirely: the check-in, Timeline, Calendar, partner mood card and recent moods; the interaction tiles and history; mood realtime; the mood, poke and kiss pushes and Settings switches (R19's removal part; epic 8 adds the new ones); every stored mood and interaction row on the server; and each device's mood and interaction copies, unsent moods included. `moodSyncService` also carries the shared Realtime registry and the partner-linked signal, which keep working (C3). It runs after epics 6 to 9, which change the same screens, `send-push`, the Settings notifications page and the database types.

## Outcome

The app carries no code or data for features the couple no longer uses. Signal: no mood or interaction row on the hosted database after the deploy.

## Done when

- Production has no mood or Poke/Kiss/Fart screen, push kind or Settings switch.
- The hosted database has no mood or interaction rows or tables after the deploy, hosted-only objects included.
- A device upgraded from the old build keeps no mood or interaction copy, unsent moods included.
- Partner linking still updates the other partner live.
- `tests/unit/stores/signOutClearsAccountState.test.ts` is no longer in `excludeGlobs` in `.tea/enforce-config.json`, and the TEA hook reports no H5 for any file it was split into.
- Shipped to production through `deploy.yml`.

## Boundaries

- Must not change: the partner-linked signal and the refcounted Realtime registry in `moodSyncService`; sign-out's deletion of every other account copy.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- C3 — parent, section Constraints

## Notes

- Waits on epic 6 because: Daily takes the dock slot Mood held.
- Waits on epic 7 because: the Partner page must stop reading moods and interactions first.
- Waits on epic 8 because: both change `send-push` and the Settings notifications page.
- Waits on epic 9 because: both add migrations and regenerate the database types.
- Decision (2026-11-06): the story that removes the mood and interaction cases from `tests/unit/stores/signOutClearsAccountState.test.ts` also splits that file by subject, so each file it leaves is under the 1,000-line limit of TEA's write-time hook (rule H5, `.claude/hooks/tea-enforce.cjs`; ledger DW-466). The file is 1,069 lines on main and 1,088 once epic 6's cases land, and removing the mood and interaction cases alone would leave it barely under the limit. That story also removes the file from `excludeGlobs` in `.tea/enforce-config.json`, which excludes it from the hook until the split lands.
