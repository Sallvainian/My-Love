# Repository Structure

```
src/                    Application source code (150+ TypeScript files)
  components/           24 component folders
  api/                  Supabase client and service layer (7 files)
  stores/               Zustand store with 10 slices
  services/             Business logic and data services (14 files)
  hooks/                12 React hooks
  types/                Type definitions and Supabase generated types
  utils/                Utility functions (16 files)
  validation/           Zod schemas for data validation
  config/               Constants and configuration
  data/                 Default messages and scripture steps
tests/                  Unit tests (Vitest) and E2E tests (Playwright)
supabase/               Database migrations and edge functions
scripts/                Utility and CI scripts
.github/                CI/CD workflows and agent configurations
```

---
