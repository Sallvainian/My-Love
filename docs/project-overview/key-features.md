# Key Features

## Feature Summary

| Feature            | Data Pattern   | Primary Storage            | Sync Target      | Realtime Channel            |
| ------------------ | -------------- | -------------------------- | ---------------- | --------------------------- |
| Daily Messages     | Offline-first  | IndexedDB `messages` store | N/A (local only) | None                        |
| Mood Tracking      | Offline-first  | IndexedDB `moods` store    | Supabase `moods` | Broadcast API (partner)     |
| Photo Gallery      | Supabase-first | Supabase Storage `photos`  | N/A (direct)     | None                        |
| Love Notes Chat    | Supabase-first | Supabase `love_notes`      | N/A (direct)     | Broadcast API (partner)     |
| Scripture Reading  | Online-first   | Supabase + IDB cache       | Supabase RPCs    | Broadcast + Presence        |
| Poke/Kiss          | Supabase-first | Supabase `interactions`    | N/A (direct)     | `postgres_changes` (INSERT) |
| Settings/Theme     | Local-only     | localStorage (persist)     | N/A              | None                        |
| Partner Management | Supabase-first | Supabase `users`/RPCs      | N/A (direct)     | None                        |

## Daily Love Messages

365 pre-written messages distributed across 5 categories (73 per category):

| Category      | Description                          |
| ------------- | ------------------------------------ |
| `reason`      | Reasons why you love your partner    |
| `memory`      | Special memories together            |
| `affirmation` | Daily affirmations and encouragement |
| `future`      | Dreams and plans for the future      |
| `custom`      | Miscellaneous custom messages        |

Messages rotate daily using a deterministic selection algorithm in `src/utils/messageRotation.ts`. Users can mark messages as favorites, which increases their rotation frequency. The full message library is defined in `src/data/defaultMessages.ts` and lazy-loaded on first run via `src/data/defaultMessagesLoader.ts` to keep the large dataset out of the eager startup path.

A validation script (`scripts/validate-messages.cjs`) verifies:

- Exactly 365 messages total
- 73 messages per category
- No duplicate messages
- Valid category values
- Reasonable length distribution

### Custom Messages

Users can create, edit, and delete custom messages via the Admin Panel (accessible at `/admin`). Custom messages are stored in IndexedDB alongside default messages. Import/export as JSON is supported for backup and sharing. All custom message operations are validated with Zod schemas (`CreateMessageInputSchema`, `UpdateMessageInputSchema`).

## Mood Tracking

- 12 emoji mood options (loved, happy, content, excited, thoughtful, grateful, sad, anxious, frustrated, angry, lonely, tired) with multi-mood selection support
- Optional text notes per mood entry (max 200 characters)
- Daily mood logging stored in IndexedDB with cloud sync to Supabase
- Mood history timeline view for pattern analysis over time
- Calendar view (`MoodHistoryCalendar`) with per-day mood display and detail modal
- Partner mood display via Supabase Broadcast realtime
- Three-tier sync: immediate (on create), periodic (5 min interval), Background Sync API (service worker)
- Offline-first: entries created in IndexedDB with `synced: false`, synced asynchronously
- Paginated history fetch via `useMoodHistory` hook with cursor-based pagination

## Partner Mood View

- Real-time partner mood display using Supabase Broadcast channels
- Shows partner's current mood and timestamp
- Automatic updates when partner logs a new mood
- Connection status indicator (connecting, connected, disconnected)
- Poke/kiss interaction interface integrated into partner view

## Love Notes Chat

- Real-time bidirectional messaging between partners via Supabase Broadcast
- Message persistence in Supabase Postgres (`love_notes` table)
- Image attachments with client-side compression (Canvas API, max 2048px, 80% JPEG quality)
- Edge Function upload for images (`upload-love-note-image`)
- DOMPurify sanitization for all message content (XSS prevention, no HTML tags allowed)
- Client-side rate limiting (10 messages per minute)
- Optimistic UI with temporary IDs, replaced on server confirmation
- Virtualized message list via react-window for performance
- Full-screen image viewer for attachments
- Signed URL caching with LRU eviction (max 100 entries, 1-hour expiry)
- Retry mechanism for failed messages
- Blob URL memory management for image attachments

