# 7. Partner Service

**Source:** `src/api/partnerService.ts`

## Purpose

Manages partner relationships: user search, connection requests (send/accept/decline), and current partner info.

## Class: `PartnerService`

Singleton exported as `partnerService`.

### `getPartner(): Promise<PartnerInfo | null>`
Gets current user's partner info. Queries `users` table for `partner_id`, then fetches partner's `display_name` and `email`. Returns `null` if no partner.

### `searchUsers(query: string, limit?: number): Promise<UserSearchResult[]>`
Searches `users` table by `display_name` or `email` using `ilike` filter. Excludes current user. Minimum 2-character query. Default limit: 10.

### `sendPartnerRequest(toUserId: string): Promise<void>`
Creates a `partner_requests` record with status `'pending'`. Pre-checks that neither user already has a partner. Detects duplicate requests.

### `getPendingRequests(): Promise<{ sent: PartnerRequest[]; received: PartnerRequest[] }>`
Fetches all pending partner requests involving current user. Enriches with user info (email, display_name) from `users` table. Separates into sent/received arrays.

### `acceptPartnerRequest(requestId: string): Promise<void>`
Calls `supabase.rpc('accept_partner_request', { p_request_id: requestId })`. The RPC function atomically updates both users' `partner_id` and marks the request as accepted.

### `declinePartnerRequest(requestId: string): Promise<void>`
Calls `supabase.rpc('decline_partner_request', { p_request_id: requestId })`.

### `hasPartner(): Promise<boolean>`
Shorthand for `getPartner() !== null`.

## Types

```typescript
interface UserSearchResult { id: string; email: string; displayName: string; }
interface PartnerInfo { id: string; email: string; displayName: string; connectedAt: string | null; }
interface PartnerRequest {
  id: string;
  from_user_id: string; to_user_id: string;
  from_user_email: string | null; from_user_display_name: string | null;
  to_user_email: string | null; to_user_display_name: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}
```
