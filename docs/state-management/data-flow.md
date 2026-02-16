# Data Flow

## Component to Store to Service

The standard data flow follows a five-layer pattern:

```
UI Component
    |
    v
Custom Hook (optional bridge)
    |
    v
Zustand Store (useAppStore)
    |
    v
Service Layer (business logic, local persistence)
    |
    v
API Layer (Supabase client)
```

## Example: Mood Creation Flow

### 1. Component Triggers Action

```typescript
// In MoodTracker component
const addMoodEntry = useAppStore((state) => state.addMoodEntry);

const handleSaveMood = async () => {
  await addMoodEntry(['happy', 'grateful'], 'Great day!');
};
```

### 2. Store Slice Processes

```typescript
// In moodSlice.ts
addMoodEntry: async (moods, note) => {
  const userId = await getCurrentUserIdOfflineSafe();

  // Check for existing mood today
  const today = new Date().toISOString().split('T')[0];
  const existingMood = get().moods.find((m) => m.date === today);
  if (existingMood) {
    await get().updateMoodEntry(today, moods, note);
    return;
  }

  // Create via service (validates with Zod)
  const created = await moodService.create(userId, moods, note);

  // Optimistic UI update
  set((state) => ({ moods: [...state.moods, created] }));

  // Immediate sync if online
  if (navigator.onLine) {
    await get().syncPendingMoods();
  }
};
```

### 3. Service Validates and Persists

```typescript
// In moodService.ts
create(userId, moods, note) {
  const entry = MoodEntrySchema.parse({ date, mood: moods[0], moods, note });
  const id = await idb.add('moods', { ...entry, synced: false });
  return { ...entry, id };
}
```

### 4. API Layer Syncs to Backend

```typescript
// In moodSyncService.ts
syncPendingMoods() {
  const pending = await moodService.getUnsyncedMoods();
  for (const mood of pending) {
    const { data } = await supabase.from('moods').insert(transformedMood);
    await moodService.markSynced(mood.id, data.id);
  }
}
```

## Example: Love Note Send Flow

### 1. Hook Provides Facade

```typescript
// In useLoveNotes.ts
const { sendNote } = useLoveNotes();

// User clicks send
await sendNote('I love you!', imageFile);
```

### 2. Hook Calls Store

```typescript
// useLoveNotes.ts delegates to store
const sendNoteAction = useAppStore((state) => state.sendNote);
```

### 3. Store Handles Optimistic Update + API Call

```typescript
// In notesSlice.ts
sendNote: async (content, imageFile) => {
  // Rate limit check
  const { recentTimestamps, now } = get().checkRateLimit();

  // Create optimistic note with tempId
  const optimisticNote = { id: tempId, content, sending: true, ... };
  set((state) => ({ notes: [...state.notes, optimisticNote] }));

  // Compress and upload image (if any)
  if (imageFile) {
    const compressed = await imageCompressionService.compressImage(imageFile);
    storagePath = await uploadCompressedBlob(compressed.blob, userId);
  }

  // Insert to Supabase
  const { data } = await supabase.from('love_notes').insert({ content, image_url: storagePath });

  // Replace optimistic note with server response
  set((state) => ({
    notes: state.notes.map((n) => n.tempId === tempId ? { ...data, sending: false } : n),
  }));

  // Broadcast to partner's realtime channel
  const channel = supabase.channel(`love-notes:${partnerId}`);
  await channel.send({ type: 'broadcast', event: 'new_message', payload: { message: data } });
};
```

## Example: Message Rotation Flow

### 1. Initialization

```
App.tsx mounts
  -> initializeApp() (settingsSlice)
    -> storageService.init() (IndexedDB)
    -> storageService.getAllMessages()
    -> set({ messages })
    -> updateCurrentMessage() (messagesSlice)
```

### 2. Daily Message Computation

```typescript
// In messagesSlice.ts
updateCurrentMessage: () => {
  const { messages, messageHistory } = get();

  // Filter active messages for rotation pool
  const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);

  // Check cache for today's date
  const dateString = formatDate(new Date());
  let messageId = messageHistory.shownMessages.get(dateString);

  if (!messageId) {
    // Deterministic selection based on date hash
    const todayMessage = getDailyMessage(rotationPool, new Date());
    messageId = todayMessage.id;

    // Cache it in the Map
    updatedShownMessages.set(dateString, messageId);
  }

  const currentMessage = messages.find((m) => m.id === messageId);
  set({ currentMessage });
};
```

## Cross-Slice Dependencies

Most slices are self-contained. The notable exceptions:

| Source Slice | Target Slice | Interaction |
|---|---|---|
| `settingsSlice.initializeApp()` | `messagesSlice.updateCurrentMessage()` | Called via `get()` after loading messages |
| `moodSlice.syncPendingMoods()` | `moodSlice.fetchPartnerMoods()` | Called via `get()` after sync completes |
| `messagesSlice.navigateToPreviousMessage()` | `settingsSlice.settings` | Reads `settings.relationship.startDate` via `get()` |

All cross-slice access uses `get()` which returns the full `AppState`, avoiding direct imports between slice files.

## Realtime Data Flow

### Incoming Love Note

```
Supabase Broadcast (WebSocket)
  -> useRealtimeMessages hook
    -> notesSlice.addNote() (with deduplication)
      -> set({ notes: [...state.notes, note] })
        -> Component re-renders
```

### Incoming Interaction (Poke/Kiss)

```
Supabase Broadcast (WebSocket)
  -> interactionsSlice subscription callback
    -> addIncomingInteraction() (with deduplication)
      -> set({ interactions: [...state.interactions, interaction] })
        -> Component re-renders
```
