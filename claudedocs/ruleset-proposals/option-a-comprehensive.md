# Option A: Comprehensive Merged Ruleset

> Full synthesis of external rulesets with project-specific customizations

---

## TypeScript Configuration

### Strict Mode (Required)

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "ESNext"
  }
}
```

### Type Guards Pattern

```typescript
// Discriminated unions for API responses
type Success<T> = { status: 'success'; data: T };
type Failure = { status: 'error'; error: string };
type Result<T> = Success<T> | Failure;

function isSuccess<T>(result: Result<T>): result is Success<T> {
  return result.status === 'success';
}
```

### Strict Null Handling

```typescript
// Always use optional chaining and nullish coalescing
const email = user?.profile?.email ?? 'default@example.com';

// Type guard for null checks
function processUser(user: User | null): void {
  if (user === null) {
    throw new Error('User is required');
  }
  console.log(user.name); // TypeScript knows user is not null
}
```

---

## React 19 Patterns

### Server Components (Default)

```typescript
// app/dashboard/page.tsx - Server Component (default)
import { Suspense } from 'react';

export default async function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
    </div>
  );
}

async function Stats() {
  const stats = await fetchStats(); // Server-side fetch
  return <StatsDisplay data={stats} />;
}
```

### Client Components

```typescript
// components/SearchBox.tsx
'use client';

import { useState, useTransition, useDeferredValue } from 'react';

function SearchBox({ data }: { data: Item[] }) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const handleSearch = (value: string) => {
    setQuery(value); // Urgent update
    startTransition(() => {
      // Non-urgent - won't block input
    });
  };

  return (
    <input
      value={query}
      onChange={(e) => handleSearch(e.target.value)}
      className={isPending ? 'opacity-50' : ''}
    />
  );
}
```

### Server Actions with Zod

```typescript
// app/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const createPostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(10),
});

export async function createPost(formData: FormData) {
  const result = createPostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  });

  if (!result.success) {
    return { error: result.error.format() };
  }

  await db.post.create({ data: result.data });
  revalidatePath('/posts');
  return { success: true };
}
```

### Optimistic Updates

```typescript
import { useOptimistic, useTransition } from 'react';

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );

  const handleAdd = async (title: string) => {
    const tempTodo = { id: crypto.randomUUID(), title, completed: false };
    addOptimisticTodo(tempTodo);
    await addTodoToServer(title);
  };

  return <ul>{optimisticTodos.map(todo => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

---

## Testing Strategy

### Unit Testing (Vitest)

```typescript
// format.test.ts - colocated with format.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock("server-only", () => ({}));

describe('formatDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats ISO date to readable string', () => {
    expect(formatDate('2024-01-15')).toBe('January 15, 2024');
  });
});
```

### E2E Testing (Playwright)

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results.json' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
});
```

### E2E Test Pattern

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });
});
```

### API Testing

```typescript
test('API returns valid user data', async ({ request }) => {
  const response = await request.get('/api/users/1');
  expect(response.ok()).toBeTruthy();

  const user = await response.json();
  expect(user).toHaveProperty('email');
});
```

---

## State Management

### Server State (TanStack Query)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function UserProfile({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<User>) => updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
  });

  if (isLoading) return <Skeleton />;
  return <UserCard user={user} onUpdate={updateMutation.mutate} />;
}
```

### Client State (Zustand)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'app-storage' }
  )
);
```

---

## Styling (Tailwind CSS)

### Responsive Design

```html
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- Mobile first: full → half → third -->
</div>
```

### Interactive States

```html
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2 disabled:opacity-50">
  Click me
</button>
```

### Component Patterns

```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600
           focus:ring-2 focus:ring-blue-300 disabled:opacity-50;
  }
}
```

---

## Troubleshooting

### TypeScript Issues

| Issue | Solution |
|-------|----------|
| `Object is possibly 'null'` | Add explicit null check or use optional chaining `?.` |
| Array access returns `T \| undefined` | Use `.at()` method or add bounds checking |
| Type guard not narrowing | Ensure predicate returns `value is Type` not `boolean` |

### React Issues

| Issue | Solution |
|-------|----------|
| Hydration mismatch | Check server/client component boundaries, use `'use client'` directive |
| `useTransition` not preventing blocking | Ensure expensive computation is inside `startTransition` callback |
| Server Action type errors | Add `'use server'` directive, ensure return types are serializable |

### Playwright Issues

| Issue | Solution |
|-------|----------|
| Flaky tests | Add `waitForLoadState('networkidle')` or increase timeout |
| Selectors break on UI change | Use accessibility selectors: `getByRole`, `getByLabel` |
| Slow CI tests | Enable test sharding: `--shard=1/4` |

---

## Best Practices Checklist

- [ ] TypeScript strict mode enabled in tsconfig.json
- [ ] All API responses use discriminated union types
- [ ] Null checks use optional chaining and type guards
- [ ] Server Components are default, Client Components marked explicitly
- [ ] Forms use Server Actions with Zod validation
- [ ] Unit tests colocated with source files
- [ ] E2E tests use accessibility-first selectors
- [ ] Tailwind uses responsive prefixes (mobile-first)
