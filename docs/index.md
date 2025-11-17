# My Love - Project Documentation Index

> **Primary AI Retrieval Source**: This index is the starting point for understanding the My Love PWA codebase.
> **Last Updated**: 2025-11-16
> **Structure**: Sharded documentation for improved navigation

## Project Overview

- **Type**: Monolith (Single Part)
- **Primary Language**: TypeScript 5.9.3
- **Framework**: React 19.1.1
- **Architecture**: Component-based SPA with Offline-First PWA + Supabase Backend
- **Documentation Version**: 3.0.0 (Sharded Structure)
- **Status**: Feature Complete (v1.0.0)

## Quick Reference

### Technology Stack

- **Frontend**: React 19.1.1 + TypeScript 5.9.3
- **Build Tool**: Vite 7.1.7
- **State Management**: Zustand 5.0.8 (7 slices, 59 actions)
- **Backend**: Supabase 2.81.1 (Auth, Database, Realtime)
- **Styling**: Tailwind CSS 3.4.18 + Framer Motion 12.23.24
- **Validation**: Zod 3.23.8
- **Data Persistence**: IndexedDB (IDB 8.0.3) + LocalStorage + Supabase
- **PWA**: Vite PWA Plugin 0.21.3 + Workbox
- **Testing**: Vitest 1.6.1 + Playwright 1.52.0
- **Icons**: Lucide React 0.475.0

### Codebase Statistics

- **Source Files**: 90 TypeScript files
- **Directories**: 38
- **Components**: 20 implemented (48 TSX files)
- **Store Slices**: 7 (59 total actions)
- **API Services**: 8 modules
- **Business Services**: 10 classes
- **TypeScript Interfaces**: 35+
- **Zod Validation Schemas**: 12+

---

## Core Documentation (Sharded)

### 📁 [Project Overview](./project-overview/index.md)

Comprehensive project introduction, features, tech stack, and getting started guides.

**Key Sections**:

- [What is My Love?](./project-overview/what-is-my-love.md) - Project introduction
- [Current Features](./project-overview/current-features-implemented.md) - All implemented features
- [Technology Stack](./project-overview/technology-stack.md) - Dependencies and versions
- [Architecture Overview](./project-overview/architecture-overview.md) - System design patterns
- [Getting Started](./project-overview/getting-started.md) - Setup instructions for users and developers
- [Performance](./project-overview/performance-characteristics.md) - Runtime optimizations
- [Security & Privacy](./project-overview/security-privacy.md) - Data protection policies
- [Browser Support](./project-overview/browser-support.md) - Compatibility requirements

---

### 📁 [Source Tree Analysis](./source-tree-analysis/index.md)

Complete codebase structure breakdown and file organization (90 files analyzed).

**Key Sections**:

- [Entry Points](./source-tree-analysis/entry-points.md) - Application bootstrap files
- [Source Directory Deep Dive](./source-tree-analysis/source-directory-deep-dive.md) - Full src/ hierarchy
- [Component Architecture](./source-tree-analysis/component-architecture-deep-dive.md) - UI component structure
- [Service Layer](./source-tree-analysis/service-layer-architecture.md) - Business logic services
- [API Layer](./source-tree-analysis/api-layer-architecture.md) - Supabase integration (8 services)
- [State Management Architecture](./source-tree-analysis/state-management-architecture.md) - Zustand store composition
- [Configuration Files](./source-tree-analysis/configuration-files.md) - Build and tooling config
- [Testing Infrastructure](./source-tree-analysis/testing-infrastructure.md) - Test suite organization
- [Critical File Locations](./source-tree-analysis/critical-file-locations-summary.md) - Must-know files

---

### 📁 [Component Inventory](./component-inventory/index.md)

Catalog of all 20 UI components organized by feature domain (48 TSX files).

**Key Sections**:

- [Component Summary](./component-inventory/component-summary-by-feature.md) - Quick reference table
- [Photo Management Suite](./component-inventory/photo-management-suite.md) - 6 components (upload, gallery, carousel, edit, delete)
- [Mood Tracking Suite](./component-inventory/mood-tracking-suite.md) - 4 components (tracker, history, partner view)
- [Message System](./component-inventory/message-system.md) - 7 components (daily message, admin panel)
- [Authentication Flow](./component-inventory/authentication-flow.md) - 3 components (login, setup, welcome)
- [Partner Interaction](./component-inventory/partner-interaction.md) - 2 components (poke/kiss, history)
- [Settings](./component-inventory/settings.md) - 2 components (preferences, anniversaries)
- [Core Utilities](./component-inventory/core-utilities.md) - 3 components (countdown, error boundary, welcome button)
- [Animation Specifications](./component-inventory/animation-specifications.md) - Framer Motion patterns
- [Accessibility Features](./component-inventory/accessibility-features.md) - WCAG compliance

---

### 📁 [Data Models](./data-models/index.md)

TypeScript interfaces, database schemas, and validation patterns (35+ interfaces).

**Key Sections**:

