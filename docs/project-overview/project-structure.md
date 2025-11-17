# Project Structure

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
