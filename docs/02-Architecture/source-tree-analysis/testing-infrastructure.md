# Testing Infrastructure

```
tests/
├── unit/                      # Vitest unit tests
│   ├── stores/               # Zustand slice tests
│   ├── services/             # Service layer tests
│   └── utils/                # Utility function tests
│
├── integration/               # Component integration tests
│   └── components/           # React Testing Library
│
└── e2e/                       # Playwright E2E tests
    ├── auth.spec.ts          # Authentication flows
    ├── mood-tracking.spec.ts # Mood feature tests
    ├── offline-cache-strategy.spec.ts
    └── photo-gallery.spec.ts
```
