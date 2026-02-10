# Repository Structure

```
My-Love/
|-- .github/
|   |-- actions/
|   |   +-- setup-supabase/           # Composite action: install Supabase CLI, start local, apply migrations, export credentials
|   |-- codeql/
|   |   +-- codeql-config.yml         # CodeQL security analysis (security-extended + security-and-quality)
|   |-- workflows/
|   |   |-- ci-failure-auto-fix.yml   # Auto-fix CI failures with Claude Code on non-main branches
|   |   |-- claude-code-review.yml    # Automated PR code review with Claude (/review skill)
|   |   |-- claude.yml               # Claude Code for @claude mentions in issues/PRs
|   |   |-- deploy.yml               # Build + smoke test + deploy to GitHub Pages + health check
|   |   |-- manual-code-analysis.yml  # On-demand commit summarization or security review
|   |   |-- supabase-migrations.yml   # Migration validation on PRs touching supabase/ paths
|   |   +-- test.yml                  # Full test pipeline: lint, unit, E2E (sharded), burn-in, merge reports
|   +-- dependabot.yml               # Weekly npm + GitHub Actions dependency updates
|
|-- _bmad-output/
|   +-- planning-artifacts/           # BMAD method planning documents
|       |-- prd/                      # Product Requirements Document (executive summary, user journeys, FRs, NFRs)
|       +-- epics/                    # Epic breakdowns with story definitions and acceptance criteria
|
|-- docs/                             # Project documentation
|   |-- project-overview/             # Architecture, features, deployment
|   +-- development-guide/            # Developer onboarding, scripts, testing, troubleshooting
|
|-- public/
|   +-- icons/                        # PWA icons (icon-192.png, icon-512.png)
|
|-- scripts/
|   |-- burn-in.sh                    # Flaky test detection (configurable iterations, default 10)
|   |-- ci-local.sh                   # Mirror CI pipeline locally (lint, unit, E2E, burn-in)
|   |-- clear-caches.js              # Browser console script to clear all caches
|   |-- dev-with-cleanup.sh          # Dev server with signal trapping and process cleanup
|   |-- perf-bundle-report.mjs       # Bundle size analysis (raw + gzip, generates Markdown report)
|   |-- post-deploy-check.cjs        # Live site health check (HTTP, manifest, service worker)
|   |-- smoke-tests.cjs             # Pre-deploy build validation (dist/ structure, manifests, bundles)
|   |-- test-with-cleanup.sh        # E2E test runner with signal trapping and process cleanup
|   +-- validate-messages.cjs       # 365-message library validation (count, categories, duplicates)
|
|-- src/
|   |-- api/                         # Supabase API integration layer
|   |   |-- supabaseClient.ts        # Client singleton
|   |   |-- moodSyncService.ts       # Mood sync service
|   |   |-- interactionService.ts    # Poke/kiss/fart interactions
|   |   +-- errorHandlers.ts         # Error handling utilities
|   |-- assets/                      # Static assets (images, fonts)
|   |-- components/                  # React components organized by feature
|   |   |-- DailyMessage/            # Main message card with rotation
|   |   |-- love-notes/              # Real-time chat messaging
|   |   |-- MoodTracker/             # Mood logging with emoji selection
|   |   |-- PartnerMoodView/         # Partner mood real-time display
|   |   |-- PokeKissInterface/       # Playful partner interactions
|   |   |-- PhotoGallery/            # Photo grid with lazy loading
|   |   +-- scripture-reading/       # Scripture reading flow (solo/together modes)
|   |-- config/
|   |   +-- constants.ts             # Partner name, start date, feature flags (APP_CONFIG)
|   |-- constants/                   # Additional constant values
|   |-- data/
|   |   |-- defaultMessages.ts       # 365 pre-written love messages (5 categories, 73 each)
|   |   |-- defaultMessagesLoader.ts # Lazy loader for default messages
|   |   +-- scriptureSteps.ts        # 17 scripture steps with NKJV verses and response prayers
|   |-- hooks/                       # Custom React hooks
|   |-- services/
|   |   |-- BaseIndexedDBService.ts  # Base CRUD class for IndexedDB operations
|   |   |-- dbSchema.ts             # IndexedDB schema definition (v5)
|   |   +-- storage.ts              # IndexedDB and localStorage utilities
|   |-- stores/
|   |   +-- useAppStore.ts          # Zustand store composed from 10 slices
|   |-- sw.ts                        # Custom service worker (InjectManifest strategy)
|   |-- sw-db.ts                     # Service worker IndexedDB operations (isolated from app code)
|   |-- sw-types.d.ts                # TypeScript declarations for service worker context
|   |-- types/
|   |   |-- index.ts                # Application TypeScript type definitions
|   |   +-- database.types.ts       # Auto-generated from Supabase schema (DO NOT EDIT)
|   |-- utils/
|   |   |-- messageRotation.ts      # Daily message selection algorithm
|   |   |-- themes.ts               # Theme configurations
|   |   +-- dateHelpers.ts          # Date formatting and calculation utilities
|   +-- validation/
|       |-- schemas.ts              # Zod validation schemas
|       +-- errorMessages.ts        # User-facing validation error messages
|
|-- supabase/
|   |-- config.toml                 # Local Supabase configuration (ports, auth, storage, realtime)
|   |-- migrations/                 # 12 SQL migration files (YYYYMMDDHHmmss_description.sql)
|   |-- seed.sql                    # Database seed data for local development
|   +-- tests/
|       +-- database/              # pgTAP database tests
|
|-- tests/
|   |-- api/                        # API-level tests (Playwright-based, against Supabase endpoints)
|   |-- e2e/                        # End-to-end browser tests (Playwright)
|   |   |-- auth/                   # Login, logout, OAuth, display name setup
|   |   |-- home/                   # Home view, welcome splash, error boundary
|   |   |-- mood/                   # Mood tracker and history
|   |   |-- navigation/            # Bottom nav tabs, routing
|   |   |-- notes/                 # Love notes messaging
|   |   |-- offline/               # Network status indicator, data sync on reconnect
|   |   |-- partner/               # Partner mood view, poke/kiss interactions
|   |   |-- photos/                # Photo gallery display and upload flow
|   |   +-- scripture/             # Scripture overview, session flow, reflection, test data seeding
|   |-- support/                   # Test infrastructure
|   |   |-- merged-fixtures.ts     # Main test entry point: import { test, expect } from here
|   |   |-- auth-setup.ts         # Worker-isolated auth setup (creates user pairs per parallel worker)
|   |   |-- fixtures/             # Custom Playwright fixtures (supabaseAdmin, testSession, scriptureNav, workerAuth)
|   |   |-- factories/            # Test data factories (createTestSession, cleanupTestSession, linkTestPartners)
|   |   +-- helpers/              # Utility functions (waitFor, generateTestEmail, Supabase admin client)
|   |-- unit/                      # Unit tests (Vitest + happy-dom)
|   |   |-- services/             # IndexedDB schema and index tests
|   |   |-- utils/                # Date formatting, mood grouping tests
|   |   +-- validation/           # Zod schema validation tests
|   |-- setup.ts                   # Vitest setup: fake-indexeddb, matchMedia/IntersectionObserver/ResizeObserver mocks
|   +-- README.md                  # Test suite documentation with directory structure and best practices
|
|-- .env                           # Encrypted environment variables (safe to commit via dotenvx)
|-- .env.example                   # Template showing required environment variables
|-- .env.test                      # Plain-text local Supabase values for E2E testing
|-- .gitignore                     # Git ignore rules (node_modules, dist, .env.keys, test artifacts)
|-- .nvmrc                         # Node version: v24.13.0
|-- .prettierrc                    # Prettier configuration (100 char width, single quotes, tailwind plugin)
|-- .prettierignore                # Prettier ignore rules
|-- CLAUDE.md                      # Claude Code guidance (architecture, commands, conventions)
|-- currents.config.ts             # Currents.dev Playwright reporting configuration
|-- eslint.config.js               # ESLint flat config (typescript-eslint, react-hooks, react-refresh)
|-- index.html                     # HTML entry point with SPA redirect handler for GitHub Pages
|-- package.json                   # npm scripts, dependencies, browserslist
|-- playwright.config.ts           # Playwright: projects (setup, chromium, api), sharding, auto dev server
|-- postcss.config.js              # PostCSS plugins (@tailwindcss/postcss, autoprefixer)
|-- tailwind.config.js             # Tailwind theme: custom colors, fonts, animations, keyframes
|-- tsconfig.json                  # TypeScript project references root
|-- tsconfig.app.json              # App TypeScript config (ES2022 target, strict, react-jsx)
|-- tsconfig.node.json             # Node TypeScript config (vite.config.ts, vitest.config.ts)
|-- vite.config.ts                 # Vite: base path, manual chunks, PWA plugin, visualizer, type checker
+-- vitest.config.ts               # Vitest: happy-dom, path alias @/, coverage thresholds (80%), JUnit output
```
