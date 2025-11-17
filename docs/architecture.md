# My-Love Mobile Architecture

## Executive Summary

This architecture document defines the technical decisions for **My-Love Mobile**, a React Native + Expo mobile application that transforms the existing My-Love web PWA into a native mobile experience for iOS and Android. The architecture leverages Expo's managed workflow with SDK 54, Supabase for backend services (Auth, Database, Realtime, Storage), and TanStack Query for efficient server state management.

The core architectural approach is **online-first with smart caching** - prioritizing native performance and real-time capabilities over offline-first complexity. This decision aligns with the two-person intimate scale of the application and the user's expectation of reliable network connectivity.

## Project Initialization

**First implementation story should execute:**

```bash
npx create-expo-app@latest my-love-mobile --template blank-typescript
```

This establishes the base architecture with:

- TypeScript support (type safety across codebase)
- Expo SDK 54 managed workflow
- Expo Router (file-based navigation)
- Metro bundler configuration
- Basic project structure

**Post-initialization setup (same story):**

```bash
cd my-love-mobile
npx expo install expo-router expo-notifications expo-linking expo-secure-store expo-haptics expo-image-picker
npm install @supabase/supabase-js @tanstack/react-query react-native-mmkv react-native-paper react-native-safe-area-context
```

## Decision Summary

| Category        | Decision            | Version            | Affects FR Categories                 | Rationale                                            |
| --------------- | ------------------- | ------------------ | ------------------------------------- | ---------------------------------------------------- |
| Framework       | React Native + Expo | SDK 54 / RN 0.81   | All FRs                               | Managed workflow, cross-platform, native performance |
| Language        | TypeScript          | 5.x (Expo default) | All FRs                               | Type safety, IDE support, maintainability            |
| Navigation      | Expo Router         | ^4.0.0             | FR4, FR18, FR59                       | File-based routing, deep linking support             |
| Backend         | Supabase            | 2.79+              | FR1-6, FR7-13, FR22-28, FR29-35, FR65 | Auth, Database, Realtime, Storage in one platform    |
| Server State    | TanStack Query      | 5.90.9             | FR7-13, FR22-28, FR55-59, FR63        | Caching, optimistic updates, background sync         |
| Local Storage   | MMKV                | v4.x               | FR48-54, FR62                         | Fast key-value storage, preferences persistence      |
| UI Framework    | React Native Paper  | 5.x                | All UI FRs                            | Material Design 3, accessibility, theming            |
| Notifications   | Expo Notifications  | 0.32.12            | FR14-21                               | Push + local notifications, unified API              |
| Authentication  | Supabase Auth       | 2.79+              | FR1-6                                 | Magic link, session management, deep linking         |
| Real-time       | Supabase Realtime   | 2.79+              | FR8-9, FR15                           | WebSocket subscriptions for Love Notes               |
| File Storage    | Supabase Storage    | 2.79+              | FR29-35                               | Photo uploads with RLS policies                      |
| Haptic Feedback | Expo Haptics        | SDK 54 included    | FR13, FR27, FR43                      | Native haptic patterns                               |
| Image Handling  | Expo Image Picker   | SDK 54 included    | FR29-35                               | Gallery selection, compression                       |
| Secure Storage  | Expo SecureStore    | SDK 54 included    | NFR-S1, FR5                           | Keychain/Keystore for tokens                         |

## Project Structure

