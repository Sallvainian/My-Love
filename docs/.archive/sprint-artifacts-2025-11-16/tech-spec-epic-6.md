# Epic Technical Specification: Interactive Connection Features

Date: 2025-11-15
Author: Frank
Epic ID: epic-6
Status: Draft

---

## Overview

This epic implements real-time emotional connection features to enable mood tracking, spontaneous interactions (poke/kiss), and anniversary countdown celebrations. Building on the existing offline-first PWA architecture, these features introduce Supabase (managed PostgreSQL with Realtime) as the backend service for syncing mood data and interactions between partners. The implementation maintains the current component-based SPA pattern while adding network-aware capabilities for real-time updates when online, with graceful degradation to local-only mode when offline.

Core features: (1) Mood logging interface with 5 mood types stored locally, (2) Supabase integration for partner visibility of mood data with Row Level Security, (3) Interactive "poke" and "kiss" actions with animated feedback, (4) Anniversary countdown timers with celebration triggers, and (5) Calendar-based mood history visualization.

## Objectives and Scope

**In Scope:**

- Supabase backend setup with Row Level Security and API integration for mood sync and interactions
- Mood tracking UI with 5 mood types (loved, happy, content, thoughtful, grateful) and optional notes
- Local-first mood storage in IndexedDB with background sync to Supabase when online
- Calendar view displaying mood history with visual indicators for each mood type
- Partner visibility of mood data through Supabase Realtime channels
- Interactive "poke" and "kiss" features with push-style notifications and animated reactions
- Anniversary countdown timer(s) displaying days/hours/minutes to relationship milestones
- Celebration animations triggered at countdown completion
- Top navigation integration for accessing new features (Mood Tracker tab)

**Out of Scope:**

- Web Push API notifications (browser permission complexity deferred to future enhancement)
- Advanced mood analytics (trends, insights, correlations) - MVP focuses on logging and viewing
- Multi-user authentication system (hardcoded partner pairing for single-use case)
- Cross-device sync beyond mood/interaction data (photos, messages remain local-only)
- Social sharing of moods or interactions
- Historical data export/import for moods

## System Architecture Alignment

**Existing Architecture Leveraged:**

- **Component-based SPA**: New components (MoodTracker, MoodHistoryCalendar, CountdownTimer, PokeKissInterface) follow existing React + TypeScript + Tailwind pattern
- **Zustand State Management**: Extending `useAppStore` with new slices for moods (already partially implemented in PRD), interactions, and countdowns
- **IndexedDB Local Storage**: Creating new object store for mood entries to maintain offline-first capability; follows existing `BaseIndexedDBService` pattern established in Story 5.3
- **Service Layer**: New `MoodService` extending `BaseIndexedDBService<MoodEntry>` for CRUD operations, mirroring `PhotoStorageService` and `CustomMessageService` patterns
- **PWA Offline-First**: All features work locally; Supabase sync is enhancement when online (graceful degradation)

**New Architecture Components:**

- **Supabase Backend**: Managed PostgreSQL with Realtime for real-time data sync
  - Tables: `moods`, `interactions`, `users` (minimal - just partner IDs)
  - Realtime channels for live updates (WebSocket-based)
  - PostgREST auto-generated REST API for CRUD operations
  - Authentication via JWT with Row Level Security policies (database-level access control)
- **Network Layer**: New `api/` services for Supabase client wrapper
  - `supabaseClient.ts`: Singleton Supabase JavaScript Client instance
  - `moodSyncService.ts`: Sync local IndexedDB moods to Supabase
  - `interactionService.ts`: Send/receive poke/kiss events
- **Background Sync Strategy**: Periodic sync when app is active and online; retry logic for failed syncs
- **State Management Extension**: New store slices for `interactions`, `countdowns`, `syncStatus`

**Integration Points:**

- **Navigation**: Extends existing DailyMessage single-view to support tabbed navigation (Home, Mood Tracker) - React Router not required yet, can use simple state-based tab switching
- **Theme System**: Mood calendar and interaction animations use existing Tailwind theme variables for consistency
- **Error Handling**: Leverages existing `ErrorBoundary` component (Story 1.5) for network error graceful degradation
- **Animations**: Uses Framer Motion library already in stack for mood logging feedback and poke/kiss animations

**Constraints:**

- Must maintain <2s load time on 3G (NFR001)
- Must function fully offline except sync features (NFR002)
- Must support mobile viewports 320px-428px (NFR004)
- Supabase backend uses managed free tier (500MB database, 2GB storage, Realtime included)

## Detailed Design

### Services and Modules

