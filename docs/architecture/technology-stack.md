# Technology Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React | 19.x | UI framework with lazy loading via `React.lazy` + `Suspense` |
| **Language** | TypeScript | 5.9.x | Strict mode, no `any` types allowed |
| **Build** | Vite | 7.x | Development server, production builds, HMR |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS framework |
| **Animations** | Framer Motion | 12.x | Declarative animation library |
| **State** | Zustand | 5.x | Client-side state management (10 slices, persist middleware) |
| **Backend** | Supabase | 2.90.x | PostgreSQL, Auth, Realtime, Storage, RPC functions |
| **Local DB** | idb (IndexedDB) | 8.x | Offline persistence with typed schemas |
| **Validation** | Zod | 4.x | Runtime data validation at service boundaries |
| **PWA** | vite-plugin-pwa | 1.x | Service worker generation + Web App Manifest |
| **Icons** | Lucide React | 0.562.x | Tree-shakeable icon library |
| **Sanitization** | DOMPurify | 3.x | XSS prevention for user-generated content |
| **Virtualization** | react-window | 2.x | Windowed list rendering for large datasets |
| **Unit Tests** | Vitest | 4.x | Unit and integration testing with happy-dom |
| **E2E Tests** | Playwright | 1.57.x | End-to-end browser testing (Chromium) |
| **Linting** | ESLint | 9.x | Code quality enforcement |
| **Formatting** | Prettier | 3.x | Automated code formatting |
| **Env Encryption** | dotenvx | 1.x | Encrypted environment variable management |
| **Bundle Analysis** | rollup-plugin-visualizer | 6.x | Build output visualization |
| **Package Manager** | npm | - | Determined by `package-lock.json` |

---
