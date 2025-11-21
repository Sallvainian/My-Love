# Epic Technical Specification: Deployment & Backend Infrastructure Setup

Date: 2025-11-17
Author: Frank
Epic ID: 0
Status: Draft

---

## Overview

Epic 0 establishes the foundational deployment infrastructure and backend connectivity for the My-Love Progressive Web App. This epic implements automated deployment via GitHub Actions to GitHub Pages (FR60), configures secure environment management for deployment secrets, and initializes Supabase backend services with Row Level Security (FR65). By completing this epic, the project gains automated CI/CD pipeline, production-ready backend infrastructure, and validated end-to-end deployment workflow before any feature development begins.

This epic serves as the TRUE foundation for all subsequent development work, ensuring reliable deployment automation and a working backend connection from day one. It bridges the platform pivot from React Native to PWA by establishing PWA-specific deployment patterns and connecting the React 19 + Vite 7 frontend stack to Supabase backend services.

## Objectives and Scope

**In Scope:**

- GitHub Actions workflow for automated build, test, and deployment to GitHub Pages
- Environment variable and secrets management for deployment pipeline
- Supabase project initialization with database, authentication, and storage services
- Supabase Row Level Security (RLS) policies for multi-tenant data isolation
- Connection configuration between React frontend and Supabase backend
- End-to-end production deployment validation workflow
- Deployment monitoring and rollback strategy (optional Story 0.5)

**Out of Scope:**

- Feature implementation (covered in Epic 1-7)
- UI components and user flows (Epic 1-3)
- Advanced monitoring/observability beyond basic deployment health checks
- Custom domain configuration (can be added post-MVP)
- Advanced caching strategies (deferred to Epic 4: Offline & Performance)
- Authentication UI/UX implementation (Epic 1: Authentication & Onboarding)

## System Architecture Alignment

This epic aligns with the documented architecture by:

**Frontend Stack (React 19 + Vite 7):**

- Leverages Vite's production build capabilities for optimized PWA bundles
- Configures PWA manifest and service worker registration for offline-first architecture
- Integrates Zustand state management with Supabase real-time subscriptions

**Backend Stack (Supabase):**

- Initializes Supabase project with PostgreSQL database, Auth service, and Storage buckets
- Implements Row Level Security policies to enforce multi-tenant data isolation per FR65
- Configures Supabase client initialization with environment-based connection strings

**Deployment Architecture:**

- GitHub Actions CI/CD pipeline builds static assets via `npm run build`
- Deploys to GitHub Pages with automatic HTTPS and CDN distribution
- Environment variables managed via GitHub Secrets for secure credential handling

**Constraints Addressed:**

- PWA requirements: Service worker registration, manifest.json, offline capabilities
- Security: RLS policies, secure env var management, HTTPS deployment
- Performance: Static site deployment to CDN (GitHub Pages) for fast global delivery

## Detailed Design

### Services and Modules

| Module/Service                       | Responsibilities                                                                                                                                                | Inputs                                                                                                            | Outputs                                                                                                        | Owner/Story |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| **GitHub Actions CI/CD Pipeline**    | - Execute build process (`npm run build`)<br/>- Run smoke tests pre-deployment<br/>- Deploy static assets to GitHub Pages<br/>- Trigger on push to main branch  | - Source code (main branch)<br/>- Environment secrets (GitHub Secrets)<br/>- Build configuration (vite.config.ts) | - Compiled static assets in `dist/`<br/>- Deployment to GitHub Pages<br/>- Build status notifications          | Story 0.1   |
| **Vite PWA Plugin**                  | - Generate PWA manifest.json<br/>- Generate and inject service worker<br/>- Configure workbox caching strategies<br/>- Handle offline asset caching             | - PWA configuration (vite.config.ts)<br/>- Static assets (icons, fonts)<br/>- Workbox cache rules                 | - Service worker (sw.js)<br/>- PWA manifest.json<br/>- Registered service worker in browser                    | Story 0.1   |
| **Supabase Client Module**           | - Initialize Supabase client with env vars<br/>- Provide auth, database, storage APIs<br/>- Handle real-time subscriptions<br/>- Enforce Row Level Security     | - VITE_SUPABASE_URL<br/>- VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY<br/>- User session tokens                                        | - Authenticated Supabase client instance<br/>- Database query interfaces<br/>- Real-time subscription handlers | Story 0.3   |
| **Environment Configuration Module** | - Load environment variables at build time<br/>- Validate required env vars present<br/>- Provide type-safe env var access<br/>- Separate dev/test/prod configs | - .env files (.env, .env.example)<br/>- Build environment context                                                 | - Typed environment configuration object<br/>- Runtime env validation errors                                   | Story 0.2   |
| **Deployment Validation Suite**      | - Verify deployed assets accessible<br/>- Check service worker registration<br/>- Validate PWA manifest loaded<br/>- Test Supabase connection health            | - Deployed production URL<br/>- Expected asset checksums<br/>- Supabase connection credentials                    | - Validation test results<br/>- Deployment health status<br/>- Rollback trigger if validation fails            | Story 0.4   |

### Data Models and Contracts

**Environment Variables Schema:**

```typescript
// Required build-time environment variables
interface EnvironmentConfig {
  VITE_SUPABASE_URL: string; // Format: https://<project-id>.supabase.co
  VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string; // Public anonymous key from Supabase dashboard
}

// Runtime validation
const requiredEnvVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY'] as const;
```

**PWA Manifest Configuration:**

