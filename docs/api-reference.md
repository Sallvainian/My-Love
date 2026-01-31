# API Reference

> Complete API layer documentation for My-Love project.
> Last updated: 2026-01-30 | Scan level: Deep (Rescan)

## Overview

The API layer (`src/api/`) provides validated CRUD operations against Supabase, with structured error handling, Zod response validation, and real-time subscriptions. 8 source files, 11 database tables.

## Supabase Client (`supabaseClient.ts`)

- Singleton Supabase client with environment configuration
- Exports: `supabase`, `getPartnerId()`, `getPartnerDisplayName()`, `isSupabaseConfigured()`
- JWT authentication with session persistence and auto-refresh
- Dynamic import of authService to avoid circular deps

## Authentication Service (`authService.ts`)

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| signIn | `(credentials: AuthCredentials) => Promise<AuthResult>` | Email/password login |
| signUp | `(credentials: AuthCredentials) => Promise<AuthResult>` | Registration |
| signOut | `() => Promise<void>` | Logout + token cleanup |
| getSession | `() => Promise<Session \| null>` | Get current JWT |
| getUser | `() => Promise<User \| null>` | Get auth user |
| getCurrentUserId | `() => Promise<string \| null>` | User UUID |
| getCurrentUserIdOfflineSafe | `() => Promise<string \| null>` | Offline-safe user ID |
| getAuthStatus | `() => Promise<AuthStatus>` | Comprehensive auth status |
| onAuthStateChange | `(callback) => () => void` | Auth state listener |
| resetPassword | `(email: string) => Promise<AuthError \| null>` | Password reset |
| signInWithGoogle | `() => Promise<AuthError \| null>` | Google OAuth |

### Auth Token Storage

- JWT tokens stored in IndexedDB via `storeAuthToken()` for Background Sync access
- Updated on SIGNED_IN and TOKEN_REFRESHED events
- Cleared on SIGNED_OUT

## Mood API (`moodApi.ts`)

Class-based validated CRUD for mood entries.

| Method | Signature | Description |
|--------|-----------|-------------|
| create | `(moodData: MoodInsert) => Promise<SupabaseMood>` | Insert validated mood |
| fetchByUser | `(userId, limit=50) => Promise<SupabaseMood[]>` | User's recent moods |
| fetchByDateRange | `(userId, start, end) => Promise<SupabaseMood[]>` | Date range query |
| fetchById | `(moodId) => Promise<SupabaseMood \| null>` | Single mood |
| update | `(moodId, updates) => Promise<SupabaseMood>` | Update mood |
| delete | `(moodId) => Promise<void>` | Delete mood |
| getMoodHistory | `(userId, offset=0, limit=50) => Promise<SupabaseMood[]>` | Paginated history |

All responses validated with Zod schemas. Checks `isOnline()` before operations.

## Mood Sync Service (`moodSyncService.ts`)

Real-time mood synchronization with partner.

| Method | Signature | Description |
|--------|-----------|-------------|
| syncMood | `(mood: MoodEntry) => Promise<SupabaseMoodRecord>` | Upload single mood |
| syncPendingMoods | `() => Promise<SyncResult>` | Batch sync from IndexedDB |
| subscribeMoodUpdates | `(callback, onStatusChange?) => Promise<() => void>` | Real-time partner moods |
| fetchMoods | `(userId, limit=50) => Promise<SupabaseMoodRecord[]>` | Get user's moods |
| getLatestPartnerMood | `(userId) => Promise<SupabaseMoodRecord \| null>` | Partner's current mood |

Uses Supabase Broadcast API (not postgres_changes) for real-time updates. Retry: 3 attempts, exponential backoff (1s, 2s, 4s).

## Interaction Service (`interactionService.ts`)

Poke/kiss interactions with real-time updates.

