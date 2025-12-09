# My Love - Project Documentation Index

> **Primary AI Retrieval Source**: This index is the starting point for understanding the My Love PWA codebase.
> **Last Updated**: 2025-12-08
> **Scan Type**: Exhaustive
> **Structure**: Phase-based numbered organization for clarity and navigation

## Project Overview

- **Type**: Monolith (Single Part)
- **Primary Language**: TypeScript 5.9.3
- **Framework**: React 19.2.1
- **Architecture**: Component-based SPA with Offline-First PWA + Supabase Backend
- **Documentation Version**: 5.0.0 (Phase-Based Organization)
- **Status**: Active Development (v2.0.0)

## Documentation Organization

Documentation is organized in numbered phases following the development lifecycle:

- **00-Vision-Strategy/** - Product vision, brainstorming, strategic planning
- **01-PRD/** - Product requirements documents
- **02-Architecture/** - System architecture, patterns, analysis
- **03-Development/** - Development guides, procedures, rollback strategies
- **04-Testing-QA/** - Test design, QA documentation
- **05-Epics-Stories/** - Sprint artifacts (stories, tech specs, epics)
- **06-Session-Logs/** - Session and development logs
- **07-Images/** - Diagrams, images, visual assets
- **08-Database/** - Data models, schemas, database documentation
- **09-UX-Spec/** - UX design specifications
- **10-Retrospectives/** - Epic and sprint retrospectives
- **99-Archive/** - Archived documentation
- **99-migrations/** - Database and system migrations
- **dataflow/** - Dataflow diagrams and documentation
- **prompts/** - AI prompts and templates

## Quick Reference

### Technology Stack

- **Frontend**: React 19.2.1 + TypeScript 5.9.3
- **Build Tool**: Vite 7.2.6
- **State Management**: Zustand 5.0.9 (8 slices, 50 actions)
- **Backend**: Supabase 2.86.2 (Auth, Database, Realtime, Storage)
- **Styling**: Tailwind CSS 4.1.17 + Framer Motion 12.23.25
- **Validation**: Zod 4.1.13
- **Data Persistence**: IndexedDB (IDB 8.0.3) + LocalStorage + Supabase
- **PWA**: Vite PWA Plugin 1.2.0 + Workbox (injectManifest)
- **Testing**: Vitest 4.0.9 + Playwright 1.57.0
- **Icons**: Lucide React 0.513.0

### Codebase Statistics (December 2025)

- **Source Files**: 148 TypeScript/TSX files
- **Directories**: 42
- **UI Components**: 54 implemented
- **Store Slices**: 8 (50 total actions)
- **API Services**: 8 modules
- **Business Services**: 12 classes
- **Custom Hooks**: 11
- **TypeScript Interfaces**: 45+
- **Zod Validation Schemas**: 15+
- **Database Tables**: 6
- **Database Migrations**: 7

---

## Core Documentation (Sharded)

### 📁 [Project Overview](./03-Development/project-overview/index.md)

Comprehensive project introduction, features, tech stack, and getting started guides.

**Key Sections**:

- [What is My Love?](./03-Development/project-overview/what-is-my-love.md) - Project introduction
- [Current Features](./03-Development/project-overview/current-features-implemented.md) - All implemented features
- [Technology Stack](./03-Development/project-overview/technology-stack.md) - Dependencies and versions
- [Architecture Overview](./03-Development/project-overview/architecture-overview.md) - System design patterns
- [Project Statistics](./03-Development/project-overview/project-statistics.md) - Codebase metrics
- [Getting Started](./03-Development/project-overview/getting-started.md) - Setup instructions
- [Performance](./03-Development/project-overview/performance-characteristics.md) - Runtime optimizations
- [Security & Privacy](./03-Development/project-overview/security-privacy.md) - Data protection policies
- [Browser Support](./03-Development/project-overview/browser-support.md) - Compatibility requirements

---

### 📁 [Architecture Documentation](./02-Architecture/)

Complete system architecture, patterns, and codebase analysis.

**Key Files**:

- [Architecture Overview](./02-Architecture/architecture.md) - Comprehensive system architecture
- [Source Tree Analysis](./02-Architecture/source-tree-analysis/index.md) - Codebase structure breakdown
- [State Management](./02-Architecture/ZUSTAND_STATE_MANAGEMENT_ARCHITECTURE/index.md) - Zustand architecture
- [API Services](./02-Architecture/api-services-architecture/) - Supabase integration patterns
- [Component Inventory](./02-Architecture/component-inventory/) - UI component catalog

---

### 📁 [Data Models](./08-Database/data-models/index.md)

TypeScript interfaces, database schemas, and validation patterns (45+ interfaces).

**Key Sections**:

- [Core Domain Models](./08-Database/data-models/core-domain-models.md) - User, Theme, Message, Photo, Mood, Interactions
- [State Slice Interfaces](./08-Database/data-models/state-slice-interfaces.md) - All 8 Zustand slice type definitions
- [Database Schema (Supabase)](./08-Database/data-models/database-schema-supabase.md) - SQL tables and RLS policies
- [Validation Schemas (Zod)](./08-Database/data-models/validation-schemas-zod.md) - Input and API response validation
- [IndexedDB Schema](./08-Database/data-models/indexeddb-schema.md) - Client-side storage structure
- [Type Safety Best Practices](./08-Database/data-models/type-safety-best-practices.md) - Generic types, type guards

---

### 📁 [Development Guides](./03-Development/)

Development procedures, guides, and operational documentation.

**Key Files**:

- [Development Guide](./03-Development/development-guide.md) - Development workflows
- [Guides](./03-Development/guides/) - Specific how-to guides
- [Memory Profiling](./03-Development/guides/memory-profiling.md) - Performance debugging

---

## Sprint Documentation

### Epic Technical Specifications

Located in [./05-Epics-Stories/](./05-Epics-Stories/):

- **Epic 1-6**: Foundation, Testing, Messages, Photos, Architecture, Supabase (Completed)
- **Epic TD-1**: Technical Debt - Subscription Observability (In Progress)

### Sprint Status

- **[Sprint Status](./05-Epics-Stories/sprint-status.yaml)** - Current sprint tracking
- **[Traceability Matrix](./traceability-matrix-epic-td-1.md)** - Requirements to tests mapping

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (with dotenvx) |
| `npm run build` | Production build |
| `npm run preview` | Preview production |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript validation |

---

## Quick Navigation

**Sharded Documentation** (Start Here):

- [Project Overview](./03-Development/project-overview/index.md) | [Architecture](./03-Development/project-overview/architecture-overview.md) | [Statistics](./03-Development/project-overview/project-statistics.md)
- [Data Models](./08-Database/data-models/index.md) | [Technology Stack](./03-Development/project-overview/technology-stack.md)

**Sprint Docs**:
[Epics & Stories](./05-Epics-Stories/) | [Sprint Status](./05-Epics-Stories/sprint-status.yaml)

---

**Documentation Structure**: Sharded for modularity (v5.0.0)
**Last Updated**: 2025-12-08
**Generated with**: BMAD document-project workflow (exhaustive scan)