```json
{
  "name": "My Love - Daily Reminders",
  "short_name": "My Love",
  "description": "Daily love notes and memories",
  "theme_color": "#FF6B9D",
  "background_color": "#FFE5EC",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "./",
  "scope": "./",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Supabase Client Configuration:**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  options?: {
    auth: {
      persistSession: boolean; // true for PWA (IndexedDB storage)
      autoRefreshToken: boolean; // true for automatic token refresh
      detectSessionInUrl: boolean; // true for OAuth redirects
    };
  };
}

// Client singleton
const supabase: SupabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
```

**Row Level Security (RLS) Policy Structure:**

```sql
-- Multi-tenant data isolation pattern (FR65)
-- Each user can only access their own data

-- Policy: Users can read their own records
CREATE POLICY "Users can view own data" ON <table_name>
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own records
CREATE POLICY "Users can insert own data" ON <table_name>
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own records
CREATE POLICY "Users can update own data" ON <table_name>
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own records
CREATE POLICY "Users can delete own data" ON <table_name>
  FOR DELETE
  USING (auth.uid() = user_id);
```

### APIs and Interfaces

**GitHub Actions Workflow Specification:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch: # Manual trigger support

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Required for gh-pages deployment

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY }}

      - name: Run smoke tests
        run: npm run test:smoke

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: <optional-custom-domain> # Story 0.5 if needed
```

**Service Worker Registration API:**

```typescript
// Service worker registration interface (vite-plugin-pwa auto-generated)
interface ServiceWorkerRegistration {
  register: () => Promise<ServiceWorkerRegistration>;
  unregister: () => Promise<boolean>;
  update: () => Promise<void>;
}

// Usage in app
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}
```

**Supabase Client Initialization API:**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Validate environment variables at startup
function validateEnv(): void {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY'];
  const missing = required.filter((key) => !import.meta.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

validateEnv();

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  {
    auth: {
      persistSession: true, // Store session in browser
      autoRefreshToken: true, // Auto-refresh before expiry
      detectSessionInUrl: true, // Handle OAuth redirects
    },
  }
);

// Health check API
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('_health').select('*').limit(1);
    return !error;
  } catch {
    return false;
  }
}
```

### Workflows and Sequencing

**Deployment Pipeline Sequence:**

```
1. Developer pushes to main branch
   ↓
2. GitHub Actions workflow triggered
   ↓
3. Checkout source code
   ↓
4. Setup Node.js 20 environment
   ↓
5. Install dependencies (npm ci)
   ↓
6. Load environment secrets from GitHub Secrets
   ↓
7. Run TypeScript compiler (tsc -b)
   ↓
8. Run Vite build process
   ├─ Generate PWA manifest.json
   ├─ Generate service worker (sw.js)
   ├─ Bundle JavaScript with code splitting
   ├─ Process CSS with Tailwind
   └─ Copy static assets to dist/
   ↓
9. Run smoke tests (npm run test:smoke)
   ├─ Verify dist/ structure
   ├─ Check critical assets present
   └─ Validate HTML entry points
   ↓
10. Deploy to GitHub Pages (gh-pages action)
    ├─ Create gh-pages branch
    ├─ Copy dist/ contents
    └─ Push to GitHub Pages
    ↓
11. GitHub Pages serves content via CDN
    ↓
12. Post-deployment validation (Story 0.4)
    ├─ Verify deployment URL responds
    ├─ Check service worker registered
    ├─ Validate PWA manifest accessible
    └─ Test Supabase connection
```

**Supabase Project Initialization Sequence:**

```
1. Create Supabase project via dashboard
   ↓
2. Copy project URL and anon key
   ↓
3. Add credentials to GitHub Secrets
   ├─ VITE_SUPABASE_URL
   └─ VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
   ↓
4. Initialize database schema
   ├─ Create tables (deferred to Epic 1-7)
   ├─ Enable Row Level Security on tables
   └─ Create RLS policies per table
   ↓
5. Configure Authentication settings
   ├─ Enable email/password auth
   ├─ Configure redirect URLs
   └─ Set session timeout policies
   ↓
6. Setup Storage buckets (if needed)
   ├─ Create public/private buckets
   └─ Configure CORS policies
   ↓
7. Test connection from local development
   ↓
8. Verify RLS policies enforce isolation
```

**Service Worker Registration Flow:**

```
1. Browser loads PWA
   ↓
2. Check if service worker supported
   ↓
3. Window 'load' event fires
   ↓
4. Register service worker (navigator.serviceWorker.register)
   ↓
5. Service worker installation begins
   ├─ Cache static assets (images, fonts)
   ├─ Skip caching JS/CSS/HTML (always fetch fresh)
   └─ Setup runtime caching strategies
   ↓
6. Service worker activated
   ├─ Claim all clients (clientsClaim: true)
   ├─ Skip waiting (skipWaiting: true)
   └─ Cleanup outdated caches
   ↓
7. Service worker intercepts network requests
   ├─ JS/CSS/HTML → NetworkOnly (no caching)
   ├─ Images/Fonts → CacheFirst (30-day TTL)
   └─ Google Fonts → CacheFirst (1-year TTL)
   ↓
8. Auto-update on new deployment
   ├─ Detect new service worker version
   ├─ Download and install new SW
   ├─ Activate after all tabs closed
   └─ Reload page to use new version
```

## Non-Functional Requirements

### Performance

**Build Performance:**

- TypeScript compilation: < 30 seconds for full rebuild
- Vite production build: < 2 minutes for complete bundle generation
- Total CI/CD pipeline execution: < 5 minutes from push to deployment
- PWA bundle size targets:
  - Main bundle (vendor-react): < 150 KB gzipped
  - Supabase chunk (vendor-supabase): < 100 KB gzipped (lazy-loaded)
  - Total initial load: < 300 KB gzipped
  - Lighthouse Performance score: ≥ 90

**Deployment Performance:**

- GitHub Pages deployment propagation: < 2 minutes after push
- Service worker update detection: < 30 seconds on next page load
- CDN cache invalidation: Automatic with new deployment

