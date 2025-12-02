# My-Love PWA Architecture

> **Document Version:** 2.0 (Platform Pivot Update)
> **Last Updated:** 2025-11-17
> **Status:** Partially updated - Core sections reflect PWA stack, some legacy React Native references remain in ADRs
> **Note:** ADRs at end of document still reference React Native patterns and need full rewrite

## Executive Summary

This architecture document defines the technical decisions for **My-Love PWA**, a Progressive Web App built with React 19 + Vite 7 that provides relationship tracking and communication features. The architecture leverages modern web technologies with Supabase for backend services (Auth, Database, Realtime, Storage), and Zustand for efficient client state management.

The core architectural approach is **online-first with service worker caching** - prioritizing web performance and real-time capabilities over offline-first complexity. This decision aligns with the two-person intimate scale of the application and the user's expectation of reliable network connectivity.

## Existing Project Stack

**The current PWA is built with:**

```bash
# Core Stack (already in place)
- React 19.1.1
- Vite 7.1.7 (build tool)
- TypeScript 5.9 (strict mode)
- Tailwind CSS 3.4.18
- Framer Motion 12.23.24
```

This establishes the base architecture with:

- TypeScript support (type safety across codebase)
- Vite for fast development and optimized builds
- React Router or similar for navigation
- Modern bundler with tree-shaking
- PWA support via vite-plugin-pwa

**Existing dependencies:**

```bash
# Already installed
@supabase/supabase-js ^2.81.1
zustand ^5.0.8
idb ^8.0.3
lucide-react ^0.548.0
workbox-window ^7.3.0
zod ^3.25.76
```

## Decision Summary

| Category       | Decision               | Version           | Affects FR Categories                 | Rationale                                         |
| -------------- | ---------------------- | ----------------- | ------------------------------------- | ------------------------------------------------- |
| Framework      | React + Vite           | 19.1.1 / 7.1.7    | All FRs                               | Modern build tool, fast HMR, optimized bundles    |
| Language       | TypeScript             | 5.9 (strict mode) | All FRs                               | Type safety, IDE support, maintainability         |
| Navigation     | React Router/Custom    | TBD               | FR4, FR18, FR59                       | SPA routing with hash or history API              |
| Backend        | Supabase               | 2.81+             | FR1-6, FR7-13, FR22-28, FR29-35, FR65 | Auth, Database, Realtime, Storage in one platform |
| Client State   | Zustand                | 5.0.8             | FR7-13, FR22-28, FR55-59, FR63        | Lightweight state management, optimistic updates  |
| Local Storage  | IndexedDB/localStorage | idb 8.0.3         | FR48-54, FR62                         | Web storage APIs, preferences persistence         |
| UI Framework   | Tailwind CSS           | 3.4.18            | All UI FRs                            | Utility-first CSS, responsive design, theming     |
| Animations     | Framer Motion          | 12.23.24          | All UI FRs                            | Declarative animations, gestures                  |
| Notifications  | Web Push API           | Browser native    | FR14-21                               | Service worker push notifications                 |
| Authentication | Supabase Auth          | 2.81+             | FR1-6                                 | Email/password, Google OAuth, session management  |
| Real-time      | Supabase Realtime      | 2.81+             | FR8-9, FR15                           | WebSocket subscriptions for Love Notes            |
| File Storage   | Supabase Storage       | 2.81+             | FR29-35                               | Photo uploads with RLS policies                   |
| Vibration      | Vibration API          | Browser native    | FR13, FR27, FR43                      | Mobile browser tactile feedback                   |
| Image Handling | File API + Canvas      | Browser native    | FR29-35                               | File selection, client-side compression           |
| Icons          | Lucide React           | 0.548.0           | All UI FRs                            | Consistent icon set                               |

## Project Structure

