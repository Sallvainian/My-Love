# 7. Partner Service

**Source:** `src/api/partnerService.ts`

## Overview

Manages partner relationships including user search, connection requests, and partner information retrieval. Uses the `users` and `partner_requests` tables, plus RPC functions for accept/decline logic.

**Singleton:** `export const partnerService = new PartnerService()`

**Supabase tables:** `users`, `partner_requests`

**Supabase RPCs:** `accept_partner_request`, `decline_partner_request`

## Types

```typescript
interface UserSearchResult {
  id: string;
  email: string;
  displayName: string;
}

interface PartnerInfo {
  id: string;
  email: string;
  displayName: string;
  connectedAt: string | null;
}

interface PartnerRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_user_email: string | null;
  from_user_display_name: string | null;
  to_user_email: string | null;
  to_user_display_name: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}
```

## Methods

### `getPartner(): Promise<PartnerInfo | null>`

Retrieves current user's partner information.

**Flow:**

1. Gets current user via `supabase.auth.getUser()`
2. Queries `users` table for current user's `partner_id` and `updated_at`
3. If `partner_id` exists, queries `users` table for partner's `id`, `email`, `display_name`
4. Returns `PartnerInfo` with `connectedAt` from `updated_at` field

**Error handling:** Returns `null` on any failure.

---

### `searchUsers(query: string, limit?: number): Promise<UserSearchResult[]>`

Searches users by display name or email.

**Minimum query length:** 2 characters (returns `[]` if shorter)

**Query:** `supabase.from('users').select('id, email, display_name').neq('id', currentUserId).or('email.ilike.%{query}%,display_name.ilike.%{query}%').limit(limit)`

**Default limit:** `10`

**Note:** Excludes the current user from results. Uses `ilike` for case-insensitive matching. RLS policy allows authenticated users to search.

**Error handling:** Returns `[]` on any failure.

---

### `sendPartnerRequest(toUserId: string): Promise<void>`

Sends a partner connection request.

**Preconditions (enforced in code):**

1. Current user must not already have a partner (checks `users.partner_id`)
2. Target user must not already have a partner (checks `users.partner_id`)

**Query:** `supabase.from('partner_requests').insert({ from_user_id, to_user_id, status: 'pending' })`

**Duplicate detection:** If the insert fails with a message containing "duplicate" or "unique", throws "You already have a pending request to this user".

**Throws:** Error on any failure.

---

### `acceptPartnerRequest(requestId: string): Promise<void>`

Accepts a partner request by calling the `accept_partner_request` RPC.

**RPC:** `supabase.rpc('accept_partner_request', { p_request_id: requestId })`

The RPC atomically:

- Updates the request status to `'accepted'`
- Sets `partner_id` on both users in the `users` table

**Throws:** Error on any failure.

---

### `declinePartnerRequest(requestId: string): Promise<void>`

Declines a partner request by calling the `decline_partner_request` RPC.

**RPC:** `supabase.rpc('decline_partner_request', { p_request_id: requestId })`

**Throws:** Error on any failure.

---

### `getPendingRequests(): Promise<{ sent: PartnerRequest[], received: PartnerRequest[] }>`

Retrieves all pending partner requests involving the current user.

**Flow:**

1. Queries `partner_requests` where `status = 'pending'` and user is sender or recipient
2. Collects all involved user IDs
3. Fetches user info from `users` table for all IDs
4. Enriches requests with display names and emails
5. Splits into `sent` (from current user) and `received` (to current user)

**Error handling:** Returns `{ sent: [], received: [] }` on any failure.

---

### `hasPartner(): Promise<boolean>`

Returns `true` if the current user has a connected partner.

**Implementation:** Calls `getPartner()` and returns `partner !== null`.
