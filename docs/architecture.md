# Architecture

## Executive Summary

**My Love** is a production-ready Progressive Web Application (PWA) built as a multi-user platform for couples to share daily love messages, photos, moods, and spontaneous interactions. The application employs a component-based single-page architecture powered by React 19, with offline-first capabilities through IndexedDB and service workers, synchronized multi-user state via Supabase backend, and comprehensive end-to-end testing infrastructure.

**Core Architecture Pattern**: Multi-user SPA with Supabase real-time backend, offline-first data persistence, and authenticated user sessions.

**Project Maturity**: All 6 epics implemented (34 stories complete) - Foundation, Testing Infrastructure, Enhanced Messages, Photo Gallery, Code Quality, and Interactive Connection features are production-ready.

## Project Initialization

This project was initialized using Vite's React-TypeScript template:

```bash
npm create vite@latest my-love -- --template react-ts
```

Additional core dependencies installed:

```bash
npm install zustand framer-motion idb @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer @playwright/test vitest
```

## Decision Summary

| Category             | Decision        | Version  | Affects Epics | Rationale                                                           |
| -------------------- | --------------- | -------- | ------------- | ------------------------------------------------------------------- |
| **UI Framework**     | React           | 19.1.1   | All           | Component-based architecture, strong ecosystem, concurrent features |
| **Language**         | TypeScript      | 5.9.3    | All           | Type safety, better DX, catch errors at compile time                |
| **Build Tool**       | Vite            | 7.1.7    | All           | Fast dev server, optimized builds, native ESM                       |
| **State Management** | Zustand         | 5.0.8    | All           | Simple API, persistence middleware, excellent TypeScript support    |
| **Styling**          | Tailwind CSS    | 3.4.18   | All           | Utility-first, custom themes, rapid development                     |
| **Animations**       | Framer Motion   | 12.23.24 | 1,3,4,6       | Declarative animations, spring physics, gesture support             |
| **Backend**          | Supabase        | 2.81.1   | 6             | Real-time sync, authentication, PostgreSQL, Row Level Security      |
| **Local Data**       | IndexedDB (idb) | 8.0.3    | 1,3,4         | Large storage capacity, async API, offline support                  |
| **PWA**              | vite-plugin-pwa | 0.21.3   | All           | Service worker generation, manifest, offline functionality          |
| **Testing (E2E)**    | Playwright      | 1.56.1   | 2             | Multi-browser support, PWA testing, reliable automation             |
| **Testing (Unit)**   | Vitest          | 4.0.9    | 5             | Fast, Vite-native, excellent TypeScript support                     |
| **Validation**       | Zod             | 3.25.76  | 5,6           | Runtime type checking, schema validation, TypeScript inference      |
| **Icons**            | Lucide React    | 0.548.0  | All           | Consistent icon set, tree-shakeable, customizable                   |
| **Deployment**       | GitHub Pages    | 6.3.0    | All           | Free hosting, HTTPS, simple CI/CD                                   |

## Project Structure

