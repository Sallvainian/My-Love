# 6. Supabase RPC Functions

All database functions are created in the `public` schema. Most use `SECURITY INVOKER` (respects RLS) unless noted. All scripture functions use `SET search_path = ''` for security.

## Partner Management

### `accept_partner_request(p_request_id UUID)`

Atomically accepts a partner connection request.

**Actions:**

1. Updates request status to `'accepted'`
2. Sets `partner_id` on both users in the `users` table (bidirectional link)

**Called by:** `partnerService.acceptPartnerRequest()`

---

### `decline_partner_request(p_request_id UUID)`

Declines a partner connection request.

**Actions:** Updates request status to `'declined'`.

**Called by:** `partnerService.declinePartnerRequest()`

---

### `get_my_partner_id() RETURNS UUID`

Returns the current user's `partner_id` from the `users` table. Uses `auth.uid()` to identify the caller.

**Security:** `SECURITY DEFINER` -- bypasses RLS to avoid recursion when used inside RLS policies.

---

### `get_partner_id(user_id UUID) RETURNS UUID`

Returns the `partner_id` for a given user. Used by RLS policies to check partner relationships.

**Security:** `SECURITY DEFINER`, `STABLE`

## Scripture Reading

### `scripture_create_session(p_mode TEXT, p_partner_id UUID DEFAULT NULL) RETURNS JSONB`

Creates a new scripture reading session.

**Solo mode:** Creates session with `user1_id = auth.uid()`, `status = 'in_progress'`, `current_phase = 'reading'`.

**Together mode:** Creates session with both user IDs, `status = 'pending'`, `current_phase = 'lobby'`. Validates that `p_partner_id` is the caller's actual partner.

**Returns:** Full session row as JSONB.

**Called by:** `scriptureReadingService.createSession()`

---

### `scripture_lock_in(p_session_id UUID, p_step_index INT, p_expected_version INT) RETURNS JSONB`

Locks in a user for the current reading step. When both users are locked in, advances the session.

**Preconditions:**

- Session must be in `'reading'` or `'countdown'` phase
- `p_step_index` must match `current_step_index`
- `p_expected_version` must match `version` (optimistic concurrency -- throws `'409: version mismatch'` on conflict)

**Phase transition from countdown:** If session is in `'countdown'` phase, transitions to `'reading'` automatically.

**Lock-in logic:**

1. UPSERTs into `scripture_step_states` setting the caller's `locked_at` timestamp
2. Checks if both users are locked in
3. If both locked:
   - Steps 0-15: Increments `current_step_index`, bumps `version`
   - Step 16 (last): Transitions `current_phase` to `'reflection'`, keeps `status = 'in_progress'`
4. If partial lock: Returns lock status payload

**Returns JSONB:** `{ sessionId, currentPhase, currentStepIndex, version, both_locked, lock_status? }`

**Called by:** Scripture reading components (via Zustand slice)

---

### `scripture_submit_reflection(p_session_id UUID, p_step_index INT, p_rating INT, p_notes TEXT, p_is_shared BOOLEAN) RETURNS JSONB`

Submits a post-reading reflection.

**Inserts** into `scripture_reflections` table.

**Returns:** Created reflection row as JSONB.

**Called by:** `scriptureReadingService.addReflection()`

---

### `scripture_get_couple_stats() RETURNS JSONB`

Aggregates reading statistics for the current user and their partner.

**Returns:**

```jsonb
{
  "totalSessions": 12,
  "totalSteps": 180,
  "lastCompleted": "2026-03-01T10:30:00Z",
  "avgRating": 4.2,
  "bookmarkCount": 15
}
```

**Called by:** `scriptureReadingService.getCoupleStats()`

---

### `scripture_end_session(p_session_id UUID) RETURNS JSONB`

Marks a session as complete or abandoned.

**Called by:** Scripture components for session completion.

---

### `scripture_convert_to_solo(p_session_id UUID) RETURNS JSONB`

Converts a together-mode session to solo mode. Used when a partner disconnects or the user wants to continue alone.

**Called by:** Scripture components.

---

### `is_scripture_session_member(p_session_id UUID) RETURNS BOOLEAN`

Checks if `auth.uid()` is `user1_id` or `user2_id` of the specified session.

**Used by:** RLS policies on scripture tables to enforce session membership.

---

### `scripture_seed_test_data(...)`

Test data seeding function for development and testing. Accepts optional parameters for bookmark steps and message inclusion.

## Helper Functions

### `get_partner_id(user_id UUID) RETURNS UUID`

Simple SQL function returning `partner_id` for a user. `SECURITY DEFINER` to avoid RLS recursion.

```sql
SELECT partner_id FROM users WHERE id = user_id;
```

Used by RLS policies on `moods`, `photos`, `interactions`, and `users` tables.
