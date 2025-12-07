# GitHub Copilot Code Review Instructions

> Specialized for My-Love PWA: TypeScript 5.x strict mode, React 19 server-first, Vitest + Playwright

---

## Review Mission

**Primary goal:** Catch bugs before production. Enforce patterns that prevent bugs.

**Priority order:**
1. Bug prevention (will break)
2. Pattern enforcement (causes future bugs)
3. Everything else (ignore)

---

## Priority 1: MUST Flag (Bug Prevention)

### TypeScript Strict Mode Violations

```typescript
// FLAG: `any` usage - should be `unknown`
function process(data: any) { ... }  // BAD
function process(data: unknown) { ... }  // GOOD

// FLAG: Missing null check
const name = user.name;  // BAD if user can be null
const name = user?.name ?? 'Anonymous';  // GOOD

// FLAG: Unchecked array access
const first = items[0];  // BAD - returns T | undefined with noUncheckedIndexedAccess
const first = items.at(0) ?? defaultValue;  // GOOD

// FLAG: Type assertion without guard
const user = data as User;  // BAD
if (isUser(data)) { const user = data; }  // GOOD
```

### React 19 Server/Client Boundary Errors

```typescript
// FLAG: Hooks in Server Component (missing 'use client')
// app/dashboard/page.tsx
export default function Dashboard() {
  const [count, setCount] = useState(0);  // BAD - hooks need 'use client'
}

// FLAG: Async component without Suspense
export default function Page() {
  return <AsyncComponent />;  // BAD - needs Suspense boundary
}

// GOOD
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AsyncComponent />
    </Suspense>
  );
}

// FLAG: Server Action without validation
'use server';
export async function createPost(formData: FormData) {
  const title = formData.get('title');  // BAD - no validation
  await db.post.create({ data: { title } });
}

// GOOD
'use server';
import { z } from 'zod';
const schema = z.object({ title: z.string().min(1).max(100) });
export async function createPost(formData: FormData) {
  const result = schema.safeParse({ title: formData.get('title') });
  if (!result.success) return { error: result.error };
  await db.post.create({ data: result.data });
}
```

### State Management Bugs

```typescript
// FLAG: Subscribing to entire Zustand store
const store = useAppStore();  // BAD - re-renders on any change
const theme = useAppStore((state) => state.theme);  // GOOD - selective subscription

// FLAG: Missing query invalidation after mutation
const mutation = useMutation({
  mutationFn: updateUser,
  // BAD - missing onSuccess invalidation
});

// GOOD
const mutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user'] }),
});

// FLAG: Optimistic update without rollback
const [optimistic, addOptimistic] = useOptimistic(items, (state, newItem) => [...state, newItem]);
await addItem(newItem);  // BAD - what if this fails?

// GOOD
try {
  addOptimistic(tempItem);
  await addItem(newItem);
} catch {
  // Rollback handled by React's automatic rollback on error
  throw error;  // Re-throw to trigger rollback
}
```

---

## Priority 2: SHOULD Flag (Pattern Enforcement)

### E2E Test Anti-Patterns (CRITICAL)

These patterns create false confidence - tests pass but don't validate behavior.

```typescript
// FLAG: Error swallowing
const isVisible = await element.isVisible().catch(() => false);  // BAD
await expect(element).toBeVisible();  // GOOD

// FLAG: Conditional flow control
if (await button.isDisabled()) {
  expect(true).toBe(true);  // BAD - different paths
} else {
  await button.click();
}
// GOOD - single deterministic path
await expect(button).toBeDisabled();

// FLAG: Hard waits
await page.waitForTimeout(3000);  // BAD
await page.waitForResponse('**/api/data');  // GOOD
await expect(element).toBeVisible();  // GOOD

// FLAG: Runtime test.skip()
test('feature test', async ({ page }) => {
  const hasFeature = await checkFeature();
  if (!hasFeature) test.skip(true, 'Feature not available');  // BAD
});
// GOOD - skip at describe level
test.describe('Feature Tests', () => {
  test.skip(() => process.env.CI, 'Skip in CI');
});

// FLAG: CSS selectors
await page.locator('.btn-primary').click();  // BAD
await page.getByRole('button', { name: /submit/i }).click();  // GOOD
```

