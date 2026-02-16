# 5. Database Functions and RPCs

## 5.1 `get_partner_id(user_id UUID)` -> `UUID`

**Security:** DEFINER, STABLE

Retrieves the `partner_id` for a given user. Used internally by RLS policies to avoid recursive policy evaluation when checking partner relationships.

> **Note:** Dropped in migration `20251206024345` and replaced by inline subqueries in RLS policies.

---

## 5.2 `accept_partner_request(p_request_id UUID)` -> `void`

**Security:** DEFINER

Accepts a pending partner request. Performs the following atomically:

1. Validates the request exists and is pending.
2. Verifies `auth.uid()` is the recipient (`to_user_id`).
3. Checks neither user already has a partner.
4. Sets `partner_id` on both users (bidirectional link).
5. Marks the request as `accepted`.
6. Declines all other pending requests involving either user.

---

## 5.3 `decline_partner_request(p_request_id UUID)` -> `void`

**Security:** DEFINER

Declines a pending partner request. Validates the request is pending and `auth.uid()` is the recipient before updating status to `declined`.

---

## 5.4 `sync_user_profile()` -> `trigger`

**Security:** DEFINER

Trigger function fired `AFTER INSERT OR UPDATE ON auth.users`. Automatically creates or updates a corresponding row in `public.users` with the email and display name from the auth metadata.

---

## 5.5 `is_scripture_session_member(p_session_id UUID)` -> `BOOLEAN`

**Security:** DEFINER, STABLE

Returns `true` if `auth.uid()` matches either `user1_id` or `user2_id` of the given session. Used by RLS policies on all scripture child tables.

---

## 5.6 `scripture_create_session(p_mode TEXT, p_partner_id UUID DEFAULT NULL)` -> `JSONB`

**Security:** DEFINER
**Granted to:** `authenticated`

Creates a new scripture reading session. Returns the full session object as JSONB.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `p_mode` | TEXT | Yes | `'solo'` or `'together'` |
| `p_partner_id` | UUID | Together mode only | Partner's user ID |

New sessions start in `reading` phase with `in_progress` status.

---

## 5.7 `scripture_submit_reflection(p_session_id, p_step_index, p_rating, p_notes, p_is_shared)` -> `JSONB`

**Security:** DEFINER
**Granted to:** `authenticated`

Upserts a reflection for the authenticated user at the given session and step. Uses `ON CONFLICT (session_id, step_index, user_id) DO UPDATE` for idempotent writes. Validates session membership and rating range (1-5). Returns the reflection object as JSONB.

---

## 5.8 `scripture_seed_test_data(...)` -> `JSONB`

**Security:** DEFINER
**Granted to:** `authenticated`

Test data seeding function with an environment guard that rejects calls in production. Creates scripture sessions, step states, reflections, and messages for development and testing.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `p_session_count` | INT | 1 | Number of sessions to create |
| `p_include_reflections` | BOOLEAN | false | Seed reflection records |
| `p_include_messages` | BOOLEAN | false | Seed prayer messages |
| `p_preset` | TEXT | NULL | `'mid_session'`, `'completed'`, `'with_help_flags'` |

---