```
my-love-mobile/
├── app/                              # Expo Router file-based routing
│   ├── _layout.tsx                   # Root layout with providers
│   ├── index.tsx                     # Home/Dashboard screen
│   ├── (auth)/                       # Auth group (unauthenticated)
│   │   ├── _layout.tsx
│   │   ├── login.tsx                 # Magic link login
│   │   └── verify.tsx                # Magic link verification
│   ├── (tabs)/                       # Main tab navigation
│   │   ├── _layout.tsx               # Bottom tab navigator
│   │   ├── home.tsx                  # Dashboard/Feature Hub
│   │   ├── notes.tsx                 # Love Notes chat
│   │   ├── mood.tsx                  # Mood tracker
│   │   └── settings.tsx              # Settings & preferences
│   ├── photos/                       # Photo gallery screens
│   │   ├── index.tsx                 # Gallery grid view
│   │   └── [id].tsx                  # Full-screen photo viewer
│   ├── message.tsx                   # Daily love message display
│   └── +not-found.tsx                # 404 handler
├── src/
│   ├── components/
│   │   ├── core/                     # Base themed components
│   │   │   ├── ThemedButton.tsx
│   │   │   ├── ThemedCard.tsx
│   │   │   ├── ThemedInput.tsx
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
│   ├── hooks/
│   │   ├── useAuth.ts                # Supabase auth hook
│   │   ├── useLoveNotes.ts           # Love Notes query hook
│   │   ├── useMood.ts                # Mood tracking hook
│   │   ├── usePhotos.ts              # Photo gallery hook
│   │   ├── useNotifications.ts       # Push notification hook
│   │   ├── usePartner.ts             # Partner data hook
│   │   └── useHaptics.ts             # Haptic feedback hook
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client configuration
│   │   ├── queryClient.ts            # TanStack Query client
│   │   ├── storage.ts                # MMKV storage wrapper
│   │   └── notifications.ts          # Notification handlers
│   ├── providers/
│   │   ├── AuthProvider.tsx          # Auth context provider
│   │   ├── QueryProvider.tsx         # TanStack Query provider
│   │   └── ThemeProvider.tsx         # React Native Paper theming
│   ├── theme/
│   │   ├── tokens.ts                 # Design tokens (colors, spacing)
│   │   ├── paperTheme.ts             # RN Paper theme configuration
│   │   └── breakpoints.ts            # Responsive breakpoints
│   ├── types/
│   │   ├── database.ts               # Supabase generated types
│   │   ├── navigation.ts             # Route parameter types
│   │   └── models.ts                 # Domain model types
│   └── utils/
│       ├── date.ts                   # Date formatting utilities
│       ├── validation.ts             # Input validation
│       └── compression.ts            # Image compression
├── assets/
│   ├── images/                       # Static images
│   ├── fonts/                        # Custom fonts (if needed)
│   └── sounds/                       # Notification sounds (optional)
├── __tests__/                        # Test files mirror src structure
│   ├── components/
│   ├── hooks/
│   └── utils/
├── app.json                          # Expo configuration
├── eas.json                          # EAS Build configuration
├── tsconfig.json                     # TypeScript configuration
├── babel.config.js                   # Babel configuration
├── metro.config.js                   # Metro bundler configuration
├── package.json
└── README.md
```

## FR Category to Architecture Mapping

| FR Category                               | Architecture Components                                                                         | Key Technologies                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **User Account & Authentication** (FR1-6) | `app/(auth)/*`, `src/hooks/useAuth.ts`, `src/lib/supabase.ts`, `src/providers/AuthProvider.tsx` | Supabase Auth, Expo Linking, SecureStore            |
| **Love Notes** (FR7-13)                   | `app/(tabs)/notes.tsx`, `src/components/love-notes/*`, `src/hooks/useLoveNotes.ts`              | Supabase Realtime, TanStack Query, Expo Haptics     |
| **Push Notifications** (FR14-21)          | `src/lib/notifications.ts`, `src/hooks/useNotifications.ts`, `app/_layout.tsx`                  | Expo Notifications, Supabase Edge Functions         |
| **Mood Tracking** (FR22-28)               | `app/(tabs)/mood.tsx`, `src/components/mood/*`, `src/hooks/useMood.ts`                          | Supabase Database, TanStack Query, Expo Haptics     |
| **Photo Gallery** (FR29-35)               | `app/photos/*`, `src/components/photos/*`, `src/hooks/usePhotos.ts`                             | Supabase Storage, Expo Image Picker, TanStack Query |
| **Daily Love Messages** (FR36-39)         | `app/message.tsx`, `src/hooks/useDailyMessage.ts`                                               | Supabase Database, Expo Notifications               |
| **Partner Interactions** (FR40-44)        | `src/hooks/usePartner.ts`, `src/components/shared/*`                                            | Supabase Database, Expo Haptics                     |
| **Anniversary & Milestones** (FR45-47)    | `src/components/shared/DaysTogetherCounter.tsx`, `src/hooks/usePartner.ts`                      | Supabase Database, Expo Notifications               |
| **Settings & Preferences** (FR48-54)      | `app/(tabs)/settings.tsx`, `src/lib/storage.ts`, `src/providers/ThemeProvider.tsx`              | MMKV, React Native Paper                            |
| **Dashboard & Overview** (FR55-59)        | `app/(tabs)/home.tsx`, `src/components/shared/*`                                                | TanStack Query (aggregated queries)                 |
| **Technical Platform** (FR60-65)          | `app.json`, `eas.json`, `src/lib/*`, `src/providers/*`                                          | Expo SDK 54, Supabase RLS                           |

