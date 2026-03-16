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
| `notesCursor`           | `string \| null` | `null`  | No        | Pagination cursor for fetching older messages            |
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

| Action               | Signature                                              | Description                                    |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `sendNote`           | `(content: string, imageFile?: File) => Promise<void>` | Sends message with optimistic update           |
| `fetchNotes`         | `() => Promise<void>`                                  | Loads initial messages from Supabase           |
| `fetchOlderNotes`    | `() => Promise<void>`                                  | Loads older messages for pagination            |
| `clearNotesError`    | `() => void`                                           | Clears error state                             |
| `retryFailedMessage` | `(tempId: string) => Promise<void>`                    | Retries sending a failed message               |
| `addRealtimeNote`    | `(note: LoveNote) => void`                             | Adds a message received via realtime broadcast |

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

The `useLoveNotes` hook (and `useRealtimeMessages` hook) set up a Supabase realtime broadcast channel. When a message arrives from the partner, `addRealtimeNote()` inserts it into the `notes` array.

## Cross-Slice Dependencies

- **Reads:** `AuthSlice` (via `get().userId` in `fetchNotes`, `fetchOlderNotes`, `sendNote`, `retryFailedMessage` for user identity)
- The `useLoveNotes` hook wraps this slice's actions for component consumption.
