# Architecture Documentation

## Executive Summary

**My Love** is a Progressive Web Application (PWA) built to deliver daily love messages to a significant other. The application employs a component-based single-page architecture powered by React 19, with offline-first capabilities through IndexedDB and service workers. State management is centralized using Zustand with persistence middleware, ensuring user data survives browser sessions.

**Core Architecture Pattern**: Component-based SPA with centralized state management and offline-first data persistence.

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **UI Framework** | React | 19.1.1 | Component-based UI rendering |
| **Language** | TypeScript | 5.9.3 | Type-safe development |
| **Build Tool** | Vite | 7.1.7 | Fast dev server and optimized builds |
| **State Management** | Zustand | 5.0.8 | Lightweight global state with persistence |
| **Styling** | Tailwind CSS | 3.4.18 | Utility-first CSS framework |
| **Animations** | Framer Motion | 12.23.24 | Declarative animations and transitions |
| **Data Layer** | IndexedDB (via idb) | 8.0.3 | Client-side structured data storage |
| **PWA** | vite-plugin-pwa | 0.21.3 | Service worker and manifest generation |
| **Deployment** | gh-pages | 6.3.0 | GitHub Pages deployment |

## Architecture Patterns

### 1. Component-Based Architecture

**Story 1.4 Update**: Onboarding component removed from render path for single-user deployment.
**Story 1.5 Update**: ErrorBoundary component added for graceful error handling; Onboarding files deleted.

The application follows a simple component structure:

```
App (Root)
└── ErrorBoundary (Story 1.5 - Graceful error handling)
    └── DailyMessage (Main app view - always rendered)
        ├── Header (relationship stats)
        ├── Message Card (animated content)
        │   ├── Category Badge
        │   ├── Message Text
        │   └── Action Buttons (favorite, share)
        └── Navigation Hint
```

**Removed Components** (Story 1.5):
- ~~Onboarding~~ - First-time setup wizard (removed in Story 1.4, files deleted in Story 1.5)
  - Functionality replaced by environment-based pre-configuration
  - Dead code cleanup completed

**Future Components** (planned but not yet implemented):
- PhotoMemory - Photo gallery with captions
- MoodTracker - Daily mood logging interface
- CountdownTimer - Anniversary countdown display
- CustomNotes - User-created custom messages
- Settings - App configuration panel (can edit pre-configured values)
- Layout - Shared layout components (header, footer, navigation)

### 2. Single Page Application (SPA)

**Story 1.4 Update**: Simplified to single-view architecture.

- **No routing library**: Single main view (DailyMessage)
- **No conditional rendering**: Always renders DailyMessage
- **Pre-configuration**: Settings initialized from hardcoded constants at build time
- **Configuration**: Edit `src/config/constants.ts` directly with hardcoded values
- **Future enhancement**: React Router for multi-page navigation when features expand

### 3. Offline-First Architecture

The application is designed to work seamlessly without network connectivity:

- **Service Worker**: Pre-caches all static assets (JS, CSS, HTML, images)
- **IndexedDB**: Stores photos and messages locally
- **LocalStorage**: Persists settings and small state
- **PWA Manifest**: Enables installation and standalone mode

## Data Architecture

### IndexedDB Schema

**Database**: `my-love-db` (version 1)

```typescript
interface MyLoveDB {
  photos: {
    key: number;              // Auto-increment primary key
    value: Photo;
    indexes: {
      'by-date': Date;        // Index by uploadDate
    }
  };

  messages: {
    key: number;              // Auto-increment primary key
    value: Message;
    indexes: {
      'by-category': string;  // Index by message category
      'by-date': Date;        // Index by createdAt
    }
  };
}
```

**Object Stores**:

| Store | Purpose | Indexes | Key Path |
|-------|---------|---------|----------|
| `photos` | User-uploaded photos with captions | `by-date` (uploadDate) | `id` (auto-increment) |
| `messages` | Love messages (default + custom) | `by-category`, `by-date` | `id` (auto-increment) |

### LocalStorage Schema

