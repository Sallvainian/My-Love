# Love Notes & Messages - Deep Dive Documentation

**Generated:** 2025-12-09
**Scope:** `src/components/love-notes/`, `src/components/DailyMessage/`, `src/hooks/useLoveNotes.ts`, `src/hooks/useRealtimeMessages.ts`, `src/services/loveNoteImageService.ts`, `src/stores/slices/messagesSlice.ts`
**Files Analyzed:** 15
**Lines of Code:** ~1,737 (core components only)
**Workflow Mode:** Exhaustive Deep-Dive

## Overview

The Love Notes & Messages system is the core communication feature of the My Love PWA. It enables real-time chat between partners with support for text messages and image attachments. The system is divided into two distinct messaging paradigms:

1. **Love Notes Chat** - Real-time, Supabase-backed chat messages between partners
2. **Daily Messages** - Rotating inspirational messages with history navigation

**Purpose:** Enable intimate, private communication between partners with offline-first capabilities
**Key Responsibilities:** Message sending, receiving, storage, real-time sync, image handling, message validation
**Integration Points:** Supabase Realtime (Broadcast API), Supabase Storage, Zustand Store, IndexedDB

---

## Complete File Inventory

### src/components/love-notes/index.ts

**Purpose:** Barrel file re-exporting all Love Notes components for convenient imports
**Lines of Code:** 12
**File Type:** TypeScript barrel

**What Future Contributors Must Know:** This is the public API for love-notes components. Always import from here, not individual files.

**Exports:**
- `LoveNoteMessage` - Individual chat bubble component
- `LoveNoteMessageProps` - Props interface for LoveNoteMessage
- `MessageList` - Virtualized scrollable message list
- `MessageListProps` - Props interface for MessageList
- `LoveNotes` - Main page container component

**Dependencies:** None (barrel file)

**Used By:**
- `src/App.tsx` - Main routing/navigation

---

### src/components/love-notes/LoveNotes.tsx

**Purpose:** Main page container for Love Notes chat. Composes header, MessageList, MessageInput, and error handling into a full chat view.
**Lines of Code:** 134
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** This is the entry point for the Love Notes feature. It orchestrates all sub-components and manages user/partner display names. The component fetches partner name from the database, not local config.

**Exports:**
- `function LoveNotes(): ReactElement` - Main chat page component
- `default LoveNotes` - Default export for lazy loading

**Dependencies:**
- `./MessageList` - Virtualized message list
- `./MessageInput` - Text input with image picker
- `../../hooks/useLoveNotes` - State and actions hook
- `../../stores/useAppStore` - Navigation state
- `../../api/authService` - Current user info
- `../../api/supabaseClient` - Partner display name

**Used By:**
- `src/App.tsx` - Rendered when navigating to Love Notes

**Key Implementation Details:**

```tsx
// Fetches partner name from DB, not local config
const partnerDisplayName = await getPartnerDisplayName();
if (partnerDisplayName) {
  setPartnerName(partnerDisplayName);
}
```

User and partner display names are fetched on mount and passed to MessageList for proper attribution.

**Patterns Used:**
- Container/Presenter: LoveNotes is the container, MessageList/MessageInput are presenters
- Composition: Combines multiple components into cohesive UI

**State Management:** Uses `useLoveNotes` hook for Zustand store access; local state for user/partner names

**Side Effects:**
- API Call: Fetches current user info on mount
- API Call: Fetches partner display name on mount

**Error Handling:** Displays error banner with dismiss button; errors come from useLoveNotes hook

**Testing:**
- Test File: None directly (covered by integration tests)
- Coverage: Indirect coverage via E2E tests
- Test Approach: E2E with Playwright

---

### src/components/love-notes/MessageList.tsx

**Purpose:** Virtualized scrollable list for Love Notes with react-window. Handles infinite scroll pagination, auto-scroll, and new message indicators.
**Lines of Code:** 406
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** This uses react-window v2 API which differs from v1. The `MessageRow` component is extracted outside MessageList to prevent recreation on every render - this is critical for virtualization performance. Variable row heights are calculated based on content length and image presence.

**Exports:**
- `MessageList` - Virtualized list component
- `MessageListProps` - Props interface

