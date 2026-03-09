# BMad Epic Development Workflow Reference

## Epic Lifecycle

There are two testing tracks. Choose one per project — they are **not** meant to be combined.

- **Simple Track** — BMM-only. Uses `/bmad-bmm-qa-automate` (Quinn) for lightweight test generation. No test planning, no quality gates, no traceability.
- **TEA Track** — Full test engineering discipline. Uses the TEA module (Murat) for ATDD, coverage expansion, test review, NFR assessment, and traceability gates.

The BMM QA Automate instructions explicitly state: _"For advanced features (risk-based test strategy, test design planning, quality gates, NFR assessment, comprehensive coverage analysis) → Install Test Architect (TEA) module."_

---

### Simple Track (BMM only)

#### Per-Epic

| Step | Command                     | Notes                                      |
| ---- | --------------------------- | ------------------------------------------ |
| SP   | `/bmad-bmm-sprint-planning` | Generate sprint plan for development tasks |

#### Per-Story

| Step | Command                  | Notes                               |
| ---- | ------------------------ | ----------------------------------- |
| CS   | `/bmad-bmm-create-story` | Prepare the story                   |
| DS   | `/bmad-bmm-dev-story`    | Implement the story                 |
| QA   | `/bmad-bmm-qa-automate`  | Generate API + E2E tests (optional) |
| CR   | `/bmad-bmm-code-review`  | Review — if issues, back to DS      |

#### Mid-Sprint (as needed)

| Step | Command                    | Notes                                       |
| ---- | -------------------------- | ------------------------------------------- |
| CC   | `/bmad-bmm-correct-course` | Handle significant mid-sprint scope changes |

#### Per-Epic (end)

| Step | Command                   | Notes                                      |
| ---- | ------------------------- | ------------------------------------------ |
| ER   | `/bmad-bmm-retrospective` | Lessons learned, plan next epic (optional) |

#### Quick View — Simple Track

```
Epic Start
  └─ SP
  │
  ├─ Story 1:  CS → DS → QA → CR
  ├─ Story 2:  CS → DS → QA → CR
  ├─ Story 3:  CS → DS → QA → CR
  │  (CC if scope changes)
  │
Epic End
  └─ ER
```

---

### TEA Track (BMM + TEA module)

#### Per-Epic (start)

| Step | Command                     | Notes                                                                                                                                                      |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SP   | `/bmad-bmm-sprint-planning` | Generate sprint plan for development tasks                                                                                                                 |
| TD   | `/bmad_tea_test-design`     | Dual-mode: system-level (Phase 3) or epic-level (Phase 4). Risk scoring with priority classification. Browser automation exploratory mode for UI discovery |

#### Per-Story

| Step | Command                  | Notes                                                                                                                                             |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| CS   | `/bmad-bmm-create-story` | Prepare the story                                                                                                                                 |
| AT   | `/bmad_tea_atdd`         | Failing acceptance tests before implementation (TDD red phase). Outputs implementation checklist. Browser automation recording mode (skeleton UI) |
| DS   | `/bmad-bmm-dev-story`    | Implement until tests go green                                                                                                                    |
| TA   | `/bmad_tea_automate`     | Expand test coverage post-implementation. Browser automation healing + recording modes. Outputs DoD summary (optional)                            |
| RV   | `/bmad_tea_test-review`  | Audit test quality, 0-100 scoring: Determinism 35pts, Isolation 25pts, Assertions 20pts, Structure 10pts, Performance 10pts (optional)            |
| CR   | `/bmad-bmm-code-review`  | Review — if issues, back to DS                                                                                                                    |

#### Mid-Sprint (as needed)

| Step | Command                    | Notes                                       |
| ---- | -------------------------- | ------------------------------------------- |
| CC   | `/bmad-bmm-correct-course` | Handle significant mid-sprint scope changes |

#### Per-Epic (end)

| Step | Command                   | Notes                                                                                                                             |
| ---- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| NR   | `/bmad_tea_nfr-assess`    | NFR validation (security, performance, reliability, maintainability). Evidence-based PASS/CONCERNS/FAIL with mitigation plans     |
| TR   | `/bmad_tea_trace`         | Traceability matrix + gate decision. P0 requires 100% coverage, P1 ≥90% PASS, overall ≥80%. Two-phase: mapping then gate decision |
| ER   | `/bmad-bmm-retrospective` | Lessons learned, plan next epic (optional)                                                                                        |

#### Quick View — TEA Track

```
Epic Start
  └─ SP → TD
  │
  ├─ Story 1:  CS → AT → DS → TA → RV → CR
  ├─ Story 2:  CS → AT → DS → TA → RV → CR
  ├─ Story 3:  CS → AT → DS → TA → RV → CR
  │  (CC if scope changes)
  │
Epic End
  └─ NR → TR → ER
```

---
