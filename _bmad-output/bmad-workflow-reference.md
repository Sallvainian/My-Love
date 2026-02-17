# BMad Epic Development Workflow Reference

## Epic Lifecycle

There are two testing tracks. Choose one per project — they are **not** meant to be combined.

- **Simple Track** — BMM-only. Uses `/bmad-bmm-qa-automate` (Quinn) for lightweight test generation. No test planning, no quality gates, no traceability.
- **TEA Track** — Full test engineering discipline. Uses the TEA module (Murat) for ATDD, coverage expansion, test review, NFR assessment, and traceability gates.

The BMM QA Automate instructions explicitly state: *"For advanced features (risk-based test strategy, test design planning, quality gates, NFR assessment, comprehensive coverage analysis) → Install Test Architect (TEA) module."*

---

### Simple Track (BMM only)

#### Per-Epic

| Step | Command | Notes |
|------|---------|-------|
| SP | `/bmad-bmm-sprint-planning` | Generate sprint plan for development tasks |

#### Per-Story

| Step | Command | Notes |
|------|---------|-------|
| CS | `/bmad-bmm-create-story` | Prepare the story |
| DS | `/bmad-bmm-dev-story` | Implement the story |
| QA | `/bmad-bmm-qa-automate` | Generate API + E2E tests (optional) |
| CR | `/bmad-bmm-code-review` | Review — if issues, back to DS |

#### Mid-Sprint (as needed)

| Step | Command | Notes |
|------|---------|-------|
| CC | `/bmad-bmm-correct-course` | Handle significant mid-sprint scope changes |

#### Per-Epic (end)

| Step | Command | Notes |
|------|---------|-------|
| ER | `/bmad-bmm-retrospective` | Lessons learned, plan next epic (optional) |

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

| Step | Command | Notes |
|------|---------|-------|
| SP | `/bmad-bmm-sprint-planning` | Generate sprint plan for development tasks |
| TD | `/bmad_tea_test-design` | Dual-mode: system-level (Phase 3) or epic-level (Phase 4). Risk scoring with priority classification. Browser automation exploratory mode for UI discovery |

#### Per-Story

| Step | Command | Notes |
|------|---------|-------|
| CS | `/bmad-bmm-create-story` | Prepare the story |
| AT | `/bmad_tea_atdd` | Failing acceptance tests before implementation (TDD red phase). Outputs implementation checklist. Browser automation recording mode (skeleton UI) |
| DS | `/bmad-bmm-dev-story` | Implement until tests go green |
| TA | `/bmad_tea_automate` | Expand test coverage post-implementation. Browser automation healing + recording modes. Outputs DoD summary (optional) |
| RV | `/bmad_tea_test-review` | Audit test quality, 0-100 scoring: Determinism 35pts, Isolation 25pts, Assertions 20pts, Structure 10pts, Performance 10pts (optional) |
| CR | `/bmad-bmm-code-review` | Review — if issues, back to DS |

#### Mid-Sprint (as needed)

| Step | Command | Notes |
|------|---------|-------|
| CC | `/bmad-bmm-correct-course` | Handle significant mid-sprint scope changes |

#### Per-Epic (end)

| Step | Command | Notes |
|------|---------|-------|
| NR | `/bmad_tea_nfr-assess` | NFR validation (security, performance, reliability, maintainability). Evidence-based PASS/CONCERNS/FAIL with mitigation plans |
| TR | `/bmad_tea_trace` | Traceability matrix + gate decision. P0 requires 100% coverage, P1 ≥90% PASS, overall ≥80%. Two-phase: mapping then gate decision |
| ER | `/bmad-bmm-retrospective` | Lessons learned, plan next epic (optional) |

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

## Model Selection by Task Type

Recommendations based on task characteristics matched to model strengths. Data sourced from SWE-bench, Terminal-Bench 2.0, and real-world production coding tests as of February 2026.

### Model Landscape (Key Stats)