```
my-love/
├── public/                           # Static assets
│   ├── favicon.ico
│   ├── manifest.json                 # PWA manifest
│   └── icons/                        # PWA icons (192x192, 512x512)
├── src/
│   ├── main.tsx                      # App entry point
│   ├── App.tsx                       # Root component with providers
│   ├── vite-env.d.ts                 # Vite type declarations
│   ├── index.css                     # Global styles + Tailwind imports
│   ├── components/
│   │   ├── ui/                       # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── love-notes/
│   │   │   ├── LoveNoteMessage.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── MessageInput.tsx
│   │   ├── mood/
│   │   │   ├── MoodEmojiPicker.tsx
│   │   │   ├── MoodHistoryItem.tsx
│   │   │   └── PartnerMoodDisplay.tsx
│   │   ├── photos/
│   │   │   ├── PhotoThumbnail.tsx
│   │   │   ├── PhotoViewer.tsx
│   │   │   └── PhotoUploader.tsx
│   │   └── shared/
│   │       ├── DaysTogetherCounter.tsx
│   │       ├── FeatureListItem.tsx
│   │       ├── NotificationBadge.tsx
│   │       └── StatusIndicator.tsx
│   ├── pages/                        # Page components (routes)
│   │   ├── Home.tsx                  # Dashboard/Feature Hub
│   │   ├── Login.tsx                 # Email/password + OAuth login
│   │   ├── Notes.tsx                 # Love Notes chat
│   │   ├── Mood.tsx                  # Mood tracker
│   │   ├── Photos.tsx                # Photo gallery
│   │   ├── Settings.tsx              # Settings & preferences
│   │   └── NotFound.tsx              # 404 handler
│   ├── hooks/
│   │   ├── useAuth.ts                # Supabase auth hook
│   │   ├── useLoveNotes.ts           # Love Notes state hook
│   │   ├── useMood.ts                # Mood tracking hook
│   │   ├── usePhotos.ts              # Photo gallery hook
│   │   ├── useNotifications.ts       # Web Push notification hook
│   │   ├── usePartner.ts             # Partner data hook
│   │   └── useVibration.ts           # Vibration API hook
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client configuration
│   │   ├── store.ts                  # Zustand store setup
│   │   ├── storage.ts                # IndexedDB/localStorage wrapper
│   │   └── notifications.ts          # Web Push handlers
│   ├── stores/                       # Zustand state slices
│   │   ├── authStore.ts              # Auth state
│   │   ├── notesStore.ts             # Love Notes state
│   │   ├── moodStore.ts              # Mood state
│   │   └── settingsStore.ts          # User preferences
│   ├── theme/
│   │   ├── tokens.ts                 # Design tokens (colors, spacing)
│   │   └── tailwind.config.ts        # Tailwind theme configuration
│   ├── types/
│   │   ├── database.ts               # Supabase generated types
│   │   ├── routes.ts                 # Route parameter types
│   │   └── models.ts                 # Domain model types
│   └── utils/
│       ├── date.ts                   # Date formatting utilities
│       ├── validation.ts             # Input validation (Zod)
│       └── compression.ts            # Image compression (Canvas API)
├── tests/                            # Test files
│   ├── components/
│   ├── hooks/
│   └── utils/
├── scripts/                          # Build and deployment scripts
│   ├── dev-with-cleanup.sh
│   └── smoke-tests.cjs
├── vite.config.ts                    # Vite configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── postcss.config.js                 # PostCSS configuration
├── tsconfig.json                     # TypeScript configuration
├── eslint.config.js                  # ESLint configuration
├── playwright.config.ts              # E2E test configuration
├── vitest.config.ts                  # Unit test configuration
├── package.json
└── README.md
```

## FR Category to Architecture Mapping

| FR Category                               | Architecture Components                                                                         | Key Technologies                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **User Account & Authentication** (FR1-6) | `src/pages/Login.tsx`, `src/hooks/useAuth.ts`, `src/lib/supabase.ts`, `src/stores/authStore.ts` | Supabase Auth, URL redirects, localStorage     |
| **Love Notes** (FR7-13)                   | `src/pages/Notes.tsx`, `src/components/love-notes/*`, `src/hooks/useLoveNotes.ts`               | Supabase Realtime, Zustand, Vibration API      |
| **Push Notifications** (FR14-21)          | `src/lib/notifications.ts`, `src/hooks/useNotifications.ts`, Service Worker                     | Web Push API, Supabase Edge Functions          |
| **Mood Tracking** (FR22-28)               | `src/pages/Mood.tsx`, `src/components/mood/*`, `src/hooks/useMood.ts`                           | Supabase Database, Zustand, Vibration API      |
| **Photo Gallery** (FR29-35)               | `src/pages/Photos.tsx`, `src/components/photos/*`, `src/hooks/usePhotos.ts`                     | Supabase Storage, File API, Canvas compression |
| **Daily Love Messages** (FR36-39)         | `src/pages/Home.tsx`, `src/hooks/useDailyMessage.ts`                                            | Supabase Database, Web Push API                |
| **Partner Interactions** (FR40-44)        | `src/hooks/usePartner.ts`, `src/components/shared/*`                                            | Supabase Database, Vibration API               |
| **Anniversary & Milestones** (FR45-47)    | `src/components/shared/DaysTogetherCounter.tsx`, `src/hooks/usePartner.ts`                      | Supabase Database, Web Push API                |
| **Settings & Preferences** (FR48-54)      | `src/pages/Settings.tsx`, `src/lib/storage.ts`, `src/stores/settingsStore.ts`                   | localStorage/IndexedDB, Tailwind CSS           |
| **Dashboard & Overview** (FR55-59)        | `src/pages/Home.tsx`, `src/components/shared/*`                                                 | Zustand (aggregated state)                     |
| **Technical Platform** (FR60-65)          | `vite.config.ts`, `public/manifest.json`, `src/lib/*`, Service Worker                           | Vite, vite-plugin-pwa, Supabase RLS            |