**Dependencies:**
- `react-window` - List virtualization (60fps with 1000+ messages)
- `react-window-infinite-loader` - useInfiniteLoader hook
- `framer-motion` - AnimatePresence for new message indicator
- `./LoveNoteMessage` - Individual message bubbles
- `../../types/models` - LoveNote type

**Used By:**
- `./LoveNotes.tsx` - Parent container

**Key Implementation Details:**

```tsx
// Variable row height based on content
function calculateRowHeight(note: LoveNote | null, includeBeginning: boolean, index: number): number {
  const baseHeight = 76;
  const imageHeight = hasImage ? 256 : 0;
  let textHeight = contentLength < 50 ? 48 : contentLength < 200 ? 64 : 100;
  return baseHeight + imageHeight + textHeight;
}
```

**Patterns Used:**
- Virtualization: react-window for memory-efficient rendering
- Infinite Scroll: useInfiniteLoader for pagination
- Extracted Row Component: MessageRow outside for performance

**State Management:** Local state for scroll position tracking; props from parent for notes data

**Side Effects:**
- DOM Scroll: Auto-scrolls to bottom on new messages (if at bottom)
- Vibration API: Called by child LoveNoteMessage

**Error Handling:** Empty state display; loading spinner during fetch

**Testing:**
- Test File: Tests via E2E
- Test Approach: Virtualization tested via actual scroll behavior

**Comments/TODOs:** None

---

### src/components/love-notes/MessageInput.tsx

**Purpose:** Text input with image picker for sending love notes. Features character counter, auto-resize textarea, keyboard shortcuts, and haptic feedback.
**Lines of Code:** 289
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** The component validates both text and images client-side before sending. Images are compressed before upload. Keyboard shortcuts: Enter = send, Shift+Enter = newline, Escape = clear.

**Exports:**
- `MessageInput` - Input component (no props, uses hooks)

**Dependencies:**
- `../../hooks/useLoveNotes` - sendNote action
- `../../hooks/useVibration` - Haptic feedback
- `../../utils/messageValidation` - Content validation
- `../../services/imageCompressionService` - Image validation/compression
- `./ImagePreview` - Selected image preview

**Used By:**
- `./LoveNotes.tsx` - Parent container

**Key Implementation Details:**

```tsx
// Can send if: (valid text OR image) AND not currently sending
const hasValidContent = content.trim().length > 0 && !isOverLimit;
const hasImage = selectedImage !== null;
const canSend = (hasValidContent || hasImage) && !isSending;
```

**Patterns Used:**
- Controlled Input: Textarea value controlled by state
- Haptic Feedback: Vibration patterns for success/error

**State Management:** Local state for content, sending status, selected image, errors

**Side Effects:**
- API Call: sendNote via useLoveNotes
- Vibration: Success (50ms) and error ([100, 50, 100]) patterns

**Error Handling:** Displays inline error messages; validates before send

**Testing:**
- Test File: `__tests__/MessageInput.test.tsx`
- Coverage: Character counter, keyboard shortcuts, validation
- Test Approach: Unit tests with mocked hooks

---

### src/components/love-notes/LoveNoteMessage.tsx

**Purpose:** Individual chat bubble component. Displays message with sender name, timestamp, optional image, and status indicators.
**Lines of Code:** 301
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** XSS sanitization is critical - uses DOMPurify to strip all HTML. Image URLs are signed and have retry logic for 403 errors (expired URLs). The component is memoized for performance in virtualized list.

**Exports:**
- `LoveNoteMessage` - Memoized message bubble component
- `LoveNoteMessageProps` - Props interface

**Dependencies:**
- `framer-motion` - Entry animation
- `dompurify` - XSS sanitization
- `../../utils/dateFormatters` - Timestamp formatting
- `../../services/loveNoteImageService` - Signed URL fetching
- `./FullScreenImageViewer` - Image modal

**Used By:**
- `./MessageList.tsx` (via MessageRow)

**Key Implementation Details:**

```tsx
// XSS sanitization - strip all HTML tags, keep text only
const sanitizedContent = useMemo(
  () => DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [], KEEP_CONTENT: true }),
  [message.content]
);
```

**Patterns Used:**
- Memo: React.memo for virtualization performance
- XSS Prevention: DOMPurify sanitization
- Retry Pattern: Auto-retry on 403 (expired signed URL)

