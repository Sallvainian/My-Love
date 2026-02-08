# 6. Partner Service

**Module:** `src/api/partnerService.ts`
**Singleton export:** `partnerService` (instance of `PartnerService`)

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

### `getPartner()`

```typescript
async getPartner(): Promise<PartnerInfo | null>
```

- **Purpose:** Fetch the current user's partner info (ID, email, display name, connected timestamp).
- **Returns:** `null` if no partner or not authenticated.

---

### `searchUsers(query, limit?)`

```typescript
async searchUsers(query: string, limit: number = 10): Promise<UserSearchResult[]>
```

- **Purpose:** Search users by display name or email using `ilike` matching.
- **Constraints:** Minimum 2 characters. Excludes current user from results.
- **Security:** Uses RLS-protected `users` table (no admin API).

---

### `sendPartnerRequest(toUserId)`

```typescript
async sendPartnerRequest(toUserId: string): Promise<void>
```

- **Purpose:** Create a pending partner request.
- **Validation:** Checks that neither user already has a partner. Detects duplicate requests.
- **Throws:** On validation failure or DB error.

---

### `getPendingRequests()`

```typescript
async getPendingRequests(): Promise<{ sent: PartnerRequest[]; received: PartnerRequest[] }>
```

- **Purpose:** Fetch all pending requests involving the current user, enriched with user info.
- **Returns:** Object with `sent` and `received` arrays.

---

### `acceptPartnerRequest(requestId)`

```typescript
async acceptPartnerRequest(requestId: string): Promise<void>
```

- **Purpose:** Accept a partner request via Supabase RPC (`accept_partner_request`).
- **Side effect:** Sets `partner_id` on both users in the database (server-side).

---

### `declinePartnerRequest(requestId)`

```typescript
async declinePartnerRequest(requestId: string): Promise<void>
```

- **Purpose:** Decline a partner request via Supabase RPC (`decline_partner_request`).

---

### `hasPartner()`

```typescript
async hasPartner(): Promise<boolean>
```

- **Purpose:** Convenience check. Returns `true` if `getPartner()` returns non-null.

---
