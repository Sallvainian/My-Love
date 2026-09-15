# CI Baseline

The numbers this removal is judged against, and an honest account of what it can and cannot speed up.

## Historical baseline — run 32279178457

All figures in this table are measured from **run 32279178457** (branch `feature/dynamic-events`, conclusion `success`) unless labelled an estimate. They describe the suite **before** `820be2d2` deleted the dedicated scripture tests. They are **not** "today".

## Job times (historical)

| Job | Total | Supabase setup | Test step |
|---|---|---|---|
| E2E (Shard 1/4) | 255s | 150s | 72s |
| E2E (Shard 2/4) | 257s | 148s | 75s |
| E2E (Shard 3/4) | **381s** | 177s | **174s** |
| E2E (Shard 4/4) | 251s | 144s | 73s |
| Burn-In (Shard 1/3) | 493s | 152s | — |
| Burn-In (Shard 2/3) | 402s | 148s | — |
| Burn-In (Shard 3/3) | **656s** | 130s | — |
| Database Tests | 185s | — | — |
| Backend Tests (api) | 196s | — | — |
| Backend Tests (integration) | 164s | — | — |
| Unit Tests | 52s | — | — |
| Lint & Type Check | 40s | — | — |
| **Run total** | **13.2m** | | |

## Two things that bound the win (still true)

**1. The Supabase startup floor.** Every E2E and burn-in job spends 130-177s starting local Supabase before a single test runs. Removing scripture does not touch it. It is the reason the fastest possible E2E shard is around 3 minutes no matter how few tests remain, and it is explicitly out of scope (see SPEC non-goals).

**2. Burn-in is not scripture-driven.** The longest job in this historical run — Burn-In shard 3 at 656s — burned in `home/error-boundary.spec.ts`. Shards 1 and 2 ran `auth/login.spec.ts` and `auth/logout.spec.ts`. Burn-in runs whichever E2E specs the branch changed, five times each, so its cost tracks the diff and not the feature. Removing leftover scripture comments or the app does not shorten it.

## What the dedicated-test deletion already changed

Scripture used to own the suite's two slowest tests and the entire slow shard:

```
scripture-reconnect-4.3.spec.ts  should resync reconnecting partner ...   42.1s
scripture-reconnect-4.3.spec.ts  should show disconnect overlay ...       40.6s
scripture-reading-4.2.spec.ts    should revert lock-in ...                19.1s
scripture-reading-4.2.spec.ts    should alternate roles after step ...    18.6s
scripture-reading-4.2.spec.ts    should transition to reflection ...      18.1s
```

Shard 3's 174s test step against 72-75s for the others was entirely this. Of the 220 E2E tests then, 144 were scripture.

**That suite is already gone.** Commit `820be2d2` deleted the 14 E2E specs. The dedicated-test CI win is already banked. Do not describe 144 of 220, or a 381s scripture-driven shard, as the current suite.

## Current remaining E2E (2026-09-15, `main`)

Measured, not estimated:

- `find tests/e2e -name '*.spec.ts' | wc -l` → **37** spec files
- `rg -c "^\s*(test|it)\(" tests/e2e --glob '*.spec.ts'` summed → **107** `test(`/`it(` matches
- `tests/e2e/scripture/` is absent

Stories 1–4 will not delete those 37 specs. CAP-6 measures a green run after that remaining removal, then chooses a shard count from those numbers.

The August estimate of a ~220s worst shard assumed ~76 surviving tests. That arithmetic is historical. Do not pick a shard count from it.

## How to verify (CAP-6)

1. After stories 1–4 land, take the first fully green run on the branch.
2. Pull per-job times:
   ```sh
   gh run view <RUN_ID> --json jobs | jq -r '.jobs[] | "\(.conclusion)\t\((.completedAt|fromdate)-(.startedAt|fromdate))s\t\(.name)"'
   ```
3. Pull the setup-vs-test split within each E2E job:
   ```sh
   gh run view <RUN_ID> --json jobs | jq -r '.jobs[] | select(.name|test("E2E")) as $j | $j.steps[] | "\($j.name)\t\(.name)\t\((.completedAt|fromdate)-(.startedAt|fromdate))s"'
   ```
4. Record the worst-shard number against the **historical** 381s baseline here. State clearly that 381s is run `32279178457`, not the pre-story-5 current run.
5. Only then choose the shard count. Per-shard setup still dominates, so fewer shards likely costs little wall-clock while cutting runner minutes — but decide from the measured numbers, not from this paragraph.

The existing rationale comment at `.github/workflows/test.yml:343-347` records why the split is 4 today (moved from August's 231-235) and is the precedent for how to record the new decision. The burn-in comment at line 414 still names deleted scripture spec files (`scripture-reflection-2.2-errors`, `scripture-stats`); CAP-6 rewrites that comment, it does not restructure the burn-in job.

`playwright.config.ts:102-105` still describes scripture specs sorting into one contiguous block. That comment is stale; rewrite it when recording the new shard decision.
