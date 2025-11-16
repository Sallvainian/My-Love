# PARTNER SLICE

## File

`src/stores/slices/partnerSlice.ts`

## Purpose

Manages partner relationships: partner info, connection requests (sent/received), user search, and request operations.

## State Interface

```typescript
export interface PartnerSlice {
  // State
  partner: PartnerInfo | null;
  isLoadingPartner: boolean;
  sentRequests: PartnerRequest[];
  receivedRequests: PartnerRequest[];
  isLoadingRequests: boolean;
  searchResults: UserSearchResult[];
  isSearching: boolean;

  // Actions
  loadPartner: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
  sendPartnerRequest: (toUserId: string) => Promise<void>;
  acceptPartnerRequest: (requestId: string) => Promise<void>;
  declinePartnerRequest: (requestId: string) => Promise<void>;
  hasPartner: () => boolean;
}
```

## State Shape

```typescript
{
  partner: {
    id: string,                // User ID
    email: string,
    displayName: string,       // Partner's name
    partnerId: string,         // Link to this user
    connectedAt: Date,
  } | null,

  isLoadingPartner: boolean,

  sentRequests: [
    {
      id: string,              // Request ID
      fromUserId: string,      // Current user
      toUserId: string,        // Target user
      status: 'pending' | 'accepted' | 'declined',
      createdAt: Date,
    }
  ],

  receivedRequests: [
    {
      // Same structure as sentRequests
    }
  ],

  isLoadingRequests: boolean,

  searchResults: [
    {
      id: string,              // User ID
      email: string,
      displayName: string,
      alreadyConnected?: boolean,
      requestPending?: boolean,
    }
  ],

  isSearching: boolean,
}
```

## Initial State

```typescript
partner: null,
isLoadingPartner: false,
sentRequests: [],
receivedRequests: [],
isLoadingRequests: false,
searchResults: [],
isSearching: false,
```

## Actions

### loadPartner()

**Type**: Async  
**Source**: Supabase (partnerService)  
**Persistence**: NOT persisted (fresh load on mount)

**Process**:

1. Set `isLoadingPartner = true`
2. Fetch partner info via `partnerService.getPartner()`
3. Update `partner` state
4. Set `isLoadingPartner = false`

**Error Handling**: Logged → sets `partner = null` → continues

### loadPendingRequests()

**Type**: Async  
**Source**: Supabase (partnerService)  
**Persistence**: NOT persisted (fresh load on mount)

**Process**:

1. Set `isLoadingRequests = true`
2. Fetch requests via `partnerService.getPendingRequests()`
3. Returns: `{ sent: [], received: [] }`
4. Update `sentRequests` + `receivedRequests`
5. Set `isLoadingRequests = false`

**Error Handling**: Logged → clears arrays → continues

### searchUsers(query)

**Type**: Async  
**Input**: Query string (min 2 chars)  
**Output**: Populates `searchResults`

**Process**:

1. Validate query length ≥ 2
2. If invalid: clear results + return
3. Set `isSearching = true`
4. Search via `partnerService.searchUsers(query)`
5. Update `searchResults` state
6. Set `isSearching = false`

**Error Handling**: Logged → clears results → continues

### clearSearch()

**Type**: Sync  
**Sets**: `searchResults = []`, `isSearching = false`

**Use Case**: User cancels search

### sendPartnerRequest(toUserId)

**Type**: Async  
**Input**: Target user ID  
**Persistence**: Supabase

**Process**:

1. Send request via `partnerService.sendPartnerRequest(toUserId)`
2. Reload pending requests (shows new request in sentRequests)
3. Clear search results
4. Log success

**Error Handling**: Throws (allows UI error feedback)

### acceptPartnerRequest(requestId)

**Type**: Async  
**Input**: Request ID  
**Persistence**: Supabase

**Process**:

1. Accept via `partnerService.acceptPartnerRequest(requestId)`
2. Reload partner info (should now show partner)
3. Reload pending requests (remove from receivedRequests)
4. Log success

**Error Handling**: Throws (allows UI error feedback)

### declinePartnerRequest(requestId)

**Type**: Async  
**Input**: Request ID  
**Persistence**: Supabase

**Process**:

1. Decline via `partnerService.declinePartnerRequest(requestId)`
2. Reload pending requests (remove from receivedRequests)
3. Log success

**Error Handling**: Throws (allows UI error feedback)

### hasPartner()

**Type**: Sync query  
**Returns**: boolean

**Logic**:

```typescript
return get().partner !== null;
```

## Persistence

- **What**: NOT persisted to LocalStorage
- **Where**: Supabase only
- **When**: Loaded fresh on app mount
- **Why**: Dynamic relational data

## Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `partnerService` (Supabase API)

---
