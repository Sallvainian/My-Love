# My-Love Project Documentation Index

> **BMM Workflow Integration Point**
> Generated: 2026-01-25 | Scan Level: Exhaustive | Project Type: Web SPA

## Project Overview

| Attribute | Value |
|-----------|-------|
| **Name** | My-Love |
| **Type** | Web SPA (React 19 + Vite + PWA) |
| **Architecture** | Offline-first with real-time sync |
| **Repository** | Monolith |
| **Primary Language** | TypeScript ~5.9.3 |

### Quick Reference

- **Framework:** React 19.2.3 + Vite 7.3.1
- **State:** Zustand 5.0.10 (8 slices)
- **Backend:** Supabase (Auth + Postgres + Realtime)
- **Styling:** Tailwind CSS 4.1.17 (custom themes)
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Entry Point:** `src/main.tsx` → `src/App.tsx`

---

## Existing Documentation (Magic Docs)

The project has comprehensive documentation in `docs/`:

| Document | Description | Path |
|----------|-------------|------|
| **[Architecture Overview](../../docs/architecture-overview.md)** | System design, data flow, component hierarchy | `docs/architecture-overview.md` |
| **[Technology Stack](../../docs/technology-stack.md)** | All technologies with versions and justifications | `docs/technology-stack.md` |
| **[Component Inventory](../../docs/component-inventory.md)** | All 28 component folders categorized | `docs/component-inventory.md` |
| **[State Management](../../docs/state-management.md)** | Zustand store architecture, slices, persistence | `docs/state-management.md` |
| **[Service Layer](../../docs/service-layer.md)** | All services (IndexedDB, sync, storage) | `docs/service-layer.md` |
| **[API Reference](../../docs/api-reference.md)** | Supabase integration, API services | `docs/api-reference.md` |
| **[Data Models](../../docs/data-models.md)** | TypeScript types, Zod schemas, DB schema | `docs/data-models.md` |
| **[Project Context](../../docs/project-context.md)** | Rules, patterns, and conventions | `docs/project-context.md` |

### Additional Resources

| Document | Description | Path |
|----------|-------------|------|
| **[README](../../README.md)** | Project overview and setup | `README.md` |
| **[CLAUDE.md](../../CLAUDE.md)** | Claude Code instructions | `CLAUDE.md` |
| **[Tests README](../../tests/README.md)** | Testing documentation | `tests/README.md` |

---

## Source Structure

```
src/
├── api/              # Supabase integration (8 files)
│   ├── authService.ts        # Auth (email, Google OAuth)
│   ├── moodApi.ts            # Mood CRUD with Zod validation
│   ├── moodSyncService.ts    # Offline-first sync
│   ├── interactionService.ts # Poke/kiss + Realtime
│   ├── partnerService.ts     # Partner connections
│   ├── supabaseClient.ts     # Singleton client
│   ├── errorHandlers.ts      # Error utilities
│   └── validation/           # Zod schemas
├── components/       # React components (28 folders, 56 files)
│   ├── MoodTracker/          # Mood logging UI
│   ├── MoodHistory/          # Calendar view
│   ├── PokeKissInterface/    # Partner interactions
│   ├── PhotoGallery/         # Photo sharing
│   ├── love-notes/           # Chat/messaging
│   ├── RelationshipTimers/   # Countdowns
│   ├── DailyMessage/         # Love messages
│   ├── Settings/             # User preferences
│   └── ...                   # See component-inventory.md
├── stores/           # Zustand state (9 files)
│   ├── useAppStore.ts        # Composed store
│   └── slices/               # 8 domain slices
├── services/         # Business logic (12 files)
│   ├── moodService.ts        # Mood IndexedDB
│   ├── syncService.ts        # Background sync
│   ├── photoService.ts       # Photo management
│   └── ...                   # See service-layer.md
├── hooks/            # Custom hooks (12 files)
├── types/            # TypeScript definitions (3 files)
├── utils/            # Utilities (18 files)
├── validation/       # Zod schemas (3 files)
├── config/           # App configuration (4 files)
└── sw.ts             # Service worker (PWA)
```

---

## Technology Stack Summary

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | ^19.2.3 |
| Bundler | Vite | ^7.3.1 |
| Language | TypeScript | ~5.9.3 |
| Styling | Tailwind CSS | ^4.1.17 |
| State | Zustand | ^5.0.10 |
| Backend | Supabase | ^2.90.1 |
| Local DB | idb (IndexedDB) | ^8.0.3 |
| Validation | Zod | ^4.3.5 |
| Animation | Framer Motion | ^12.27.1 |
| Icons | Lucide React | ^0.562.0 |
| PWA | vite-plugin-pwa | ^1.2.0 |
| Unit Testing | Vitest | ^4.0.17 |
| E2E Testing | Playwright | ^1.57.0 |

---

## Architecture Patterns

### Offline-First Data Flow

```
User Action → Zustand Store → IndexedDB (local) → Supabase (remote)
                    ↓                                    ↓
              UI Update                          Partner Realtime
```

### State Persistence Strategy

| Data Type | Storage | Sync |
|-----------|---------|------|
| Settings | LocalStorage | No |
| Messages | IndexedDB | No |
| Moods | IndexedDB | Yes → Supabase |
| Photos | IndexedDB + Supabase Storage | Yes |
| Notes | Supabase only | Realtime |

### Key Design Decisions

1. **Offline-first:** All writes go to IndexedDB first, sync when online
2. **Slice pattern:** 8 Zustand slices for domain separation
3. **Zod validation:** Runtime type safety on API responses
4. **PWA:** Installable with service worker caching
5. **RLS:** Supabase Row Level Security for data isolation

---

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `deploy.yml` | Push to main | Build + deploy to GitHub Pages |
| `playwright.yml` | PR | E2E tests |
| `supabase-migrations.yml` | Push (supabase/) | DB migrations |
| `claude-code-review.yml` | PR | AI code review |
| `claude.yml` | Comment | Claude assistance |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase account (for backend features)

### Development

```bash
npm install
npm run dev
```

### Testing

```bash
npm run test:unit      # Vitest unit tests
npm run test:e2e       # Playwright E2E tests
```

### Build

```bash
npm run build          # Production build
npm run preview        # Preview production build
```

---

## BMM Workflow Integration

When creating a **PRD** for new features:

1. **Reference this index** as the primary project context
2. **Link to specific docs** for detailed architecture/patterns
3. **Check existing components** before designing new ones
4. **Follow established patterns** from `docs/project-context.md`

### Key Files for PRD Context

- **Architecture:** `docs/architecture-overview.md`
- **Components:** `docs/component-inventory.md`
- **State:** `docs/state-management.md`
- **API:** `docs/api-reference.md`
- **Data:** `docs/data-models.md`
- **Rules:** `docs/project-context.md`

---

*Generated by BMM document-project workflow*
