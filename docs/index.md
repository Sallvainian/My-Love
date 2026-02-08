# My-Love — Project Documentation

> **Auto-generated:** 2026-02-08 | **Scan level:** Exhaustive | **Project type:** Web Application (React PWA)

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Framework** | React 19 + TypeScript 5.9 + Vite 7.3 |
| **State Management** | Zustand 5.0 (10 slices) |
| **Backend** | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) |
| **Styling** | Tailwind CSS 4.1 |
| **Testing** | Vitest 4.0 + Playwright 1.57 |
| **Deployment** | PWA with Service Worker (Workbox) |

---

## Documentation Index

### Core Documentation

#### [Project Overview](./project-overview/index.md)

- **[technology-stack.md](./project-overview/technology-stack.md)** - Framework, runtime, and tooling versions
- **[architecture.md](./project-overview/architecture.md)** - High-level data flow and architectural decisions
- **[key-features.md](./project-overview/key-features.md)** - Core application features summary
- **[repository-structure.md](./project-overview/repository-structure.md)** - Top-level directory layout
- **[development.md](./project-overview/development.md)** - Quick-start commands and dev notes
- **[deployment.md](./project-overview/deployment.md)** - Production deployment overview
- **[active-development-epics.md](./project-overview/active-development-epics.md)** - Current epic and story status
- **[git-conventions.md](./project-overview/git-conventions.md)** - Branch strategy and commit format

#### [Architecture](./architecture/index.md)

- **[executive-summary.md](./architecture/executive-summary.md)** - Architecture overview at a glance
- **[technology-stack.md](./architecture/technology-stack.md)** - Detailed technology choices and rationale
- **[architecture-pattern.md](./architecture/architecture-pattern.md)** - Layered architecture and key decisions
- **[source-directory-structure.md](./architecture/source-directory-structure.md)** - Annotated source tree
- **[data-architecture.md](./architecture/data-architecture.md)** - Supabase, IndexedDB, and localStorage schemas
- **[state-management.md](./architecture/state-management.md)** - Zustand store architecture overview
- **[component-hierarchy.md](./architecture/component-hierarchy.md)** - React component tree structure
- **[authentication-flow.md](./architecture/authentication-flow.md)** - Auth session and guard logic
- **[navigation-system.md](./architecture/navigation-system.md)** - Tab-based navigation design
- **[real-time-features.md](./architecture/real-time-features.md)** - Supabase Realtime subscription patterns
- **[offline-strategy.md](./architecture/offline-strategy.md)** - Service Worker, IndexedDB persistence, sync
- **[security.md](./architecture/security.md)** - RLS policies and security considerations
- **[validation-architecture.md](./architecture/validation-architecture.md)** - Zod schema validation layers
- **[deployment.md](./architecture/deployment.md)** - CI/CD and hosting configuration
- **[testing-strategy.md](./architecture/testing-strategy.md)** - Vitest, Playwright, and ATDD approach
- **[performance-optimizations.md](./architecture/performance-optimizations.md)** - Lazy loading, memoization, virtualization
- **[error-handling-strategy.md](./architecture/error-handling-strategy.md)** - Error boundaries and recovery patterns
- **[scalability-considerations.md](./architecture/scalability-considerations.md)** - 2-user scope and growth path

#### [Source Tree Analysis](./source-tree-analysis/index.md)

- **[technology-stack-at-a-glance.md](./source-tree-analysis/technology-stack-at-a-glance.md)** - Compact tech stack summary
- **[complete-directory-tree.md](./source-tree-analysis/complete-directory-tree.md)** - Full annotated directory listing
- **[entry-point-trace.md](./source-tree-analysis/entry-point-trace.md)** - App boot sequence and entry points
- **[critical-folders-summary.md](./source-tree-analysis/critical-folders-summary.md)** - Key directories and their roles
- **[npm-scripts-reference.md](./source-tree-analysis/npm-scripts-reference.md)** - All available npm scripts documented

### API & Data

#### [API Reference](./api-reference/index.md)

- **[table-of-contents.md](./api-reference/table-of-contents.md)** - Full API reference navigation
- **[1-supabase-client-configuration.md](./api-reference/1-supabase-client-configuration.md)** - Client initialization and helpers
- **[2-authentication-api.md](./api-reference/2-authentication-api.md)** - Auth methods and session management
- **[3-mood-api.md](./api-reference/3-mood-api.md)** - Mood CRUD operations and error class
- **[4-mood-sync-service.md](./api-reference/4-mood-sync-service.md)** - Offline-to-cloud mood synchronization
- **[5-interaction-api.md](./api-reference/5-interaction-api.md)** - Poke/kiss interaction endpoints
- **[6-partner-service.md](./api-reference/6-partner-service.md)** - Partner profile and pairing methods
- **[7-error-handling.md](./api-reference/7-error-handling.md)** - Error classes and utility functions
- **[8-validation-schemas.md](./api-reference/8-validation-schemas.md)** - Zod validation schemas for API layer
- **[9-service-layer.md](./api-reference/9-service-layer.md)** - IndexedDB services and storage abstractions
- **[10-edge-functions.md](./api-reference/10-edge-functions.md)** - Supabase Edge Function for image upload
- **[11-service-worker.md](./api-reference/11-service-worker.md)** - Caching, background sync, message handlers
- **[12-real-time-subscriptions.md](./api-reference/12-real-time-subscriptions.md)** - Realtime service and broadcast flows

