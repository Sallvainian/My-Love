---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-17'
---

# Step 1: Mode Detection

- **Mode**: Epic-Level
- **Epic**: 3 (Stats & Overview Dashboard)
- **Story**: 3.1 (Couple-Aggregate Stats Dashboard)
- **Design Level**: full
- **Prerequisites**: All met (epic requirements, story with ACs, architecture context)

# Step 3: Risk Assessment

- E3-R01 (SEC, score 6): SECURITY DEFINER RPC data isolation — MITIGATE
- E3-R02 (DATA, score 4): Aggregate SQL accuracy — MONITOR
- E3-R03 (PERF, score 4): RPC performance vs NFR-P3 — MONITOR
- E3-R04 (BUS, score 2): Stale cache — DOCUMENT
- E3-R05 (BUS, score 2): Zero-state handling — DOCUMENT
- E3-R06 (SEC, score 3): Partner detection — DOCUMENT
