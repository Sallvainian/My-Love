# Data Models Reference

## My-Love PWA -- Complete Data Layer Reference

This section documents the entire data layer of the My-Love application, covering the Supabase Postgres schema (tables, columns, constraints, indexes), Row Level Security policies, database functions and RPCs, client-side IndexedDB schema, TypeScript type definitions, Zod validation schemas, and the full migration history.

### Storage Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Supabase Postgres | PostgreSQL 15 | Authoritative data store (users, moods, interactions, love notes, partner requests, photos metadata, scripture reading) |
| Supabase Storage | S3-compatible object storage | Photo files (`photos` bucket), love note images (`love-notes-images` bucket) |
| IndexedDB | `idb` library | Offline-first client cache (messages, photos, moods, auth tokens, scripture sessions/reflections/bookmarks/messages) |
| TypeScript Types | Auto-generated + manual | Type safety across API boundaries |
| Zod Schemas | Zod v4 (4.3.6) | Runtime validation at IndexedDB write and Supabase API response boundaries |

### Documents in This Section

| # | Document | Description |
|---|----------|-------------|
| — | [Table of Contents](./table-of-contents.md) | Detailed outline of all data model sections |
| 1 | [Database Schema Overview](./1-database-schema-overview.md) | 11 Supabase tables, custom enum types, storage buckets |
| 2 | [Supabase Tables](./2-supabase-tables.md) | Column-level detail for all 11 tables (users, moods, love_notes, interactions, partner_requests, photos, scripture_*) |
| 3 | [IndexedDB Stores](./3-indexeddb-stores.md) | `my-love-db` v5: 8 object stores (messages, photos, moods, sw-auth, scripture-*) |
| 4 | [TypeScript Type Definitions](./4-typescript-type-definitions.md) | Generated Supabase types, application types, model types |
| 5 | [Zod Validation Schemas](./5-zod-validation-schemas.md) | Local validation + Supabase API validation schemas |
| 6 | [Supabase RPC Functions](./6-supabase-rpc-functions.md) | 8+ Postgres functions: partner management, scripture CRUD, RLS helpers |
| 7 | [Storage Buckets](./7-storage-buckets.md) | `photos` (10 MB, private) and `love-notes-images` (5 MB, private) bucket configs |
| 8 | [RLS Policies](./8-rls-policies.md) | Row Level Security policies for all tables and storage buckets |
| 9 | [Migration History](./9-migration-history.md) | 12 migrations from 2025-12-03 through 2026-02-06 |
