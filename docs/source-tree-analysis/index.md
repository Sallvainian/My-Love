# Source Tree Analysis

Complete directory analysis and entry point tracing for the **My-Love** PWA codebase.

## Table of Contents

1. [Technology Stack Summary](./01-technology-stack-summary.md) -- All dependencies categorized by role with pinned versions
2. [Directory Tree](./02-directory-tree.md) -- Complete annotated file tree of src/, supabase/, tests/, scripts/, .github/, public/
3. [Entry Point Trace](./03-entry-point-trace.md) -- Boot sequence: main.tsx -> App.tsx -> views
4. [Critical Code Paths](./04-critical-code-paths.md) -- Highest-impact directories and files with analysis
5. [Shared Modules](./05-shared-modules.md) -- Cross-cutting modules shared across features
6. [Dependency Graph](./06-dependency-graph.md) -- Module dependency relationships and import patterns
7. [File Inventory](./07-file-inventory.md) -- Complete file counts, line counts, and quick reference

## At a Glance

- **Package manager:** npm (lock file: `package-lock.json`)
- **Source directory:** `src/` with 207 TypeScript/TSX files (~45,054 lines)
- **Build output:** `dist/` (Vite production build)
- **Test directories:** `tests/` (E2E, API, integration, unit), co-located `__tests__/` (unit)
- **Supabase:** `supabase/` (24 migrations, 14 pgTAP tests, 1 edge function, config)
- **Documentation:** `docs/` (9 sections: architecture, state management, source tree, API, data models, components, development guide, performance, project overview)
- **GitHub Actions:** `.github/workflows/` (19 workflows)
- **Scripts:** `scripts/` (12 utility scripts)
