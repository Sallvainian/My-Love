# My-Love -- Project Documentation

> **Auto-generated:** 2026-07-25 | **Scan level:** Exhaustive | **Project type:** Web Application (React PWA) | **Total:** 168 non-test source files (197 incl. co-located tests), ~43,133 lines

## Quick Reference

| Attribute            | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| **Framework**        | React 19.2.8 + TypeScript 5.9.3 + Vite 7.3.6                        |
| **State Management** | Zustand 5.0.14 (11 slices)                                          |
| **Backend**          | Supabase 2.110.8 (Auth, Postgres, Storage, Realtime, Edge Functions) |
| **Monitoring**       | Sentry 10.68.0 (error tracking + sourcemaps)                        |
| **Styling**          | Tailwind CSS 4.1.17 + Framer Motion 12.42.2                         |
| **Validation**       | Zod 4.4.3                                                           |
| **Testing**          | Vitest 4.1.10 + Playwright 1.62.0                                   |
| **Deployment**       | PWA with Service Worker (Workbox InjectManifest) on GitHub Pages    |

---

## Documentation Index

### Core Documentation

#### [Project Overview](./project-overview/index.md)

- **[technology-stack.md](./project-overview/technology-stack.md)** -- Framework, runtime, and tooling versions with rationale
- **[architecture.md](./project-overview/architecture.md)** -- High-level data flow, state management, offline strategy
- **[key-features.md](./project-overview/key-features.md)** -- Daily Messages, Mood Tracking, Love Notes, Photos, Scripture Reading, Interactions
- **[repository-structure.md](./project-overview/repository-structure.md)** -- Top-level directory layout with annotations
- **[development.md](./project-overview/development.md)** -- Quick-start commands and developer notes
- **[deployment.md](./project-overview/deployment.md)** -- Production deployment: GitHub Pages, GitHub Actions, health checks
- **[active-development-epics.md](./project-overview/active-development-epics.md)** -- Current epic/story status from planning artifacts
- **[git-conventions.md](./project-overview/git-conventions.md)** -- Branch strategy, commit format, PR process, CI workflow rules

#### [Architecture](./architecture/index.md)

- **[01-executive-summary.md](./architecture/01-executive-summary.md)** -- Architecture overview at a glance
- **[02-technology-stack.md](./architecture/02-technology-stack.md)** -- Full technology table with versions and rationale
- **[03-architecture-patterns.md](./architecture/03-architecture-patterns.md)** -- 8 patterns: offline-first, online-first, Supabase-direct, sliced store
- **[04-data-architecture.md](./architecture/04-data-architecture.md)** -- Dual storage: Supabase + IndexedDB + localStorage
- **[05-state-management-overview.md](./architecture/05-state-management-overview.md)** -- Zustand architecture (see State Management for details)
- **[06-component-hierarchy.md](./architecture/06-component-hierarchy.md)** -- React component tree from StrictMode through all views
- **[07-authentication-flow.md](./architecture/07-authentication-flow.md)** -- Supabase email/password auth, partner detection
- **[08-api-layer.md](./architecture/08-api-layer.md)** -- All API services: supabaseClient, moodApi, interactionService
- **[09-navigation.md](./architecture/09-navigation.md)** -- Zustand-based routing with lazy loading
- **[10-service-worker.md](./architecture/10-service-worker.md)** -- InjectManifest strategy, caching, Background Sync
- **[11-realtime-features.md](./architecture/11-realtime-features.md)** -- Broadcast API for love notes, partner mood, and scripture sessions
- **[12-offline-strategy.md](./architecture/12-offline-strategy.md)** -- Three-tier sync, network status, OfflineError
- **[13-security-model.md](./architecture/13-security-model.md)** -- RLS, DOMPurify, Zod boundaries, fnox/age secrets
- **[14-validation-layer.md](./architecture/14-validation-layer.md)** -- All Zod schemas with code and error transformation
- **[15-deployment.md](./architecture/15-deployment.md)** -- GitHub Pages, fnox/age secrets, CI/CD workflows
- **[16-testing-architecture.md](./architecture/16-testing-architecture.md)** -- 5 test layers, frameworks, priority tags
- **[17-error-handling.md](./architecture/17-error-handling.md)** -- Strategy by layer, retry patterns, corruption recovery
- **[18-performance.md](./architecture/18-performance.md)** -- Lazy loading, virtualization, image compression, bundle analysis
- **[19-scalability.md](./architecture/19-scalability.md)** -- 2-user scope, data volume estimates, growth path

#### [Source Tree Analysis](./source-tree-analysis/index.md)

