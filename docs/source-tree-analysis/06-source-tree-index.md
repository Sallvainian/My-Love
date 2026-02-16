# Source Tree Analysis Index

## Documents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Technology Stack Summary](./01-technology-stack-summary.md) | All dependencies with versions, categorized by role (runtime, build, test, quality) |
| 02 | [Complete Directory Tree](./02-directory-tree.md) | Full annotated file tree of `src/` with descriptions for every file |
| 03 | [Entry Point Trace](./03-entry-point-trace.md) | Boot sequence from `main.tsx` through `App.tsx`, SW registration, store initialization |
| 04 | [Critical Folders](./04-critical-folders.md) | Analysis of highest-impact directories: stores, services, api, validation, hooks, components |
| 05 | [NPM Scripts Reference](./05-npm-scripts-reference.md) | All npm scripts with commands, descriptions, and usage examples |

## Quick Reference: File Counts by Directory

| Directory | TypeScript Files | Purpose |
|-----------|-----------------|---------|
| `src/stores/` | 12 | State management (1 store + 1 types + 10 slices) |
| `src/services/` | 14 | Data services (1 base + 13 concrete) |
| `src/hooks/` | 13 | React hooks (1 barrel + 12 hooks) |
| `src/api/` | 10 | Supabase API layer |
| `src/components/` | ~70 | React components across 22 directories |
| `src/utils/` | 17 | Utility functions |
| `src/validation/` | 3 | Zod schemas and error handling |
| `src/config/` | 4 | Configuration constants |
| `src/types/` | 3 | Type definitions |
| `src/data/` | 3 | Static data (messages, scripture steps) |
| `src/` (root) | 5 | App.tsx, main.tsx, sw.ts, sw-db.ts, sw-types.d.ts |

## Cross-Reference to Architecture Docs

| Source Tree Topic | Architecture Doc |
|-------------------|-----------------|
| Technology stack | [Architecture - Technology Stack](../architecture/02-technology-stack.md) |
| Store files | [State Management - Zustand Configuration](../state-management/01-zustand-store-configuration.md) |
| Service files | [Architecture - Architecture Patterns](../architecture/03-architecture-patterns.md) |
| API files | [Architecture - API Layer](../architecture/08-api-layer.md) |
| Hook files | [State Management - React Hooks](../state-management/06-react-hooks.md) |
| Component files | [Architecture - Component Hierarchy](../architecture/06-component-hierarchy.md) |
| Validation files | [Architecture - Validation Layer](../architecture/14-validation-layer.md) |
| SW files | [Architecture - Service Worker](../architecture/10-service-worker.md) |
| Build/deploy | [Architecture - Deployment](../architecture/15-deployment.md) |