**Storage Key**: `my-love-storage`

**Persisted State** (via Zustand persist middleware):
- `settings` - User preferences and relationship data
- `isOnboarded` - Onboarding completion flag
- `messageHistory` - Message rotation tracking
- `moods` - Daily mood entries

**Non-Persisted State** (in-memory only):
- `messages` - Loaded from IndexedDB on app init
- `photos` - Loaded from IndexedDB on demand
- `currentMessage` - Computed daily from messages
- `isLoading`, `error` - Runtime states

### Data Flow

```
User Action → Component → Zustand Store Action → Service Layer → IndexedDB/LocalStorage
                                ↓
                            State Update
                                ↓
                        Component Re-render
```

**Example: Toggling a favorite**
1. User clicks heart icon in DailyMessage component
2. Component calls `toggleFavorite(messageId)` action
3. Store updates IndexedDB via `storageService.toggleFavorite()`
4. Store updates in-memory message state
5. Store updates `messageHistory.favoriteIds` in LocalStorage
6. Component re-renders with updated favorite state

### Service Layer

**Story 5.3**: Extracted BaseIndexedDBService generic class to reduce code duplication by ~80% across IndexedDB services.

The service layer encapsulates all IndexedDB operations, providing a clean abstraction for data persistence. All services extend a generic base class that implements common CRUD operations, reducing boilerplate and ensuring consistency.

#### BaseIndexedDBService<T>

**Purpose**: Generic base class for IndexedDB CRUD operations

**Type Constraint**: `<T extends { id?: number }>` ensures all entities have an optional id field for auto-increment keys

**Abstract Methods** (must be implemented by services):
- `getStoreName(): string` - Returns object store name ('messages', 'photos', 'moods')
- `_doInit(): Promise<void>` - DB-specific initialization and schema upgrade logic

**Shared Methods** (inherited by all services):
- `init(): Promise<void>` - Initialization guard to prevent concurrent DB setup
- `add(item: Omit<T, 'id'>): Promise<T>` - Add new item with auto-generated ID
- `get(id: number): Promise<T | null>` - Get single item by ID
- `getAll(): Promise<T[]>` - Get all items from store
- `update(id: number, updates: Partial<T>): Promise<void>` - Update existing item
- `delete(id: number): Promise<void>` - Delete item by ID
- `clear(): Promise<void>` - Clear entire store
- `getPage(offset: number, limit: number): Promise<T[]>` - Pagination helper
- `handleError(operation: string, error: Error): never` - Centralized error logging
- `handleQuotaExceeded(): never` - Storage quota error handling

**File**: `src/services/BaseIndexedDBService.ts` (239 lines)

#### CustomMessageService

**Extends**: `BaseIndexedDBService<Message>`

**Purpose**: IndexedDB CRUD operations for love messages (default + custom)

**Implementation**:
- `getStoreName()` returns `'messages'`
- `_doInit()` creates messages store with `by-category` and `by-date` indexes

**Inherited Methods**:
- Basic CRUD: `add()`, `get()`, `update()`, `delete()`, `getAll()`

**Service-Specific Methods**:
- `create(input: CreateMessageInput): Promise<Message>` - Create custom message (wraps `add()` with validation)
- `getAll(filter?: MessageFilter): Promise<Message[]>` - Overridden to support category index and filtering
- `getActiveCustomMessages(): Promise<Message[]>` - Get only active custom messages for rotation
- `exportMessages(): Promise<CustomMessagesExport>` - Export custom messages to JSON
- `importMessages(data: CustomMessagesExport): Promise<{imported, skipped}>` - Import with duplicate detection

**Singleton Export**: `export const customMessageService = new CustomMessageService()`

**File**: `src/services/customMessageService.ts` (290 lines, reduced from 299 lines)

#### PhotoStorageService

**Extends**: `BaseIndexedDBService<Photo>`

**Purpose**: IndexedDB CRUD operations for user-uploaded photos with metadata

**Implementation**:
- `getStoreName()` returns `'photos'`
- `_doInit()` handles v1→v2 migration, creates photos store with `by-date` index