- **[01-technology-stack-summary.md](./source-tree-analysis/01-technology-stack-summary.md)** -- All dependencies categorized by role
- **[02-directory-tree.md](./source-tree-analysis/02-directory-tree.md)** -- Complete annotated file tree of src/ and supabase/
- **[03-entry-point-trace.md](./source-tree-analysis/03-entry-point-trace.md)** -- Boot sequence: main.tsx -> App.tsx -> views
- **[04-critical-code-paths.md](./source-tree-analysis/04-critical-code-paths.md)** -- Key user flows traced through code (auth, message, mood sync)
- **[05-shared-modules.md](./source-tree-analysis/05-shared-modules.md)** -- Utilities, hooks, constants, config files
- **[06-dependency-graph.md](./source-tree-analysis/06-dependency-graph.md)** -- Module dependency map with layer architecture
- **[07-file-inventory.md](./source-tree-analysis/07-file-inventory.md)** -- Complete file list with line counts and purposes

### API & Data

#### [API Reference](./api-reference/index.md)

- **[table-of-contents.md](./api-reference/table-of-contents.md)** -- Full API reference navigation
- **[1-supabase-client-configuration.md](./api-reference/1-supabase-client-configuration.md)** -- Singleton client, env vars, partner helpers
- **[2-authentication-service.md](./api-reference/2-authentication-service.md)** -- Sign-in/up, OAuth, session management, token storage
- **[3-error-handling-utilities.md](./api-reference/3-error-handling-utilities.md)** -- Error classes, retry logic, network detection, error mapping
- **[4-mood-api-service.md](./api-reference/4-mood-api-service.md)** -- Validated Supabase CRUD for mood entries
- **[5-mood-sync-service.md](./api-reference/5-mood-sync-service.md)** -- IndexedDB-to-Supabase sync with Broadcast API
- **[6-interaction-service.md](./api-reference/6-interaction-service.md)** -- Poke/kiss interactions with Realtime subscriptions
- **[7-partner-service.md](./api-reference/7-partner-service.md)** -- User search, partner requests, connection management
- **[8-indexeddb-services.md](./api-reference/8-indexeddb-services.md)** -- BaseIndexedDBService, mood, photo, message, scripture CRUD
- **[9-photo-services.md](./api-reference/9-photo-services.md)** -- Cloud storage, local storage, compression, love note images
- **[10-validation-layer.md](./api-reference/10-validation-layer.md)** -- Zod schemas, error formatting, custom error classes
- **[11-service-worker-background-sync.md](./api-reference/11-service-worker-background-sync.md)** -- Workbox caching, background mood sync, SW-DB helpers
- **[12-real-time-subscriptions.md](./api-reference/12-real-time-subscriptions.md)** -- Broadcast API, postgres_changes, channel management
- **[13-scripture-reading-service.md](./api-reference/13-scripture-reading-service.md)** -- Cache-first CRUD for scripture reading sessions
- **[14-additional-services.md](./api-reference/14-additional-services.md)** -- logger, migrationService, storageService, utility modules

#### [Data Models](./data-models/index.md)

- **[table-of-contents.md](./data-models/table-of-contents.md)** -- Full data models navigation
- **[1-database-schema-overview.md](./data-models/1-database-schema-overview.md)** -- Supabase tables, enums, and buckets
- **[2-supabase-tables.md](./data-models/2-supabase-tables.md)** -- Column-level detail for all tables
- **[3-indexeddb-stores.md](./data-models/3-indexeddb-stores.md)** -- Local IndexedDB object stores and schema
- **[4-typescript-type-definitions.md](./data-models/4-typescript-type-definitions.md)** -- Generated and application type definitions
- **[5-zod-validation-schemas.md](./data-models/5-zod-validation-schemas.md)** -- Local and Supabase Zod schemas
- **[6-supabase-rpc-functions.md](./data-models/6-supabase-rpc-functions.md)** -- Postgres functions and RPC endpoints
- **[7-storage-buckets.md](./data-models/7-storage-buckets.md)** -- Photos and love-notes-images bucket configs
- **[8-rls-policies.md](./data-models/8-rls-policies.md)** -- Row Level Security policies per table and bucket
- **[9-migration-history.md](./data-models/9-migration-history.md)** -- 25 migrations from 2025-12-03 through 2026-03-16

### Frontend

#### [Component Inventory](./component-inventory/index.md)

