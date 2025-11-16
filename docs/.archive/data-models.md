# Data Models Documentation

> **Last Updated**: 2025-11-16
> **Total Type Definitions**: 35+ interfaces and types
> **Source Files**: `src/types/index.ts`, `src/types/database.types.ts`

## Overview

The My Love PWA uses a strongly-typed architecture with comprehensive TypeScript interfaces across multiple layers:

- **Application Types** (`src/types/index.ts`) - Core domain models
- **Database Types** (`src/types/database.types.ts`) - Supabase generated types
- **Validation Schemas** (`src/validation/schemas.ts`) - Zod runtime validation
- **API Response Types** (`src/api/validation/supabaseSchemas.ts`) - API contract validation

## Core Domain Models

### User & Authentication

```typescript
// User session from Supabase Auth
interface AuthUser {
  id: string; // UUID from Supabase
  email: string;
  created_at: string;
}

// User profile stored in database
interface UserProfile {
  id: string; // Maps to AuthUser.id
  displayName: string; // User's chosen name
  partnerId?: string; // Partner's user ID (if paired)
  pairingCode?: string; // Temporary pairing code
  createdAt: string;
  updatedAt: string;
}
```

### Theme System

```typescript
type ThemeName = 'sunset' | 'ocean' | 'lavender' | 'rose';

interface Theme {
  name: ThemeName;
  gradient: string; // Tailwind gradient classes
  accent: string; // Primary accent color
  background: string; // Background color class
  cardBackground: string; // Card surface color
  textPrimary: string; // Primary text color
  textSecondary: string; // Secondary text color
}

// Theme lookup map
const themes: Record<ThemeName, Theme>;
```

### Message System

```typescript
// Base message structure
interface Message {
  id: string; // Unique identifier
  text: string; // Message content (max 500 chars)
  author: string; // Attribution (default: "Anonymous")
  date?: string; // Optional date reference
  isCustom?: boolean; // User-created vs default
}

// Message with favorite status
interface FavoriteMessage extends Message {
  favoritedAt: string; // ISO timestamp when favorited
}

// Daily message selection
interface DailyMessageState {
  currentMessage: Message;
  dayNumber: number; // Day of relationship (1-365+)
  history: Message[]; // Previously shown messages
  favorites: FavoriteMessage[]; // User's favorited messages
}
```

### Photo Management

```typescript
interface Photo {
  id: string; // UUID
  blob: Blob; // Compressed image data
  thumbnail?: Blob; // Optional thumbnail (< 50KB)
  caption: string; // User description
  dateTaken: string; // ISO date string
  createdAt: string; // When added to app
  metadata: PhotoMetadata;
}

interface PhotoMetadata {
  width: number;
  height: number;
  originalSize: number; // Bytes before compression
  compressedSize: number; // Bytes after compression
  mimeType: string; // image/jpeg, image/png, etc.
  compressionRatio: number; // Percentage reduced
}

// Photo pagination for lazy loading
interface PhotoPage {
  photos: Photo[];
  cursor: string | null; // Next page cursor
  hasMore: boolean;
}

// Photo gallery state
interface PhotoGalleryState {
  photos: Photo[];
  selectedPhoto: Photo | null;
  isLoading: boolean;
  currentPage: number;
  totalCount: number;
  hasMore: boolean;
}
```

### Mood Tracking

```typescript
// Available emotions (positive and negative)
type MoodType =
  | 'happy'
  | 'content'
  | 'excited'
  | 'loved'
  | 'grateful'
  | 'peaceful'
  | 'sad'
  | 'anxious'
  | 'frustrated'
  | 'tired'
  | 'stressed'
  | 'lonely';

interface MoodEntry {
  id: string; // UUID
  userId: string; // Owner of the mood entry
  moods: MoodType[]; // Array of selected moods (multi-select)
  intensity: number; // 1-5 scale
  note?: string; // Optional user note (max 500 chars)
  timestamp: string; // ISO timestamp
  syncedToCloud: boolean; // Cloud sync status
  partnerId?: string; // If shared with partner
}

// Mood history view
interface MoodHistoryEntry extends MoodEntry {
  dayOfWeek: string; // Mon, Tue, etc.
  formattedDate: string; // Human readable date
}

// Calendar visualization data
interface MoodCalendarDay {
  date: string; // YYYY-MM-DD
  entry: MoodEntry | null;
  isToday: boolean;
  isCurrentMonth: boolean;
}
```