**Inherited Methods**:
- Basic CRUD: `add()`, `get()`, `update()`, `delete()`

**Service-Specific Methods**:
- `create(photo: Omit<Photo, 'id'>): Promise<Photo>` - Create photo with logging (wraps `add()`)
- `getAll(): Promise<Photo[]>` - Overridden to use `by-date` index for efficient chronological retrieval
- `getPage(offset, limit): Promise<Photo[]>` - Overridden for custom index-based pagination
- `getStorageSize(): Promise<number>` - Calculate total storage usage for quota warnings
- `estimateQuotaRemaining(): Promise<QuotaInfo>` - Estimate remaining IndexedDB quota

**Singleton Export**: `export const photoStorageService = new PhotoStorageService()`

**File**: `src/services/photoStorageService.ts` (239 lines, reduced from 322 lines)

#### Service Architecture Diagram

```
┌─────────────────────────────────────────┐
│   BaseIndexedDBService<T>               │
│   - Generic CRUD operations             │
│   - Initialization guard                │
│   - Error handling                      │
│   - Abstract: getStoreName(), _doInit() │
└────────────┬────────────────────────────┘
             │ extends
             │
     ┌───────┴─────────┐
     │                 │
┌────▼────────┐  ┌────▼────────┐
│CustomMessage│  │PhotoStorage │
│Service      │  │Service      │
│<Message>    │  │<Photo>      │
│- messages   │  │- photos     │
│  store      │  │  store      │
│- export/    │  │- quota      │
│  import     │  │  tracking   │
└─────────────┘  └─────────────┘
```

**Code Duplication Reduction** (Story 5.3):
- Before: 621 lines total (299 + 322)
- After: 768 lines total (239 base + 290 messages + 239 photos)
- Base class extracts ~170 lines of shared logic now reusable across all services
- PhotoStorageService reduced by 83 lines (-26%)
- Future services (MoodService) will leverage base class, amplifying efficiency gains

**Benefits**:
- **Consistency**: All services use same CRUD patterns
- **Maintainability**: Bug fixes in base class apply to all services
- **Type Safety**: Generic type parameter enforces id field constraint
- **Extensibility**: New services only implement store-specific logic
- **Testing**: Base class can be unit tested once, services test only custom logic

## Component Overview

### Implemented Components

#### DailyMessage Component
**Purpose**: Main application view displaying the daily love message

**Features**:
- Animated message card with category badge
- Relationship duration counter (days together)
- Favorite toggle with floating hearts animation
- Share functionality (Web Share API with clipboard fallback)
- 3D rotation entrance animation
- Responsive design (mobile-first)

**State Dependencies**:
- `currentMessage` - The message to display
- `settings` - For relationship start date
- `toggleFavorite` - Action to favorite/unfavorite

**Animations**:
- Card entrance: scale + 3D rotation
- Hearts burst: 10 floating hearts on favorite
- Decorative hearts: continuous subtle pulse
- Category badge: scale pop-in

#### ErrorBoundary Component (Story 1.5)
**Purpose**: Graceful error handling with fallback UI

**Features**:
- Catches React component errors using `getDerivedStateFromError()`
- Logs errors with context using `componentDidCatch()`
- Displays user-friendly error screen with retry button
- Prevents entire app crash from propagating errors
- Resets error state on retry to allow recovery

**Error UI Components**:
- Broken heart emoji (💔) for visual indication
- Clear error message: "Something went wrong"
- Technical error details (error.message) for debugging
- Retry button to reset error state and attempt recovery

#### ~~Onboarding Component~~ (REMOVED - Story 1.5)
**Status**: Files deleted in Story 1.5, no longer in codebase

**Original Purpose**: First-time user setup wizard

**Replacement**: Hardcoded pre-configuration via constants in `src/config/constants.ts`. Settings automatically initialized on first app load without user interaction.

**Rationale for Removal**: Single-user deployment pattern doesn't require generic onboarding flow. Pre-configuration provides frictionless experience for target use case.

