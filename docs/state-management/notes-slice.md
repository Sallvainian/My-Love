# Notes Slice

**File:** `src/stores/slices/notesSlice.ts`
**Interface:** `NotesSlice`

## Purpose

Manages the love notes chat feature with optimistic updates, pagination, rate limiting, and image attachment support. Messages are stored in Supabase and received via realtime broadcast.

## State

| Field                   | Type             | Default | Persisted | Description                                              |
| ----------------------- | ---------------- | ------- | --------- | -------------------------------------------------------- |
| `notes`                 | `LoveNote[]`     | `[]`    | No        | Chat messages array                                      |
| `notesIsLoading`        | `boolean`        | `false` | No        | Loading state for note operations                        |
| `notesError`            | `string \| null` | `null`  | No        | Error message for note operations                        |
| `notesHasMore`          | `boolean`        | `true`  | No        | Whether more messages exist for pagination               |
| `sentMessageTimestamps` | `number[]`       | `[]`    | No        | Timestamps of recently sent messages (for rate limiting) |

## LoveNote Shape

```typescript
interface LoveNote {
  id: string;
  from_user_id: string;
  content: string;
  created_at: string;
  image_url?: string; // Server-stored image path
  // Optimistic update fields:
  tempId?: string; // Temporary ID before server confirms
  sending?: boolean; // Whether message is in-flight
  error?: boolean; // Whether send failed
  imagePreviewUrl?: string; // Local blob URL for preview before upload
  imageUploading?: boolean; // Whether image upload is in progress
}
```

## Actions

| Action                | Signature                                              | Description                                                           |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `fetchNotes`          | `(limit?: number) => Promise<void>`                    | Loads initial messages from Supabase (default page size from config)  |
| `fetchOlderNotes`     | `(limit?: number) => Promise<void>`                    | Loads older messages for pagination                                   |
| `addNote`             | `(note: LoveNote) => void`                             | Adds a message with deduplication (used by realtime and optimistic)   |
| `setNotes`            | `(notes: LoveNote[]) => void`                          | Sets the entire notes array (revokes old preview URLs)                |
| `setNotesError`       | `(error: string \| null) => void`                      | Sets error state                                                      |
| `clearNotesError`     | `() => void`                                           | Clears error state                                                    |
| `checkRateLimit`      | `() => { recentTimestamps: number[]; now: number }`    | Validates rate limit, throws if exceeded (10 msgs per minute)         |
| `sendNote`            | `(content: string, imageFile?: File) => Promise<void>` | Sends message with optimistic update and realtime broadcast           |
| `retryFailedMessage`  | `(tempId: string) => Promise<void>`                    | Retries sending a failed message (uses cached imageBlob if available) |
| `cleanupPreviewUrls`  | `() => void`                                           | Revokes blob URLs from notes to prevent memory leaks                  |
| `removeFailedMessage` | `(tempId: string) => void`                             | Removes a failed message and cleans up its preview URL                |

## Optimistic Updates Pattern

When `sendNote()` is called:

1. Creates a temporary `LoveNote` with `tempId`, `sending: true`
2. Appends it to `notes` array immediately (optimistic)
3. If image attached: creates `imagePreviewUrl` blob, sets `imageUploading: true`
4. Compresses image client-side, uploads to Supabase storage
5. Sends message to Supabase RPC
6. On success: replaces temp note with server response (real `id`, `image_url`)
7. On failure: marks temp note with `error: true`, `sending: false`

## Rate Limiting

`sentMessageTimestamps` tracks recent sends. The slice enforces a rate limit to prevent spam. Timestamps older than the rate window are pruned on each send.

## Realtime Integration

The `useLoveNotes` hook (and `useRealtimeMessages` hook) set up a Supabase realtime broadcast channel. When a message arrives from the partner, `addNote()` inserts it into the `notes` array with deduplication (checks by `id` to prevent duplicate messages).

## Cross-Slice Dependencies

- **Reads:** `AuthSlice` (via `get().userId` in `fetchNotes`, `fetchOlderNotes`, `sendNote`, `retryFailedMessage` for user identity)
- The `useLoveNotes` hook wraps this slice's actions for component consumption.