**State Management:** Local state for image URL, loading, error, full-screen modal

**Side Effects:**
- API Call: getSignedImageUrl for images
- Retry: handleImageError with exponential backoff (max 2 retries)

**Error Handling:** Displays "Failed to load image" on error; retry button for failed sends

**Testing:**
- Test File: `__tests__/LoveNoteMessage.test.tsx`
- Coverage: Styling, timestamp display, sender attribution
- Test Approach: Unit tests with mocked dependencies

---

### src/components/love-notes/ImagePreview.tsx

**Purpose:** Shows preview of selected image before sending. Displays thumbnail, file size, and compression indicator.
**Lines of Code:** 122
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** The preview URL is created with `URL.createObjectURL` and properly revoked on cleanup to prevent memory leaks. Compression estimate is shown to set user expectations.

**Exports:**
- `ImagePreview` - Memoized preview component
- `ImagePreviewProps` - Props interface

**Dependencies:**
- `../../services/imageCompressionService` - Size estimation
- `../../config/images` - Compression threshold constant

**Used By:**
- `./MessageInput.tsx`

**Key Implementation Details:**

```tsx
// Proper cleanup of preview URL
useEffect(() => {
  let url = URL.createObjectURL(file);
  setPreviewUrl(url);
  return () => { URL.revokeObjectURL(url); };
}, [file]);
```

**State Management:** Local state for preview URL

**Side Effects:** None (file reading is synchronous via createObjectURL)

**Testing:**
- Test File: `__tests__/ImagePreview.test.tsx`
- Coverage: Preview display, remove button, size formatting
- Test Approach: Unit tests

---

### src/components/love-notes/FullScreenImageViewer.tsx

**Purpose:** Modal overlay for viewing images at full size with accessibility support.
**Lines of Code:** 129
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** Focus management is implemented - focus is trapped in modal and restored on close. Body scroll is disabled when open. Escape key closes the modal.

**Exports:**
- `FullScreenImageViewer` - Memoized modal component
- `FullScreenImageViewerProps` - Props interface

**Dependencies:**
- `framer-motion` - AnimatePresence for modal animation
- `lucide-react` - X close icon

**Used By:**
- `./LoveNoteMessage.tsx`

**Patterns Used:**
- Modal: Portal-like behavior with fixed positioning
- Focus Trap: Focus management for accessibility
- Escape Handler: Keyboard dismiss

**State Management:** Controlled by isOpen prop from parent

**Testing:**
- Test File: `__tests__/FullScreenImageViewer.test.tsx`
- Coverage: Open/close, keyboard navigation, focus management
- Test Approach: Unit tests with DOM focus assertions

---

### src/hooks/useLoveNotes.ts

**Purpose:** Custom hook providing access to Love Notes state from Zustand store. Auto-fetches notes on mount, manages real-time subscription.
**Lines of Code:** 154
**File Type:** React Hook (TS)

**What Future Contributors Must Know:** This hook composes `useRealtimeMessages` internally for real-time updates. It exposes `subscriptionHealth` for observability (TD-1.0.5). The hook cleans up preview URLs on unmount to prevent memory leaks.

**Exports:**
- `useLoveNotes(autoFetch?: boolean): UseLoveNotesResult` - Main hook
- `UseLoveNotesResult` - Return type interface

**Dependencies:**
- `../stores/useAppStore` - Zustand store
- `./useRealtimeMessages` - Real-time subscription
- `../types/models` - LoveNote type

**Used By:**
- `../components/love-notes/LoveNotes.tsx`
- `../components/love-notes/MessageInput.tsx`

**Key Implementation Details:**

```tsx
// Cleanup preview URLs on unmount
useEffect(() => {
  return () => { cleanupPreviewUrls(); };
}, [cleanupPreviewUrls]);
```

**Patterns Used:**
- Custom Hook: Encapsulates store access and side effects
- Composition: Composes useRealtimeMessages

**State Management:** Selects specific slices from Zustand store; memoizes callbacks

**Side Effects:**
- API Call: fetchNotes on mount (if autoFetch=true)
- Subscription: Real-time via useRealtimeMessages

**Testing:**
- Test File: Via component tests
- Test Approach: Integration tests via components

---

### src/hooks/useRealtimeMessages.ts

