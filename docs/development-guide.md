# Development Guide

> Development setup, commands, and workflow for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Prerequisites

| Requirement | Version | Notes |
|------------|---------|-------|
| Node.js | 24.x | Pinned in `.nvmrc` |
| npm | 10.x+ | Lock file: `package-lock.json` |
| Git | 2.x+ | Required for version control |
| Supabase CLI | 2.65+ | Optional: local dev, type generation |
| dotenvx | 1.51+ | Encrypted env vars (dev dependency) |

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/sallvainian/My-Love.git
cd My-Love

# 2. Use correct Node version
nvm use   # reads .nvmrc → Node 24.x

# 3. Install dependencies
npm install

# 4. Environment setup (see below)

# 5. Start development server
npm run dev
```

## Environment Variables

Environment variables are managed with **dotenvx** (encrypted `.env` committed to git).

### For Development

The `.env` file is encrypted and committed to the repository. If you have the `DOTENV_PRIVATE_KEY`, decryption happens automatically at runtime:

```bash
# .env is encrypted — dotenvx decrypts at runtime
npm run dev      # Uses ./scripts/dev-with-cleanup.sh → dotenvx run
npm run build    # Uses dotenvx run --overload
```

### Required Variables

| Variable | Purpose | Source |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key (safe for client) | Supabase Dashboard → Settings → API |

### For New Contributors

```bash
# Option 1: Get the DOTENV_PRIVATE_KEY from the project owner
# Then decrypt and work normally

# Option 2: Create your own .env from template
cp .env.example .env
# Fill in your Supabase credentials
```

### E2E Test Users (Optional)

E2E tests require test user accounts in Supabase Auth:
```bash
node scripts/setup-test-users.js  # Creates both test users automatically
```

## Development Commands

### Core

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (with cleanup script) |
| `npm run dev:raw` | Start Vite dev server directly |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |

### Code Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint + Prettier auto-fix |
| `npm run format` | Prettier format all files |
| `npm run format:check` | Prettier check (CI mode) |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test:unit` | Vitest run (single pass) |
| `npm run test:unit:watch` | Vitest watch mode |
| `npm run test:unit:ui` | Vitest browser UI |
| `npm run test:unit:coverage` | Vitest with V8 coverage |
| `npm run test:e2e` | Playwright E2E (with cleanup) |
| `npm run test:e2e:raw` | Playwright test directly |
| `npm run test:e2e:ui` | Playwright interactive UI |
| `npm run test:e2e:debug` | Playwright debug mode |
| `npm run test:smoke` | Post-build smoke tests |
| `npm run test:burn-in` | Burn-in stability tests |
| `npm run test:ci-local` | Simulate full CI locally |

### Deployment

| Command | Description |
|---------|-------------|
| `npm run predeploy` | Build + smoke tests |
| `npm run deploy` | Deploy to GitHub Pages via gh-pages |

## Testing Strategy

### Unit Tests (Vitest 4.0)

- **Environment**: happy-dom
- **Setup**: `tests/setup.ts`
- **Pattern**: `src/**/*.test.{ts,tsx}` and `tests/**/*.test.{ts,tsx}`
- **Mocking**: `fake-indexeddb` for IndexedDB, manual mocks for Supabase
- **TDD Guard**: `tdd-guard-vitest` reporter enforces TDD discipline
- **Path alias**: `@/` maps to `src/`

### Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Lines | 80% |
| Functions | 80% |
| Branches | 80% |
| Statements | 80% |

Provider: V8 | Reporters: text, json, html

### E2E Tests (Playwright 1.57)

- **Config**: `playwright.config.ts`
- **Test users**: Require Supabase auth accounts
- **Store access**: `window.__APP_STORE__` for state assertions
- **Test IDs**: `data-testid="{feature}-{element}"` convention

### Test Data IDs

Components use `data-testid` attributes following the pattern `{feature}-{element}`:
- `scripture-overview-start-button`
- `mood-tracker-submit`
- `love-notes-message-input`

