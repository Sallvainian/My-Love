# Acceptance Criteria

1. **Save on Exit (Server + Cache Persist)**
   - **Given** the user is in a Solo session
   - **When** they exit mid-session (via Save & Exit or closing the app)
   - **Then** the current step index and session state are persisted to the server
   - **And** the session data is cached in IndexedDB for fast retrieval
   - **And** the session status remains `'in_progress'`

2. **Resume from Overview (Cache-First Load)**
   - **Given** the user returns to the Scripture Reading overview
   - **When** an incomplete Solo session exists
   - **Then** the overview shows "Continue where you left off? (Step X of 17)"
   - **And** tapping "Continue" loads the session from cache immediately, then fetches fresh from server
   - **And** tapping "Start fresh" clears the saved state and begins a new session

3. **Optimistic Step Advancement**
   - **Given** the user is in a Solo session with network connectivity
   - **When** they advance through steps
   - **Then** step advancement appears instant (optimistic UI)
   - **And** the server is updated in the background
   - **And** IndexedDB cache is updated on successful server response

4. **Offline Indicator & Blocked Advancement**
   - **Given** the user is viewing a previously cached session
   - **When** they are offline
   - **Then** cached data is displayed with an "Offline" indicator
   - **And** step advancement is blocked until connectivity returns
   - **And** no data is lost

5. **IndexedDB Corruption Recovery**
   - **Given** an IndexedDB corruption occurs
   - **When** a read or write operation fails
   - **Then** the cache is cleared automatically
   - **And** data is refetched from the server
   - **And** the user sees no error (graceful recovery)

6. **Server Write Failure — Retry UI**
   - **Given** a server write fails (network error)
   - **When** the user advanced a step optimistically
   - **Then** retry UI is shown (subtle, non-blocking)
   - **And** the local state is not rolled back until retry is exhausted