| Service/Module                            | Responsibility                             | Inputs                  | Outputs                     | Owner/Location                           |
| ----------------------------------------- | ------------------------------------------ | ----------------------- | --------------------------- | ---------------------------------------- |
| **MoodService**                           | IndexedDB CRUD for mood entries            | MoodEntry objects       | Promise<MoodEntry[]>        | `src/services/moodService.ts`            |
| - extends BaseIndexedDBService<MoodEntry> | Inherits: add, get, getAll, update, delete | -                       | -                           | Follows Story 5.3 pattern                |
| - getStoreName()                          | Returns 'moods' object store               | -                       | string                      | -                                        |
| - \_doInit()                              | Creates moods store with by-date index     | -                       | Promise<void>               | -                                        |
| - getMoodForDate()                        | Retrieve mood entry for specific date      | Date                    | Promise<MoodEntry \| null>  | Custom method                            |
| - getMoodsInRange()                       | Get moods between start/end dates          | startDate, endDate      | Promise<MoodEntry[]>        | For calendar view                        |
| **SupabaseClient**                        | Singleton SDK instance for API calls       | Config (URL, anon key)  | Supabase instance           | `src/api/supabaseClient.ts`              |
| - initialize()                            | Setup connection, handle auth              | Supabase URL + anon key | Promise<void>               | Called on app init                       |
| - from()                                  | Access Supabase tables                     | tableName               | Table<T>                    | Generic table accessor                   |
| **MoodSyncService**                       | Sync local moods to Supabase               | -                       | -                           | `src/api/moodSyncService.ts`             |
| - syncMood()                              | Upload single mood entry                   | MoodEntry               | Promise<SupabaseMoodRecord> | One-way sync                             |
| - syncPendingMoods()                      | Batch upload unsynced moods                | -                       | Promise<{synced, failed}>   | Background task                          |
| - subscribeMoodUpdates()                  | Real-time partner mood updates             | callback                | Unsubscribe fn              | Realtime channel                         |
| **InteractionService**                    | Send/receive poke/kiss events              | -                       | -                           | `src/api/interactionService.ts`          |
| - sendPoke()                              | Send poke to partner                       | partnerId               | Promise<InteractionRecord>  | Inserts Supabase row                     |
| - sendKiss()                              | Send kiss to partner                       | partnerId               | Promise<InteractionRecord>  | Inserts Supabase row                     |
| - subscribeInteractions()                 | Listen for incoming interactions           | callback                | Unsubscribe fn              | Realtime channel                         |
| - getInteractionHistory()                 | Fetch past interactions                    | limit, offset           | Promise<Interaction[]>      | For history view                         |
| **CountdownService**                      | Calculate time to anniversaries            | -                       | -                           | `src/utils/countdownService.ts`          |
| - calculateTimeRemaining()                | Compute days/hrs/mins to date              | targetDate              | {days, hours, minutes}      | Pure function                            |
| - getNextAnniversary()                    | Find nearest upcoming anniversary          | Anniversary[]           | Anniversary \| null         | From settings                            |
| - shouldTriggerCelebration()              | Check if countdown reached zero            | targetDate              | boolean                     | Trigger animations                       |
| **MoodTracker Component**                 | UI for logging daily mood                  | -                       | -                           | `src/components/MoodTracker.tsx`         |
| - Mood type selector (5 buttons)          | User tap                                   | MoodType                | -                           | Uses Zustand action                      |
| - Optional note input                     | Text input                                 | string                  | -                           | Stored with mood                         |
| - Submit handler                          | Form submit                                | -                       | Calls addMoodEntry()        | Updates IndexedDB + Supabase             |
| **MoodHistoryCalendar Component**         | Visual mood history                        | -                       | -                           | `src/components/MoodHistoryCalendar.tsx` |
| - Calendar grid (month view)              | -                                          | -                       | Renders 30-31 days          | Responsive design                        |
| - Mood indicators per day                 | Mood data                                  | MoodEntry[]             | Color-coded dots            | Uses theme colors                        |
| - Day detail modal                        | Day tap                                    | MoodEntry               | Shows note + timestamp      | Framer Motion modal                      |
| **CountdownTimer Component**              | Display anniversary countdown              | -                       | -                           | `src/components/CountdownTimer.tsx`      |
| - Real-time countdown                     | setInterval (1 min)                        | targetDate              | {days, hrs, mins}           | Updates every minute                     |
| - Celebration animation                   | countdown === 0                            | -                       | Confetti/fireworks          | Framer Motion                            |
| - Multiple timers                         | Anniversary[]                              | -                       | Renders multiple cards      | From settings                            |
| **PokeKissInterface Component**           | Send/receive interactions                  | -                       | -                           | `src/components/PokeKissInterface.tsx`   |
| - Poke button                             | User tap                                   | -                       | Calls sendPoke()            | Animated button                          |
| - Kiss button                             | User tap                                   | -                       | Calls sendKiss()            | Animated button                          |
| - Incoming notification badge             | Real-time event                            | Interaction             | Visual badge + count        | Clears on view                           |
| - Animation playback                      | Event received                             | InteractionType         | Plays poke/kiss anim        | Framer Motion                            |
| **Navigation Component**                  | Tab switching                              | -                       | -                           | `src/components/Navigation.tsx`          |
| - Tab bar (Home, Mood, Settings)          | User tap                                   | TabName                 | Sets activeTab state        | Simple state toggle                      |
| - Active tab indicator                    | activeTab state                            | TabName                 | Visual highlight            | Tailwind styling                         |

### Data Models and Contracts

```typescript
// Core Mood Entry (IndexedDB + Supabase)
interface MoodEntry {
  id?: number; // Auto-increment (IndexedDB) or Supabase ID
  userId: string; // Partner identifier (hardcoded for single-user)
  moodType: MoodType; // Enum: 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful'
  note?: string; // Optional user note (max 500 chars)
  timestamp: Date; // When mood was logged
  synced: boolean; // Whether uploaded to Supabase
  supabaseId?: string; // Supabase record ID (if synced)
}

enum MoodType {
  Loved = 'loved',
  Happy = 'happy',
  Content = 'content',
  Thoughtful = 'thoughtful',
  Grateful = 'grateful'
}

// Supabase Mood Record (backend schema)
interface SupabaseMoodRecord {
  id: string; // Supabase UUID auto-generated
  user_id: string; // Foreign key to users table
  mood_type: string; // 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful'
  note: string; // Optional text field
  created_at: string; // ISO timestamp (auto-generated)
  updated_at: string; // ISO timestamp
}

// Interaction Event (Poke/Kiss)
interface Interaction {
  id?: number; // Auto-increment (local) or Supabase ID
  type: 'poke' | 'kiss';
  fromUserId: string; // Sender
  toUserId: string; // Recipient (partner)
  timestamp: Date; // When sent
  viewed: boolean; // Whether recipient has seen it
  supabaseId?: string; // Supabase record ID
}

// Supabase Interaction Record
interface SupabaseInteractionRecord {
  id: string;
  type: string; // 'poke' | 'kiss'
  from_user_id: string; // Foreign key to users table
  to_user_id: string; // Foreign key to users table
  viewed: boolean; // Default: false
  created_at: string; // ISO timestamp
}

// Anniversary (already in PRD, stored in Settings)
interface Anniversary {
  id: number;
  title: string; // e.g., "First Date Anniversary"
  date: Date; // Target date
  recurring: boolean; // If true, repeats yearly
}

// Zustand Store Extension
interface AppState {
  // Existing slices...
  moods: MoodEntry[]; // Already in PRD
  interactions: Interaction[]; // NEW
  countdowns: Anniversary[]; // NEW (or reuse settings.anniversaries)
  syncStatus: {
    lastMoodSync: Date | null;
    pendingMoods: number;
    isOnline: boolean;
  }; // NEW

  // New actions
  addMoodEntry: (mood: MoodType, note?: string) => Promise<void>;
  getMoodForDate: (date: string) => MoodEntry | undefined;
  syncMoods: () => Promise<void>; // Trigger background sync
  sendPoke: (partnerId: string) => Promise<void>;
  sendKiss: (partnerId: string) => Promise<void>;
  markInteractionViewed: (id: number) => Promise<void>;
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void; // Already in PRD
  removeAnniversary: (id: number) => void; // Already in PRD
}

// Supabase Tables Schema (PostgreSQL)
// Table: moods
CREATE TABLE moods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mood_type TEXT CHECK (mood_type IN ('loved', 'happy', 'content', 'thoughtful', 'grateful')),
  note TEXT CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_moods_user_created ON moods(user_id, created_at);

-- Row Level Security
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own moods" ON moods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own and partner moods" ON moods FOR SELECT USING (true);

// Table: interactions
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('poke', 'kiss')),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  viewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_interactions_to_user_viewed ON interactions(to_user_id, viewed);

-- Row Level Security
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert interactions" ON interactions FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can view interactions to/from them" ON interactions FOR SELECT USING (auth.uid() IN (from_user_id, to_user_id));

// Table: users (minimal - just partner IDs, leverages Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  partner_name TEXT,
  device_id UUID DEFAULT gen_random_uuid()
);
```