**Runtime Performance (PWA):**

- Time to Interactive (TTI): < 3 seconds on 3G connection
- First Contentful Paint (FCP): < 1.5 seconds
- Service worker installation: < 5 seconds on first visit
- Cached asset retrieval: < 100ms for static resources

_Reference: FR60 (deployment), Architecture (performance targets)_

### Security

**Secrets Management:**

- Environment variables stored in GitHub Secrets (encrypted at rest)
- No credentials committed to version control (enforced via .gitignore)
- Build-time injection only - secrets never exposed in client bundle
- Supabase anon key is public-safe (protected by RLS policies)

**Row Level Security (RLS):**

- All database tables MUST have RLS enabled (FR65)
- RLS policies enforce user_id = auth.uid() for all CRUD operations
- Multi-tenant data isolation verified via integration tests
- Service role key (admin access) NEVER exposed to client

**HTTPS and Transport Security:**

- GitHub Pages enforces HTTPS for all traffic
- Supabase connections use TLS 1.2+
- Service worker requires HTTPS (except localhost development)
- No mixed content warnings (all external resources via HTTPS)

**Threat Mitigation:**

- XSS: React's built-in escaping, Content Security Policy headers
- CSRF: Supabase JWT-based auth (stateless, no cookies for CSRF)
- SQL Injection: Supabase parameterized queries, RLS enforcement
- Secrets Exposure: GitHub Secrets encryption, build-time injection only

_Reference: FR65 (RLS), Architecture (security constraints)_

### Reliability/Availability

**Deployment Reliability:**

- Target deployment success rate: ≥ 95%
- Automated rollback on smoke test failures
- Zero-downtime deployments (GitHub Pages atomic replacement)
- Manual rollback capability via GitHub Pages settings

**Service Availability:**

