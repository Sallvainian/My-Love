# Project Structure

```
src/
  api/                  Supabase client and API service layer
  assets/               Static assets (SVGs, images)
  components/           React components organized by feature
  config/               App configuration (constants.ts)
  constants/            Additional constant values
  data/                 Default messages and scripture step data
  hooks/                Custom React hooks
  services/             Business logic and data access services
  stores/               Zustand store and slices
    slices/             Domain-specific state slices:
      appSlice.ts           App-level state (loading, errors)
      navigationSlice.ts    Navigation and routing
      messagesSlice.ts      Daily love messages
      moodSlice.ts          Mood tracking
      interactionsSlice.ts  Partner interactions (pokes, kisses)
      photosSlice.ts        Photo gallery
      notesSlice.ts         Love notes chat
      partnerSlice.ts       Partner data and status
      settingsSlice.ts      User settings and preferences
      scriptureReadingSlice.ts  Scripture reading sessions
  sw.ts                 Service worker (injectManifest)
  types/                TypeScript type definitions
  utils/                Utility functions
  validation/           Zod schemas for runtime validation
tests/
  unit/                 Vitest unit tests
  e2e/                  Playwright E2E tests
  api/                  API-level Playwright tests
  support/              Shared test helpers, fixtures, and factories
supabase/
  migrations/           SQL migration files
scripts/                Build, deploy, and utility scripts
.github/
  workflows/            CI/CD workflow definitions
docs/                   Project documentation
```

---
