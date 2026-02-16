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

- [Table of Contents](./table-of-contents.md) -- Detailed outline of all data model sections
- [1. Database Schema Overview](./1-database-schema-overview.md)
  - [Supabase Tables](./1-database-schema-overview.md#supabase-tables) -- 11 tables across core and scripture features
  - [Custom Enum Types](./1-database-schema-overview.md#custom-enum-types) -- `scripture_session_mode`, `scripture_session_phase`, `scripture_session_status`
  - [Storage Buckets](./1-database-schema-overview.md#storage-buckets) -- `photos` (10 MB, private), `love-notes-images` (5 MB, private)
- [2. Table Details](./2-table-details.md)
  - [2.1 `users`](./2-table-details.md#21-users) -- User profiles linked 1:1 with Supabase Auth
  - [2.2 `moods`](./2-table-details.md#22-moods) -- Mood tracking with 12 mood types
  - [2.3 `love_notes`](./2-table-details.md#23-love_notes) -- Partner messages with optional image attachments
  - [2.4 `interactions`](./2-table-details.md#24-interactions) -- Poke/kiss interactions with read tracking
  - [2.5 `partner_requests`](./2-table-details.md#25-partner_requests) -- Partner invitation workflow
  - [2.6 `photos`](./2-table-details.md#26-photos) -- Photo metadata (files in Storage bucket)
  - [2.7 `scripture_sessions`](./2-table-details.md#27-scripture_sessions) -- Scripture reading sessions (solo/together)
  - [2.8 `scripture_step_states`](./2-table-details.md#28-scripture_step_states) -- Step synchronization for together mode
  - [2.9 `scripture_reflections`](./2-table-details.md#29-scripture_reflections) -- Per-step user reflections with 1-5 rating
  - [2.10 `scripture_bookmarks`](./2-table-details.md#210-scripture_bookmarks) -- Bookmarked reading steps
  - [2.11 `scripture_messages`](./2-table-details.md#211-scripture_messages) -- Prayer report messages
- [3. Row Level Security Policies](./3-row-level-security-policies.md)
  - [3.1 `users`](./3-row-level-security-policies.md#31-users) -- Self + partner visibility, safe update preventing `partner_id` manipulation
  - [3.2 `moods`](./3-row-level-security-policies.md#32-moods) -- Own + partner read, own-only write
  - [3.3 `love_notes`](./3-row-level-security-policies.md#33-love_notes) -- Sender/recipient read, sender-only insert
  - [3.4 `interactions`](./3-row-level-security-policies.md#34-interactions) -- Participant read, sender insert, recipient update (mark viewed)
  - [3.5 `partner_requests`](./3-row-level-security-policies.md#35-partner_requests) -- Participant read, sender insert, recipient update
  - [3.6 `photos`](./3-row-level-security-policies.md#36-photos) -- Own + partner read, own-only insert/delete
  - [3.7 `photos` Storage Bucket](./3-row-level-security-policies.md#37-photos-storage-bucket-storageobjects) -- Path-based folder isolation
  - [3.8 `love-notes-images` Storage Bucket](./3-row-level-security-policies.md#38-love-notes-images-storage-bucket-storageobjects) -- Extension-validated uploads
  - [3.9 `scripture_sessions`](./3-row-level-security-policies.md#39-scripture_sessions) -- Session member read/update, creator insert
  - [3.10 `scripture_step_states`](./3-row-level-security-policies.md#310-scripture_step_states) -- Session member access via helper function
  - [3.11 `scripture_reflections`](./3-row-level-security-policies.md#311-scripture_reflections) -- Own + shared visibility, own-only write
  - [3.12 `scripture_bookmarks`](./3-row-level-security-policies.md#312-scripture_bookmarks) -- Own + shared visibility, own-only CRUD
  - [3.13 `scripture_messages`](./3-row-level-security-policies.md#313-scripture_messages) -- Session member read, sender insert
- [4. Relationships](./4-relationships.md)
  - [Entity Relationship Summary](./4-relationships.md#entity-relationship-summary) -- Visual table relationship map
  - [Foreign Key Details](./4-relationships.md#foreign-key-details) -- All FK constraints with cascade behavior
- [5. Database Functions and RPCs](./5-database-functions-and-rpcs.md)
  - [5.1 `get_partner_id()`](./5-database-functions-and-rpcs.md#51-get_partner_iduser_id-uuid---uuid) -- Partner ID lookup (deprecated)
  - [5.2 `accept_partner_request()`](./5-database-functions-and-rpcs.md#52-accept_partner_requestp_request_id-uuid---void) -- Atomic partner linking
  - [5.3 `decline_partner_request()`](./5-database-functions-and-rpcs.md#53-decline_partner_requestp_request_id-uuid---void) -- Decline pending request
  - [5.4 `sync_user_profile()`](./5-database-functions-and-rpcs.md#54-sync_user_profile---trigger) -- Auth-to-users profile sync trigger
  - [5.5 `is_scripture_session_member()`](./5-database-functions-and-rpcs.md#55-is_scripture_session_memberp_session_id-uuid---boolean) -- RLS helper for scripture tables
  - [5.6 `scripture_create_session()`](./5-database-functions-and-rpcs.md#56-scripture_create_sessionp_mode-text-p_partner_id-uuid-default-null---jsonb) -- Create solo/together session
  - [5.7 `scripture_submit_reflection()`](./5-database-functions-and-rpcs.md#57-scripture_submit_reflectionp_session_id-p_step_index-p_rating-p_notes-p_is_shared---jsonb) -- Idempotent reflection upsert
  - [5.8 `scripture_seed_test_data()`](./5-database-functions-and-rpcs.md#58-scripture_seed_test_data---jsonb) -- Test data seeding (non-production)
- [6. IndexedDB Schema](./6-indexeddb-schema.md)
  - [Database Configuration](./6-indexeddb-schema.md#database-configuration) -- `my-love-db`, version 5
  - [Object Stores](./6-indexeddb-schema.md#object-stores)
    - [6.1 `messages`](./6-indexeddb-schema.md#61-messages) -- Custom love messages with category indexes
    - [6.2 `photos`](./6-indexeddb-schema.md#62-photos) -- Compressed photo blobs and metadata
    - [6.3 `moods`](./6-indexeddb-schema.md#63-moods) -- Mood entries with sync tracking
    - [6.4 `sw-auth`](./6-indexeddb-schema.md#64-sw-auth) -- Service Worker auth tokens
    - [6.5 `scripture-sessions`](./6-indexeddb-schema.md#65-scripture-sessions) -- Cached scripture sessions
    - [6.6 `scripture-reflections`](./6-indexeddb-schema.md#66-scripture-reflections) -- Cached reflections
    - [6.7 `scripture-bookmarks`](./6-indexeddb-schema.md#67-scripture-bookmarks) -- Cached bookmarks
    - [6.8 `scripture-messages`](./6-indexeddb-schema.md#68-scripture-messages) -- Cached prayer messages
  - [Version History](./6-indexeddb-schema.md#version-history) -- v1 through v5 changelog
- [7. TypeScript Type Definitions](./7-typescript-type-definitions.md)
  - [7.1 Generated Supabase Types (`database.types.ts`)](./7-typescript-type-definitions.md#71-generated-supabase-types-databasetypests) -- Row, Insert, Update types for all tables
  - [7.2 Application Types (`types/index.ts`)](./7-typescript-type-definitions.md#72-application-types-typesindexts) -- ThemeName, MessageCategory, MoodType, Settings, AppState
  - [7.3 Supabase Model Types (`types/models.ts`)](./7-typescript-type-definitions.md#73-supabase-model-types-typesmodelsts) -- LoveNote, Scripture types, Zustand store shapes
- [8. Validation Schemas](./8-validation-schemas.md)
  - [8.1 Local Validation Schemas (`validation/schemas.ts`)](./8-validation-schemas.md#81-local-validation-schemas-validationschemasts) -- MessageSchema, PhotoSchema, MoodEntrySchema, SettingsSchema, Scripture schemas
  - [8.2 Supabase API Validation Schemas (`api/validation/supabaseSchemas.ts`)](./8-validation-schemas.md#82-supabase-api-validation-schemas-apivalidationsupabaseschemasts) -- User, Mood, Interaction, Photo, Message schemas with array variants
- [9. Migration History](./9-migration-history.md) -- 12 migrations from 2025-12-03 through 2026-02-06
