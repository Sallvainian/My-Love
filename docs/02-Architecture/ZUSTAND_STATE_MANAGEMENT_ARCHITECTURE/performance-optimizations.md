# Performance Optimizations

## 1. Memoization & Selectors

**Problem**: Zustand causes re-renders on ANY state change

**Solution**: Use selectors in components

```typescript
// Bad: Re-renders on every state change
const { messages, currentMessage } = useAppStore();

// Good: Re-renders only on messages/currentMessage change
const messages = useAppStore((state) => state.messages);
const currentMessage = useAppStore((state) => state.currentMessage);
```

## 2. Partialize Middleware

**Problem**: Persisting entire state wastes storage space

**Solution**: Selective persistence via `partialize`

```typescript
partialize: (state) => ({
  // Only persist critical data
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: { ... },
  moods: state.moods,

  // NOT persisted:
  // - Large blobs (photos)
  // - Computed values (currentMessage)
  // - Transient state (interactions)
})
```

**Benefits**:

- LocalStorage: ~5-10KB (fits in size limit)
- IndexedDB: Unlimited (stores large data)
- Faster hydration (less to parse)

## 3. Async Load-on-Demand

**Problem**: Loading everything on init = slow startup

**Solution**: Lazy-load data as needed

```typescript
// On app init:
// - Load settings, messages (required)
// - Don't load photos, custom messages

// On demand:
// - loadPhotos() when Photos component mounts
// - loadCustomMessages() when Admin panel opens

// Background:
// - loadMoods() after init completes
// - fetchPartnerMoods() when Partner view shown
```

## 4. Map vs Array for Message History

**Problem**: Array lookup O(n), duplicate dates possible

**Solution**: Use Map for date → message ID

```typescript
// Before (Array):
// [{ date: "2025-11-16", id: 42 }, ...]
// Lookup: array.find((x) => x.date === date)  // O(n)

// After (Map):
// Map([["2025-11-16", 42], ...])
// Lookup: map.get(date)  // O(1)
```

**Trade-off**: Serialization complexity (Array ↔ Map conversion)

## 5. Filtering Rotation Pool

**Problem**: Including disabled custom messages = no change in daily rotation

**Solution**: Filter before rotation algorithm

```typescript
const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);
// Only includes:
// - Default messages (always)
// - Active custom messages
// Excludes:
// - Inactive custom messages (active = false)
```

## 6. Optimistic UI Updates

**Problem**: Network latency feels slow

**Solution**: Update state immediately, sync in background

```typescript
// In uploadPhoto()
1. Validate file
2. Compress image
3. Set loading state
4. Create Photo object
5. Save to IndexedDB (async)
6. Update state immediately (OPTIMISTIC)
7. If error: revert state
```

## 7. Batch Operations

**Problem**: Multiple state updates = multiple re-renders

**Solution**: Single `set()` call with multiple fields

```typescript
// Bad: 3 re-renders
set({ messages: [...] });
set({ messageHistory: {...} });
set({ currentMessage: msg });

// Good: 1 re-render
set({
  messages: [...],
  messageHistory: {...},
  currentMessage: msg,
});
```

## 8. Validation Caching

**Problem**: Validating same settings repeatedly

**Solution**: Validate on load, trust thereafter

```typescript
// Persist middleware validates ONCE on load
const validation = validateHydratedState(data.state);

// Consumer trusts state is valid after hydration
// (Unless user/API provides new data)
```

---
