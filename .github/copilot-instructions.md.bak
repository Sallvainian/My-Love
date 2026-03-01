# PR Code Review Guidelines

## Review Philosophy

Review priority order:
1. **Code quality & consistency** - React patterns, functional style, PWA correctness
2. **Testing coverage** - Adequate tests for new/changed behavior
3. **Performance** - Meaningful issues that affect UX
4. **Security** - Critical vulnerabilities only

**Adaptive detail level:**
- Large architectural changes → strategic feedback on design decisions
- Small targeted fixes → granular code-level suggestions

## Strict vs Flexible Areas

**Strict:** data sync logic, offline flows, Zustand store design, hooks correctness, new behaviors requiring tests

**Flexible:** trivial UI changes, cosmetic refactors, minor formatting or naming differences

## Core Focus Areas

**React Patterns:**
- Hooks: correct dependency arrays, no conditional hooks, proper cleanup
- Component boundaries: single responsibility, clear prop contracts
- Zustand: minimize subscriptions, avoid unnecessary renders, proper selectors
- Rendering logic: avoid heavy computation inside render paths
- Prop drilling: prefer context or scoped stores over deep prop chains

**Functional Style:**
- Pure functions: no hidden side effects
- Immutability: avoid mutations, rely on map/filter/spread
- Composition: small functions over monolithic logic
- Separation of concerns: avoid mixing fetching, state updates, and rendering in one function/component

**PWA/Offline Correctness:**
- Service worker: registration, update flow, cache strategies
- Offline data: IndexedDB usage, sync conflict resolution, stale data handling
- Cache invalidation: appropriate lifetimes, version management, avoid over-caching
- Background sync: ensure queued writes, retries, and deduping logic

## Testing Requirements

**When tests are required:**
- All new features and bug fixes, especially core flows (data sync, offline behavior, Zustand state, PWA logic)
- Trivial changes (copy, styles, comments) may skip tests with explicit justification in PR

**What to flag:**
- Missing tests for new or changed behavior
- Brittle/flaky patterns: arbitrary timeouts, over-mocking, implementation-coupled tests, pointless snapshots
- Coverage gaps: untested branches, missing error/edge cases, offline scenarios not validated

**Test quality over quantity:**
- Focus on testing behavior, not implementation details
- Ensure tests would catch real bugs, not just exercise code

## Performance Guidelines

Review performance across three areas, but only flag meaningful issues:

**Bundle size:**
- Heavy imports (e.g., importing entire libraries instead of named exports)
- Duplicate dependencies
- Dead code or unused chunks

**Runtime performance:**
- Unnecessary re-renders: missing memoization, bad dependency arrays
- Unstable props/functions causing avoidable child renders
- Expensive computations inside render paths
- Memory leaks: missing cleanup, abandoned subscriptions, retained references

**PWA performance:**
- Inefficient caching strategies
- Stale service worker behavior, outdated cache versions
- Offline data handling: slow IndexedDB usage, missing indexes, inefficient read/write patterns

**Don't flag:**
- Micro-optimizations that don't affect UX
- Premature optimization in early-stage code
- Theoretical complexity issues unless in a hot path
- Minor performance nits without measurable or likely impact

## Security Considerations

Focus on critical vulnerabilities only:
- Exposed API keys, tokens, or credentials in code
- XSS vulnerabilities: unsanitized user input in DOM
- Unsafe data handling: missing input validation on user-supplied data
- Authentication/authorization bypasses
- Insecure direct object references (IDOR)
- Dangerous eval-like patterns (new Function, dynamic script injection, untrusted HTML parsing)

**Don't flag:** Theoretical security issues without exploitable vectors

## Review Style

**Communication approach:**
- Be direct but constructive
- Explain *why* something is problematic, not just *what* is wrong
- Suggest specific fixes when possible
- Acknowledge good patterns when you see them
- If suggesting a major refactor, explain the trade-offs
- If the code is acceptable, say so and move on - don't force optional changes

**Avoid:**
- Pedantic corrections on subjective style choices
- Suggesting changes without explaining the benefit
- Flagging issues already handled by linters/tooling (ESLint, Prettier, TypeScript)
- Repeating the same issue multiple times - mention it once and reference other locations
