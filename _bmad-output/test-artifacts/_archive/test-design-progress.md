---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-20'
---

# Step 1: Mode Detection

- **Mode**: Epic-Level
- **Epic**: 4 (Together Mode — Synchronized Reading)
- **Stories**: 4.1 (Lobby, Role Selection & Countdown), 4.2 (Synchronized Reading with Lock-In), 4.3 (Reconnection & Graceful Degradation)
- **Design Level**: full
- **Prerequisites**: All met (epic requirements, 3 stories with ACs, architecture context available)

# Step 3: Risk Assessment

- E4-R01 (TECH, score 6): Lock-In RPC concurrency — MITIGATE
- E4-R02 (TECH, score 6): Stale broadcast ingestion / anti-race — MITIGATE
- E4-R03 (DATA, score 6): Incomplete 409 rollback — MITIGATE
- E4-R04 (TECH, score 6): Presence TTL false positive — MITIGATE
- E4-R05 (BUS, score 6): Reconnection snapshot miss — MITIGATE
- E4-R06 (SEC, score 6): Broadcast channel authorization gap — MITIGATE
- E4-R07 (BUS, score 4): Countdown clock drift — MONITOR
- E4-R08 (BUS, score 4): Solo fallback channel leak — MONITOR
- E4-R09 (DATA, score 4): Role alternation off-by-one — MONITOR
- E4-R10 (BUS, score 4): Accessibility countdown — MONITOR
- E4-R11 (BUS, score 3): No-shame language compliance — DOCUMENT
- E4-R12 (PERF, score 2): Presence heartbeat overhead — MONITOR
- E4-R13 (OPS, score 2): Channel cleanup at session end — MONITOR
