# Troubleshooting Guide

> Common issues and solutions for the My-Love project

@docs/03-Development/typescript-patterns.md
@docs/03-Development/react-19-guide.md
@docs/04-Testing-QA/testing-guide.md

*Last Updated: December 2024*

---

## TypeScript Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Object is possibly 'null'` | Strict null checks enabled | Add explicit null check or use optional chaining `?.` |
| `Object is possibly 'undefined'` | Missing undefined handling | Use nullish coalescing `??` or type guard |
| Array access returns `T \| undefined` | `noUncheckedIndexedAccess` enabled | Use `.at()` method or add bounds checking |
| Type guard not narrowing | Predicate returns `boolean` | Change return type to `value is Type` |
| `any` type creeping in | Missing type annotations | Add explicit types, use `unknown` for truly unknown |
| Template literal type error | String not matching pattern | Check for typos in literal values |

### Example Fixes

```typescript
// Problem: Object is possibly 'null'
const name = user.name; // Error!

// Solution 1: Null check
if (user !== null) {
  const name = user.name; // OK
}

// Solution 2: Optional chaining
const name = user?.name ?? 'Anonymous';

// Problem: Array access might be undefined
const first = items[0]; // string | undefined

// Solution: Bounds check
const first = items.length > 0 ? items[0] : 'default';
// Or use .at()
const first = items.at(0) ?? 'default';
```

---

## React Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Hydration mismatch | Server/client render different content | Check component boundaries, use `'use client'` |
| `useTransition` not preventing blocking | Expensive work outside `startTransition` | Move computation inside callback |
| Server Action type errors | Missing `'use server'` directive | Add directive, ensure serializable returns |
| `useOptimistic` not updating | State reference unchanged | Create new array/object, don't mutate |
| Suspense boundary not streaming | Missing async in Server Component | Add `async` to component function |
| Client component in Server Component | Importing client hook in server | Split into separate files |

### Example Fixes

```typescript
// Problem: Hydration mismatch
function Component() {
  return <div>{Date.now()}</div>; // Different on server vs client!
}

// Solution: Use effect for client-only values
'use client';
function Component() {
  const [time, setTime] = useState<number | null>(null);
  useEffect(() => setTime(Date.now()), []);
  return <div>{time}</div>;
}

// Problem: useTransition not working
const [isPending, startTransition] = useTransition();
startTransition(() => {
  expensiveFilter(); // This still blocks!
  setResults(filtered);
});

// Solution: Defer the expensive work
startTransition(() => {
  setQuery(newQuery); // State update triggers re-render
});
// Use useDeferredValue for the expensive computation
const deferredQuery = useDeferredValue(query);
const results = expensiveFilter(deferredQuery);
```

---

## Playwright Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Flaky tests | Race conditions | Add `waitForLoadState('networkidle')` |
| Selector not found | Element not yet rendered | Use `waitFor` or increase timeout |
| Selectors break on UI change | Using CSS/XPath selectors | Use accessibility selectors |
| Slow CI tests | Running all browsers | Enable sharding: `--shard=1/4` |
| Screenshots blank | Taking too early | Wait for specific element visibility |
| Form submit not working | Button not clickable | Wait for loading states to complete |

### Example Fixes

```typescript
// Problem: Flaky test
await page.goto('/dashboard');
await page.click('#submit'); // Might fail!

// Solution: Wait for network and element
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: 'Submit' }).click();

// Problem: Selector breaks when class changes
await page.locator('.btn-primary').click(); // Fragile!

// Solution: Use accessibility selector
await page.getByRole('button', { name: 'Submit' }).click();

// Problem: Test times out waiting for element
await page.getByText('Success').waitFor(); // Times out

// Solution: Check for loading state first
await page.waitForSelector('[data-loading="false"]');
await expect(page.getByText('Success')).toBeVisible();
```

---

## Vitest Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Mock not working | Mock defined after import | Move `vi.mock()` to top of file |
| Test pollution | Shared state between tests | Use `beforeEach` for fresh state |
| Async test failing | Missing `await` | Add `await` or return promise |
| Timer-based test flaky | Using real timers | Use `vi.useFakeTimers()` |
| Import error for server code | `server-only` package | Mock with `vi.mock("server-only", () => ({}))` |

### Example Fixes

```typescript
// Problem: Mock not working
import { fetchData } from './api';
vi.mock('./api'); // Too late!

// Solution: Move mock to top
vi.mock('./api');
import { fetchData } from './api';

// Problem: Tests affecting each other
describe('Counter', () => {
  const counter = new Counter();
  it('increments', () => { counter.inc(); /* ... */ });
  it('starts at 0', () => { /* fails because counter is 1 */ });
});

// Solution: Fresh instance per test
describe('Counter', () => {
  let counter: Counter;
  beforeEach(() => { counter = new Counter(); });
  it('increments', () => { counter.inc(); /* ... */ });
  it('starts at 0', () => { /* works! */ });
});
```

---

## Build Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Type error in build only | Different TS config | Check `tsconfig.json` includes all files |
| Module not found | Missing dependency | Run `npm install` or check import path |
| CSS not loading | Tailwind not processing | Check `tailwind.config.js` content paths |
| Environment variable undefined | Missing in `.env` | Add to `.env.local` or CI secrets |
| Build OOM | Too many dependencies | Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096` |

---

## Database Issues (Prisma)

| Issue | Cause | Solution |
|-------|-------|----------|
| Schema drift | DB doesn't match schema | Run `npx prisma db push` or `migrate dev` |
| Migration failed | Conflicting changes | Reset: `npx prisma migrate reset` (dev only!) |
| Query returns null | Record doesn't exist | Use `findUnique` with null check |
| Relation not loading | Missing `include` | Add `include: { relation: true }` |
| Type mismatch | Schema changed | Run `npx prisma generate` |

---

## Performance Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Slow initial load | Large bundle | Enable code splitting, lazy loading |
| Janky scrolling | Expensive renders | Use `useDeferredValue`, virtualization |
| Memory leak | Uncleaned effects | Add cleanup to `useEffect` |
| Slow API responses | N+1 queries | Use `include` or batch queries |
| Large images | Unoptimized assets | Use Next.js Image component |

---

## Debugging Tips

### TypeScript
```bash
# Check types without building
npx tsc --noEmit

# Show detailed error
npx tsc --noEmit --pretty
```

### React DevTools
- Components tab: Inspect component tree and props
- Profiler tab: Find performance bottlenecks
- Highlight updates: See what's re-rendering

### Playwright
```bash
# Debug mode with browser visible
npx playwright test --debug

# Generate test from actions
npx playwright codegen localhost:3000

# Show trace viewer
npx playwright show-trace trace.zip
```

### Vitest
```bash
# Run single test file
npx vitest run src/utils/format.test.ts

# Watch mode with UI
npx vitest --ui

# Show coverage
npx vitest --coverage
```

---

## Quick Checklist

When something breaks:

1. [ ] Check the error message carefully
2. [ ] Search this guide for the error
3. [ ] Check if dependencies are installed (`npm install`)
4. [ ] Check if types are generated (`npx prisma generate`)
5. [ ] Clear caches (`.next/`, `node_modules/.cache/`)
6. [ ] Check environment variables
7. [ ] Restart the dev server
8. [ ] Check git status for unintended changes

---

*See also: [CLAUDE.md](../../CLAUDE.md) for quick reference*
