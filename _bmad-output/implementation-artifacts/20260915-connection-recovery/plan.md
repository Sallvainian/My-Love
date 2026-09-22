---
title: Connection recovery and user-facing behaviour
type: bugfix
created: '2026-09-15'
status: done
route: dispatch
baseline_commit: 3f0d951bc52ce0257a6db34d9f6091a8a1dc619c
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="Approved in conversation 2026-09-15">

## Intent

The second of the two sessions Codex proposed for the remaining deferred work (Codex session
`01a0a34f-8fa6-7181-a65f-7f5a2787f36b`): "Connection recovery and user-facing behavior — realtime
recovery and live mood-delivery coverage; remaining display-name work, login feedback,
production-path tests, and contrast fixes; reconcile bookkeeping after implementation results are
known." Its own instruction was to refresh the list after session 1 finished rather than take the
provisional grouping as given.

Refreshed: `grep -c '^status: open'` returned 24. DW-104, DW-107 and DW-130 had closed since;
DW-135, DW-136 and DW-137 were new. 20 are actionable here; 4 are operator-only.

Treat every entry as a claim to verify, not a requirement to satisfy. A refutation with evidence is
a better outcome than a fix for a defect that cannot occur.

## Boundaries & Constraints

- Branch `fix/connection-recovery-user-facing` at baseline `3f0d951b`. Commit and open a PR; do not
  merge, do not deploy, never `npm run deploy`.
- No loop state touched. No server-schema change. No scripture code — the feature is frozen for
  removal and its modules must not be copied as templates. The Cursor worktree at
  `~/.cursor/worktrees/My-Love/ehh` is not touched.
- The repo is public: no addresses, credentials, or query output holding personal data in
  `_bmad-output/` or any commit message.
- `playwright.config.ts`'s Supabase env block stays unguarded and its shell idioms stay as they are.
- Production build through `fnox exec --`.

## Groups

1. **Realtime channel lifecycle** — DW-109, DW-110, DW-112, DW-113.
2. **Live mood delivery coverage** — DW-123.
3. **Auth feedback** — DW-124, DW-131, DW-132.
4. **Display name and contrast** — DW-133, DW-134.
5. **Test effectiveness** — DW-121, DW-135, DW-136, DW-137.
6. **Production base path** — DW-125.
7. **Ledger bookkeeping** — DW-108, DW-114, DW-115, DW-116, DW-126.
8. **Operator-only** — DW-85, DW-93, DW-98, DW-106. Attempt only what can be done read-only from
   here; leave the rest open with the reason recorded.

## Tasks & Acceptance

- [x] Group 1: CLOSED handled without answering the app's own leaves; the retry ceiling releases
      rather than leaks; the hook reports a status and a consumer renders it; every SDK citation in
      `realtimeSocket.ts` and `moodSyncService.ts` true of the installed version.
- [x] Group 2: a browser spec proving a logged mood reaches the partner live, verified non-vacuous.
- [x] Group 3: a third callback outcome with its own copy; the sign-in dead end guarded at our own
      contract; the reset link pinned at the production base.
- [x] Group 4: the seed-name rule applied at the third reader; both remaining sub-AA destructive
      buttons raised, with a guard that generalises beyond the two.
- [x] Group 5: every entry verified by mutation, not by reading.
- [x] Group 6: both production-only branches reachable and both named mutants killed.
- [x] Group 7: severity restored, six locations repaired, DW-97's resolution completed, ownership
      of ledger edits stated.
- [x] Group 8: DW-85 settled by the read-only count it names. DW-93, DW-98, DW-106 stay open.

</frozen-after-approval>

## Review Triage Log

See `dispositions.md`.