### Partner Interactions

```typescript
type InteractionType = 'poke' | 'kiss';

interface Interaction {
  id: string;
  senderId: string;
  receiverId: string;
  type: InteractionType;
  timestamp: string;
  isRead: boolean;
}

// Rate limiting for interactions
interface InteractionLimits {
  maxPerHour: number; // Default: 10
  cooldownSeconds: number; // Default: 30
  lastInteractionTime: string;
  interactionsThisHour: number;
}
```

### Anniversary & Countdown

```typescript
interface Anniversary {
  id: string;
  name: string; // e.g., "First Date", "Wedding"
  date: string; // ISO date
  isRecurring: boolean; // Annual event
  reminderDays: number; // Days before to remind
}

interface CountdownDisplay {
  anniversary: Anniversary;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isToday: boolean;
  isPast: boolean;
}
```

## State Slice Interfaces

### Settings Slice

```typescript
interface SettingsState {
  // User identity
  displayName: string;
  userId: string | null;
  email: string | null;

  // Authentication
  isAuthenticated: boolean;
  authToken: string | null;
  sessionExpiry: string | null;

  // Visual preferences
  theme: ThemeName;

  // Relationship data
  partnerName: string;
  relationshipStartDate: string; // ISO date
  anniversaries: Anniversary[];

  // App state
  hasCompletedOnboarding: boolean;
  isFirstVisit: boolean;
  lastOpenedDate: string;

  // Actions (12 total)
  setDisplayName: (name: string) => void;
  setTheme: (theme: ThemeName) => void;
  setPartnerName: (name: string) => void;
  setRelationshipStartDate: (date: string) => void;
  addAnniversary: (anniversary: Anniversary) => void;
  removeAnniversary: (id: string) => void;
  updateAnniversary: (id: string, updates: Partial<Anniversary>) => void;
  setAuthenticated: (status: boolean, token?: string) => void;
  setUserId: (id: string) => void;
  setEmail: (email: string) => void;
  completeOnboarding: () => void;
  resetSettings: () => void;
}
```

### Messages Slice

```typescript
interface MessagesState {
  // Current state
  currentDayNumber: number;
  currentMessage: Message | null;

  // History tracking
  messageHistory: Message[];
  shownMessageIds: Set<string>;

  // Favorites
  favorites: FavoriteMessage[];

  // Custom messages
  customMessages: Message[];

  // Navigation
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;

  // Actions (11 total)
  setCurrentMessage: (message: Message) => void;
  incrementDayNumber: () => void;
  addToHistory: (message: Message) => void;
  toggleFavorite: (message: Message) => void;
  isFavorite: (messageId: string) => boolean;
  goBackInHistory: () => void;
  goForwardInHistory: () => void;
  addCustomMessage: (message: Omit<Message, 'id' | 'isCustom'>) => void;
  removeCustomMessage: (id: string) => void;
  updateCustomMessage: (id: string, updates: Partial<Message>) => void;
  resetMessages: () => void;
}
```

### Photos Slice

```typescript
interface PhotosState {
  photos: Photo[];
  selectedPhotoId: string | null;
  isCarouselOpen: boolean;
  isLoading: boolean;
  uploadProgress: number;

  // Pagination
  currentPage: number;
  pageSize: number;
  hasMorePhotos: boolean;
  totalPhotoCount: number;

  // Actions (9 total)
  addPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;
  updatePhoto: (id: string, updates: Partial<Photo>) => void;
  selectPhoto: (id: string) => void;
  clearSelection: () => void;
  openCarousel: (photoId: string) => void;
  closeCarousel: () => void;
  loadNextPage: () => Promise<void>;
  setUploadProgress: (progress: number) => void;
}
```

