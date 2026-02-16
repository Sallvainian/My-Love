# Data Architecture

## Storage Layers

The application uses three complementary storage layers, each serving a distinct purpose.

### 1. IndexedDB (Primary Local Store)

**Library**: `idb` v8.0.3
**Database**: `my-love-db` (version 5)
**Schema**: Defined in `src/services/dbSchema.ts`

| Object Store | Key Path | Auto-Increment | Indexes | Purpose |
|-------------|----------|----------------|---------|---------|
| `messages` | `id` | Yes | None | Daily love messages (default + custom) |
| `photos` | `id` | Yes | None | Photo metadata (blobs in Supabase Storage) |
| `moods` | `id` | Yes | `by-date` (date), `by-synced` (synced) | Mood entries with sync tracking |
| `sw-auth` | `key` | No | None | Auth token cache for service worker |
| `scripture-sessions` | `id` | No | `by-status` (status), `by-userId` (user1_id) | Scripture reading session cache |
| `scripture-reflections` | `id` | No | `by-session` (session_id) | Per-step reflection data cache |
| `scripture-bookmarks` | `id` | No | `by-session` (session_id) | Bookmarked scripture steps cache |
| `scripture-messages` | `id` | No | `by-session` (session_id) | In-session chat message cache |

The `upgradeDb()` function in `dbSchema.ts` handles all schema migrations centrally. Version transitions:
- v1: messages, photos
- v2: moods (with by-date, by-synced indexes)
- v3: sw-auth
- v4: scripture-sessions, scripture-reflections, scripture-bookmarks
- v5: scripture-messages

### 2. localStorage (Zustand Persist)

**Storage Key**: `my-love-storage`
**Middleware**: `zustand/persist` with custom `createJSONStorage`

Persisted state keys (via `partialize`):

| Key | Type | Description |
|-----|------|-------------|
| `settings` | `Settings` | Theme, notification time, relationship config, customization |
| `isOnboarded` | `boolean` | Onboarding completion flag (hardcoded `true` for single-user) |
| `messageHistory` | `MessageHistory` | Shown message IDs per date (`Map<string, number>`), navigation offset |
| `moods` | `MoodEntry[]` | Cached mood entries for offline access |

Custom serialization handles the `shownMessages` field which is a `Map<string, number>`:

```typescript
// Serialization (Map -> Array of entries)
if (state.messageHistory?.shownMessages instanceof Map) {
  serialized.messageHistory.shownMessages = Array.from(
    state.messageHistory.shownMessages.entries()
  );
}

// Deserialization (Array of entries -> Map)
if (Array.isArray(parsed.messageHistory?.shownMessages)) {
  parsed.messageHistory.shownMessages = new Map(
    parsed.messageHistory.shownMessages
  );
}
```

Pre-hydration validation resets corrupted state with a `console.error` and falls back to defaults.

### 3. Supabase (Cloud Backend)

**Client**: Singleton in `src/api/supabaseClient.ts`
**Database**: PostgreSQL with Row-Level Security (RLS)
**Storage**: Supabase Storage buckets for photos and love note images

Key tables:

| Table | Purpose | RLS |
|-------|---------|-----|
| `users` | User profiles with `partner_id` link | Yes |
| `moods` | Synced mood entries | Yes |
| `interactions` | Poke/kiss events between partners | Yes |
| `photos` | Photo metadata (blob in Storage) | Yes |
| `love_note_images` | Love note image attachments | Yes |
| `scripture_sessions` | Reading session state | Yes |
| `scripture_reflections` | Per-step reflections | Yes |
| `scripture_bookmarks` | Bookmarked steps | Yes |
| `scripture_messages` | In-session chat | Yes |

### Storage Size Monitoring

**localStorage**: The `storageMonitor.ts` utility estimates usage against a conservative 5MB limit. Warning levels:
- `safe`: < 70% usage
- `warning`: 70-85% usage
- `critical`: > 85% usage

**Supabase Storage**: The `photoService.ts` monitors bucket quota. Warning levels at 80% and 95% capacity.

## Data Flow Diagrams

### Mood Entry Creation

```
User taps "Save Mood"
    |
    v
MoodSlice.addMoodEntry(moods, note)
    |
    v
getCurrentUserIdOfflineSafe()  -- cached session, no network required
    |
    v
MoodService.create(userId, moods, note)
    |-- Zod validation (MoodEntrySchema.parse)
    |-- IndexedDB write (synced: false, supabaseId: null)
    |
    v
Optimistic state update (set moods: [...state.moods, created])
    |
    v
updateSyncStatus() -- count unsynced entries
    |
    v
if (navigator.onLine) {
    syncPendingMoods()  -- immediate sync attempt
        |
        v
    moodSyncService.syncPendingMoods()
        |-- For each unsynced: Supabase INSERT
        |-- On success: markAsSynced(id, supabaseId)
        |-- On failure: skip, retry next pass
}
```

### Love Note Message Send

```
User types message + taps Send
    |
    v
NotesSlice.sendNote(text, imageFile?)
    |
    v
Rate limit check (10 msgs/min)
    |
    v
sanitizeMessageContent(text)  -- DOMPurify, strip all HTML
    |
    v
if (imageFile) {
    compressImage(imageFile)  -- Canvas API, max 2048px, 80% JPEG
    |
    v
    uploadLoveNoteImage()  -- Edge Function upload
}
    |
    v
Supabase INSERT into love_notes
    |
    v
Optimistic UI update with tempId
    |
    v
Replace tempId with real Supabase ID on confirmation
    |
    v
Broadcast via Supabase Realtime Channel
```

## Schema Validation

All schemas are defined in `src/validation/schemas.ts` using Zod v4:

| Schema | Used By | Validates |
|--------|---------|-----------|
| `MessageSchema` | StorageService | Full message objects from IndexedDB |
| `CreateMessageInputSchema` | CustomMessageService | User input for new messages |
| `UpdateMessageInputSchema` | CustomMessageService | Partial update payloads |
| `PhotoSchema` | PhotoStorageService | Photo objects from IndexedDB |
| `PhotoUploadInputSchema` | PhotoUpload component | File upload form data |
| `MoodEntrySchema` | MoodService | Mood tracking entries |
| `SettingsSchema` | SettingsSlice | App settings (theme, relationship, notifications) |
| `CustomMessagesExportSchema` | MessagesSlice | Import/export file format |
| `SupabaseSessionSchema` | ScriptureReadingService | Supabase RPC responses |
| `SupabaseReflectionSchema` | ScriptureReadingService | Reflection row validation |
| `SupabaseBookmarkSchema` | ScriptureReadingService | Bookmark row validation |
| `SupabaseMessageSchema` | ScriptureReadingService | Scripture message validation |

## Related Documentation

- [Architecture Patterns](./03-architecture-patterns.md)
- [Offline Strategy](./12-offline-strategy.md)
- [Validation Layer](./14-validation-layer.md)
- [State Management - Persistence Strategy](../state-management/05-persistence-strategy.md)
