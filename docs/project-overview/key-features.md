# Key Features

## Daily Love Messages

365 pre-written messages distributed across 5 categories (73 per category):

| Category | Description |
|---|---|
| `reason` | Reasons why you love your partner |
| `memory` | Special memories together |
| `affirmation` | Daily affirmations and encouragement |
| `future` | Dreams and plans for the future |
| `custom` | Miscellaneous custom messages |

Messages rotate daily using a deterministic selection algorithm in `src/utils/messageRotation.ts`. Users can mark messages as favorites, which increases their rotation frequency. The full message library is defined in `src/data/defaultMessages.ts` and lazy-loaded on first run via `src/data/defaultMessagesLoader.ts` to keep the large dataset out of the eager startup path.

A validation script (`scripts/validate-messages.cjs`) verifies:
- Exactly 365 messages total
- 73 messages per category
- No duplicate messages
- Valid category values
- Reasonable length distribution

## Mood Tracking

- 12 emoji mood options with optional text notes
- Daily mood logging stored in IndexedDB with cloud sync to Supabase
- Mood history timeline view for pattern analysis over time
- Background Sync via service worker ensures mood entries are persisted even when the app is closed or the network is unavailable

## Partner Mood View

- Real-time partner mood display using Supabase Realtime subscriptions
- Shows partner's current mood and timestamp
- Automatic updates when partner logs a new mood

## Love Notes Chat

- Real-time messaging between partners via Supabase Realtime
- Message persistence in Supabase Postgres
- Image support via Supabase Storage (`love_note_images` table)
- DOMPurify sanitization for message content to prevent XSS

## Photo Gallery

- Photo upload with captions stored in Supabase Storage
- Grid display with lazy loading via `react-window` and `react-window-infinite-loader`
- Photo carousel view for browsing
- Offline-first: photos are accessible from local cache

## Partner Interactions

- Three interaction types: poke, kiss, fart
- Fun animations and visual feedback via Framer Motion
- Real-time delivery to partner via Supabase Realtime
- Stored in the `interactions` table with RLS policies ensuring privacy

## Scripture Reading

A guided prayer session with 17 scripture steps (all NKJV) organized into 6 section themes:

| Theme | Steps |
|---|---|
| Healing and Restoration | 0-2 |
| Forgiveness and Reconciliation | 3-5 |
| Confession and Repentance | 6-8 |
| God's Faithfulness and Peace | 9-11 |
| The Power of Words | 12-14 |
| Christlike Character | 15-16 |

Each step presents a Bible verse and a couple-focused response prayer. The reading flow supports:

- **Solo mode** -- Individual reading at your own pace
- **Together mode** -- Synchronized reading with partner (planned, Epic 4)
- Per-step reflections with 1-5 rating scale
- Verse bookmarking during sessions
- End-of-session reflection summary with standout verse selection and session rating
- Daily prayer report generation and partner delivery
- Save and resume support with optimistic UI
- Accessibility: keyboard navigation, screen reader support, reduced motion compliance

Data is stored across `scripture_sessions`, `scripture_step_states`, `scripture_reflections`, `scripture_bookmarks`, and `scripture_messages` tables. Static verse data lives in `src/data/scriptureSteps.ts`.

## Settings and Configuration

- Partner name configuration (displayed throughout the app)
- Relationship start date (used for anniversary countdown and duration counter)
- Theme selection from 4 available themes
- Pre-configured mode via `src/config/constants.ts` -- when `isPreConfigured` is `true`, no onboarding wizard is shown

```typescript
export const APP_CONFIG = {
  defaultPartnerName: 'Gracie',
  defaultStartDate: '2025-10-18',
  isPreConfigured: true,
} as const;
```

## Themes

Four visual themes defined in `src/utils/themes.ts` and extended in `tailwind.config.js`:

| Theme | Primary Colors | Hex |
|---|---|---|
| Sunset | Rose/coral gradient | #FF6B9D |
| Ocean | Teal/emerald | #14b8a6 |
| Lavender | Purple | #a855f7 |
| Rose | Pink/rose | #f43f5e |

Custom Tailwind extensions include:
- **Font families**: Inter (sans), Playfair Display (serif), Dancing Script (cursive)
- **Animations**: float, fade-in, scale-in, slide-up, pulse-slow, heart-beat, shimmer
- **Color palettes**: sunset, coral, ocean, lavender, rose (each with 50-900 shades)

## Anniversary Countdown

Real-time countdown timers to special dates with celebration animations powered by Framer Motion.

## PWA Support

- Installable on iOS (Safari "Add to Home Screen") and Android (Chrome "Install App")
- Offline functionality via custom service worker with InjectManifest strategy
- Precaching for static assets (images and fonts only)
- Runtime caching: NetworkFirst for navigation/API, CacheFirst for images/fonts
- PWA manifest: theme color `#FF6B9D`, background color `#FFE5EC`, standalone display, portrait orientation
- Auto-update registration via `workbox-window`

## Privacy and Security

- Row Level Security (RLS) enabled on all Supabase tables
- Policies ensure only the two linked partner users can access their shared data
- DOMPurify sanitization for user-generated HTML content
- Encrypted environment variables (dotenvx) -- secrets never committed in plaintext
- CodeQL security analysis configured with `security-extended` and `security-and-quality` query suites