### Mood Slice

```typescript
interface MoodState {
  currentMood: MoodEntry | null;
  moodHistory: MoodEntry[];
  selectedMoods: MoodType[]; // Multi-select support
  currentIntensity: number;
  currentNote: string;

  // Partner mood
  partnerCurrentMood: MoodEntry | null;

  // Calendar view
  calendarMonth: number;
  calendarYear: number;

  // Actions (10 total)
  setSelectedMoods: (moods: MoodType[]) => void;
  toggleMoodSelection: (mood: MoodType) => void;
  setIntensity: (level: number) => void;
  setNote: (text: string) => void;
  saveMoodEntry: () => Promise<void>;
  loadMoodHistory: (userId: string) => Promise<void>;
  setPartnerMood: (entry: MoodEntry) => void;
  navigateCalendar: (month: number, year: number) => void;
  deleteMoodEntry: (id: string) => Promise<void>;
  resetMoodState: () => void;
}
```

### Partner Slice

```typescript
interface PartnerState {
  partnerId: string | null;
  partnerName: string;
  partnerDisplayName: string;
  isPaired: boolean;
  pairingCode: string | null;

  // Sync status
  lastSyncTime: string | null;
  isSyncing: boolean;
  syncError: string | null;

  // Actions (8 total)
  setPartner: (id: string, name: string) => void;
  generatePairingCode: () => Promise<string>;
  joinWithCode: (code: string) => Promise<boolean>;
  clearPartner: () => void;
  setSyncStatus: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  updateLastSync: () => void;
  resetPartnerState: () => void;
}
```

### Interactions Slice

```typescript
interface InteractionsState {
  interactions: Interaction[];
  unreadCount: number;
  lastPokeTime: string | null;
  lastKissTime: string | null;
  canPoke: boolean;
  canKiss: boolean;

  // Actions (5 total)
  sendPoke: (receiverId: string) => Promise<void>;
  sendKiss: (receiverId: string) => Promise<void>;
  markAsRead: (id: string) => void;
  loadInteractions: () => Promise<void>;
  checkRateLimits: () => void;
}
```

### Navigation Slice

```typescript
type AppView = 'home' | 'photos' | 'mood' | 'settings' | 'admin';

interface NavigationState {
  currentView: AppView;
  previousView: AppView | null;
  navigationHistory: AppView[];

  // Actions (4 total)
  navigateTo: (view: AppView) => void;
  goBack: () => void;
  clearHistory: () => void;
  resetNavigation: () => void;
}
```

## Database Schema (Supabase)

### Profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  partner_id UUID REFERENCES profiles(id),
  pairing_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### Mood Entries Table

```sql
CREATE TABLE mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  moods TEXT[] NOT NULL,          -- Array of mood types
  intensity INTEGER CHECK (intensity BETWEEN 1 AND 5),
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_moods CHECK (
    moods <@ ARRAY['happy', 'content', 'excited', 'loved', 'grateful',
                   'peaceful', 'sad', 'anxious', 'frustrated', 'tired',
                   'stressed', 'lonely']::TEXT[]
  )
);

-- RLS for mood entries
CREATE POLICY "Users can CRUD own moods" ON mood_entries
  USING (auth.uid() = user_id);
CREATE POLICY "Partners can view each other's moods" ON mood_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND partner_id = mood_entries.user_id
    )
  );
```

### Interactions Table

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('poke', 'kiss')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

-- Rate limiting implemented in application layer
-- RLS policies for interaction privacy
```

## Validation Schemas (Zod)

### Input Validation

```typescript
// src/validation/schemas.ts

