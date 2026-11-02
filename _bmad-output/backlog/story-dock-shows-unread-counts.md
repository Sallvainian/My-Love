---
id: 4
type: story
title: "The dock shows unread counts on its buttons"
parent:
covers: []
after: []
refined: false
hitl: false
risk: medium
---

# The dock shows unread counts on its buttons

## Description

The dock (the row of Home, Mood, Love Notes, Photos and Partner buttons, and the side-column capsule on iPhone Duo) can already draw a small count badge on each button from `AppNavigation`'s `badgeCounts` prop, but its only caller in `App.tsx` passes none, so no badge has ever shown. The owner wants unread counts there, for example the number of love notes not yet seen on Love Notes. Which buttons get a count, and what counts as unread for each, is for refinement.

## References

- ledger — _bmad-output/initiative-my-love/deferred-work.md, DW-327 (closed into this story 2026-11-02)
- code — src/components/Navigation/AppNavigation.tsx (`badgeCounts`); src/App.tsx (`<AppNavigation>`); the interactions slice already keeps a client-side count of unviewed pokes and kisses (`unviewedCount`)

## Notes

- Decision: 2026-11-02 the owner asked for unread counts on the dock ("yeah something like that") when DW-327 was triaged.
- Open question: which destinations carry a count (Love Notes unread notes, Partner unviewed pokes and kisses, others?), and when a count clears.
