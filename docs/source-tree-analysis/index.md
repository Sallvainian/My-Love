# Source Tree Analysis

## Table of Contents

1. [Technology Stack at a Glance](technology-stack-at-a-glance.md) -- All dependencies with versions and roles
2. [Complete Directory Tree](complete-directory-tree.md) -- Full annotated `src/` tree
3. [Entry Point Trace](entry-point-trace.md) -- Boot sequence from `index.html` to rendered UI
4. [Critical Folders Summary](critical-folders-summary.md) -- Purpose and key files per folder
5. [npm Scripts Reference](npm-scripts-reference.md) -- All scripts with descriptions

## At a Glance

- **Package manager:** npm (lock file: `package-lock.json`)
- **Source directory:** `src/` with 150+ TypeScript/TSX files
- **Build output:** `dist/` (Vite production build)
- **Test directories:** `tests/` (E2E), co-located `__tests__/` (unit)
- **Supabase:** `supabase/` (migrations, functions, config)
- **Documentation:** `docs/` (architecture, state management, source tree)
