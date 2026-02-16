# Source Tree Analysis

Complete directory analysis and entry point tracing for the **My-Love** PWA codebase.

## Table of Contents

1. [Technology Stack Summary](./01-technology-stack-summary.md) — All dependencies categorized by role
2. [Directory Tree](./02-directory-tree.md) — Complete annotated file tree of src/ and supabase/
3. [Entry Point Trace](./03-entry-point-trace.md) — Boot sequence: main.tsx → App.tsx → views
4. [Critical Folders](./04-critical-folders.md) — 6 highest-impact directories with key files
5. [npm Scripts Reference](./05-npm-scripts-reference.md) — All scripts with commands and examples
6. [Source Tree Index](./06-source-tree-index.md) — Quick reference with cross-links and file counts

## At a Glance

- **Package manager:** npm (lock file: `package-lock.json`)
- **Source directory:** `src/` with 150+ TypeScript/TSX files
- **Build output:** `dist/` (Vite production build)
- **Test directories:** `tests/` (E2E), co-located `__tests__/` (unit)
- **Supabase:** `supabase/` (migrations, functions, config)
- **Documentation:** `docs/` (architecture, state management, source tree, API, data models, components)