- GitHub Pages SLA: 99.9% uptime (GitHub's published SLA)
- Supabase SLA: 99.9% uptime (Free tier - no SLA; Pro tier - 99.9%)
- Service worker enables offline-first PWA (Epic 4 for full offline mode)

**Graceful Degradation:**

- If Supabase unavailable: Display offline message, queue writes to IndexedDB
- If service worker fails: App still functions without offline capabilities
- If CDN slow: Progressive loading with skeleton screens

**Recovery Strategies:**

- Deployment failure: GitHub Actions re-run capability
- Bad deployment: Revert to previous GitHub Pages deployment
- Supabase connection loss: Exponential backoff retry (3 attempts, max 30s wait)

_Reference: FR60 (deployment reliability), Architecture (availability targets)_

### Observability

**Deployment Monitoring:**

- GitHub Actions build logs (stdout/stderr capture)
- Deployment status badges on repository README
- Email/Slack notifications on deployment failure (Story 0.5 optional)
- Smoke test results in CI logs

**Production Health Checks:**

- Post-deployment validation script (Story 0.4):
  - HTTP 200 response from deployment URL
  - Service worker registration status
  - PWA manifest accessibility check
  - Supabase connection health check
- Execution: Manual script after deployment, automated in Story 0.5

**Application Logging:**

- Console logging levels: ERROR (production), DEBUG (development)
- Service worker lifecycle events logged to console
- Supabase connection errors logged with stack traces
- No PII (Personally Identifiable Information) in logs

**Metrics Collection (Story 0.5 Optional):**

- Deployment frequency (GitHub Actions history)
- Deployment duration (build time, test time, deploy time)
- Deployment failure rate and causes
- Mean Time To Recovery (MTTR) for failed deployments

**Tracing (Deferred to Epic 4):**

- Service worker cache hit/miss rates
- Network request timing (navigation, asset loading)
- Critical user journey performance (via Web Vitals)

_Reference: Architecture (observability requirements), Story 0.4 (validation), Story 0.5 (monitoring)_

## Dependencies and Integrations

### Production Dependencies

**Core Framework:**

- `react@^19.1.1` - Core React library for UI components
- `react-dom@^19.1.1` - React DOM rendering engine
- React 19 enables concurrent rendering and automatic batching

**State Management & Storage:**

- `zustand@^5.0.8` - Lightweight state management (replaces Redux/Context API)
- `idb@^8.0.3` - IndexedDB wrapper for client-side persistent storage
- `zod@^3.25.76` - TypeScript-first schema validation

**Backend Integration (Epic 0 Core):**

- `@supabase/supabase-js@^2.81.1` - Supabase client library
  - Provides: Auth, Database (PostgreSQL), Storage, Real-time subscriptions
  - RLS policy enforcement on client side
  - JWT-based authentication

**PWA Capabilities (Epic 0 Core):**

- `workbox-window@^7.3.0` - Service worker lifecycle management
  - Enables: Cache strategies, offline support, background sync
  - Integrates with vite-plugin-pwa for automatic SW generation

**UI & Animations:**

- `framer-motion@^12.23.24` - Production-ready animation library
- `lucide-react@^0.548.0` - Icon library (tree-shakeable SVG icons)

**Polyfills:**

- `eventsource@^4.0.0` - Server-Sent Events polyfill for older browsers

### Development Dependencies

**Build Tools (Epic 0 Core):**

- `vite@^7.1.7` - Next-generation build tool and dev server
  - Lightning-fast HMR (Hot Module Replacement)
  - Optimized production builds with code splitting
- `vite-plugin-pwa@^1.1.0` - PWA plugin for Vite
  - Auto-generates service worker and manifest.json
  - Workbox integration for caching strategies
- `@vitejs/plugin-react@^5.0.4` - Vite plugin for React Fast Refresh
- `rollup-plugin-visualizer@^6.0.5` - Bundle size analysis

**TypeScript:**

- `typescript@~5.9.3` - TypeScript compiler
- `@types/react@^19.1.16` - React type definitions
- `@types/react-dom@^19.1.9` - React DOM type definitions
- `@types/node@^24.10.1` - Node.js type definitions

**Linting & Formatting:**

- `eslint@^9.36.0` - JavaScript/TypeScript linter
- `@eslint/js@^9.36.0` - ESLint JavaScript rules
- `typescript-eslint@^8.45.0` - TypeScript ESLint plugin
- `eslint-plugin-react-hooks@^5.2.0` - React Hooks linting rules
- `eslint-plugin-react-refresh@^0.4.22` - React Fast Refresh linting
- `prettier@^3.6.2` - Code formatter (opinionated, zero-config)

**Testing:**

- `vitest@^4.0.9` - Vite-native unit test runner
- `@vitest/ui@^4.0.9` - Vitest web UI
- `@vitest/coverage-v8@^4.0.9` - Code coverage via V8
- `@testing-library/react@^16.1.0` - React testing utilities
- `@testing-library/jest-dom@^6.6.3` - Custom Jest matchers for DOM
- `@playwright/test@^1.56.1` - End-to-end testing framework
- `happy-dom@^20.0.10` - Lightweight DOM implementation for tests
- `fake-indexeddb@^6.2.5` - IndexedDB mock for unit tests

**Deployment (Epic 0 Core):**

- `gh-pages@^6.3.0` - Deploy to GitHub Pages from npm script
  - Publishes `dist/` directory to gh-pages branch
  - Supports custom domains via CNAME

**Supabase CLI:**

- `supabase@^2.58.5` - Supabase CLI for local development and migrations
  - Database migrations and schema management
  - Local Supabase instance for development
  - Type generation for database schemas

**Styling:**

- `tailwindcss@^3.4.18` - Utility-first CSS framework
- `autoprefixer@^10.4.21` - PostCSS plugin for vendor prefixes
- `postcss@^8.5.6` - CSS transformation tool

**Utilities:**

- `tsx@^4.20.6` - TypeScript execution and REPL
- `globals@^16.4.0` - Global identifiers from different JavaScript environments

### External Service Integrations

**Supabase (Primary Backend):**

- **Service Type**: Backend-as-a-Service (BaaS)
- **Features Used**:
  - PostgreSQL database with RLS
  - Authentication (email/password)
  - Real-time subscriptions (WebSocket)
  - Storage (file uploads, future epic)
- **Connection**: HTTPS REST API + WebSocket
- **Authentication**: JWT tokens (auto-refreshing)
- **Data Isolation**: Row Level Security policies enforce user_id = auth.uid()

**GitHub Pages (Deployment Target):**

- **Service Type**: Static site hosting
- **Features**:
  - HTTPS with automatic SSL certificates
  - CDN distribution (Fastly)
  - Custom domain support (optional)
  - Automatic deployment from gh-pages branch
- **Deployment Method**: `gh-pages` npm package

**GitHub Actions (CI/CD Platform):**

- **Service Type**: Continuous Integration / Continuous Deployment
- **Workflows**:
  - Build: Compile TypeScript, bundle with Vite
  - Test: Run unit tests (Vitest), smoke tests
  - Deploy: Push to GitHub Pages
- **Secrets Management**: GitHub Secrets (encrypted key-value store)
- **Triggers**: Push to main branch, manual workflow dispatch

### Integration Points

**Build-Time Integrations:**

```
Vite Build Process
├─ TypeScript Compiler (tsc -b)
├─ React Plugin (@vitejs/plugin-react)
├─ PWA Plugin (vite-plugin-pwa)
│  ├─ Workbox (service worker generation)
│  └─ Manifest generation
├─ Tailwind CSS (PostCSS)
└─ Bundle Analyzer (rollup-plugin-visualizer)
```

**Runtime Integrations:**

```
Browser Runtime
├─ React 19 (UI rendering)
├─ Zustand (state management)
├─ Supabase Client
│  ├─ Auth API (JWT tokens, session management)
│  ├─ Database API (PostgreSQL queries with RLS)
│  └─ Real-time API (WebSocket subscriptions)
├─ IndexedDB (via idb wrapper)
│  ├─ Offline data queue
│  └─ Persistent state storage
└─ Service Worker (via workbox-window)
   ├─ Cache API (static assets)
   └─ Background sync (future epic)
```

**Deployment Pipeline Integrations:**

```
GitHub Actions
├─ Node.js 20 Runtime
├─ npm ci (dependency installation)
├─ Vite Build (static asset generation)
├─ Vitest (unit tests)
├─ Smoke Tests (dist/ validation)
└─ GitHub Pages Deploy Action
   └─ gh-pages branch publish
```

### Version Constraints & Compatibility

**Node.js:** 20.x (LTS) - Required by GitHub Actions, Vite 7
**npm:** 10.x - Package manager for dependency installation
**Browsers (PWA Targets):**

- Chrome/Edge: Last 2 versions (ES2020+ support)
- Safari: 16.4+ (Service Worker support)
- Firefox: Last 2 versions
- Mobile: iOS Safari 16.4+, Chrome Android

**Breaking Change Considerations:**

- React 19: Major version with breaking changes (automatic batching, new JSX transform)
- Vite 7: Major version, requires Node.js 20+
- Supabase JS v2: Breaking changes from v1 (auth API redesign)

**Lock Files:**

- `package-lock.json` committed to ensure deterministic builds
- CI uses `npm ci` (clean install from lockfile) for reproducibility

## Acceptance Criteria (Authoritative)

### Story 0.1: GitHub Actions Deployment Pipeline

**AC-0.1.1:** GitHub Actions workflow file (`.github/workflows/deploy.yml`) exists and triggers on push to main branch

**AC-0.1.2:** Workflow successfully executes all build steps: checkout, Node.js setup, dependency installation, TypeScript compilation, Vite build

**AC-0.1.3:** Build process injects environment variables from GitHub Secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)

