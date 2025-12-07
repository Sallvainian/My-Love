# Story 3.0: Push Notification & Daily Messages Schema Setup

Status: done

## Story

As a **developer**,
I want **database tables and schema for push notifications and daily love messages**,
so that **subsequent stories can store subscriptions, send notifications, and retrieve daily messages**.

## Acceptance Criteria

1. **AC1**: `push_subscriptions` table created with columns: id (UUID), user_id (FK), endpoint (TEXT), p256dh (TEXT), auth (TEXT), device_info (JSONB), created_at, updated_at, last_used_at
2. **AC2**: Unique constraint on (user_id, endpoint) to prevent duplicate subscriptions per device
3. **AC3**: `daily_love_messages` table created with columns: id (UUID), content (TEXT), category (TEXT), created_by (FK nullable), is_default (BOOLEAN), created_at
4. **AC4**: At least 8 default daily love messages seeded across categories (morning, general, affection, affirmation, longing, romantic, appreciation)
5. **AC5**: `notifications` table created for in-app history with columns: id, user_id, type, title, body, data (JSONB), read (BOOLEAN), created_at, expires_at (30-day auto-cleanup)
6. **AC6**: RLS policies enforce user-scoped access for all tables
7. **AC7**: Service role policy allows reading push_subscriptions for sending notifications
8. **AC8**: VAPID keys generated and documented (public key for client, private key for Edge Functions)
9. **AC9**: TypeScript types regenerated via `supabase gen types typescript --local` and type-check passes
10. **AC10**: Migration runs successfully on local Supabase instance

## Tasks / Subtasks

- [x] Task 1: Generate VAPID keys (AC: #8)
  - [x] 1.1: Install web-push CLI: `npm install -g web-push`
  - [x] 1.2: Generate keys: `web-push generate-vapid-keys`
  - [x] 1.3: Add `VITE_VAPID_PUBLIC_KEY` to `.env.example` with placeholder
  - [x] 1.4: Document VAPID key storage in `docs/02-Architecture/secrets.md` (DO NOT commit actual keys)
  - [x] 1.5: Add VAPID keys to local Supabase secrets: `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...`

- [x] Task 2: Create database migration file (AC: #1, #2, #3, #5, #6, #7)
  - [x] 2.1: Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_push_notifications_schema.sql`
  - [x] 2.2: Implement `push_subscriptions` table with all columns and constraints
  - [x] 2.3: Create indexes: `idx_push_subscriptions_user_id`, `idx_push_subscriptions_endpoint`
  - [x] 2.4: Implement `daily_love_messages` table with constraint `chk_custom_has_creator`
  - [x] 2.5: Implement `notifications` table with `expires_at` default (NOW + 30 days)
  - [x] 2.6: Create indexes: `idx_notifications_user_id`, `idx_notifications_read`, `idx_notifications_expires`
  - [x] 2.7: Enable RLS on all three tables
  - [x] 2.8: Create RLS policy: "Users can manage their own subscriptions" on push_subscriptions
  - [x] 2.9: Create RLS policy: "Service role can read all subscriptions" on push_subscriptions
  - [x] 2.10: Create RLS policy: "Anyone can read default messages" on daily_love_messages
  - [x] 2.11: Create RLS policy: "Users can manage their custom messages" on daily_love_messages
  - [x] 2.12: Create RLS policy: "Users can manage their notifications" on notifications

- [x] Task 3: Seed default daily love messages (AC: #4)
  - [x] 3.1: Add INSERT statements for 8+ default messages across categories
  - [x] 3.2: Categories to include: morning, general, affection, affirmation, longing, romantic, appreciation
  - [x] 3.3: Ensure `is_default = true` for all seeded messages

- [x] Task 4: Apply migration and regenerate types (AC: #9, #10)
  - [x] 4.1: Run migration: `supabase db push` (local) or `supabase migration up`
  - [x] 4.2: Verify tables exist: `supabase db diff`
  - [x] 4.3: Regenerate TypeScript types: `supabase gen types typescript --local > src/types/database.types.ts`
  - [x] 4.4: Run typecheck: `npm run typecheck`
  - [x] 4.5: Verify new types include `push_subscriptions`, `daily_love_messages`, `notifications`

- [x] Task 5: Verify RLS policies (AC: #6, #7)
  - [x] 5.1: Test user can only see own push_subscriptions via RLS
  - [x] 5.2: Test user can read default daily_love_messages
  - [x] 5.3: Test user can only see own notifications
  - [x] 5.4: Verify service_role can read all push_subscriptions

## Dev Notes

### Architecture Patterns

**Database Convention** [Source: docs/02-Architecture/architecture.md]:
- All tables use UUID primary keys with `gen_random_uuid()`
- Foreign keys reference `auth.users(id)` with `ON DELETE CASCADE`
- Timestamps use `TIMESTAMPTZ` with `DEFAULT NOW()`
- RLS enabled on all public tables

**RLS Pattern** [Source: supabase/migrations/20251203000001_create_base_schema.sql]:
```sql
-- Standard user-scoped policy pattern
CREATE POLICY "Users can [action] own [resource]"
  ON table_name
  FOR [SELECT|INSERT|UPDATE|DELETE|ALL]
  USING (auth.uid() = user_id);
```

**Index Convention** [Source: supabase/migrations/20251203000001_create_base_schema.sql]:
- Name format: `idx_{table}_{column(s)}`
- Always index foreign keys used in queries
- Index columns used in WHERE clauses

### Schema Details

**push_subscriptions Table**:
```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,       -- Public key for encryption
  auth TEXT NOT NULL,         -- Auth secret for encryption
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)   -- One subscription per device per user
);
```

**daily_love_messages Table**:
```sql
CREATE TABLE daily_love_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_by UUID REFERENCES auth.users(id),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_custom_has_creator CHECK (is_default = true OR created_by IS NOT NULL)
);
```

**notifications Table**:
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,         -- 'love_note', 'daily_message', 'partner_mood'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);
```

