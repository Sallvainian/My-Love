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
| TD | `/bmad_tea_test-design` | Epic-level test plan — once when starting a new epic |

#### Per-Story

| Step | Command | Notes |
|------|---------|-------|
| CS | `/bmad-bmm-create-story` | Prepare the story |
| AT | `/bmad_tea_atdd` | Write failing acceptance tests first (TDD red phase) |
| DS | `/bmad-bmm-dev-story` | Implement until tests go green |
| TA | `/bmad_tea_automate` | Expand test coverage (optional) |
| RV | `/bmad_tea_test-review` | Audit test quality, 0-100 scoring (optional) |
| CR | `/bmad-bmm-code-review` | Review — if issues, back to DS |

#### Per-Epic (end)

| Step | Command | Notes |
|------|---------|-------|
| TR | `/bmad_tea_trace` | Traceability matrix + gate decision (PASS/CONCERNS/FAIL/WAIVED) |
| NR | `/bmad_tea_nfr-assess` | NFR validation (performance, security, reliability) |
| ER | `/bmad-bmm-retrospective` | Lessons learned, plan next epic (optional) |

#### Quick View — TEA Track

```
Epic Start
  └─ SP → TD
  │
  ├─ Story 1:  CS → AT → DS → TA → RV → CR
  ├─ Story 2:  CS → AT → DS → TA → RV → CR
  ├─ Story 3:  CS → AT → DS → TA → RV → CR
  │
Epic End
  └─ TR → NR → ER
```

---

## Model Selection by Task Type

Recommendations based on task characteristics matched to model strengths. Data sourced from SWE-bench Verified, Terminal-Bench 2.0, Sonar code quality analysis, and real-world production coding tests as of early 2026.

### Model Landscape (Key Stats)

| Model | SWE-bench Verified | Terminal-Bench 2.0 | Context Window | Strengths |
|-------|-------------------:|-------------------:|---------------:|-----------|
| Claude Opus 4.5 | 80.9% | 59.3% | 200K | Most consistent, defensive code, best debugging |
| GPT-5.2 High | 80.0% | ~47.6% | 400K | Lowest control flow errors (22/MLOC), strong frontend/UI |
| GPT-5.2-Codex | 56.4% (SWE-Pro) | 64.0% | 400K + compaction | Best agentic coding, cybersecurity (87% CVE-Bench) |
| Claude Sonnet 4.5 | 77.2% | 50.0% | 200K | Best price-to-performance (1/5 Opus cost), 0% Replit error rate |
| Gemini 3 Pro | 76.2% | 54.2% | 1M (2M Vertex) | Largest context, lowest cyclomatic complexity (2.1 avg), efficient code |

#### IDE Agents

| Platform | Backend Model | Best For |
|----------|---------------|----------|
| **Cursor Agent** | Claude/GPT/Gemini (user choice) | Interactive dev, IDE integration, focused single-story work |
| **Google Antigravity** | Gemini 3 Pro (+ Claude Sonnet 4.5, GPT-OSS) | Concurrent agent execution, broad codebase analysis, free tier |
| **Claude Code** | Claude Opus 4.5 / Sonnet 4.5 | Terminal-based agentic workflows, long-running autonomous tasks |

### Workflow-to-Model Mapping

#### Simple Track — Model Recommendations

| Workflow | Primary | Budget Alternative | Notes |
|----------|---------|-------------------|-------|
| **SP** — Sprint Planning | Gemini 3 Pro | GPT-5.2 High | Reads full PRD + architecture + all epics/stories. Benefits from large context. |
| **CS** — Create Story | Claude Opus 4.5 | Claude Sonnet 4.5 | Produces technical spec from architecture + sprint plan |
| **DS** — Dev Story | Claude Opus 4.5 | Claude Sonnet 4.5 or Cursor Agent | Core implementation. For frontend-heavy stories, GPT-5.2 High is strong |
| **QA** — QA Automate | Claude Sonnet 4.5 | — | Lightweight test gen doesn't need Opus-tier reasoning |
| **CR** — Code Review | Gemini 3 Pro | GPT-5.2 High | All changed files + story spec + architecture context |
| **ER** — Retrospective | Gemini 3 Pro | — | Reviews all completed work across the epic |

#### TEA Track — Model Recommendations

**Focused Code Generation** — precision over breadth. These tasks are scoped to a single story. Coding accuracy matters more than context window size.

| Workflow | Primary | Budget Alternative | Notes |
|----------|---------|-------------------|-------|
| **CS** — Create Story | Claude Opus 4.5 | Claude Sonnet 4.5 | Produces technical spec from architecture + sprint plan |
| **AT** — ATDD | Claude Opus 4.5 | Claude Sonnet 4.5 | Precise failing tests from acceptance criteria |
| **DS** — Dev Story | Claude Opus 4.5 | Claude Sonnet 4.5 or Cursor Agent | Core implementation. For frontend-heavy stories, GPT-5.2 High is strong |
| **TA** — TEA Automate | Claude Sonnet 4.5 | — | Coverage expansion, Sonnet handles well |

**Broad Analysis** — context window and cross-referencing matter. These tasks need to ingest large amounts of documentation, code, and artifacts simultaneously.

