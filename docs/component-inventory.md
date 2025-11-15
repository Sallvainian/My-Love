# Component Inventory

## Overview

This document catalogs all UI components in the My Love PWA, including implemented components and planned features. Each component is documented with its purpose, features, dependencies, and implementation status.

## Implemented Components

### DailyMessage

**Location**: `/src/components/DailyMessage/DailyMessage.tsx`

**Status**: ✅ Fully Implemented

**Purpose**: Main application view that displays the daily love message with interactive features.

#### Features

- **Daily Message Display**: Shows the computed message for the current day
- **Relationship Stats**: Displays days together and formatted duration
- **Category Badge**: Visual indicator of message type (reason, memory, affirmation, future, custom)
- **Favorite Toggle**: Heart icon to favorite/unfavorite messages
- **Share Functionality**: Native share with clipboard fallback
- **Animations**:
  - Card entrance with 3D rotation
  - Floating hearts burst on favorite
  - Decorative hearts with subtle pulse
  - Category badge scale pop-in
- **Responsive Design**: Mobile-first layout with desktop optimization

#### State Dependencies

```typescript
const {
  currentMessage, // The message to display
  settings, // For relationship start date
  toggleFavorite, // Action to favorite/unfavorite
} = useAppStore();
```

#### Component Structure

```
DailyMessage
├── Floating Hearts Animation (conditional)
├── Header
│   ├── Day Counter (with sparkles)
│   └── Duration Text
└── Message Card
    ├── Gradient Overlay
    ├── Category Badge
    ├── Message Text
    ├── Action Buttons
    │   ├── Favorite Button (heart icon)
    │   └── Share Button (share icon)
    └── Decorative Hearts (animated)
```

#### Props

None (uses global store)

#### Example Usage

```typescript
import { DailyMessage } from './components/DailyMessage/DailyMessage';

function App() {
  return <DailyMessage />;
}
```

#### Animations

| Element           | Animation                      | Trigger            |
| ----------------- | ------------------------------ | ------------------ |
| Card              | Scale 0.9→1.0, rotateY -10°→0° | On mount           |
| Category Badge    | Scale 0→1 spring               | On mount (delayed) |
| Message Text      | Opacity 0→1 fade               | On mount (delayed) |
| Floating Hearts   | Y-axis rise with fade          | On favorite click  |
| Decorative Hearts | Continuous scale + rotate      | Infinite loop      |

#### Accessibility

- `aria-label` on favorite and share buttons
- Semantic HTML structure
- Keyboard navigation support
- Screen reader friendly

---

### Onboarding

**Location**: `/src/components/Onboarding/Onboarding.tsx`

**Status**: ✅ Fully Implemented

**Purpose**: Multi-step wizard for first-time user setup.

#### Features

- **4-Step Wizard**:
  1. Welcome screen with feature highlights
  2. Personalization (name and start date)
  3. Notification preferences
  4. Completion message with PWA tip
- **Progress Indicator**: Visual progress bars for each step
- **Form Validation**: Prevents proceeding with incomplete data
- **Animations**: Page transitions with slide effects
- **Notification Permission**: Requests browser notification access
- **Settings Creation**: Generates complete Settings object on completion

#### State Dependencies

```typescript
const {
  setSettings, // Set initial settings
  setOnboarded, // Mark onboarding complete
} = useAppStore();

// Local component state
const [currentStep, setCurrentStep] = useState(0);
const [partnerName, setPartnerName] = useState('');
const [startDate, setStartDate] = useState('');
const [notificationTime, setNotificationTime] = useState('09:00');
const [notificationsEnabled, setNotificationsEnabled] = useState(false);
```

#### Component Structure

```
Onboarding
├── Progress Indicator (4 bars)
└── Step Content (AnimatePresence)
    ├── Step 0: Welcome
    │   ├── Animated Heart Emoji
    │   ├── Feature List (3 items)
    │   └── Icons (Heart, Sparkles, Calendar)
    ├── Step 1: Details
    │   ├── Partner Name Input
    │   └── Start Date Input
    ├── Step 2: Notifications
    │   ├── Toggle Switch
    │   └── Time Picker (conditional)
    └── Step 3: Ready
        ├── Animated Sparkles Emoji
        ├── Personalized Greeting
        └── PWA Installation Tip
```