## Technology Stack Details

### Core Technologies

**React 19 + Vite 7**

- Modern React with concurrent features
- Vite for instant HMR and optimized production builds
- ESBuild for fast TypeScript compilation
- Rollup for production bundling with tree-shaking
- GitHub Pages deployment via gh-pages package

**Supabase Backend (Self-contained platform)**

- **Auth**: Email/password and Google OAuth authentication
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Realtime**: WebSocket subscriptions for Love Notes
- **Storage**: Photo uploads with access policies
- **Edge Functions**: Scheduled notifications (cron jobs)

**Zustand v5**

- Lightweight client state management
- Minimal boilerplate, TypeScript-first
- Optimistic updates for instant UI feedback
- Persistence via localStorage/IndexedDB
- No provider wrapping required

**Tailwind CSS v3 + Framer Motion**

- Utility-first CSS framework
- Full theming support via configuration
- Responsive design out of the box
- Dark mode support (class-based)
- Declarative animations and gestures

### Integration Points

**Authentication Flow:**

```
User → Login Screen → Email/Password or Google OAuth → Supabase Auth → Session Established → Home Screen
```

**Love Notes Real-time Flow:**

```
User Sends → Optimistic UI Update → Supabase Insert → Realtime Broadcast → Partner Receives → Web Push Notification
```

**Data Synchronization:**

```
Page Focus → Zustand Store Refresh → Supabase Queries → State Update → UI Re-render
```

**Web Push Notification Flow:**

```
Supabase Edge Function (cron) → Web Push Service → Service Worker → Browser Notification → Click Handler → Screen Navigation
```

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

### API Response Pattern

```typescript
// Standard API response wrapper
interface ApiResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

// Usage in hooks
const { data, error } = await supabase
  .from('love_notes')
  .select('*')
  .order('created_at', { ascending: false });
```

### Zustand Store Pattern

```typescript
// Zustand store with TypeScript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LoveNotesState {
  notes: LoveNote[];
  isLoading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  sendNote: (message: string) => Promise<void>;
}

export const useLoveNotesStore = create<LoveNotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      isLoading: false,
      error: null,

      fetchNotes: async () => {
        set({ isLoading: true, error: null });
        const { data, error } = await supabase
          .from('love_notes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          set({ error: error.message, isLoading: false });
        } else {
          set({ notes: data, isLoading: false });
        }
      },

      sendNote: async (message: string) => {
        // Optimistic update
        const tempNote = {
          id: 'temp',
          content: message,
          created_at: new Date().toISOString(),
          sending: true,
        };
        set((state) => ({ notes: [tempNote, ...state.notes] }));

        const { data, error } = await supabase
          .from('love_notes')
          .insert({ content: message })
          .select()
          .single();

        if (error) {
          // Rollback on error
          set((state) => ({
            notes: state.notes.filter((n) => n.id !== 'temp'),
            error: error.message,
          }));
        } else {
          // Replace temp with real note
          set((state) => ({
            notes: state.notes.map((n) => (n.id === 'temp' ? data : n)),
          }));
        }
      },
    }),
    { name: 'love-notes-storage' }
  )
);

// Hook usage
export const useLoveNotes = () => {
  const { notes, isLoading, error, fetchNotes, sendNote } = useLoveNotesStore();

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return { notes, isLoading, error, sendNote };
};
```

