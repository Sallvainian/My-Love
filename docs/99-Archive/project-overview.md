# My Love - Project Overview

> **Last Updated**: 2025-11-16
> **Version**: 1.0.0 (Feature Complete)
> **Documentation Level**: Exhaustive Scan

## What is My Love?

**My Love** is a full-featured Progressive Web Application (PWA) for couples to share daily love messages, track moods, store photo memories, and interact with each other in real-time. It evolved from a simple message display app to a comprehensive relationship companion with cloud synchronization via Supabase.

Think of it as a digital relationship journal that combines daily affirmations, emotional tracking, photo memories, and playful partner interactions - all with offline-first architecture and real-time sync.

## Current Features (Implemented)

### Daily Love Messages

- **365 pre-written messages** across 10 categories
- Deterministic rotation algorithm (same message for everyone on same day)
- Horizontal swipe navigation to view message history (backward only)
- Favorite toggle with animated heart effects
- Share button with native share API
- Message category badges
- Relationship day counter
- 3D card flip animations with Framer Motion

### Photo Memory Gallery

- Drag-and-drop photo upload with compression
- Grid gallery with lazy loading and infinite scroll
- Full-screen carousel viewer with swipe gestures
- Pinch-to-zoom and keyboard navigation
- Photo metadata editing (caption, date)
- Secure deletion with confirmation
- Thumbnail generation for performance
- IndexedDB storage with pagination

### Mood Tracking System

- 12 emotion options (6 positive: loved, happy, content, grateful, excited, peaceful; 6 negative: anxious, sad, frustrated, tired, stressed, overwhelmed)
- Multi-select capability (select multiple moods simultaneously)
- Intensity slider (1-5 scale)
- Optional notes (500 character limit)
- Rate limiting (max 10 entries/hour)
- Monthly calendar view with color-coded intensity
- Click day to view detailed mood history
- Local-first with Supabase cloud sync

### Partner Interaction

- **Poke/Kiss Interface**: Send playful interactions to partner
- Rate limiting (30-second cooldown)
- Haptic feedback support
- Animation burst on send
- Real-time delivery via Supabase Realtime
- Interaction history timeline
- Unread badges and notifications

### Anniversary Countdowns

- Track multiple important dates
- Real-time countdown timer (days/hours/minutes)
- Recurring vs one-time event toggle
- Reminder day configuration
- Celebration animations when dates arrive
- Past event handling

### Admin Panel (Custom Message Management)

- View all 365 default + custom messages
- Create new custom messages
- Edit existing messages (custom only)
- Delete custom messages
- Category assignment
- Search and filter capability
- Pagination (20 per page)
- Preview before save

### Authentication System

- Email/password login via Supabase Auth
- User registration flow
- "Forgot password" recovery
- Remember me option
- Session management
- Auto-redirect on authentication
- Display name setup post-login

### User Settings

- 4 romantic color themes (Sunset Bliss, Ocean Dreams, Lavender Fields, Rose Garden)
- Display name editing
- Partner name configuration
- Relationship start date
- Anniversary management
- Data export options
- Logout functionality
- App version display

### PWA Capabilities

- Install to home screen (mobile and desktop)
- Full offline functionality with service worker
- Intelligent caching via Workbox
- Native app-like experience
- Background sync when online
- No app store required

## Technology Stack

### Core Framework

| Technology     | Version | Purpose                           |
| -------------- | ------- | --------------------------------- |
| **React**      | 19.1.1  | Component-based UI framework      |
| **TypeScript** | 5.9.3   | Type-safe development             |
| **Vite**       | 7.1.7   | Build tool and dev server         |
| **Zustand**    | 5.0.8   | State management with persistence |

### Backend & Data

| Technology              | Version | Purpose                                         |
| ----------------------- | ------- | ----------------------------------------------- |
| **Supabase**            | 2.81.1  | Backend-as-a-Service (Auth, Database, Realtime) |
| **IndexedDB** (via idb) | 8.0.3   | Client-side photo/message storage               |
| **LocalStorage**        | Native  | Settings and small data persistence             |
| **Zod**                 | 3.23.8  | Runtime type validation and schemas             |