### APIs and Interfaces

**Supabase PostgREST API Endpoints:**

| Method | Path                                                                | Request Body                         | Response                      | Purpose                   |
| ------ | ------------------------------------------------------------------- | ------------------------------------ | ----------------------------- | ------------------------- |
| POST   | `/rest/v1/moods`                                                    | `{ user_id, mood_type, note }`       | `SupabaseMoodRecord`          | Create mood entry         |
| GET    | `/rest/v1/moods?select=*&user_id=eq.<id>`                           | -                                    | `SupabaseMoodRecord[]`        | Fetch partner moods       |
| POST   | `/rest/v1/interactions`                                             | `{ type, from_user_id, to_user_id }` | `SupabaseInteractionRecord`   | Send poke/kiss            |
| GET    | `/rest/v1/interactions?select=*&to_user_id=eq.<id>&viewed=eq.false` | -                                    | `SupabaseInteractionRecord[]` | Get unviewed interactions |
| PATCH  | `/rest/v1/interactions?id=eq.<id>`                                  | `{ viewed: true }`                   | `SupabaseInteractionRecord`   | Mark interaction viewed   |

**Supabase Realtime Channels (WebSocket-based):**

```typescript
// Subscribe to partner's mood updates
const moodsChannel = supabaseClient
  .channel('moods')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'moods', filter: `user_id=eq.${partnerId}` },
    (payload) => {
      // Update local state with partner's new mood
      updatePartnerMoodUI(payload.new);
    }
  )
  .subscribe();

// Subscribe to incoming interactions
const interactionsChannel = supabaseClient
  .channel('interactions')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'interactions',
      filter: `to_user_id=eq.${currentUserId}`,
    },
    (payload) => {
      // Show notification badge + play animation
      handleIncomingInteraction(payload.new);
    }
  )
  .subscribe();
```

**Local Service Interfaces:**

```typescript
// MoodService (extends BaseIndexedDBService)
interface IMoodService {
  add(mood: Omit<MoodEntry, 'id'>): Promise<MoodEntry>;
  get(id: number): Promise<MoodEntry | null>;
  getAll(): Promise<MoodEntry[]>;
  getMoodForDate(date: Date): Promise<MoodEntry | null>;
  getMoodsInRange(start: Date, end: Date): Promise<MoodEntry[]>;
  update(id: number, updates: Partial<MoodEntry>): Promise<void>;
  delete(id: number): Promise<void>;
}

// MoodSyncService
interface IMoodSyncService {
  syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord>;
  syncPendingMoods(): Promise<{ synced: number; failed: number }>;
  subscribeMoodUpdates(callback: (mood: SupabaseMoodRecord) => void): () => void;
}

// InteractionService
interface IInteractionService {
  sendPoke(partnerId: string): Promise<InteractionRecord>;
  sendKiss(partnerId: string): Promise<InteractionRecord>;
  subscribeInteractions(callback: (interaction: SupabaseInteractionRecord) => void): () => void;
  getInteractionHistory(limit: number, offset: number): Promise<Interaction[]>;
  markViewed(interactionId: string): Promise<void>;
}
```

### Workflows and Sequencing

**Workflow 1: User Logs Daily Mood (Local-First with Background Sync)**

1. User navigates to Mood Tracker tab (tap navigation bar)
2. MoodTracker component renders with 5 mood type buttons
3. User selects mood type (e.g., "Loved") → button animates (scale + color feedback)
4. Optional: User enters note in text input (max 500 chars)
5. User taps "Log Mood" button
6. **Client-side:**
   - Zustand action `addMoodEntry(moodType, note)` called
   - MoodService.add() creates IndexedDB record with `synced: false`
   - Store updates `moods` array → UI re-renders with success feedback
7. **Background sync (if online):**
   - MoodSyncService.syncMood() called asynchronously
   - POSTs mood to Supabase `/rest/v1/moods`
   - On success: Updates local record with `synced: true` and `supabaseId`
   - On failure: Queues for retry (next sync cycle)
8. **Real-time partner update:**
   - Partner's app receives Realtime channel event for new mood
   - Partner's UI shows notification badge "New mood from [Name]"

**Workflow 2: User Sends Poke/Kiss Interaction**

1. User taps "Poke" or "Kiss" button in PokeKissInterface component
2. Button triggers send animation (pulse + haptic feedback if supported)
3. Zustand action `sendPoke(partnerId)` or `sendKiss(partnerId)` called
4. **Client-side:**
   - InteractionService.sendPoke/sendKiss() POSTs to Supabase
   - Creates `SupabaseInteractionRecord` with `from_user_id: currentUserId`, `to_user_id: partnerId`
   - Stores interaction locally in `interactions` array for history
5. **Real-time partner notification:**
   - Partner's app receives Realtime channel event
   - PokeKissInterface shows notification badge (e.g., "1 new poke")
   - Partner taps badge → Animation plays (poke finger tap or kiss lips animation)
   - Interaction marked as `viewed: true` via PATCH request
6. **Feedback:**
   - Sender sees "Poke sent!" toast message
   - Interaction appears in history list with timestamp

**Workflow 3: User Views Mood History (Calendar View)**

1. User navigates to Mood History (sub-tab or button in Mood Tracker)
2. MoodHistoryCalendar component renders calendar grid for current month
3. **Data loading:**
   - Calls `getMoodsInRange(startOfMonth, endOfMonth)`
   - MoodService fetches from IndexedDB by-date index
4. **Rendering:**
   - Each day cell displays mood indicator (colored dot/emoji) if mood exists
   - Empty days show neutral background
5. User taps day with mood → Modal opens showing:
   - Mood type (with icon/color)
   - Timestamp (formatted)
   - Note text (if present)
6. User swipes left/right to navigate previous/next months
7. **Partner visibility (if enabled):**
   - Separate toggle "Show partner moods"
   - Fetches partner moods via MoodSyncService.subscribeMoodUpdates()
   - Displays partner moods with different visual style (e.g., smaller dots)

**Workflow 4: Anniversary Countdown Display**

1. App initialization loads `settings.anniversaries` array
2. CountdownService.getNextAnniversary() finds nearest future date
3. CountdownTimer component mounts in Home view (below DailyMessage)
4. **Every minute:**
   - setInterval updates countdown calculation
   - Displays: "87 days, 14 hours, 32 minutes until First Date Anniversary"
5. **Celebration trigger:**
   - When countdown reaches 0:00:00 → `shouldTriggerCelebration() === true`
   - Framer Motion fireworks/confetti animation plays
   - DailyMessage card displays special anniversary-themed message
   - Animation plays once, then countdown resets to next anniversary (if recurring)
