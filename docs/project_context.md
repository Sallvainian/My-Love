---
project_name: 'My-Love'
user_name: 'Sallvain'
date: '2025-12-07'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality_rules', 'workflow_rules', 'critical_rules']
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Category | Technology | Version | Critical Notes |
|----------|------------|---------|----------------|
| Framework | React | 19.2.1 | Use `useTransition` for non-blocking updates |
| Language | TypeScript | 5.9.3 | Strict mode; `verbatimModuleSyntax: true` |
| Build | Vite | 7.2.6 | `vite-plugin-checker` for inline type errors |
| Backend | Supabase | 2.86.2 | RLS policies require `auth.uid()` |
| State | Zustand | 5.0.9 | **Serialize Maps to Arrays**; use selectors |
| Validation | Zod | 4.1.13 | **v4 API** - always use `.safeParse()` |
| Styling | Tailwind | 4.1.17 | **NO tailwind.config.js** - CSS-first in v4 |
| Animation | Framer Motion | 12.23.25 | Use `AnimatePresence` for exit animations |
| Testing | Vitest | 4.0.9 | 80% coverage; `happy-dom` environment |
| E2E | Playwright | 1.57.0 | See e2e-quality-standards.md |
| PWA | vite-plugin-pwa | 1.2.0 | **injectManifest** - caching in `sw.ts` |

### Critical Version Rules

1. **Tailwind v4**: No `tailwind.config.js` - use `@theme` in CSS
2. **Zod v4**: Use `.safeParse()`, not `.parse()` for user input
3. **Zustand persist**: Maps serialize to `Array.from(map.entries())`
4. **PWA**: `workbox` options in vite.config.ts IGNORED with injectManifest
5. **React 19**: Wrap expensive updates in `startTransition()`

### Version-Specific Gotchas

**TypeScript:**
- Use `import type { X }` for type-only imports
- Target: ES2022, Module: ESNext, moduleResolution: bundler

**Testing:**
- Environment: `happy-dom` (NOT jsdom)
- Mock server-only: `vi.mock("server-only", () => ({}))`
- Coverage: 80% threshold enforced

**PWA/Deployment:**
- Base path: `/My-Love/` in production (not `/`)
- Service worker: ALL caching logic in `src/sw.ts`

**Supabase:**
- All queries must work with RLS enabled
- Realtime subscriptions need cleanup on unmount

**Performance:**
- Use Zustand selectors: `useAppStore(s => s.field)`
- Check manualChunks before adding large dependencies

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Imports:**
- Use `import type { X }` for type-only imports (required by `verbatimModuleSyntax`)
- Use barrel exports: import from `./hooks` not `./hooks/useNetworkStatus`
- Path alias: `@/` → `./src`

**Type Safety:**
- Prefer `unknown` over `any` (even though ESLint allows `any`)
- Use discriminated unions for async state:
  ```typescript
  type AsyncState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: string };
  ```
- Create type guards for runtime validation:
  ```typescript
  function isValidMood(value: unknown): value is MoodType {
    return typeof value === 'string' && VALID_MOODS.includes(value);
  }
  ```

**Error Handling:**
- Return `{ data, error }` tuples from services (Supabase pattern)
- Log with service context: `console.error('[AuthService] Failed:', error)`
- Don't throw from service methods - return error objects
- Graceful degradation: continue if non-critical operations fail

**Null Handling:**
- Use optional chaining: `user?.profile?.email`
- Use nullish coalescing: `value ?? defaultValue`
- Explicit null checks before operations

**Patterns to Avoid:**
- ❌ `as` type assertions (use type guards instead)
- ❌ `!` non-null assertions (check for null explicitly)
- ❌ Implicit `any` from untyped imports

### Framework-Specific Rules (React 19)

**Component Organization:**
- Components in `src/components/ComponentName/` with `index.ts` barrel
- Co-locate CSS: `ComponentName.css` next to `ComponentName.tsx`
- Keep components under 300 lines - extract to custom hooks

**Hooks Rules:**
- Name custom hooks `use*` (e.g., `useLoveNotes`, `useNetworkStatus`)
- Export types alongside hooks: `export { useX, type UseXResult }`
- Always cleanup effects:
  ```typescript
  useEffect(() => {
    const unsubscribe = subscribe();
    return () => unsubscribe(); // REQUIRED
  }, []);
  ```

