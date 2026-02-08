# Critical Folders Summary

## `src/api/` -- Server Communication Layer

All Supabase interactions are centralized here. The `supabaseClient.ts` singleton is imported by every other module in this folder. Authentication (`authService.ts`), mood tracking (`moodApi.ts`, `moodSyncService.ts`), partner data (`partnerService.ts`), and playful interactions (`interactionService.ts`) each have dedicated modules. The `validation/` subfolder uses Zod schemas to validate data arriving from Supabase before it enters the application.

## `src/components/` -- UI Component Library

Contains 26 feature folders, each encapsulating a self-contained UI feature with its own components, styles, and colocated tests. Follows a feature-folder pattern rather than atomic design. The `scripture-reading/` folder is the most complex, implementing Epic 2 with container, reading, and reflection subfolders. The `shared/` folder holds cross-cutting components used across multiple features (network status indicator, sync toast).

## `src/hooks/` -- Custom React Hooks

Twelve hooks abstract reusable behavior from components. Network-related hooks (`useNetworkStatus`, `useRealtimeMessages`, `usePartnerMood`) handle Supabase realtime subscriptions. Data hooks (`useMoodHistory`, `usePhotos`, `useLoveNotes`) manage fetching, caching, and pagination. Utility hooks (`useVibration`, `useImageCompression`, `useAutoSave`, `useMotionConfig`) wrap browser APIs.

## `src/services/` -- Business Logic Layer

Fourteen service modules implement data persistence and business operations independent of React. `BaseIndexedDBService.ts` provides a generic IndexedDB abstraction used by `photoStorageService.ts` and `moodService.ts` for offline storage. `syncService.ts` orchestrates the offline-to-online reconciliation flow. `scriptureReadingService.ts` handles all scripture session and reflection persistence for Epic 2.

## `src/stores/` -- State Management

A single Zustand store (`useAppStore.ts`) is composed from 10 slices using the slice pattern. Each slice owns a focused domain: navigation routing, mood tracking, photo gallery state, love notes, partner mood, user settings, and scripture reading. The store uses `persist` middleware to survive page reloads via localStorage.

## `src/utils/` -- Pure Utility Functions

Sixteen stateless utility modules covering date manipulation, calendar generation, countdown math, message rotation, mood-to-emoji mapping, haptic feedback, theme application, background sync registration, offline error handling, storage quota monitoring, and performance tracking. All functions are pure or wrap thin browser APIs.

## `src/validation/` -- Data Validation

Zod schemas (`schemas.ts`) define the shape and constraints for all domain objects. Validation error messages (`errorMessages.ts`) provide user-facing strings. The barrel `index.ts` re-exports everything for clean imports.

## `supabase/` -- Backend Infrastructure

Nine sequential SQL migrations define the entire database schema, from base tables through security fixes to Epic 2 scripture tables. The `functions/` folder contains a Supabase Edge Function for love note image uploads. `config.toml` configures local development with `supabase start`.

## `tests/` -- Test Suite

Three test tiers: unit tests (Vitest + Testing Library + happy-dom), E2E tests (Playwright), and API integration tests. The `support/` folder provides shared factories, fixtures, and helpers. E2E tests are organized by feature area matching the component folder structure. Scripture reading has the most comprehensive E2E coverage with 7 spec files testing functionality, accessibility, and security.

## `scripts/` -- Developer Automation

Nine scripts for development workflow automation. `dev-with-cleanup.sh` and `test-with-cleanup.sh` manage orphan processes. `ci-local.sh` simulates the full CI pipeline locally. `burn-in.sh` runs extended stability tests. `validate-messages.cjs` and `post-deploy-check.cjs` verify data integrity and deployment health.

## `.github/` -- CI/CD and AI Agents

Five GitHub Actions workflows cover testing, deployment, database migrations, and AI-assisted development. Ten BMAD Method agent configurations enable AI-driven project management roles (analyst, architect, developer, PM, scrum master, test architect, tech writer, UX designer, and an orchestrator). CodeQL and Dependabot provide security scanning and dependency updates.

## `_bmad/` and `_bmad-output/` -- BMAD Method Artifacts

The BMAD (Build Measure Analyze Deliver) Method drives the project's development process. `_bmad/` holds the method configuration and knowledge base. `_bmad-output/` contains all planning artifacts (PRD, architecture, epics, UX specs) and implementation artifacts tracking each story's progress across two epics. `sprint-status.yaml` tracks the current sprint state.

---
