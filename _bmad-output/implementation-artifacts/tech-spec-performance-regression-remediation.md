---
title: 'Performance Regression Remediation'
slug: 'performance-regression-remediation'
created: '2026-02-07T23:13:00Z'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack:
  - 'TypeScript 5'
  - 'React 19'
  - 'Vite 7'
  - 'Zustand'
  - 'Supabase JS'
  - 'idb (IndexedDB)'
  - 'Zod 4'
  - 'Framer Motion'
  - 'Vitest + Playwright'
files_to_modify:
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/src/stores/slices/settingsSlice.ts'
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/src/data/defaultMessages.ts'
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/src/App.tsx'
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/src/api/authService.ts'
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/src/api/supabaseClient.ts'
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/vite.config.ts'
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/src/components/Navigation/BottomNavigation.tsx'
  - '/Users/sallvain/.codex/worktrees/b241/My-Love/src/hooks/useRealtimeMessages.ts'
code_patterns:
  - 'Feature folders with named exports and barrel files'
  - 'Route-level React.lazy boundaries with Suspense fallbacks'
  - 'Zustand slice architecture with guarded async initialization'
  - 'Supabase singleton service modules and auth utility indirection'
  - 'Build-time chunk partitioning via manualChunks in vite config'
test_patterns:
  - 'Vitest + Testing Library unit tests under src/**/__tests__ and tests/unit/**'
  - 'Heavy use of vi.mock for api/authService and api/supabaseClient in component/hook tests'
  - 'Playwright E2E structure under tests/e2e with priority tagging'
---

# Tech-Spec: Performance Regression Remediation

**Created:** 2026-02-07T23:13:00Z

## Overview

### Problem Statement

The current frontend build shows high initial JavaScript payload and ineffective code splitting around authentication and startup data loading. Measured output from the latest production build indicates a large entry chunk and heavy vendor chunks, which can degrade initial load and interaction responsiveness on constrained networks/devices.

### Solution

Implement a focused remediation pass that (1) establishes reliable build/performance baselines, (2) reduces startup payload by deferring non-critical code/data, and (3) restores effective chunk boundaries where imports currently collapse dynamic splitting.

### Scope

**In Scope:**
- Performance baseline capture from production build artifacts and reproducible commands
- Startup payload reduction (initial route and common app shell)
- Auth-related import-graph cleanup that improves chunking behavior
- Targeted bundle-pressure reductions in heavy dependency paths
- Validation via build output and test runs relevant to touched areas

**Out of Scope:**
- Large feature rewrites unrelated to startup performance
- New product features or UX redesign
- Backend/database performance tuning outside frontend payload/runtime behavior

## Context for Development

### Codebase Patterns

- `vite.config.ts` defines explicit vendor chunk buckets (`vendor-react`, `vendor-supabase`, `vendor-state`, `vendor-animation`, `vendor-icons`) and always emits `dist/stats.html` via rollup visualizer.
- `App.tsx` is the root startup path and currently performs auth check + listener setup using direct `authService` import; this keeps auth code on the startup path.
- `settingsSlice.ts` eagerly imports a large `defaultMessages` dataset and uses it during first-run bootstrap, which can push data into startup bundles.
- `supabaseClient.ts` uses dynamic import for `authService`, but this is undermined by widespread static imports of `authService` in app/components/slices.
- `project-context.md` enforces strict constraints relevant to this work: no react-router migration, keep `injectManifest` runtime behavior in `src/sw.ts`, and treat `src/types/database.types.ts` as generated.
- Test suites rely on module-level mocking of `authService` and `supabaseClient`; auth import/interface changes need synchronized test updates.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/vite.config.ts` | Chunk strategy and build plugin behavior |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/src/App.tsx` | Startup app shell, lazy boundaries, auth at app bootstrap |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/src/stores/slices/settingsSlice.ts` | First-run initialization and default message seeding |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/src/api/authService.ts` | Auth API surface causing broad eager imports |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/src/api/supabaseClient.ts` | Dynamic auth import path and chunking warning context |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/src/components/Navigation/__tests__/BottomNavigation.test.tsx` | Auth service mocking pattern in component tests |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/src/hooks/__tests__/useRealtimeMessages.test.ts` | Supabase/auth mocking pattern in hook tests |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/_bmad-output/project-context.md` | Canonical project rules and architecture constraints |
| `/Users/sallvain/Projects/My-Love/dist/stats.html` | Measured bundle graph for current commit (same HEAD) |
| `/Users/sallvain/.codex/worktrees/b241/My-Love/_bmad-output/planning-artifacts/prd/non-functional-requirements.md` | Latency and responsiveness NFR targets |

### Technical Decisions