| Method | Signature | Description |
|--------|-----------|-------------|
| sendPoke | `(partnerId: string) => Promise<SupabaseInteractionRecord>` | Send poke |
| sendKiss | `(partnerId: string) => Promise<SupabaseInteractionRecord>` | Send kiss |
| subscribeInteractions | `(callback) => Promise<() => void>` | Real-time incoming |
| getInteractionHistory | `(limit=50, offset=0) => Promise<Interaction[]>` | History |
| getUnviewedInteractions | `() => Promise<Interaction[]>` | Unviewed |
| markAsViewed | `(interactionId) => Promise<void>` | Mark viewed |

Uses `postgres_changes` for INSERT events filtered by `to_user_id`.

## Partner Service (`partnerService.ts`)

Partner connection management.

| Method | Signature | Description |
|--------|-----------|-------------|
| getPartner | `() => Promise<PartnerInfo \| null>` | Current partner info |
| searchUsers | `(query, limit=10) => Promise<UserSearchResult[]>` | Search by name/email |
| sendPartnerRequest | `(toUserId) => Promise<void>` | Send connection request |
| getPendingRequests | `() => Promise<{sent, received}>` | Get all requests |
| acceptPartnerRequest | `(requestId) => Promise<void>` | Accept via RPC |
| declinePartnerRequest | `(requestId) => Promise<void>` | Decline via RPC |
| hasPartner | `() => Promise<boolean>` | Check status |

RPC Functions: `accept_partner_request`, `decline_partner_request`

## Validation Schemas (`validation/supabaseSchemas.ts`)

Zod schemas for all Supabase API responses:

| Schema | Fields |
|--------|--------|
| SupabaseUserSchema | id, email, display_name, partner_id, created_at, updated_at |
| SupabaseMoodSchema | id, user_id, mood_type, mood_types[], note, created_at |
| SupabaseInteractionSchema | id, from_user_id, to_user_id, type, viewed, created_at |
| MoodInsertSchema | user_id, mood_type, mood_types[], note (200 char max) |
| InteractionInsertSchema | from_user_id, to_user_id, type ('poke' \| 'kiss') |

Mood Types: loved, happy, content, excited, thoughtful, grateful, sad, anxious, frustrated, angry, lonely, tired

## Error Handling (`errorHandlers.ts`)

| Export | Type | Description |
|--------|------|-------------|
| SupabaseServiceError | Class | Custom error with code, details, hint, isNetworkError |
| handleSupabaseError | Function | Transform PostgrestError to SupabaseServiceError |
| handleNetworkError | Function | Network error wrapper |
| retryWithBackoff | Function | Exponential backoff (3 attempts, 1s-30s, 2x multiplier) |
| isOnline | Function | Network connectivity check |
| createOfflineMessage | Function | User-friendly offline message |

PostgreSQL Error Mappings: 23505 (unique), 23503 (FK), 23502 (null), 42501 (permission), 42P01 (table), PGRST116 (no rows)

## Real-Time Architecture

| Feature | Mechanism | Channel |
|---------|-----------|---------|
| Partner mood updates | Broadcast API | `mood-updates:{userId}` |
| Incoming interactions | postgres_changes (INSERT) | `incoming-interactions` |
| Love note messages | Broadcast API | `love-notes:{userId}` |

## Database Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| users | User profiles, partner relationships | Yes |
| moods | Emoji mood entries with notes | Yes |
| love_notes | Chat messages between partners | Yes |
| interactions | Poke/kiss interactions | Yes |
| partner_requests | Partner connection workflow | Yes |
| photos | Photo metadata | Yes |
| scripture_sessions | Scripture reading sessions (NEW) | Yes |
| scripture_step_states | Step-level progress tracking (NEW) | Yes |
| scripture_reflections | User reflections on passages (NEW) | Yes |
| scripture_bookmarks | Passage bookmarks (NEW) | Yes |
| scripture_messages | Prayer/report messages (NEW) | Yes |

## RPC Functions

| Function | Parameters | Returns |
|----------|-----------|---------|
| accept_partner_request | p_request_id: string | void |
| decline_partner_request | p_request_id: string | void |
| is_scripture_session_member | p_session_id: string | boolean |
| scripture_seed_test_data | p_session_count, p_include_reflections, p_include_messages, p_preset | JSONB |