### Supabase Realtime Pattern

```typescript
// Real-time subscription setup
useEffect(() => {
  const channel = supabase
    .channel('love-notes-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'love_notes',
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => {
        useLoveNotesStore.getState().fetchNotes();
        triggerVibration('receive');
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

### Component Pattern

```typescript
// Tailwind component with vibration feedback
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  loading = false,
}) => {
  const { triggerVibration } = useVibration();

  const handleClick = () => {
    triggerVibration('tap');
    onClick();
  };

  const variantClasses = {
    primary: 'bg-pink-500 hover:bg-pink-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    destructive: 'bg-red-500 hover:bg-red-600 text-white',
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${variantClasses[variant]} disabled:opacity-50`}
    >
      {loading ? <LoadingSpinner /> : children}
    </button>
  );
};
```

### Error Handling Pattern

```typescript
// Centralized error handler
export const handleError = (error: unknown): string => {
  if (error instanceof PostgrestError) {
    return mapPostgrestError(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
};

// User-friendly error mapping
const mapPostgrestError = (error: PostgrestError): string => {
  switch (error.code) {
    case '23505': return 'This entry already exists.';
    case '42501': return 'You do not have permission to perform this action.';
    case 'PGRST301': return 'Unable to connect. Please check your internet connection.';
    default: return 'Something went wrong. Please try again.';
  }
};

// Error boundary component
export const ErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({
  error,
  resetError,
}) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>{handleError(error)}</Text>
    <ThemedButton onPress={resetError}>Try Again</ThemedButton>
  </View>
);
```

## Consistency Rules

### Naming Conventions

**Files and Directories:**

- Components: PascalCase (e.g., `LoveNoteMessage.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useLoveNotes.ts`)
- Utilities: camelCase (e.g., `dateFormatter.ts`)
- Types: PascalCase (e.g., `LoveNote.ts`)
- Test files: `*.test.ts` or `*.test.tsx` (co-located in `__tests__/`)

**TypeScript:**

- Interfaces: PascalCase, no `I` prefix (e.g., `LoveNote`, not `ILoveNote`)
- Types: PascalCase (e.g., `MoodType`)
- Enums: PascalCase with PascalCase values (e.g., `MoodCategory.Happy`)
- Functions: camelCase (e.g., `sendLoveNote`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_MESSAGE_LENGTH`)

**Supabase Database:**

- Tables: snake_case plural (e.g., `love_notes`, `mood_entries`)
- Columns: snake_case (e.g., `created_at`, `user_id`)
- Foreign keys: `{table}_id` pattern (e.g., `sender_id`, `receiver_id`)

**React Native Paper Components:**

- Theme tokens reference: `theme.colors.primary`, `theme.spacing.md`
- Style objects: `StyleSheet.create()` at bottom of file
- Style naming: camelCase (e.g., `container`, `messageText`)

### Code Organization

**Import Order (enforced by ESLint):**

1. React/React Native imports
2. Third-party libraries (alphabetical)
3. Internal absolute imports (`@/` or `src/`)
4. Relative imports
5. Type imports (last)

```typescript
// Example import structure
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { ThemedCard } from '@/components/core/ThemedCard';
import { useLoveNotes } from '@/hooks/useLoveNotes';
import { supabase } from '@/lib/supabase';

import type { LoveNote } from '@/types/models';
```

**Component Structure:**

1. Type definitions (interfaces/types)
2. Component function
3. Hook calls (useQuery, useState, etc.)
4. Event handlers
5. JSX return
6. StyleSheet at bottom

**Hook Structure:**

1. Query/mutation setup
2. Error handling
3. Return object with data, loading, error states

### Error Handling

**Error Types:**

- **Network errors**: Show offline banner, allow retry
- **Validation errors**: Inline field errors, red border, error text below input
- **Server errors**: Toast notification with retry option
- **Auth errors**: Redirect to login with message

**Error Display Pattern:**

```typescript
// Toast for transient errors
showToast({
  type: 'error',
  message: handleError(error),
  duration: 5000,
  action: { label: 'Retry', onPress: retryAction },
});

// Inline for validation
<TextInput
  error={!!validationError}
  errorText={validationError}
/>
```

**Retry Logic:**

- Automatic retry: 3 attempts with exponential backoff (1s, 2s, 4s)
- Manual retry: Show retry button after automatic attempts fail
- No retry: Auth errors, validation errors

### Logging Strategy

**Log Levels:**

- `error`: Caught exceptions, failed API calls, critical failures
- `warn`: Degraded functionality, fallback paths, non-critical issues
- `info`: User actions, feature usage, lifecycle events
- `debug`: Development-only detailed traces

**Log Format:**

```typescript
// Structured logging
const logger = {
  error: (message: string, context?: object) => {
    console.error(`[ERROR] ${message}`, context);
    // In production: send to error tracking service (e.g., Sentry)
  },
  warn: (message: string, context?: object) => {
    console.warn(`[WARN] ${message}`, context);
  },
  info: (message: string, context?: object) => {
    if (__DEV__) console.info(`[INFO] ${message}`, context);
  },
  debug: (message: string, context?: object) => {
    if (__DEV__) console.debug(`[DEBUG] ${message}`, context);
  },
};

// Usage
logger.info('Love note sent', { messageId: note.id });
logger.error('Failed to send love note', { error, messageContent });
```

**What to Log:**

- User authentication events (login, logout)
- Feature interactions (mood logged, note sent, photo uploaded)
- Error occurrences with context
- Real-time connection status changes
- Push notification received/tapped

**Privacy Compliance:**

- Never log message content or mood details
- Log only IDs and metadata
- No sensitive user data in logs

## Data Architecture

### Supabase Schema (Additions to Existing)

**New Table: love_notes**

```sql
CREATE TABLE love_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  read_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE love_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON love_notes FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own messages"
  ON love_notes FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
```

**Existing Tables (from web PWA):**

- `mood_entries`: Already has user_id, mood_type, note, created_at
- `photos`: Already has user_id, url, caption, created_at
- `user_profiles`: Add `push_token` column for notification delivery
- `partner_relationships`: Existing two-user relationship mapping

**Push Token Storage:**

```sql
ALTER TABLE user_profiles
ADD COLUMN push_token TEXT;
```

### Domain Models

```typescript
// src/types/models.ts
export interface LoveNote {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export interface MoodEntry {
  id: string;
  user_id: string;
  mood_type: MoodType;
  note: string | null;
  created_at: string;
}

export type MoodType =
  | 'happy'
  | 'sad'
  | 'excited'
  | 'anxious'
  | 'calm'
  | 'angry'
  | 'loving'
  | 'grateful'
  | 'tired'
  | 'energetic'
  | 'confused'
  | 'hopeful';

export interface Photo {
  id: string;
  user_id: string;
  url: string;
  caption: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  partner_id: string;
  push_token: string | null;
  created_at: string;
}
```

## API Contracts

### Supabase Client Patterns

**Authentication:**

```typescript
// Email/password sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: userEmail,
  password: userPassword,
});

// Google OAuth sign in
const { error: oauthError } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin },
});

