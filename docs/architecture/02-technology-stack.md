# Technology Stack

## Runtime Dependencies

| Package                        | Version  | Purpose                                              |
| ------------------------------ | -------- | ---------------------------------------------------- |
| `react`                        | ^19.2.8  | UI framework (React 19 with concurrent features)     |
| `react-dom`                    | ^19.2.8  | React DOM renderer                                   |
| `@supabase/supabase-js`        | ^2.110.8  | Backend client (auth, database, storage, realtime)   |
| `zustand`                      | ^5.0.14  | Lightweight state management with slice pattern      |
| `idb`                          | ^8.0.3   | Promise-based IndexedDB wrapper for local storage    |
| `framer-motion`                | ^12.42.2 | Animation library with `LazyMotion` for tree-shaking |
| `lucide-react`                 | ^0.577.0 | Icon library (tree-shakeable SVG icons)              |
| `react-window`                 | ^2.3.0   | Virtualized list rendering for performance           |
| `react-window-infinite-loader` | ^2.0.1   | Infinite scroll integration with react-window        |
| `dompurify`                    | ^3.4.12   | XSS sanitization for user-generated content          |
| `@sentry/react`                | ^10.68.0 | Error tracking and performance monitoring            |
| `workbox-window`               | ^7.4.1   | Service worker lifecycle management                  |
| `eventsource`                  | ^4.1.0   | SSE polyfill for Supabase realtime                   |

## Development Dependencies

### Build and Tooling

| Package                    | Version | Purpose                               |
| -------------------------- | ------- | ------------------------------------- |
| `vite`                     | ^7.3.6  | Build tool and dev server             |
| `@vitejs/plugin-react`     | ^5.1.4  | React Fast Refresh for Vite           |
| `typescript`               | ~5.9.3  | Type checking and compilation         |
| `vite-plugin-pwa`          | ^1.3.0  | PWA support (InjectManifest strategy) |
| `vite-plugin-checker`      | ^0.12.0 | In-editor type checking overlay       |
| `@sentry/vite-plugin`      | ^5.0.0  | Sentry source map upload during build |
| `rollup-plugin-visualizer` | ^6.0.5  | Bundle size analysis                  |
| `tsx`                      | ^4.21.0 | TypeScript script execution           |

### CSS and Styling

| Package                | Version  | Purpose                          |
| ---------------------- | -------- | -------------------------------- |
| `tailwindcss`          | ^4.1.17  | Utility-first CSS framework (v4) |
| `@tailwindcss/postcss` | ^4.2.1   | PostCSS integration for Tailwind |
| `postcss`              | ^8.5.8   | CSS transformation pipeline      |
| `autoprefixer`         | ^10.4.27 | Vendor prefix automation         |

### Testing

| Package                              | Version | Purpose                                  |
| ------------------------------------ | ------- | ---------------------------------------- |
| `vitest`                             | ^4.1.10 | Unit test runner (Vite-native)           |
| `@vitest/coverage-v8`                | ^4.1.10 | Code coverage via V8                     |
| `@vitest/ui`                         | ^4.1.10 | Browser-based test UI                    |
| `@testing-library/react`             | ^16.3.2 | React component testing utilities        |
| `@testing-library/jest-dom`          | ^6.9.1  | Custom DOM matchers                      |
| `@testing-library/user-event`        | ^14.6.1 | User interaction simulation              |
| `happy-dom`                          | ^20.8.3 | Lightweight DOM implementation for tests |
| `fake-indexeddb`                     | ^6.2.5  | IndexedDB mock for unit tests            |
| `@playwright/test`                   | ^1.62.0 | End-to-end test framework                |
| `@seontechnologies/playwright-utils` | ^3.14.0 | Playwright fixture utilities             |
| `@axe-core/playwright`               | ^4.11.1 | Accessibility testing                    |
| `@faker-js/faker`                    | ^10.3.0 | Test data generation                     |

### Validation

| Package | Version | Purpose                                         |
| ------- | ------- | ----------------------------------------------- |
| `zod`   | ^4.4.3  | Runtime schema validation at service boundaries |

### Linting

| Package                       | Version | Purpose                            |
| ----------------------------- | ------- | ---------------------------------- |
| `eslint`                      | ^9.39.2 | Code linting (flat config)         |
| `@eslint/js`                  | ^9.39.2 | ESLint core rules                  |
| `typescript-eslint`           | ^8.65.0 | TypeScript-specific ESLint rules   |
| `eslint-plugin-react-hooks`   | ^7.0.1  | React hooks linting                |
| `eslint-plugin-react-refresh` | ^0.5.2  | Fast Refresh compatibility linting |

### Type Definitions

| Package               | Version  | Purpose                       |
| --------------------- | -------- | ----------------------------- |
| `@types/dompurify`    | ^3.2.0   | DOMPurify type definitions    |
| `@types/node`         | ^24.10.1 | Node.js type definitions      |
| `@types/react`        | ^19.2.14 | React type definitions        |
| `@types/react-dom`    | ^19.2.3  | React DOM type definitions    |
| `@types/react-window` | ^2.0.0   | react-window type definitions |

### Deployment

| Package    | Version | Purpose                                     |
| ---------- | ------- | ------------------------------------------- |
| `gh-pages` | ^6.3.0  | GitHub Pages deployment                     |
| `supabase` | ^2.77.1 | Supabase CLI (local dev, migrations, types) |

## Version Constraints

- **Node.js**: v24.13.0 (defined in `.mise.toml`)
- **Package Manager**: npm (lock file: `package-lock.json`)
- **Browser Target**: `defaults and supports es6-module` (defined in `browserslist`)
- **Module System**: ESM (`"type": "module"` in `package.json`)

## Package Overrides

| Package                | Override Version | Reason                 |
| ---------------------- | ---------------- | ---------------------- |
| `glob`                 | ^12.0.0          | Security/compatibility |
| `js-yaml`              | ^4.1.1           | Security patch         |
| `serialize-javascript` | ^7.0.3           | Security patch         |
| `tar`                  | ^7.5.8           | Security patch         |

## Key Configuration Files

| File                   | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `vite.config.ts`       | Vite build configuration, PWA plugin, Sentry, base path |
| `tsconfig.json`        | TypeScript project references root (3 sub-configs)      |
| `vitest.config.ts`     | Unit test configuration (path alias `@/` -> `src/`)     |
| `playwright.config.ts` | E2E test configuration (chromium, api, integration)     |
| `eslint.config.js`     | ESLint flat config                                      |
| `fnox.toml`            | Encrypted secrets via fnox with age provider            |
| `.env.test`            | Plain-text local Supabase env for E2E tests             |
| `.mise.toml`           | Tool versions (Node.js) via mise                        |

## Related Documentation

- [Executive Summary](./01-executive-summary.md)
- [Architecture Patterns](./03-architecture-patterns.md)
- [Source Tree - Technology Stack Summary](../source-tree-analysis/01-technology-stack-summary.md)
