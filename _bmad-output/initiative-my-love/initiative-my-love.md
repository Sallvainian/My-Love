---
type: initiative
title: "My-Love"
sources: []
companions: []
after: []
status: in-progress
risk: low
---

# My-Love

## Description

My-Love is a progressive web app for couples: daily messages, mood tracking, photos, love-notes chat and partner interactions, deployed at https://my-love.sallvain.workers.dev/. This initiative holds every epic of the product. The project has no PRD or product brief, so its Requirements, Constraints and Done when are written once one exists.

## Outcome

Two partners share daily messages, moods, photos and notes in one app that keeps working offline; no source states a success signal yet.

## References

- project-context — AGENTS.md, section My Love

## Notes

- Open question: the project has no PRD or product brief, so this initiative has no Requirements, Constraints or Done when; `bmad-prd` or `bmad-product-brief` supplies them. The owner decides when.
- Decision: 2026-10-28 epic-test-review-remediation reopened with stories 10–12. Its 2026-10-03 re-reviews still report findings, and its Done when now requires the 2026-10-03 rows fixed and no Critical or High on fresh folder re-reviews, instead of zero findings, because the reviewer varies between runs.
- Decision: 2026-10-30 epic 2 retitled "iPhone Duo Side-Column Dock" and its description rewritten: the owner's Duo shows the shell drawing web content into the side column, so the native tab bar was dropped for the app's own HTML dock in the column (see the epic's Notes). Its folder slug stays `epic-iphone-duo-native-tab-bar`.
- Decision: 2026-10-30 after the Duo replan dropped stories 2.1 and 2.3, epic 3 waits on epic 2 only through story 3.1 on story 2.7 (its live-update simulator setup and its answer on whether the side column needs native code), and epic 4 no longer waits on epic 2: the Duo sweep and ship (2.4, 2.5) no longer share the Xcode project or a shell install. If story 2.7 finds native code is needed, 3.1 also waits on 2.2 and epic 4 gets epic 2 back (4.1 on 2.4, 4.5 on 2.5).
