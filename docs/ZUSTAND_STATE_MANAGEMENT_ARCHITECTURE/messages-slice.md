# MESSAGES SLICE

## File

`src/stores/slices/messagesSlice.ts`

## Purpose

Manages message lifecycle: loading, CRUD, history tracking, daily message rotation, and custom message management via IndexedDB.

## State Interface

```typescript
export interface MessagesSlice {
  // State
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;
  currentDayOffset: number; // @deprecated
  customMessages: CustomMessage[];
  customMessagesLoaded: boolean;

  // Actions
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: string) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;
  loadCustomMessages: () => Promise<void>;
  createCustomMessage: (input: CreateMessageInput) => Promise<void>;
  updateCustomMessage: (input: UpdateMessageInput) => Promise<void>;
  deleteCustomMessage: (id: number) => Promise<void>;
  getCustomMessages: (filter?: MessageFilter) => CustomMessage[];
  exportCustomMessages: () => Promise<void>;
  importCustomMessages: (file: File) => Promise<{ imported: number; skipped: number }>;
}
```

## State Shape

```typescript
{
  messages: [
    {
      id: number,
      text: string,
      category: 'love' | 'inspiration' | 'fun' | 'intimate',
      isFavorite: boolean,
      isCustom: boolean,
      active?: boolean,         // For custom messages (Story 3.5)
      createdAt: Date,
      tags?: string[],          // For custom messages
    }
  ],

  messageHistory: {
    currentIndex: number,        // 0 = today, 1 = yesterday, etc.
    shownMessages: Map<string, number>,  // "YYYY-MM-DD" → messageId
    maxHistoryDays: 30,
    favoriteIds: number[],       // Legacy field
    lastShownDate: string,       // @deprecated
    lastMessageId: number,       // @deprecated
    viewedIds: number[],         // @deprecated
  },

  currentMessage: {
    id: number,
    text: string,
    category: string,
    // ... same as messages[n]
  } | null,

  currentDayOffset: number,      // @deprecated (use messageHistory.currentIndex)

  customMessages: [
    {
      id: number,
      text: string,
      category: string,
      isCustom: true,
      active: boolean,
      createdAt: ISO8601,        // String, not Date
      updatedAt?: ISO8601,
      tags?: string[],
    }
  ],

  customMessagesLoaded: boolean, // Flag for async loading state
}
```

## Initial State

```typescript
messages: [],
messageHistory: {
  currentIndex: 0,
  shownMessages: new Map(),
  maxHistoryDays: 30,
  favoriteIds: [],
  lastShownDate: '',
  lastMessageId: 0,
  viewedIds: [],
},
currentMessage: null,
currentDayOffset: 0,
customMessages: [],
customMessagesLoaded: false,
```

## Actions

### loadMessages()

**Type**: Async  
**Source**: IndexedDB (storageService)  
**Persistence**: IndexedDB

**Process**:

1. Fetch all messages from IndexedDB
2. Update `messages` state
3. Log count

**Error Handling**: Logged (graceful degradation)

### addMessage(text, category)

**Type**: Async  
**Destination**: IndexedDB  
**Persistence**: IndexedDB

**Process**:

1. Create Message object with:
   - `isCustom: true`
   - `createdAt: new Date()`
   - `isFavorite: false`
2. Save to IndexedDB (returns ID)
3. Update messages state optimistically
4. Log success

### toggleFavorite(messageId)

**Type**: Async  
**Updates**:

- IndexedDB: `isFavorite` flag
- State: `messages[n].isFavorite`
- State: `messageHistory.favoriteIds` array

**Process**:

1. Call `storageService.toggleFavorite(messageId)`
2. Toggle boolean in messages array
3. Update favoriteIds array
4. Call `updateCurrentMessage()` if current message changed

### updateCurrentMessage()

**Type**: Sync (internally async)  
**Critical**: Computes today's message and caches in messageHistory

**Algorithm**:

1. Filter rotation pool (exclude inactive custom messages)
2. Get today's date (YYYY-MM-DD format)
3. Check if message already cached in `shownMessages.get(todayString)`
4. If not cached:
   - Compute message using `getDailyMessage()` rotation algorithm
   - Cache in `shownMessages.set(dateString, messageId)`
   - Reset `currentIndex = 0` (today)
5. Load message object and set as `currentMessage`

**Rotation Algorithm**: `getDailyMessage(rotationPool, date)`

- Uses date-based hash to deterministically select message
- Different message each day
- Same message if same date on different year
- Depends on available messages count

**Story 3.3 Fix**: Always reset to today (`currentIndex = 0`) on app init, even if message is cached

### navigateToPreviousMessage()

