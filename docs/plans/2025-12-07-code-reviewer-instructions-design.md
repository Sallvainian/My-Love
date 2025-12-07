# Code Review Instructions Design

**Created:** 2025-12-07
**Purpose:** Specialized code review instructions for GitHub Copilot and Claude Code GitHub Action

---

## Problem Statement

Generic AI code reviewers produce noise - formatting nitpicks, documentation suggestions, theoretical security concerns. The goal is two specialized reviewers that:
1. Catch real bugs before production
2. Enforce My-Love project patterns that prevent future bugs
3. Ignore everything else

---

## Target Platforms

### GitHub Copilot
- **Location:** `.github/copilot-instructions.md`
- **Trigger:** Automatic PR review when Copilot is added as reviewer
- **Format:** Natural language instructions in Markdown

### Claude Code GitHub Action
- **Location:** `.github/workflows/claude-code-review.yml` + `CLAUDE.md`
- **Trigger:** On PR opened/synchronize events
- **Format:** Workflow YAML with `prompt` parameter referencing CLAUDE.md

---

## Review Priorities

### Priority 1: Bug Prevention (MUST flag)

**TypeScript Strict Mode Violations:**
- `any` type usage (should be `unknown`)
- Missing null/undefined handling
- Unchecked array access (without bounds check or `.at()`)
- Type assertions (`as`) without type guards
- Missing discriminated union handling

**React 19 Server/Client Boundary Errors:**
- Hooks in Server Components (missing `'use client'`)
- `useState`, `useEffect` without `'use client'` directive
- Async component without Suspense boundary
- Server Action without `'use server'` directive
- Missing Zod validation in Server Actions

**State Management Bugs:**
- Zustand: subscribing to entire store instead of selectors
- TanStack Query: missing `invalidateQueries` after mutations
- Missing `staleTime` causing excessive refetches
- Optimistic updates without rollback handling

**Data Flow Issues:**
- Prop drilling beyond 2 levels (should use context/store)
- Missing error boundaries around async operations
- Unhandled promise rejections

### Priority 2: Pattern Enforcement (SHOULD flag)

**E2E Test Anti-Patterns (CRITICAL):**
- Error swallowing: `.catch(() => false)`, `.catch(() => null)`
- Conditional flow: `if (await element.isVisible())`
- Hard waits: `waitForTimeout()`, `setTimeout`
- Runtime `test.skip()` inside test bodies
- CSS class selectors instead of `getByRole`, `getByLabel`

**Unit Test Issues:**
- Missing `vi.mock("server-only", () => ({}))` for server code
- Implementation-coupled tests (testing internal state)
- Missing `vi.clearAllMocks()` in `beforeEach`

**React Patterns:**
- Missing `useTransition` for expensive state updates
- Missing `useDeferredValue` for search/filter inputs
- `useOptimistic` without proper rollback
- Missing `memo()` for expensive child components

**Accessibility:**
- Interactive elements without proper ARIA labels
- Form inputs without associated labels
- Missing focus management on modals/dialogs

### Priority 3: Ignore (DO NOT flag)

- Formatting (handled by Prettier)
- Naming preferences (camelCase vs snake_case)
- Comments and documentation suggestions
- Import ordering
- Line length
- Trailing commas
- Minor refactoring suggestions
- Micro-optimizations without measurable impact
- Theoretical security issues without exploit vectors
- Already-handled linter rules (ESLint catches these)

---

## Review Style

### Communication Approach
- Direct and constructive
- Explain WHY, not just WHAT
- Suggest specific fixes with code examples
- One mention per issue type (reference other locations)
- If code is acceptable, say so and move on

### Severity Levels
- **CRITICAL:** Will cause production bugs or data loss
- **HIGH:** Violates project patterns, likely to cause issues
- **MEDIUM:** Should be fixed, but won't break things
- **LOW:** Nice to have, optional

---

## File Structure

### 1. `.github/copilot-instructions.md`
Comprehensive Copilot-specific instructions covering all priorities above.

### 2. `.github/workflows/claude-code-review.yml`
Updated workflow with project-specific prompt that references CLAUDE.md patterns.

### 3. `.github/instructions/typescript.instructions.md` (optional)
Path-specific instructions for TypeScript files using `applyTo` frontmatter.

---

## Implementation Notes

### For Copilot:
- Keep instructions focused and scannable
- Use bullet points and headers
- Include code examples for complex patterns
- Reference project docs where appropriate

### For Claude Code:
- Claude already reads CLAUDE.md, so prompt focuses on review behavior
- Use `claude_args` to limit tools and max turns
- Prompt explicitly tells Claude to use `gh pr comment` for output

---

## Success Criteria

1. Reviewers catch actual bugs (TypeScript errors, React boundary issues)
2. Reviewers enforce E2E test quality standards
3. No more noise about formatting, comments, or documentation
4. Reviews complete in <2 minutes per PR
5. False positive rate <10%
