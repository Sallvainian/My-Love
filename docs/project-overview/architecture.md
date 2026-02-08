# Architecture

**Pattern**: Component-based SPA with offline-first data layer.

## Data Flow

```
Components --> Zustand Store --> Services --> Supabase | IndexedDB --> Background Sync --> Service Worker
```

## Key Architectural Decisions

| Concern | Approach |
|---|---|
| State | Zustand with 10 slices (app, navigation, messages, mood, interactions, photos, notes, partner, settings, scriptureReading) |
| Auth | Supabase Auth with email/password |
| Real-time | Supabase Realtime for mood sync, partner interactions, and love notes |
| Offline | Service Worker (injectManifest), IndexedDB persistence, background sync queue |
| Security | Row Level Security (RLS) on all Supabase tables |

---
