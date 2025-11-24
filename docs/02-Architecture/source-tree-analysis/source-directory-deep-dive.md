# Source Directory Deep Dive

## `/src/` - Application Core (90 files)

```
src/
├── 🚀 main.tsx                           # App bootstrap
├── 🎯 App.tsx                            # Root orchestrator
├── 🎨 index.css                          # Global styles + Tailwind
├── 📝 vite-env.d.ts                      # Vite type declarations
│
├── 📊 api/                               # Backend communication layer
│   ├── supabaseClient.ts                 # Supabase SDK initialization
│   ├── authService.ts                    # Authentication operations
│   ├── partnerService.ts                 # Partner pairing logic
│   ├── moodApi.ts                        # Mood CRUD operations
│   ├── moodSyncService.ts                # Real-time mood synchronization
│   ├── interactionService.ts             # Poke/Kiss interaction handling
│   ├── errorHandlers.ts                  # Centralized error processing
│   └── validation/
│       └── supabaseSchemas.ts            # Zod schemas for API responses
│
├── 🧩 components/                        # UI component library (20 components)
│   ├── AdminPanel/                       # Message management interface
│   ├── CountdownTimer/                   # Anniversary countdown display
│   ├── DailyMessage/                     # Primary message display
│   ├── DisplayNameSetup/                 # User name configuration
│   ├── ErrorBoundary/                    # React error boundary
│   ├── InteractionHistory/               # Poke/Kiss history view
│   ├── LoginScreen/                      # Authentication UI
│   ├── MoodHistory/                      # Calendar-based mood view
│   ├── MoodTracker/                      # Emotion selection interface
│   ├── Navigation/                       # Bottom navigation bar
│   ├── PartnerMoodView/                  # Partner's current mood
│   ├── PhotoCarousel/                    # Full-screen photo viewer
│   ├── PhotoDeleteConfirmation/          # Delete confirmation dialog
│   ├── PhotoEditModal/                   # Photo metadata editing
│   ├── PhotoGallery/                     # Grid-based photo browser
│   ├── PhotoUpload/                      # Image upload with compression
│   ├── PokeKissInterface/                # Interactive gestures
│   ├── Settings/                         # App configuration UI
│   ├── WelcomeButton/                    # Initial interaction trigger
│   └── WelcomeSplash/                    # First-time user experience
│
├── ⚙️ config/                            # Application configuration
│   ├── constants.ts                      # App-wide constants
│   └── performance.ts                    # Performance thresholds
│
├── 🎭 constants/                         # Static constants
│   └── animations.ts                     # Framer Motion variants
│
├── 📦 data/                              # Static data
│   └── defaultMessages.ts                # 365 pre-written love messages
│
├── 🪝 hooks/                             # Custom React hooks (empty)
│
├── 🔧 services/                          # Business logic layer (10 services)
│   ├── BaseIndexedDBService.ts           # Abstract IndexedDB operations
│   ├── customMessageService.ts           # User-created messages
│   ├── imageCompressionService.ts        # Photo optimization
│   ├── migrationService.ts               # Data migration utilities
│   ├── moodService.ts                    # Local mood persistence
│   ├── performanceMonitor.ts             # Runtime performance tracking
│   ├── photoStorageService.ts            # Photo IndexedDB operations
│   ├── realtimeService.ts                # Supabase realtime subscriptions
│   ├── storage.ts                        # Generic IndexedDB wrapper
│   └── syncService.ts                    # Offline-to-online sync
│
├── 🏪 stores/                            # State management
│   ├── useAppStore.ts                    # Zustand store composition
│   └── slices/                           # Feature-specific state slices
│       ├── settingsSlice.ts              # User preferences
│       ├── messagesSlice.ts              # Message rotation & history
│       ├── photosSlice.ts                # Photo gallery state
│       ├── moodSlice.ts                  # Mood tracking state
│       ├── partnerSlice.ts               # Partner connection state
│       ├── interactionsSlice.ts          # Poke/Kiss state
│       └── navigationSlice.ts            # App navigation state
│
├── 📐 types/                             # TypeScript definitions
│   ├── index.ts                          # Core application types
│   └── database.types.ts                 # Supabase generated types
│
├── 🛠️ utils/                             # Utility functions
│   ├── calendarHelpers.ts                # Date calculations for calendar
│   ├── countdownService.ts               # Anniversary countdown logic
│   ├── dateHelpers.ts                    # Date formatting utilities
│   ├── interactionValidation.ts          # Interaction rate limiting
│   ├── messageRotation.ts                # Daily message selection
│   ├── storageMonitor.ts                 # Storage quota tracking
│   └── themes.ts                         # Theme color definitions
│
└── ✅ validation/                        # Input validation
    ├── schemas.ts                        # Zod validation schemas
    ├── errorMessages.ts                  # Human-readable error strings
    └── index.ts                          # Validation barrel export
```