- [Core Domain Models](./data-models/core-domain-models.md) - User, Theme, Message, Photo, Mood, Interactions
- [State Slice Interfaces](./data-models/state-slice-interfaces.md) - All 7 Zustand slice type definitions
- [Database Schema (Supabase)](./data-models/database-schema-supabase.md) - SQL tables and RLS policies
- [Validation Schemas (Zod)](./data-models/validation-schemas-zod.md) - Input and API response validation
- [IndexedDB Schema](./data-models/indexeddb-schema.md) - Client-side storage structure
- [Type Safety Best Practices](./data-models/type-safety-best-practices.md) - Generic types, type guards

---

### 📁 [State Management](./state-management/index.md)

Zustand store architecture with 7 slices and 59 actions.

**Key Sections**:

- [Overview](./state-management/overview.md) - Slice-based architecture introduction
- [Store Architecture](./state-management/store-architecture.md) - Main store composition
- [Feature Slices Deep Dive](./state-management/feature-slices-deep-dive.md) - All 7 slices with code examples
- [Persistence Strategy](./state-management/persistence-strategy.md) - What gets persisted where
- [Usage Patterns](./state-management/usage-patterns.md) - Component integration examples
- [Performance Optimizations](./state-management/performance-optimizations.md) - Selectors and memoization
- [Best Practices](./state-management/best-practices.md) - Guidelines summary

---

### 📁 [API & Services Architecture](./api-services-architecture/index.md)

Comprehensive API layer and business services documentation (8 API services, 10 business services).

**Key Sections**:

- [Executive Summary](./api-services-architecture/executive-summary.md) - Architecture overview
- [API Layer Architecture](./api-services-architecture/api-layer-architecture.md) - Supabase integration (8 services)
- [Services Layer Architecture](./api-services-architecture/services-layer-architecture.md) - Business logic (10 services)
- [Authentication & Authorization](./api-services-architecture/authentication-authorization-flow.md) - Auth flows and RLS
- [Real-time Sync Capabilities](./api-services-architecture/real-time-sync-capabilities.md) - Supabase realtime
- [IndexedDB Service Patterns](./api-services-architecture/indexeddb-service-patterns.md) - Local storage patterns
- [Error Handling Strategies](./api-services-architecture/error-handling-strategies.md) - Error management
- [Data Migration Patterns](./api-services-architecture/data-migration-patterns.md) - Migration approaches
- [Performance Monitoring](./api-services-architecture/performance-monitoring.md) - Monitoring setup
- [Type Definitions](./api-services-architecture/appendix-type-definitions.md) - Type reference

---

## Additional Core Documentation

- **[architecture.md](./architecture.md)** - System architecture executive summary
- **[PRD.md](./PRD.md)** - Product requirements document
- **[technical-decisions.md](./technical-decisions.md)** - Architecture decisions log
- **[development-guide.md](./development-guide.md)** - Developer workflow and standards
- **[bug-tracker.md](./bug-tracker.md)** - Known issues and critical bugs
- **[test-design-system.md](./test-design-system.md)** - System-level test design retrospective

---

## Sprint Documentation

### Epic Technical Specifications

- **[Epic 1 Tech Spec](./sprint-artifacts/tech-spec-epic-1.md)** - Foundation & Technical Debt
- **[Epic 2 Tech Spec](./sprint-artifacts/tech-spec-epic-2.md)** - Testing Infrastructure
- **[Epic 3 Tech Spec](./sprint-artifacts/tech-spec-epic-3.md)** - Message Library (365 messages)
- **[Epic 4 Tech Spec](./sprint-artifacts/tech-spec-epic-4.md)** - Photo Management Suite
- **[Epic 5 Tech Spec](./sprint-artifacts/tech-spec-epic-5.md)** - Architecture Optimization
- **[Epic 6 Tech Spec](./sprint-artifacts/tech-spec-epic-6.md)** - Supabase Integration
- **[Epic 7 Tech Spec](./sprint-artifacts/tech-spec-epic-7.md)** - Offline Mode Hardening (in progress)

### User Stories (40+ Completed)

Located in [./stories/](./stories/):

- **Epic 1**: Stories 1-1 through 1-6 (Foundation)
- **Epic 2**: Stories 2-1 through 2-6 (Testing)
- **Epic 3**: Stories 3-1 through 3-6 (Messages)
- **Epic 4**: Stories 4-1 through 4-5 (Photos)
- **Epic 5**: Stories 5-1 through 5-5 (Architecture)
- **Epic 6**: Stories 6-0 through 6-7 (Supabase)
- **Epic 7**: Story 7-1 (Offline Testing - in progress)

### Retrospectives

Located in [./retrospectives/](./retrospectives/):

- [Epic 1 Retro](./retrospectives/epic-1-retro-2025-10-30.md) - Foundation lessons
- [Epic 2 Retro](./retrospectives/epic-2-retro-2025-11-01.md) - Testing setup review
- [Epic 3 Retro](./retrospectives/epic-3-retro-2025-11-06.md) - Message expansion
- [Epic 4 Retro](./retrospectives/epic-4-retro-2025-11-12.md) - Photo features
- [Epic 5 Retro](./retrospectives/epic-5-retro-2025-11-15.md) - Architecture optimization
- [Epic 6 Retro](./retrospectives/epic-6-retro-2025-11-15.md) - Supabase integration

