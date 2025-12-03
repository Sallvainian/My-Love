# My-Love Architecture

System architecture and design patterns for the My-Love relationship app.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
│  React Components + Framer Motion + Tailwind CSS                │
│  (MoodTracker, PhotoGallery, LoveNotes, Settings, etc.)         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     State Layer                                  │
│  Zustand Store (useAppStore) with Persist Middleware            │
│  8 Slices: settings, photos, moods, messages, ui, sync, etc.    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   Service Layer                                  │
│  Business Logic + Validation (Zod)                              │
│  PhotoService, MoodService, MessageService, etc.                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     API Layer                                    │
│  Supabase Client (Auth, Database, Realtime, Storage)            │
│  src/api/supabase.ts                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   Storage Layer                                  │
│  IndexedDB (offline) + LocalStorage (settings) + Supabase (sync)│
│  BaseIndexedDBService abstract class                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Design Patterns

### 1. Slice Composition (State Management)

The Zustand store is composed of independent slices, each handling a specific domain:

```
useAppStore
├── createSettingsSlice    → User preferences, theme, notifications
├── createPhotosSlice      → Photo gallery state
├── createMoodsSlice       → Mood tracking entries
├── createMessagesSlice    → Love notes and messages
├── createUISlice          → Modal states, loading, navigation
├── createSyncSlice        → Offline/online sync status
├── createPartnerSlice     → Partner connection state
└── createAuthSlice        → Authentication state
```

**Benefits:**
- Single global store, no prop drilling
- Persist middleware for automatic LocalStorage sync
- Each slice is independently testable
- Type-safe with StateCreator generic

### 2. Abstract Base Service (Data Access)

All IndexedDB services extend `BaseIndexedDBService<T>`:

```typescript
abstract class BaseIndexedDBService<T> {
  protected storeName: string;
  protected db: IDBDatabase;

  // Template method pattern
  abstract getStoreName(): string;

  // CRUD operations with consistent error handling
  async add(item: T): Promise<string>;
  async get(id: string): Promise<T | undefined>;
  async getAll(): Promise<T[]>;
  async update(id: string, item: Partial<T>): Promise<void>;
  async delete(id: string): Promise<void>;
  async clear(): Promise<void>;

  // Pagination support
  async getPage(page: number, limit: number): Promise<T[]>;
}
```

**Concrete Implementations:**
- `PhotoService` extends `BaseIndexedDBService<Photo>`
- `MoodService` extends `BaseIndexedDBService<MoodEntry>`
- `MessageService` extends `BaseIndexedDBService<Message>`

### 3. Validation at Boundaries

Zod schemas validate data at service layer entry points:

```
Component → (raw data) → Service.add() → [Zod validation] → IndexedDB
Supabase → (API data) → Service.sync() → [Zod validation] → IndexedDB
```

**Key Schemas:**
- `MessageSchema` - Love notes with content, sender, timestamp
- `PhotoSchema` - Gallery photos with metadata
- `MoodEntrySchema` - Mood tracking with optional notes
- `SettingsSchema` - User preferences with theme, notifications

### 4. Offline-First PWA

```
┌──────────────────────────────────────────────────────────────┐
│                     User Action                               │
└──────────────────────────────┬───────────────────────────────┘
                               │
         ┌─────────────────────▼─────────────────────┐
         │           Is Online?                       │
         └─────────────┬─────────────────┬───────────┘
                       │ Yes             │ No
         ┌─────────────▼─────────┐ ┌─────▼───────────┐
         │  Save to Supabase     │ │ Save to IndexedDB│
         │  + IndexedDB (cache)  │ │ + Queue for sync │
         └───────────────────────┘ └──────────────────┘
                                           │
                                   ┌───────▼───────┐
                                   │ When online,  │
                                   │ sync queued   │
                                   │ operations    │
                                   └───────────────┘
```

---

## Directory Structure