## Photo Gallery

- Grid view with lazy-loaded thumbnails (`PhotoGridItem`, `PhotoGridSkeleton`)
- Full-screen photo viewer and carousel (`PhotoViewer`, `PhotoCarousel`)
- Photo upload with client-side compression (Canvas API, max 2048px, 80% JPEG quality)
- File validation: max 25MB, allowed MIME types (JPEG, PNG, WebP)
- Captions (max 500 chars) and tags per photo
- Edit modal for updating captions/tags
- Delete confirmation dialog
- Storage quota monitoring (80% warning, 95% upload block)
- Photos stored in Supabase Storage with signed URLs (1-hour expiry)
- Upload progress tracking in `PhotosSlice`

## Partner Interactions

- Two interaction types: poke, kiss
- Fun animations and visual feedback via Framer Motion
- Real-time delivery to partner via Supabase `postgres_changes` subscriptions
- Interaction history timeline with viewed/unviewed status
- UUID and interaction type validation before send (`interactionValidation.ts`)
- Haptic feedback via `useVibration` hook
- Stored in the `interactions` table with RLS policies ensuring privacy

## Scripture Reading

A guided prayer session with 17 scripture steps (all NKJV) organized into 6 section themes:

| Theme                          | Steps |
| ------------------------------ | ----- |
| Healing and Restoration        | 0-2   |
| Forgiveness and Reconciliation | 3-5   |
| Confession and Repentance      | 6-8   |
| God's Faithfulness and Peace   | 9-11  |
| The Power of Words             | 12-14 |
| Christlike Character           | 15-16 |

Each step presents a Bible verse and a couple-focused response prayer. The reading flow supports:

- **Solo mode** -- Individual reading at your own pace
- **Together mode** -- Synchronized reading with partner via Supabase Broadcast channels
  - Lobby with Reader/Responder role selection
  - Ready-up system with synchronized 3-second countdown
  - Lock-in mechanism for mutual step advancement
  - Partner position indicators (verse vs response screen, step index)
  - No-shame "Continue solo" fallback from lobby
  - Reconnection handling with graceful degradation to solo mode
  - Disconnection overlay with status feedback
- Per-step reflections with 1-5 rating scale
- Verse bookmarking during sessions with share-with-partner option
- End-of-session reflection summary with standout verse selection and session rating
- Daily prayer report generation and partner delivery via scripture messages
- Save and resume support with optimistic UI
- Couple-aggregate stats dashboard (total sessions, total steps, average rating, bookmark count)
- Accessibility: keyboard navigation, screen reader support, reduced motion compliance

Data is stored across `scripture_sessions`, `scripture_reflections`, `scripture_bookmarks`, and `scripture_messages` tables, plus IndexedDB for offline caching. Static verse data lives in `src/data/scriptureSteps.ts`.

### Scripture Architecture Notes

The scripture feature uses an **online-first** pattern (the inverse of the rest of the app):

- **Supabase is the source of truth.** Writes go to Supabase RPC functions first and throw on failure (no offline queue).
- **IndexedDB is a read cache.** Reads use cache-first with fire-and-forget background refresh.
- **Optimistic UI.** The Zustand slice updates state before server confirmation, with `pendingRetry` state for user-triggered retry on failure.

### Scripture Realtime Channels

- **Broadcast channel** (`scripture-session:{sessionId}`): Private channel for partner_joined, state_updated, session_converted, and lock_in_status_changed events. Managed by `useScriptureBroadcast` hook with exponential backoff retry.
- **Presence channel** (`scripture-presence:{sessionId}`): Ephemeral channel for partner position tracking. 10-second heartbeat, 20-second stale TTL. Managed by `useScripturePresence` hook.

## Settings and Configuration