### Styling & UI

| Technology        | Version  | Purpose                 |
| ----------------- | -------- | ----------------------- |
| **Tailwind CSS**  | 3.4.18   | Utility-first styling   |
| **Framer Motion** | 12.23.24 | Animations and gestures |
| **Lucide React**  | 0.475.0  | Icon library            |

### Testing & Quality

| Technology     | Version | Purpose                  |
| -------------- | ------- | ------------------------ |
| **Vitest**     | 1.6.1   | Unit testing framework   |
| **Playwright** | 1.52.0  | End-to-end testing       |
| **ESLint**     | 9.19.0  | Code quality and linting |

### PWA Infrastructure

| Technology          | Version      | Purpose                        |
| ------------------- | ------------ | ------------------------------ |
| **vite-plugin-pwa** | 0.21.3       | Service worker generation      |
| **Workbox**         | (via plugin) | Intelligent caching strategies |

## Architecture Overview

### Pattern

**Component-based Single Page Application with Offline-First PWA Architecture**

### Layered Architecture

```
┌─────────────────────────────────────┐
│         UI Layer (React)            │
│    20 Components, 48 TSX Files      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       State Layer (Zustand)         │
│   7 Slices, 59 Actions, Persist     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Service Layer (Business)       │
│   10 Services, Validation, Sync     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         API Layer (Supabase)        │
│    8 API Services, Real-time        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Storage Layer (Hybrid)        │
│ IndexedDB │ LocalStorage │ Supabase │
└─────────────────────────────────────┘
```

### Data Flow

**Unidirectional**: User Action → Store Action → Service Layer → API/Storage → State Update → UI Re-render

### Persistence Strategy

| Data Type         | Storage Location        | Sync Strategy                     |
| ----------------- | ----------------------- | --------------------------------- |
| Photos            | IndexedDB               | Local-only (future: cloud backup) |
| Messages (custom) | IndexedDB               | Local-only                        |
| Mood Entries      | LocalStorage + Supabase | Real-time sync                    |
| User Settings     | LocalStorage            | Local-only                        |
| Interactions      | Supabase                | Real-time sync                    |
| Auth State        | Supabase Auth           | Cloud-managed                     |

## Project Statistics

### Codebase Metrics

- **Total Source Files**: 90 TypeScript files
- **Total Directories**: 38
- **Components**: 20 implemented across 48 TSX files
- **Store Slices**: 7 with 59 actions total
- **API Services**: 8 modules
- **Business Services**: 10 classes
- **Utility Modules**: 7
- **Validation Schemas**: 12+ Zod schemas

### Feature Breakdown

| Domain              | Components | Files                                                                             |
| ------------------- | ---------- | --------------------------------------------------------------------------------- |
| Photo Management    | 6          | PhotoUpload, PhotoGallery, PhotoCarousel, PhotoEditModal, PhotoDeleteConfirmation |
| Mood Tracking       | 4          | MoodTracker, MoodHistory, PartnerMoodView                                         |
| Message System      | 7          | DailyMessage, AdminPanel (6 sub-components)                                       |
| Authentication      | 3          | LoginScreen, DisplayNameSetup, WelcomeSplash                                      |
| Partner Interaction | 2          | PokeKissInterface, InteractionHistory                                             |
| Navigation          | 1          | BottomNavigation                                                                  |
| Settings            | 2          | Settings, AnniversarySettings                                                     |
| Core                | 3          | CountdownTimer, ErrorBoundary, WelcomeButton                                      |

## Project Goals

### Primary Goals (Achieved)

1. **Daily Connection**: Provide consistent touchpoints for relationship nurturing
2. **Emotional Tracking**: Enable couples to understand emotional patterns
3. **Memory Preservation**: Store and revisit shared memories
4. **Real-time Interaction**: Allow playful, instant partner communication
5. **Offline Resilience**: Function fully without internet connectivity

### Design Principles