**State Management (Zustand):**
- Use selectors for performance:
  ```typescript
  // ✅ Good - only re-renders when `theme` changes
  const theme = useAppStore(s => s.settings.theme);

  // ❌ Bad - re-renders on ANY store change
  const { settings } = useAppStore();
  ```
- 7 slices: Settings, Messages, Photos, Mood, Partner, Interactions, Navigation
- Actions live in slices, not components

**React 19 Concurrent Features:**
- Use `useTransition` for non-urgent updates:
  ```typescript
  const [isPending, startTransition] = useTransition();
  startTransition(() => setFilter(newFilter));
  ```
- Use `useDeferredValue` for expensive renders:
  ```typescript
  const deferredQuery = useDeferredValue(query);
  const results = expensiveFilter(deferredQuery);
  ```

**Animation Patterns (Framer Motion):**
- Wrap route changes in `AnimatePresence`:
  ```typescript
  <AnimatePresence mode="wait">
    <motion.div key={currentView} initial={{...}} animate={{...}} exit={{...}}>
  ```
- Use `motion.div` for animated elements, not regular `div`

**Anti-Patterns:**
- ❌ Don't use `useEffect` for derived state (compute inline or `useMemo`)
- ❌ Don't destructure entire store (use selectors)
- ❌ Don't forget effect cleanup for subscriptions
- ❌ Don't use `useState` for server data (use Zustand slice)

### Testing Rules (Vitest + Playwright)

**TL;DR:** `fake-indexeddb/auto` first • `page.route()` before `page.goto()` • Zero `waitForTimeout` • Auth runs LAST

**Unit Testing (Vitest):**
- Environment: `happy-dom` (NOT jsdom)
- FIRST import in vitest.setup.ts: `import 'fake-indexeddb/auto'`
- Colocate tests: `useLoveNotes.ts` + `useLoveNotes.test.ts`
- Mock Supabase client, not hooks: `vi.mock('@/lib/supabase')`
- Wrap async state updates in `act()`
- Test cleanup: verify `unmount()` removes subscriptions

**E2E Testing (Playwright):**
- Selector priority: `getByRole` > `getByLabel` > `getByTestId` (never CSS)
- Network interception BEFORE navigation:
  ```typescript
  await page.route('**/api/**', handler);
  await page.goto('/page');
  ```
- Zero `waitForTimeout()`—use `expect(locator).toBeVisible()`
- Test isolation via `storageState` per project
- Auth project runs LAST (destroys session state)

**Resilience Patterns:**
- Test network failures: `route.abort('failed')`
- Test error states: mock 4xx/5xx responses
- Test offline mode: intercept and fail all network
- Clean state per test: `beforeEach` creates, `afterEach` destroys

**Testing Anti-Patterns:**
- ❌ `waitForTimeout()` (flaky)
- ❌ CSS selectors `.class`, `#id` (brittle)
- ❌ Shared test state (pollution)
- ❌ Real API calls in E2E (slow, flaky)
- ❌ Hardcoded file paths (CI breaks)

### Code Quality & Style Rules

**Import Organization (in order):**
1. React/framework imports
2. External packages
3. Internal aliases (`@/`)
4. Relative imports
5. Test utilities (test files only): `@testing-library/*`, `vitest`

**Naming Conventions:**
- Components: `PascalCase.tsx` (`LoveNoteCard.tsx`)
- Hooks: `useCamelCase.ts` (`useLoveNotes.ts`)
- Slices: `camelCaseSlice.ts` (`loveNotesSlice.ts`)
- E2E tests: `kebab-case.spec.ts` (`love-notes.spec.ts`)
- Constants: `SCREAMING_SNAKE_CASE`

**Type Organization:**
- Types declared at TOP of file, before functions
- Exported functions require explicit return types
- Export types alongside functions: `export { useX, type UseXResult }`

**Code Patterns:**
- Extract magic numbers to named constants
- Service layer returns `{ data, error }` tuples—never throws
- Log with context: `console.error('[ServiceName] message:', error)`

**Documentation:**
- Comments explain WHY, not WHAT
- Deprecation: `/** @deprecated Use X instead. Remove after vY.Z */`
- TODOs: `// TODO(scope): description - see issue #XX`

