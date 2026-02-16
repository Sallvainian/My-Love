# My-Love — Project Documentation

> **Auto-generated:** 2026-02-16 | **Scan level:** Exhaustive | **Project type:** Web Application (React PWA) | **Total:** ~95 files, ~12,800 lines

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Framework** | React 19.2.4 + TypeScript 5.9.3 + Vite 7.3.1 |
| **State Management** | Zustand 5.0.11 (10 slices) |
| **Backend** | Supabase 2.93.3 (Auth, Postgres, Storage, Realtime, Edge Functions) |
| **Styling** | Tailwind CSS 4.1.17 + Framer Motion 12.29 |
| **Validation** | Zod 4.3.6 |
| **Testing** | Vitest 4.0.17 + Playwright 1.58.2 |
| **Deployment** | PWA with Service Worker (Workbox InjectManifest) on GitHub Pages |

---

## Documentation Index

### Core Documentation

#### [Project Overview](./project-overview/index.md)

- **[technology-stack.md](./project-overview/technology-stack.md)** — Framework, runtime, and tooling versions with rationale
- **[architecture.md](./project-overview/architecture.md)** — High-level data flow, state management, offline strategy
- **[key-features.md](./project-overview/key-features.md)** — Daily Messages, Mood Tracking, Love Notes, Photos, Scripture Reading, Interactions
- **[repository-structure.md](./project-overview/repository-structure.md)** — Top-level directory layout with annotations
- **[development.md](./project-overview/development.md)** — Quick-start commands and developer notes
- **[deployment.md](./project-overview/deployment.md)** — Production deployment: GitHub Pages, GitHub Actions, health checks
- **[active-development-epics.md](./project-overview/active-development-epics.md)** — Current epic/story status from planning artifacts
- **[git-conventions.md](./project-overview/git-conventions.md)** — Branch strategy, commit format, PR process, CI workflow rules

#### [Architecture](./architecture/index.md)

- **[01-executive-summary.md](./architecture/01-executive-summary.md)** — Architecture overview at a glance
- **[02-technology-stack.md](./architecture/02-technology-stack.md)** — Full technology table with versions and rationale
- **[03-architecture-patterns.md](./architecture/03-architecture-patterns.md)** — 8 patterns: offline-first, online-first, Supabase-direct, sliced store
- **[04-data-architecture.md](./architecture/04-data-architecture.md)** — Dual storage: Supabase + IndexedDB + localStorage
- **[05-state-management-overview.md](./architecture/05-state-management-overview.md)** — Zustand architecture (see State Management for details)
- **[06-component-hierarchy.md](./architecture/06-component-hierarchy.md)** — React component tree from StrictMode through all views
- **[07-authentication-flow.md](./architecture/07-authentication-flow.md)** — Supabase email/password auth, partner detection
- **[08-api-layer.md](./architecture/08-api-layer.md)** — All API services: supabaseClient, moodApi, interactionService
- **[09-navigation.md](./architecture/09-navigation.md)** — Zustand-based routing with lazy loading
- **[10-service-worker.md](./architecture/10-service-worker.md)** — InjectManifest strategy, caching, Background Sync
- **[11-realtime-features.md](./architecture/11-realtime-features.md)** — Broadcast API for love notes and partner mood
- **[12-offline-strategy.md](./architecture/12-offline-strategy.md)** — Three-tier sync, network status, OfflineError
- **[13-security-model.md](./architecture/13-security-model.md)** — RLS, DOMPurify, Zod boundaries, env encryption
- **[14-validation-layer.md](./architecture/14-validation-layer.md)** — All Zod schemas with code and error transformation
- **[15-deployment.md](./architecture/15-deployment.md)** — GitHub Pages, dotenvx, CI/CD workflows
- **[16-testing-architecture.md](./architecture/16-testing-architecture.md)** — 5 test layers, frameworks, priority tags
- **[17-error-handling.md](./architecture/17-error-handling.md)** — Strategy by layer, retry patterns, corruption recovery
- **[18-performance.md](./architecture/18-performance.md)** — Lazy loading, virtualization, image compression, bundle analysis
- **[19-scalability.md](./architecture/19-scalability.md)** — 2-user scope, data volume estimates, growth path

#### [Source Tree Analysis](./source-tree-analysis/index.md)

- **[01-technology-stack-summary.md](./source-tree-analysis/01-technology-stack-summary.md)** — All dependencies categorized by role
- **[02-directory-tree.md](./source-tree-analysis/02-directory-tree.md)** — Complete annotated file tree of src/ and supabase/
- **[03-entry-point-trace.md](./source-tree-analysis/03-entry-point-trace.md)** — Boot sequence: main.tsx -> App.tsx -> views
- **[04-critical-folders.md](./source-tree-analysis/04-critical-folders.md)** — 6 highest-impact directories with key files
- **[05-npm-scripts-reference.md](./source-tree-analysis/05-npm-scripts-reference.md)** — All scripts with commands and examples
- **[06-source-tree-index.md](./source-tree-analysis/06-source-tree-index.md)** — Quick reference with cross-links and file counts

