# Source Tree Analysis

## Project Structure Overview

**My Love** is organized as a modern React PWA with clear separation of concerns.

```
My-Love/
├── public/                    # Static assets and PWA resources
│   └── icons/                # PWA app icons (192x192, 512x512)
├── src/                      # Application source code
│   ├── components/           # React UI components
│   │   ├── DailyMessage/    # 💕 Main message display card
│   │   └── Onboarding/      # ✨ First-time user setup flow
│   ├── data/                 # Static data and message collections
│   │   └── defaultMessages.ts   # 100 pre-written love messages
│   ├── hooks/                # Custom React hooks (future)
│   ├── services/             # Business logic and data persistence
│   │   └── storage.ts       # IndexedDB wrapper for photos/messages
│   ├── stores/               # State management (Zustand)
│   │   └── useAppStore.ts   # Central application state
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts         # Core types (Message, Photo, Settings, etc.)
│   ├── utils/                # Utility functions
│   │   ├── dateHelpers.ts   # Date manipulation utilities
│   │   ├── messageRotation.ts  # Daily message selection algorithm
│   │   └── themes.ts        # Theme configurations and CSS management
│   ├── App.tsx               # Root application component
│   ├── main.tsx              # Application entry point
│   └── index.css             # Global styles and Tailwind base
├── dist/                     # Production build output
├── docs/                     # 📚 Project documentation (this folder)
├── bmad/                     # BMAD framework (workflow tooling, not part of app)
├── .claude/                  # Claude Code configuration
├── node_modules/             # Dependencies
├── index.html                # HTML entry point
├── package.json              # Dependencies and scripts
├── vite.config.ts            # ⚙️ Vite build configuration + PWA setup
├── tailwind.config.js        # 🎨 Tailwind CSS theme customization
├── tsconfig.json             # TypeScript configuration
├── eslint.config.js          # Code linting rules
├── postcss.config.js         # PostCSS configuration
└── README.md                 # Project documentation

```

## Critical Directories Explained

### `/src/components/` - UI Components
**Purpose**: React components for the user interface

**Current Components**:
- **DailyMessage/**: Primary message display with animations, favorites, sharing
- **Onboarding/**: Multi-step onboarding wizard for first-time setup

**Placeholder Folders** (for future features):
- CountdownTimer/ - Anniversary countdown tracking
- CustomNotes/ - User-created custom notes
- Layout/ - Shared layout components
- MoodTracker/ - Daily mood logging
- PhotoMemory/ - Photo gallery with captions
- Settings/ - App settings and preferences

### `/src/stores/` - State Management
**Purpose**: Centralized application state using Zustand

**Key Store**:
- `useAppStore.ts`: Single source of truth for app state
  - Settings persistence
  - Message history tracking
  - Mood entries
  - Onboarding status
  - IndexedDB initialization

### `/src/services/` - Data Layer
**Purpose**: Business logic and data persistence abstractions

**Services**:
- `storage.ts`: IndexedDB operations
  - Photo CRUD operations
  - Message CRUD operations
  - Bulk operations for initial data load
  - Export/import functionality

### `/src/types/` - Type Definitions
**Purpose**: TypeScript interfaces and types

**Core Types**:
- Message, Photo, Anniversary, MoodEntry
- Settings, MessageHistory, AppState
- ThemeName, MessageCategory, MoodType
- Theme configuration interface

### `/src/utils/` - Utility Functions
**Purpose**: Reusable helper functions

**Utilities**:
- `messageRotation.ts`: Deterministic daily message selection with favorites prioritization
- `themes.ts`: Theme management with CSS variable injection
- `dateHelpers.ts`: Date formatting and calculations

### `/src/data/` - Static Data
**Purpose**: Pre-populated content

**Data Files**:
- `defaultMessages.ts`: 100 curated love messages across 5 categories

## Entry Points

### Application Entry: `src/main.tsx`
- React 19 StrictMode wrapper
- Root component mounting
- Global CSS injection

### Root Component: `src/App.tsx`
- App initialization on mount
- Theme application
- Conditional routing (Onboarding vs DailyMessage)
- Loading state handling

### Build Configuration: `vite.config.ts`
- React plugin configuration
- PWA manifest and service worker setup
- Workbox caching strategies
- Base path for GitHub Pages deployment

## Integration Points

### IndexedDB Integration
- **Stores**: `photos`, `messages`
- **Indexes**: by-date, by-category
- **Accessed via**: `services/storage.ts`

### LocalStorage Integration
- **Purpose**: Settings and small data persistence
- **Managed by**: Zustand persist middleware
- **Storage key**: `my-love-storage`

### Service Worker Integration
- **Provider**: Vite PWA plugin + Workbox
- **Strategy**: CacheFirst for fonts, NetworkFirst for app shell
- **Auto-update**: Enabled for seamless updates

### Browser APIs
- **Notification API**: Daily reminder notifications (onboarding setup)
- **Share API**: Native sharing with clipboard fallback
- **Web App Manifest**: Installable PWA configuration

## Build & Deployment Structure

### Development
- Entry: `npm run dev`
- Server: Vite dev server on port 5173
- HMR: Fast refresh for React components

### Production Build
- Command: `npm run build`
- Output: `dist/` directory
- Process: TypeScript compilation → Vite bundling → PWA generation

### Deployment
- Target: GitHub Pages
- Command: `npm run deploy`
- Tool: gh-pages package
- Base path: `/My-Love/`

## Code Organization Patterns

### Component Structure
```typescript
// Standard component pattern
import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/useAppStore';

export function ComponentName() {
  const { state, actions } = useAppStore();

  return (
    <motion.div>
      {/* Animated component content */}
    </motion.div>
  );
}
```

### Store Pattern
```typescript
// Zustand store with persist
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State
      // Actions
    }),
    { name: 'storage-key' }
  )
);
```

### Service Pattern
```typescript
// Singleton service class
class StorageService {
  private db: IDBPDatabase | null = null;
  async init() { /* ... */ }
  async method() { /* ... */ }
}
export const storageService = new StorageService();
```

## Technology Markers

- **React**: JSX/TSX files in `src/components/`
- **TypeScript**: `.ts` and `.tsx` extensions throughout
- **Tailwind CSS**: `tailwind.config.js` + utility classes
- **Vite**: `vite.config.ts` build configuration
- **PWA**: Manifest in vite config, service worker registration
- **Zustand**: Single store in `src/stores/useAppStore.ts`
- **IndexedDB**: Schema defined in `services/storage.ts`
- **Framer Motion**: Animation library for UI components