**Size Limits:**

| Entity | Max Lines | Action |
|--------|-----------|--------|
| Component | 300 | Extract to hook |
| Function | 50 | Extract helpers |
| File | 500 | Split modules |
| Hook | 150 | Split concerns |

### Development Workflow Rules

**Environment Variables (dotenvx):**
- Encrypted `.env` file in repo (safe to commit)
- Decryption key in `.env.keys` (NEVER commit - gitignored)
- ALWAYS use `npm run dev`, NEVER `npx vite` directly
- dotenvx auto-decrypts with `--overload` flag

**Scripts (use these, not raw commands):**

| Task | Command | Notes |
|------|---------|-------|
| Dev server | `npm run dev` | Uses dotenvx for secrets |
| Raw vite | `npm run dev:raw` | Only for debugging (no secrets) |
| Type check | `npm run typecheck` | Zero errors required |
| Unit tests | `npm run test:unit` | Vitest |
| E2E tests | `npm run test:e2e` | Playwright with cleanup |
| Build | `npm run build` | tsc + vite build |
| Deploy | `npm run deploy` | Runs build + smoke tests first |

**Git Workflow:**
- Branch naming: `feature/description`, `fix/description`, `chore/description`
- Commit format: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- PR requirements: Tests pass, no type errors, coverage maintained

**Before Committing:**
1. `npm run typecheck` - Zero errors
2. `npm run test:unit` - All pass
3. `npm run build` - Successful build

**Deployment:**
- Target: GitHub Pages at `/My-Love/`
- Build output: `dist/`
- Base path configured in `vite.config.ts`

**Critical:** Never expose `.env.keys` - Contains decryption key for Supabase secrets

---

## Critical Don't-Miss Rules

_These are the highest-impact mistakes AI agents make. Memorize this section._

### Tier 1: Instant Failure

| Mistake | Impact | Prevention |
|---------|--------|------------|
| Missing `fake-indexeddb/auto` | ALL photo/offline tests fail | First import in vitest.setup.ts |
| `page.route()` after `page.goto()` | Network mocks miss requests | Route BEFORE navigate |
| Using `npx vite` directly | Supabase secrets won't decrypt | Use `npm run dev` |
| No subscription cleanup | Tests hang, memory leaks | `afterEach` removes all channels |

### Tier 2: Flaky CI

| Mistake | Impact | Prevention |
|---------|--------|------------|
| `waitForTimeout()` | Race conditions on slow runners | Use `expect().toBeVisible()` |
| Shared auth state | Test pollution | `storageState` per project |
| CSS selectors in tests | Break on style changes | `getByRole`, `getByLabel` only |

### Environment Gotchas

```typescript
// ❌ Never create new Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, ...);

// ✅ Always use existing client
import { supabase } from '@/lib/supabase';
```

### Zustand Persistence

```typescript
// ❌ Maps don't serialize with persist
notes: new Map<string, LoveNote>()

// ✅ Arrays serialize correctly
notes: LoveNote[]
```

### React 19 Performance

```typescript
// ❌ Expensive work blocks UI
setNotes(filterNotes(query));

// ✅ Non-blocking with transition
startTransition(() => setNotes(filterNotes(query)));
```

### PWA Asset Paths

```typescript
// ❌ String paths break in production (/My-Love/ base)
const icon = '/assets/heart.svg';

// ✅ Import ensures correct path resolution
import heartIcon from '@/assets/heart.svg';
```

### Architectural Invariants

- **Never create new top-level folders** without asking
- **Always check for existing patterns** before implementing
- **Import from barrels**: `@/hooks` not `@/hooks/useLoveNotes`
- **Services never throw**: return `{ data, error }` tuples

### Pre-Commit Checklist

Before ANY commit, verify:

1. ☐ `npm run typecheck` - Zero errors
2. ☐ `npm run test:unit` - All pass
3. ☐ `npm run build` - Successful
4. ☐ No `waitForTimeout()` added
5. ☐ No CSS selectors in tests
6. ☐ Effect cleanup for subscriptions
7. ☐ Barrel exports updated if new files
8. ☐ Existing patterns followed

**If ANY fails, DO NOT commit.**