| Workflow | Primary | Alternative | Notes |
|----------|---------|-------------|-------|
| **SP** — Sprint Planning | Gemini 3 Pro | GPT-5.2 High | Reads full PRD + architecture + all epics/stories |
| **TD** — Test Design | Gemini 3 Pro | GPT-5.2 High | Epic-wide test strategy needs holistic view |
| **CR** — Code Review | Gemini 3 Pro | GPT-5.2 High | All changed files + story spec + architecture context |
| **TR** — Traceability | Gemini 3 Pro | — | Maps every requirement to every test across the epic |
| **ER** — Retrospective | Gemini 3 Pro | — | Reviews all completed work, commits, and issues |

**Validation and Audit** — cross-model diversity. The BMAD framework recommends using a different LLM for validation workflows. If Model A wrote the code, Model B should review it.

| Workflow | If code was written by Claude | If code was written by GPT/Gemini |
|----------|-------------------------------|-----------------------------------|
| **RV** — Test Review | Gemini 3 Pro or GPT-5.2 High | Claude Opus 4.5 |
| **NR** — NFR Assessment | Gemini 3 Pro or GPT-5.2 High | Claude Opus 4.5 |

#### Why These Models?

**Claude Opus 4.5 for code gen:** Leads SWE-bench Verified (80.9%), most consistent across tasks, generates defensive code that reduces production bugs. Sonnet 4.5 is near-Opus quality at 1/5 the cost — Replit reports 0% error rate on their internal code editing benchmark.

**GPT-5.2 High for frontend:** Consistently outperforms on complex UI work and unconventional frontend patterns. Also has the lowest control flow error rate (22/MLOC) and can run autonomously for hours on large refactors.

**Gemini 3 Pro for analysis:** Its 1M token context (2M on Vertex AI) can analyze entire codebases in a single request — up to 50,000 lines of code while maintaining architectural understanding. Claude Opus 4.5 tops out at 200K tokens, GPT-5.2 at 400K. For tasks that cross-reference many artifacts, fitting everything in context at once produces better results than chunking. Caveat: highest control flow mistake rate (200/MLOC vs Opus's 55/MLOC) — matters less for analysis tasks where it's reading code, not writing it.

**Cross-validation for reviews:** Models share blind spots with themselves. Using a different model family for review catches issues the original model wouldn't flag.

### Summary Matrix

```
                          Simple Track              TEA Track
                          ────────────              ─────────
Focused Code Gen
  Claude Opus 4.5         CS, DS                    CS, AT, DS
  Claude Sonnet 4.5       CS, DS, QA                CS, AT, DS, TA
  GPT-5.2 High            DS (frontend)             DS (frontend)

Broad Analysis
  Gemini 3 Pro            SP, CR, ER                SP, TD, CR, TR, ER
  GPT-5.2 High            SP, CR                    SP, TD, CR

Cross-Validation
  Different model family  —                         RV, NR
```

### Cost Considerations

| Model | Input (per 1M tokens) | Output (per 1M tokens) | When to splurge |
|-------|-----------------------:|------------------------:|-----------------|
| Claude Opus 4.5 | $15.00 | $75.00 | Complex implementation (DS, AT) |
| Claude Sonnet 4.5 | $3.00 | $15.00 | Default for most code gen tasks |
| Gemini 3 Pro | $2.00 | $12.00 | Large-context analysis tasks |
| GPT-5.2 High | $1.75 | $14.00 | Frontend stories, long sessions |
| GPT-5.2 Pro | $21.00 | $168.00 | Rarely — marginal gains over High |

---

## Sources

- [Claude Opus 4.5 vs GPT-5.2 Codex — Vertu](https://vertu.com/lifestyle/claude-opus-4-5-vs-gpt-5-2-codex-head-to-head-coding-benchmark-comparison/)
- [Claude 4.5 Opus vs Gemini 3 Pro vs GPT-5.2-Codex-Max — Composio](https://composio.dev/blog/claude-4-5-opus-vs-gemini-3-pro-vs-gpt-5-codex-max-the-sota-coding-model)
- [New data on code quality: GPT-5.2 High, Opus 4.5, Gemini 3 — Sonar](https://www.sonarsource.com/blog/new-data-on-code-quality-gpt-5-2-high-opus-4-5-gemini-3-and-more/)
- [Claude Opus 4.5 vs GPT-5.2 High vs Gemini 3 Pro Production Test — DEV Community](https://dev.to/tensorlake/claude-opus-45-vs-gpt-52-high-vs-gemini-3-pro-production-coding-test-25of)
- [Claude Sonnet 4.5 — InfoQ](https://www.infoq.com/news/2025/10/claude-sonnet-4-5/)
- [Claude Sonnet 4.5 Overview — Leanware](https://www.leanware.co/insights/claude-sonnet-4-5-overview)
- [Introducing GPT-5.2-Codex — OpenAI](https://openai.com/index/introducing-gpt-5-2-codex/)
- [Introducing GPT-5.2 — OpenAI](https://openai.com/index/introducing-gpt-5-2/)
- [Gemini 3 Pro — Google DeepMind](https://deepmind.google/models/gemini/pro/)
- [Google Antigravity — Google Developers Blog](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [Best AI Coding Agents 2026 — Faros AI](https://www.faros.ai/blog/best-ai-coding-agents-2026)
- [AI Coding Agents 2026: Cursor, Copilot & Antigravity — Prism Labs](https://www.prismlabs.uk/blog/ai-coding-agents-comparison-2026)
- [Coding Agents Comparison — Artificial Analysis](https://artificialanalysis.ai/insights/coding-agents-comparison)
- [Gemini 3 Pro 1M Context Window — SentiSight](https://www.sentisight.ai/gemini-1-million-token-context-window/)
