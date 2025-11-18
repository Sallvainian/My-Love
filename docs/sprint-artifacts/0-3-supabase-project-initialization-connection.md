# Story 0.3: Supabase Project Initialization & Connection Setup

**Epic:** Epic 0 - Deployment & Backend Infrastructure Setup
**Story ID:** 0.3
**Story Key:** 0-3-supabase-project-initialization-connection
**Status:** drafted
**Created:** 2025-11-18
**Updated:** 2025-11-18

---

## User Story

**As a** developer,
**I want** to initialize the Supabase project and verify connection from deployed PWA,
**So that** authentication and database features have working backend infrastructure.

---

## Context

This story establishes the foundational backend connection between the My-Love PWA and Supabase. It involves creating and configuring a Supabase project, initializing the database with connection pooling, and implementing the Supabase client in the application code. Successful completion ensures that all subsequent features requiring backend services (authentication, real-time messaging, database operations, file storage) have a working infrastructure foundation.

**Dependencies:**
- **Story 0.2** (Environment Variables & Secrets Management) - MUST be completed first; Supabase client requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` to be configured

**Related Documentation:**
- [Architecture](../architecture.md) - Sections: Supabase Backend, Security Architecture, API Contracts
- [PRD](../prd.md) - FR65 (Supabase integration with RLS), FR1-4 (Authentication backend)
- [Epics](../epics.md) - Epic 0, Story 0.3 (lines 302-332)

---

## Acceptance Criteria

### AC-0.3.1: Supabase Project Creation
**Given** Supabase account access
**When** new project is created
**Then**
- Project created with name "My-Love PWA"
- Appropriate region selected (closest to target user location)
- Database password generated and securely stored (not in version control)
- Project URL format: `https://[project-id].supabase.co`
- Project accessible via Supabase Dashboard

**Validation:**
- **Manual:** Navigate to Supabase Dashboard → All Projects → Verify "My-Love PWA" project exists
- **Manual:** Note project URL and verify it matches expected format
- **Manual:** Verify project region in Project Settings

---

### AC-0.3.2: Database Connection Pooling Configuration
**Given** Supabase project created
**When** database settings are configured
**Then**
- Connection pooling enabled (default Supabase configuration)
- Pool mode set to "Transaction" for optimal web application performance
- Maximum connections configured (Supabase default: suitable for development/small production)
- Connection string available in Project Settings → Database

**Validation:**
- **Manual:** Navigate to Supabase Dashboard → Project Settings → Database
- **Manual:** Verify "Connection Pooling" section shows configuration
- **Manual:** Verify Pool Mode is "Transaction"

**Technical Context:**
- Supabase uses PgBouncer for connection pooling
- Transaction mode suitable for web apps with many short-lived queries
- Connection limits scale with Supabase plan tier

---