## Technology Stack Details

### Core Technologies

**React Native + Expo SDK 54**

- Managed workflow (no native code ejection needed)
- React Native 0.81 (latest stable)
- Metro bundler with tree-shaking
- EAS Build for production builds
- EAS Submit for App Store/Google Play deployment

**Supabase Backend (Self-contained platform)**

- **Auth**: Magic link passwordless authentication
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Realtime**: WebSocket subscriptions for Love Notes
- **Storage**: Photo uploads with access policies
- **Edge Functions**: Scheduled notifications (cron jobs)

**TanStack Query v5**

- Server state management
- Automatic caching with stale-while-revalidate
- Optimistic updates for instant UI feedback
- Background refetch on app focus
- Query invalidation on mutations

**React Native Paper v5**

- Material Design 3 component library
- Full theming support (Coral Heart theme)
- Accessibility defaults (WCAG AA compliant)
- Dark mode support
- TypeScript support

### Integration Points

**Authentication Flow:**

```
User → Login Screen → Supabase Magic Link → Email → Deep Link → App → Verify Token → Home Screen
```

**Love Notes Real-time Flow:**

```
User Sends → Optimistic UI Update → Supabase Insert → Realtime Broadcast → Partner Receives → Push Notification
```

**Data Synchronization:**

```
App Focus → TanStack Query Refetch → Supabase Queries → Cache Update → UI Re-render
```

**Push Notification Flow:**

```
Supabase Edge Function (cron) → Expo Push Service → APNs/FCM → Device → Deep Link Handler → Screen Navigation
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

### TanStack Query Pattern

```typescript
// Query key factory
export const queryKeys = {
  loveNotes: ['love-notes'] as const,
  moods: ['moods'] as const,
  partnerMood: ['partner', 'mood'] as const,
  photos: ['photos'] as const,
  dailyMessage: ['daily-message'] as const,
};

// Query hook pattern
export const useLoveNotes = () => {
  return useQuery({
    queryKey: queryKeys.loveNotes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('love_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0, // Always consider stale for real-time data
    refetchOnWindowFocus: true,
  });
};

// Mutation with optimistic update
export const useSendLoveNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase
        .from('love_notes')
        .insert({ content: message })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.loveNotes });
      const previousNotes = queryClient.getQueryData(queryKeys.loveNotes);

      queryClient.setQueryData(queryKeys.loveNotes, (old: LoveNote[]) => [
        { id: 'temp', content: message, created_at: new Date().toISOString(), sending: true },
        ...old,
      ]);

      return { previousNotes };
    },
    onError: (err, message, context) => {
      queryClient.setQueryData(queryKeys.loveNotes, context?.previousNotes);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loveNotes });
    },
  });
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
        queryClient.invalidateQueries({ queryKey: queryKeys.loveNotes });
        triggerHaptic('receive');
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
// Themed component with haptics
interface ThemedButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean;
}

export const ThemedButton: React.FC<ThemedButtonProps> = ({
  onPress,
  children,
  variant = 'primary',
  loading = false,
}) => {
  const { triggerHaptic } = useHaptics();

  const handlePress = () => {
    triggerHaptic('tap');
    onPress();
  };

  return (
    <Button
      mode={variant === 'primary' ? 'contained' : 'outlined'}
      onPress={handlePress}
      loading={loading}
      disabled={loading}
      style={styles.button}
    >
      {children}
    </Button>
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
// Magic link sign in
const { error } = await supabase.auth.signInWithOtp({
  email: userEmail,
  options: {
    emailRedirectTo: 'mylove://auth/callback',
  },
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
mylove://auth/callback              # Magic link authentication
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

**Magic Link Flow:**

1. User enters email on login screen
2. Supabase sends magic link to email
3. User taps link, which opens app via deep link
4. App verifies token with Supabase
5. Session stored in SecureStore (device keychain)
6. Session auto-refreshes until 30-day inactivity timeout

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

**Context:** Need file-based routing with deep linking support for magic link auth and notification navigation.

**Decision:** Use Expo Router (file-based navigation built on React Navigation).

**Rationale:**

- File-system based routing reduces boilerplate
- Native deep linking support for magic links
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