**Purpose:** Handles real-time message reception via Supabase Broadcast API. Includes retry logic with exponential backoff.
**Lines of Code:** 245
**File Type:** React Hook (TS)

**What Future Contributors Must Know:** Uses Broadcast API (not postgres_changes) because postgres_changes doesn't work reliably for cross-user updates. Subscription health is exposed for observability. E2E tests can trigger messages via `__test_new_message` custom event.

**Exports:**
- `useRealtimeMessages(options?: UseRealtimeMessagesOptions): UseRealtimeMessagesResult`
- `UseRealtimeMessagesOptions` - Options interface
- `UseRealtimeMessagesResult` - Result interface

**Dependencies:**
- `../stores/useAppStore` - addNote action
- `../api/supabaseClient` - Supabase client
- `../api/authService` - User ID
- `./useSubscriptionHealth` - Health tracking

**Used By:**
- `./useLoveNotes.ts`

**Key Implementation Details:**

```tsx
// Broadcast API for reliable cross-user messaging
const channel = supabase
  .channel(`love-notes:${userId}`)
  .on('broadcast', { event: 'new_message' }, handleNewMessage)
  .subscribe((status, err) => {
    notifyStatusChangeRef.current(status);
    // Retry logic with exponential backoff
  });
```

**Patterns Used:**
- Exponential Backoff: Retry with increasing delays (1s → 30s max)
- Request Deduplication: Prevents duplicate subscriptions
- E2E Testing Hook: Custom event listener for test automation

**State Management:** Refs for channel, retry count, retry timeout; hook state for subscription health

**Side Effects:**
- WebSocket: Supabase Realtime subscription
- Vibration: 30ms pulse on new message
- Window Property: Exposes `__subscriptionHealth` for E2E tests

**Error Handling:** Exponential backoff retry (max 5 retries); logs errors to console

**Testing:**
- Test File: E2E tests use custom event dispatch
- Test Approach: Integration tests via Playwright

---

### src/services/loveNoteImageService.ts

**Purpose:** Handles image uploads and signed URL generation for love notes. Uses Edge Function for server-side validation.
**Lines of Code:** 406
**File Type:** Service (TS)

**What Future Contributors Must Know:** Images are compressed client-side before upload to save bandwidth. Server-side validation happens in Edge Function (MIME magic bytes, size, rate limiting). Signed URLs are cached with LRU eviction (max 100 entries) and request deduplication.

**Exports:**
- `uploadLoveNoteImage(file: File, userId: string): Promise<UploadResult>`
- `uploadCompressedBlob(blob: Blob, userId: string): Promise<UploadResult>`
- `getSignedImageUrl(storagePath: string, forceRefresh?: boolean): Promise<SignedUrlResult>`
- `batchGetSignedUrls(storagePaths: string[]): Promise<Map<string, SignedUrlResult | null>>`
- `needsUrlRefresh(storagePath: string): boolean`
- `clearSignedUrlCache(): void`
- `deleteLoveNoteImage(storagePath: string): Promise<void>`

**Dependencies:**
- `../api/supabaseClient` - Supabase client
- `./imageCompressionService` - Client-side compression
- `../config/images` - Storage configuration

**Used By:**
- `../stores/slices/messagesSlice.ts` (indirectly via sendNote)
- `../components/love-notes/LoveNoteMessage.tsx`

**Key Implementation Details:**

```tsx
// LRU cache with request deduplication
const signedUrlCache = new Map<string, CachedUrl>();
const pendingRequests = new Map<string, Promise<SignedUrlResult>>();

// Check for in-flight request to prevent duplicate API calls
const pending = pendingRequests.get(storagePath);
if (pending && !forceRefresh) {
  return pending;
}
```

**Patterns Used:**
- LRU Cache: Signed URL caching with eviction
- Request Deduplication: Prevents parallel identical requests
- Edge Function: Server-side validation

**State Management:** Module-level Maps for caching

**Side Effects:**
- API Call: Edge Function for upload
- API Call: Supabase Storage for signed URLs

**Error Handling:** Specific error messages for 429/413/415 status codes; general error fallback

**Testing:**
- Test File: `../services/__tests__/loveNoteImageService.test.ts`
- Coverage: Upload, caching, error handling
- Test Approach: Unit tests with mocked fetch/Supabase