```
my-love/
├── src/
│   ├── components/          # React components (25+ components)
│   │   ├── AdminPanel/      # Custom message management interface
│   │   ├── CountdownTimer/  # Anniversary countdown display
│   │   ├── DailyMessage/    # Main message card with animations
│   │   ├── DisplayNameSetup/# Partner display name configuration
│   │   ├── ErrorBoundary/   # Graceful error handling
│   │   ├── InteractionHistory/ # Poke/kiss interaction log
│   │   ├── Layout/          # Shared layout components
│   │   ├── LoginScreen/     # Supabase authentication UI
│   │   ├── MoodHistory/     # Calendar view of mood entries
│   │   ├── MoodTracker/     # Daily mood logging interface
│   │   ├── Navigation/      # Top navigation bar
│   │   ├── PartnerMoodView/ # View partner's mood history
│   │   ├── PhotoCarousel/   # Full-screen photo lightbox
│   │   ├── PhotoDeleteConfirmation/ # Delete confirmation modal
│   │   ├── PhotoEditModal/  # Photo caption/tag editor
│   │   ├── PhotoGallery/    # Grid view of uploaded photos
│   │   ├── PhotoMemory/     # Photo feature integration
│   │   ├── PhotoUpload/     # Photo upload interface
│   │   ├── PokeKissInterface/ # Poke/kiss interaction buttons
│   │   ├── Settings/        # App configuration panel
│   │   ├── WelcomeButton/   # Landing page CTA
│   │   └── WelcomeSplash/   # Landing screen for new users
│   ├── stores/              # Zustand state management
│   │   ├── slices/          # Feature-specific state slices
│   │   │   ├── messagesSlice.ts    # Message state and rotation
│   │   │   ├── photosSlice.ts      # Photo gallery state
│   │   │   ├── settingsSlice.ts    # User preferences
│   │   │   ├── moodSlice.ts        # Mood tracking state
│   │   │   ├── partnerSlice.ts     # Partner data state
│   │   │   ├── interactionsSlice.ts # Poke/kiss state
│   │   │   └── navigationSlice.ts   # Navigation state
│   │   └── useAppStore.ts   # Combined store with persistence
│   ├── services/            # Data persistence layer
│   │   ├── BaseIndexedDBService.ts  # Generic CRUD operations
│   │   ├── customMessageService.ts  # Message persistence
│   │   ├── photoStorageService.ts   # Photo persistence
│   │   └── supabaseService.ts       # Backend API integration
│   ├── api/                 # Backend integration
│   │   └── supabaseClient.ts # Supabase client singleton
│   ├── validation/          # Input validation layer
│   │   ├── schemas.ts       # Zod validation schemas
│   │   ├── errorMessages.ts # User-friendly error messages
│   │   └── index.ts         # Validation exports
│   ├── config/              # Configuration
│   │   ├── constants.ts     # Pre-configured relationship data
│   │   └── performance.ts   # Performance optimization config
│   ├── utils/               # Utility functions
│   │   ├── themes.ts        # Theme definitions
│   │   ├── storageMonitor.ts # Storage quota monitoring
│   │   └── interactionValidation.ts # Interaction helpers
│   ├── types/               # TypeScript type definitions
│   │   ├── index.ts         # Core type definitions
│   │   └── database.types.ts # Supabase generated types
│   ├── constants/           # Application constants
│   │   └── animations.ts    # Framer Motion animation configs
│   ├── App.tsx              # Root component
│   └── main.tsx             # Application entry point
├── tests/                   # Testing infrastructure
│   ├── e2e/                 # Playwright end-to-end tests
│   └── unit/                # Vitest unit tests
├── public/                  # Static assets
│   └── icons/               # PWA icons
├── docs/                    # Project documentation
│   ├── PRD.md               # Product Requirements Document
│   ├── epics.md             # Epic and story breakdown
│   ├── architecture.md      # This file
│   └── index.md             # Documentation index
├── vite.config.ts           # Vite build configuration
├── playwright.config.ts     # Playwright test configuration
├── vitest.config.ts         # Vitest test configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── package.json             # Dependencies and scripts
```

## Epic to Architecture Mapping

| Epic                               | Components                                                                                                                      | State Slices                               | Services             | Backend Tables             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------- | -------------------------- |
| **Epic 1: Foundation**             | ErrorBoundary, DailyMessage, Settings                                                                                           | settingsSlice, messagesSlice               | BaseIndexedDBService | -                          |
| **Epic 2: Testing**                | -                                                                                                                               | -                                          | -                    | -                          |
| **Epic 3: Enhanced Messages**      | AdminPanel, CustomNotes                                                                                                         | messagesSlice                              | customMessageService | -                          |
| **Epic 4: Photo Gallery**          | PhotoGallery, PhotoCarousel, PhotoUpload, PhotoEditModal, PhotoDeleteConfirmation                                               | photosSlice                                | photoStorageService  | -                          |
| **Epic 5: Code Quality**           | -                                                                                                                               | All slices (refactored)                    | BaseIndexedDBService | -                          |
| **Epic 6: Interactive Connection** | MoodTracker, MoodHistory, PartnerMoodView, PokeKissInterface, InteractionHistory, CountdownTimer, LoginScreen, DisplayNameSetup | moodSlice, partnerSlice, interactionsSlice | supabaseService      | moods, interactions, users |

