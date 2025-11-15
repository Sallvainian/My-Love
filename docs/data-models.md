# Data Models Documentation

## Overview

This document describes all TypeScript interfaces and data structures used in the My Love PWA. The application uses a strongly-typed architecture with interfaces defined in `/src/types/index.ts`.

## Core Type Definitions

### ThemeName

**Type**: String literal union

```typescript
export type ThemeName = 'sunset' | 'ocean' | 'lavender' | 'rose';
```

**Description**: Available theme options for the application.

**Values**:

- `sunset` - Warm pink and orange gradients (default)
- `ocean` - Cool blue and teal tones
- `lavender` - Purple and violet hues
- `rose` - Deep pink and rose colors

**Usage**: Selected during onboarding and stored in `Settings.themeName`.

---

### MessageCategory

**Type**: String literal union

```typescript
export type MessageCategory = 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';
```

**Description**: Categories for organizing love messages.

**Values**:

| Category      | Description                     | Example                                     |
| ------------- | ------------------------------- | ------------------------------------------- |
| `reason`      | Reasons why you love them       | "I love how you make me laugh"              |
| `memory`      | Shared memories and experiences | "Remember our first date at the park?"      |
| `affirmation` | Daily encouragement and support | "You are capable of amazing things"         |
| `future`      | Plans and dreams together       | "I can't wait to travel the world with you" |
| `custom`      | User-created messages           | Any custom message content                  |

**Default Distribution** (100 pre-loaded messages):

- 30 reason messages
- 25 memory messages
- 25 affirmation messages
- 20 future messages

---

### MoodType

**Type**: String literal union

```typescript
export type MoodType = 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful';
```

**Description**: Mood states for daily mood tracking.

**Values**:

- `loved` - Feeling especially loved or cherished
- `happy` - General happiness and joy
- `content` - Peaceful satisfaction
- `thoughtful` - Reflective or contemplative
- `grateful` - Feeling thankful and appreciative

**Usage**: Selected in MoodTracker component (planned feature).

---

## Primary Interfaces

### Message

**Purpose**: Represents a love message (default or custom).

```typescript
export interface Message {
  id: number; // Auto-generated unique identifier
  text: string; // Message content
  category: MessageCategory; // Message classification
  isCustom: boolean; // True if user-created, false if default
  createdAt: Date; // Creation timestamp
  isFavorite?: boolean; // Optional favorite flag
}
```

**Field Details**:

| Field        | Type            | Required | Description                                           |
| ------------ | --------------- | -------- | ----------------------------------------------------- |
| `id`         | number          | Yes      | Auto-incremented primary key in IndexedDB             |
| `text`       | string          | Yes      | The message content (max: ~500 chars recommended)     |
| `category`   | MessageCategory | Yes      | One of: reason, memory, affirmation, future, custom   |
| `isCustom`   | boolean         | Yes      | `false` for default messages, `true` for user-created |
| `createdAt`  | Date            | Yes      | Timestamp when message was created/added              |
| `isFavorite` | boolean         | No       | `true` if favorited by user (affects daily rotation)  |

**Storage**:

- **IndexedDB Store**: `messages`
- **Indexes**: `by-category` (category), `by-date` (createdAt)

**Example**:

```typescript
const message: Message = {
  id: 42,
  text: 'I love how you always know how to make me smile, even on the toughest days.',
  category: 'reason',
  isCustom: false,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  isFavorite: true,
};
```

---

### Photo

**Purpose**: Represents a user-uploaded photo with metadata.

```typescript
export interface Photo {
  id: number; // Auto-generated unique identifier
  blob: Blob; // Binary image data
  caption: string; // Photo description
  uploadDate: Date; // When photo was added
  tags: string[]; // Searchable tags
}
```

**Field Details**:

| Field        | Type     | Required | Description                                                 |
| ------------ | -------- | -------- | ----------------------------------------------------------- |
| `id`         | number   | Yes      | Auto-incremented primary key in IndexedDB                   |
| `blob`       | Blob     | Yes      | Binary image data (JPEG, PNG, WebP, etc.)                   |
| `caption`    | string   | Yes      | User-provided photo description                             |
| `uploadDate` | Date     | Yes      | Timestamp when photo was uploaded                           |
| `tags`       | string[] | Yes      | Array of tags for organization (e.g., ["vacation", "2024"]) |

**Storage**:

- **IndexedDB Store**: `photos`
- **Indexes**: `by-date` (uploadDate)

**Example**:

```typescript
const photo: Photo = {
  id: 7,
  blob: new Blob([imageData], { type: 'image/jpeg' }),
  caption: 'Our first vacation together in Italy!',
  uploadDate: new Date('2024-06-15T14:30:00Z'),
  tags: ['vacation', 'italy', '2024', 'travel'],
};
```