**AC-0.1.4:** PWA artifacts are generated in `dist/` directory: `manifest.json`, `sw.js` (service worker), optimized bundles

**AC-0.1.5:** Smoke tests pass before deployment (verify `dist/` structure, critical assets present)

**AC-0.1.6:** Workflow deploys compiled assets to GitHub Pages (gh-pages branch) with zero downtime

**AC-0.1.7:** Deployment completes within 5 minutes from push to production availability

**AC-0.1.8:** Manual workflow dispatch option available for on-demand deployments

### Story 0.2: Environment Variables & Secrets Management

**AC-0.2.1:** `.env.example` file documents all required environment variables with descriptions

**AC-0.2.2:** `.gitignore` prevents `.env` file from being committed to version control

**AC-0.2.3:** GitHub Secrets configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

**AC-0.2.4:** Build process validates required environment variables are present at compile time

**AC-0.2.5:** Application throws clear error message at startup if required env vars are missing

**AC-0.2.6:** Environment variables are injected at build time only (not exposed in client bundle as plaintext)

**AC-0.2.7:** Local development uses `.env` file, production uses GitHub Secrets

### Story 0.3: Supabase Project Initialization & Connection

**AC-0.3.1:** Supabase project created with PostgreSQL database, Authentication, and Storage services enabled

**AC-0.3.2:** Supabase client module (`src/lib/supabase.ts`) initializes client with environment variables