| Model | SWE-bench | Terminal-Bench 2.0 | Context Window | Strengths |
|-------|----------:|-------------------:|---------------:|-----------|
| Claude Opus 4.6 | 80.8% (Verified) | 65.4% | 200K (1M beta) | Highest SWE-bench, 128K max output, sustained agentic tasks, best debugging and code review |
| GPT-5.3-Codex | 56.8% (SWE-Pro) | 77.3% | 400K | Highest Terminal-Bench, 25% faster than 5.2, best agentic coding, cybersecurity (77.6% CTF) |

### Workflow-to-Model Mapping

**Primary rule:** Claude Opus 4.6 writes code. GPT-5.3-Codex reviews it. Cross-model validation catches blind spots that same-model review misses.

#### Simple Track

| Workflow | Model | Notes |
|----------|-------|-------|
| **SP** — Sprint Planning | Claude Opus 4.6 | 1M beta context fits full PRD + architecture + all stories |
| **CS** — Create Story | Claude Opus 4.6 | Technical spec from architecture + sprint plan |
| **DS** — Dev Story | Claude Opus 4.6 | Core implementation, highest SWE-bench accuracy |
| **QA** — QA Automate | Claude Opus 4.6 | Test generation |
| **CR** — Code Review | GPT-5.3-Codex | Cross-model validation |
| **ER** — Retrospective | Claude Opus 4.6 | Reviews all completed work across the epic |

#### TEA Track

**Code Generation** — Claude Opus 4.6 leads SWE-bench Verified (80.8%). Use for all code-writing tasks.

| Workflow | Model | Notes |
|----------|-------|-------|
| **SP** — Sprint Planning | Claude Opus 4.6 | 1M beta context for full project artifacts |
| **TD** — Test Design | Claude Opus 4.6 | Epic-wide test strategy needs holistic view |
| **CS** — Create Story | Claude Opus 4.6 | Technical spec from architecture + sprint plan |
| **AT** — ATDD | Claude Opus 4.6 | Precise failing tests from acceptance criteria |
| **DS** — Dev Story | Claude Opus 4.6 | Core implementation |
| **TA** — TEA Automate | Claude Opus 4.6 | Coverage expansion |

**Validation and Audit** — cross-model diversity. GPT-5.3-Codex reviews code that Claude wrote.

| Workflow | Model | Notes |
|----------|-------|-------|
| **CR** — Code Review | GPT-5.3-Codex | Cross-model review catches Claude's blind spots |
| **RV** — Test Review | GPT-5.3-Codex | Cross-model audit |
| **NR** — NFR Assessment | GPT-5.3-Codex | Cross-model validation |
| **TR** — Traceability | Claude Opus 4.6 | Maps every requirement to every test across the epic |
| **ER** — Retrospective | Claude Opus 4.6 | Reviews all completed work |

### Cost Considerations

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Notes |
|-------|-----------------------:|------------------------:|-------|
| Claude Opus 4.6 | $5.00 | $25.00 | Long-context (200K+): $10/$37.50. 1M beta available at usage tier 4 |
| GPT-5.3-Codex | TBD | TBD | API pricing not yet announced as of Feb 2026 |

---

## Sources

- [Introducing Claude Opus 4.6 — Anthropic](https://www.anthropic.com/news/claude-opus-4-6)
- [Claude Opus 4.6 Benchmarks — Vellum](https://www.vellum.ai/blog/claude-opus-4-6-benchmarks)
- [Claude Opus 4.6 Features and Benchmarks — Digital Applied](https://www.digitalapplied.com/blog/claude-opus-4-6-release-features-benchmarks-guide)
- [Introducing GPT-5.3-Codex — OpenAI](https://openai.com/index/introducing-gpt-5-3-codex/)
- [GPT-5.3-Codex Benchmarks — Neowin](https://www.neowin.net/news/openai-debuts-gpt-53-codex-25-faster-and-setting-new-coding-benchmark-records/)
- [Claude Opus 4.6 vs GPT-5.3-Codex — Vertu](https://vertu.com/ai-tools/claude-opus-4-6-vs-gpt-5-3-codex-head-to-head-ai-model-comparison-february-2026/)
- [Best AI for Coding 2026 SWE-Bench Breakdown — marc0.dev](https://www.marc0.dev/en/blog/best-ai-for-coding-2026-swe-bench-breakdown-opus-4-6-qwen3-coder-next-gpt-5-3-and-what-actually-matters-1770387434111)
