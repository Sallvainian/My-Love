# CI Baseline

The numbers this removal is judged against, and an honest account of what it can and cannot speed up. All figures are measured from **run 32279178457** (branch `feature/dynamic-events`, conclusion `success`) unless labelled an estimate.

## Job times

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

## Two things that bound the win

**1. The Supabase startup floor.** Every E2E and burn-in job spends 130-177s starting local Supabase before a single test runs. Removing scripture does not touch it. It is the reason the fastest possible E2E shard is around 3 minutes no matter how few tests remain, and it is explicitly out of scope (see SPEC non-goals).

**2. Burn-in is not scripture-driven.** The longest job in this run — Burn-In shard 3 at 656s — burned in `home/error-boundary.spec.ts`. Shards 1 and 2 ran `auth/login.spec.ts` and `auth/logout.spec.ts`. Burn-in runs whichever E2E specs the branch changed, five times each, so its cost tracks the diff and not the feature. Removing scripture leaves it unchanged.

## What removal does change

Scripture owns the suite's two slowest tests and the entire slow shard:

```
scripture-reconnect-4.3.spec.ts  should resync reconnecting partner ...   42.1s
scripture-reconnect-4.3.spec.ts  should show disconnect overlay ...       40.6s
scripture-reading-4.2.spec.ts    should revert lock-in ...                19.1s
scripture-reading-4.2.spec.ts    should alternate roles after step ...    18.6s
scripture-reading-4.2.spec.ts    should transition to reflection ...      18.1s
```

Shard 3's 174s test step against 72-75s for the others is entirely this. Of the 220 E2E tests, 144 are scripture; the ~76 that survive run at 2-7s each.

## Estimate, to be replaced by measurement

Worst E2E shard is estimated at **~220s** post-removal (150s setup + ~40s tests + ~30s job overhead) against **381s** today — roughly **2.5 minutes** off the E2E critical path.

This is arithmetic on the numbers above, not a measurement. CAP-6 exists to replace it with a real figure from a green post-removal run.

## How to verify (CAP-6)

1. After removal lands, take the first fully green run on the branch.
2. Pull per-job times:
   ```sh
   gh run view <RUN_ID> --json jobs | jq -r '.jobs[] | "\(.conclusion)\t\((.completedAt|fromdate)-(.startedAt|fromdate))s\t\(.name)"'
   ```
3. Pull the setup-vs-test split within each E2E job:
   ```sh
   gh run view <RUN_ID> --json jobs | jq -r '.jobs[] | select(.name|test("E2E")) as $j | $j.steps[] | "\($j.name)\t\(.name)\t\((.completedAt|fromdate)-(.startedAt|fromdate))s"'
   ```
4. Record the worst-shard number against the 381s baseline here.
5. Only then choose the shard count. With ~76 fast tests the test step stops being the binding constraint and per-shard setup dominates, so fewer shards likely costs little wall-clock while cutting runner minutes substantially — but decide from the measured numbers, not from this paragraph.

The existing rationale comment at `.github/workflows/test.yml:231-235` records why the split is 4 today and is the precedent for how to record the new decision.
