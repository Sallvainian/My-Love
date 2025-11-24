# Core Domain Models

## User & Authentication

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

## Theme System

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

## Message System

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

## Photo Management

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

## Mood Tracking

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

## Partner Interactions

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

## Anniversary & Countdown

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
