# Technology Stack

> Complete technology inventory for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Core Technologies

### Language & Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | ~5.9.3 | Static typing with strict mode |
| Node.js | 24.13.0 | Development runtime (via .nvmrc) |
| ES2022 | Target | JavaScript compilation target |

### Frontend Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^19.2.3 | UI framework (React 19 with compiler optimizations) |
| React DOM | ^19.2.3 | DOM rendering |
| Vite | ^7.3.1 | Build tool & dev server |

### State Management & Data

| Technology | Version | Purpose |
|------------|---------|---------|
| Zustand | ^5.0.10 | Global state management (10 slices, compose pattern) |
| idb | ^8.0.3 | IndexedDB wrapper for offline storage (v5 schema, 8 stores) |
| Zod | ^4.3.5 | Runtime schema validation at API boundaries + input validation |

### Backend (BaaS)

| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase JS | ^2.90.1 | Client SDK (Auth, DB, Storage, Realtime, Edge Functions) |
| Supabase Auth | — | Email/password + Google OAuth |
| Supabase Database | PostgreSQL | Primary data store (11 tables, RLS on all) |
| Supabase Storage | — | Photo storage with signed URLs |
| Supabase Realtime | — | Live subscriptions (Broadcast + postgres_changes) |
| Supabase Edge Functions | — | Server-side operations (image upload) |

### UI Libraries

| Technology | Version | Purpose |
|------------|---------|---------|
| Framer Motion | ^12.27.1 | React animations (page transitions, gestures) |
| Lucide React | ^0.562.0 | Icon library (tree-shakeable) |
| react-window | ^2.2.5 | Virtualized lists for performance |
| react-window-infinite-loader | ^2.0.1 | Infinite scroll loading |
| DOMPurify | ^3.3.1 | HTML sanitization (XSS prevention) |

### Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | ^4.1.17 | Utility-first CSS framework |
| @tailwindcss/postcss | ^4.1.18 | PostCSS integration |
| PostCSS | ^8.5.6 | CSS processing pipeline |
| Autoprefixer | ^10.4.23 | Browser vendor prefixes |

### PWA & Offline

| Technology | Version | Purpose |
|------------|---------|---------|
| vite-plugin-pwa | ^1.2.0 | PWA build integration (injectManifest strategy) |
| Workbox (window) | ^7.4.0 | Service worker registration & updates |
| eventsource | ^4.1.0 | SSE polyfill for Supabase Realtime |

### Custom Themes

Four color themes defined in Tailwind config:
- **Sunset** — warm pink/rose palette (primary)
- **Coral** — warm orange/coral palette
- **Ocean** — teal/cyan palette
- **Lavender** — purple/violet palette
- **Rose** — rose/crimson palette

Custom fonts: Inter (sans), Playfair Display (serif), Dancing Script (cursive)

Custom animations: float, fade-in, scale-in, slide-up, pulse-slow, heart-beat, shimmer

## Development Tools

### Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | ^4.0.17 | Unit test runner |
| @vitest/coverage-v8 | ^4.0.17 | Code coverage (80% threshold on lines/functions/branches/statements) |
| @vitest/ui | ^4.0.17 | Visual test dashboard |
| Playwright | ^1.57.0 | E2E testing (Chromium, retries in CI) |
| @seontechnologies/playwright-utils | ^3.13.1 | Enhanced Playwright fixtures |
| Testing Library (React) | ^16.3.2 | Component testing utilities |
| Testing Library (user-event) | ^14.6.1 | User interaction simulation |
| Testing Library (jest-dom) | ^6.9.1 | Custom DOM matchers |
| happy-dom | ^20.3.4 | Lightweight DOM environment for unit tests |
| fake-indexeddb | ^6.2.5 | IndexedDB mock for testing offline features |
| tdd-guard-vitest | ^0.1.6 | TDD enforcement reporter (fails if tests added without code) |

### Code Quality