**AC-0.3.3:** Supabase client configured with `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

**AC-0.3.4:** Row Level Security (RLS) enabled on all database tables (placeholder for future epics)

**AC-0.3.5:** RLS policies template created for `user_id = auth.uid()` pattern (ready for Epic 1+)

**AC-0.3.6:** Email/password authentication provider enabled in Supabase Auth settings

**AC-0.3.7:** Health check function (`checkSupabaseConnection`) successfully connects to Supabase from deployed PWA

**AC-0.3.8:** Supabase connection uses HTTPS and enforces TLS 1.2+ for all communication

### Story 0.4: Production Deployment E2E Validation

**AC-0.4.1:** Post-deployment validation script (`scripts/post-deploy-check.cjs`) exists and is executable

**AC-0.4.2:** Validation script verifies deployed URL returns HTTP 200 response

**AC-0.4.3:** Validation script confirms PWA `manifest.json` is accessible and valid JSON

**AC-0.4.4:** Validation script checks service worker registration succeeds in production environment

**AC-0.4.5:** Validation script tests Supabase connection health from deployed app

**AC-0.4.6:** Validation script reports success/failure status with actionable error messages

**AC-0.4.7:** Validation runs manually after deployment (automated execution in Story 0.5)

**AC-0.4.8:** Failed validation provides clear rollback instructions

### Story 0.5: Deployment Monitoring & Rollback Strategy (Optional)

**AC-0.5.1:** GitHub Actions workflow includes post-deployment health check step (optional)

**AC-0.5.2:** Deployment status badge added to repository README showing build/deploy status

**AC-0.5.3:** Rollback process documented: revert gh-pages branch or redeploy previous commit

**AC-0.5.4:** Deployment notification configured (GitHub Actions status, optional Slack/email)

**AC-0.5.5:** Deployment metrics tracked: frequency, duration, failure rate (via GitHub Actions history)

**AC-0.5.6:** Mean Time To Recovery (MTTR) baseline established for deployment failures

## Traceability Mapping

| AC ID        | Spec Section                                              | Component/API                       | Test Strategy                                                                                                |
| ------------ | --------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **AC-0.1.1** | Detailed Design > APIs > GitHub Actions Workflow          | `.github/workflows/deploy.yml`      | Unit: Verify file exists<br/>Integration: Trigger workflow and verify execution                              |
| **AC-0.1.2** | Detailed Design > Workflows > Deployment Pipeline         | GitHub Actions steps                | E2E: Full CI/CD pipeline test with sample commit                                                             |
| **AC-0.1.3** | Dependencies > GitHub Actions > Secrets Management        | GitHub Actions env injection        | Integration: Verify env vars present in build logs (masked)                                                  |
| **AC-0.1.4** | Detailed Design > Services > Vite PWA Plugin              | `vite-plugin-pwa`, `workbox-window` | Unit: Verify `dist/manifest.json` and `dist/sw.js` exist<br/>Integration: Parse manifest and validate schema |
| **AC-0.1.5** | NFR > Observability > Deployment Monitoring               | `scripts/smoke-tests.cjs`           | Unit: Smoke test script verifies dist structure<br/>Integration: Run smoke tests in CI                       |
| **AC-0.1.6** | Detailed Design > Workflows > Deployment Pipeline         | `gh-pages` npm package              | E2E: Deploy to staging, verify gh-pages branch updated                                                       |
| **AC-0.1.7** | NFR > Performance > Build Performance                     | GitHub Actions workflow             | Performance: Measure pipeline duration from commit to deployment                                             |
| **AC-0.1.8** | Detailed Design > APIs > GitHub Actions Workflow          | `workflow_dispatch` trigger         | Manual: Trigger workflow via GitHub UI, verify execution                                                     |
| **AC-0.2.1** | Detailed Design > Data Models > Environment Variables     | `.env.example`                      | Unit: Verify file exists and documents all required vars                                                     |
| **AC-0.2.2** | NFR > Security > Secrets Management                       | `.gitignore`                        | Unit: Verify `.env` in `.gitignore`<br/>Integration: Attempt commit of `.env`, should be ignored             |
| **AC-0.2.3** | Dependencies > GitHub Actions > Secrets Management        | GitHub Secrets UI                   | Manual: Verify secrets configured in repository settings                                                     |
| **AC-0.2.4** | Detailed Design > Data Models > Environment Variables     | Build-time validation               | Unit: Build with missing env var, expect failure with clear message                                          |
| **AC-0.2.5** | Detailed Design > APIs > Supabase Client Initialization   | `validateEnv()` function            | Unit: Test validateEnv() with missing vars, expect error                                                     |
| **AC-0.2.6** | NFR > Security > Secrets Management                       | Vite build process                  | Security: Inspect bundled JS, verify no plaintext secrets                                                    |
| **AC-0.2.7** | Detailed Design > Services > Environment Configuration    | `.env` loading, GitHub Secrets      | Integration: Test local dev with `.env`, production with secrets                                             |
| **AC-0.3.1** | Dependencies > External Services > Supabase               | Supabase Dashboard                  | Manual: Verify project created with Auth, Database, Storage enabled                                          |
| **AC-0.3.2** | Detailed Design > APIs > Supabase Client Initialization   | `src/lib/supabase.ts`               | Unit: Verify module exports `supabase` client instance                                                       |
| **AC-0.3.3** | Detailed Design > Data Models > Supabase Client Config    | Supabase client options             | Unit: Verify client initialized with correct auth options                                                    |
| **AC-0.3.4** | Detailed Design > Data Models > RLS Policy Structure      | Supabase Dashboard RLS settings     | Manual: Verify RLS enabled on tables (future epics)                                                          |
| **AC-0.3.5** | Detailed Design > Data Models > RLS Policy Structure      | SQL policy templates                | Unit: Verify RLS policy template files exist                                                                 |
| **AC-0.3.6** | NFR > Security > HTTPS Transport                          | Supabase Auth settings              | Manual: Verify email/password provider enabled in dashboard                                                  |
| **AC-0.3.7** | Detailed Design > APIs > Supabase Client > Health Check   | `checkSupabaseConnection()`         | Integration: Call health check from deployed app, expect true                                                |
| **AC-0.3.8** | NFR > Security > HTTPS Transport                          | Supabase client connection          | Security: Verify TLS 1.2+ used (inspect network traffic)                                                     |
| **AC-0.4.1** | Detailed Design > Services > Deployment Validation        | `scripts/post-deploy-check.cjs`     | Unit: Verify script exists and has execute permissions                                                       |
| **AC-0.4.2** | NFR > Reliability > Deployment Reliability                | HTTP health check                   | Integration: Script hits deployment URL, expects 200                                                         |
| **AC-0.4.3** | Detailed Design > Data Models > PWA Manifest              | Manifest validation                 | Integration: Script fetches manifest, validates JSON schema                                                  |
| **AC-0.4.4** | Detailed Design > Workflows > Service Worker Registration | Service worker check                | E2E: Playwright test registers SW, verifies active state                                                     |
| **AC-0.4.5** | Detailed Design > APIs > Supabase Health Check            | Supabase connection test            | Integration: Script calls Supabase health check, expects true                                                |
| **AC-0.4.6** | NFR > Observability > Production Health Checks            | Validation script output            | Unit: Test script with failing checks, verify error messages                                                 |
| **AC-0.4.7** | Detailed Design > Services > Deployment Validation        | Manual script execution             | Manual: Run script post-deployment, verify output                                                            |
| **AC-0.4.8** | NFR > Reliability > Recovery Strategies                   | Rollback documentation              | Manual: Verify rollback steps documented and actionable                                                      |
| **AC-0.5.1** | NFR > Observability > Deployment Monitoring               | GitHub Actions health check step    | Integration: Workflow includes optional health check step                                                    |
| **AC-0.5.2** | NFR > Observability > Deployment Monitoring               | README badge                        | Unit: Verify README contains build status badge                                                              |
| **AC-0.5.3** | NFR > Reliability > Recovery Strategies                   | Rollback process docs               | Manual: Verify rollback documentation complete                                                               |
| **AC-0.5.4** | NFR > Observability > Deployment Monitoring               | GitHub Actions notifications        | Integration: Trigger failed deployment, verify notification                                                  |
| **AC-0.5.5** | NFR > Observability > Metrics Collection                  | GitHub Actions history              | Manual: Query GitHub Actions API for deployment metrics                                                      |
| **AC-0.5.6** | NFR > Observability > Metrics Collection                  | MTTR calculation                    | Manual: Track deployment failures and recovery times                                                         |

## Risks, Assumptions, Open Questions

### Risks

**RISK-01: GitHub Pages Deployment Limitations**

- **Description**: GitHub Pages has rate limits and size constraints (1GB max, 100GB/month bandwidth)
- **Impact**: High - Could prevent deployment or cause service degradation
- **Probability**: Low (PWA bundles ~2-5MB, traffic expected low for MVP)
- **Mitigation**: Monitor bundle sizes with `rollup-plugin-visualizer`, set up CDN fallback if needed
- **Status**: Accepted risk for MVP, monitor in Story 0.5

**RISK-02: Supabase Free Tier Limitations**

- **Description**: Free tier has limits (500MB database, 2GB bandwidth/month, 50K active users)
- **Impact**: Medium - May need to upgrade before scale
- **Probability**: Low for MVP (2-user couple app)
- **Mitigation**: Monitor usage in Supabase dashboard, plan upgrade to Pro tier ($25/month) if needed
- **Status**: Accepted risk, upgrade path exists

**RISK-03: Service Worker Caching Issues**

- **Description**: Stale code cached by service worker could prevent users from getting updates
- **Impact**: High - Users stuck on broken version
- **Probability**: Low (skipWaiting: true, clientsClaim: true configured)
- **Mitigation**:
  - `workbox.skipWaiting = true` ensures immediate activation
  - `workbox.globIgnores` prevents JS/CSS/HTML caching
  - Manual cache clear mechanism if needed
- **Status**: Mitigated via configuration

**RISK-04: Environment Variable Exposure**

- **Description**: Accidentally committing `.env` file with secrets to version control
- **Impact**: Critical - Public exposure of Supabase credentials
- **Probability**: Low (`.gitignore` configured, GitHub secret scanning enabled)
- **Mitigation**:
  - `.env` in `.gitignore`
  - GitHub secret scanning alerts on commit
  - Pre-commit hooks can validate no secrets in code
  - Rotate keys if exposed
- **Status**: Mitigated, monitor GitHub security alerts

**RISK-05: GitHub Actions Workflow Failure**

- **Description**: Deployment pipeline fails due to flaky tests, dependency issues, or quota limits
- **Impact**: Medium - Blocks deployment, requires manual intervention
- **Probability**: Medium (flaky E2E tests, npm registry downtime)
- **Mitigation**:
  - Smoke tests instead of full E2E for deployment gate
  - GitHub Actions retry mechanism (3 attempts)
  - Manual rollback capability via GitHub Pages settings
  - npm ci with lockfile for reproducibility
- **Status**: Mitigated, monitor failure rates

**RISK-06: Breaking Changes in Dependencies**

- **Description**: React 19, Vite 7, Supabase v2 are major versions with breaking changes
- **Impact**: High - Could break build or runtime functionality
- **Probability**: Medium (dependencies actively maintained)
- **Mitigation**:
  - Lock versions in package.json with `^` (minor/patch updates only)
  - `package-lock.json` committed for deterministic builds
  - Automated dependency updates via Dependabot with testing
  - Review changelogs before major updates
- **Status**: Mitigated, monitor release notes

### Assumptions

**ASSUMPTION-01:** GitHub Pages remains free for public repositories

- **Validation**: Confirmed via GitHub documentation (as of 2025-11-17)
- **Impact if wrong**: Need alternative hosting (Vercel, Netlify, Cloudflare Pages)

**ASSUMPTION-02:** Supabase free tier sufficient for MVP (2-user couple app)

- **Validation**: Free tier limits: 500MB DB, 2GB bandwidth/month, 50K users
- **Impact if wrong**: Upgrade to Pro tier ($25/month)

**ASSUMPTION-03:** Users access PWA from modern browsers (Chrome 90+, Safari 16.4+, Firefox 90+)

- **Validation**: Service worker requires modern browser support
- **Impact if wrong**: Need progressive enhancement for older browsers

**ASSUMPTION-04:** Deployment to GitHub Pages via gh-pages branch is acceptable (no custom domain initially)

- **Validation**: Confirmed by project scope (custom domain deferred to Story 0.5)
- **Impact if wrong**: Need DNS configuration and CNAME setup

**ASSUMPTION-05:** Environment variables injected at build time (no runtime configuration service)

- **Validation**: Vite build-time env var injection sufficient for PWA
- **Impact if wrong**: Need runtime configuration service (increases complexity)

**ASSUMPTION-06:** Row Level Security policies can be deferred to feature epics (Epic 1+)

- **Validation**: Epic 0 establishes RLS foundation, actual policies applied when tables created
- **Impact if wrong**: Security gap if database accessed before RLS policies applied

### Open Questions

**QUESTION-01:** Should deployment trigger automatically on every push to main, or require manual approval?

- **Current Approach**: Auto-deploy on push to main
- **Alternative**: Manual workflow dispatch only
- **Decision Needed By**: Story 0.1 implementation
- **Owner**: Frank (user_name)

**QUESTION-02:** What is the target deployment URL? (username.github.io/repo-name or custom domain?)

- **Current Approach**: `<username>.github.io/My-Love`
- **Alternative**: Custom domain (requires DNS setup)
- **Decision Needed By**: Before first deployment
- **Owner**: Frank

**QUESTION-03:** Should Story 0.5 (monitoring/rollback) be implemented in Epic 0 or deferred?

- **Current Approach**: Optional story, implement if time permits
- **Alternative**: Defer to Epic 8 (polish/refinement)
- **Decision Needed By**: Sprint planning
- **Owner**: Frank

**QUESTION-04:** What level of deployment notifications are needed? (Email, Slack, Discord?)

- **Current Approach**: GitHub Actions status only (default email on failure)
- **Alternative**: Slack/Discord webhook integration
- **Decision Needed By**: Story 0.5 (if implemented)
- **Owner**: Frank

**QUESTION-05:** Should we implement a staging environment for testing deployments before production?

- **Current Approach**: Single production environment (GitHub Pages)
- **Alternative**: Separate staging branch deployed to different URL
- **Decision Needed By**: Before first production deployment
- **Owner**: Frank

## Test Strategy Summary

### Test Levels

**Unit Tests (Vitest):**

- **Scope**: Individual functions, modules, components in isolation
- **Coverage Target**: 80% line coverage for critical infrastructure code
- **Focus Areas**:
  - Environment variable validation (`validateEnv()`)
  - Supabase client initialization
  - PWA manifest generation
  - Configuration module correctness
- **Mocking**: Mock Supabase client, browser APIs (service worker, IndexedDB)
- **Execution**: `npm run test:unit` (local), GitHub Actions (CI)

**Integration Tests (Vitest + Playwright):**

- **Scope**: Inter-module interactions, API integrations, workflow orchestration
- **Coverage Target**: All critical paths (deployment pipeline, Supabase connection)
- **Focus Areas**:
  - GitHub Actions workflow execution (smoke tests)
  - Supabase connection health check from deployed app
  - Service worker registration and caching behavior
  - Environment variable injection in build process
- **Execution**: `npm run test:e2e` (local), GitHub Actions (CI)

**End-to-End Tests (Playwright):**

- **Scope**: Full user journeys in production-like environment
- **Coverage Target**: All acceptance criteria for Story 0.4 (deployment validation)
- **Focus Areas**:
  - Deployed app loads and renders
  - PWA manifest accessible and valid
  - Service worker registers successfully
  - Supabase connection works from deployed context
- **Execution**: Manual post-deployment (Story 0.4), automated in Story 0.5

**Manual Tests:**

- **Scope**: Configuration verification, security checks, performance validation
- **Focus Areas**:
  - GitHub Secrets configured correctly
  - Supabase project setup (Auth, Database, Storage enabled)
  - Deployment URL responds with HTTPS
  - Bundle size analysis (Lighthouse, rollup-plugin-visualizer)
  - Service worker behavior in different browsers
- **Execution**: Checklist-based manual testing after each story

**Security Tests:**

- **Scope**: Secrets exposure, HTTPS enforcement, RLS policy validation
- **Focus Areas**:
  - No plaintext secrets in bundled JavaScript
  - `.env` file excluded from git
  - TLS 1.2+ used for Supabase connections
  - RLS policies enforce user_id isolation (future epics)
- **Tools**: Manual code inspection, GitHub secret scanning, browser DevTools
- **Execution**: Manual security review before production deployment

### Acceptance Criteria Coverage

**Story 0.1 (CI/CD Pipeline):** 8 ACs

- **Unit Tests**: AC-0.1.1, AC-0.1.4, AC-0.1.5
- **Integration Tests**: AC-0.1.2, AC-0.1.3, AC-0.1.6
- **Performance Tests**: AC-0.1.7
- **Manual Tests**: AC-0.1.8

**Story 0.2 (Environment Variables):** 7 ACs

- **Unit Tests**: AC-0.2.1, AC-0.2.2, AC-0.2.4, AC-0.2.5
- **Security Tests**: AC-0.2.6
- **Integration Tests**: AC-0.2.7
- **Manual Tests**: AC-0.2.3

**Story 0.3 (Supabase Connection):** 8 ACs

- **Unit Tests**: AC-0.3.2, AC-0.3.3, AC-0.3.5
- **Integration Tests**: AC-0.3.7, AC-0.3.8
- **Manual Tests**: AC-0.3.1, AC-0.3.4, AC-0.3.6

**Story 0.4 (Deployment Validation):** 8 ACs

- **Unit Tests**: AC-0.4.1, AC-0.4.6
- **Integration Tests**: AC-0.4.2, AC-0.4.3, AC-0.4.5
- **E2E Tests**: AC-0.4.4
- **Manual Tests**: AC-0.4.7, AC-0.4.8

**Story 0.5 (Monitoring - Optional):** 6 ACs

- **Unit Tests**: AC-0.5.2
- **Integration Tests**: AC-0.5.1, AC-0.5.4
- **Manual Tests**: AC-0.5.3, AC-0.5.5, AC-0.5.6

### Edge Cases and Error Scenarios

**Build Failures:**

- TypeScript compilation errors (invalid types, missing imports)
- Missing environment variables at build time
- Vite build failures (asset processing, code splitting issues)
- npm dependency installation failures (registry downtime)

**Deployment Failures:**

- GitHub Actions quota exceeded
- gh-pages deployment conflicts (concurrent deployments)
- GitHub Pages propagation delays (>5 minutes)
- Network failures during deployment

**Runtime Errors:**

- Supabase connection unavailable (503, network timeout)
- Service worker registration failures (browser incompatibility)
- PWA manifest parsing errors (invalid JSON)
- Environment variables missing at runtime (misconfiguration)

**Security Scenarios:**

- `.env` file accidentally committed
- Secrets exposed in client bundle
- HTTPS downgrade attacks (mixed content)
- RLS policies bypassed (misconfigurerred policies)

### Test Data Strategy

**Environment Variables:**

- **Test Data**: Mock Supabase URL (`https://test.supabase.co`) and anon key
- **Production Data**: Real credentials stored in GitHub Secrets
- **Validation**: Separate `.env.test` for test environment