### API & Data

#### [API Reference](./api-reference/index.md)

- **[table-of-contents.md](./api-reference/table-of-contents.md)** — Full API reference navigation
- **[1-supabase-client-configuration.md](./api-reference/1-supabase-client-configuration.md)** — Singleton client, env vars, partner helpers
- **[2-authentication-service.md](./api-reference/2-authentication-service.md)** — Sign-in/up, OAuth, session management, token storage
- **[3-error-handling-utilities.md](./api-reference/3-error-handling-utilities.md)** — Error classes, retry logic, network detection, error mapping
- **[4-mood-api-service.md](./api-reference/4-mood-api-service.md)** — Validated Supabase CRUD for mood entries
- **[5-mood-sync-service.md](./api-reference/5-mood-sync-service.md)** — IndexedDB-to-Supabase sync with Broadcast API
- **[6-interaction-service.md](./api-reference/6-interaction-service.md)** — Poke/kiss interactions with Realtime subscriptions
- **[7-partner-service.md](./api-reference/7-partner-service.md)** — User search, partner requests, connection management
- **[8-indexeddb-services.md](./api-reference/8-indexeddb-services.md)** — BaseIndexedDBService, mood, photo, message, scripture CRUD
- **[9-photo-services.md](./api-reference/9-photo-services.md)** — Cloud storage, local storage, compression, love note images
- **[10-validation-layer.md](./api-reference/10-validation-layer.md)** — Zod schemas, error formatting, custom error classes
- **[11-service-worker-background-sync.md](./api-reference/11-service-worker-background-sync.md)** — Workbox caching, background mood sync, SW-DB helpers
- **[12-real-time-subscriptions.md](./api-reference/12-real-time-subscriptions.md)** — Broadcast API, postgres_changes, channel management

#### [Data Models](./data-models/index.md)

- **[table-of-contents.md](./data-models/table-of-contents.md)** — Full data models navigation
- **[1-database-schema-overview.md](./data-models/1-database-schema-overview.md)** — Supabase tables, enums, and buckets
- **[2-supabase-tables.md](./data-models/2-supabase-tables.md)** — Column-level detail for all 11 tables
- **[3-indexeddb-stores.md](./data-models/3-indexeddb-stores.md)** — Local IndexedDB object stores and schema
- **[4-typescript-type-definitions.md](./data-models/4-typescript-type-definitions.md)** — Generated and application type definitions
- **[5-zod-validation-schemas.md](./data-models/5-zod-validation-schemas.md)** — Local and Supabase Zod schemas
- **[6-supabase-rpc-functions.md](./data-models/6-supabase-rpc-functions.md)** — Postgres functions and RPC endpoints
- **[7-storage-buckets.md](./data-models/7-storage-buckets.md)** — Photos and love-notes-images bucket configs
- **[8-rls-policies.md](./data-models/8-rls-policies.md)** — Row Level Security policies per table and bucket
- **[9-migration-history.md](./data-models/9-migration-history.md)** — 12 migrations from 2025-12-03 through 2026-02-06

### Frontend

#### [Component Inventory](./component-inventory/index.md)

- **[table-of-contents.md](./component-inventory/table-of-contents.md)** — Full component inventory navigation
- **[component-hierarchy.md](./component-inventory/component-hierarchy.md)** — Visual component tree with parent-child relationships
- **[component-inventory-table.md](./component-inventory/component-inventory-table.md)** — All 73 components with props, store connections, features
- **[feature-components.md](./component-inventory/feature-components.md)** — Feature-specific component documentation
- **[shared-and-utility-components.md](./component-inventory/shared-and-utility-components.md)** — Cross-cutting shared components
- **[design-patterns.md](./component-inventory/design-patterns.md)** — Barrel exports, lazy loading, memoization patterns
- **[state-connections.md](./component-inventory/state-connections.md)** — Zustand store slice usage matrix per component
- **[component-statistics.md](./component-inventory/component-statistics.md)** — Total counts, LOC, categories

#### [State Management](./state-management/index.md)

- **[01-zustand-store-configuration.md](./state-management/01-zustand-store-configuration.md)** — Store creation, persist config, Map serialization, corruption recovery
- **[02-slice-details.md](./state-management/02-slice-details.md)** — All 10 slices: state shapes, actions, validation, persistence
- **[03-cross-slice-dependencies.md](./state-management/03-cross-slice-dependencies.md)** — Dependency graph, initialization coordination
- **[04-data-flow.md](./state-management/04-data-flow.md)** — 6 patterns: offline-first, online-first, realtime, cache, sync, hydration
- **[05-persistence-strategy.md](./state-management/05-persistence-strategy.md)** — localStorage vs IndexedDB, quota monitoring
- **[06-react-hooks.md](./state-management/06-react-hooks.md)** — All 12 custom hooks with signatures and behavior
- **[07-direct-store-access.md](./state-management/07-direct-store-access.md)** — getState(), setState(), subscribe(), E2E support
- **[08-state-management-index.md](./state-management/08-state-management-index.md)** — Quick reference with file locations