**Type**: Sync  
**Direction**: Back in time (index 0 → 1 → 2)  
**Constraint**: Limited to `maxHistoryDays` (30 days)

**Process**:

1. Validate can navigate back: `canNavigateBack()` check
2. Increment `currentIndex` (0 → 1 = today → yesterday)
3. Calculate target date: `today - currentIndex days`
4. Check cache: `shownMessages.get(dateString)`
5. If not cached: compute via rotation algorithm + cache
6. Update `currentMessage`

**Caching**: Caches both current and target dates

### navigateToNextMessage()

**Type**: Sync  
**Direction**: Forward in time (index 1 → 0)  
**Constraint**: Cannot navigate past today (index 0)

**Process**:

1. Validate can navigate forward: `currentIndex > 0` check
2. Decrement `currentIndex` (1 → 0 = yesterday → today)
3. Calculate target date
4. Load from cache: `shownMessages.get(dateString)`
5. Update `currentMessage`

### canNavigateBack()

**Type**: Sync query  
**Returns**: boolean

**Logic**:

```typescript
const availableDays = getAvailableHistoryDays(messageHistory, settings);
return messageHistory.currentIndex < availableDays;
```

Compares current index against:

- `maxHistoryDays` (30)
- Or limited by relationship start date

### canNavigateForward()

**Type**: Sync query  
**Returns**: boolean

**Logic**:

```typescript
return messageHistory.currentIndex > 0; // Not at today
```

### loadCustomMessages()

**Type**: Async  
**Source**: IndexedDB (customMessageService)  
**Persistence**: IndexedDB

**Process**:

1. Fetch custom messages from customMessageService
2. Convert Date objects to ISO8601 strings
3. Update `customMessages` state
4. Set `customMessagesLoaded = true`

**Story 3.5**: Moved from LocalStorage to IndexedDB

### createCustomMessage(input)

**Type**: Async  
**Input**: `CreateMessageInput { text, category, tags?, active? }`  
**Destination**: IndexedDB

**Process**:

1. Save via `customMessageService.create(input)`
2. Optimistic UI update: add to `customMessages`
3. Reload all messages (updates rotation pool)
4. Log success

### updateCustomMessage(input)

**Type**: Async  
**Input**: `UpdateMessageInput { id, text?, category?, active?, tags? }`  
**Destination**: IndexedDB

**Process**:

1. Update via `customMessageService.updateMessage(input)`
2. Optimistic UI update: merge into matching custom message
3. Reload all messages (updates rotation pool)
4. Log success

### deleteCustomMessage(id)

**Type**: Async  
**Destination**: IndexedDB

**Process**:

1. Delete via `customMessageService.delete(id)`
2. Optimistic UI update: filter out from `customMessages`
3. Reload all messages (updates rotation pool)
4. Log success

### getCustomMessages(filter?)

**Type**: Sync query  
**Returns**: `CustomMessage[]`

**Filtering**:

- By `category`
- By `active` status
- By `searchTerm` (case-insensitive substring)
- By `tags` (includes match)

### exportCustomMessages()

**Type**: Async  
**Output**: JSON file download

**Process**:

1. Get export data via `customMessageService.exportMessages()`
2. Generate filename: `my-love-custom-messages-YYYY-MM-DD.json`
3. Create blob and trigger browser download
4. Log success

### importCustomMessages(file)

**Type**: Async  
**Input**: File (JSON)  
**Returns**: `{ imported: number; skipped: number }`

**Process**:

1. Read file content
2. Parse JSON
3. Import via `customMessageService.importMessages(data)`
4. Reload custom messages and main messages
5. Return import summary

## Message Rotation Pool

**Story 3.5 Enhancement**:

```typescript
const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);
```

Includes:

- All default messages (always active)
- Custom messages with `active !== false`

Excludes:

- Custom messages with `active = false`

This allows disabling custom messages without deletion.

## Persistence

| Data           | Storage      | Persisted?            | Loading Time                |
| -------------- | ------------ | --------------------- | --------------------------- |
| messages       | IndexedDB    | No (loaded on init)   | On `initializeApp()`        |
| messageHistory | LocalStorage | Yes (serialized)      | Automatic                   |
| currentMessage | Memory       | No (computed)         | On `updateCurrentMessage()` |
| customMessages | IndexedDB    | No (loaded on demand) | On `loadCustomMessages()`   |

## Dependencies

**Cross-Slice**:

- **Settings**: Uses `settings.relationship.startDate` for history limit
- **Settings**: Called by `initializeApp()` to load initial messages

**External**:

- `storageService` (IndexedDB CRUD)
- `customMessageService` (custom message ops)
- `getDailyMessage()` (rotation algorithm)
- `getAvailableHistoryDays()` (history limit calculation)

---