#### [Data Models](./data-models/index.md)

- **[table-of-contents.md](./data-models/table-of-contents.md)** - Full data models navigation
- **[1-database-schema-overview.md](./data-models/1-database-schema-overview.md)** - Supabase tables, enums, and buckets
- **[2-table-details.md](./data-models/2-table-details.md)** - Column-level detail for all 11 tables
- **[3-row-level-security-policies.md](./data-models/3-row-level-security-policies.md)** - RLS policies per table and bucket
- **[4-relationships.md](./data-models/4-relationships.md)** - Foreign keys and entity relationships
- **[5-database-functions-and-rpcs.md](./data-models/5-database-functions-and-rpcs.md)** - Postgres functions and RPC endpoints
- **[6-indexeddb-schema.md](./data-models/6-indexeddb-schema.md)** - Local IndexedDB object stores
- **[7-typescript-type-definitions.md](./data-models/7-typescript-type-definitions.md)** - Generated and application type defs
- **[8-validation-schemas.md](./data-models/8-validation-schemas.md)** - Local and Supabase Zod schemas
- **[9-migration-history.md](./data-models/9-migration-history.md)** - Database migration changelog

### Frontend

#### [Component Inventory](./component-inventory/index.md)

- **[table-of-contents.md](./component-inventory/table-of-contents.md)** - Full component inventory navigation
- **[component-hierarchy.md](./component-inventory/component-hierarchy.md)** - Visual component tree diagram
- **[component-inventory-table.md](./component-inventory/component-inventory-table.md)** - All 53 components with props and types
- **[feature-components.md](./component-inventory/feature-components.md)** - Feature-specific component details
- **[shared-and-utility-components.md](./component-inventory/shared-and-utility-components.md)** - Reusable UI utilities
- **[design-patterns.md](./component-inventory/design-patterns.md)** - Barrel exports, lazy loading, memoization
- **[state-connections.md](./component-inventory/state-connections.md)** - Store slice usage per component
- **[component-statistics.md](./component-inventory/component-statistics.md)** - Component count and coverage metrics

#### [State Management](./state-management/index.md)

- **[overview.md](./state-management/overview.md)** - Zustand architecture and tech stack
- **[store-configuration.md](./state-management/store-configuration.md)** - Store composition and AppState type
- **[slice-details.md](./state-management/slice-details.md)** - All 10 slices with state, actions, persistence
- **[data-flow.md](./state-management/data-flow.md)** - Component-store-service data flow patterns
- **[persistence-strategy.md](./state-management/persistence-strategy.md)** - localStorage partitioning and versioning
- **[react-hooks.md](./state-management/react-hooks.md)** - Custom hooks (useLoveNotes, useAutoSave, etc.)
- **[direct-store-access-pattern.md](./state-management/direct-store-access-pattern.md)** - Direct Zustand store access pattern

### Development

#### [Development Guide](./development-guide/index.md)

- **[prerequisites.md](./development-guide/prerequisites.md)** - Required tools and versions
- **[installation.md](./development-guide/installation.md)** - Clone and install steps
- **[environment-setup.md](./development-guide/environment-setup.md)** - Environment variables and secrets
- **[configuration-customization.md](./development-guide/configuration-customization.md)** - Vite, Tailwind, and ESLint config
- **[available-scripts.md](./development-guide/available-scripts.md)** - Dev, build, lint, and test scripts
- **[local-development-url.md](./development-guide/local-development-url.md)** - Local dev server URL details
- **[development-workflow.md](./development-guide/development-workflow.md)** - Commit format and workflow process
- **[build-process.md](./development-guide/build-process.md)** - Production build pipeline
- **[project-structure.md](./development-guide/project-structure.md)** - Annotated project layout
- **[testing.md](./development-guide/testing.md)** - Vitest, Playwright, and ATDD setup
- **[code-style.md](./development-guide/code-style.md)** - TypeScript, ESLint, Prettier conventions
- **[database-migrations.md](./development-guide/database-migrations.md)** - Migration commands and type generation
- **[deployment.md](./development-guide/deployment.md)** - CI/CD deployment and GitHub secrets
- **[troubleshooting.md](./development-guide/troubleshooting.md)** - Common issues and solutions

### Performance

- **[baseline.md](./performance/baseline.md)** - Bundle size baseline measurements
- **[bundle-report.md](./performance/bundle-report.md)** - Current build chunk analysis
- **[perf-build.log](./performance/perf-build.log)** - Vite production build output log

### Root Files

- **[project-scan-report.json](./project-scan-report.json)** - BMAD workflow scan metadata

---

## Project Structure Summary

```
src/
├── components/       # 24 component folders, 53 .tsx files
├── stores/           # Zustand store with 10 slices
├── services/         # 12 service modules (Supabase, IndexedDB, sync)
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

**For new developers:** Start with [Project Overview](./project-overview/index.md) → [Architecture](./architecture/index.md) → [Development Guide](./development-guide/index.md).

**For feature work:** Check [Component Inventory](./component-inventory/index.md) for UI patterns and [State Management](./state-management/index.md) for store interactions.

**For API integration:** See [API Reference](./api-reference/index.md) for all service methods, error handling, and real-time subscription patterns.

**For data changes:** Review [Data Models](./data-models/index.md) for schema definitions, migrations, and validation rules.

---

*Generated by BMAD Document-Project Workflow v1.2.0*