### Unit Test Issues

```typescript
// FLAG: Missing server-only mock
import { serverFunction } from '@/lib/server';  // Will fail without mock

// GOOD - add at top of test file
vi.mock("server-only", () => ({}));

// FLAG: Implementation-coupled test
expect(component.state.internalValue).toBe(5);  // BAD
expect(screen.getByText('5')).toBeInTheDocument();  // GOOD - test behavior

// FLAG: Missing mock cleanup
describe('Service', () => {
  it('test 1', () => { ... });  // Mocks leak to next test
});
// GOOD
describe('Service', () => {
  beforeEach(() => vi.clearAllMocks());
  it('test 1', () => { ... });
});
```

### React Patterns

```typescript
// FLAG: Expensive state update without useTransition
const handleSearch = (query: string) => {
  setQuery(query);  // BAD if this triggers expensive re-render
  setResults(expensiveFilter(data, query));
};

// GOOD
const [isPending, startTransition] = useTransition();
const handleSearch = (query: string) => {
  setQuery(query);
  startTransition(() => setResults(expensiveFilter(data, query)));
};

// FLAG: Missing useDeferredValue for search
function SearchResults({ query }) {
  const results = expensiveSearch(query);  // BAD - blocks input
}

// GOOD
function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const results = expensiveSearch(deferredQuery);
}
```

### Accessibility

```typescript
// FLAG: Interactive element without label
<button onClick={save}><SaveIcon /></button>  // BAD

// GOOD
<button onClick={save} aria-label="Save document"><SaveIcon /></button>

// FLAG: Form input without label
<input type="email" placeholder="Email" />  // BAD

// GOOD
<label>
  Email
  <input type="email" />
</label>
```

---

## Priority 3: DO NOT Flag (Ignore)

**Explicitly ignore these - they add noise without value:**

- Formatting (Prettier handles it)
- Import ordering
- Naming style preferences (camelCase vs snake_case debates)
- Line length
- Trailing commas
- Comments and documentation suggestions
- Micro-optimizations (unless in hot path with measurable impact)
- Theoretical security issues without exploitable vectors
- Suggestions already covered by ESLint rules
- Minor refactoring that doesn't prevent bugs
- Adding types to already-typed code
- Suggesting alternative libraries
- Code style preferences

---

## Review Communication Style

### How to Comment

- **Be direct:** "This will cause X bug" not "You might want to consider..."
- **Explain why:** Include the consequence, not just the rule
- **Suggest fix:** Provide code when possible
- **One mention:** Flag pattern once, reference other locations
- **Accept good code:** If it's fine, say nothing

### Severity Markers

Use these prefixes:
- `CRITICAL:` Production bug or data loss risk
- `HIGH:` Pattern violation likely to cause issues
- `MEDIUM:` Should fix but won't break
- `LOW:` Nice to have

### Example Review Comment

```
CRITICAL: Missing null check - will throw at runtime

The `user` parameter can be null based on the type signature, but line 45 accesses `user.email` without checking.

Suggestion:
```typescript
const email = user?.email ?? 'unknown@example.com';
```

Also applies to lines 52, 67.
```

---

## Project-Specific Context

### Stack
- TypeScript 5.x with strict mode (`noUncheckedIndexedAccess: true`)
- React 19 with Server Components (default) and Client Components (`'use client'`)
- Vite + TanStack Query + Zustand
- Vitest for unit tests (colocated: `file.test.ts`)
- Playwright for E2E tests (in `tests/e2e/`)
- Tailwind CSS (mobile-first)
- Supabase backend
- PWA with offline support

### Key Files Reference
- `CLAUDE.md` - Project standards
- `docs/03-Development/typescript-patterns.md` - TypeScript patterns
- `docs/03-Development/react-19-guide.md` - React 19 patterns
- `docs/04-Testing-QA/e2e-quality-standards.md` - E2E test requirements

### Test Quality Standard
E2E tests MUST score 80+ on quality metrics. Previous suite scored 52/100 and was archived. Key violations to flag:
- Error swallowing (`.catch(() => false)`)
- Conditional flow (`if/else` in tests)
- Hard waits (`waitForTimeout`)
- No-op assertion paths