6. **Multiple countdowns:**
   - If multiple anniversaries exist, displays stacked cards
   - Shows next 3 upcoming anniversaries (configurable)

## Non-Functional Requirements

### Performance

**Target Metrics (from PRD NFR001):**

- App load time: < 2 seconds on 3G connection
- Animation frame rate: 60fps for all Framer Motion transitions
- IndexedDB query time: < 100ms for mood/interaction retrieval
- Supabase API response time: < 500ms for sync operations (when online)
- Calendar render time: < 200ms for 30-day month view

**Performance Constraints:**

- **Mood sync batching**: Limit to 50 pending moods per sync batch to avoid blocking UI
- **Realtime connection**: Maintain single persistent Realtime channel for updates; reconnect on disconnect with exponential backoff (1s, 2s, 4s, max 30s)
- **Countdown timer updates**: Use 1-minute intervals (not 1-second) to reduce CPU usage and battery drain
- **Calendar lazy loading**: Only fetch moods for visible month; cache previous/next months for smooth navigation
- **Interaction history pagination**: Load 20 interactions per page to avoid large memory footprint

**Optimizations:**

- Debounce mood note input (300ms) to prevent excessive re-renders
- Use Zustand selectors to prevent unnecessary component re-renders when unrelated state changes
- IndexedDB indexes on `by-date` for fast range queries (moods calendar view)
- PostgREST query filters server-side to reduce payload size
- Framer Motion `layoutId` for smooth shared element transitions between views

### Security

**Authentication & Authorization (from PRD NFR005):**

- **Supabase authentication**: JWT-based authentication with Row Level Security policies
  - `VITE_SUPABASE_URL`: Supabase project URL
  - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`: Supabase anonymous/public key (safe for client-side)
  - `VITE_USER_ID`: Hardcoded user UUID for current user
  - `VITE_PARTNER_ID`: Hardcoded partner UUID for mood visibility
- **Row Level Security (RLS)**: Database-level access control enforced by PostgreSQL policies
- **No multi-user authentication**: Single-user PWA with hardcoded partner pairing
- **Token storage**: Supabase SDK handles JWT token storage automatically in LocalStorage

**Data Privacy:**

- **Local-only data**: Photos, messages, and settings remain client-side only (not synced to Supabase)
- **Synced data**: Only mood entries and poke/kiss interactions synced to backend
- **No third-party services**: No analytics, tracking, or external integrations beyond Supabase
- **HTTPS required**: Supabase API calls use HTTPS (enforced by managed service)
- **CORS configuration**: Supabase auto-configures CORS for all web clients (no manual setup needed)

**Input Validation:**

- **Mood notes**: Max 500 characters, sanitize HTML to prevent XSS (React escapes by default, PostgreSQL enforces constraints)
- **Supabase requests**: Validate mood_type enum values before submission (enforced by PostgreSQL CHECK constraint)
- **User IDs**: Validate UUID format for userId/partnerId to prevent injection

**Threat Mitigation:**

- **XSS protection**: React auto-escapes content; no dangerouslySetInnerHTML usage
- **SQL injection**: PostgREST uses parameterized queries; Row Level Security prevents unauthorized access
- **CSRF**: Supabase SDK handles JWT authentication automatically
- **Rate limiting**: Supabase enforces API rate limits on free tier; client respects 429 responses

### Reliability/Availability

**Offline-First Resilience (from PRD NFR002):**

- **Full offline functionality**: All features work without network except:
  - Mood sync to Supabase (queued for retry when online)
  - Real-time partner mood updates (shown on reconnect)
  - Poke/kiss sending (queued or error message if offline)
- **IndexedDB durability**: All critical data persisted locally; no data loss on network failure
- **Sync retry strategy**: Exponential backoff for failed Supabase requests (3 retries max, then user notification)

**Error Handling:**

- **Network errors**: Graceful degradation with user-friendly messages ("You're offline. Mood saved locally and will sync when online.")
- **Supabase API errors**: Specific error messages for 4xx/5xx responses (e.g., "Server unavailable. Try again later.")
- **IndexedDB quota exceeded**: Warning message when storage nears limit (90% threshold); option to clear old moods
- **Realtime disconnection**: Auto-reconnect with visual indicator (e.g., "Reconnecting..." badge)
- **React ErrorBoundary**: Catches component errors; displays fallback UI without crashing app (already implemented in Story 1.5)

**Availability Targets:**

- **Client-side availability**: 99.9% (PWA cached offline; failures only from device issues)
- **Supabase availability**: 99.9% uptime SLA (managed service); minimal downtime expected
- **Sync success rate**: 98% of mood syncs succeed within 24 hours (with retry logic)

**Recovery Mechanisms:**

- **Failed sync recovery**: Store failed sync attempts in `syncQueue` array; retry on app focus/network reconnect
- **Data consistency**: On Realtime reconnect, fetch latest partner moods since last sync timestamp to catch up
- **Conflict resolution**: Last-write-wins for mood edits (though unlikely since moods are append-only)

### Observability

**Logging Requirements:**

- **Client-side logging**: Use `console.error()` for critical errors (IndexedDB failures, Supabase API errors)
- **Supabase sync logging**: Log sync attempts, successes, and failures with timestamps for debugging
  - `[SYNC] Mood synced: id=123, supabaseId=abc, timestamp=...`
  - `[SYNC] Failed to sync mood: id=124, error=Network timeout`
- **Realtime connection logging**: Log connection state changes (connected, disconnected, reconnecting)
- **Performance logging**: Optional `performance.mark()` for critical operations (IndexedDB queries, API calls)

**Metrics to Track:**

- **Mood sync success rate**: Percentage of moods successfully synced to Supabase
- **Average sync latency**: Time from mood creation to successful Supabase sync
- **Interaction delivery time**: Time from poke/kiss send to partner receipt (Realtime latency)
- **IndexedDB query performance**: 95th percentile query time for mood retrieval
- **Error rates**: Frequency of specific error types (network, storage quota, API errors)

**Monitoring Signals:**

- **User-facing indicators**:
  - Sync status badge (e.g., "3 moods pending sync" when offline)
  - Network connectivity indicator (online/offline dot in nav bar)
  - Last sync timestamp display in settings
- **Developer signals**:
  - Browser DevTools console logs for debugging
  - IndexedDB inspection (Application tab → IndexedDB → my-love-db)
  - Network tab for Supabase API request/response inspection
  - Service Worker status (Application tab → Service Workers)

**Alerting (future enhancement):**

- No automated alerting in MVP; user relies on visual indicators
- Future: Optional Sentry or similar error tracking integration for production monitoring

## Dependencies and Integrations

**Existing Dependencies (already in package.json):**

| Dependency                | Version  | Purpose                    | Epic 6 Usage                                                                        |
| ------------------------- | -------- | -------------------------- | ----------------------------------------------------------------------------------- |
| **@supabase/supabase-js** | ^2.38.0  | Supabase JavaScript Client | Core dependency for all Supabase API interactions (moods, interactions, Realtime)   |
| **react**                 | 19.1.1   | UI framework               | New components: MoodTracker, MoodHistoryCalendar, CountdownTimer, PokeKissInterface |
| **zustand**               | 5.0.8    | State management           | Extend store with moods, interactions, countdowns, syncStatus slices                |
| **idb**                   | 8.0.3    | IndexedDB wrapper          | MoodService for local mood storage (extends BaseIndexedDBService)                   |
| **framer-motion**         | 12.23.24 | Animation library          | Mood logging feedback, poke/kiss animations, celebration fireworks                  |
| **lucide-react**          | 0.548.0  | Icon library               | Mood type icons, interaction buttons, calendar navigation icons                     |
| **zod**                   | 3.25.76  | Schema validation          | Validate MoodEntry, Interaction schemas before IndexedDB/Supabase writes            |

**New Dependencies (to be added):**

| Dependency                | Version | Command                             | Purpose                                  |
| ------------------------- | ------- | ----------------------------------- | ---------------------------------------- |
| **@supabase/supabase-js** | ^2.38.0 | `npm install @supabase/supabase-js` | Supabase client SDK for API and Realtime |

**Dependencies to Remove:**

| Dependency     | Reason                            |
| -------------- | --------------------------------- |
| **pocketbase** | Replaced by @supabase/supabase-js |

**Integration Points:**

**1. Supabase Backend**

- **Type**: Managed PostgreSQL with Realtime (Supabase Cloud)
- **Integration method**: PostgREST REST API + Realtime channels (WebSocket-based)
- **Configuration**:
  - `VITE_SUPABASE_URL`: Environment variable for Supabase project URL
  - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`: Supabase anonymous/public key
  - `VITE_USER_ID`: Hardcoded user UUID for current user
  - `VITE_PARTNER_ID`: Hardcoded partner UUID for mood visibility
