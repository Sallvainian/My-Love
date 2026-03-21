# Deferred Work

## From: Mood Tracker State Issues (2026-03-20)

- ~~**Calendar vs Timeline date grouping mismatch (UTC vs local)**~~ — Picked up in A+B patch
- ~~**Stale visit events on Home dashboard**~~ — Superseded by dynamic events feature (Goal C)

## From: A+B Patch (2026-03-20)

- **Dynamic events system** — Replace hardcoded home dashboard event cards with user-managed events. New Supabase table, CRUD UI for adding/editing/deleting events, dynamic timer cards that auto-hide when passed. Full feature build: DB migration → service → store slice → UI components.