| Technology | Version | Purpose |
|------------|---------|---------|
| ESLint | ^9.39.2 | Code linting (flat config) |
| typescript-eslint | ^8.53.1 | TypeScript-specific linting |
| eslint-plugin-react-hooks | ^7.0.1 | React hooks rules (React 19 aware) |
| eslint-plugin-react-refresh | ^0.4.26 | Fast Refresh validation |
| Prettier | ^3.8.0 | Code formatting |
| prettier-plugin-tailwindcss | ^0.7.2 | Tailwind class sorting |

### Build & Bundle

| Technology | Version | Purpose |
|------------|---------|---------|
| Vite | ^7.3.1 | Bundler with HMR |
| @vitejs/plugin-react | ^5.1.2 | React Fast Refresh + JSX |
| vite-plugin-checker | ^0.12.0 | Real-time TypeScript checking in dev |
| rollup-plugin-visualizer | ^6.0.5 | Bundle size analysis (output: dist/stats.html) |

### Deployment & DevOps

| Technology | Version | Purpose |
|------------|---------|---------|
| gh-pages | ^6.3.0 | GitHub Pages deployment |
| @dotenvx/dotenvx | ^1.51.4 | Encrypted environment variables |
| dotenv | ^17.2.3 | Environment variable loading |
| tsx | ^4.21.0 | TypeScript execution for scripts |
| supabase (CLI) | ^2.65.6 | Local Supabase development |

## Configuration Summary

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript project references (app + node) |
| `tsconfig.app.json` | App config: ES2022, strict, bundler resolution, react-jsx |
| `tsconfig.node.json` | Node scripts config |
| `vite.config.ts` | Build: manual chunks, PWA (injectManifest), checker, visualizer |
| `vitest.config.ts` | Unit tests: happy-dom, TDD guard, `@` alias, 80% coverage thresholds |
| `playwright.config.ts` | E2E: Chromium, webServer auto-start, traces on failure |
| `eslint.config.js` | Flat config: strict TS, React 19 hooks, scripture-reading strict rules |
| `tailwind.config.js` | Custom themes (5 palettes), fonts, animations |
| `postcss.config.js` | PostCSS with Tailwind + Autoprefixer |
| `.nvmrc` | Node.js 24.13.0 |
| `.env` / `.env.example` | Supabase URL + anon key (encrypted via dotenvx) |

## Architecture Pattern

- **Type**: Monolith SPA (Single Page Application)
- **Pattern**: Component-based with layered architecture
- **Data Flow**: Components → Hooks → Store (Zustand slices) → Services → API (Supabase)
- **Offline Strategy**: IndexedDB local storage + Supabase sync + Background Sync API
- **PWA**: Service worker with injectManifest strategy (Workbox) — network-only for code, precache for static assets
- **Real-time**: Supabase Broadcast API (moods, love notes) + postgres_changes (interactions)
- **Validation**: Zod schemas at API boundaries (response validation) + input validation (user forms)

## Build Optimization

### Manual Chunk Splitting

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', 'idb', 'zod'],
  'vendor-animation': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
}
```

### Browser Support

```json
{
  "browserslist": [
    "defaults and supports es6-module",
    "maintained node versions"
  ]
}
```

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | Zustand (not Redux) | Minimal boilerplate, slice composition, no providers |
| Offline storage | IndexedDB via idb | Structured data, large capacity, async API |
| Backend | Supabase BaaS | Auth + DB + Storage + Realtime in one SDK |
| Validation | Zod 4 | TypeScript-first, composable schemas, small bundle |
| Animation | Framer Motion | Gesture support, layout animations, React 19 compatible |
| PWA strategy | injectManifest | Full control over service worker caching behavior |
| Testing | Vitest + Playwright | Fast unit tests (happy-dom) + reliable E2E |
| TDD enforcement | tdd-guard-vitest | CI fails if tests added without corresponding code changes |
| CSS | Tailwind 4 | Utility-first, zero runtime, PostCSS integration |
| Deployment | GitHub Pages | Free hosting, simple CI/CD via GitHub Actions |
