# Messages Slice

**File:** `src/stores/slices/messagesSlice.ts`
**Interface:** `MessagesSlice`

## Purpose

Manages the daily love messages system: message pool, display history tracking (which messages have been shown and when), favorites, custom message CRUD, navigation between messages, and import/export.

## State

| Field                  | Type              | Default   | Persisted          | Description                                             |
| ---------------------- | ----------------- | --------- | ------------------ | ------------------------------------------------------- |
| `messages`             | `Message[]`       | `[]`      | No (IndexedDB)     | Full message pool loaded from IndexedDB                 |
| `messageHistory`       | `MessageHistory`  | See below | Yes (localStorage) | Tracking of shown messages, favorites, etc.             |
| `currentMessage`       | `Message \| null` | `null`    | No                 | Currently displayed message                             |
| `currentDayOffset`     | `number`          | `0`       | No                 | Day offset for message navigation (0 = today)           |
| `customMessages`       | `CustomMessage[]` | `[]`      | No (IndexedDB)     | User-created custom messages                            |
| `customMessagesLoaded` | `boolean`         | `false`   | No                 | Whether custom messages have been loaded from IndexedDB |

## MessageHistory Shape

```typescript
interface MessageHistory {
  currentIndex: number;
  shownMessages: Map<string, number>; // messageId -> timestamp
  maxHistoryDays: number; // default: 30
  favoriteIds: string[];
  lastShownDate: string;
  lastMessageId: number;
  viewedIds: string[];
}
```

The `shownMessages` field is a `Map` at runtime but serialized as an array of `[key, value]` tuples for localStorage persistence.

## Actions

| Action                      | Signature                                                        | Description                                     |
| --------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `loadMessages`              | `() => Promise<void>`                                            | Loads messages from IndexedDB into state        |
| `addMessage`                | `(text: string, category: Message['category']) => Promise<void>` | Adds a new message to IndexedDB and state       |
| `toggleFavorite`            | `(messageId: number) => Promise<void>`                           | Toggles message favorite status in IndexedDB    |
| `updateCurrentMessage`      | `() => void`                                                     | Recalculates current message from rotation pool |
| `navigateToPreviousMessage` | `() => void`                                                     | Navigate to previous day's message              |
| `navigateToNextMessage`     | `() => void`                                                     | Navigate to next day's message (toward today)   |
| `canNavigateBack`           | `() => boolean`                                                  | Check if backward navigation is available       |
| `canNavigateForward`        | `() => boolean`                                                  | Check if forward navigation is available        |
| `loadCustomMessages`        | `() => Promise<void>`                                            | Loads custom messages from IndexedDB            |
| `createCustomMessage`       | `(input: CreateMessageInput) => Promise<void>`                   | Creates a custom message in IndexedDB           |
| `updateCustomMessage`       | `(input: UpdateMessageInput) => Promise<void>`                   | Updates a custom message                        |
| `deleteCustomMessage`       | `(id: number) => Promise<void>`                                  | Deletes a custom message from IndexedDB         |
| `getCustomMessages`         | `(filter?: MessageFilter) => CustomMessage[]`                    | Returns filtered custom messages (synchronous)  |
| `exportCustomMessages`      | `() => Promise<void>`                                            | Exports custom messages as JSON download        |
| `importCustomMessages`      | `(file: File) => Promise<{ imported: number; skipped: number }>` | Imports custom messages from JSON file          |

## Persistence Details

- **`messageHistory`** is persisted to localStorage with Map serialization (see store-architecture.md)
- **`messages`** and **`customMessages`** are stored in IndexedDB (not localStorage) to avoid quota issues with large datasets
- `customMessagesLoaded` is a runtime flag to prevent redundant IndexedDB reads

## Cross-Slice Dependencies

- **Reads:** Settings (via `get().settings` to access relationship config for message selection)
