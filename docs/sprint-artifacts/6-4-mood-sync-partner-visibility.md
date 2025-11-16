# Story 6.4: Mood Sync & Partner Visibility

Status: ready-for-dev

## Story

As the app creator,
I want to see my girlfriend's mood logs synced via Supabase,
so that I can check in on how she's feeling even when we're apart.

## Acceptance Criteria

1. **Partner Mood Sync Service Implementation**
   - Mood entries automatically sync to Supabase after logging
   - syncPendingMoods() function uploads all unsynced moods (where synced === false)
   - Successfully synced moods marked with synced: true and supabaseId populated
   - Sync respects offline state: queues moods when offline, syncs on reconnect
   - Exponential backoff retry strategy for failed syncs (3 retries max: 1s, 2s, 4s)
   - Sync status tracked in Zustand store: syncStatus with pending/syncing/synced/error states

2. **Partner View Display**
   - Partner mood view accessible via Settings → Partner Moods (or dedicated tab)
   - Displays partner's moods fetched from Supabase moods table (WHERE user_id = partnerId)
   - Shows: mood type (icon + color), date (formatted "Monday, Nov 15, 2025"), timestamp, note
   - Moods sorted chronologically (newest first)
   - Empty state: "No moods logged yet" when partner hasn't logged moods

3. **Real-time Updates via Supabase Realtime**
   - Subscribe to Supabase Realtime channel for moods table changes
   - On INSERT event for partner's moods → update Zustand store with new mood
   - Display notification badge/toast: "Your partner logged a new mood" with option to view
   - Realtime connection status indicator (connected/reconnecting/disconnected)
   - Auto-reconnect on disconnect with exponential backoff (1s, 2s, 4s, max 30s)

4. **Manual Refresh Button**
   - "Refresh" button in partner mood view header
   - Fetches latest partner moods from Supabase (bypasses cache)
   - Shows loading spinner during fetch
   - Updates UI with fetched moods
   - Display last sync timestamp: "Last updated: 2 minutes ago"

5. **User Filtering & Privacy**
   - Queries filter by user_id using Supabase query parameter: WHERE user_id = partnerId
   - Row Level Security (RLS) enforces access control at database level
   - Users can only view moods from their configured partner (via VITE_PARTNER_ID env var)
   - No cross-user data leakage: RLS policies validated in Supabase

6. **Offline Mode & Sync Queue**
   - When offline (navigator.onLine === false), display: "Offline - moods will sync when online"
   - Mood sync queued in IndexedDB (synced: false flag)
   - On network reconnect (online event), trigger syncPendingMoods() automatically
   - Partner moods display cached data when offline (from previous successful fetch)
   - Sync conflict resolution: Last-write-wins (Supabase timestamp used as source of truth)

## Tasks / Subtasks

