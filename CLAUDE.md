# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Unit tests | `npm run test:unit` |
| Single unit test | `npx vitest run path/to/test.ts` |
| E2E tests | `npm run test:e2e` |
| E2E debug | `npm run test:e2e:debug` |

## Architecture

Pure client-side SPA (React 19 + Vite) with offline-first data layer.

@docs/component-architecture.md
@docs/state-management.md
@docs/api-services.md
@docs/typescript-patterns.md

### Key Patterns
- **No Server Components** - Pure browser-based, no SSR
- **Zustand selectors** - `useAppStore(state => state.value)`
- **Offline-first** - IndexedDB local + Supabase sync
- **Zod validation** - All API responses validated

## TypeScript - Strict Mode

```json
{ "strict": true, "noUncheckedIndexedAccess": true }
```

- Use `unknown` over `any`
- Type guards over assertions
- Handle null/undefined explicitly

## Testing

**Unit (Vitest):**
- Colocated: `src/**/__tests__/` or `tests/unit/`
- Environment: `happy-dom` with `fake-indexeddb/auto`
- Mock Supabase client module, not individual functions

**E2E (Playwright):**
- Accessibility selectors: `getByRole`, `getByLabel`
- Global auth setup with `storageState.json`

## Core Principles

1. TypeScript strict mode is non-negotiable
2. Zustand selectors prevent unnecessary re-renders
3. Test behavior, not implementation
4. Accessibility selectors over CSS selectors
5. Mobile-first responsive design
6. Offline-first with IndexedDB + Supabase sync