### VAPID Keys

**What are VAPID keys?**
- VAPID (Voluntary Application Server Identification) authenticates push notifications
- Public key: Used by client to subscribe to push service
- Private key: Used by server to sign push requests (NEVER expose to client)

**Storage**:
- `VITE_VAPID_PUBLIC_KEY`: In `.env` (safe for client)
- `VAPID_PRIVATE_KEY`: In Supabase Edge Function secrets (server-only)
- `VAPID_SUBJECT`: `mailto:` URL identifying the application operator

### Epic 2 Learnings Applied

[Source: docs/11-Retrospectives/epic-2-retrospective-2025-12-03.md]:
- **Broadcast API Pattern**: Story 3.3+ will use channel pattern `notifications:${userId}` (not postgres_changes)
- **DOMPurify Sanitization**: Daily messages displayed to users should be sanitized
- **Rate Limiting**: Edge Functions should implement rate limiting on push sends

### Testing Considerations

**Unit Tests** (not in scope for this story):
- Schema validation is done via migration success
- Type generation validates schema matches types

**Manual Verification**:
1. Connect to local Supabase: `supabase db reset && supabase start`
2. Verify tables in Studio: `supabase studio`
3. Test RLS policies via SQL editor

### Project Structure Notes

**Migration file location**: `supabase/migrations/`
- Follow naming: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Example: `20251206120000_push_notifications_schema.sql`

**Types location**: `src/types/database.types.ts`
- Auto-generated, DO NOT edit manually
- Regenerate after any schema change

**Secrets documentation**: `docs/02-Architecture/secrets.md` (create if not exists)
- Document all environment variables
- Never commit actual secret values

### References

- [Source: docs/05-Epics-Stories/tech-spec-epic-3.md#Database Schema]
- [Source: docs/05-Epics-Stories/epics.md#Story 3.0]
- [Source: docs/02-Architecture/architecture.md#Database Layer]
- [Source: supabase/migrations/20251203000001_create_base_schema.sql]
- [Web Push Protocol RFC 8030](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Spec RFC 8292](https://datatracker.ietf.org/doc/html/rfc8292)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- 2025-12-07: All 10 ACs verified and complete
- Migration file: `supabase/migrations/20251207010523_push_notifications_schema.sql`
- 14 default daily love messages seeded across 7 categories
- RLS policies verified via SQL queries
- TypeScript types regenerated, typecheck passes
- Security advisor warning fixed (search_path on function)

### File List

**Files Created**:
- `supabase/migrations/20251207010523_push_notifications_schema.sql`
- `docs/02-Architecture/secrets.md`

**Files Modified**:
- `src/types/database.types.ts` (auto-regenerated)
- `.env.example` (added VAPID placeholder)
- `.env` (added VAPID public key)

**Dependencies**:
- `web-push` CLI (for VAPID generation only, not a project dependency)
