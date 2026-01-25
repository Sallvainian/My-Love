# My-Love Project Context

> AI-optimized context document for development assistance. Generated 2026-01-23.

## Quick Reference

| Aspect | Value |
|--------|-------|
| **Type** | Client-side SPA (PWA) |
| **Framework** | React 19 + TypeScript 5.9 |
| **Build** | Vite 7.3 |
| **State** | Zustand 5.0 (8 slices) |
| **Backend** | Supabase (BaaS) |
| **Styling** | Tailwind CSS 4.1 |
| **Deployment** | GitHub Pages |

## Project Purpose

A couples communication app enabling:
- Daily love messages with rotation
- Real-time love notes chat
- Mood tracking with partner view
- Photo memories gallery
- Playful interactions (poke/kiss)
- Relationship timers

## Critical Patterns

### No Server Components
Pure client-side SPA - **never use** `"use client"` or `"use server"` directives.

### State Access Pattern
```typescript
// Always use selector pattern
const value = useAppStore(state => state.value);

// Multiple values
const { moods, saveMoodEntry } = useAppStore(state => ({
  moods: state.moods,
  saveMoodEntry: state.saveMoodEntry,
}));
```

### API Validation Pattern
```typescript
// All API responses validated with Zod
const validatedData = SupabaseMoodSchema.parse(response);
```

### Offline-First Pattern
```typescript
// Local first, sync to Supabase
await indexedDBService.save(data);  // Local
await supabaseApi.sync(data);       // Remote
```

## Directory Structure

```
src/
├── api/              # Supabase client & services (8 files)
├── components/       # React components (54 files in 15 modules)
├── hooks/            # Custom React hooks (10 files)
├── services/         # IndexedDB & sync services (13 files)
├── stores/           # Zustand store & slices (9 files)
├── types/            # TypeScript types (3 files)
├── utils/            # Utilities (themes, dates, etc.)
├── validation/       # Zod schemas
└── data/             # Default messages
```

## Key Files

| Purpose | File |
|---------|------|
| Entry point | `src/main.tsx` |
| App root | `src/App.tsx` |
| Store | `src/stores/useAppStore.ts` |
| Supabase client | `src/api/supabaseClient.ts` |
| Auth service | `src/api/authService.ts` |
| Database types | `src/types/database.types.ts` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles with partner link |
| `moods` | Mood entries (type, note, timestamp) |
| `interactions` | Poke/kiss/fart records |
| `love_notes` | Chat messages |
| `photos` | Photo metadata |
| `partner_requests` | Partner connection flow |

## Zustand Slices

| Slice | Responsibility |
|-------|----------------|
| `messagesSlice` | Daily message rotation |
| `photosSlice` | Photo gallery state |
| `settingsSlice` | User preferences |
| `navigationSlice` | View routing |
| `moodSlice` | Mood tracking |
| `interactionsSlice` | Poke/kiss state |
| `partnerSlice` | Partner info |
| `notesSlice` | Love notes chat |

## Common Operations

### Adding a new feature
1. Create component in `src/components/[FeatureName]/`
2. Add slice in `src/stores/slices/` if state needed
3. Add hook in `src/hooks/` for reusable logic
4. Add API service in `src/api/` if backend needed

### Database operations
1. Use typed Supabase client from `src/api/supabaseClient.ts`
2. Validate responses with Zod schemas
3. Handle offline with IndexedDB fallback

### Testing
- Unit: Vitest + Testing Library (`npm run test:unit`)
- E2E: Playwright (`npm run test:e2e`)
- Mock Supabase client module, not individual functions

## Don'ts

- Don't use `any` - use `unknown` instead
- Don't use React Router - manual URL routing
- Don't commit `.env.keys` - contains secrets
- Don't use Server Components - client-side only
- Don't skip Zod validation on API responses

## Environment

- Node.js 18+
- npm (check `package-lock.json`)
- Encrypted `.env` with dotenvx
- TypeScript strict mode enabled