- **[table-of-contents.md](./component-inventory/table-of-contents.md)** -- Full component inventory navigation
- **[component-hierarchy.md](./component-inventory/component-hierarchy.md)** -- Visual component tree with parent-child relationships
- **[component-inventory-table.md](./component-inventory/component-inventory-table.md)** -- All components with props, store connections, features
- **[feature-components.md](./component-inventory/feature-components.md)** -- Feature-specific component documentation
- **[shared-and-utility-components.md](./component-inventory/shared-and-utility-components.md)** -- Cross-cutting shared components
- **[design-patterns.md](./component-inventory/design-patterns.md)** -- Container/presentational, lazy loading, optimistic UI, focus management
- **[state-connections.md](./component-inventory/state-connections.md)** -- Zustand store slice usage matrix per component
- **[component-statistics.md](./component-inventory/component-statistics.md)** -- Total counts, LOC, categories, 13 custom hooks

#### [State Management](./state-management/index.md)

- **[store-architecture.md](./state-management/store-architecture.md)** -- Store creation, persist config, Map serialization, corruption recovery
- **[app-slice.md](./state-management/app-slice.md)** -- isLoading, error, \_\_isHydrated
- **[auth-slice.md](./state-management/auth-slice.md)** -- userId, userEmail, isAuthenticated (centralized user identity)
- **[settings-slice.md](./state-management/settings-slice.md)** -- Settings, onboarding, initialization flow
- **[navigation-slice.md](./state-management/navigation-slice.md)** -- ViewType routing with browser history
- **[messages-slice.md](./state-management/messages-slice.md)** -- Messages, messageHistory (Map), favorites, IndexedDB
- **[mood-slice.md](./state-management/mood-slice.md)** -- 12 mood types, offline-first sync, partner moods
- **[interactions-slice.md](./state-management/interactions-slice.md)** -- Poke/kiss, realtime subscriptions
- **[partner-slice.md](./state-management/partner-slice.md)** -- Partner connection lifecycle, search, requests
- **[notes-slice.md](./state-management/notes-slice.md)** -- Love notes chat, optimistic updates, rate limiting
- **[photos-slice.md](./state-management/photos-slice.md)** -- Photo gallery, upload, storage quota
- **[scripture-reading-slice.md](./state-management/scripture-reading-slice.md)** -- Session lifecycle, lobby, lock-in, broadcast, disconnection

### Development

#### [Development Guide](./development-guide/index.md)

- **[prerequisites.md](./development-guide/prerequisites.md)** -- Required tools and versions
- **[installation.md](./development-guide/installation.md)** -- Clone, install, and verify
- **[environment-setup.md](./development-guide/environment-setup.md)** -- fnox/age secrets management, Supabase keys
- **[configuration-customization.md](./development-guide/configuration-customization.md)** -- Vite, TypeScript, PostCSS, Tailwind, ESLint configs
- **[available-scripts.md](./development-guide/available-scripts.md)** -- All 32 npm scripts documented
- **[local-development-url.md](./development-guide/local-development-url.md)** -- Dev vs production base paths
- **[development-workflow.md](./development-guide/development-workflow.md)** -- Branch strategy, commit format, PR process
- **[build-process.md](./development-guide/build-process.md)** -- Production build pipeline, code splitting, PWA generation
- **[project-structure.md](./development-guide/project-structure.md)** -- Annotated directory layout
- **[testing.md](./development-guide/testing.md)** -- Unit, E2E, database, smoke, and burn-in tests
- **[code-style.md](./development-guide/code-style.md)** -- TypeScript, ESLint, formatting conventions
- **[database-migrations.md](./development-guide/database-migrations.md)** -- 25 migrations, Supabase CLI, pgTAP tests
- **[deployment.md](./development-guide/deployment.md)** -- 9 CI/CD workflows, GitHub Pages, health checks
- **[troubleshooting.md](./development-guide/troubleshooting.md)** -- 13 common issues and solutions

### Performance

- **[baseline.md](./performance/baseline.md)** -- Bundle size baseline, browser targets, code splitting
- **[bundle-report.md](./performance/bundle-report.md)** -- Vendor chunks, lazy loading (9 React.lazy components), tree shaking

### Root Files

- **[project-scan-report.json](./project-scan-report.json)** -- BMAD workflow scan metadata

---

## Project Structure Summary