- **Tables to create**:
  - `moods`: Store mood entries with user_id foreign key
  - `interactions`: Store poke/kiss events
  - `users`: Minimal user records (partner names, device IDs, references Supabase Auth)
- **Authentication**: JWT-based with Row Level Security policies
- **CORS**: Auto-configured for all web clients (no manual setup needed)

**2. IndexedDB (via idb wrapper)**

- **Database**: `my-love-db` (existing)
- **New object store**: `moods` with `by-date` index for calendar queries
- **Migration**: Add new store in next schema version bump (v3 → v4)
- **Service pattern**: MoodService extends BaseIndexedDBService<MoodEntry> (Story 5.3 pattern)

**3. Zustand Store Extension**

- **New slices**:
  - `moods: MoodEntry[]` (already in PRD, need to implement)
  - `interactions: Interaction[]` (new)
  - `syncStatus: { lastMoodSync, pendingMoods, isOnline }` (new)
- **New actions**:
  - `addMoodEntry(mood, note)`
  - `syncMoods()`
  - `sendPoke(partnerId)`
  - `sendKiss(partnerId)`
  - `markInteractionViewed(id)`
- **Persistence**: Only persist `moods` array to LocalStorage (interactions are ephemeral, refetch from PB on load)

**4. Service Worker (vite-plugin-pwa)**

- **No changes required**: Existing PWA setup handles offline caching
- **Background sync**: Use `syncStatus.isOnline` to trigger sync when app regains connectivity
- **Note**: Real Web Background Sync API not used (complexity vs. benefit); simple app focus/network reconnect triggers

**5. Browser APIs**

- **Navigator.onLine**: Detect online/offline status for sync logic
- **window.addEventListener('online')**: Trigger background sync on reconnect
- **window.addEventListener('focus')**: Retry failed syncs when user returns to app
- **localStorage**: Supabase SDK automatically handles JWT token storage

**Dependency Version Constraints:**

| Dependency            | Minimum Version | Maximum Version | Reason                                             |
| --------------------- | --------------- | --------------- | -------------------------------------------------- |
| @supabase/supabase-js | 2.38.x          | 2.x             | Stable Realtime API, avoid breaking changes in 3.x |
| react                 | 19.x            | 19.x            | React 19 features (useOptimistic for mood UI)      |
| zustand               | 5.x             | 5.x             | Persist middleware API stable in v5                |
| idb                   | 8.x             | 8.x             | TypeScript definitions for IndexedDB v3            |
| framer-motion         | 12.x            | 12.x            | Layout animations API stable in v12                |

**External Service Dependencies:**

| Service                          | Provider            | Dependency Type             | Fallback Strategy                       |
| -------------------------------- | ------------------- | --------------------------- | --------------------------------------- |
| Supabase (PostgreSQL + Realtime) | Supabase Cloud      | Required for sync features  | Graceful degradation to local-only mode |
| GitHub Pages                     | GitHub              | Required for deployment     | N/A (deployment platform)               |
| HTTPS certificate                | GitHub Pages (auto) | Required for PWA + Supabase | N/A (provided automatically)            |

**No Integration with:**

- ❌ Authentication providers (OAuth, Auth0, etc.) - hardcoded user pairing
- ❌ Analytics services (Google Analytics, Mixpanel, etc.) - privacy-first app
- ❌ Push notification services (Firebase Cloud Messaging, etc.) - deferred to future
- ❌ CDN for assets - GitHub Pages serves all static files
- ❌ Database beyond PocketBase - no direct DB access needed
- ❌ Third-party APIs - all functionality self-contained

## Acceptance Criteria (Authoritative)

**Epic 6 encompasses PRD requirements FR019-FR025 (mood tracking, interactions, countdowns). Each story will have specific ACs derived from these:**

**AC1 - Mood Tracking UI (Story 6-2)**

- GIVEN user is on Mood Tracker tab
- WHEN user selects a mood type (loved, happy, content, thoughtful, grateful)
- THEN mood button animates with scale + color feedback
- AND user can optionally enter a note (max 500 characters)
- AND "Log Mood" button is enabled
- AND on submit, mood is saved to IndexedDB with timestamp
- AND success feedback is shown (toast or animation)
- AND mood appears in local state immediately (optimistic UI)

**AC2 - Local Mood Storage (Story 6-2)**

- GIVEN mood entry is logged
- WHEN mood is saved
- THEN IndexedDB `moods` store contains entry with: id, userId, moodType, note, timestamp, synced=false
- AND MoodService extends BaseIndexedDBService<MoodEntry>
- AND by-date index allows fast range queries for calendar view
- AND mood persists across browser sessions
- AND mood is retrievable via `getMoodForDate(date)` and `getMoodsInRange(start, end)`

