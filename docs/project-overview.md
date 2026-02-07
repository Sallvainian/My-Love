# My Love - Project Overview

A Progressive Web App that sends daily love messages and reminders to your partner. Features real-time messaging, mood tracking, photo sharing, scripture reading, and playful interactions.

- **Live URL**: <https://sallvainian.github.io/My-Love/>
- **Repository Type**: Monolith (single cohesive codebase)
- **Primary Language**: TypeScript (strict mode, no `any`)

---

## Technology Stack

| Category | Technology | Version |
|---|---|---|
| Frontend Framework | React | 19.2.3 |
| Language | TypeScript | 5.9.3 |
| Build Tool | Vite | 7.3.1 |
| Styling | Tailwind CSS | 4.1.17 |
| Animations | Framer Motion | 12.27.1 |
| State Management | Zustand | 5.0.10 |
| Backend / Auth | Supabase | 2.90.1 |
| Local Storage | IndexedDB (idb) | 8.0.3 |
| Validation | Zod | 4.3.5 |
| Icons | Lucide React | 0.562.0 |
| PWA | vite-plugin-pwa (Workbox) | 1.2.0 |
| Unit Testing | Vitest | 4.0.17 |
| E2E Testing | Playwright | 1.57.0 |
| Code Quality | ESLint 9, Prettier 3.8 | - |
| Deployment | GitHub Pages via GitHub Actions | - |

---

## Architecture

**Pattern**: Component-based SPA with offline-first data layer.

### Data Flow

```
Components --> Zustand Store --> Services --> Supabase | IndexedDB --> Background Sync --> Service Worker
```

### Key Architectural Decisions

| Concern | Approach |
|---|---|
| State | Zustand with 10 slices (app, navigation, messages, mood, interactions, photos, notes, partner, settings, scriptureReading) |
| Auth | Supabase Auth with email/password |
| Real-time | Supabase Realtime for mood sync, partner interactions, and love notes |
| Offline | Service Worker (injectManifest), IndexedDB persistence, background sync queue |
| Security | Row Level Security (RLS) on all Supabase tables |

---

## Key Features

| # | Feature | Description |
|---|---|---|
| 1 | Daily Love Messages | Rotating heartfelt messages (100+ pre-written) |
| 2 | Love Notes Chat | Real-time messaging with partner |
| 3 | Mood Tracker | Daily mood logging with emoji moods and notes |
| 4 | Partner Mood View | See partner's mood in real-time |
| 5 | Partner Interactions | Send pokes, kisses, and farts with animations |
| 6 | Photo Gallery | Upload, view, and share photos with captions |
| 7 | Anniversary Countdowns | Real-time countdown to special dates |
| 8 | Scripture Reading | Multi-step reading flow with reflection prompts (Epic 2) |
| 9 | Multiple Themes | Sunset, Ocean, Lavender, and Rose |
| 10 | PWA Support | Installable, works offline |

---

## Repository Structure

```
src/                    Application source code (150+ TypeScript files)
  components/           24 component folders
  api/                  Supabase client and service layer (7 files)
  stores/               Zustand store with 10 slices
  services/             Business logic and data services (14 files)
  hooks/                12 React hooks
  types/                Type definitions and Supabase generated types
  utils/                Utility functions (16 files)
  validation/           Zod schemas for data validation
  config/               Constants and configuration
  data/                 Default messages and scripture steps
tests/                  Unit tests (Vitest) and E2E tests (Playwright)
supabase/               Database migrations and edge functions
scripts/                Utility and CI scripts
.github/                CI/CD workflows and agent configurations
```

---

## Development

**Package Manager**: npm (package-lock.json)
**Node Version**: 18+ (.nvmrc)

### Commands

| Task | Command |
|---|---|
| Dev Server | `npm run dev` |
| Build | `npm run build` |
| Unit Tests | `npm run test:unit` |
| E2E Tests | `npm run test:e2e` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Type Check | `npm run typecheck` |

### Notes

- The dev server runs Vite with a cleanup script.
- The build uses dotenvx for encrypted environment variables.
- Unit tests use Vitest with happy-dom.
- E2E tests use Playwright.

---

## Deployment

Automatic via GitHub Actions on push to `main`.

**Pipeline**: Build --> Generate Supabase Types --> Smoke Tests --> Deploy to GitHub Pages --> Health Check

**Environment Secrets**: `DOTENV_KEY`, `SUPABASE_ACCESS_TOKEN`

Uses dotenvx for encrypted environment variables.

---

## Active Development (Epics)

| Epic | Name | Status |
|---|---|---|
| 1 | Foundation - Solo Scripture Reading | Completed |
| 2 | Reflection & Daily Prayer Report | In progress (`feature/epic-2-reflection`) |
| 3 | Stats & Overview Dashboard | Planned |
| 4 | Together Mode - Synchronized Reading | Planned |

---

## Git Conventions

**Commit format**: `type(scope): brief description`

| Prefix | Use |
|---|---|
| `feat(epic-N)` | New story implementation |
| `fix(story-N.N)` | Bug fixes for a specific story |
| `test(epic-N)` | QA passes, test additions |
| `docs(epic-N)` | Documentation updates |
| `chore(sprint)` | Sprint tracking, status updates |
| `refactor` | Code restructuring without behavior change |

**Branch strategy**: Feature branches (`feature/epic-N-description`) based off `main`. All epic work stays on its feature branch until PR review.