```
src/                    # 168 non-test files (197 total), ~43,133 lines
  components/           # 26 component folders, 66 non-test components
  stores/               # Zustand store with 11 slices
  services/             # 10 service modules (1 base + 9 concrete)
  api/                  # API layer (auth, mood, partner, interactions, validation)
  validation/           # Zod schemas and error messages
  hooks/                # 14 files: 1 barrel + 13 custom React hooks
  utils/                # 15 modules: date helpers, formatters, logger, validation
  types/                # TypeScript type definitions (incl. generated database.types.ts)
  config/               # Constants, images, performance, relationship dates, Sentry
  data/                 # Default messages + 17 scripture steps
  sw.ts                 # Service Worker (Background Sync)
  sw-db.ts              # SW IndexedDB helpers
supabase/
  functions/            # 1 Edge Function (upload-love-note-image)
  migrations/           # 25 Postgres migrations
  tests/database/       # 14 pgTAP test files
tests/                  # 85 external test files
  e2e/                  # 28 Playwright specs across 9 feature areas
  api/                  # 4 API-level specs (no browser)
  integration/          # 1 integration spec
  unit/                 # 27 Vitest specs
  support/              # Fixtures, factories, helpers, reporters
```

---

## Feature Map

| Feature        | Components                                        | Store                               | Service                                        | API / Transport                        |
| -------------- | ------------------------------------------------- | ----------------------------------- | ---------------------------------------------- | -------------------------------------- |
| Daily Messages | `DailyMessage/`, `AdminPanel/`                    | `messagesSlice`                     | `customMessageService`, `storage`              | IndexedDB only                         |
| Mood Tracking  | `MoodTracker/`, `MoodHistory/`                    | `moodSlice`                         | `moodService`                                  | `moodApi`, `moodSyncService` (Broadcast) |
| Love Notes     | `love-notes/`                                     | `notesSlice`                        | `loveNoteImageService`, `imageCompressionService` | Supabase direct + Broadcast          |
| Photos         | `PhotoGallery/`, `PhotoUpload/`, `PhotoCarousel/` | `photosSlice`                       | `photoService`                                 | Supabase Storage (signed URLs)         |
| Scripture      | `scripture-reading/`                              | `scriptureReadingSlice`             | `scriptureReadingService`                      | Supabase RPC + private Broadcast       |
| Partner        | `PartnerMoodView/`, `PokeKissInterface/`          | `partnerSlice`, `interactionsSlice` | --                                             | `partnerService`, `interactionService` (postgres_changes) |
| Timers         | `RelationshipTimers/`, `CountdownTimer/`          | -- (reads config)                   | --                                             | `config/relationshipDates.ts`          |

---

## Planning Artifacts

Only phase-agnostic artifacts remain live. Everything tied to a finished planning phase now sits under `_bmad-output/.archive/`.

| Document                                                                   | Description                                                    |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Project Context](../_bmad-output/project-context.md)                      | Condensed AI-agent rule file (regenerated per scan)            |
| [Deferred Work](../_bmad-output/implementation-artifacts/deferred-work.md) | Ledger of deferred items                                       |
| `_bmad-output/handoff-documents/`                                          | Cross-session handoff documents                                |
| `_bmad-output/bmad-workflow-reference.md`, `_bmad-output/tea-docs/`        | BMAD workflow reference and TEA test-architecture docs         |

**Archived** (`_bmad-output/.archive/`, retained for history):

| Document                                                                              | Description                                        |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Architecture](../_bmad-output/.archive/planning-artifacts/architecture.md)           | Feature architecture for Scripture Reading         |
| [UX Design Spec](../_bmad-output/.archive/planning-artifacts/ux-design-specification.md) | UX design specification                         |
| [UX Design Directions](../_bmad-output/.archive/planning-artifacts/ux-design-directions.html) | UX direction explorations (HTML)           |
| `_bmad-output/.archive/implementation-artifacts/tech-spec-*.md`                       | Completed per-change technical specs               |
| `_bmad-output/.archive/reports/`                                                      | Dead-code analysis and skill quality scans         |

> The sharded `planning-artifacts/prd/` and `planning-artifacts/epics/` directories, plus `implementation-artifacts/sprint-status.yaml` and the two `test-design-*.md` files, were retired after all four Scripture Reading epics shipped. See [Active Development Epics](./project-overview/active-development-epics.md) for the epic history.

---

## How to Use This Documentation

**For new developers:** Start with [Project Overview](./project-overview/index.md) then [Architecture](./architecture/index.md) then [Development Guide](./development-guide/index.md).

**For feature work:** Check [Component Inventory](./component-inventory/index.md) for UI patterns and [State Management](./state-management/index.md) for store interactions.

**For API integration:** See [API Reference](./api-reference/index.md) for all service methods, error handling, and real-time subscription patterns.

**For data changes:** Review [Data Models](./data-models/index.md) for schema definitions, migrations, and validation rules.

---

_Generated by BMAD Document-Project Workflow v1.3.0 -- Last updated 2026-07-25 (exhaustive rescan, single context window)_