---

## Planning & Analysis

### Implementation Plans

Located in [./plans/](./plans/):

- **[bundle-size-optimization.md](./plans/2025-11-15-bundle-size-optimization.md)** - Performance improvements
- **[vercel-migration.md](./plans/2025-11-15-vercel-migration.md)** - Hosting migration
- **[technical-improvements.md](./plans/2025-11-15-technical-improvements.md)** - Code quality enhancements
- **[epic-5-code-review-fixes.md](./plans/2025-11-14-epic-5-code-review-fixes.md)** - Review feedback
- **[epic-6-code-review-fixes.md](./plans/2025-11-15-epic-6-code-review-fixes.md)** - Review feedback

### Status & Tracking

- **[epics.md](./epics.md)** - Epic overview and status
- **[implementation-readiness-report](./implementation-readiness-report-2025-11-15.md)** - Sprint readiness
- **[sprint-change-proposal](./sprint-change-proposal-2025-11-15.md)** - Scope changes

---

## Guides & Resources

- **[Memory Profiling Guide](./guides/memory-profiling.md)** - Performance debugging
- **[overnight-dev.md](./overnight-dev.md)** - Autonomous development setup
- **[partner-connection-system-design.md](./partner-connection-system-design.md)** - Partner pairing architecture
- **[task5-icon-optimization-analysis.md](./task5-icon-optimization-analysis.md)** - Icon bundle analysis

---

## Documentation Usage Guide

### For AI Agents / LLMs

**Retrieval Pattern** (optimized for accuracy):

1. **Context Gathering**:
   - Start with this index for quick facts
   - Browse sharded folders for specific topics
   - Each sharded folder has its own `index.md`

2. **Task-Specific Retrieval**:
   - **Modifying Components** → [Component Inventory](./component-inventory/index.md) + [State Management](./state-management/index.md)
   - **Adding Features** → [Source Tree Analysis](./source-tree-analysis/index.md) + [Data Models](./data-models/index.md)
   - **Database Changes** → [Data Models - Supabase](./data-models/database-schema-supabase.md)
   - **State Changes** → [State Management - Slices](./state-management/feature-slices-deep-dive.md) or [Zustand Architecture](./ZUSTAND_STATE_MANAGEMENT_ARCHITECTURE/index.md)
   - **API Integration** → [Source Tree - API Layer](./source-tree-analysis/api-layer-architecture.md)
   - **Validation** → [Data Models - Zod](./data-models/validation-schemas-zod.md)
   - **Zustand Slice Details** → [Zustand Architecture](./ZUSTAND_STATE_MANAGEMENT_ARCHITECTURE/index.md) (21 sharded files)

3. **Key Facts**:
   - 20 components, 7 slices, 59 actions
   - 365 messages with deterministic rotation
   - Supabase backend with real-time sync
   - IndexedDB for photos (local-only)
   - Multi-emotion mood tracking (12 options)

### For Human Developers

**First Time Setup**:

1. Review [Project Overview - Getting Started](./project-overview/getting-started.md)
2. Configure `.env` with Supabase credentials
3. Run `npm install && npm run dev`
4. Browse [Source Tree Analysis](./source-tree-analysis/index.md) for codebase structure

**Working on Features**:

1. Check [Component Inventory](./component-inventory/index.md) for patterns
2. Review [State Management](./state-management/index.md) for store modifications
3. Refer to [Data Models](./data-models/index.md) for types
4. Follow architecture patterns in [Source Tree](./source-tree-analysis/architecture-patterns-summary.md)

---

## Archive

Files that have been sharded or superseded are stored in [./.archive/](./.archive/).

**Important**: Archived content should NOT be used as current documentation. See `.archive/claude.md` for guidelines.

---

## Development Commands

| Command             | Purpose               |
| ------------------- | --------------------- |
| `npm run dev`       | Start Vite dev server |
| `npm run build`     | Production build      |
| `npm run preview`   | Preview production    |
| `npm run test`      | Run Vitest unit tests |
| `npm run test:e2e`  | Run Playwright E2E    |
| `npm run lint`      | ESLint check          |
| `npm run typecheck` | TypeScript validation |

---

## Quick Navigation

**Sharded Documentation** (Start Here):

- [Project Overview](./project-overview/index.md) | [Source Tree](./source-tree-analysis/index.md) | [Components](./component-inventory/index.md)
- [Data Models](./data-models/index.md) | [State Management](./state-management/index.md) | [API Services](./api-services-architecture/index.md)
- [Zustand Architecture](./ZUSTAND_STATE_MANAGEMENT_ARCHITECTURE/index.md) - Detailed slice specifications and patterns

**Core Docs**:
[Architecture](./architecture.md) | [PRD](./PRD.md) | [Technical Decisions](./technical-decisions.md)

**Sprint Docs**:
[Epic Specs](./sprint-artifacts/) | [Stories](./stories/) | [Retrospectives](./retrospectives/)

---

**Documentation Structure**: Sharded for modularity (v3.0.0)
**Last Updated**: 2025-11-16
**Generated with**: BMAD document workflows
