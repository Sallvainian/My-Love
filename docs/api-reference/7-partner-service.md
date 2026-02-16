# 7. Partner Service

**Source:** `src/api/partnerService.ts`

## Overview

The `PartnerService` class manages partner relationships: searching for users, sending/accepting/declining partner connection requests, and querying current partner information. Partner linking is handled server-side via Supabase RPC functions (`accept_partner_request`, `decline_partner_request`) to ensure atomicity.

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

Gets the current user's partner information.

**Flow:**
1. Get current user via `supabase.auth.getUser()`
2. Query `users` table for `partner_id` and `updated_at` where `id = currentUserId`
3. If `partner_id` exists, query `users` table again for partner's `id`, `email`, `display_name`
4. Return `PartnerInfo` with `connectedAt` set to `updated_at`

**Fallbacks:** `displayName` falls back to `email`, then to `'Partner'`. Returns `null` on any error.

### `searchUsers(query: string, limit?: number): Promise<UserSearchResult[]>`

Searches for users by display name or email. Uses the RLS-protected `users` table directly (no admin API needed).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | -- | Search term (min 2 chars) |
| `limit` | `number` | `10` | Max results |

**Query:** `.or(email.ilike.%{query}%,display_name.ilike.%{query}%)` with `.neq('id', currentUserId)` to exclude self.

**Returns:** Empty array if query is empty or fewer than 2 characters.

### `sendPartnerRequest(toUserId: string): Promise<void>`

Sends a partner connection request.

**Flow:**
1. Check current user is authenticated
2. Verify current user does not already have a `partner_id` -- throws `'You already have a partner'`
3. Verify target user does not already have a `partner_id` -- throws `'This user already has a partner'`
4. Insert into `partner_requests` table with `status: 'pending'`

**Duplicate detection:** If the insert fails with a duplicate/unique constraint error, throws `'You already have a pending request to this user'`.

### `getPendingRequests(): Promise<{ sent: PartnerRequest[]; received: PartnerRequest[] }>`

Fetches all pending partner requests involving the current user.

**Flow:**
1. Query `partner_requests` where `status = 'pending'` and user is either sender or recipient
2. Collect all unique user IDs from the requests
3. Batch-query `users` table for `id`, `email`, `display_name` of all involved users
4. Enrich each request with user display info
5. Separate into `sent` (from current user) and `received` (to current user)

**Returns:** `{ sent: [], received: [] }` on any error.

### `acceptPartnerRequest(requestId: string): Promise<void>`

Accepts a partner request via Supabase RPC.

**RPC call:** `supabase.rpc('accept_partner_request', { p_request_id: requestId })`

The server-side function atomically updates the request status and sets `partner_id` on both users.

### `declinePartnerRequest(requestId: string): Promise<void>`

Declines a partner request via Supabase RPC.

**RPC call:** `supabase.rpc('decline_partner_request', { p_request_id: requestId })`

### `hasPartner(): Promise<boolean>`

Convenience method. Calls `getPartner()` and returns `true` if result is non-null.

## Singleton

```typescript
export const partnerService = new PartnerService();
```
