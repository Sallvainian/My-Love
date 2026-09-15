# Baseline

- Branch: `fix/connection-recovery-user-facing`, created from `main` at
  `3f0d951bc52ce0257a6db34d9f6091a8a1dc619c` (the merge of PR #300, session 1).
- Working tree clean at branch creation; `git status --short --branch` reported only the branch line.
- Node v24.19.0. Local Supabase already running (API 54321, DB 54322); not reset or reconfigured.
- Installed SDK versions the realtime work is measured against, read from `node_modules`:
  `@supabase/realtime-js` 2.116.0, `@supabase/phoenix` 0.4.5, `@supabase/auth-js` 2.116.0,
  `@supabase/supabase-js` 2.116.0.
- No bmad-loop run owns this work: the My-Love run `20260914-184113-c59d` has a dead `engine.pid`
  (97280, not running) and an empty `worktrees/`. The only live loop is on another project.
- Preserved and untouched: the two `attempt-preserve/*` branches, `gh-pages`, all `.bmad-loop/`
  state, and the Cursor worktree at `~/.cursor/worktrees/My-Love/ehh`.
