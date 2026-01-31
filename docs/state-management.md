# State Management

> Zustand store architecture documentation for My-Love project.
> Last updated: 2026-01-30 | Scan level: Deep (Rescan)

## Architecture

Single Zustand store composed of 10 feature slices with persist middleware. Three-tier persistence: LocalStorage (critical state), IndexedDB (large data), Supabase (cloud sync).

## Store Composition

```typescript
// useAppStore.ts
const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAppSlice(...a),
      ...createSettingsSlice(...a),
      ...createMessagesSlice(...a),
      ...createPhotosSlice(...a),
      ...createNavigationSlice(...a),
      ...createMoodSlice(...a),
      ...createInteractionsSlice(...a),
      ...createPartnerSlice(...a),
      ...createNotesSlice(...a),
      ...createScriptureSlice(...a),  // NEW
    }),
    { name: 'my-love-storage', ... }
  )
);
```

## Slices Overview

| Slice | State Fields | Actions | Persistence | Side Effects |
|-------|-------------|---------|-------------|--------------|
| AppSlice | isLoading, error, __isHydrated | 3 setters | None (runtime) | None |
| SettingsSlice | settings, isOnboarded | initializeApp, setSettings, updateSettings, setTheme, add/removeAnniversary | LocalStorage + IndexedDB init | IndexedDB, validation |
| MessagesSlice | messages, messageHistory, currentMessage, customMessages | loadMessages, addMessage, toggleFavorite, navigate, CRUD custom, import/export | messageHistory → LS, messages → IDB | IndexedDB, rotation |
| PhotosSlice | photos, selectedPhotoId, isUploading, uploadProgress, storageWarning | upload, load, delete, update, select | None (on-demand) | Supabase Storage |
| NavigationSlice | currentView | setView, navigate* (6 views) | None (from URL) | Browser history |
| MoodSlice | moods, partnerMoods, syncStatus | addMoodEntry, updateMoodEntry, loadMoods, syncPendingMoods, fetchPartnerMoods | moods → LS + IDB + Supabase | IndexedDB, sync |
| InteractionsSlice | interactions, unviewedCount, isSubscribed | sendPoke, sendKiss, markViewed, loadHistory, subscribe | None (ephemeral) | Supabase Realtime |
| PartnerSlice | partner, sentRequests, receivedRequests, searchResults | loadPartner, loadRequests, searchUsers, send/accept/decline | None (fresh load) | Supabase |
| NotesSlice | notes, notesHasMore, sentMessageTimestamps | fetchNotes, fetchOlderNotes, sendNote, retryFailedMessage, removeFailedMessage | None (from Supabase) | Supabase, image upload, broadcast |
| ScriptureSlice (NEW) | session, isLoading, isInitialized, isPendingLockIn, isPendingReflection, isSyncing, error | createSession, loadSession, exitSession, updatePhase, clearError | None (session-based) | Supabase |

## ViewType Navigation

```typescript
type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'
```

## Persistence Strategy

### Layer 1: LocalStorage (via Zustand persist)

- Key: `my-love-storage`
- Contains: settings, isOnboarded, messageHistory (serialized Map)
- Size: ~50-100KB

### Layer 2: IndexedDB (via services)

- DB: `my-love-db` v5
- Contains: messages, custom messages, moods, photos, scripture caches
- Loaded on app init, not via Zustand persist

### Layer 3: Supabase (via API)

- Contains: photos, interactions, partner data, love notes, moods (synced), scripture sessions
- Real-time subscriptions: interactions, love notes

## Hydration & Recovery

Pre-hydration: Parse and validate JSON before Zustand deserialization. Clear corrupted state.

Post-hydration: Convert Array → Map for messageHistory.shownMessages. Set __isHydrated flag.

Recovery: Clear corrupted localStorage → use initial defaults → app continues gracefully.

## Cross-Slice Dependencies

- SettingsSlice → MessagesSlice (calls updateCurrentMessage during init)
- MessagesSlice → SettingsSlice (accesses settings.relationship.startDate)
- All other slices are independent

## New Since Jan 27

- **ScriptureSlice** added with session management, phase tracking, error handling
- **types.ts** updated: ScriptureSlice added to AppState intersection
- **useAppStore.ts** updated: createScriptureSlice integrated into store composition
- **NavigationSlice** updated: 'scripture' added to ViewType