// Session check
const {
  data: { session },
} = await supabase.auth.getSession();

// Sign out
await supabase.auth.signOut();
```

**Database Queries:**

```typescript
// Insert love note
const { data, error } = await supabase
  .from('love_notes')
  .insert({
    content: messageText,
    receiver_id: partnerId,
  })
  .select()
  .single();

// Fetch mood history
const { data, error } = await supabase
  .from('mood_entries')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50);

// Upload photo
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('photos')
  .upload(`${userId}/${fileName}`, compressedImage);
```

**Real-time Subscriptions:**

```typescript
// Subscribe to new love notes
const channel = supabase
  .channel('love-notes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'love_notes',
      filter: `receiver_id=eq.${userId}`,
    },
    handleNewMessage
  )
  .subscribe();
```

### Deep Link Schema

```
mylove://                           # App scheme
mylove://auth/callback              # OAuth callback
mylove://notes                      # Love Notes screen
mylove://notes?id={noteId}          # Specific note
mylove://mood                       # Mood tracker screen
mylove://message                    # Daily message screen
mylove://photos                     # Photo gallery
```

**Expo Router Configuration:**

```typescript
// app.json
{
  "expo": {
    "scheme": "mylove",
    "plugins": [
      [
        "expo-router",
        {
          "origin": "https://mylove.app"
        }
      ]
    ]
  }
}
```

## Security Architecture

### Authentication & Authorization

**Authentication Flow:**

1. User enters email/password on login screen OR taps Google OAuth button
2. Supabase validates credentials or processes OAuth callback
3. On success, JWT session token returned
4. Session stored in localStorage (browser storage)
5. Session auto-refreshes until 30-day inactivity timeout

**Session Management:**

- Tokens stored in SecureStore (not plain storage)
- Session refresh handled by Supabase client automatically
- Logout clears all local storage and SecureStore
- No password storage on device

**Row Level Security (RLS):**

- Every table has RLS enabled
- Users can only access their own data and partner's shared data
- Partner relationship verified server-side
- No client-side security decisions

### Data Protection

**In Transit:**

- All Supabase connections over HTTPS/TLS 1.3
- WebSocket connections encrypted
- Push notification payloads contain only IDs (not message content)

**At Rest:**

- Supabase encrypts database at rest
- Photos stored with Supabase Storage access policies
- Local preferences (MMKV) in app sandbox
- Session tokens in device keychain/keystore

**Input Validation:**

- Love Notes: Max 1000 characters
- Mood notes: Max 200 characters
- Photos: Max 10MB, image types only (JPEG, PNG, HEIC)
- XSS prevention: No HTML rendering, text-only display

## Performance Considerations

### Critical Performance Targets (from NFRs)

| Metric                | Target       | Implementation Strategy                                       |
| --------------------- | ------------ | ------------------------------------------------------------- |
| App Launch (cold)     | < 2 seconds  | Minimal bundle size, lazy loading, no heavy initialization    |
| App Launch (warm)     | < 500ms      | Fast resume from background                                   |
| Screen Transitions    | < 300ms      | Native navigation animations, minimal JS overhead             |
| Mood Log (end-to-end) | < 5 seconds  | Single-tap selection, optimistic update, fast Supabase insert |
| Love Note Delivery    | < 2 seconds  | Supabase Realtime instant broadcast + push notification       |
| Image Upload          | < 10 seconds | Client-side compression, progress indicator                   |
| Memory Footprint      | < 150MB      | Image virtualization, no memory leaks                         |

### Optimization Strategies

**Code Splitting:**

- Expo Router automatic route-based splitting
- Lazy load heavy components (PhotoViewer, MoodHistory)
- Tree-shaking unused React Native Paper components

**Image Optimization:**

- Client-side compression before upload (max 1MB)
- Thumbnail generation for gallery grid
- Progressive loading with blur placeholder
- FlashList for virtualized image grids

**Query Optimization:**

- TanStack Query caching (stale-while-revalidate)
- Background refetch on app focus
- Optimistic updates for immediate UI feedback
- Query key invalidation on mutations

**React Native Performance:**

- Use `memo()` for expensive components
- Avoid inline functions in render
- Use native driver for animations
- Measure with Flipper and React DevTools

## Deployment Architecture

### Development Workflow

1. **Local Development**: `npx expo start` with Expo Go (limited - no push notifications)
2. **Development Build**: `eas build --profile development` for physical device testing
3. **Preview Build**: `eas build --profile preview` for beta testing
4. **Production Build**: `eas build --profile production` for App Store/Google Play

### EAS Build Configuration

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "frank@example.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account.json"
      }
    }
  }
}
```

