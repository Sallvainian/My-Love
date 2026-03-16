# Partner Slice

**File:** `src/stores/slices/partnerSlice.ts`
**Interface:** `PartnerSlice`

## Purpose

Manages partner connection lifecycle: searching for users, sending/receiving partner requests, and maintaining the active partner relationship. Used by PartnerMoodView and ScriptureOverview to determine partner status.

## State

| Field              | Type                 | Default | Persisted | Description                             |
| ------------------ | -------------------- | ------- | --------- | --------------------------------------- |
| `partner`          | `Partner \| null`    | `null`  | No        | Active linked partner info              |
| `isLoadingPartner` | `boolean`            | `false` | No        | Loading state for partner operations    |
| `sentRequests`     | `PartnerRequest[]`   | `[]`    | No        | Outgoing partner requests               |
| `receivedRequests` | `PartnerRequest[]`   | `[]`    | No        | Incoming partner requests               |
| `searchResults`    | `UserSearchResult[]` | `[]`    | No        | User search results for partner linking |
| `searchLoading`    | `boolean`            | `false` | No        | Loading state for user search           |

## Partner Shape

```typescript
interface Partner {
  id: string; // Supabase user ID
  displayName: string; // Partner's display name
}
```

## Actions

| Action                 | Signature                                 | Description                             |
| ---------------------- | ----------------------------------------- | --------------------------------------- |
| `loadPartner`          | `() => Promise<void>`                     | Fetches active partner from Supabase    |
| `searchUsers`          | `(query: string) => Promise<void>`        | Searches users by display name or email |
| `sendPartnerRequest`   | `(targetUserId: string) => Promise<void>` | Sends a partner link request            |
| `acceptPartnerRequest` | `(requestId: string) => Promise<void>`    | Accepts incoming partner request        |
| `rejectPartnerRequest` | `(requestId: string) => Promise<void>`    | Rejects incoming partner request        |
| `loadPartnerRequests`  | `() => Promise<void>`                     | Loads sent and received requests        |
| `unlinkPartner`        | `() => Promise<void>`                     | Removes partner connection              |

## Component Usage

- **PartnerMoodView** -- Uses `partner`, `isLoadingPartner`, `loadPartner` to show partner connection status and mood
- **ScriptureOverview** -- Uses `partner`, `isLoadingPartner`, `loadPartner` to determine if "Together" mode should be enabled
- **LobbyContainer** -- Uses `partner?.displayName` for partner name display

## Cross-Slice Dependencies

None. Operates independently.