## Technology Stack Details

### Core Technologies

**Frontend Framework:**

- React 19.1.1 with concurrent features
- TypeScript 5.9.3 strict mode
- Vite 7.1.7 for build tooling

**State Management:**

- Zustand 5.0.8 with feature slices
- Persist middleware for LocalStorage sync
- 7 specialized state slices for domain separation

**Backend & Sync:**

- Supabase 2.81.1 (PostgreSQL + Real-time + Auth)
- Row Level Security for data isolation
- Real-time subscriptions for mood/interaction sync

**Data Persistence:**

- IndexedDB via idb 8.0.3 (photos, messages)
- LocalStorage for Zustand state persistence
- Supabase PostgreSQL for synced data (moods, interactions, users)

**Styling & Animations:**

- Tailwind CSS 3.4.18 with custom theme system
- Framer Motion 12.23.24 for declarative animations
- 4 pre-built themes (Sunset Bliss, Ocean Dreams, Lavender Fields, Rose Garden)

**Testing:**

- Playwright 1.56.1 for E2E testing (Epic 2)
- Vitest 4.0.9 for unit testing (Epic 5)
- @testing-library/react 16.1.0 for component testing
- fake-indexeddb 6.2.5 for testing IndexedDB operations

**Validation & Quality:**

- Zod 3.25.76 for runtime validation
- ESLint + TypeScript ESLint for code quality
- Prettier 3.6.2 for code formatting

### Integration Points

**Supabase Backend:**

- Authentication: Email/password via Supabase Auth
- Database: PostgreSQL with Row Level Security
- Real-time: WebSocket subscriptions for live updates
- API: RESTful via @supabase/supabase-js client

**IndexedDB:**

- Photos: Blob storage with metadata (caption, tags, uploadDate)
- Messages: Custom messages with category and active status

**LocalStorage:**

- Zustand state persistence (settings, favorites, message history)
- Authentication session storage

## Implementation Patterns

### Naming Conventions

**Components:**

- PascalCase for component names: `DailyMessage`, `PhotoGallery`
- PascalCase for component files: `DailyMessage.tsx`

**State Slices:**

- camelCase with "Slice" suffix: `messagesSlice.ts`, `photosSlice.ts`

**Services:**

- camelCase with "Service" suffix: `customMessageService.ts`
- Singleton exports: `export const customMessageService = new CustomMessageService()`

**Database Tables:**

- snake_case: `moods`, `interactions`, `users`

**Database Columns:**

- snake_case: `user_id`, `mood_type`, `created_at`

**TypeScript Interfaces:**

- PascalCase: `Message`, `Photo`, `MoodEntry`

### Code Organization

**Component Structure:**

```typescript
// Component file structure
import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';

interface ComponentProps {
  // Props interface
}

export const Component: React.FC<ComponentProps> = ({ props }) => {
  // Hooks
  const stateValue = useAppStore(state => state.value);

  // Event handlers
  const handleAction = () => {
    // Implementation
  };

  // Render
  return (
    <motion.div>
      {/* Component JSX */}
    </motion.div>
  );
};
```

**State Slice Pattern:**

```typescript
// Feature slice structure
import { StateCreator } from 'zustand';

interface FeatureSlice {
  // State
  data: DataType[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadData: () => Promise<void>;
  updateData: (id: string, updates: Partial<DataType>) => Promise<void>;
}

export const createFeatureSlice: StateCreator<FeatureSlice> = (set, get) => ({
  data: [],
  isLoading: false,
  error: null,

  loadData: async () => {
    set({ isLoading: true });
    try {
      // Load data
      set({ data: loadedData, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
});
```

**Service Pattern:**