- **Local-First**: Data owned by user, sync as enhancement
- **Privacy-Conscious**: Minimal data collection, transparent storage
- **Performance-Oriented**: Sub-second interactions, optimized rendering
- **Accessible**: WCAG AA compliance, keyboard navigation, screen reader support
- **Delightful UX**: Smooth animations, intuitive interactions

## Project Structure

```
My-Love/
├── src/                           # Application source (90 files)
│   ├── api/                       # 8 Supabase API services
│   │   ├── authApi.ts            # Authentication endpoints
│   │   ├── moodApi.ts            # Mood sync operations
│   │   ├── realtimeService.ts    # WebSocket subscriptions
│   │   └── ...
│   ├── components/                # 20 UI components (48 files)
│   │   ├── PhotoGallery/         # Photo management suite
│   │   ├── MoodTracker/          # Mood tracking interface
│   │   ├── AdminPanel/           # Message management
│   │   ├── Settings/             # User preferences
│   │   └── ...
│   ├── services/                  # 10 business logic services
│   │   ├── BaseIndexedDBService.ts
│   │   ├── photoStorageService.ts
│   │   ├── syncService.ts
│   │   └── ...
│   ├── stores/slices/            # 7 Zustand state slices
│   │   ├── settingsSlice.ts      # 12 actions
│   │   ├── messagesSlice.ts      # 11 actions
│   │   ├── photosSlice.ts        # 9 actions
│   │   ├── moodSlice.ts          # 10 actions
│   │   └── ...
│   ├── types/                    # TypeScript definitions (35+ interfaces)
│   ├── utils/                    # 7 utility modules
│   ├── validation/               # Zod schemas
│   ├── App.tsx                   # Root component with routing
│   └── main.tsx                  # Application entry point
├── public/                       # Static assets (icons, manifest)
├── docs/                         # Comprehensive documentation
│   ├── index.md                  # Master documentation index
│   ├── project-overview.md       # This file
│   ├── architecture.md           # System architecture
│   ├── data-models.md            # TypeScript interfaces
│   ├── state-management.md       # Zustand architecture
│   ├── component-inventory.md    # Component catalog
│   └── ...
├── tests/                        # Test suites
│   ├── unit/                     # Vitest unit tests
│   └── e2e/                      # Playwright E2E tests
├── supabase/                     # Database migrations
├── vite.config.ts                # Build configuration
├── tailwind.config.js            # Theme customization
├── playwright.config.ts          # E2E test configuration
└── package.json                  # Dependencies and scripts
```

## Getting Started

### For Users

1. **Visit the App**: Navigate to the deployed URL
2. **Create Account**: Register with email/password via Supabase Auth
3. **Setup Profile**: Enter display name and partner information
4. **Configure Dates**: Set relationship start date and anniversaries
5. **Explore Features**: View daily message, track mood, upload photos
6. **Install PWA**: Add to home screen for offline access

### For Developers

1. **Clone Repository**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/My-Love.git
   cd My-Love
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment**:

   ```bash
   cp .env.example .env
   # Add Supabase credentials to .env
   ```

4. **Start Development**:

   ```bash
   npm run dev
   ```

5. **Run Tests**:
   ```bash
   npm run test        # Unit tests
   npm run test:e2e    # E2E tests
   ```

## Development Commands

| Command             | Purpose                                |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Start Vite dev server (localhost:5173) |
| `npm run build`     | Production build to dist/              |
| `npm run preview`   | Preview production build               |
| `npm run test`      | Run Vitest unit tests                  |
| `npm run test:e2e`  | Run Playwright E2E tests               |
| `npm run lint`      | ESLint code quality check              |
| `npm run typecheck` | TypeScript type validation             |
| `npm run deploy`    | Deploy to GitHub Pages                 |

## Documentation Suite

### Core Documentation

- **[Index](./index.md)** - Master documentation navigator
- **[Project Overview](./project-overview.md)** - This document
- **[Architecture](./architecture.md)** - System design and patterns
- **[Source Tree Analysis](./source-tree-analysis.md)** - Codebase structure breakdown