## Build Pipeline

### Local Build

```bash
npm run build
# 1. dotenvx decrypts .env
# 2. tsc -b (TypeScript compilation check)
# 3. vite build (bundle + tree-shake + minify)
# Output: dist/
```

### CI Pipeline (GitHub Actions)

**Trigger**: Push to `main`/`develop` or PR to `main`/`develop`

```
Stage 1: Lint & Type Check (5 min timeout)
├── ESLint
├── TypeScript type check
└── Prettier format check

Stage 2: Unit Tests (10 min timeout)
├── Vitest run
└── Coverage report

Stage 3: E2E Tests (15 min timeout)
├── Playwright install
├── Build app
└── Run E2E suite

Stage 4: Deploy (on push to main only)
├── Generate Supabase types
├── Build application
├── Smoke tests
├── Deploy to GitHub Pages
└── Health checks (HTTP + Supabase)
```

### Deployment Target

- **Platform**: GitHub Pages
- **URL**: `https://sallvainian.github.io/My-Love/`
- **Method**: Static SPA with 404.html redirect for client-side routing
- **Health checks**: HTTP status, response time, JS bundle, PWA manifest, Supabase connection

## Code Conventions

### File Organization

- Components: `src/components/{FeatureName}/{FeatureName}.tsx`
- Tests co-located: `src/components/{FeatureName}/__tests__/`
- One component per file, barrel exports via `index.ts`

### TypeScript

- Strict mode enabled
- Explicit return types on exported functions
- Zod validation at service boundaries
- `unknown` over `any`

### Styling

- Tailwind CSS 4.x (utility-first)
- No CSS modules or styled-components
- Theme colors via `src/utils/themes.ts`
- 5 theme variants: sunset, coral, ocean, lavender, rose

### State Management

- Zustand selectors: `useAppStore(s => s.field)`
- Custom hooks for complex access: `useLoveNotes()`, `usePhotos()`
- Direct store access outside React: `useAppStore.getState()`

### Imports

```typescript
// Order: React → external → internal → relative
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { MoodButton } from './MoodButton';
```

## Common Development Tasks

### Adding a New Feature

1. Create component folder: `src/components/{Feature}/`
2. Add store slice if needed: `src/stores/slices/{feature}Slice.ts`
3. Add to `useAppStore.ts` composition
4. Add service if data persistence needed: `src/services/{feature}Service.ts`
5. Add route in `App.tsx` and nav item in `BottomNavigation`
6. Add `data-testid` attributes for E2E testing

### Adding a Database Table

1. Create migration: `supabase/migrations/{timestamp}_{description}.sql`
2. Add RLS policies in the migration
3. Update `src/types/database.types.ts` (or run `supabase gen types`)
4. Add Zod schema in `src/validation/schemas.ts` or `src/api/validation/`
5. Create/update service in `src/services/`
6. Add IndexedDB store if offline support needed (bump DB version in `dbSchema.ts`)

### Adding a Supabase RPC

1. Add function to migration file with `SECURITY DEFINER`
2. Call via `supabase.rpc('function_name', params)` in service layer
3. Validate response with Zod schema

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `dotenvx` decrypt fails | Ensure `DOTENV_PRIVATE_KEY` is set or get from project owner |
| IndexedDB errors in tests | Check `fake-indexeddb` is imported in setup |
| Supabase auth errors | Verify `.env` variables match Supabase dashboard |
| PWA not updating | Clear service worker cache, hard refresh |
| Type errors after DB change | Regenerate types: `npx supabase gen types typescript` |

### Useful Debug Commands

```bash
# Check what Supabase types look like
npx supabase gen types typescript --project-id xojempkrugifnaveqtqc

# Reset local Supabase (if using local dev)
npx supabase db reset

# Analyze bundle size
npm run build  # rollup-plugin-visualizer generates stats
```