```typescript
// Service extending base class
class FeatureService extends BaseIndexedDBService<DataType> {
  protected getStoreName(): string {
    return 'feature_store';
  }

  protected async _doInit(): Promise<void> {
    const db = await openDB<MyLoveDB>('my-love-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('feature_store')) {
          const store = db.createObjectStore('feature_store', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-date', 'createdAt');
        }
      },
    });
    this.db = db;
  }

  // Feature-specific methods
  async getFiltered(filter: FilterType): Promise<DataType[]> {
    // Implementation
  }
}

export const featureService = new FeatureService();
```

### Error Handling

**Global Error Boundary:**

```typescript
// ErrorBoundary component wraps entire app
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Service Layer Errors:**

```typescript
// Centralized error handling in BaseIndexedDBService
protected handleError(operation: string, error: Error): never {
  console.error(`IndexedDB error during ${operation}:`, error);

  if (error.name === 'QuotaExceededError') {
    this.handleQuotaExceeded();
  }

  throw new Error(`Failed to ${operation}: ${error.message}`);
}
```

**Supabase Error Handling:**

```typescript
// Graceful degradation for offline mode
try {
  const { data, error } = await supabase.from('moods').insert(mood);
  if (error) throw error;
} catch (error) {
  // Fall back to local-only storage
  await localMoodService.save(mood);
  console.warn('Offline mode: Mood saved locally');
}
```

### Logging Strategy

**Development Logging:**

```typescript
// Console logging for development
if (import.meta.env.DEV) {
  console.log('[StateUpdate]', { action, payload });
}
```

**Production Error Logging:**

```typescript
// Error boundary logs errors
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  console.error('Component error:', error, errorInfo);
  // Future: Send to error tracking service
}
```

## Consistency Rules

### Date/Time Handling

- **Storage Format**: ISO 8601 strings (`new Date().toISOString()`)
- **Display Format**: Locale-specific via `toLocaleDateString()`
- **Timezone**: User's local timezone (no server timezone conversion needed)

### API Response Format

**Supabase Responses:**

```typescript
const { data, error } = await supabase.from('table').select();

if (error) {
  // Handle error
  throw new Error(error.message);
}

// Use data
```

**Local Service Responses:**

```typescript
// Throw errors on failure, return data on success
async getData(): Promise<DataType[]> {
  try {
    return await this.db.getAll('store_name');
  } catch (error) {
    this.handleError('get data', error);
  }
}
```

### Testing Strategy

**E2E Tests (Playwright):**

- Test complete user journeys
- Validate PWA functionality (offline, service worker)
- Cross-browser testing (Chromium, Firefox, WebKit)
- Use `data-testid` attributes for selectors

**Unit Tests (Vitest):**

- Test utility functions and algorithms
- Test service layer with fake-indexeddb
- Test state slice logic with mocked dependencies
- Fast feedback loop (<5 seconds total)

## Data Architecture

### IndexedDB Schema

**Database**: `my-love-db` (version 2)

**Object Stores:**

**1. messages**

```typescript
interface Message {
  id: number; // Auto-increment primary key
  text: string;
  category: 'reasons' | 'memories' | 'affirmations' | 'future' | 'custom';
  isCustom: boolean;
  isActive: boolean;
  createdAt: Date;
}

// Indexes:
// - by-category (category)
// - by-date (createdAt)
```

**2. photos**

```typescript
interface Photo {
  id: number; // Auto-increment primary key
  data: Blob; // Compressed image blob
  caption: string;
  tags: string[];
  uploadDate: Date;
}

