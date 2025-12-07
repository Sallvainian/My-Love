# React 19 Patterns Guide

> Extended React 19 patterns for the My-Love project

@docs/03-Development/typescript-patterns.md
@docs/04-Testing-QA/testing-guide.md
@docs/03-Development/troubleshooting.md

*Last Updated: December 2024*

---

## Server Components (Default)

Server Components are the default in React 19. They run on the server and can be async.

```typescript
// app/dashboard/page.tsx - Server Component (default)
import { Suspense } from 'react';

export default async function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
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

### When to Use Server Components

| Use Server Components | Use Client Components |
|-----------------------|----------------------|
| Fetch data | onClick, onChange handlers |
| Access backend resources | useState, useEffect |
| Keep sensitive info server-side | Browser APIs |
| Large dependencies | Interactivity |

---

## Client Components

Mark interactive components with `'use client'` directive.

```typescript
// components/SearchBox.tsx
'use client';

import { useState, useTransition, useDeferredValue } from 'react';

export function SearchBox({ data }: { data: Item[] }) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const handleSearch = (value: string) => {
    setQuery(value); // Urgent update
    startTransition(() => {
      // Non-urgent filtering - won't block input
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

---

## useTransition Pattern

Use `useTransition` for non-blocking state updates.

```typescript
'use client';

import { useState, useTransition } from 'react';

function TabContainer() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  function selectTab(nextTab: string) {
    startTransition(() => {
      setTab(nextTab); // Non-blocking tab switch
    });
  }

  return (
    <div>
      <TabButtons onSelect={selectTab} />
      <div className={isPending ? 'opacity-50' : ''}>
        <TabContent tab={tab} />
      </div>
    </div>
  );
}
```

---

## useDeferredValue Pattern

Defer expensive re-renders for smoother UX.

```typescript
'use client';

import { useState, useDeferredValue, memo } from 'react';

function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div className={isStale ? 'opacity-50' : ''}>
      <SlowList query={deferredQuery} />
    </div>
  );
}

const SlowList = memo(function SlowList({ query }: { query: string }) {
  // Expensive filtering/rendering
  const items = filterItems(query);
  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
});
```

---

## Server Actions

Server Actions handle form mutations with automatic revalidation.

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

### Using Server Actions in Forms

```typescript
// components/PostForm.tsx
'use client';

import { useFormStatus } from 'react-dom';
import { createPost } from '@/app/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create Post'}
    </button>
  );
}

export function PostForm() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <SubmitButton />
    </form>
  );
}
```

---

## useOptimistic Pattern

Show optimistic UI while server action completes.

```typescript
'use client';

import { useOptimistic } from 'react';
import { addTodo } from '@/app/actions';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );

  const handleAdd = async (formData: FormData) => {
    const title = formData.get('title') as string;
    const tempTodo = {
      id: crypto.randomUUID(),
      title,
      completed: false
    };

    addOptimisticTodo(tempTodo); // Instant UI update
    await addTodo(formData);     // Server action
  };

  return (
    <>
      <form action={handleAdd}>
        <input name="title" placeholder="New todo" />
        <button type="submit">Add</button>
      </form>
      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </>
  );
}
```

---

## Suspense Patterns

### Streaming with Suspense

```typescript
// app/page.tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <main>
      <Header /> {/* Renders immediately */}

      <Suspense fallback={<ProductsSkeleton />}>
        <Products /> {/* Streams when ready */}
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews /> {/* Streams independently */}
      </Suspense>
    </main>
  );
}
```

### Nested Suspense Boundaries

```typescript
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Suspense fallback={<SidebarSkeleton />}>
    <Sidebar />
  </Suspense>
  <Suspense fallback={<ContentSkeleton />}>
    <MainContent />
  </Suspense>
</Suspense>
```

---

## State Management Integration

### TanStack Query for Server State

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function UserProfile({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
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

### Zustand for Client State

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>()(
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

## Best Practices Checklist

- [ ] Default to Server Components, add `'use client'` only when needed
- [ ] Use `useTransition` for non-blocking state updates
- [ ] Use `useDeferredValue` for expensive computations
- [ ] Validate Server Action inputs with Zod
- [ ] Use `useOptimistic` for instant feedback
- [ ] Wrap async components in Suspense boundaries
- [ ] Use TanStack Query for server state, Zustand for client state

---

*See also: [CLAUDE.md](../../CLAUDE.md) for quick reference*
