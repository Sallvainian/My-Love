# Technology Stack Summary

## Core Runtime

| Technology | Version | Role |
|-----------|---------|------|
| React | 19.2.4 | UI framework with concurrent features |
| TypeScript | 5.9.3 | Strict type system (`no-explicit-any` enforced) |
| Vite | 7.3.1 | Build tool, dev server, HMR |
| Tailwind CSS | 4.1.17 | Utility-first CSS (v4, PostCSS integration) |
| Framer Motion | 12.29.3 | Animation library (LazyMotion for tree-shaking) |
| Zustand | 5.0.11 | State management (single store, 10 slices, persist) |
| Supabase | 2.93.3 | Auth, PostgreSQL, Storage, Realtime |
| Zod | 4.3.6 | Runtime schema validation |
| idb | 8.0.3 | Promise-based IndexedDB wrapper |

## Supporting Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| lucide-react | 0.563.0 | Tree-shakeable SVG icons |
| react-window | 2.2.6 | Virtualized list rendering |
| react-window-infinite-loader | 2.0.1 | Infinite scroll for virtualized lists |
| dompurify | 3.3.1 | XSS sanitization for user content |
| workbox-window | 7.4.0 | Service worker lifecycle management |
| eventsource | 4.1.0 | SSE polyfill for Supabase Realtime |

## Build and Development

| Tool | Version | Purpose |
|------|---------|---------|
| Vite | 7.3.1 | Build tool with React plugin |
| @vitejs/plugin-react | 5.1.3 | React Fast Refresh |
| vite-plugin-pwa | 1.2.0 | PWA support (InjectManifest) |
| vite-plugin-checker | 0.12.0 | In-editor type checking |
| @dotenvx/dotenvx | 1.52.0 | Encrypted env variables |
| rollup-plugin-visualizer | 6.0.5 | Bundle analysis |
| gh-pages | 6.3.0 | GitHub Pages deployment |

## Testing Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.0.17 | Unit test runner |
| @vitest/coverage-v8 | 4.0.18 | Code coverage |
| @testing-library/react | 16.3.2 | Component testing |
| @testing-library/jest-dom | 6.9.1 | DOM matchers |
| @testing-library/user-event | 14.6.1 | User interaction simulation |
| happy-dom | 20.5.0 | Lightweight DOM for tests |
| fake-indexeddb | 6.2.5 | IndexedDB mock |
| @playwright/test | 1.58.2 | E2E testing |
| @axe-core/playwright | 4.11.1 | Accessibility testing |
| @faker-js/faker | 10.3.0 | Test data generation |
| tdd-guard-vitest | 0.1.6 | TDD enforcement |

## Code Quality

| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 9.39.2 | Linting (flat config, no-explicit-any as error) |
| typescript-eslint | 8.54.0 | TypeScript ESLint rules |
| Prettier | 3.8.1 | Code formatting |
| prettier-plugin-tailwindcss | 0.7.2 | Tailwind class sorting |

## Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| supabase (CLI) | 2.76.3 | Local dev, migrations, type generation |
| Node.js | 24.13.0 | Runtime (see .nvmrc) |
| npm | (bundled) | Package manager |

## Module System

- **ES Modules**: `"type": "module"` in `package.json`
- **Browser Target**: `defaults and supports es6-module`
- **Path Alias**: `@/` maps to `src/` (configured in `vitest.config.ts`)

## Related Documentation

- [Architecture - Technology Stack](../architecture/02-technology-stack.md)
- [Complete Directory Tree](./02-directory-tree.md)