**Size Considerations**:

- Recommended max file size: 5MB per photo
- IndexedDB quota: ~1GB (browser-dependent)
- Consider client-side compression for large images (future enhancement)

---

### Anniversary

**Purpose**: Represents a special date to track and celebrate.

```typescript
export interface Anniversary {
  id: number; // Unique identifier
  date: string; // ISO date string (YYYY-MM-DD)
  label: string; // Display name
  description?: string; // Optional detailed description
}
```

**Field Details**:

| Field         | Type   | Required | Description                                                    |
| ------------- | ------ | -------- | -------------------------------------------------------------- |
| `id`          | number | Yes      | Unique identifier (manually generated)                         |
| `date`        | string | Yes      | ISO 8601 date format (e.g., "2024-02-14")                      |
| `label`       | string | Yes      | Short display name (e.g., "First Date")                        |
| `description` | string | No       | Longer description (e.g., "The day we met at the coffee shop") |

**Storage**:

- **Location**: Inside `Settings.relationship.anniversaries` array
- **Persistence**: LocalStorage via Zustand persist middleware

**Default Anniversary**:
The onboarding process creates a default anniversary:

```typescript
{
  id: 1,
  date: settings.relationship.startDate,
  label: 'First Day Together',
  description: 'The day our story began'
}
```

**Example**:

```typescript
const anniversaries: Anniversary[] = [
  {
    id: 1,
    date: '2023-01-15',
    label: 'First Day Together',
    description: 'The day our story began',
  },
  {
    id: 2,
    date: '2023-06-20',
    label: 'First "I Love You"',
    description: 'Under the stars at the beach',
  },
  {
    id: 3,
    date: '2024-01-15',
    label: 'One Year Anniversary',
    description: 'Our first year together!',
  },
];
```

---

### MoodEntry

**Purpose**: Records daily mood and optional notes.

```typescript
export interface MoodEntry {
  date: string; // ISO date string (YYYY-MM-DD)
  mood: MoodType; // Selected mood
  note?: string; // Optional note
}
```

**Field Details**:

| Field  | Type     | Required | Description                                         |
| ------ | -------- | -------- | --------------------------------------------------- |
| `date` | string   | Yes      | ISO date (YYYY-MM-DD), serves as unique key         |
| `mood` | MoodType | Yes      | One of: loved, happy, content, thoughtful, grateful |
| `note` | string   | No       | Optional text note about the mood (max: 200 chars)  |

**Storage**:

- **Location**: `AppState.moods` array in Zustand store
- **Persistence**: LocalStorage via Zustand persist middleware

**Constraints**:

- One mood entry per date (updating replaces existing)
- Dates are in ISO format for consistent sorting

**Example**:

```typescript
const moodEntry: MoodEntry = {
  date: '2024-10-30',
  mood: 'grateful',
  note: 'Had an amazing day together. Feeling so blessed.',
};
```

---

### Settings

**Purpose**: User preferences and relationship configuration.

```typescript
export interface Settings {
  themeName: ThemeName;
  notificationTime: string; // HH:MM format
  relationship: {
    startDate: string; // ISO date string
    partnerName: string;
    anniversaries: Anniversary[];
  };
  customization: {
    accentColor: string; // Hex color
    fontFamily: string;
  };
  notifications: {
    enabled: boolean;
    time: string; // HH:MM format
  };
}
```

**Field Details**:

| Field                        | Type          | Default              | Description                          |
| ---------------------------- | ------------- | -------------------- | ------------------------------------ |
| `themeName`                  | ThemeName     | `'sunset'`           | Active theme                         |
| `notificationTime`           | string        | `'09:00'`            | Deprecated (use notifications.time)  |
| `relationship.startDate`     | string        | (required)           | ISO date when relationship started   |
| `relationship.partnerName`   | string        | (required)           | Partner's name or nickname           |
| `relationship.anniversaries` | Anniversary[] | `[default]`          | Array of special dates               |
| `customization.accentColor`  | string        | `'#FF6B9D'`          | Primary accent color (hex)           |
| `customization.fontFamily`   | string        | `'Playfair Display'` | Font for messages                    |
| `notifications.enabled`      | boolean       | `false`              | Whether notifications are enabled    |
| `notifications.time`         | string        | `'09:00'`            | Daily notification time (24h format) |

**Storage**:

- **Location**: `AppState.settings` in Zustand store
- **Persistence**: LocalStorage via Zustand persist middleware

**Example**:

```typescript
const settings: Settings = {
  themeName: 'ocean',
  notificationTime: '09:00',
  relationship: {
    startDate: '2023-01-15',
    partnerName: 'My Love',
    anniversaries: [
      {
        id: 1,
        date: '2023-01-15',
        label: 'First Day Together',
        description: 'The day our story began',
      },
    ],
  },
  customization: {
    accentColor: '#4A90E2',
    fontFamily: 'Playfair Display',
  },
  notifications: {
    enabled: true,
    time: '09:00',
  },
};
```

---

### MessageHistory

**Purpose**: Tracks message rotation and user interactions.

```typescript
export interface MessageHistory {
  lastShownDate: string; // ISO date string
  lastMessageId: number; // ID of last shown message
  favoriteIds: number[]; // Array of favorited message IDs
  viewedIds: number[]; // Array of viewed message IDs
}
```

**Field Details**:

| Field           | Type     | Description                                                   |
| --------------- | -------- | ------------------------------------------------------------- |
| `lastShownDate` | string   | ISO timestamp of last message shown (used for daily rotation) |
| `lastMessageId` | number   | ID of the message currently displayed                         |
| `favoriteIds`   | number[] | Message IDs marked as favorites (prioritized in rotation)     |
| `viewedIds`     | number[] | Message IDs that have been shown at least once                |

**Storage**:

- **Location**: `AppState.messageHistory` in Zustand store
- **Persistence**: LocalStorage via Zustand persist middleware

**Usage**:

- `lastShownDate`: Determines if a new day has started (show new message)
- `lastMessageId`: Show same message if user revisits on same day
- `favoriteIds`: Favorites have 2x higher probability in daily rotation
- `viewedIds`: Track which messages have been displayed

**Example**:

```typescript
const messageHistory: MessageHistory = {
  lastShownDate: '2024-10-30T08:30:00.000Z',
  lastMessageId: 42,
  favoriteIds: [3, 15, 42, 67, 89],
  viewedIds: [1, 2, 3, 5, 8, 13, 15, 21, 34, 42, 55, 67, 89],
};
```

---

### AppState

**Purpose**: Complete application state interface for Zustand store.

```typescript
export interface AppState {
  // State slices
  settings: Settings | null;
  messageHistory: MessageHistory;
  messages: Message[];
  photos: Photo[];
  moods: MoodEntry[];
  isOnboarded: boolean;
}
```

**Field Details**:

| Field            | Type             | Persisted | Description                                    |
| ---------------- | ---------------- | --------- | ---------------------------------------------- |
| `settings`       | Settings \| null | Yes       | User settings (null until onboarding complete) |
| `messageHistory` | MessageHistory   | Yes       | Message rotation tracking                      |
| `messages`       | Message[]        | No        | All messages (loaded from IndexedDB on init)   |
| `photos`         | Photo[]          | No        | All photos (loaded from IndexedDB on demand)   |
| `moods`          | MoodEntry[]      | Yes       | Daily mood entries                             |
| `isOnboarded`    | boolean          | Yes       | Whether user completed onboarding              |

**Additional Runtime State** (not in interface but in store):

- `currentMessage: Message | null` - Currently displayed message
- `isLoading: boolean` - App initialization state
- `error: string | null` - Error messages

**Persistence Strategy**:
Only settings, messageHistory, moods, and isOnboarded are persisted to LocalStorage. Messages and photos are loaded from IndexedDB on app initialization.

---

## Supporting Interfaces

### Theme

**Purpose**: Theme configuration with colors and gradients.

```typescript
export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  gradients: {
    background: string;
    card: string;
  };
}
```

**Field Details**:

| Field                  | Type      | Description                                   |
| ---------------------- | --------- | --------------------------------------------- |
| `name`                 | ThemeName | Programmatic theme identifier                 |
| `displayName`          | string    | User-facing theme name (e.g., "Sunset Bliss") |
| `colors.primary`       | string    | Primary brand color (hex)                     |
| `colors.secondary`     | string    | Secondary accent color (hex)                  |
| `colors.background`    | string    | Page background color (hex)                   |
| `colors.text`          | string    | Primary text color (hex)                      |
| `colors.accent`        | string    | Highlight/accent color (hex)                  |
| `gradients.background` | string    | CSS gradient for page background              |
| `gradients.card`       | string    | CSS gradient for card backgrounds             |

**Storage**:

- **Location**: `/src/utils/themes.ts` (exported as `themes` record)
- **Application**: Applied via CSS custom properties on theme change

**Example**:

```typescript
const sunsetTheme: Theme = {
  name: 'sunset',
  displayName: 'Sunset Bliss',
  colors: {
    primary: '#FF6B9D',
    secondary: '#FFA07A',
    background: '#FFE5EC',
    text: '#333333',
    accent: '#FF1493',
  },
  gradients: {
    background: 'linear-gradient(135deg, #FFE5EC 0%, #FFB6C1 100%)',
    card: 'linear-gradient(135deg, #FFFFFF 0%, #FFE5EC 50%, #FFD1DC 100%)',
  },
};
```