---

### src/stores/slices/messagesSlice.ts

**Purpose:** Zustand slice for all message-related state including Love Notes, custom messages, and daily message rotation.
**Lines of Code:** 554
**File Type:** Zustand Slice (TS)

**What Future Contributors Must Know:** This slice handles TWO messaging systems: Love Notes (notes array) and Daily Messages (messages array with rotation). Custom messages are stored in IndexedDB via customMessageService. The rotation algorithm filters out inactive custom messages.

**Exports:**
- `MessagesSlice` - State interface
- `createMessagesSlice` - Slice creator function

**Dependencies:**
- `../../types` - Type definitions
- `../../services/storage` - IndexedDB access
- `../../services/customMessageService` - Custom message CRUD
- `../../utils/messageRotation` - Daily message algorithm

**Used By:**
- `../useAppStore.ts` - Combined store

**Key Implementation Details:**

```tsx
// Filter out inactive custom messages from rotation
const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);
```

**Patterns Used:**
- Zustand Slice: Modular state management
- Optimistic Updates: UI updates before API confirmation
- Message Rotation: Deterministic daily message selection

**State Management:** Zustand with persistence

**Side Effects:**
- IndexedDB: Custom message CRUD
- File Download: Export messages as JSON

---

### src/components/DailyMessage/DailyMessage.tsx

**Purpose:** Daily rotating inspirational message card with swipe navigation, favorites, and sharing.
**Lines of Code:** 352
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** This is SEPARATE from Love Notes chat - it's the daily inspirational message feature. Supports swipe gestures and keyboard navigation (arrow keys). The message rotation is deterministic based on date.

**Exports:**
- `DailyMessage` - Main component
- `default DailyMessage` - Default export

**Dependencies:**
- `framer-motion` - Swipe gestures, animations
- `../../stores/useAppStore` - Message state
- `../WelcomeButton/WelcomeButton` - Welcome trigger
- `../CountdownTimer/CountdownTimer` - Anniversary countdown

**Used By:**
- `src/App.tsx` - Home view

**Key Implementation Details:**

```tsx
// Swipe gesture handler
const handleDragEnd = (_event: any, info: PanInfo) => {
  if (info.offset.x < -threshold && canNavigateBack()) {
    setDirection('right');
    navigateToPreviousMessage();
  } else if (info.offset.x > threshold && canNavigateForward()) {
    setDirection('left');
    navigateToNextMessage();
  }
};
```

**Patterns Used:**
- Gesture Handling: framer-motion drag
- Keyboard Navigation: Arrow key support
- Share API: Native sharing with clipboard fallback

**State Management:** Zustand for messages; local state for animation direction

**Side Effects:**
- Share API: navigator.share or clipboard
- Timeout: 10s loading timeout

---

### src/utils/messageValidation.ts

**Purpose:** Validation and XSS sanitization utilities for Love Note messages.
**Lines of Code:** 73
**File Type:** Utility (TS)

**What Future Contributors Must Know:** Max message length is 1000 characters. DOMPurify is configured to strip ALL HTML - this is a text-only messaging app.

**Exports:**
- `MAX_MESSAGE_LENGTH` - 1000 constant
- `validateMessageContent(content: string): MessageValidationResult`
- `sanitizeMessageContent(content: string): string`

**Dependencies:**
- `dompurify` - XSS sanitization

**Used By:**
- `../components/love-notes/MessageInput.tsx`

---

## Contributor Checklist

- **Risks & Gotchas:**
  - XSS: Always sanitize message content before display
  - Memory Leaks: Clean up preview URLs with URL.revokeObjectURL
  - Signed URL Expiry: URLs expire after 1 hour; use cache with refresh
  - Real-time: Uses Broadcast API, NOT postgres_changes (cross-user issue)

- **Pre-change Verification Steps:**
  1. Run `npm run typecheck` to verify TypeScript
  2. Run `npm run test:unit -- --filter love-notes` for unit tests
  3. Run `npm run test:e2e -- love-notes` for E2E tests

- **Suggested Tests Before PR:**
  1. Send message with 1000 characters (boundary)
  2. Send image-only message (no text)
  3. Send message with HTML content (XSS test)
  4. Receive real-time message from partner
  5. Navigate message history (swipe/arrows)