- Partner name configuration (displayed throughout the app)
- Relationship start date (used for anniversary countdown and duration counter)
- Theme selection from 4 available themes
- Notification time configuration (HH:MM format)
- Font and accent color customization
- Settings validated with Zod `SettingsSchema` before save
- Persisted to localStorage via Zustand persist middleware
- Pre-configured mode via `src/config/constants.ts` -- when `isPreConfigured` is `true`, no onboarding wizard is shown

## Themes

Four visual themes defined in `src/utils/themes.ts` and extended in `tailwind.config.js`:

| Theme    | Primary Colors      | Hex     |
| -------- | ------------------- | ------- |
| Sunset   | Rose/coral gradient | #FF6B9D |
| Ocean    | Teal/emerald        | #14b8a6 |
| Lavender | Purple              | #a855f7 |
| Rose     | Pink/rose           | #f43f5e |

Custom Tailwind extensions include:

- **Font families**: Inter (sans), Playfair Display (serif), Dancing Script (cursive)
- **Animations**: float, fade-in, scale-in, slide-up, pulse-slow, heart-beat, shimmer
- **Color palettes**: sunset, coral, ocean, lavender, rose (each with 50-900 shades)

## Home View Components

The home view is rendered inline in `App.tsx` (not lazy-loaded) to guarantee offline availability. It includes:

- **TimeTogether** -- Real-time duration counter since the relationship start date
- **BirthdayCountdown** -- Countdown timers to each partner's birthday (configured in `src/config/relationshipDates.ts`)
- **EventCountdown** -- Countdown timers for wedding date and upcoming visits
- **DailyMessage** -- The daily love message card with rotation and favorites

## Welcome Splash

A welcome screen displayed on first visit and after every 60 minutes of inactivity (controlled by the `WELCOME_DISPLAY_INTERVAL` constant in `App.tsx`). The splash timestamp is stored in `localStorage` under the `lastWelcomeView` key. The splash can also be triggered manually from the daily message card.

## Network Status and Sync Feedback

- **NetworkStatusIndicator** -- Shows a banner when the device is offline or reconnecting (`showOnlyWhenOffline` mode)
- **SyncToast** -- Displays toast notifications after background sync completion, showing success and failure counts
- **Auto-sync on reconnect** -- When the device comes back online, the app immediately triggers a sync of pending mood entries
- **Service Worker Background Sync listener** -- Listens for `BACKGROUND_SYNC_COMPLETED` messages from the service worker and displays sync results

## PWA Support

- Installable on iOS (Safari "Add to Home Screen") and Android (Chrome "Install App")
- Offline functionality via custom service worker with InjectManifest strategy
- Precaching for JS, CSS, images, and fonts (HTML excluded -- served via NetworkFirst)
- Runtime caching: NetworkFirst for navigation (3s timeout), CacheFirst for images/fonts/Google Fonts
- PWA manifest: theme color `#FF6B9D`, background color `#FFE5EC`, standalone display, portrait orientation
- Auto-update registration via `workbox-window` with immediate reload on new version

## Admin Panel

Accessible via the `/admin` route. Lazy-loaded as `AdminPanel` component. Provides administrative controls including custom message management (create, edit, delete with confirmation dialog). The admin route is detected on initial load in `App.tsx` and renders outside the normal navigation flow.

## Error Tracking

Sentry (`@sentry/react` 10.42.0) provides production error tracking:

- Initialized in `src/config/sentry.ts` with 20% trace sample rate
- PII stripping: only UUIDs reach Sentry (email and IP address removed)
- Filtered errors: chunk load failures, network errors, ResizeObserver noise
- Source maps uploaded during CI build via `@sentry/vite-plugin`, then deleted from dist/
- User context set with user ID and partner ID only

## Privacy and Security

- Row Level Security (RLS) enabled on all Supabase tables
- Policies ensure only the two linked partner users can access their shared data
- DOMPurify sanitization for user-generated content (no HTML tags or attributes allowed)
- Encrypted secrets via fnox with age encryption provider -- ciphertext committed in `fnox.toml`, private keys never in repo
- Zod runtime validation at service boundaries for all data entering or leaving the app
- CodeQL security analysis configured with `security-extended` and `security-and-quality` query suites
- Client-side rate limiting on love notes (10 messages per minute)