---

### RouteType

**Purpose**: Navigation route identifiers (future use).

```typescript
export type RouteType = 'home' | 'memories' | 'moods' | 'countdown' | 'settings' | 'onboarding';
```

**Values**:

- `home` - Daily message view
- `memories` - Photo gallery
- `moods` - Mood tracker calendar
- `countdown` - Anniversary countdown
- `settings` - App settings
- `onboarding` - Setup wizard

**Current Status**: Not yet used (no routing library installed). Will be used when React Router is added.

---

### NavItem

**Purpose**: Navigation menu item configuration (future use).

```typescript
export interface NavItem {
  route: RouteType;
  label: string;
  icon: string;
}
```

**Field Details**:

| Field   | Type      | Description                       |
| ------- | --------- | --------------------------------- |
| `route` | RouteType | Target route identifier           |
| `label` | string    | Display text for navigation item  |
| `icon`  | string    | Icon name (Lucide React) or emoji |

**Current Status**: Not yet used (no navigation component built).

**Example** (future):

```typescript
const navItems: NavItem[] = [
  { route: 'home', label: 'Today', icon: 'Home' },
  { route: 'memories', label: 'Photos', icon: 'Camera' },
  { route: 'moods', label: 'Moods', icon: 'Heart' },
  { route: 'countdown', label: 'Countdown', icon: 'Calendar' },
  { route: 'settings', label: 'Settings', icon: 'Settings' },
];
```

---

## IndexedDB Schema Reference

### Database Configuration

**Database Name**: `my-love-db`
**Version**: 1

### Object Stores

#### photos Store

```typescript
{
  keyPath: 'id',
  autoIncrement: true,
  indexes: [
    { name: 'by-date', keyPath: 'uploadDate', unique: false }
  ]
}
```

#### messages Store

```typescript
{
  keyPath: 'id',
  autoIncrement: true,
  indexes: [
    { name: 'by-category', keyPath: 'category', unique: false },
    { name: 'by-date', keyPath: 'createdAt', unique: false }
  ]
}
```

### Query Examples

**Get all messages by category**:

```typescript
const reasonMessages = await storageService.getMessagesByCategory('reason');
```

**Get photos sorted by date**:

```typescript
const allPhotos = await storageService.getAllPhotos();
// Photos returned in insertion order, sort manually if needed
const sortedPhotos = allPhotos.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
```

---

## Type Guards and Helpers

### Message Type Guards

```typescript
// Check if message is custom
function isCustomMessage(message: Message): boolean {
  return message.isCustom === true;
}

// Check if message is favorited
function isFavoriteMessage(message: Message): boolean {
  return message.isFavorite === true;
}

// Filter messages by category
function getMessagesByCategory(messages: Message[], category: MessageCategory): Message[] {
  return messages.filter((m) => m.category === category);
}
```

### Date Helpers

```typescript
// Convert Date to ISO date string (YYYY-MM-DD)
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Check if dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return toISODate(date1) === toISODate(date2);
}
```

---

## Data Validation

### Runtime Validation Recommendations

While TypeScript provides compile-time type safety, consider adding runtime validation for:

1. **User Input** (forms):
   - Partner name: min 1 char, max 50 chars
   - Custom messages: min 5 chars, max 500 chars
   - Anniversary labels: min 1 char, max 100 chars

2. **Dates**:
   - Start date: Cannot be in the future
   - Anniversary dates: Valid ISO format

3. **Settings**:
   - Notification time: Valid HH:MM format (00:00 to 23:59)
   - Accent color: Valid hex color (#RRGGBB)

### Example Validation Functions

```typescript
function validatePartnerName(name: string): boolean {
  return name.trim().length > 0 && name.length <= 50;
}

function validateNotificationTime(time: string): boolean {
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

function validateISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
}
```

---

## Migration Considerations

### Future Schema Changes

When adding new fields to interfaces:

1. **IndexedDB**: Use database version upgrades

   ```typescript
   openDB<MyLoveDB>(DB_NAME, 2, {
     upgrade(db, oldVersion, newVersion, transaction) {
       if (oldVersion < 2) {
         // Add new field or index
       }
     },
   });
   ```

2. **LocalStorage**: Add default values in store initialization

   ```typescript
   const defaultSettings: Settings = {
     // New fields with defaults
   };
   ```

3. **Type Safety**: Update TypeScript interfaces and re-compile

---

## Related Documentation

- **State Management**: See `/docs/state-management.md`
- **Service Layer**: See `/src/services/storage.ts`
- **Type Definitions**: See `/src/types/index.ts`
- **Architecture**: See `/docs/architecture.md`
