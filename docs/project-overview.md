# Project Overview

> High-level overview of the My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## What is My-Love?

My-Love is a **Progressive Web App (PWA)** designed as a personal relationship companion for couples. It provides daily love messages, mood tracking, photo sharing, love notes (chat), scripture reading, and partner interaction features — all with offline-first support.

## Quick Facts

| Attribute | Value |
|-----------|-------|
| **Type** | Monolith Web SPA (PWA) |
| **Framework** | React 19.2.3 + TypeScript 5.9.3 |
| **Build** | Vite 7.3.1 |
| **State** | Zustand 5.0.10 (10 slices) |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| **Styling** | Tailwind CSS 4.1.17 + Framer Motion 12.27.1 |
| **Hosting** | GitHub Pages |
| **URL** | https://sallvainian.github.io/My-Love/ |
| **Node** | 24.x (pinned via .nvmrc) |
| **Package Manager** | npm (package-lock.json) |

## Features

| Feature | Description | Key Components |
|---------|-------------|----------------|
| **Daily Messages** | 365 rotating love messages across 5 categories | `DailyMessage`, `AdminPanel` |
| **Mood Tracking** | Multi-mood selection, notes, calendar view, partner sharing | `MoodTracker`, `MoodHistory` |
| **Love Notes** | Real-time chat with image sharing | `love-notes/` (6 components) |
| **Photo Gallery** | Upload, compress, grid view, carousel | `PhotoGallery`, `PhotoUpload`, `PhotoCarousel` |
| **Scripture Reading** | 17-step Bible study with reflections (solo/together) | `scripture-reading/` |
| **Partner Connect** | User search, partner requests, poke/kiss interactions | `PartnerMoodView`, `PokeKissInterface` |
| **Offline Support** | Full offline operation with three-layer sync | Service Worker, IndexedDB |

## Architecture Summary

- **Client-side SPA** — No server-side rendering, runs entirely in the browser
- **Offline-first** — IndexedDB caching + Background Sync + periodic retry
- **Component-based** — 26 feature folders with co-located tests
- **Layered** — Components → Hooks → Store → Services → API → Supabase
- **Validated** — Zod schemas at every data boundary

## Repository Structure

| Path | Purpose |
|------|---------|
| `src/components/` | 26 React feature folders (30+ components) |
| `src/stores/slices/` | 10 Zustand state slices |
| `src/services/` | 14 business logic services |
| `src/hooks/` | 12 custom React hooks |
| `src/api/` | Supabase API client layer (7 files) |
| `src/validation/` | Zod schemas for input validation |
| `src/config/` | App constants and configuration |
| `src/utils/` | 16 utility modules |
| `src/data/` | Static data (365 messages, 17 scripture steps) |
| `supabase/migrations/` | 9 PostgreSQL migrations |
| `supabase/functions/` | 1 Edge Function (image upload) |
| `.github/workflows/` | 5 CI/CD workflows |
| `docs/` | Project documentation |

## Database

- **Supabase PostgreSQL**: 11 tables with Row Level Security
- **IndexedDB**: 8 stores (v5 schema) for offline caching
- **LocalStorage**: Settings and message history persistence

## Testing

| Level | Tool | Threshold |
|-------|------|-----------|
| Unit/Component | Vitest 4.0 + Testing Library | 80% coverage |
| E2E | Playwright 1.57 | Critical paths |
| TDD | tdd-guard-vitest | Enforced discipline |

## Documentation Index

| Document | Purpose |
|----------|---------|
| [Architecture](./architecture.md) | System design, patterns, decisions |
| [Technology Stack](./technology-stack.md) | Dependencies with versions |
| [Source Tree Analysis](./source-tree-analysis.md) | Annotated directory structure |
| [Component Inventory](./component-inventory.md) | UI component catalog |
| [State Management](./state-management.md) | Zustand store architecture |
| [Service Layer](./service-layer.md) | Business logic services |
| [API Reference](./api-reference.md) | API layer and validation |
| [Data Models](./data-models.md) | Database schema and IndexedDB |
| [Development Guide](./development-guide.md) | Setup, commands, workflow |
| [Project Context](./project-context.md) | AI agent implementation rules |

## Getting Started

```bash
git clone https://github.com/sallvainian/My-Love.git
cd My-Love
nvm use          # Node 24.x
npm install
npm run dev      # Starts Vite dev server
```

See [Development Guide](./development-guide.md) for full setup instructions.
