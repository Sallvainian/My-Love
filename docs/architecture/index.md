# Architecture Documentation

Comprehensive architecture documentation for the **My Love** PWA -- a couples app built with React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, and Supabase.

Live URL: <https://sallvainian.github.io/My-Love/>

## Table of Contents

| #   | Document                                                       | Description                                                                                                                                   |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [Executive Summary](./01-executive-summary.md)                 | High-level architecture overview, key design decisions, and feature summary                                                                   |
| 2   | [Technology Stack](./02-technology-stack.md)                   | Full technology table with pinned versions, rationale, and dependency graph                                                                   |
| 3   | [Architecture Patterns](./03-architecture-patterns.md)         | Eight patterns: offline-first, online-first, Supabase-direct, sliced store, cache-first, write-through, singleton services, and optimistic UI |
| 4   | [Data Architecture](./04-data-architecture.md)                 | Dual storage: Supabase (Postgres + Storage + Realtime) + IndexedDB (8 stores, v1-v5 migrations) + localStorage                                |
| 5   | [State Management Overview](./05-state-management-overview.md) | Zustand architecture overview (see [State Management](../state-management/) for deep-dive)                                                    |
| 6   | [Component Hierarchy](./06-component-hierarchy.md)             | React component tree from StrictMode through all lazy-loaded views                                                                            |
| 7   | [Authentication Flow](./07-authentication-flow.md)             | Supabase email/password + Google OAuth, partner detection, token lifecycle                                                                    |
| 8   | [API Layer](./08-api-layer.md)                                 | All API services: supabaseClient, moodApi, moodSyncService, interactionService, partnerService, errorHandlers                                 |
| 9   | [Navigation](./09-navigation.md)                               | Zustand-based routing with browser history integration and lazy loading                                                                       |
| 10  | [Service Worker](./10-service-worker.md)                       | InjectManifest strategy, Workbox caching layers, Background Sync                                                                              |
| 11  | [Realtime Features](./11-realtime-features.md)                 | Broadcast API for love notes, mood updates, scripture sessions, and Presence for position tracking                                            |
| 12  | [Offline Strategy](./12-offline-strategy.md)                   | Three-tier sync (immediate, periodic, Background Sync API), network status detection                                                          |
| 13  | [Security Model](./13-security-model.md)                       | Row Level Security, DOMPurify XSS protection, Zod validation boundaries, env encryption                                                       |
| 14  | [Validation Layer](./14-validation-layer.md)                   | All Zod schemas with code examples, error transformation, and custom error classes                                                            |
| 15  | [Deployment](./15-deployment.md)                               | GitHub Pages, fnox/age secrets, CI/CD workflows                                                                                               |
| 16  | [Testing Architecture](./16-testing-architecture.md)           | Five test layers, framework configuration, priority tags, test utilities                                                                      |
| 17  | [Error Handling](./17-error-handling.md)                       | Strategy by layer, custom error classes, retry with backoff, corruption recovery                                                              |
| 18  | [Performance](./18-performance.md)                             | Lazy loading, virtualization, image compression, bundle splitting, performance monitoring                                                     |
| 19  | [Scalability](./19-scalability.md)                             | Two-user scope, data volume estimates, IndexedDB quotas, growth path                                                                          |

## Cross-References

- **State Management Deep-Dive**: [docs/state-management/](../state-management/index.md)
- **Source Tree Analysis**: [docs/source-tree-analysis/](../source-tree-analysis/index.md)
- **Project README**: [CLAUDE.md](../../CLAUDE.md) (developer instructions)
