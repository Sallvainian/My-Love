# Option C: Hybrid Approach

> Core principles inline + extended examples in linked docs

---

## Quick Reference (Keep in CLAUDE.md)

### TypeScript - Strict Mode Required

```json
{ "strict": true, "noUncheckedIndexedAccess": true }
```

### React - Server-First

- Default: Server Components (async, no hooks)
- Explicit: `'use client'` for interactivity
- Patterns: `useTransition`, `Suspense`, Server Actions

### Testing - Dual Strategy

- **Unit:** Vitest (colocated)
- **E2E:** Playwright (accessibility selectors)

### Styling - Tailwind Mobile-First

```html
<div class="w-full md:w-1/2 lg:w-1/3">
```

---

## Extended Documentation (Separate Files)

For detailed patterns and examples, see:

| Topic | Location |
|-------|----------|
| TypeScript patterns | `docs/typescript-patterns.md` |
| React 19 features | `docs/react-19-guide.md` |
| Testing strategy | `docs/testing-guide.md` |
| Troubleshooting | `docs/troubleshooting.md` |

---

## When to Reference Extended Docs

- **New team member onboarding** - Read full guides
- **Specific pattern needed** - Search extended docs
- **Troubleshooting issues** - Check troubleshooting.md
- **Quick reminder** - This file is sufficient

---

## Decision Matrix

| Scenario | Use CLAUDE.md | Use Extended Docs |
|----------|---------------|-------------------|
| "What TypeScript config?" | Yes | No |
| "How do I implement useOptimistic?" | No | Yes |
| "Why is my test flaky?" | No | Yes (troubleshooting) |
| "Server or Client Component?" | Yes | No |

---

*~50 lines in CLAUDE.md + comprehensive linked documentation*
