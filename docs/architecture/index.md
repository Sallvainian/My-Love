# Architecture Documentation

Comprehensive architecture documentation for the **My-Love** PWA -- a couples app built with React 19, TypeScript, and Supabase.

## Table of Contents

1. [Executive Summary](./executive-summary.md) -- High-level architecture overview
2. [Technology Stack](./technology-stack.md) -- Full technology table with versions and rationale
3. [Architecture Pattern](./architecture-pattern.md) -- Layered architecture and key decisions
4. [Source Directory Structure](./source-directory-structure.md) -- Annotated src/ tree
5. [Data Architecture](./data-architecture.md) -- Dual storage: Supabase + IndexedDB
6. [State Management](./state-management.md) -- Zustand overview (links to detailed section)
7. [Component Hierarchy](./component-hierarchy.md) -- React component tree
8. [Authentication Flow](./authentication-flow.md) -- Supabase email/password auth
9. [Navigation System](./navigation-system.md) -- Zustand-based routing
10. [Real-Time Features](./real-time-features.md) -- Supabase Realtime patterns
11. [Offline Strategy](./offline-strategy.md) -- Service Worker, IndexedDB, Background Sync
12. [Security](./security.md) -- RLS, auth model, input sanitization
13. [Validation Architecture](./validation-architecture.md) -- Zod schemas and layers
14. [Deployment](./deployment.md) -- GitHub Pages + CI/CD
15. [Testing Strategy](./testing-strategy.md) -- Vitest, Playwright, pgTAP
16. [Performance Optimizations](./performance-optimizations.md) -- Lazy loading, code splitting
17. [Error Handling Strategy](./error-handling-strategy.md) -- Error boundaries, offline errors
18. [Scalability Considerations](./scalability-considerations.md) -- 2-user scope and growth paths
