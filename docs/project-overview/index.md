# Project Overview

Documentation for the My-Love Progressive Web App -- a couples app for daily love messages, mood tracking, photo sharing, love notes chat, scripture reading, and partner interactions.

**Live URL**: [https://sallvainian.github.io/My-Love/](https://sallvainian.github.io/My-Love/)

**Repository**: [https://github.com/Sallvainian/My-Love](https://github.com/Sallvainian/My-Love)

## Contents

1. [Key Features](./key-features.md) -- All application features with data patterns, storage layers, and realtime channels
2. [Technology Stack](./technology-stack.md) -- Complete dependency inventory with pinned versions and rationale
3. [Architecture](./architecture.md) -- High-level data flow, state management, offline strategy, and key decisions
4. [Repository Structure](./repository-structure.md) -- Annotated directory layout of all project files
5. [Deployment](./deployment.md) -- GitHub Pages deployment, CI/CD workflows, health checks
6. [Development](./development.md) -- Local setup, all commands, testing tiers, Supabase workflow
7. [Git Conventions](./git-conventions.md) -- Branching strategy, commit format, PR workflow, CI rules
8. [Active Development Epics](./active-development-epics.md) -- Epic/story status from BMAD planning artifacts

## At a Glance

| Dimension        | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| Framework        | React 19.2.4 + TypeScript 5.9.3                         |
| Build Tool       | Vite 7.3.1 with manual chunk splitting                  |
| State Management | Zustand 5.0.11 (single store, 11 slices, persist)       |
| Backend          | Supabase 2.99.0 (Auth, Postgres, Storage, Realtime)     |
| Styling          | Tailwind CSS 4.2.1 with 4 custom themes                 |
| Validation       | Zod 4.3.6 at all service boundaries                     |
| Local Storage    | IndexedDB via idb 8.0.3 (8 object stores, schema v5)    |
| PWA              | Custom InjectManifest SW with Workbox + Background Sync |
| Testing          | Vitest 4.0.17 (unit) + Playwright 1.58.2 (E2E) + pgTAP  |
| Deployment       | GitHub Pages at `/My-Love/` via GitHub Actions          |
| Secrets          | fnox with age encryption provider                       |
| Source Files     | 207 TypeScript/TSX files, ~45,054 lines in src/         |
| Migrations       | 24 SQL migrations in supabase/migrations/               |
| CI Workflows     | 19 GitHub Actions workflows                             |