### Planned Components

| Component | Purpose | Features |
|-----------|---------|----------|
| **PhotoMemory** | Photo gallery | Upload, caption, tag photos; grid view; lightbox |
| **MoodTracker** | Daily mood logging | 5 mood types; note field; calendar view; mood trends |
| **CountdownTimer** | Anniversary countdown | Days/hours/minutes to next anniversary; animations |
| **CustomNotes** | User messages | Create custom messages; category selection; preview |
| **Settings** | App configuration | Theme switcher; notification settings; data export/import |
| **Layout** | Shared UI | Header, footer, navigation, theme wrapper |

## State Management

### Zustand Store Architecture

**Single Store**: `useAppStore` (no store splitting)

**Store Structure**:
```typescript
interface AppState {
  // State slices
  settings: Settings | null;
  isOnboarded: boolean;
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;
  moods: MoodEntry[];
  isLoading: boolean;
  error: string | null;

  // Actions (15 total)
  initializeApp: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setOnboarded: (onboarded: boolean) => void;
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: MessageCategory) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;
  addMoodEntry: (mood: MoodType, note?: string) => void;
  getMoodForDate: (date: string) => MoodEntry | undefined;
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void;
  removeAnniversary: (id: number) => void;
  setTheme: (theme: ThemeName) => void;
}
```

**Persistence Strategy**:
- **Middleware**: `persist` from `zustand/middleware`
- **Storage**: LocalStorage (`my-love-storage` key)
- **Partialize**: Only persists critical state (settings, isOnboarded, messageHistory, moods)
- **Merge Strategy**: Deep merge on hydration

### State Initialization Flow

**Story 1.4 Update**: Pre-configuration injection added before IndexedDB initialization.

```
1. App.tsx mounts
2. useEffect calls initializeApp()
3. initializeApp checks if settings === null
   - If null AND env vars present → inject pre-configured Settings
   - If null AND env vars missing → log warning (graceful degradation)
   - If settings exist → preserve (don't override user edits)
4. initializeApp initializes IndexedDB
5. Loads messages from IndexedDB
6. If empty, populates with 100 default messages
7. Updates currentMessage based on date
8. Sets isLoading = false
9. App renders DailyMessage (always, no conditional)
```

**Configuration**:
- Source: `src/config/constants.ts` exports `APP_CONFIG` object with hardcoded values
- Values: `defaultPartnerName`, `defaultStartDate` directly set in source code
- How it works: Developer edits constants.ts, values are bundled at build time
- Validation: `APP_CONFIG.isPreConfigured` flag indicates if values are set
- Transparency: Constants committed to version control (intentional for single-user app)

## PWA Architecture

### Service Worker Strategy

**Plugin**: `vite-plugin-pwa` with Workbox

**Registration**: Auto-update mode (no user prompt)

**Caching Strategies**:

| Resource Type | Strategy | Cache Name | Expiration |
|--------------|----------|------------|------------|
| App shell (JS, CSS, HTML) | CacheFirst | `workbox-precache-v2` | Never (versioned) |
| Google Fonts | CacheFirst | `google-fonts-cache` | 1 year, 10 entries max |
| Images (PNG, JPG, SVG) | CacheFirst | `workbox-precache-v2` | Never (versioned) |
| Runtime requests | NetworkFirst | `workbox-runtime-cache` | Default |

**Pre-cached Assets** (glob pattern):
```javascript
globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,woff2}']
```

### PWA Manifest

**Configuration** (defined in `vite.config.ts`):
```json
{
  "name": "My Love - Daily Reminders",
  "short_name": "My Love",
  "description": "Daily love notes and memories",
  "theme_color": "#FF6B9D",
  "background_color": "#FFE5EC",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "purpose": "any maskable" }
  ]
}
```

**Capabilities**:
- Installable to home screen (iOS, Android, Desktop)
- Standalone display (no browser chrome)
- Portrait-only orientation
- Splash screen on app launch
- Offline functionality

## Development Workflow

