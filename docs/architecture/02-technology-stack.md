# Technology Stack

> Last updated: 2026-03-03

## Runtime Dependencies

| Package                        | Version  | Purpose                                              |
| ------------------------------ | -------- | ---------------------------------------------------- |
| `react`                        | ^19.2.4  | UI framework (React 19 with concurrent features)     |
| `react-dom`                    | ^19.2.4  | React DOM renderer                                   |
| `@supabase/supabase-js`        | ^2.97.0  | Backend client (auth, database, storage, realtime)   |
| `zustand`                      | ^5.0.11  | Lightweight state management with slice pattern      |
| `zod`                          | ^4.3.6   | Runtime schema validation at service boundaries      |
| `idb`                          | ^8.0.3   | Promise-based IndexedDB wrapper for local storage    |
| `framer-motion`                | ^12.34.3 | Animation library with `LazyMotion` for tree-shaking |
| `lucide-react`                 | ^0.575.0 | Icon library (tree-shakeable SVG icons)              |
| `react-window`                 | ^2.2.7   | Virtualized list rendering for performance           |
| `react-window-infinite-loader` | ^2.0.1   | Infinite scroll integration with react-window        |
| `dompurify`                    | ^3.3.1   | XSS sanitization for user-generated content          |
| `@sentry/react`                | ^10.39.0 | Error tracking and performance monitoring            |
| `workbox-window`               | ^7.4.0   | Service worker lifecycle management                  |
| `eventsource`                  | ^4.1.0   | SSE polyfill for Supabase realtime                   |

## Development Dependencies

### Build and Tooling

| Package                    | Version | Purpose                               |
| -------------------------- | ------- | ------------------------------------- |
| `vite`                     | ^7.3.1  | Build tool and dev server             |
| `@vitejs/plugin-react`     | ^5.1.4  | React Fast Refresh for Vite           |
| `typescript`               | ~5.9.3  | Type checking and compilation         |
| `vite-plugin-pwa`          | ^1.2.0  | PWA support (InjectManifest strategy) |
| `vite-plugin-checker`      | ^0.12.0 | In-editor type checking overlay       |
| `@sentry/vite-plugin`      | ^5.0.0  | Sentry source map upload during build |
| `rollup-plugin-visualizer` | ^6.0.5  | Bundle size analysis                  |
| `tsx`                      | ^4.21.0 | TypeScript execution for scripts      |

### CSS and Styling

| Package                       | Version  | Purpose                            |
| ----------------------------- | -------- | ---------------------------------- |
| `tailwindcss`                 | ^4.1.17  | Utility-first CSS framework (v4)   |
| `@tailwindcss/postcss`        | ^4.2.1   | PostCSS integration for Tailwind   |
| `postcss`                     | ^8.5.6   | CSS transformation pipeline        |
| `autoprefixer`                | ^10.4.27 | Vendor prefix automation           |
| `prettier-plugin-tailwindcss` | ^0.7.2   | Tailwind class sorting in Prettier |

### Testing

| Package                              | Version | Purpose                                  |
| ------------------------------------ | ------- | ---------------------------------------- |
| `vitest`                             | ^4.0.17 | Unit test runner (Vite-native)           |
| `@vitest/coverage-v8`                | ^4.0.18 | Code coverage via V8                     |
| `@vitest/ui`                         | ^4.0.17 | Browser-based test UI                    |
| `@testing-library/react`             | ^16.3.2 | React component testing utilities        |
| `@testing-library/jest-dom`          | ^6.9.1  | Custom DOM matchers                      |
| `@testing-library/user-event`        | ^14.6.1 | User interaction simulation              |
| `happy-dom`                          | ^20.7.0 | Lightweight DOM implementation for tests |
| `fake-indexeddb`                     | ^6.2.5  | IndexedDB mock for unit tests            |
| `@playwright/test`                   | ^1.58.2 | End-to-end test framework                |
| `@seontechnologies/playwright-utils` | ^3.14.0 | Playwright fixture utilities             |
| `@axe-core/playwright`               | ^4.11.1 | Accessibility testing                    |
| `@faker-js/faker`                    | ^10.3.0 | Test data generation                     |
| `tdd-guard-vitest`                   | ^0.1.6  | TDD enforcement plugin                   |

### Linting and Formatting

| Package                       | Version | Purpose                            |
| ----------------------------- | ------- | ---------------------------------- |
| `eslint`                      | ^9.39.2 | Code linting (flat config)         |
| `@eslint/js`                  | ^9.39.2 | ESLint core rules                  |
| `typescript-eslint`           | ^8.56.1 | TypeScript-specific ESLint rules   |
| `eslint-plugin-react-hooks`   | ^7.0.1  | React hooks linting                |
| `eslint-plugin-react-refresh` | ^0.5.2  | Fast Refresh compatibility linting |
| `prettier`                    | ^3.8.1  | Code formatter                     |
| `globals`                     | ^16.5.0 | Global variable definitions        |

### Deployment

| Package    | Version  | Purpose                                     |
| ---------- | -------- | ------------------------------------------- |
| `gh-pages` | ^6.3.0   | GitHub Pages deployment                     |
| `supabase` | ^2.76.15 | Supabase CLI (local dev, migrations, types) |

## Version Constraints

- **Node.js**: v24.13.0 (defined in `.mise.toml`)
- **Package Manager**: npm (lock file: `package-lock.json`)
- **Browser Target**: `defaults and supports es6-module` (defined in `browserslist`)
- **Module System**: ESM (`"type": "module"` in `package.json`)

## Key Configuration Files

| File                   | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `vite.config.ts`       | Vite build configuration, PWA plugin, base path, Sentry plugin |
| `tsconfig.json`        | TypeScript compiler options                                    |
| `vitest.config.ts`     | Unit test configuration (path alias `@/` -> `src/`)            |
| `playwright.config.ts` | E2E test configuration with ES256 JWT re-signing               |
| `eslint.config.js`     | ESLint flat config with scripture-reading guards               |
| `.prettierrc`          | Prettier formatting rules                                      |
| `fnox.toml`            | Encrypted secrets via fnox with age provider                   |
| `.env.example`         | Template with placeholder values                               |
| `.env.test`            | Plain-text local Supabase env for E2E tests                    |
| `.mise.toml`           | Tool versions (Node) + env vars (CODEX_HOME)                   |

## Secrets Management

Secrets are managed by **fnox** with the **age** encryption provider:

- `fnox.toml` contains age-encrypted secret ciphertext (committed to git -- safe)
- Age keys stored at `~/.age/key.txt` on each machine (Mac, WSL)
- `fnox exec -- <command>` injects decrypted secrets into the command environment
- No `.env`, `.env.keys`, or external key management services needed

## Related Documentation

- [Executive Summary](./01-executive-summary.md)
- [Architecture Patterns](./03-architecture-patterns.md)
- [Source Tree - Technology Stack Summary](../source-tree-analysis/01-technology-stack-summary.md)
