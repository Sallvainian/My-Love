# Data Models Reference

## My-Love PWA -- Complete Data Layer Reference

Complete documentation of all data models, database schemas, validation rules, and storage architecture used in the My Love PWA.

## Sections

1. [Database Schema Overview](./1-database-schema-overview.md)
2. [Supabase Tables](./2-supabase-tables.md)
3. [IndexedDB Stores](./3-indexeddb-stores.md)
4. [TypeScript Type Definitions](./4-typescript-type-definitions.md)
5. [Zod Validation Schemas](./5-zod-validation-schemas.md)
6. [Supabase RPC Functions](./6-supabase-rpc-functions.md)
7. [Storage Buckets](./7-storage-buckets.md)
8. [RLS Policies](./8-rls-policies.md)
9. [Migration History](./9-migration-history.md)

## Data Architecture Overview

```
Client (Browser)
  |
  |-- IndexedDB ('my-love-db', v5)
  |     |-- messages      (custom love messages, local-only)
  |     |-- photos        (local photo blobs, local-only)
  |     |-- moods         (offline-first, synced to Supabase)
  |     |-- sw-auth       (JWT token for Background Sync)
  |     |-- scripture-*   (cache layer for Supabase data)
  |
  |-- localStorage
  |     |-- Settings, theme preferences
  |     |-- Supabase auth session (managed by SDK)
  |
Server (Supabase)
  |
  |-- PostgreSQL (10 tables, RLS on all)
  |     |-- users, moods, love_notes, interactions, partner_requests
  |     |-- photos (metadata), scripture_sessions, scripture_step_states
  |     |-- scripture_reflections, scripture_bookmarks, scripture_messages
  |
  |-- Storage (2 private buckets)
  |     |-- photos (user photo uploads)
  |     |-- love-notes-images (chat image attachments)
  |
  |-- Auth (email/password + Google OAuth)
  |
  |-- Realtime (postgres_changes + Broadcast API)
  |
  |-- Edge Functions (upload-love-note-image)
```

## Key Patterns

- **Offline-first moods:** Moods are written to IndexedDB first, then synced to Supabase. Background Sync handles sync when app is closed.
- **Cache-first scripture:** Scripture data is cached in IndexedDB but Supabase is the source of truth. Reads return cache immediately, then refresh from server in the background.
- **Write-through photos:** Photo uploads go to Supabase Storage first, then metadata to the photos table. Rollback on failure.
- **Local-only messages:** Custom love messages live exclusively in IndexedDB. Not synced to server.