**Supabase Connection:**

- **Test Data**: Mock Supabase client responses
- **Integration Data**: Test Supabase project (separate from production)
- **Production Data**: Production Supabase project (isolate user access via RLS)

**Deployment Validation:**

- **Test URL**: Staging deployment URL (if implemented)
- **Production URL**: `https://<username>.github.io/My-Love`

### Continuous Integration

**GitHub Actions Workflow:**

```
On Push to Main:
1. Run linter (ESLint + Prettier check)
2. Run TypeScript compiler (type checking)
3. Run unit tests (Vitest)
4. Run build (Vite production build)
5. Run smoke tests (dist/ validation)
6. Deploy to GitHub Pages (on success)
7. Optional: Run post-deployment validation (Story 0.5)
```

**Quality Gates:**

- All linter warnings must be fixed (zero warnings policy)
- TypeScript compilation must pass with no errors
- Unit tests must pass with ≥80% coverage
- Smoke tests must validate dist/ structure
- Deployment must complete within 5 minutes

### Test Automation Roadmap

**Epic 0 (Current):**

- Unit tests for core infrastructure (env validation, Supabase client)
- Smoke tests for build artifacts
- Manual deployment validation

**Story 0.5 (Optional):**

- Automated post-deployment validation in CI
- Deployment metrics collection

**Future Epics:**

- E2E tests for user flows (Epic 1: Authentication)
- Visual regression testing (Epic 2: Daily Notes)
- Performance testing (Epic 4: Offline & Performance)
- Accessibility testing (Epic 7: Accessibility)