import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .min(1, 'Display name is required')
  .max(50, 'Display name must be 50 characters or less')
  .trim();

export const messageSchema = z.object({
  text: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message must be 500 characters or less'),
  author: z.string().max(100).default('Anonymous'),
  date: z.string().optional(),
});

export const moodEntrySchema = z.object({
  moods: z
    .array(
      z.enum([
        'happy',
        'content',
        'excited',
        'loved',
        'grateful',
        'peaceful',
        'sad',
        'anxious',
        'frustrated',
        'tired',
        'stressed',
        'lonely',
      ])
    )
    .min(1, 'Select at least one mood'),
  intensity: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export const anniversarySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().datetime(),
  isRecurring: z.boolean().default(true),
  reminderDays: z.number().int().min(0).max(365).default(7),
});

export const photoMetadataSchema = z.object({
  caption: z.string().max(200),
  dateTaken: z.string().datetime(),
});
```

### API Response Validation

```typescript
// src/api/validation/supabaseSchemas.ts

export const supabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string().datetime(),
});

export const supabaseProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  partner_id: z.string().uuid().nullable(),
  pairing_code: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const supabaseMoodEntrySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  moods: z.array(z.string()),
  intensity: z.number(),
  note: z.string().nullable(),
  timestamp: z.string().datetime(),
});
```

## IndexedDB Schema

### Database Configuration

```typescript
// src/services/storage.ts

const DB_NAME = 'my-love-db';
const DB_VERSION = 3;

const dbSchema = {
  stores: {
    photos: {
      keyPath: 'id',
      indexes: [
        { name: 'dateTaken', keyPath: 'dateTaken' },
        { name: 'createdAt', keyPath: 'createdAt' },
      ],
    },
    customMessages: {
      keyPath: 'id',
      indexes: [{ name: 'createdAt', keyPath: 'createdAt' }],
    },
    moodEntries: {
      keyPath: 'id',
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'userId', keyPath: 'userId' },
      ],
    },
    offlineQueue: {
      keyPath: 'id',
      indexes: [
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'type', keyPath: 'type' },
      ],
    },
  },
};
```

### Migration Support

```typescript
// Database version upgrades
interface MigrationStep {
  version: number;
  migrate: (db: IDBDatabase) => void;
}

const migrations: MigrationStep[] = [
  {
    version: 2,
    migrate: (db) => {
      // Add mood entries store
      db.createObjectStore('moodEntries', { keyPath: 'id' });
    },
  },
  {
    version: 3,
    migrate: (db) => {
      // Add offline queue for sync
      db.createObjectStore('offlineQueue', { keyPath: 'id' });
    },
  },
];
```

## Type Safety Best Practices

### Generic Service Types

```typescript
// Base service interface for CRUD operations
interface CRUDService<T, CreateDTO, UpdateDTO> {
  create(data: CreateDTO): Promise<T>;
  read(id: string): Promise<T | null>;
  update(id: string, data: UpdateDTO): Promise<T>;
  delete(id: string): Promise<boolean>;
  list(options?: ListOptions): Promise<T[]>;
}

interface ListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}
```

### Discriminated Unions for State

```typescript
// Loading state pattern
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// Used in components
const [photoState, setPhotoState] = useState<AsyncState<Photo[]>>({ status: 'idle' });
```

### Type Guards

```typescript
// Type guard for mood validation
function isMoodType(value: string): value is MoodType {
  return [
    'happy',
    'content',
    'excited',
    'loved',
    'grateful',
    'peaceful',
    'sad',
    'anxious',
    'frustrated',
    'tired',
    'stressed',
    'lonely',
  ].includes(value);
}

// Type guard for interactions
function isValidInteraction(obj: unknown): obj is Interaction {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    (obj.type === 'poke' || obj.type === 'kiss')
  );
}
```

---

**Generated by BMAD document-project workflow**
**Scan Level**: Exhaustive (all type definitions analyzed)
