# Architecture Overview

> **Last Updated:** 2025-12-08 | **Scan Type:** Exhaustive

## Pattern

**Component-based Single Page Application with Offline-First PWA Architecture**

The application follows a hybrid architecture combining:
- **Offline-First**: IndexedDB for local persistence, Background Sync for deferred uploads
- **Real-Time**: Supabase Realtime for partner notifications and chat
- **Progressive Enhancement**: Works offline, syncs when online

## Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│              UI Layer (React 19)                    │
│         54 Components, 148 TypeScript Files         │
│    ┌─────────┐  ┌─────────┐  ┌─────────────────┐   │
│    │ Pages   │  │ Features│  │ Shared/Core     │   │
│    │ (6)     │  │ (36)    │  │ (12)            │   │
│    └─────────┘  └─────────┘  └─────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│            State Layer (Zustand 5.0.9)              │
│          8 Slices, 50 Actions, Persist              │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │ Settings │ │ Messages │ │ Photos   │           │
│   │ Mood     │ │ Partner  │ │ Interact │           │
│   │ Nav      │ │ Notes    │ │          │           │
│   └──────────┘ └──────────┘ └──────────┘           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         Custom Hooks Layer (11 Hooks)               │
│   useLoveNotes, useRealtimeMessages,                │
│   useSubscriptionHealth, useNetworkStatus, etc.     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│        Service Layer (Business Logic)               │
│         12 Services, Validation, Sync               │
│   ┌──────────────┐  ┌──────────────┐               │
│   │ moodService  │  │ photoService │               │
│   │ realtimeSvc  │  │ imageCompr.  │               │
│   │ syncService  │  │ hapticSvc    │               │
│   └──────────────┘  └──────────────┘               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           API Layer (Supabase Client)               │
│          8 API Services, Real-time, RLS             │
│   ┌──────────────┐  ┌──────────────┐               │
│   │ authService  │  │ moodApi      │               │
│   │ partnerApi   │  │ interactApi  │               │
│   │ loveNotesApi │  │ messagesApi  │               │
│   └──────────────┘  └──────────────┘               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│            Storage Layer (Hybrid)                   │
│   ┌──────────────────────────────────────────┐     │
│   │ IndexedDB (IDB 8.0.3)                    │     │
│   │  - Moods (local cache)                   │     │
│   │  - Auth tokens (Background Sync)         │     │
│   └──────────────────────────────────────────┘     │
│   ┌──────────────────────────────────────────┐     │
│   │ LocalStorage (Zustand Persist)           │     │
│   │  - Settings, Partner config              │     │
│   │  - Navigation state                      │     │
│   └──────────────────────────────────────────┘     │
│   ┌──────────────────────────────────────────┐     │
│   │ Supabase (Cloud)                         │     │
│   │  - All tables with RLS                   │     │
│   │  - Storage buckets (photos, images)      │     │
│   │  - Realtime channels                     │     │
│   └──────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

## Data Flow

**Unidirectional Flow:**
```
User Action → Custom Hook → Store Action → Service Layer → API/Storage → State Update → UI Re-render
```

**Real-Time Flow (Partner Updates):**
```
Partner Action → Supabase → Realtime Channel → useRealtimeMessages → Store Update → UI Re-render
```

**Offline Flow:**
```
User Action → Store (Optimistic) → IndexedDB → Background Sync → Supabase (when online)
```

## Persistence Strategy

| Data Type | Primary Storage | Backup Storage | Sync Strategy |
|-----------|-----------------|----------------|---------------|
| **Love Notes** | Supabase | - | Optimistic + Realtime |
| **Moods** | IndexedDB | Supabase | Background Sync |
| **Photos** | Supabase Storage | - | Upload on create |
| **Messages (custom)** | IndexedDB | - | Local-only |
| **User Settings** | LocalStorage | - | Local-only |
| **Interactions** | Supabase | - | Realtime sync |
| **Auth State** | Supabase Auth | IndexedDB (token) | Cloud-managed |
| **Partner Config** | LocalStorage | users table | Manual sync |

## Key Architecture Decisions

### 1. Offline-First with Background Sync

```typescript
// Service Worker handles sync when app is closed
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-pending-moods') {
    event.waitUntil(syncPendingMoods());
  }
});
```

**Why:** Users may be in areas with poor connectivity. Moods should save immediately and sync later.

### 2. Optimistic Updates with Rollback

```typescript
// Optimistic update - show immediately
set((state) => ({
  notes: [...state.notes, optimisticNote],
}));

// On error - mark as failed, preserve for retry
if (error) {
  set((state) => ({
    notes: state.notes.map((note) =>
      note.tempId === tempId
        ? { ...note, sending: false, error: true }
        : note
    ),
  }));
}
```

**Why:** Instant feedback improves UX. Failed messages can be retried.

### 3. Supabase Realtime Broadcast

```typescript
// Sender broadcasts to partner's channel
const channel = supabase.channel(`love-notes:${partnerId}`);
await channel.send({
  type: 'broadcast',
  event: 'new_message',
  payload: { message: data },
});
```

**Why:** Postgres Changes have ~1s latency. Broadcast is instant for chat.

### 4. Zustand Slices with Persist

```typescript
// Each slice is self-contained
export const createMoodSlice: StateCreator<MoodSlice> = (set, get) => ({
  moods: [],
  addMoodEntry: async (moods, note) => { /* ... */ },
});

// Combined store with selective persist
export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createSettingsSlice(...a),
      ...createMoodSlice(...a),
      // ...other slices
    }),
    {
      name: 'my-love-storage',
      partialize: (state) => ({
        settings: state.settings,
        // Only persist what's needed
      }),
    }
  )
);
```

**Why:** Modular state management. Only essential state is persisted.

## Security Architecture

### Row Level Security (RLS)

All database tables use RLS policies:

```sql
-- Users can only read/write their own data
CREATE POLICY "Users can view own moods"
  ON moods FOR SELECT
  USING (auth.uid() = user_id);

-- Partners can view each other's data
CREATE POLICY "Partners can view partner moods"
  ON moods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.partner_id = moods.user_id
    )
  );
```

### Authentication Flow

```
1. Email/Password OR Google OAuth
2. Supabase Auth creates session
3. JWT stored in browser + IndexedDB (for SW)
4. Token refreshed automatically
5. RLS policies enforce access control
```

## PWA Architecture

### Service Worker Strategy

| Route Type | Strategy | Cache Name |
|------------|----------|------------|
| Navigation (HTML) | NetworkFirst (3s timeout) | navigation-cache |
| Scripts/Styles | NetworkOnly | - |
| Images/Fonts | CacheFirst (30 days) | static-assets-v2 |
| Google Fonts | CacheFirst (1 year) | google-fonts-v2 |

### Background Sync

```
User creates mood offline
  → Save to IndexedDB (synced: false)
  → Register sync event
  → When online: SW reads IndexedDB → POSTs to Supabase → Marks synced
```

## Performance Architecture

### Bundle Splitting

```typescript
// vite.config.ts manualChunks
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'supabase': ['@supabase/supabase-js'],
  'framer': ['framer-motion'],
  'zustand': ['zustand'],
}
```

### Lazy Loading

```typescript
// Route-based code splitting
const PhotoGallery = lazy(() => import('./components/PhotoGallery'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
```

### Image Optimization

```typescript
// All uploads compressed to max 1200px, 80% quality
const compressionResult = await imageCompressionService.compressImage(file);
// ~80% size reduction typical
```