#### Props

None (uses global store)

#### Validation Rules

| Step              | Requirements                                       |
| ----------------- | -------------------------------------------------- |
| 0 (Welcome)       | None (always can proceed)                          |
| 1 (Details)       | `partnerName.trim() !== ''` AND `startDate !== ''` |
| 2 (Notifications) | None (optional feature)                            |
| 3 (Ready)         | None (completion step)                             |

#### Settings Generated

```typescript
const settings: Settings = {
  themeName: 'sunset',
  notificationTime: notificationTime,
  relationship: {
    startDate: startDate,
    partnerName: partnerName,
    anniversaries: [
      {
        id: 1,
        date: startDate,
        label: 'First Day Together',
        description: 'The day our story began',
      },
    ],
  },
  customization: {
    accentColor: '#FF6B9D',
    fontFamily: 'Playfair Display',
  },
  notifications: {
    enabled: notificationsEnabled,
    time: notificationTime,
  },
};
```

#### Animations

| Element        | Animation                   | Trigger           |
| -------------- | --------------------------- | ----------------- |
| Container      | Scale 0.9→1.0, opacity 0→1  | On mount          |
| Progress Bars  | Width 0→100%, gradient fill | Step advance      |
| Step Content   | Slide in/out (x-axis)       | Step change       |
| Heart Emoji    | Scale 1→1.2→1 pulse         | Infinite (Step 0) |
| Sparkles Emoji | Scale + rotate cycle        | Infinite (Step 3) |
| Toggle Switch  | X-axis movement             | Toggle change     |

#### Accessibility

- Proper `<label>` associations for inputs
- Date input max set to today (prevents future dates)
- Auto-focus on partner name input
- Disabled state on "Next" button when validation fails

---

## Planned Components

These components are referenced in the codebase but not yet implemented. Directories exist as placeholders.

### PhotoMemory

**Location**: `/src/components/PhotoMemory/` (placeholder)

**Status**: 🚧 Not Implemented

**Purpose**: Photo gallery with captions and tags for storing memories.

#### Planned Features

- **Photo Upload**: Camera and file picker integration
- **Photo Grid**: Responsive masonry or grid layout
- **Lightbox View**: Full-screen photo viewer with captions
- **Caption Editor**: Add/edit photo descriptions
- **Tag System**: Add searchable tags to photos
- **Filter/Search**: Find photos by tag or caption
- **Delete Functionality**: Remove photos with confirmation
- **Blob Storage**: Store images in IndexedDB

#### Anticipated State Dependencies

```typescript
const {
  photos, // Array of Photo objects
  addPhoto, // Upload new photo (future action)
  updatePhoto, // Edit caption/tags (future action)
  deletePhoto, // Remove photo (future action)
} = useAppStore();
```

#### Component Structure (Proposed)

```
PhotoMemory
├── Upload Button (floating action button)
├── Filter/Search Bar
├── Photo Grid
│   └── PhotoCard[] (map)
│       ├── Thumbnail Image
│       ├── Caption Preview
│       └── Tag Chips
└── Lightbox Modal (conditional)
    ├── Full-Size Image
    ├── Caption Display
    ├── Tags Display
    ├── Edit Button
    └── Delete Button
```

#### Data Flow

1. User selects photo → File input
2. Read file as Blob → Create Photo object
3. Call `addPhoto(photo)` → Save to IndexedDB
4. Update `photos` state → Re-render grid

#### Technical Considerations

- **Image Compression**: Use client-side compression for large photos
- **Lazy Loading**: Load images only when scrolled into view
- **IndexedDB Quota**: Monitor storage usage (warn at 80%)
- **File Formats**: Support JPEG, PNG, WebP, HEIC

---

### MoodTracker

**Location**: `/src/components/MoodTracker/` (placeholder)

**Status**: 🚧 Not Implemented

**Purpose**: Daily mood logging with calendar view and trend visualization.

#### Planned Features

