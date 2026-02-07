# Architecture Overview

> System architecture and patterns for My-Love project.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser/PWA)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   React     │  │   Zustand   │  │   Service Worker    │  │
│  │ Components  │──│    Store    │──│   (Workbox/PWA)     │  │
│  │  (54 tsx)   │  │  (8 slices) │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────┴──────────────────┴─────────────────────┐          │
│  │              Custom Hooks (10)                 │          │
│  └──────────────────┬────────────────────────────┘          │
│                     │                                        │
│  ┌──────────────────┴────────────────────────────┐          │
│  │           Services Layer (13 files)            │          │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐ │          │
│  │  │ IndexedDB  │  │   Sync     │  │ Realtime │ │          │
│  │  │  Services  │  │ Services   │  │ Service  │ │          │
│  │  └─────┬──────┘  └─────┬──────┘  └────┬─────┘ │          │
│  └────────┼───────────────┼───────────────┼──────┘          │
│           │               │               │                  │
├───────────┼───────────────┼───────────────┼──────────────────┤
│           ▼               ▼               ▼                  │
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │  IndexedDB  │  │         API Layer (8 files)          │   │
│  │  (Offline)  │  │  ┌─────────┐  ┌─────────┐  ┌──────┐ │   │
│  │             │  │  │ Auth    │  │ Mood    │  │ Error│ │   │
│  └─────────────┘  │  │ Service │  │  API    │  │Handle│ │   │
│                   │  └─────────┘  └─────────┘  └──────┘ │   │
│                   │        ▲            ▲          ▲     │   │
│                   │        └────────────┴──────────┘     │   │
│                   │               Zod Validation          │   │
│                   └───────────────────┬─────────────────┘   │
└───────────────────────────────────────┼─────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase (BaaS)                         │
│  ┌─────────┐  ┌─────────────┐  ┌─────────┐  ┌───────────┐   │
│  │  Auth   │  │  PostgreSQL  │  │ Storage │  │ Realtime  │   │
│  │  (JWT)  │  │  (6 tables)  │  │ (Photos)│  │ (Broadcast│   │
│  └─────────┘  └─────────────┘  └─────────┘  └───────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Patterns

### 1. Client-Side SPA (No SSR)

Pure client-side rendering with Vite:
- No Server Components
- No `"use client"` or `"use server"` directives
- All code runs in browser

### 2. Offline-First Data Strategy

```
User Action → IndexedDB (Local) → Supabase (Remote)
                    │                    │
                    └───── Sync ─────────┘
```

| Data Type | Primary Storage | Sync Strategy |
|-----------|-----------------|---------------|
| Settings | LocalStorage | N/A |
| Messages | IndexedDB | Read-only |
| Photos | IndexedDB + Storage | On-demand |
| Moods | IndexedDB | Bidirectional |
| Notes | Supabase | Real-time |

### 3. State Management Pattern

Zustand with slice composition:

```typescript
// Slice factory pattern
const createMoodSlice = (set, get, api) => ({
  moods: [],
  saveMoodEntry: async (entry) => { ... },
});

// Composed store
const useAppStore = create(
  persist((set, get, api) => ({
    ...createMessagesSlice(set, get, api),
    ...createMoodSlice(set, get, api),
    // ... 8 slices total
  }))
);
```

### 4. API Validation Pattern

All Supabase responses validated with Zod:

```typescript
// Schema definition
const SupabaseMoodSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  mood_type: z.string(),
  // ...
});

// Usage in API
const validatedMood = SupabaseMoodSchema.parse(response);
```

### 5. Component Organization

Feature-based folder structure:

```
src/components/
├── [FeatureName]/
│   ├── FeatureName.tsx      # Main component
│   ├── SubComponent.tsx     # Child components
│   └── __tests__/           # Colocated tests
└── shared/                  # Cross-feature utilities
```

### 6. Real-Time Subscription Pattern

Uses Supabase Broadcast (not postgres_changes) due to RLS:

```typescript
// Partner mood updates via Broadcast
supabase.channel(`mood-updates:${userId}`)
  .on('broadcast', { event: 'mood-update' }, handler)
  .subscribe();
```

## Data Flow

### Read Flow
```
Component → Hook → Store Selector → State
                         ↓
              Service → IndexedDB/Supabase
```

### Write Flow
```
Component → Hook → Store Action → Service
                         ↓
              IndexedDB (Local) → Supabase (Remote)
```

### Real-Time Flow
```
Supabase → Realtime Service → Store Action → Component Re-render
```

## Security Architecture

### Row Level Security (RLS)

All Supabase tables have RLS policies:
- Users can only access their own data
- Partner data accessible via `partner_id` relationship
- No admin/superuser access patterns

### Authentication

- Email/password via Supabase Auth
- Google OAuth support
- JWT tokens stored in IndexedDB for SW access
- Auto-refresh with Supabase client

## PWA Architecture

### Service Worker Strategy

```typescript
// InjectManifest pattern
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  // Custom caching in sw.ts
});
```

### Caching Strategy

| Resource | Strategy |
|----------|----------|
| Static assets | Precache |
| API calls | Network-only |
| Photos | Cache-first |

## Deployment Architecture

```
GitHub (main branch)
        │
        ▼
GitHub Actions (deploy.yml)
        │
        ├── Build (Vite)
        ├── Generate Supabase types
        ├── Run smoke tests
        └── Deploy to GitHub Pages
                │
                ▼
        GitHub Pages (/My-Love/)
```