**AC3 - Mood History Calendar View (Story 6-3)**

- GIVEN user navigates to Mood History
- WHEN calendar renders for current month
- THEN 30-31 day grid displays with each day as a cell
- AND days with moods show color-coded indicator (dot or emoji) matching mood type
- AND empty days show neutral background
- AND user can swipe/navigate to previous/next months
- AND tapping a day with mood opens modal showing: mood type, timestamp, note (if present)
- AND calendar loads moods via `getMoodsInRange()` for visible month only

**AC4 - Supabase Backend Setup (Story 6-1)**

- GIVEN Supabase project is created on Supabase Cloud
- WHEN app initializes
- THEN SupabaseClient connects to `VITE_SUPABASE_URL` with `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- AND authenticates using JWT
- AND tables exist with Row Level Security: `moods`, `interactions`, `users`
- AND Realtime is enabled for `moods` and `interactions` tables
- AND Supabase SDK is configured as singleton in `src/api/supabaseClient.ts`

**AC5 - Mood Sync to Supabase (Story 6-4)**

- GIVEN mood is logged locally with synced=false
- WHEN device is online AND background sync runs
- THEN MoodSyncService POSTs mood to `/rest/v1/moods`
- AND on success, local mood updates to synced=true and stores supabaseId
- AND on failure, mood queues for retry (exponential backoff, 3 max)
- AND sync status shows "X moods pending sync" when offline
- AND sync retries on network reconnect or app focus

**AC6 - Partner Mood Visibility (Story 6-4)**

- GIVEN Supabase connection is established
- WHEN partner logs a new mood
- THEN Realtime channel subscription receives postgres_changes event
- AND local state updates with partner's mood
- AND UI shows notification badge "New mood from [Partner Name]"
- AND partner moods display in calendar with different visual style (e.g., smaller dots)
- AND "Show partner moods" toggle controls visibility

**AC7 - Poke/Kiss Interactions (Story 6-5)**

- GIVEN user is on Home or Interactions view
- WHEN user taps "Poke" or "Kiss" button
- THEN button animates (pulse + haptic if supported)
- AND InteractionService POSTs to `/rest/v1/interactions`
- AND interaction is stored locally in `interactions` array
- AND sender sees "Poke sent!" toast confirmation
- AND interaction appears in history list with timestamp

**AC8 - Receive Poke/Kiss Notifications (Story 6-5)**

- GIVEN partner sends poke/kiss
- WHEN Realtime channel postgres_changes event arrives
- THEN PokeKissInterface shows notification badge (e.g., "1 new poke")
- AND badge count increments for unviewed interactions
- AND tapping badge plays animation (poke finger tap or kiss lips animation)
- AND interaction is marked viewed=true via PATCH request
- AND badge clears after viewing

**AC9 - Anniversary Countdown Timer (Story 6-6)**

- GIVEN settings.anniversaries contains at least one future date
- WHEN CountdownTimer component renders
- THEN displays "X days, Y hours, Z minutes until [Anniversary Title]"
- AND countdown updates every 1 minute via setInterval
- AND shows next 3 upcoming anniversaries if multiple exist
- AND countdown calculates from current time to target date

**AC10 - Celebration Animation Trigger (Story 6-6)**

- GIVEN countdown reaches 0 days, 0 hours, 0 minutes
- WHEN shouldTriggerCelebration() returns true
- THEN Framer Motion fireworks/confetti animation plays
- AND DailyMessage displays special anniversary-themed message
- AND animation plays once (not looping)
- AND if anniversary is recurring, countdown resets to next year's date

**AC11 - Offline Functionality (Cross-cutting)**

- GIVEN device is offline (Navigator.onLine === false)
- WHEN user logs mood or views calendar
- THEN all features work without network
- AND mood saves to IndexedDB successfully
- AND sync status shows "Offline - will sync when online"
- AND poke/kiss buttons show "Offline" state or queue for later
- AND calendar displays local moods without errors

**AC12 - Error Handling (Cross-cutting)**

- GIVEN Supabase API call fails (network error, 4xx, 5xx)
- WHEN error occurs
- THEN user sees friendly error message (not raw stack trace)
- AND error is logged to console for debugging
- AND app does not crash (ErrorBoundary catches component errors)
- AND failed sync queues for retry
- AND user can continue using local-only features

## Traceability Mapping

| AC #     | PRD Requirement                  | Spec Section                                                  | Component/API                                | Test Idea                                                                                           |
| -------- | -------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **AC1**  | FR019 (mood logging UI)          | Detailed Design → MoodTracker Component                       | MoodTracker.tsx                              | E2E: Navigate to mood tab, select mood, enter note, submit, verify success feedback                 |
| **AC2**  | FR019 (local storage)            | Data Models → MoodEntry, Services → MoodService               | moodService.ts                               | Unit: Test MoodService.add(), verify IndexedDB record created with correct schema                   |
| **AC3**  | FR021 (calendar view)            | Detailed Design → MoodHistoryCalendar                         | MoodHistoryCalendar.tsx                      | E2E: Open calendar, verify grid renders, tap day, verify modal shows mood details                   |
| **AC4**  | FR020 (Supabase sync)            | Dependencies → Supabase Integration                           | supabaseClient.ts                            | Integration: Verify Supabase connection, tables exist with RLS, auth works                          |
| **AC5**  | FR020 (mood sync)                | Workflows → Workflow 1 (sync), APIs → POST moods              | moodSyncService.ts                           | Integration: Log mood, verify POSTed to Supabase, local record updated with supabaseId              |
| **AC6**  | FR020 (partner visibility)       | Workflows → Workflow 1 (real-time), APIs → Realtime           | MoodSyncService, MoodHistoryCalendar         | E2E: Partner logs mood, verify Realtime event, verify UI updates with notification                  |
| **AC7**  | FR023 (send poke/kiss)           | Workflows → Workflow 2 (send), APIs → POST interactions       | interactionService.ts, PokeKissInterface.tsx | E2E: Tap poke button, verify animation, verify POST to Supabase, verify history                     |
| **AC8**  | FR024 (receive poke/kiss)        | Workflows → Workflow 2 (receive), APIs → Realtime             | PokeKissInterface.tsx                        | E2E: Receive interaction via Realtime, verify badge appears, tap badge, verify animation plays      |
| **AC9**  | FR016, FR017 (countdown display) | Detailed Design → CountdownTimer, Services → CountdownService | CountdownTimer.tsx, countdownService.ts      | Unit: Test calculateTimeRemaining(), verify correct days/hrs/mins calculation                       |
| **AC10** | FR018 (celebration trigger)      | Workflows → Workflow 4 (celebration)                          | CountdownTimer.tsx                           | E2E: Mock countdown at 0, verify celebration animation plays, verify special message                |
| **AC11** | NFR002 (offline support)         | NFR → Reliability (offline-first)                             | All components                               | E2E: Disconnect network, log mood, verify saves locally, verify sync queues, reconnect, verify sync |
| **AC12** | NFR (error handling)             | NFR → Reliability (error handling)                            | ErrorBoundary, all services                  | Unit: Mock API failure, verify error message, verify app doesn't crash, verify retry logic          |

**Cross-Story Traceability:**

| Story                                     | Primary ACs | Secondary ACs      | Key Components                                         |
| ----------------------------------------- | ----------- | ------------------ | ------------------------------------------------------ |
| **6-1: Supabase Backend Setup**           | AC4         | AC5, AC6, AC7, AC8 | supabaseClient.ts, Supabase tables with RLS            |
| **6-2: Mood Tracking UI + Local Storage** | AC1, AC2    | AC11, AC12         | MoodTracker.tsx, MoodService.ts                        |
| **6-3: Mood History Calendar View**       | AC3         | AC11               | MoodHistoryCalendar.tsx, MoodService.getMoodsInRange() |
| **6-4: Mood Sync + Partner Visibility**   | AC5, AC6    | AC11, AC12         | MoodSyncService.ts, Realtime channel subscriptions     |
| **6-5: Poke/Kiss Interactions**           | AC7, AC8    | AC12               | PokeKissInterface.tsx, InteractionService.ts           |
| **6-6: Anniversary Countdown Timers**     | AC9, AC10   | -                  | CountdownTimer.tsx, CountdownService.ts                |

**Testing Coverage:**

- **Unit Tests**: MoodService, CountdownService, validation functions (Zod schemas)
- **Integration Tests**: Supabase API calls, Realtime channel subscriptions, IndexedDB operations
- **E2E Tests**: Complete user journeys (log mood → sync → partner sees, send poke → partner receives)
- **Manual Tests**: Offline behavior, error recovery, network transitions, celebration animations

## Risks, Assumptions, Open Questions

**RISKS:**

**R1 - Supabase Free Tier Limits (LOW)**

- **Risk**: MVP usage exceeds Supabase free tier limits (500MB database, 2GB storage, 50K monthly active users)
- **Impact**: API requests throttled or blocked until next billing cycle
- **Mitigation**:
  - 2-user MVP usage well within limits (minimal data: text-only moods + interactions)
  - Monitor usage via Supabase Dashboard
  - Free tier includes 500MB DB (months/years of mood entries for 2 users)
  - Upgrade path available: $25/month Pro tier if needed
- **Probability**: Very Low (MVP usage minimal)

**R2 - Realtime Connection Instability (MEDIUM)**

- **Risk**: Mobile networks have intermittent connectivity, Realtime channels drop frequently
- **Impact**: Partner mood updates and poke/kiss notifications delayed or missed
- **Mitigation**:
  - Exponential backoff reconnection strategy (1s, 2s, 4s, max 30s)
  - On reconnect, fetch missed events via REST API (query for updates since last sync)
  - Visual indicator of connection status (online/offline dot)
  - User can manually refresh to force sync
  - Supabase Realtime has robust auto-reconnection built-in
- **Probability**: Medium (mobile networks)

**R3 - IndexedDB Quota Limits (LOW)**

- **Risk**: User runs out of IndexedDB storage quota (mood entries + photos)
- **Impact**: New moods cannot be saved; app shows error
- **Mitigation**:
  - Monitor storage usage via `navigator.storage.estimate()`
  - Warn user at 90% quota threshold
  - Provide "Clear old moods" option (keep last 365 days only)
  - Mood data is small (text only), so quota issues unlikely unless user logs many long notes
- **Probability**: Low (moods are tiny compared to photos)

**R4 - Partner ID Hardcoding Friction (LOW)**

- **Risk**: Hardcoded partner UUIDs make setup difficult for non-technical users
- **Impact**: Users struggle to configure partner pairing without code changes
- **Mitigation**:
  - Document partner UUID setup clearly in README with step-by-step instructions
  - Supabase Dashboard makes UUID lookup easy (simpler than PocketBase)
  - Future enhancement: Simple settings UI to enter partner UUID (no code changes)
  - Accept this as acceptable complexity for single-user PWA MVP
- **Probability**: Low (target user is developer, acceptable for MVP)

**ASSUMPTIONS:**

**A1 - Supabase Tables Pre-Created**

- Assumption: Developer manually creates Supabase tables with Row Level Security (moods, interactions, users) before deploying app
- Validation: Provide Supabase table DDL in spec (Data Models section); include SQL migration scripts
- Risk if wrong: App fails to sync with "Table not found" or RLS policy errors

**A2 - Single Partner Pairing**

- Assumption: App is used by exactly 2 people (user + partner) with hardcoded IDs
- Validation: Confirmed by PRD (single-user app, no multi-user functionality)
- Risk if wrong: N/A (out of scope for Epic 6)

**A3 - HTTPS Deployment**

- Assumption: App is deployed to GitHub Pages (HTTPS automatically provided)
- Validation: Deployment via `npm run deploy` to gh-pages branch
- Risk if wrong: PWA features (service workers, WebSocket) won't work on HTTP

**A4 - Modern Browser Support**

- Assumption: Users use latest 2 versions of Chrome, Firefox, Safari, Edge (per PRD NFR003)
- Validation: Use feature detection for IndexedDB, WebSocket, navigator.onLine
- Risk if wrong: Older browsers may not support required APIs

**A5 - Mood Sync is One-Way (User → Supabase)**

- Assumption: User's moods sync TO Supabase but don't sync FROM Supabase back to their device (no cross-device sync for same user)
- Validation: Confirmed by PRD (cross-device sync out of scope; only partner visibility needed)
- Risk if wrong: User expects their moods to sync across devices (not supported in Epic 6)

**OPEN QUESTIONS:**

**Q1 - Supabase Auth Integration?**

- Question: Should we use Supabase Auth for user management or keep hardcoded UUIDs?
- Decision needed by: Story 6-1 (backend setup)
- Proposed answer: Keep hardcoded UUIDs for MVP simplicity; Supabase Auth deferred to future enhancement
- Impact: Affects partner pairing complexity and future scalability

**Q2 - Interaction History Retention?**

- Question: How long should poke/kiss interactions be stored? Forever? Last 30 days? Last 100 interactions?
- Decision needed by: Story 6-5 (interactions)
- Proposed answer: Store last 100 interactions (soft delete older ones); configurable in future
- Impact: Storage usage and query performance

**Q3 - Mood Edit/Delete Functionality?**

- Question: Can users edit or delete logged moods? PRD is silent on this.
- Decision needed by: Story 6-2 (mood tracking UI)
- Proposed answer: MVP = append-only (no edit/delete); add in future if user requests
- Impact: Simpler implementation, fewer sync conflicts

**Q4 - Celebration Animation Customization?**

- Question: Should anniversary celebration animations be different per anniversary type? Or generic confetti/fireworks?
- Decision needed by: Story 6-6 (countdown timers)
- Proposed answer: Generic celebration animation for MVP; custom animations per anniversary type in future
- Impact: Animation complexity and asset size

**Q5 - Partner Mood Notification Persistence?**

- Question: If user doesn't open app for 3 days, should they see notifications for all 3 missed partner moods? Or just latest?
- Decision needed by: Story 6-4 (partner visibility)
- Proposed answer: Show notification badge with count (e.g., "3 new moods"); calendar view shows all moods
- Impact: Notification UX and data fetching strategy

## Test Strategy Summary

**Testing Levels:**

**1. Unit Tests (Vitest)**

- **Target Coverage**: 80% for services and utilities
- **Test Subjects**:
  - MoodService CRUD operations (add, get, getAll, getMoodForDate, getMoodsInRange)
  - CountdownService calculations (calculateTimeRemaining, getNextAnniversary, shouldTriggerCelebration)
  - Validation functions (Zod schema validation for MoodEntry, Interaction)
  - Utility functions (date helpers, mood type mappings)
- **Mocking Strategy**:
  - Mock IndexedDB with `fake-indexeddb` (already in devDependencies)
  - Mock Supabase SDK responses for API call tests
  - Mock Realtime channel events for subscription tests
- **Test Files**:
  - `src/services/moodService.test.ts`
  - `src/utils/countdownService.test.ts`
  - `src/api/moodSyncService.test.ts`
  - `src/api/interactionService.test.ts`

**2. Component Tests (Vitest + React Testing Library)**

- **Target Coverage**: 70% for UI components
- **Test Subjects**:
  - MoodTracker: Mood button clicks, note input, form submission
  - MoodHistoryCalendar: Calendar rendering, day tap, modal display
  - CountdownTimer: Countdown display, celebration trigger
  - PokeKissInterface: Button animations, notification badge, interaction history
- **User Interaction Testing**:
  - Simulate button clicks, form inputs, navigation
  - Verify state updates (Zustand store)
  - Verify component re-renders on prop/state changes
- **Test Files**:
  - `src/components/MoodTracker.test.tsx`
  - `src/components/MoodHistoryCalendar.test.tsx`
  - `src/components/CountdownTimer.test.tsx`
  - `src/components/PokeKissInterface.test.tsx`

**3. Integration Tests (Vitest)**

- **Focus**: Service-to-IndexedDB, Service-to-Supabase interactions
- **Test Scenarios**:
  - Log mood → verify IndexedDB record created → trigger sync → verify Supabase POST called
  - Mock Supabase Realtime event → verify Zustand store updates → verify UI re-renders
  - Send poke → verify Supabase POST → verify local storage updated
  - Network offline → log mood → verify queued for sync → network online → verify sync executes
- **Environment**:
  - Use `happy-dom` for DOM simulation (already in devDependencies)
  - Mock Supabase API responses with fixtures
  - Use in-memory IndexedDB (`fake-indexeddb`)

**4. End-to-End Tests (Playwright)**

- **Target Coverage**: Critical user journeys (5-7 scenarios)
- **Test Scenarios**:
  - **E2E-1: Log Mood and View Calendar**
    1. Navigate to Mood Tracker tab
    2. Select "Loved" mood type
    3. Enter note "Feeling amazing today!"
    4. Submit mood
    5. Verify success feedback
    6. Navigate to Mood History
    7. Verify calendar shows mood indicator for today
    8. Tap today's date
    9. Verify modal displays mood details
  - **E2E-2: Offline Mood Logging**
    1. Disconnect network (Playwright network throttling)
    2. Log mood
    3. Verify "Offline - will sync when online" message
    4. Reconnect network
    5. Verify sync executes and "Synced" indicator appears
  - **E2E-3: Send and Receive Poke**
    1. User A taps "Poke" button
    2. Verify "Poke sent!" toast
    3. User B receives WebSocket event (mock or real backend)
    4. Verify notification badge "1 new poke"
    5. User B taps badge
    6. Verify poke animation plays
  - **E2E-4: Anniversary Countdown Display**
    1. Configure anniversary in settings (mock future date)
    2. Verify countdown timer displays correct days/hours/minutes
    3. Mock time advance to countdown = 0
    4. Verify celebration animation triggers
  - **E2E-5: Error Recovery**
    1. Mock PocketBase API failure (500 error)
    2. Log mood
    3. Verify error message displayed
    4. Verify mood saved locally (fallback)
    5. Mock API recovery
    6. Verify retry succeeds

**5. Manual Testing**

- **Network Conditions**: Test on 3G, 4G, WiFi, offline, intermittent connection
- **Mobile Devices**: Test on iOS Safari, Chrome Mobile (real devices, not just emulators)
- **Edge Cases**:
  - IndexedDB quota full → verify warning message
  - WebSocket disconnect → verify reconnection
  - PocketBase CORS error → verify helpful error message
  - Multiple anniversaries → verify all countdowns display
- **Accessibility**: Keyboard navigation, screen reader (VoiceOver on iOS)
- **Animations**: Verify 60fps performance, no jank on low-end devices

**Testing Frameworks & Tools:**

- **Unit/Component/Integration**: Vitest 4.0.9 (already installed)
- **E2E**: Playwright 1.56.1 (already installed)
- **Coverage**: `@vitest/coverage-v8` (already installed)
- **Mocking**: `fake-indexeddb` 6.2.5 (already installed), MSW (if needed for HTTP mocking)

**Test Data:**

- **Fixtures**: Create fixture files with sample mood entries, interactions, anniversaries
- **Factories**: Use factory pattern for generating test data (e.g., `createMoodEntry()` helper)
- **Seeding**: Populate IndexedDB with test data for E2E tests

**CI/CD Integration:**

- **GitHub Actions**: Run tests on PR (unit, integration, E2E smoke tests)
- **Coverage Thresholds**: Require 70% overall coverage to merge PR
- **E2E in CI**: Run Playwright tests in headless mode on Ubuntu runner
- **Performance Budget**: Lighthouse score >90 for PWA; fail build if <90

**Acceptance Criteria Validation:**

- Each AC maps to at least one test (see Traceability Mapping table)
- Test names reference AC numbers for traceability (e.g., `test('AC1: Mood button animates on click')`)
- All 12 ACs must have passing tests before Epic 6 is considered complete