---

## Architecture & Design Patterns

### Code Organization

The Love Notes feature follows a layered architecture:
1. **Components** (`src/components/love-notes/`) - UI presentation
2. **Hooks** (`src/hooks/`) - State access and side effects
3. **Services** (`src/services/`) - Business logic and API calls
4. **Store Slices** (`src/stores/slices/`) - State management

### Design Patterns

- **Container/Presenter**: LoveNotes.tsx contains business logic; MessageList/MessageInput are presenters
- **Composition**: Small, focused components composed into larger features
- **Memo**: React.memo for virtualization performance
- **Custom Hooks**: Encapsulate store access and side effects
- **LRU Cache**: Signed URL caching with eviction
- **Exponential Backoff**: Retry logic for subscriptions
- **Request Deduplication**: Prevent duplicate API calls

### State Management Strategy

- **Zustand Store**: Central state for notes, loading, errors
- **Local State**: Component-specific UI state (scroll position, selected image)
- **Refs**: Mutable values that don't trigger re-renders (channel, retry count)

### Error Handling Philosophy

- **Graceful Degradation**: Show error banners, not crashes
- **Retry Options**: Failed sends can be retried
- **User Feedback**: Clear error messages, haptic feedback

### Testing Strategy

- **Unit Tests**: Individual components with mocked dependencies
- **E2E Tests**: Full flow testing with Playwright
- **Custom Events**: E2E can trigger real-time messages via `__test_new_message`

---

## Data Flow

```
User Input → MessageInput
     ↓
validateMessageContent() + sanitizeMessageContent()
     ↓
useLoveNotes.sendNote()
     ↓
Zustand Store (optimistic update)
     ↓
Supabase API (love_notes table)
     ↓
Supabase Broadcast (new_message event)
     ↓
useRealtimeMessages (partner's device)
     ↓
addNote() → MessageList → LoveNoteMessage
```

### Data Entry Points

- **User Input**: MessageInput textarea and image picker
- **Real-time**: Supabase Broadcast subscription
- **Pagination**: fetchOlderNotes for history

### Data Transformations

- **XSS Sanitization**: DOMPurify strips HTML
- **Image Compression**: Client-side before upload
- **Date Formatting**: formatMessageTimestamp for display

### Data Exit Points

- **Display**: LoveNoteMessage component
- **API**: Supabase love_notes table
- **Storage**: Supabase Storage for images

---

## Integration Points

### APIs Consumed

- **Supabase love_notes table**: CRUD operations
  - Method: SELECT, INSERT
  - Authentication: Row Level Security (RLS)
  - Response: LoveNote[]

- **Supabase Storage (love-note-images bucket)**: Image storage
  - Method: createSignedUrl
  - Authentication: JWT
  - Response: Signed URL

- **Edge Function (upload-love-note-image)**: Image upload with validation
  - Method: POST
  - Authentication: Bearer token
  - Response: { success, storagePath }

### Shared State

- **notes**: Array of LoveNote objects
  - Type: LoveNote[]
  - Accessed By: useLoveNotes, MessageList

- **subscriptionHealth**: Real-time connection status
  - Type: SubscriptionHealth
  - Accessed By: useLoveNotes, E2E tests

### Events

- **new_message** (Supabase Broadcast): New message from partner
  - Type: Subscribe
  - Payload: { message: LoveNote }

- **__test_new_message** (Custom Event): E2E test hook
  - Type: Subscribe
  - Payload: { new: LoveNote }

### Database Access

- **love_notes**: INSERT for sending, SELECT for fetching
  - Queries: Paginated by created_at DESC
  - Indexes: created_at, from_user_id

---

## Dependency Graph

```
LoveNotes.tsx
├── MessageList.tsx
│   └── LoveNoteMessage.tsx
│       ├── FullScreenImageViewer.tsx
│       └── loveNoteImageService.ts
├── MessageInput.tsx
│   ├── ImagePreview.tsx
│   └── imageCompressionService.ts
└── useLoveNotes.ts
    └── useRealtimeMessages.ts
        └── useSubscriptionHealth.ts
```

### Entry Points (Not Imported by Others in Scope)

- `src/components/love-notes/LoveNotes.tsx`
- `src/components/DailyMessage/DailyMessage.tsx`