### Technical Reference

- **[Data Models](./data-models.md)** - 35+ TypeScript interfaces and Zod schemas
- **[State Management](./state-management.md)** - 7 Zustand slices with 59 actions
- **[Component Inventory](./component-inventory.md)** - 20 components catalog

### Sprint Documentation

- **[Epic Tech Specifications](./epic-tech-specs/)** - Technical specs for each epic
- **[Stories](./stories/)** - 40+ user story implementations
- **[Retrospectives](./retrospectives/)** - Sprint retrospectives

## Browser Support

### Minimum Requirements

- ES2020+ support
- IndexedDB API
- Service Worker API
- WebSocket support (for Supabase Realtime)

### Recommended Browsers

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile: iOS Safari 14+, Chrome Mobile 90+

### PWA Installation

- Desktop: Chrome, Edge (full support)
- Mobile: Safari (iOS), Chrome (Android)
- Requires HTTPS for service worker

## Performance Characteristics

### Bundle Analysis

- Initial JS: ~280KB (gzipped, includes Supabase client)
- CSS: ~15KB (gzipped, Tailwind purged)
- Total initial load: ~350KB

### Runtime Performance

- First Contentful Paint: <1.5s
- Time to Interactive: <2.5s
- Offline load: <800ms
- State update propagation: <16ms (60fps animations)

### Optimization Strategies

- Lazy loading for photos (pagination + infinite scroll)
- Zustand shallow comparison selectors
- Framer Motion LazyMotion provider
- IndexedDB pagination for large datasets
- Service worker caching (NetworkFirst/CacheFirst strategies)

## Security & Privacy

### Authentication

- Supabase Auth with email/password
- JWT tokens with refresh rotation
- Row Level Security (RLS) on all database tables
- User-specific data isolation

### Data Storage

- Photos: Client-side IndexedDB (no cloud upload)
- Settings: LocalStorage (device-local)
- Mood/Interactions: Supabase with RLS (user-owned)
- Messages: IndexedDB (no cloud sync)

### Privacy Features

- No third-party analytics
- No advertising trackers
- Minimal cloud data (mood sync only)
- User controls what syncs
- Data export capability

## Supabase Database Schema

### Tables

- **profiles**: User display names and partner info
- **mood_entries**: Mood tracking with multi-emotion support
- **interactions**: Poke/kiss partner interactions

### Row Level Security

All tables enforce user ownership:

```sql
CREATE POLICY "Users can view own data"
ON mood_entries FOR SELECT
USING (auth.uid() = user_id);
```

## Version History

### v1.0.0 (Current Release)

**Full-Featured Relationship Companion**

- 365-message library with intelligent rotation
- Photo gallery with upload, carousel, and editing
- Multi-emotion mood tracking with calendar visualization
- Partner poke/kiss interactions with real-time delivery
- Anniversary countdown timers
- Admin panel for custom message management
- Supabase authentication and cloud sync
- Comprehensive offline support
- 20 implemented components
- Test coverage with Vitest and Playwright

### Previous Development Phases

- Epic 1: Foundation and technical debt resolution
- Epic 2: Testing infrastructure setup
- Epic 3: Message library expansion (365 messages)
- Epic 4: Photo management suite
- Epic 5: Architecture optimization
- Epic 6: Supabase integration and social features
- Epic 7: Offline mode hardening (in progress)

## Future Roadmap

### Planned Enhancements

- AI-powered message suggestions
- Enhanced photo cloud backup
- Cross-device sync for all data types
- Push notifications for interactions
- Advanced mood analytics and insights
- Partner linking and pairing
- Multi-language support

## License

**MIT License** - Open source, free to use and modify

## Credits

**Built With**:

- React Team - UI framework
- Zustand - State management
- Supabase - Backend services
- Framer - Animation library
- Tailwind Labs - CSS framework
- Lucide - Icon system
- And the open-source community

---

**Generated by BMAD document-project workflow**
**Scan Level**: Exhaustive (all source files analyzed)
**Documentation Date**: 2025-11-16