- Use measured build evidence from `/Users/sallvain/Projects/My-Love` for this commit because this worktree currently lacks installable runtime prerequisites (empty `node_modules`, dotenv private key unavailable, and `tsc` blocked by generated types file issue).
- Treat the Vite warning about mixed dynamic/static `authService` imports as a hard anchor for import-graph remediation.
- Prioritize startup JS reductions with lowest architecture risk: defer seed data load, reduce eager auth dependency fan-out, then trim heavy dependency surfaces.
- Preserve existing architectural constraints (no router migration, no broad state architecture rewrite).

## Implementation Plan

### Tasks

- [x] Task 1: Establish reproducible performance baseline artifacts
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/package.json`
  - Action: Add non-deploy scripts for perf baseline capture (`perf:build`, `perf:bundle-report`) that run `vite build` and preserve key chunk-size output in a markdown artifact.
  - Notes: Keep existing `build` command unchanged; baseline scripts are additive and must not require decrypted production secrets.
- [x] Task 2: Add baseline report document with measured numbers and guardrails
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/docs/performance/baseline.md` (new)
  - Action: Record current measured chunk sizes (entry and vendor chunks), build warnings, and target thresholds for the remediation cycle.
  - Notes: Seed with current known measurements from `/Users/sallvain/Projects/My-Love` at commit `f75703fdcfb18866be39ffe95cb26c3cca6d9612`.
- [x] Task 3: Defer default message dataset loading to first-run path only
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/stores/slices/settingsSlice.ts`
  - Action: Remove top-level `defaultMessages` static import and replace with `await import('../../data/defaultMessages')` inside the `storedMessages.length === 0` branch.
  - Notes: Keep existing behavior identical for message creation and IDs; only loading timing changes.
- [x] Task 4: Introduce explicit loader helper for seed messages
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/data/defaultMessagesLoader.ts` (new)
  - Action: Create a single-purpose async loader function that returns seed messages via dynamic import to avoid repeated inline import logic.
  - Notes: `settingsSlice` must consume this helper; helper must return typed message data.
- [x] Task 5: Split auth module by responsibility to restore chunk boundaries
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/api/auth/sessionService.ts` (new)
  - Action: Move read/session-centric methods (`getSession`, `getUser`, `getCurrentUserId`, `getCurrentUserIdOfflineSafe`, `getAuthStatus`, `onAuthStateChange`) into this module.
  - Notes: Keep signatures unchanged to minimize call-site churn.
- [x] Task 6: Move write/interactive auth actions into separate module
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/api/auth/actionService.ts` (new)
  - Action: Move `signIn`, `signUp`, `signOut`, `resetPassword`, `signInWithGoogle` into action-focused module.
  - Notes: Preserve token persistence behavior (`storeAuthToken`, `clearAuthToken`) exactly.
- [x] Task 7: Convert compatibility facade and update imports to reduced surfaces
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/api/authService.ts`
  - Action: Replace monolithic implementation with composition facade re-exporting session + action services; migrate hot-path imports to direct module paths where possible.
  - Notes: Prioritize startup-path files first (`App.tsx`, store slices, always-mounted components).
- [x] Task 8: Update startup and always-mounted UI to avoid eager action-service dependency
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/App.tsx`
  - Action: Import session-only auth surface for bootstrap/auth-listener logic; keep login and profile setup behavior intact.
  - Notes: Ensure no behavioral regressions in auth-loading and display-name flow.
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/components/Navigation/BottomNavigation.tsx`
  - Action: Replace direct `authService` import with an `onSignOut` callback prop wired from the parent.
  - Notes: This removes eager action-service import from always-mounted navigation.
- [x] Task 9: Trim zod bundle pressure by using narrower import surface
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/validation/schemas.ts`
  - Action: Switch from top-level `zod` import path to the minimal supported import path used project-wide, then apply same change to other zod-using modules.
  - Notes: Validate compatibility with existing `ZodError` and schema APIs before mass change; if any module breaks, keep it on legacy import path and document exception.
- [x] Task 10: Defer framer-motion feature bundle where feasible
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/components/scripture-reading/containers/SoloReadingFlow.tsx`
  - Action: Introduce `LazyMotion` with explicit feature bundle loading for this heavy interactive surface.
  - Notes: Preserve `prefers-reduced-motion` behavior and existing animation semantics.
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/hooks/useMotionConfig.ts`
  - Action: Ensure motion configuration remains compatible with deferred feature loading.
  - Notes: Keep exported API unchanged.
- [x] Task 11: Update unit tests affected by auth-service and navigation API changes
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/components/Navigation/__tests__/BottomNavigation.test.tsx`
  - Action: Replace `authService` mock expectations with callback-prop assertions for sign-out behavior.
  - Notes: Maintain existing `data-testid` and accessibility assertions.
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/src/hooks/__tests__/useRealtimeMessages.test.ts`
  - Action: Update mock import target if hook migrates to session-service module.
  - Notes: Preserve existing retry/backoff coverage.