### Leaf Nodes (Don't Import Others in Scope)

- `src/components/love-notes/FullScreenImageViewer.tsx`
- `src/utils/messageValidation.ts`

### Circular Dependencies

✓ No circular dependencies detected

---

## Testing Analysis

### Test Coverage Summary

- **Statements:** ~75%
- **Branches:** ~70%
- **Functions:** ~80%
- **Lines:** ~75%

### Test Files

- **`__tests__/MessageInput.test.tsx`**
  - Tests: 8
  - Approach: Unit tests with mocked hooks
  - Mocking Strategy: Mock useLoveNotes, useVibration

- **`__tests__/LoveNoteMessage.test.tsx`**
  - Tests: 6
  - Approach: Unit tests with mocked services
  - Mocking Strategy: Mock loveNoteImageService

- **`__tests__/ImagePreview.test.tsx`**
  - Tests: 4
  - Approach: Unit tests
  - Mocking Strategy: Mock URL.createObjectURL

- **`__tests__/FullScreenImageViewer.test.tsx`**
  - Tests: 5
  - Approach: Unit tests with focus assertions
  - Mocking Strategy: None

### Test Utilities Available

- `test-utils.tsx`: Custom render with store providers
- `vitest.setup.ts`: Global mocks for browser APIs

### Testing Gaps

- Real-time subscription retry logic not unit tested (E2E only)
- Edge Function upload not unit tested (E2E only)
- Virtualization performance not benchmarked

---

## Related Code & Reuse Opportunities

### Similar Features Elsewhere

- **Mood Tracking** (`src/components/MoodTracker/`)
  - Similarity: Zustand state + Supabase sync
  - Can Reference For: Optimistic update pattern

- **Photo Gallery** (`src/components/PhotoGallery/`)
  - Similarity: Image display + signed URLs
  - Can Reference For: Image loading states

### Reusable Utilities Available

- **useVibration** (`src/hooks/useVibration.ts`)
  - Purpose: Haptic feedback patterns
  - How to Use: `const { vibrate } = useVibration(); vibrate(50);`

- **dateFormatters** (`src/utils/dateFormatters.ts`)
  - Purpose: Human-readable timestamps
  - How to Use: `formatMessageTimestamp(date)`

### Patterns to Follow

- **Optimistic Updates**: Reference `messagesSlice.ts` for implementation
- **Signed URL Caching**: Reference `loveNoteImageService.ts` for LRU cache

---

## Implementation Notes

### Code Quality Observations

- Well-documented with JSDoc comments
- Consistent XSS sanitization across components
- Proper cleanup in useEffect hooks
- Memoization used appropriately for virtualization

### TODOs and Future Work

- No explicit TODOs in codebase
- Potential: Pinch-to-zoom for full-screen images (MVP deferred)
- Potential: Message reactions/emojis

### Known Issues

- postgres_changes doesn't work for cross-user updates (using Broadcast)
- Signed URLs expire after 1 hour (mitigated with caching)

### Optimization Opportunities

- Batch signed URL fetching for visible messages
- Service Worker caching for image URLs
- React.lazy for FullScreenImageViewer

### Technical Debt

- `currentDayOffset` marked deprecated but still used for backward compatibility
- Some tests use integration approach instead of pure unit tests

---

## Modification Guidance

### To Add New Functionality

1. Add types to `src/types/models.ts`
2. Add store action to `messagesSlice.ts`
3. Expose via `useLoveNotes` hook
4. Build component in `src/components/love-notes/`
5. Export from barrel file
6. Add unit tests

### To Modify Existing Functionality

1. Check all consumers of the function/component
2. Update types if interface changes
3. Update tests to cover new behavior
4. Run full E2E suite

### To Remove/Deprecate

1. Mark as deprecated with JSDoc
2. Add console.warn in development
3. Update consumers to use replacement
4. Remove after migration period

### Testing Checklist for Changes

- [ ] Unit tests pass (`npm run test:unit`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] XSS sanitization maintained
- [ ] Memory leaks checked (preview URLs cleaned up)
- [ ] Real-time subscription tested with partner

---

_Generated by `document-project` workflow (deep-dive mode)_
_Base Documentation: docs/index.md_
_Scan Date: 2025-12-09_
_Analysis Mode: Exhaustive_
