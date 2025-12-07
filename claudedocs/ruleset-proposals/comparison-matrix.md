# Ruleset Comparison Matrix

## Overview

| Aspect | Current CLAUDE.md | Option A (Comprehensive) | Option B (Minimal) | Option C (Hybrid) |
|--------|-------------------|--------------------------|--------------------|--------------------|
| **Lines of Code** | ~95 | ~400 | ~100 | ~50 + linked docs |
| **TypeScript Coverage** | None | Full strict mode + patterns | Essential config only | Config + linked patterns |
| **React 19 Patterns** | Basic hooks only | Full: RSC, Suspense, Actions | Core principles | Principles + linked examples |
| **Testing** | Vitest mocks only | Vitest + Playwright + patterns | Both frameworks, minimal | Both + linked guide |
| **Troubleshooting** | None | Comprehensive tables | None | Linked document |
| **Onboarding Time** | 5 min | 30 min | 5 min | 5 min (quick) / 30 min (full) |

---

## Scoring by Criteria

### 1. Developer Productivity

| Option | Score | Rationale |
|--------|-------|-----------|
| Current | 2/5 | Missing patterns forces searching elsewhere |
| Option A | 5/5 | Copy-paste ready examples for all scenarios |
| Option B | 3/5 | Principles clear but lacks implementation detail |
| Option C | 4/5 | Quick reference + deep dives when needed |

### 2. Maintainability

| Option | Score | Rationale |
|--------|-------|-----------|
| Current | 4/5 | Easy to maintain (small) but incomplete |
| Option A | 2/5 | Large document requires more updates |
| Option B | 5/5 | Small surface area, easy to keep current |
| Option C | 4/5 | Core is small, extended docs can evolve |

### 3. Completeness

| Option | Score | Rationale |
|--------|-------|-----------|
| Current | 1/5 | Major gaps in TS, testing, React 19 |
| Option A | 5/5 | Covers all production scenarios |
| Option B | 3/5 | Covers essentials, assumes prior knowledge |
| Option C | 5/5 | Full coverage via linked docs |

### 4. Scalability

| Option | Score | Rationale |
|--------|-------|-----------|
| Current | 2/5 | No patterns for large-scale apps |
| Option A | 5/5 | Enterprise patterns included |
| Option B | 3/5 | Principles scale, examples don't |
| Option C | 5/5 | Modular structure scales well |

### 5. Learning Curve

| Option | Score | Rationale |
|--------|-------|-----------|
| Current | 5/5 | Very simple to understand |
| Option A | 2/5 | Overwhelming for newcomers |
| Option B | 4/5 | Clear principles, approachable |
| Option C | 5/5 | Progressive disclosure - simple to deep |

---

## Total Scores

| Option | Productivity | Maintainability | Completeness | Scalability | Learning | **Total** |
|--------|--------------|-----------------|--------------|-------------|----------|-----------|
| Current | 2 | 4 | 1 | 2 | 5 | **14/25** |
| Option A | 5 | 2 | 5 | 5 | 2 | **19/25** |
| Option B | 3 | 5 | 3 | 3 | 4 | **18/25** |
| Option C | 4 | 4 | 5 | 5 | 5 | **23/25** |

---

## Recommendation

### Winner: Option C (Hybrid Approach)

**Rationale:**
1. Best of both worlds - quick reference + depth when needed
2. Progressive disclosure reduces cognitive overload
3. Modular structure allows incremental updates
4. Maintains high discoverability via linked docs

### Implementation Path

1. Replace current CLAUDE.md with Option C core (~50 lines)
2. Create `docs/` directory with extended guides:
   - `typescript-patterns.md`
   - `react-19-guide.md`
   - `testing-guide.md`
   - `troubleshooting.md`
3. Each extended doc follows the structure from Option A

---

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| Linked docs become stale | Add "Last Updated" dates, quarterly review |
| Developers skip extended docs | Onboarding checklist requires reading |
| Too many files to maintain | Keep core principles stable, examples evolve |
| Lost discoverability | Add search-friendly headers in all docs |