### Development

#### [Development Guide](./development-guide/index.md)

- **[prerequisites.md](./development-guide/prerequisites.md)** — Required tools and versions
- **[installation.md](./development-guide/installation.md)** — Clone, install, and verify
- **[environment-setup.md](./development-guide/environment-setup.md)** — Encrypted env vars, dotenvx, Supabase keys
- **[configuration-customization.md](./development-guide/configuration-customization.md)** — Partner name, start date, feature flags
- **[available-scripts.md](./development-guide/available-scripts.md)** — Dev, build, lint, and test scripts
- **[local-development-url.md](./development-guide/local-development-url.md)** — Local dev server URL details
- **[development-workflow.md](./development-guide/development-workflow.md)** — Branch strategy, commit format, PR process
- **[build-process.md](./development-guide/build-process.md)** — Production build pipeline, code splitting, PWA generation
- **[project-structure.md](./development-guide/project-structure.md)** — Annotated directory layout
- **[testing.md](./development-guide/testing.md)** — Unit, E2E, database, smoke, and burn-in tests
- **[code-style.md](./development-guide/code-style.md)** — TypeScript, ESLint, Prettier conventions
- **[database-migrations.md](./development-guide/database-migrations.md)** — Local Supabase, migrations, type generation
- **[deployment.md](./development-guide/deployment.md)** — CI/CD workflows, GitHub Pages, health checks
- **[troubleshooting.md](./development-guide/troubleshooting.md)** — Common issues and solutions

### Performance

- **[baseline.md](./performance/baseline.md)** — Bundle size baseline measurements
- **[bundle-report.md](./performance/bundle-report.md)** — Current build chunk analysis
- **[perf-build.log](./performance/perf-build.log)** — Vite production build output log

### Root Files

- **[project-scan-report.json](./project-scan-report.json)** — BMAD workflow scan metadata

---

## Project Structure Summary

```
src/
├── components/       # 24 component folders, 73 exported components
├── stores/           # Zustand store with 10 slices
├── services/         # 12 service modules (Supabase, IndexedDB, sync)
├── api/              # API layer (auth, mood, partner, interactions)
├── validation/       # Zod schemas and error messages
├── hooks/            # Custom React hooks
├── utils/            # Date helpers, formatters
├── types/            # TypeScript type definitions
├── sw.ts             # Service Worker (Background Sync)
└── sw-db.ts          # SW IndexedDB helpers
supabase/
├── functions/        # Edge Functions (image upload)
└── migrations/       # 12 Postgres migrations
```

---

## Feature Map

| Feature | Components | Store | Service | API |
|---------|-----------|-------|---------|-----|
| Daily Messages | `DailyMessage/` | `messagesSlice` | `customMessageService` | — |
| Mood Tracking | `MoodTracker/`, `MoodHistory/` | `moodSlice` | `moodService` | `moodApi` |
| Love Notes | `love-notes/` | `notesSlice` | `loveNoteImageService` | Supabase direct |
| Photos | `PhotoGallery/`, `PhotoUpload/`, `PhotoCarousel/` | `photosSlice` | `photoService`, `photoStorageService` | Supabase Storage |
| Scripture | `scripture-reading/` | `scriptureReadingSlice` | `scriptureReadingService` | Supabase RPC |
| Partner | `PartnerMoodView/`, `PokeKissInterface/` | `partnerSlice`, `interactionsSlice` | `realtimeService` | `partnerService`, `interactionService` |

---

## Planning Artifacts

| Document | Description | Date |
|----------|-------------|------|
| [PRD](../_bmad-output/planning-artifacts/prd.md) | Product Requirements Document | 2026-01-25 |
| [UX Design](../_bmad-output/planning-artifacts/ux-design-specification.md) | UX Design Specification | 2026-01-25 |
| [Architecture (Scripture)](../_bmad-output/planning-artifacts/architecture.md) | Feature Architecture (Scripture Reading) | 2026-01-26 |
| [Epics & Stories](../_bmad-output/planning-artifacts/epics.md) | Implementation breakdown | 2026-01-26 |
| [Test Design - Arch](../_bmad-output/test-design-architecture.md) | Test architecture & risks | 2026-01-27 |
| [Test Design - QA](../_bmad-output/test-design-qa.md) | QA execution recipe | 2026-01-27 |
| [Sprint Status](../_bmad-output/implementation-artifacts/sprint-status.yaml) | Current sprint progress | — |

---

## How to Use This Documentation

**For new developers:** Start with [Project Overview](./project-overview/index.md) then [Architecture](./architecture/index.md) then [Development Guide](./development-guide/index.md).

**For feature work:** Check [Component Inventory](./component-inventory/index.md) for UI patterns and [State Management](./state-management/index.md) for store interactions.

**For API integration:** See [API Reference](./api-reference/index.md) for all service methods, error handling, and real-time subscription patterns.

**For data changes:** Review [Data Models](./data-models/index.md) for schema definitions, migrations, and validation rules.

---

*Generated by BMAD Document-Project Workflow v1.2.0*