### Local Development

```bash
npm run dev  # Start Vite dev server on port 5173
```

**Features**:
- Hot Module Replacement (HMR)
- Fast refresh for React components
- TypeScript compilation on save
- Tailwind CSS processing
- Source maps for debugging

**URL**: `http://localhost:5173/My-Love/`

### Build Process

```bash
npm run build  # TypeScript compile + Vite bundle + PWA generation
```

**Steps**:
1. **TypeScript Compilation**: `tsc -b` (type checking)
2. **Vite Bundling**: JSX/TSX → JS, tree-shaking, minification
3. **CSS Processing**: Tailwind → PostCSS → optimized CSS
4. **Asset Optimization**: Image compression, font subsetting
5. **PWA Generation**: Service worker, manifest, icons
6. **Output**: `dist/` directory ready for deployment

**Output Structure**:
```
dist/
├── assets/              # Hashed JS and CSS bundles
├── icons/               # PWA icons
├── index.html           # Entry point
├── manifest.webmanifest # PWA manifest
└── sw.js                # Service worker
```

### Testing Strategy

**Manual Testing**:
- Browser DevTools for IndexedDB inspection
- Application tab for service worker status
- Network throttling for offline testing
- Lighthouse for PWA score

**Offline Testing**:
1. Build: `npm run build`
2. Preview: `npm run preview`
3. Open DevTools → Application → Service Workers
4. Network tab → Offline checkbox
5. Verify app still functions

## Deployment Architecture

### GitHub Pages Deployment

**Command**: `npm run deploy`

**Tool**: `gh-pages` package

**Process**:
1. Builds production bundle
2. Pushes `dist/` to `gh-pages` branch
3. GitHub Pages serves from branch root

**Base Path**: `/My-Love/` (configured in `vite.config.ts`)

**Live URL**: `https://<username>.github.io/My-Love/`

### HTTPS Enforcement

- GitHub Pages automatically serves over HTTPS
- Required for PWA features (service workers, notifications)
- Web Share API requires secure context

## Performance Considerations

### Bundle Optimization

- **Tree-shaking**: Vite eliminates unused code
- **Code splitting**: Manual with `React.lazy()` (future)
- **Asset hashing**: Cache busting via `[hash]` filenames
- **Compression**: Gzip/Brotli at server level

### Runtime Performance

- **Zustand selectors**: Prevent unnecessary re-renders
- **Framer Motion**: GPU-accelerated animations
- **IndexedDB**: Async operations don't block UI
- **Debouncing**: For search/filter features (future)

### Offline Performance

- **Pre-caching**: All assets available instantly offline
- **IndexedDB**: No network required for data access
- **LocalStorage**: Settings persist across sessions

## Security Considerations

### Data Privacy

- **No backend**: All data stored client-side
- **No analytics**: No tracking or third-party services
- **No authentication**: Single-user PWA (no login)

### Content Security

- **TypeScript**: Type safety prevents runtime errors
- **Input sanitization**: Future feature for custom messages
- **XSS protection**: React escapes content by default

## Future Architecture Enhancements

### Planned Improvements

1. **React Router**: Multi-page navigation for features
2. **Component lazy loading**: Reduce initial bundle size
3. **Service Worker sync**: Background data sync
4. **Web Push API**: Real notifications (not just permission)
5. **Backup/restore**: Export/import data via JSON
6. **Theme customization**: User-defined color schemes
7. **Photo compression**: Client-side image optimization

### Scalability Considerations

- **IndexedDB limits**: ~1GB typical, ~10GB with permission
- **Message count**: Optimized for ~1000 messages max
- **Photo storage**: Consider compression for large collections
- **State size**: Persist only critical data to LocalStorage

## Developer Resources

- **Architecture Decisions**: See `/docs/development-guide.md`
- **Component Inventory**: See `/docs/component-inventory.md`
- **Data Models**: See `/docs/data-models.md`
- **State Management**: See `/docs/state-management.md`
- **Source Tree**: See `/docs/source-tree-analysis.md`