### AC-0.3.3: Supabase Client Initialization Code
**Given** project codebase with environment variables configured
**When** Supabase client is implemented
**Then**
- File `/src/lib/supabase.ts` exists
- Client initialized using `createClient()` from `@supabase/supabase-js`
- Uses environment variables: `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Client configured with auth options:
  - `persistSession: true` (maintain session across page reloads)
  - `autoRefreshToken: true` (automatically refresh expired tokens)
  - `detectSessionInUrl: true` (handle magic link redirects)
- Client exported as named export: `export const supabase`

**Validation:**
```typescript
// File exists and exports client
import { supabase } from '@/lib/supabase';
console.log(supabase.supabaseUrl); // Should log project URL
console.log(supabase.supabaseKey); // Should log anon key
```

**Implementation Location:** `/src/lib/supabase.ts`

---

### AC-0.3.4: Deployed PWA Connection Verification
**Given** PWA deployed to GitHub Pages
**When** application loads in browser
**Then**
- Network tab shows successful connection to Supabase API (status 200)
- Supabase REST API endpoint accessible: `https://[project-id].supabase.co/rest/v1/`
- Supabase Realtime WebSocket connection established (ws:// or wss:// connection visible)
- No CORS errors in browser console
- Connection latency < 500ms (acceptable for international connections)

**Validation:**
1. Open deployed PWA in browser
2. Open DevTools → Network tab
3. Filter by "supabase" domain
4. Verify successful API calls (status 200)
5. Check Console for any Supabase-related errors (should be none)

**Expected Network Traffic:**
- `GET https://[project-id].supabase.co/rest/v1/` - Initial API handshake
- `WS wss://[project-id].supabase.co/realtime/v1/websocket` - Realtime connection

---

### AC-0.3.5: Console Error-Free Supabase Operations
**Given** Supabase client initialized
**When** application performs basic Supabase operations
**Then**
- No JavaScript errors in browser console related to Supabase
- No 401 Unauthorized errors (anon key valid)
- No 403 Forbidden errors (RLS policies allow basic access or return expected empty results)
- No network errors (DNS resolution, TLS handshake successful)
- Supabase client version logged on initialization (helpful for debugging)

**Validation:**
```typescript
// Add to src/lib/supabase.ts for debugging
console.log('[Supabase] Client initialized', {
  url: supabase.supabaseUrl,
  version: '2.81.1' // or imported from package.json
});

// Test basic query (should succeed or return empty, not error)
const { data, error } = await supabase.from('test_table').select('*').limit(1);
console.log('[Supabase] Test query result:', { data, error });
```

**Console Output Expected:**
- ✅ `[Supabase] Client initialized { url: '...', version: '2.81.1' }`
- ✅ `[Supabase] Test query result: { data: null, error: { code: '42P01', message: 'relation "test_table" does not exist' } }` (expected - table doesn't exist yet)
- ❌ No authentication errors, network errors, or uncaught exceptions

---

### AC-0.3.6: Authentication Service Availability
**Given** Supabase Auth service enabled
**When** magic link authentication is tested
**Then**
- Supabase Auth API endpoint accessible: `https://[project-id].supabase.co/auth/v1/`
- Can request magic link via `supabase.auth.signInWithOtp()`
- Request succeeds without errors (even if email not sent in dev environment)
- Auth API returns success response or clear error message
- No SMTP configuration required for basic auth testing (Supabase handles email in production)

**Validation:**
```typescript
// Test auth service availability (don't actually send email in test)
const testAuthAvailable = async () => {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: 'test@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      console.error('[Auth Test] Error:', error.message);
      return false;
    }

    console.log('[Auth Test] Auth service accessible');
    return true;
  } catch (e) {
    console.error('[Auth Test] Failed:', e);
    return false;
  }
};

// Run on app initialization
testAuthAvailable();
```

**Expected Behavior:**
- ✅ Auth service responds (may return success or email rate limit error - both indicate service is working)
- ❌ No network errors, DNS failures, or Supabase configuration errors

---

## Technical Implementation

### Files to Create/Modify

**1. `/src/lib/supabase.ts` (Create)**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database'; // Will be generated later

/**
 * Validates required environment variables are present.
 * Throws error with clear message if validation fails.
 */
function validateEnv(): void {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
  ] as const;

  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}\n` +
      `Please check .env file or GitHub Secrets configuration.`
    );
  }
}

// Validate on module load
validateEnv();

/**
 * Supabase client singleton
 *
 * Configuration:
 * - persistSession: Maintains user session across browser reloads (localStorage)
 * - autoRefreshToken: Automatically refreshes access tokens before expiry
 * - detectSessionInUrl: Handles magic link authentication redirects
 *
 * Security:
 * - Uses anonymous key (safe for public exposure)
 * - Row Level Security (RLS) policies enforce data access control
 * - All requests authenticated via session tokens after login
 */
export const supabase: SupabaseClient<Database> = createClient(
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

// Debug logging for development
if (import.meta.env.DEV) {
  console.log('[Supabase] Client initialized', {
    url: supabase.supabaseUrl,
    // Don't log the actual key, just confirm it's present
    keyConfigured: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  });
}

/**
 * Test Supabase connection on initialization
 * Validates that API is accessible and credentials are valid
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    // Attempt a simple query (will fail if table doesn't exist, but that's OK)
    // We're just testing that the connection works
    const { error } = await supabase.from('_healthcheck').select('*').limit(1);

    // Error code 42P01 means table doesn't exist - that's expected and OK
    // Any other error or network issue would indicate a real problem
    if (error && error.code !== '42P01') {
      console.error('[Supabase] Connection test failed:', error);
      return false;
    }

    console.log('[Supabase] Connection test successful');
    return true;
  } catch (e) {
    console.error('[Supabase] Connection test error:', e);
    return false;
  }
}
```

**2. `/src/types/database.ts` (Create - Placeholder)**

```typescript
/**
 * Supabase Database TypeScript Definitions
 *
 * TODO: Generate using Supabase CLI:
 * npx supabase gen types typescript --project-id [project-id] > src/types/database.ts
 *
 * For now, use empty Database type (will be populated after tables are created)
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // Tables will be added as they're created in subsequent stories
    }
    Views: {
      // Views will be added if needed
    }
    Functions: {
      // Functions will be added if needed
    }
    Enums: {
      // Enums will be added if needed
    }
  }
}
```

**3. `/src/main.tsx` (Modify - Add Connection Test)**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { testSupabaseConnection } from './lib/supabase';

// Test Supabase connection on app startup (development only)
if (import.meta.env.DEV) {
  testSupabaseConnection();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**4. `README.md` (Modify - Add Supabase Setup Section)**

```markdown
## Supabase Setup

### Initial Project Configuration

This step is already completed if you're working with the existing My-Love PWA project. For reference, the Supabase project was configured as follows:

1. **Project Creation:**
   - Name: "My-Love PWA"
   - Region: [Closest to target user - e.g., US East, EU Central]
   - Database password: Stored securely (not in version control)

2. **Database Connection:**
   - Connection pooling enabled (Transaction mode)
   - Connection string available in Project Settings → Database

3. **API Credentials:**
   - Project URL: Available in Project Settings → API
   - Anonymous Key: Available in Project Settings → API (safe for public exposure)
   - Service Role Key: Never use in client code (admin access only)

### Verifying Supabase Connection

After starting the development server, check the browser console for:

```
[Supabase] Client initialized { url: '...', keyConfigured: true }
[Supabase] Connection test successful
```

If you see connection errors, verify:
1. `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
2. Supabase project is active (not paused)
3. Network allows connections to `*.supabase.co`

### Generating TypeScript Types (Later)

After database tables are created in subsequent stories:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
npx supabase login

# Generate TypeScript types
npx supabase gen types typescript --project-id [your-project-id] > src/types/database.ts
```

This command will populate `src/types/database.ts` with type-safe definitions for all tables, views, and functions.
```

---

## Testing Strategy

### Manual Testing Checklist

- [ ] **AC-0.3.1:** Supabase Dashboard → Verify "My-Love PWA" project exists
- [ ] **AC-0.3.2:** Project Settings → Database → Verify connection pooling configured
- [ ] **AC-0.3.3:** Code review `/src/lib/supabase.ts` - client initialization correct
- [ ] **AC-0.3.4:** Deploy to GitHub Pages → Network tab shows Supabase connections (200 status)
- [ ] **AC-0.3.5:** Browser console shows no Supabase errors
- [ ] **AC-0.3.6:** Test auth service availability (run `testAuthAvailable()` in console)

### Integration Tests

**Test File:** `tests/integration/supabase-connection.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { supabase, testSupabaseConnection } from '@/lib/supabase';

describe('Supabase Connection Integration', () => {
  beforeAll(async () => {
    // Ensure environment variables are set for tests
    expect(import.meta.env.VITE_SUPABASE_URL).toBeDefined();
    expect(import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY).toBeDefined();
  });

  it('should initialize Supabase client', () => {
    expect(supabase).toBeDefined();
    expect(supabase.supabaseUrl).toBeTruthy();
    expect(supabase.supabaseKey).toBeTruthy();
  });

  it('should connect to Supabase API', async () => {
    const isConnected = await testSupabaseConnection();
    expect(isConnected).toBe(true);
  });

  it('should have auth service available', async () => {
    const { error } = await supabase.auth.getSession();

    // No session expected (not logged in), but service should respond
    // Error would indicate auth service unavailable
    expect(error).toBeNull();
  });
});
```

### Deployment Validation

After deployment to GitHub Pages:

1. **Network Tab Verification:**
   - Open DevTools → Network tab
   - Filter by "supabase"
   - Verify API calls return 200 status
   - Verify WebSocket connection established

2. **Console Log Verification:**
   - Check for `[Supabase] Client initialized`
   - Check for `[Supabase] Connection test successful`
   - No red error messages

3. **Auth Service Test:**
   - Open browser console
   - Run: `import { supabase } from './lib/supabase'; await supabase.auth.getSession();`
   - Should return session object (null session is OK)

---

## Definition of Done (DoD)

- [ ] All acceptance criteria (AC-0.3.1 through AC-0.3.6) are met and validated
- [ ] Supabase project created and accessible via Dashboard
- [ ] Database connection pooling configured (Transaction mode)
- [ ] `/src/lib/supabase.ts` implemented with client initialization
- [ ] `/src/types/database.ts` created (placeholder for now)
- [ ] Environment variables (from Story 0.2) tested with Supabase client
- [ ] Integration tests written and passing
- [ ] Manual testing checklist completed
- [ ] Deployed PWA successfully connects to Supabase (verified in production)
- [ ] Browser console shows no Supabase connection errors
- [ ] README.md updated with Supabase setup instructions
- [ ] Code reviewed (self-review or peer review)
- [ ] No hardcoded credentials in version control
- [ ] Auth service availability tested (magic link can be requested)

---

## Dependencies and Blockers

### Depends On (Blocking)
- **Story 0.2:** Environment Variables & Secrets Management
  - Reason: Supabase client requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` environment variables
  - Impact: Cannot initialize Supabase client without credentials configured

### Blocks (Blocked By This Story)
- **Story 1.2:** Supabase Client & Configuration Validation (Epic 1)
  - Reason: Validation story requires working Supabase connection to test
- **All subsequent stories requiring database, auth, storage, or realtime features**
  - Reason: Supabase client is foundational infrastructure for all backend operations

---

## Dev Notes

### Architecture Constraints

From [architecture.md](../architecture.md):

**Supabase Backend (Lines 49-63):**
- **Auth**: Magic link passwordless authentication
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Realtime**: WebSocket subscriptions for Love Notes
- **Storage**: Photo uploads with access policies
- **Edge Functions**: Scheduled notifications (cron jobs)

**Security Architecture (Lines 796-843):**
- All Supabase connections over HTTPS/TLS 1.3
- WebSocket connections encrypted
- Row Level Security (RLS) enabled on all tables
- Supabase anon key safe for public exposure (RLS protects data)

### Project Structure Notes

From [architecture.md](../architecture.md) - Project Structure (Lines 70-156):

**Supabase Client Location:** `/src/lib/supabase.ts`
- Centralized client initialization
- Shared across all components and hooks
- Exports singleton instance: `export const supabase`

**Type Definitions:** `/src/types/database.ts`
- Generated from Supabase schema (later)
- Provides type-safe database operations
- Updated whenever database schema changes

### Testing Standards

From architecture.md, testing should cover:
- Client initialization with valid/invalid credentials
- Connection success/failure scenarios
- Auth service availability
- Network error handling

### Learnings from Previous Story

**From Story 0.2 (Environment Variables & Secrets Management):**
- Previous story not yet implemented
- Will document integration points after 0.2 completion

**Expected Integration:**
- This story consumes environment variables configured in Story 0.2
- Supabase client uses `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- If Story 0.2 validation works correctly, this story's client initialization should work seamlessly

---

## References

- **Architecture:** [architecture.md](../architecture.md)
  - Supabase Backend (lines 49-63)
  - Security Architecture (lines 796-843)
  - API Contracts (lines 692-759)
  - Project Structure (lines 70-156)
- **PRD:** [prd.md](../prd.md)
  - FR65: Supabase integration with Row Level Security (lines 493)
  - FR1-4: Authentication backend requirements (lines 98-107)
- **Epics:** [epics.md](../epics.md)
  - Epic 0, Story 0.3 (lines 302-332)
  - Epic 1 dependencies (Story 1.2 blocked by this story)

---

## Story Metadata

**Complexity:** Low-Medium (Supabase project setup + connection validation)
**Estimated Effort:** 1-2 hours (project creation, client implementation, testing)
**Risk Level:** Low (well-documented Supabase setup, no custom logic)
**Priority:** High (blocks all backend-dependent features)

**Tags:** `deployment`, `backend`, `supabase`, `database`, `infrastructure`, `epic-0`

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-18 | 1.0 | Story created from Epic 0 breakdown | BMAD create-story workflow |

---

_Story created by BMAD create-story workflow_
_Template Version: 1.0_
_Generated: 2025-11-18_