```
src/
├── api/                    # External API clients
│   ├── supabase.ts         # Supabase client initialization
│   └── types.ts            # API-specific types
│
├── components/             # React components
│   ├── MoodTracker/        # Feature component folder
│   │   ├── MoodTracker.tsx
│   │   ├── MoodIcon.tsx
│   │   └── __tests__/
│   ├── PhotoGallery/
│   ├── LoveNotes/
│   ├── Settings/
│   └── ui/                 # Shared UI components
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── Input.tsx
│
├── hooks/                  # Custom React hooks
│   ├── useOfflineStatus.ts
│   ├── usePhotos.ts
│   └── useHaptics.ts
│
├── services/               # Business logic layer
│   ├── BaseIndexedDBService.ts  # Abstract base class
│   ├── PhotoService.ts
│   ├── MoodService.ts
│   └── MessageService.ts
│
├── stores/                 # State management
│   ├── useAppStore.ts      # Main store composition
│   └── slices/             # Individual slices
│       ├── settingsSlice.ts
│       ├── photosSlice.ts
│       └── moodsSlice.ts
│
├── types/                  # TypeScript definitions
│   └── index.ts
│
├── validation/             # Zod schemas
│   └── schemas.ts
│
├── utils/                  # Utility functions
│   ├── haptics.ts
│   ├── permissions.ts
│   └── formatters.ts
│
└── App.tsx                 # Root component
```

---

## Data Flow

### Writing Data
```
1. User clicks "Save Mood"
2. MoodTracker component calls store action
3. Store action validates with Zod schema
4. MoodService.add() writes to IndexedDB
5. If online, sync to Supabase
6. Store updates local state
7. Component re-renders with new data
```

### Reading Data
```
1. Component mounts
2. useEffect triggers data fetch
3. MoodService.getAll() reads from IndexedDB
4. Data returned (validated on write, trusted on read)
5. Store populates state
6. Component renders data
```

### Syncing Data
```
1. App detects online status change
2. SyncService checks pending queue
3. Queued operations sent to Supabase
4. Supabase responds with merged data
5. IndexedDB updated with server state
6. Store refreshed with latest data
```

---

## Technology Decisions

### React 19.1 (Latest)
- Concurrent features for smooth animations
- Automatic batching for state updates
- Strict mode for development warnings

### Zustand over Redux
- Simpler API, less boilerplate
- Built-in persist middleware
- No provider wrapper needed
- Slice pattern matches domain structure

### IndexedDB over LocalStorage
- Larger storage quota (~50MB+ vs 5MB)
- Async API doesn't block main thread
- Better for binary data (photos)
- Transaction support for data integrity

### Supabase over Firebase
- PostgreSQL (relational) over NoSQL
- Row-level security built-in
- Open source, self-hostable
- Real-time subscriptions included

### Vite over CRA/Next.js
- Faster dev server startup
- Native ES modules in development
- PWA plugin for service worker
- Simpler configuration

### Framer Motion over CSS Animations
- Gesture support (drag, tap, hover)
- AnimatePresence for exit animations
- Spring physics for natural motion
- Layout animations for reflows

---

## PWA Configuration

```javascript
// vite.config.ts - VitePWA plugin
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'supabase-api' }
      }
    ]
  },
  manifest: {
    name: 'My Love',
    short_name: 'MyLove',
    theme_color: '#ec4899',
    display: 'standalone'
  }
})
```

---

## Security Model

### Authentication
- Supabase Auth with email/password
- JWT tokens stored in secure httpOnly cookies
- Refresh token rotation enabled

### Data Access
- Row-level security (RLS) on all Supabase tables
- Partner ID matching required for shared data
- No direct database access from client

### Input Validation
- Zod schemas validate all user input
- HTML sanitization for text content
- File type validation for uploads

---

## Performance Considerations

### Bundle Optimization
- Code splitting by route
- Dynamic imports for heavy components
- Tree shaking enabled

### Rendering
- React.memo for expensive components
- useMemo/useCallback where beneficial
- Virtual scrolling for photo gallery

### Caching
- Service worker caches static assets
- IndexedDB for offline data
- Supabase response caching

### Animations
- GPU-accelerated transforms
- will-change hints for animations
- AnimatePresence with mode="wait"