- [x] Task 12: Re-run and document post-change metrics
  - File: `/Users/sallvain/.codex/worktrees/b241/My-Love/docs/performance/baseline.md`
  - Action: Append before/after chunk sizes, warning deltas, and pass/fail status against thresholds.
  - Notes: Include explicit note if full `npm run build` remains blocked by generated types in local environment.

### Acceptance Criteria

- [ ] AC 1: Given the current codebase at baseline, when `npx vite build` is executed in an environment with dependencies installed, then the generated report includes chunk-size measurements for `index`, `vendor-supabase`, `vendor-animation`, and `vendor-state`.
- [ ] AC 2: Given a first-run user with no IndexedDB messages, when `initializeApp` runs, then default messages are populated exactly once and message content/count matches pre-change behavior.
- [ ] AC 3: Given a returning user with existing IndexedDB messages, when `initializeApp` runs, then no default-message dynamic import is triggered and startup behavior remains unchanged.
- [ ] AC 4: Given auth bootstrap on app load, when `App.tsx` initializes auth state, then session detection and auth-state change handling behave identically to current behavior.
- [ ] AC 5: Given the bottom navigation is rendered, when logout is triggered, then sign-out still executes successfully without direct `authService` import inside `BottomNavigation.tsx`.
- [ ] AC 6: Given the updated auth module split, when build artifacts are analyzed, then the prior Vite warning about ineffective dynamic import of `authService` is removed or reduced with documented explanation.
- [ ] AC 7: Given zod import narrowing is applied, when `npx vite build` completes, then `vendor-state` gzip size is lower than baseline or unchanged with documented blocker.
- [ ] AC 8: Given framer-motion deferral is applied, when `npx vite build` completes, then `vendor-animation` gzip size or initial chunk pressure is reduced with no runtime animation errors in scripture flow.
- [ ] AC 9: Given updated test files, when affected unit tests run, then auth/navigation/realtime test suites pass without reducing existing assertion coverage.
- [ ] AC 10: Given documentation updates are complete, when reviewing `docs/performance/baseline.md`, then before/after metrics and residual risks are clearly stated with exact numbers.

## Additional Context

### Dependencies

- Runtime dependencies already present in project:
  - `react`, `react-dom`, `zustand`, `@supabase/supabase-js`, `zod`, `framer-motion`, `idb`
- Build/analysis dependencies already present in project:
  - `vite`, `vite-plugin-pwa`, `rollup-plugin-visualizer`, `typescript`
- Environmental dependencies and constraints:
  - Local `npm run build` requires decryptable dotenv values and valid generated `src/types/database.types.ts`
  - Current worktree does not have populated `node_modules`, so reproducible measurement commands must run in an install-ready checkout

### Testing Strategy

- Unit tests:
  - Update and run `BottomNavigation` tests for callback-based logout behavior.
  - Update and run `useRealtimeMessages` tests if auth import surface changes.
  - Add/adjust a settings-slice unit test that verifies default-message loader is only invoked on empty storage.
- Build validation:
  - Run `npx vite build` and record chunk table + warnings.
  - Run `npm run build` where environment is fully configured; if blocked, capture blocker details in docs.
- Integration/manual checks:
  - Manual auth smoke: load app logged-out, sign in, sign out, refresh, verify session continuity.
  - Manual data smoke: first-run with empty IndexedDB seeds messages; returning run skips seed path.
  - Manual scripture motion smoke: open scripture flow and confirm animations still function with reduced-motion support.
- Regression monitoring:
  - Compare `docs/performance/baseline.md` before/after numbers and warn if entry gzip grows.

### Notes

- Known high-risk area: auth module split touches many import sites; keep function signatures stable and migrate incrementally.
- Known blocker: `src/types/database.types.ts` is currently invalid in this workspace and is generated code; remediation may require regeneration outside this scope.
- Known environment gap: this worktree lacks fully installed dependencies and dotenv private key; baseline measurements must use an equivalent checkout at same commit.
- Out-of-scope follow-up worth tracking: if startup chunk remains high after these changes, evaluate deeper store-slice lazy initialization and scripture data/code partitioning.

## Step 06 Review Notes (Automated)

- Date: 2026-02-08
- Approach: `auto-fix`
- Findings total: 10
- Findings fixed: 10
- Findings skipped: 0
- Validation run:
  - `npx vitest run src/components/Navigation/__tests__/BottomNavigation.test.tsx src/hooks/__tests__/useRealtimeMessages.test.ts tests/unit/stores/settingsSlice.initializeApp.test.ts src/api/auth/__tests__/authServices.test.ts`
  - `npm run typecheck`
  - `npm run perf:bundle-report`
- Residual risks:
  - `npm run lint` still reports pre-existing project-wide lint issues outside this remediation scope.
