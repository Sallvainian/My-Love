# Scalability Considerations

## Current Design Constraints

The app is designed for a **two-user deployment** (a couple). This constraint simplifies many architectural decisions:

| Concern | Current Design | Scaling Impact |
|---------|---------------|----------------|
| Users | 2 users, linked via `partner_id` | Partner detection assumes exactly 1 partner |
| Auth | Email/password, Supabase Auth | No multi-tenant isolation |
| Data volume | Low (daily moods, occasional photos) | IndexedDB and localStorage adequate |
| Realtime | 1:1 channels between partners | No fan-out concerns |
| Storage | Single Supabase project | No sharding needed |

## Data Volume Estimates

For a 2-user deployment over 1 year:

| Data Type | Estimated Volume | Storage Layer |
|-----------|-----------------|---------------|
| Mood entries | ~730 entries (2 users x 365 days) | IndexedDB + Supabase |
| Messages (default) | ~200 default messages | IndexedDB |
| Custom messages | ~50-100 user-created | IndexedDB |
| Photos | ~200-500 photos | Supabase Storage |
| Love notes | ~1000-5000 messages | Supabase |
| Scripture sessions | ~50-100 sessions | Supabase (cache in IDB) |

These volumes are well within the capacity of both IndexedDB (typically 50MB+ per origin) and localStorage (5MB per origin).

## Potential Scaling Scenarios

### Scenario 1: Multi-Couple Deployment

If the app were to support multiple couples:

- **Database**: Add `couple_id` to all tables; update RLS policies
- **Realtime**: Scope channels by couple ID (`couple:{id}:notes`)
- **Storage**: Supabase Storage buckets per couple
- **State**: No changes needed (each couple has their own app instance)

### Scenario 2: Large Message Volume

If love notes volume grows significantly:

- **Virtualization**: Already implemented via `react-window`
- **Pagination**: Already cursor-based in `moodApi.ts` and `useMoodHistory.ts`
- **Archival**: Add message archival for old notes (not currently implemented)

### Scenario 3: Large Photo Library

- **Storage quotas**: Already monitored at 80%/95% thresholds
- **Signed URLs**: Already cached with LRU eviction (max 100)
- **Thumbnails**: Not currently generated; could add for grid view performance

## Current Scalability Features

### IndexedDB Indexes

The `moods` store has indexes for efficient queries:
- `by-date` -- Range queries for calendar view
- `by-synced` -- Filter unsynced entries for sync operations

### Cursor-Based Pagination

`BaseIndexedDBService.getPage()` uses cursor advancement instead of loading all records, keeping memory usage constant regardless of total record count.

### Lazy Loading

View-level code splitting ensures the initial bundle only includes the home view. Other views are loaded on demand, keeping Time-to-Interactive low.

### Rate Limiting

Client-side rate limiting on love notes (10 messages/minute) prevents accidental or malicious message flooding.

### Debounced Network Detection

The `useNetworkStatus` hook debounces reconnection events by 1.5 seconds, preventing rapid state changes during flaky connectivity.

## Related Documentation

- [Performance](./18-performance.md)
- [Data Architecture](./04-data-architecture.md)
- [Architecture Patterns](./03-architecture-patterns.md)