// Indexes:
// - by-date (uploadDate)
```

### Supabase Database Schema

**1. users**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_name TEXT,
  device_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. moods**

```sql
CREATE TABLE moods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mood_type TEXT CHECK (mood_type IN ('loved', 'happy', 'content', 'thoughtful', 'grateful')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moods_user_date ON moods(user_id, created_at);
```

**3. interactions**

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('poke', 'kiss')),
  from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_recipient ON interactions(to_user_id, viewed);
```

### LocalStorage Schema

**Key**: `my-love-storage`

**Persisted State** (via Zustand persist middleware):

```typescript
{
  settings: {
    partnerName: string;
    relationshipStartDate: string;
    theme: 'sunset' | 'ocean' | 'lavender' | 'rose';
  },
  messageHistory: {
    currentIndex: number;
    favoriteIds: number[];
    shownDates: string[];
  },
  navigationState: {
    currentTab: 'home' | 'photos' | 'mood' | 'settings';
  }
}
```

## API Contracts

### Supabase API Endpoints

**Authentication:**

```typescript
// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string,
});

// Sign out
await supabase.auth.signOut();

// Get session
const {
  data: { session },
} = await supabase.auth.getSession();
```

**Moods:**

```typescript
// Save mood
const { data, error } = await supabase.from('moods').insert({
  user_id: string,
  mood_type: MoodType,
  note: string | null,
});

// Get moods
const { data, error } = await supabase
  .from('moods')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**Interactions:**

```typescript
// Send interaction
const { data, error } = await supabase.from('interactions').insert({
  type: 'poke' | 'kiss',
  from_user_id: string,
  to_user_id: string,
});

// Get unviewed interactions
const { data, error } = await supabase
  .from('interactions')
  .select('*')
  .eq('to_user_id', userId)
  .eq('viewed', false);

// Mark as viewed
const { error } = await supabase
  .from('interactions')
  .update({ viewed: true })
  .eq('id', interactionId);
```

## Security Architecture

### Authentication

- **Method**: Supabase Email/Password Auth
- **Session Storage**: LocalStorage (Supabase handles securely)
- **Session Persistence**: Auto-refresh via Supabase client

### Authorization

- **Row Level Security (RLS)**: Enforced at database level
- **Policy**: Users can only access their own data and their partner's data
- **Implementation**: Supabase RLS policies on all tables

**Example RLS Policy:**

```sql
-- Users can view their own moods and their partner's moods
CREATE POLICY "Users can view relevant moods"
ON moods FOR SELECT
USING (
  user_id = auth.uid() OR
  user_id IN (
    SELECT partner_id FROM users WHERE id = auth.uid()
  )
);
```

### Data Protection

- **Client-Side**: No sensitive data in plain text
- **Server-Side**: Supabase handles encryption at rest and in transit
- **HTTPS**: Enforced via GitHub Pages and Supabase

### Content Security

- **XSS Protection**: React escapes content by default
- **Input Validation**: Zod schemas validate all user inputs
- **SQL Injection**: Supabase client prevents SQL injection

## Performance Considerations

### Bundle Optimization

- **Tree-shaking**: Vite eliminates unused code
- **Code splitting**: Route-based with React.lazy() (future enhancement)
- **Asset hashing**: Cache busting via [hash] filenames
- **Compression**: Gzip/Brotli at deployment level

### Runtime Performance

- **Zustand selectors**: Prevent unnecessary re-renders
- **Framer Motion**: GPU-accelerated animations
- **IndexedDB**: Async operations don't block UI
- **Photo pagination**: Lazy loading with `getPage()` method (20 photos per page)
- **Virtual scrolling**: Considered for large photo galleries

### Offline Performance

- **Pre-caching**: All static assets cached by service worker
- **IndexedDB**: No network required for local data access
- **LocalStorage**: Settings persist across sessions
- **Graceful Degradation**: Sync features fall back to local-only mode when offline

### Performance Metrics (Target)

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Lighthouse PWA Score**: 100
- **Bundle Size**: < 300KB (gzipped, includes Supabase client)

## Deployment Architecture

### GitHub Pages Deployment

**Command**: `npm run deploy`

**Process**:

1. Pre-deploy: `npm run build && npm run test:smoke`
2. Build: Production bundle generation
3. Deploy: `gh-pages` pushes `dist/` to `gh-pages` branch
4. Post-deploy: Manual verification check

**Base Path**: `/My-Love/` (configured in vite.config.ts)

**Live URL**: `https://<username>.github.io/My-Love/`

### Environment Variables

**Development**:

```env
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

**Production**:

- Environment variables injected at build time
- No runtime environment variable access (static hosting)

### HTTPS & Security

- GitHub Pages: Automatic HTTPS
- Supabase: HTTPS API endpoints
- Required for: Service workers, Web Share API, PWA features

## Development Environment

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- Git 2.x
- Modern browser (Chrome, Firefox, Safari, Edge)

### Setup Commands

```bash
# Clone repository
git clone https://github.com/<username>/My-Love.git
cd My-Love

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
EOF

# Start development server
npm run dev
# → http://localhost:5173/My-Love/

# Run E2E tests
npm run test:e2e

# Run unit tests
npm run test:unit

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

### Development Workflow

1. **Feature Development**: Create feature branch
2. **Implementation**: Write code with tests
3. **Testing**: Run E2E and unit tests
4. **Code Review**: Manual review (solo developer: self-review)
5. **Deployment**: Merge to main, deploy to GitHub Pages

## Architecture Decision Records (ADRs)

### ADR-001: Multi-User Architecture via Supabase

**Context**: Project evolved from single-user prototype to multi-user couple app requiring real-time sync.

**Decision**: Implement Supabase backend for authentication, data sync, and real-time features.

**Rationale**:

- Free tier sufficient for personal use
- Built-in authentication and Row Level Security
- Real-time subscriptions for live mood/interaction updates
- PostgreSQL backend for complex queries

**Consequences**:

- ✅ Multi-device sync for both users
- ✅ Real-time interaction notifications
- ✅ Secure data isolation via RLS
- ❌ Internet required for sync features (offline mode still works for local data)

### ADR-002: State Management with Feature Slices

**Context**: Original 1,268-line monolithic store became unmaintainable.

**Decision**: Split into 7 feature-specific slices (messages, photos, settings, mood, partner, interactions, navigation).

**Rationale**:

- Separation of concerns
- Easier testing and maintenance
- Better TypeScript inference
- Clear domain boundaries

**Consequences**:

- ✅ Improved maintainability
- ✅ Easier to test individual features
- ✅ Better TypeScript support
- ❌ Slightly more boilerplate for slice creation

### ADR-003: BaseIndexedDBService for Code Reuse

**Context**: MessagesService and PhotosService duplicated ~80% of CRUD logic.

**Decision**: Extract common operations into generic `BaseIndexedDBService<T>`.

**Rationale**:

- DRY principle
- Consistent error handling
- Type-safe operations via generics
- Easier to add new services (e.g., MoodService)

**Consequences**:

- ✅ Reduced code duplication by 80%
- ✅ Consistent CRUD patterns
- ✅ Easier to maintain and extend
- ❌ Slight learning curve for generic typing

### ADR-004: Zod for Runtime Validation

**Context**: Need to validate user inputs and prevent corrupted data in IndexedDB/Supabase.

**Decision**: Centralize validation using Zod schemas.

**Rationale**:

- Runtime type checking
- TypeScript type inference from schemas
- User-friendly error messages
- Validation at service boundary

**Consequences**:

- ✅ Type-safe runtime validation
- ✅ Prevents invalid data persistence
- ✅ Clear error messages for users
- ❌ Additional bundle size (~14KB)

### ADR-005: Comprehensive E2E Testing with Playwright

**Context**: Rapid feature development risked introducing regressions.

**Decision**: Implement comprehensive E2E testing infrastructure (Epic 2).

**Rationale**:

- Validate complete user journeys
- Test PWA functionality (offline, service worker)
- Multi-browser support
- Reliable automation

**Consequences**:

- ✅ Confidence in refactoring
- ✅ Catch bugs before production
- ✅ PWA features validated
- ❌ Test execution time (~5 minutes)

### ADR-006: Pre-Configuration via Build-Time Constants

**Context**: Single intended user (girlfriend) - onboarding flow adds friction.

**Decision**: Pre-configure relationship data in `src/config/constants.ts` at build time.

**Rationale**:

- Frictionless experience for target user
- No setup wizard needed
- Values bundled at build time
- Settings still editable if needed

**Consequences**:

- ✅ Zero onboarding friction
- ✅ Immediate app usage
- ✅ Simple deployment
- ❌ Not suitable for public multi-user deployment (intentional design choice)

---

_Generated by BMAD Architecture Workflow v1.0_
_Date: 2025-11-15_
_For: Frank_
_Project: My-Love (Production-Ready Multi-User PWA)_