### App Store Submission

**iOS (TestFlight/App Store):**

- Bundle ID: `com.mylove.app`
- Privacy Policy URL required
- App Store Privacy Labels completed
- Age Rating: 4+ (no objectionable content)
- Category: Lifestyle

**Android (Google Play):**

- Package: `com.mylove.app`
- Data Safety section completed
- Content Rating: Everyone
- Target API 34 (Android 14)

## Development Environment

### Prerequisites

- Node.js 20+ (LTS)
- npm 10+ or yarn 1.22+
- Git
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Xcode 15+ (for iOS builds, macOS only)
- Android Studio (for Android builds)
- Physical device recommended for push notification testing

### Setup Commands

```bash
# Clone repository
git clone https://github.com/yourname/my-love-mobile.git
cd my-love-mobile

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials:
# EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Start development server
npx expo start

# Create development build (for push notifications testing)
eas build --profile development --platform ios
eas build --profile development --platform android

# Run on specific platform
npx expo start --ios
npx expo start --android

# Generate Supabase types
npx supabase gen types typescript --project-id your-project-id > src/types/database.ts

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

### Environment Variables

```bash
# .env.local (not committed to git)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_APP_SCHEME=mylove
```

### Development vs Production Differences

| Aspect             | Development                                  | Production                      |
| ------------------ | -------------------------------------------- | ------------------------------- |
| Push Notifications | Not available in Expo Go; requires dev build | Full support via EAS            |
| Deep Linking       | localhost testing                            | Production URL scheme           |
| Error Reporting    | Console logging                              | Error tracking service (Sentry) |
| Supabase           | Local or dev project                         | Production project              |
| Build              | `expo start`                                 | EAS Build production profile    |

## Architecture Decision Records (ADRs)

### ADR 001: Online-First Architecture (Not Offline-First)

**Context:** The user expects reliable network connectivity and wants to avoid the complexity of offline-first sync (PowerSync).

**Decision:** Implement online-first with TanStack Query caching for performance optimization, not offline data persistence.

**Rationale:**

- User stated: "I expect to really never be offline"
- Eliminates conflict resolution complexity
- TanStack Query provides smart caching without sync overhead
- Reduces technical complexity and development time
- Graceful degradation (show cached data, fail writes) is acceptable

**Consequences:**

- Writes fail immediately when offline (no queue)
- Cached data may be stale (marked as such)
- Requires reliable network for full functionality
- Simpler architecture and maintenance

### ADR 002: React Native Paper for UI Components

**Context:** Need a design system that supports the "Love" theme aesthetic while providing accessibility and native performance.

**Decision:** Use React Native Paper with heavy theming customization for Coral Heart color palette.

**Rationale:**

- Material Design 3 supports dynamic theming
- Accessibility defaults (WCAG AA) out of the box
- Comprehensive component library covers all MVP needs
- Active maintenance and TypeScript support
- Customizable enough for romantic aesthetic

**Consequences:**

- Need to override default Material colors
- Some components may need wrapping for haptic feedback
- Follows Material Design patterns (familiar to Android users)
- iOS users get cross-platform consistency, not native iOS look

### ADR 003: Supabase Realtime for Love Notes

**Context:** Love Notes require real-time delivery with push notification integration.

**Decision:** Use Supabase Realtime WebSocket subscriptions for instant message delivery.

**Rationale:**

- Already using Supabase for backend
- WebSocket subscriptions are included in Supabase plan
- Integrates naturally with RLS security model
- Simpler than adding separate real-time service
- Combined with push notifications for offline delivery

**Consequences:**

- Need to handle WebSocket reconnection on network changes
- Must manage subscription lifecycle (subscribe/unsubscribe)
- Depends on Supabase service availability
- In-app notification history as fallback for missed messages

### ADR 004: Expo Router for Navigation

**Context:** Need file-based routing with deep linking support for OAuth callbacks and notification navigation.

**Decision:** Use Expo Router (file-based navigation built on React Navigation).

**Rationale:**

- File-system based routing reduces boilerplate
- Native deep linking support for OAuth callbacks
- TypeScript route parameter typing
- Integrates with Expo SDK ecosystem
- Automatic code splitting by route

**Consequences:**

- Route structure determined by file structure
- Less flexibility than pure React Navigation (but sufficient for this app)
- Must follow Expo Router conventions
- Benefits from Expo ecosystem updates

### ADR 005: MMKV for Local Storage

**Context:** Need fast local storage for user preferences and cached data.

**Decision:** Use react-native-mmkv v4 (Nitro Module) instead of AsyncStorage.

**Rationale:**

- ~30x faster than AsyncStorage
- Synchronous API for preferences
- Small storage footprint
- Native integration (Nitro Module in v4)
- Suitable for non-sensitive local data

**Consequences:**

- New Architecture requirement (TurboModules)
- Migration from AsyncStorage if coming from web PWA patterns
- Not for sensitive data (use SecureStore for tokens)
- Additional native dependency

### ADR 006: TanStack Query for Server State

**Context:** Need to manage server state with caching, background sync, and optimistic updates.

**Decision:** Use TanStack Query v5 instead of Redux or Zustand for server state.

**Rationale:**

- Purpose-built for server state management
- Automatic caching with configurable stale time
- Optimistic updates for instant UI feedback
- Background refetch on app focus
- No global store boilerplate for server data

**Consequences:**

- Separate concern from local/UI state
- Learning curve for query key patterns
- Must manage query invalidation properly
- Integrates well with Supabase client

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2025-11-16_
_For: Frank_