- **Mood Selection**: Choose from 5 mood types (loved, happy, content, thoughtful, grateful)
- **Optional Note**: Add text note with mood entry
- **Calendar View**: Visual calendar showing mood history
- **Mood Icons**: Emoji or icon representation for each mood
- **Trend Chart**: Simple visualization of mood patterns (future)
- **Today's Mood**: Quick view of current day's mood
- **Edit Past Moods**: Modify previous entries

#### Anticipated State Dependencies

```typescript
const {
  moods, // Array of MoodEntry objects
  addMoodEntry, // Add/update mood for today
  getMoodForDate, // Retrieve mood for specific date
} = useAppStore();
```

#### Component Structure (Proposed)

```
MoodTracker
├── Header
│   ├── Current Month/Year
│   └── Navigation (prev/next month)
├── Today's Mood Panel
│   ├── Mood Selector (5 buttons)
│   └── Note Input (textarea)
└── Calendar Grid
    └── Day Cell[] (map)
        ├── Date Number
        ├── Mood Indicator (emoji/icon)
        └── Has Note Indicator (dot)
```

#### Mood Types with Icons

| Mood Type  | Icon | Color            |
| ---------- | ---- | ---------------- |
| loved      | ❤️   | Red (#FF1744)    |
| happy      | 😊   | Yellow (#FFD600) |
| content    | 😌   | Green (#00C853)  |
| thoughtful | 🤔   | Blue (#2979FF)   |
| grateful   | 🙏   | Purple (#AA00FF) |

#### Data Storage

Moods are stored in Zustand store and persisted to LocalStorage:

```typescript
moods: [
  { date: '2024-10-28', mood: 'happy', note: 'Great day!' },
  { date: '2024-10-29', mood: 'loved', note: 'Received flowers' },
  { date: '2024-10-30', mood: 'grateful' },
];
```

#### Technical Considerations

- **Calendar Library**: Consider using `react-calendar` or build custom
- **Date Handling**: Use `date-fns` or `dayjs` for date manipulation
- **Visualization**: Use `recharts` or `chart.js` for trend charts
- **Mobile UX**: Ensure mood buttons are large enough for touch

---

### CountdownTimer

**Location**: `/src/components/CountdownTimer/` (placeholder)

**Status**: 🚧 Not Implemented

**Purpose**: Display countdown to upcoming anniversaries and special dates.

#### Planned Features

- **Next Anniversary**: Automatically selects nearest future date
- **Countdown Display**: Days, hours, minutes, seconds
- **Progress Ring**: Visual circular progress indicator
- **Anniversary List**: Show all upcoming anniversaries
- **Custom Countdowns**: Add non-anniversary dates to track
- **Celebration Animation**: Special effect when countdown reaches zero
- **Notification**: Optional reminder as date approaches

#### Anticipated State Dependencies

```typescript
const {
  settings, // Access relationship.anniversaries
} = useAppStore();
```

#### Component Structure (Proposed)

```
CountdownTimer
├── Featured Countdown Card
│   ├── Anniversary Label
│   ├── Countdown Display
│   │   ├── Days
│   │   ├── Hours
│   │   ├── Minutes
│   │   └── Seconds
│   ├── Progress Ring (SVG)
│   └── Anniversary Description
└── Upcoming Anniversaries List
    └── AnniversaryItem[] (map)
        ├── Label
        ├── Date
        └── Days Until
```

#### Countdown Logic

```typescript
function getTimeUntil(targetDate: string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const now = new Date();
  const target = new Date(targetDate);

  // If date has passed this year, use next year
  const thisYear = new Date(now.getFullYear(), target.getMonth(), target.getDate());
  const nextOccurrence =
    thisYear < now
      ? new Date(now.getFullYear() + 1, target.getMonth(), target.getDate())
      : thisYear;

  const diff = nextOccurrence.getTime() - now.getTime();

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}
```

#### Technical Considerations

- **Real-Time Updates**: Use `setInterval` to update every second
- **Performance**: Consider updating only when component is visible
- **Anniversary Recurrence**: Handle annual date recurrence
- **Celebration**: Confetti or animation when countdown hits zero
- **Cleanup**: Clear interval on unmount

---

### CustomNotes

**Location**: `/src/components/CustomNotes/` (placeholder)

**Status**: 🚧 Not Implemented

**Purpose**: Create and manage user-written custom messages.

#### Planned Features

- **Message Composer**: Textarea with category selection
- **Preview Mode**: See message as it will appear in DailyMessage
- **Message List**: View all custom messages
- **Edit/Delete**: Modify or remove custom messages
- **Category Filter**: View messages by category
- **Favorite on Creation**: Option to favorite immediately
- **Character Count**: Display character limit

#### Anticipated State Dependencies

```typescript
const {
  messages, // All messages (filter for isCustom: true)
  addMessage, // Create new custom message
  updateMessage, // Edit existing message (future action)
  deleteMessage, // Remove custom message (future action)
} = useAppStore();
```

#### Component Structure (Proposed)

```
CustomNotes
├── Header
│   ├── Title
│   └── Add New Button
├── Message Composer (conditional)
│   ├── Textarea (message text)
│   ├── Category Selector (dropdown)
│   ├── Favorite Toggle
│   ├── Character Counter
│   ├── Preview Button
│   └── Save/Cancel Buttons
├── Category Filter Tabs
└── Custom Messages List
    └── CustomMessageCard[] (map)
        ├── Message Text (truncated)
        ├── Category Badge
        ├── Favorite Indicator
        └── Edit/Delete Actions
```

#### Category Selection

```typescript
const categories: { value: MessageCategory; label: string }[] = [
  { value: 'reason', label: '💖 Reason I Love You' },
  { value: 'memory', label: '✨ Memory' },
  { value: 'affirmation', label: '🌟 Affirmation' },
  { value: 'future', label: '🌈 Our Future' },
  { value: 'custom', label: '💕 Custom' },
];
```

#### Validation

- **Min Length**: 5 characters
- **Max Length**: 500 characters (recommended)
- **Required Fields**: text, category

#### Technical Considerations

- **Rich Text**: Consider allowing basic formatting (bold, italic)
- **Auto-Save**: Save draft to LocalStorage
- **Confirmation**: Confirm before deleting messages
- **Search**: Add search functionality for large message collections

---

### Settings

**Location**: `/src/components/Settings/` (placeholder)

**Status**: 🚧 Not Implemented

**Purpose**: App configuration and preferences panel.

#### Planned Features

- **Theme Selector**: Choose from available themes with preview
- **Notification Settings**: Enable/disable and set time
- **Relationship Settings**: Edit partner name, start date
- **Anniversary Management**: Add/edit/delete anniversaries
- **Customization**: Accent color picker, font selection
- **Data Management**: Export/import, clear data, reset app
- **About Section**: App version, credits, links

#### Anticipated State Dependencies

```typescript
const {
  settings, // Current settings
  updateSettings, // Update settings
  setTheme, // Change theme
  addAnniversary, // Add anniversary
  removeAnniversary, // Delete anniversary
} = useAppStore();
```

#### Component Structure (Proposed)

```
Settings
├── Header
│   ├── Title
│   └── Back Button
└── Settings Sections
    ├── Theme Section
    │   └── Theme Picker (grid of theme cards)
    ├── Notifications Section
    │   ├── Enable Toggle
    │   └── Time Picker
    ├── Relationship Section
    │   ├── Partner Name Input
    │   ├── Start Date Input
    │   └── Anniversary List
    │       └── Anniversary Item[] (map)
    │           ├── Label & Date
    │           └── Delete Button
    ├── Customization Section
    │   ├── Accent Color Picker
    │   └── Font Selector
    ├── Data Management Section
    │   ├── Export Data Button
    │   ├── Import Data Button
    │   └── Clear All Data Button (danger)
    └── About Section
        ├── Version Number
        ├── Developer Credit
        └── GitHub Link
```

#### Theme Preview

Each theme card shows:

- Theme name
- Color swatch preview
- Sample gradient background
- Active indicator (checkmark)

#### Data Export Format

```json
{
  "version": "1.0",
  "exportDate": "2024-10-30T12:00:00Z",
  "settings": { ... },
  "messages": [ ... ],
  "photos": [ ... ],
  "moods": [ ... ]
}
```

#### Technical Considerations

- **Confirmation Dialogs**: Warn before destructive actions
- **Data Validation**: Validate imported data structure
- **Theme Live Preview**: Show instant preview on theme change
- **Accessibility**: High contrast mode option
- **Privacy**: Explain data storage (client-side only)

---

### Layout

**Location**: `/src/components/Layout/` (placeholder)

**Status**: 🚧 Not Implemented

**Purpose**: Shared layout components for consistent UI structure.

#### Planned Components

##### Header

- App title/logo
- Navigation menu toggle (mobile)
- Theme indicator

##### Footer

- Copyright notice
- Quick links
- Version number

##### Navigation

- Bottom navigation bar (mobile)
- Sidebar navigation (desktop)
- Active route indicator
- Icon-based menu items

#### Anticipated Structure

```
Layout/
├── Header.tsx
├── Footer.tsx
├── Navigation.tsx
└── Layout.tsx (wrapper)
```

#### Navigation Items

```typescript
const navItems: NavItem[] = [
  { route: 'home', label: 'Today', icon: 'Home' },
  { route: 'memories', label: 'Photos', icon: 'Camera' },
  { route: 'moods', label: 'Moods', icon: 'Heart' },
  { route: 'countdown', label: 'Countdown', icon: 'Calendar' },
  { route: 'settings', label: 'Settings', icon: 'Settings' },
];
```

#### Layout Wrapper Example

```typescript
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <Footer />
      <Navigation />
    </div>
  );
}
```

#### Technical Considerations

- **Sticky Header**: Fixed position on scroll
- **Bottom Navigation**: Only on mobile (<768px)
- **Active State**: Highlight current route
- **Accessibility**: Semantic HTML, ARIA labels
- **Theme Integration**: Use theme colors from context

---

## Component Organization

### Directory Structure

```
src/components/
├── DailyMessage/
│   └── DailyMessage.tsx          ✅ Implemented
├── Onboarding/
│   └── Onboarding.tsx            ✅ Implemented
├── PhotoMemory/                  🚧 Placeholder
├── MoodTracker/                  🚧 Placeholder
├── CountdownTimer/               🚧 Placeholder
├── CustomNotes/                  🚧 Placeholder
├── Settings/                     🚧 Placeholder
└── Layout/                       🚧 Placeholder
```

### Component Naming Conventions

- **PascalCase** for component files and directories
- **Index exports** for easier imports (optional)
- **Co-located styles** if using CSS modules (not currently)
- **One component per file** (unless small, tightly coupled components)

### Import Pattern

```typescript
// Named export (current pattern)
import { DailyMessage } from './components/DailyMessage/DailyMessage';

// Index export (future pattern with index.ts files)
import { DailyMessage } from './components/DailyMessage';
```

---

## Component Development Checklist

When implementing a new component:

- [ ] Create directory: `/src/components/ComponentName/`
- [ ] Create component file: `ComponentName.tsx`
- [ ] Define TypeScript interfaces for props (if any)
- [ ] Add Zustand state dependencies
- [ ] Implement responsive design (mobile-first)
- [ ] Add Framer Motion animations
- [ ] Include proper TypeScript types
- [ ] Add accessibility attributes (ARIA labels, semantic HTML)
- [ ] Test keyboard navigation
- [ ] Test with screen reader (if critical functionality)
- [ ] Add component to this inventory document
- [ ] Update `/docs/architecture.md` if adding new patterns

---

## Shared Component Patterns

### Animation Pattern

```typescript
import { motion, AnimatePresence } from 'framer-motion';

export function MyComponent() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Content */}
    </motion.div>
  );
}
```

### Store Hook Pattern

```typescript
import { useAppStore } from '../../stores/useAppStore';

export function MyComponent() {
  // Selective subscription (performance optimization)
  const data = useAppStore((state) => state.data);
  const action = useAppStore((state) => state.action);

  return <div>{/* Use data and action */}</div>;
}
```

### Loading State Pattern

```typescript
export function MyComponent() {
  const [isLoading, setIsLoading] = useState(false);

  if (isLoading) {
    return <div className="text-pink-400">Loading...</div>;
  }

  return <div>{/* Actual content */}</div>;
}
```

---

## Related Documentation

- **Architecture**: See `/docs/architecture.md`
- **State Management**: See `/docs/state-management.md`
- **Data Models**: See `/docs/data-models.md`
- **Development Guide**: See `/docs/development-guide.md`