- [ ] **Task 1: Implement Mood Sync Service** (AC: #1, #6)
  - [ ] Create `src/api/moodSyncService.ts`
  - [ ] Implement `syncPendingMoods()`: Fetch moods WHERE synced === false
  - [ ] For each mood: POST to Supabase moods table using supabaseClient.from('moods').insert()
  - [ ] On success: Update local mood with synced: true and supabaseId from response
  - [ ] On failure: Implement retry logic with exponential backoff (1s, 2s, 4s, max 3 retries)
  - [ ] Add syncStatus to moodSlice Zustand store: 'idle' | 'syncing' | 'synced' | 'error'
  - [ ] Trigger syncPendingMoods() after addMoodEntry() in MoodTracker component

- [ ] **Task 2: Implement Network State Detection** (AC: #6)
  - [ ] Create `src/utils/networkHelpers.ts` with isOnline() utility
  - [ ] Add online/offline event listeners in App.tsx or useAppStore init
  - [ ] Update syncStatus on offline: set to 'offline'
  - [ ] On 'online' event: automatically trigger syncPendingMoods()
  - [ ] Display network status indicator in UI (online/offline dot in top nav)
  - [ ] Test offline → log mood → go online → verify auto-sync

- [ ] **Task 3: Fetch Partner Moods from Supabase** (AC: #2, #4, #5)
  - [ ] Add fetchPartnerMoods() to moodSyncService.ts
  - [ ] Query: supabaseClient.from('moods').select('\*').eq('user_id', partnerId).order('timestamp', { ascending: false })
  - [ ] Map Supabase response to MoodEntry[] interface (convert timestamps to Date objects)
  - [ ] Store partner moods in Zustand: add partnerMoods: MoodEntry[] to moodSlice
  - [ ] Handle errors gracefully: display toast "Failed to fetch partner moods" on error
  - [ ] Add lastSyncTimestamp to track when partner moods were last fetched

- [ ] **Task 4: Create Partner Mood View Component** (AC: #2, #4)
  - [ ] Create `src/components/PartnerMoodView/PartnerMoodView.tsx`
  - [ ] Display partner moods list: mood icon, date (formatted with date-fns), timestamp, note
  - [ ] Use MOOD_CONFIG from MoodTracker for consistent icons/colors
  - [ ] Add "Refresh" button in header (triggers fetchPartnerMoods())
  - [ ] Show loading spinner during fetch (loading state)
  - [ ] Empty state: Display "No moods logged yet" when partnerMoods.length === 0
  - [ ] Display last sync timestamp: "Last updated: X minutes ago"

- [ ] **Task 5: Integrate Partner Mood View in Navigation** (AC: #2)
  - [ ] Add "Partner Moods" tab to navigation OR Settings → Partner section
  - [ ] Update navigationSlice to include partner mood route
  - [ ] Wire navigation to render PartnerMoodView component
  - [ ] Add data-testid attributes for E2E testing
  - [ ] Test navigation flow: Home → Partner Moods → verify component renders

- [ ] **Task 6: Implement Supabase Realtime Subscription** (AC: #3)
  - [ ] Create `src/api/realtimeService.ts` for Realtime channel management
  - [ ] Subscribe to moods table changes: supabaseClient.channel('moods-channel').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moods', filter: `user_id=eq.${partnerId}` }, handleNewMood)
  - [ ] On INSERT event: Parse payload, create MoodEntry, add to partnerMoods in Zustand
  - [ ] Display notification toast: "Your partner logged a new mood: [mood type]"
  - [ ] Add notification badge to Partner Moods nav tab (if unviewed moods exist)
  - [ ] Implement handleConnectionStateChange() for SUBSCRIBED, CLOSED, CHANNEL_ERROR states
  - [ ] Log connection state changes: console.log('[REALTIME] Connection state:', state)

- [ ] **Task 7: Connection Status Indicator** (AC: #3)
  - [ ] Add connection status indicator in top nav OR Partner Mood View header
  - [ ] States: 'connected' (green dot), 'reconnecting' (yellow dot + spinner), 'disconnected' (red dot)
  - [ ] Update UI based on Realtime connection state from Task 6
  - [ ] On reconnect: fetch latest partner moods to catch up (fetchPartnerMoods())
  - [ ] Display tooltip on hover: "Connected" / "Reconnecting..." / "Disconnected"

- [ ] **Task 8: Retry Logic & Error Handling** (AC: #1, #6)
  - [ ] Implement exponential backoff in syncPendingMoods(): retries at 1s, 2s, 4s
  - [ ] After 3 failed retries: mark syncStatus as 'error', display toast "Sync failed. Tap to retry."
  - [ ] Add retry button in error toast that re-triggers syncPendingMoods()
  - [ ] Handle Supabase API errors: 401 Unauthorized, 403 Forbidden, 500 Server Error
  - [ ] Log detailed errors to console with context: [SYNC] Failed to sync mood: id=X, error=...
  - [ ] Graceful degradation: If Realtime fails, fall back to manual refresh only

- [ ] **Task 9: E2E Testing for Sync & Partner View** (AC: All)
  - [ ] E2E test: Log mood → verify synced to Supabase → check local mood synced: true
  - [ ] E2E test: Mock Supabase INSERT event → verify toast displayed, partnerMoods updated
  - [ ] E2E test: Navigate to Partner Moods → verify list renders, shows correct data
  - [ ] E2E test: Tap Refresh button → verify loading spinner, moods re-fetched
  - [ ] E2E test: Offline mode → log mood → verify "Offline" message → go online → verify auto-sync
  - [ ] E2E test: Mock Supabase error (500) → verify error toast, retry button works
  - [ ] E2E test: Verify RLS: user can't fetch other users' moods (use mock invalid partnerId)

- [ ] **Task 10: Integration with Existing MoodSlice** (AC: #1)
  - [ ] Extend moodSlice Zustand store: add partnerMoods: MoodEntry[], syncStatus, lastSyncTimestamp
  - [ ] Add actions: syncPendingMoods(), fetchPartnerMoods(), setPartnerMoods(), updateSyncStatus()
  - [ ] Ensure addMoodEntry() triggers syncPendingMoods() after local save
  - [ ] Update getMoodForDate() to also work for partner moods (optional: separate selector)
  - [ ] Test state updates: verify Zustand devtools shows correct state transitions

- [ ] **Task 11: Performance Optimization** (AC: #3, #4)
  - [ ] Debounce fetchPartnerMoods() on manual refresh (prevent rapid clicks)
  - [ ] Cache partner moods: don't re-fetch if last fetch was <60 seconds ago
  - [ ] Limit Realtime event processing: batch updates if multiple INSERT events arrive rapidly
  - [ ] Use React.memo on PartnerMoodView components to prevent unnecessary re-renders
  - [ ] Verify Realtime subscription cleanup on component unmount (prevent memory leaks)

- [ ] **Task 12: Documentation & Code Comments** (AC: All)
  - [ ] Add JSDoc comments to syncPendingMoods(), fetchPartnerMoods(), Realtime handlers
  - [ ] Document environment variables: VITE_PARTNER_ID in .env.example
  - [ ] Update architecture.md: document Realtime integration and sync strategy
  - [ ] Add inline comments referencing AC numbers for traceability
  - [ ] Document sync conflict resolution strategy in dev notes

## Dev Notes

### Learnings from Previous Story (6.3)

**From Story 6.3 (Status: review) - Mood History Calendar View**

- **MoodService Available**: `src/services/moodService.ts` (303 lines)
  - Extends BaseIndexedDBService<MoodEntry>
  - Implements `getMoodForDate(date: Date): Promise<MoodEntry | null>`
  - Implements `getMoodsInRange(start: Date, end: Date): Promise<MoodEntry[]>`
  - by-date unique index for fast range queries (<100ms)
  - Validates with MoodEntrySchema from Story 5.5
  - **Reuse pattern**: Call moodService.getAll() to fetch unsynced moods (WHERE synced === false)

- **MoodEntry Interface** (from `src/types/index.ts`):

  ```typescript
  interface MoodEntry {
    id?: number; // Auto-increment (IndexedDB)
    userId: string; // Hardcoded from constants.ts
    mood: MoodType; // 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful'
    note?: string; // Optional, max 200 chars
    date: string; // ISO date string (YYYY-MM-DD)
    timestamp: Date; // Full timestamp when logged
    synced: boolean; // Whether uploaded to Supabase (NEW: Story 6.4)
    supabaseId?: string; // Supabase record ID after sync (NEW: Story 6.4)
  }
  ```

  - **Action Required**: Update MoodEntry interface to add `synced: boolean` and `supabaseId?: string` fields

- **MoodSlice Integration**: `src/stores/slices/moodSlice.ts` (152 lines)
  - State: `moods: MoodEntry[]`, `syncStatus`
  - Actions: `addMoodEntry()`, `updateMoodEntry()`, `loadMoods()`
  - **Extension Needed**: Add `partnerMoods: MoodEntry[]`, `syncPendingMoods()`, `fetchPartnerMoods()`, `setPartnerMoods()`

- **Review Findings from Story 6.3** (Important):
  - 7 unit tests failed due to by-date unique constraint violations
  - Tests need different dates for multiple moods (not all "today")
  - maxLength attribute needed on textarea (defense-in-depth validation)
  - **Apply to 6.4**: Ensure E2E tests use unique dates for different moods

### Supabase Integration (from Story 6.1)

**From Story 6.1 (Status: done) - Supabase Backend Setup**

- **Supabase Client**: `src/api/supabaseClient.ts` exports configured SupabaseClient
  - Environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  - Client initialized as singleton: `export const supabase = createClient(url, key)`
  - **Reuse in 6.4**: Import supabase from supabaseClient.ts for all API calls

- **Moods Table Schema** (Supabase PostgreSQL):

  ```sql
  CREATE TABLE moods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    mood_type TEXT NOT NULL CHECK (mood_type IN ('loved', 'happy', 'content', 'thoughtful', 'grateful')),
    note TEXT,
    date DATE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_moods_user_date ON moods(user_id, date);
  CREATE INDEX idx_moods_timestamp ON moods(timestamp DESC);
  ```

  - **RLS Policy**: Users can view moods WHERE user_id = current_user_id OR user_id = partner_id
  - **Realtime Enabled**: Configured in Supabase Dashboard for moods table

- **Environment Variables** (from .env):

  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  VITE_USER_ID=user-uuid-1
  VITE_PARTNER_ID=user-uuid-2
  ```

  - **Use in 6.4**: Access via import.meta.env.VITE_PARTNER_ID

### Architecture Alignment

**Existing Patterns to Follow:**

- **Service Layer**: Create `moodSyncService.ts` following pattern from `moodService.ts` and `customMessageService.ts`
  - Export singleton: `export const moodSyncService = new MoodSyncService()`
  - Methods: `syncPendingMoods()`, `fetchPartnerMoods()`
  - Error handling: Try/catch blocks, console.error logging

- **Supabase API Calls**: Follow pattern from `supabaseClient.ts`

  ```typescript
  // INSERT mood
  const { data, error } = await supabase
    .from('moods')
    .insert([{ user_id, mood_type, note, date, timestamp }])
    .select()
    .single();

  // SELECT partner moods
  const { data, error } = await supabase
    .from('moods')
    .select('*')
    .eq('user_id', partnerId)
    .order('timestamp', { ascending: false });
  ```

- **Realtime Subscriptions**: Follow Supabase Realtime docs pattern

  ```typescript
  const channel = supabase
    .channel('moods-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'moods', filter: `user_id=eq.${partnerId}` },
      (payload) => handleNewMood(payload.new)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[REALTIME] Connected');
    });
  ```

- **State Management**: Extend moodSlice Zustand store (Story 6.2 pattern)
  - Add partnerMoods state alongside moods
  - Create selectors: `selectPartnerMoods`, `selectSyncStatus`
  - Actions trigger side effects (API calls) then update state

- **Component Structure**: Follow MoodTracker (6.2) and MoodHistoryCalendar (6.3) patterns
  - Separate component directory: `src/components/PartnerMoodView/`
  - Main component + sub-components (PartnerMoodList, PartnerMoodItem)
  - Props typing with TypeScript interfaces
  - Framer Motion for animations (toast notifications, loading states)

- **Error Handling**: Follow ErrorBoundary pattern from Story 1.5
  - Wrap Supabase API calls in try/catch
  - Display user-friendly error messages (toasts)
  - Log detailed errors to console for debugging
  - Graceful degradation on network failures

### Technical Constraints (from Tech Spec)

**Performance Requirements:**

- IndexedDB query time: <100ms for mood retrieval (validated in 6.2/6.3)
- Supabase API response time: <500ms for sync operations (when online)
- Realtime connection: Single persistent channel with exponential backoff reconnect (1s, 2s, 4s, max 30s)
- Sync batching: Limit to 50 pending moods per sync batch to avoid blocking UI

**Offline-First Requirements (NFR002):**

- All features work without network except mood sync and partner mood fetch
- Moods queue for sync when offline (synced: false flag in IndexedDB)
- Partner moods display cached data when offline
- Auto-sync on network reconnect

**Security Requirements:**

- Row Level Security enforces user_id filtering at database level
- JWT authentication handled by Supabase SDK (auto-managed)
- Input validation: Zod schema for MoodEntry before Supabase write
- No dangerouslySetInnerHTML usage (XSS protection)

### File Structure

```
src/
├── api/
│   ├── supabaseClient.ts          (Already exists from Story 6.1)
│   ├── moodSyncService.ts         (NEW: Story 6.4 - sync logic)
│   └── realtimeService.ts         (NEW: Story 6.4 - Realtime subscriptions)
├── components/
│   ├── MoodTracker/               (Exists from Story 6.2)
│   │   └── MoodTracker.tsx        (MODIFY: trigger sync after addMoodEntry)
│   └── PartnerMoodView/           (NEW: Story 6.4)
│       ├── PartnerMoodView.tsx    (Main partner mood display)
│       ├── PartnerMoodList.tsx    (Mood list component)
│       └── PartnerMoodItem.tsx    (Individual mood card)
├── stores/
│   └── slices/
│       └── moodSlice.ts           (MODIFY: add partnerMoods, sync actions)
├── types/
│   └── index.ts                   (MODIFY: add synced, supabaseId to MoodEntry)
└── utils/
    └── networkHelpers.ts          (NEW: Story 6.4 - network state detection)
```

### Sync Workflow Logic

**Workflow 1: User Logs Mood → Sync to Supabase**

1. User logs mood in MoodTracker component
2. addMoodEntry() saves mood to IndexedDB (synced: false, supabaseId: null)
3. Trigger syncPendingMoods() after successful local save
4. syncPendingMoods():
   - Fetch moods WHERE synced === false from IndexedDB
   - For each mood: POST to Supabase moods table
   - On success: Update local mood with synced: true, supabaseId from response
   - On failure: Retry with exponential backoff (1s, 2s, 4s, max 3 retries)
   - If all retries fail: Display error toast, keep synced: false for next attempt
5. Update syncStatus in Zustand: 'syncing' → 'synced' or 'error'

**Workflow 2: Partner Logs Mood → Real-time Update**

1. Partner logs mood on their device (triggers Workflow 1)
2. Supabase INSERT event emitted via Realtime channel
3. User's app receives INSERT event via subscribed channel
4. handleNewMood(payload.new) parses payload, creates MoodEntry
5. Add new mood to partnerMoods in Zustand store
6. Display toast notification: "Your partner logged a new mood: [mood type]"
7. Update notification badge on Partner Moods nav tab (unread count)

**Workflow 3: Manual Refresh Partner Moods**

1. User navigates to Partner Mood View
2. On mount: fetchPartnerMoods() if cache expired (>60 seconds old)
3. User taps "Refresh" button
4. Show loading spinner, call fetchPartnerMoods(force: true)
5. Query Supabase: SELECT \* FROM moods WHERE user_id = partnerId ORDER BY timestamp DESC
6. Parse response, update partnerMoods in Zustand
7. Hide loading spinner, display "Last updated: just now"

**Workflow 4: Offline → Online Sync**

1. User offline (navigator.onLine === false)
2. User logs mood → saved locally with synced: false
3. Display: "Offline - mood will sync when online"
4. Network reconnects (online event fires)
5. Auto-trigger syncPendingMoods() to upload queued moods
6. Display toast: "Syncing X pending moods..."
7. On sync success: Update syncStatus, display "Synced successfully"

### Validation & Testing Strategy

**Unit Tests** (Vitest):

- Test `moodSyncService.syncPendingMoods()` with mock Supabase responses
- Test exponential backoff retry logic (verify delays: 1s, 2s, 4s)
- Test `fetchPartnerMoods()` query filtering by partnerId
- Test Realtime event handler: verify partnerMoods state update
- Test offline detection: verify syncPendingMoods() not called when offline

**Integration Tests** (Vitest):

- Mock Supabase API: INSERT mood, verify IndexedDB record updated (synced: true)
- Mock Realtime INSERT event: verify Zustand store updated, toast displayed
- Test offline → online transition: verify auto-sync triggered

**E2E Tests** (Playwright):

- Log mood → verify synced to Supabase (check network tab for POST request)
- Navigate to Partner Moods → verify list renders
- Mock Realtime event → verify toast notification appears
- Offline mode → log mood → go online → verify auto-sync
- Test Refresh button → verify loading spinner, moods re-fetched

### Open Questions & Decisions

**Q1: Should users be able to edit/delete partner moods?**

- **Decision**: No. Partner moods are read-only in MVP. Users can only view partner's moods, not modify.
- **Rationale**: Prevents accidental data corruption; editing partner's moods violates privacy expectations.

**Q2: How to handle sync conflicts if user logs same-day mood on multiple devices?**

- **Decision**: Last-write-wins based on Supabase timestamp. IndexedDB unique constraint on date prevents local duplicates.
- **Rationale**: Epic 6 assumes single-device usage per user (cross-device sync out of scope per PRD).

**Q3: Should Realtime channel stay open always or only when Partner Mood View is active?**

- **Decision**: Keep Realtime channel open always (from App.tsx or root component).
- **Rationale**: Notifications should appear even when user isn't viewing Partner Mood screen.

**Q4: What happens if VITE_PARTNER_ID is not configured?**

- **Decision**: Display error message: "Partner not configured. Set VITE_PARTNER_ID in .env file."
- **Rationale**: Graceful degradation with clear action item for developer.

### References

- [Tech Spec: Epic 6](./tech-spec-epic-6.md#dependencies-and-integrations)
- [Epics Document](../epics.md#epic-6-interactive-connection-features)
- [Architecture](../architecture.md#data-architecture)
- [PRD Functional Requirements](../PRD.md#functional-requirements) - FR020, FR019
- [Story 6.1: Supabase Backend Setup](./6-1-supabase-backend-setup-api-integration.md) - Prerequisite
- [Story 6.2: Mood Tracking UI](./6-2-mood-tracking-ui-local-storage.md) - Prerequisite
- [Story 6.3: Mood History Calendar View](./6-3-mood-history-calendar-view.md) - Prerequisite
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime) - Integration guide

## Dev Agent Record

### Context Reference

- [Story Context XML](./6-4-mood-sync-partner-visibility.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
