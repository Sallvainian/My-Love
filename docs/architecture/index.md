# Architecture Documentation

Comprehensive architecture documentation for the **My-Love** PWA — a couples app built with React 19, TypeScript, and Supabase.

## Table of Contents

1. [Executive Summary](./01-executive-summary.md) — High-level architecture overview
2. [Technology Stack](./02-technology-stack.md) — Full technology table with versions and rationale
3. [Architecture Patterns](./03-architecture-patterns.md) — 8 patterns: offline-first, online-first, Supabase-direct, sliced store, and more
4. [Data Architecture](./04-data-architecture.md) — Dual storage: Supabase + IndexedDB + localStorage
5. [State Management Overview](./05-state-management-overview.md) — Zustand architecture (see [State Management](../state-management/) for details)
6. [Component Hierarchy](./06-component-hierarchy.md) — React component tree from StrictMode through all views
7. [Authentication Flow](./07-authentication-flow.md) — Supabase email/password auth, partner detection
8. [API Layer](./08-api-layer.md) — All API services: supabaseClient, moodApi, interactionService, etc.
9. [Navigation](./09-navigation.md) — Zustand-based routing with lazy loading
10. [Service Worker](./10-service-worker.md) — InjectManifest strategy, caching, Background Sync
11. [Realtime Features](./11-realtime-features.md) — Broadcast API for love notes and partner mood
12. [Offline Strategy](./12-offline-strategy.md) — Three-tier sync, network status, OfflineError
13. [Security Model](./13-security-model.md) — RLS, DOMPurify, Zod boundaries, env encryption
14. [Validation Layer](./14-validation-layer.md) — All Zod schemas with code and error transformation
15. [Deployment](./15-deployment.md) — GitHub Pages, dotenvx, CI/CD workflows
16. [Testing Architecture](./16-testing-architecture.md) — 5 test layers, frameworks, priority tags
17. [Error Handling](./17-error-handling.md) — Strategy by layer, retry patterns, corruption recovery
18. [Performance](./18-performance.md) — Lazy loading, virtualization, image compression, bundle analysis
19. [Scalability](./19-scalability.md) — 2-user scope, data volume estimates, growth path
