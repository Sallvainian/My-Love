# Scalability Considerations

## Current Design (2-User Scope)

My-Love is designed for a **two-user** relationship app (one couple). This scope simplifies many architectural decisions:

| Area | Current Design | Scaling Implication |
|---|---|---|
| Partner resolution | Single partner per user | `getPartnerId()` returns one ID |
| Realtime channels | User-specific channels | `love-notes:{userId}` per user |
| Love notes query | Bidirectional filter on two user IDs | No group/thread support |
| Mood sharing | Share with one partner | No multi-user sharing |
| Photo storage | Per-user bucket paths | No shared albums |
| Scripture sessions | 1-2 user sessions | No group study |

## Areas That Scale Well

### Supabase Backend

- **PostgreSQL with RLS** scales to thousands of tables/rows
- **Supabase Storage** handles file uploads with CDN-backed delivery
- **Supabase Auth** supports millions of users
- **Supabase Realtime Broadcast** scales to many concurrent channels

### Code Architecture

- **Zustand slice pattern** allows adding new feature slices without touching existing ones
- **Lazy loading** keeps initial bundle size constant as features grow
- **IndexedDB storage** handles large local datasets efficiently
- **Service Worker** Background Sync works for any number of pending items

### Client-Side

- **Manual chunk splitting** prevents vendor bundle bloat
- **Image compression** keeps upload sizes manageable
- **Pagination** prevents loading all data at once
- **Blob URL cleanup** prevents memory leaks in long sessions

## Potential Bottlenecks

### LocalStorage Persist (5MB Limit)

The Zustand persist middleware uses localStorage, which has a ~5MB limit:

```typescript
partialize: (state) => ({
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: { /* serialized Map */ },
  moods: state.moods,
}),
```

**Risk:** If the user accumulates many mood entries, the `moods` array could grow large. The `storageMonitor.ts` utility watches for this:

```typescript
export function logStorageQuota(): void;
// Warns at estimated usage thresholds
```

**Mitigation:** Move moods to IndexedDB-only persistence (currently both localStorage and IndexedDB).

### Love Notes Query Performance

The conversation query uses an OR filter across two columns:

```typescript
.or(
  `and(from_user_id.eq.${userId},to_user_id.eq.${partnerId}),and(from_user_id.eq.${partnerId},to_user_id.eq.${userId})`
)
```

**Risk:** For very long conversations (thousands of messages), this query could become slow without proper indexing.

**Mitigation:** Ensure composite indexes on `(from_user_id, to_user_id, created_at)` exist in the Supabase database.

### Realtime Channel Management

Each feature creates its own Broadcast channel:
- `love-notes:{userId}`
- `mood-updates:{userId}`
- `interactions:{userId}`

**Risk:** Multiple simultaneous channels per user consume WebSocket resources.

**Mitigation:** Currently acceptable for 2 users. For multi-user scaling, consider multiplexing events onto a single user channel.

### Photo Storage Quota

Photos are uploaded to Supabase Storage with quota monitoring:

```typescript
STORAGE_QUOTAS = {
  WARNING_THRESHOLD: 0.8,   // 80%
  CRITICAL_THRESHOLD: 0.95, // 95%
};
```

**Risk:** Storage fills up with high-resolution photos.

**Mitigation:** Client-side compression (2048px max, 80% JPEG quality) and quota warnings in the UI.

## What Would Change for Multi-User

If the app needed to support multiple couples or groups:

| Feature | Current | Multi-User Change |
|---|---|---|
| Partner resolution | Single partner lookup | Partner list/group management |
| Navigation | 6 views | Role-based views |
| Realtime channels | User-specific | Room-based (`room:{id}`) |
| Love notes | Bidirectional pair query | Room/thread-based queries |
| Mood sharing | Single partner broadcast | Group broadcast |
| Auth | Simple login + display name | Invitation system, roles |
| Scripture | Solo or pair | Group study sessions |
| IndexedDB | Single user data | User-partitioned stores |

## Performance Monitoring

The app includes runtime monitoring tools:

| Tool | Location | Purpose |
|---|---|---|
| Scroll performance observer | `src/utils/performanceMonitoring.ts` | Detect scroll jank |
| Memory measurement | `src/utils/performanceMonitoring.ts` | Track heap usage |
| Storage quota monitor | `src/utils/storageMonitor.ts` | localStorage usage tracking |
| Bundle visualizer | `rollup-plugin-visualizer` | Build-time size analysis |

## Architecture Decisions Supporting Scale

| Decision | Why It Scales |
|---|---|
| Feature-organized components | New features = new folder, no existing code changes |
| Zustand slices | New state domain = new slice file |
| Service layer separation | New data source = new service, slices unchanged |
| Zod validation at boundaries | Schema changes caught at compile + runtime |
| Background Sync | Async sync decouples write speed from network speed |
| Code splitting per view | Bundle size stays flat as views are added |
