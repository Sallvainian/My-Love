# Component Inventory

> **Last Updated**: 2025-11-16
> **Total Components**: 20 implemented
> **Total Files**: 48 TSX/TS files

## Overview

This catalog documents all UI components in My Love PWA, organized by feature domain.

## Component Summary by Feature

| Feature Domain      | Components | Primary Files                                                                     |
| ------------------- | ---------- | --------------------------------------------------------------------------------- |
| Photo Management    | 6          | PhotoUpload, PhotoGallery, PhotoCarousel, PhotoEditModal, PhotoDeleteConfirmation |
| Mood Tracking       | 4          | MoodTracker, MoodHistory, PartnerMoodView                                         |
| Message System      | 7          | DailyMessage, AdminPanel (6 sub-components)                                       |
| Authentication      | 3          | LoginScreen, DisplayNameSetup, WelcomeSplash                                      |
| Partner Interaction | 2          | PokeKissInterface, InteractionHistory                                             |
| Navigation          | 1          | BottomNavigation                                                                  |
| Settings            | 2          | Settings, AnniversarySettings                                                     |
| Core                | 3          | CountdownTimer, ErrorBoundary, WelcomeButton                                      |

---

## 📸 Photo Management Suite

### PhotoUpload

**Location**: `src/components/PhotoUpload/PhotoUpload.tsx`
**Status**: ✅ Implemented

**Purpose**: Upload and compress photos for storage in IndexedDB

**Features**:

- Drag-and-drop file zone
- Click-to-select file input
- Automatic image compression (Canvas API)
- Progress indicator during upload
- File type validation (JPEG, PNG, WebP)
- Size limits enforcement (10MB max)
- Thumbnail generation for gallery

**Dependencies**: `imageCompressionService`, `photosSlice`

---

### PhotoGallery

**Location**: `src/components/PhotoGallery/`
**Status**: ✅ Implemented

**Files**:

- `PhotoGallery.tsx` - Grid container with infinite scroll
- `PhotoGridItem.tsx` - Individual photo card with hover effects
- `PhotoGridSkeleton.tsx` - Loading placeholder skeleton

**Purpose**: Grid-based photo browser with lazy loading

**Features**:

- Responsive grid layout (2-4 columns)
- Infinite scroll pagination
- Click to open carousel view
- Long-press/right-click context menu
- Skeleton loading states
- Empty state messaging

**Dependencies**: `photosSlice`, `photoStorageService`

---

### PhotoCarousel

**Location**: `src/components/PhotoCarousel/`
**Status**: ✅ Implemented

**Files**:

- `PhotoCarousel.tsx` - Full-screen viewer with gestures
- `PhotoCarouselControls.tsx` - Navigation arrows, close button

**Purpose**: Full-screen photo viewing experience

**Features**:

- Swipe gesture navigation (touch devices)
- Keyboard arrow key support
- Pinch-to-zoom capability
- Auto-hide controls after inactivity
- Photo counter display (3 of 12)
- Caption overlay

**Dependencies**: `photosSlice`, Framer Motion

---

### PhotoEditModal

**Location**: `src/components/PhotoEditModal/PhotoEditModal.tsx`
**Status**: ✅ Implemented

**Purpose**: Edit photo metadata (caption, date)

**Features**:

- Caption text input with character limit
- Date picker for "date taken"
- Save/Cancel buttons
- Form validation
- Animated modal entry/exit

**Dependencies**: `photosSlice`, Zod validation

---

### PhotoDeleteConfirmation

**Location**: `src/components/PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx`
**Status**: ✅ Implemented

**Purpose**: Confirm permanent photo deletion

**Features**:

- Destructive action warning
- Photo thumbnail preview
- Confirm/Cancel actions
- Keyboard escape to dismiss

---

## 😊 Mood Tracking Suite

### MoodTracker

**Location**: `src/components/MoodTracker/`
**Status**: ✅ Implemented

**Files**:

- `MoodTracker.tsx` - Main mood selection interface
- `MoodButton.tsx` - Individual emotion button with animations

**Purpose**: Log daily emotional state with multi-emotion support

**Features**:

- 12 emotion options (6 positive, 6 negative)
- Multi-select capability (select multiple moods)
- Intensity slider (1-5 scale)
- Optional note input (500 char max)
- Animated button press feedback
- Rate limiting (max 10/hour)
- Local-first with cloud sync

**Dependencies**: `moodSlice`, `moodApi`, Zod validation

---

### MoodHistory

**Location**: `src/components/MoodHistory/`
**Status**: ✅ Implemented

**Files**:

- `MoodHistoryCalendar.tsx` - Monthly calendar grid
- `CalendarDay.tsx` - Individual day cell with mood indicator
- `MoodDetailModal.tsx` - Detailed view of selected day's mood
- `index.ts` - Barrel export

**Purpose**: Calendar-based mood history visualization

**Features**:

- Month/year navigation
- Color-coded intensity indicators
- Click day to view details
- Mood streaks highlighting
- Partner mood overlay (optional)
- Export history option

**Dependencies**: `moodSlice`, `calendarHelpers`

---

### PartnerMoodView

**Location**: `src/components/PartnerMoodView/`
**Status**: ✅ Implemented

**Purpose**: Display partner's current mood (real-time sync)

**Features**:

- Real-time updates via Supabase
- Emoji representation of mood
- "Last updated" timestamp
- Privacy indicator
- Gentle animations on update

**Dependencies**: `partnerSlice`, `moodSyncService`, `realtimeService`

---

## 💬 Message System

### DailyMessage

**Location**: `src/components/DailyMessage/DailyMessage.tsx`
**Status**: ✅ Implemented

**Purpose**: Primary feature - rotating daily love messages

**Features**:

- 365 pre-written messages (default library)
- Deterministic rotation algorithm (same message each day)
- Horizontal swipe to view history (backward only)
- Favorite toggle (heart icon)
- Share button with native share API
- Message category badges
- Relationship day counter
- 3D card flip animations

**Dependencies**: `messagesSlice`, `messageRotation`, `defaultMessages`, Framer Motion

---

### AdminPanel

**Location**: `src/components/AdminPanel/`
**Status**: ✅ Implemented

**Files** (6 components):

- `AdminPanel.tsx` - Main container with tabs
- `MessageList.tsx` - Paginated list of all messages
- `MessageRow.tsx` - Individual message row with actions
- `CreateMessageForm.tsx` - New message creation form
- `EditMessageForm.tsx` - Inline message editing
- `DeleteConfirmDialog.tsx` - Delete confirmation modal

**Purpose**: Manage custom messages (CRUD operations)

**Features**:

- View all default + custom messages
- Add custom messages
- Edit existing messages
- Delete custom messages (not defaults)
- Category assignment
- Preview before save
- Pagination (20 per page)
- Search/filter capability

**Dependencies**: `messagesSlice`, `customMessageService`, Zod validation

---

## 🔐 Authentication Flow

### LoginScreen

**Location**: `src/components/LoginScreen/`
**Status**: ✅ Implemented

**Purpose**: User authentication via Supabase Auth

**Features**:

- Email/password login form
- Sign up option
- "Forgot password" flow
- Form validation with error messages
- Loading states during auth
- Auto-redirect on success
- Remember me option

**Dependencies**: `authService`, `settingsSlice`, Zod validation

---

### DisplayNameSetup

**Location**: `src/components/DisplayNameSetup/`
**Status**: ✅ Implemented

**Purpose**: Post-login name configuration

**Features**:

- Display name input (1-50 chars)
- Character count indicator
- Partner name input (optional)
- Relationship start date picker
- Validation feedback
- Skip option for partner name

**Dependencies**: `settingsSlice`, Zod validation

---

### WelcomeSplash

**Location**: `src/components/WelcomeSplash/WelcomeSplash.tsx`
**Status**: ✅ Implemented

**Purpose**: First-time user onboarding experience

**Features**:

- Animated welcome message
- Feature highlights
- Get started button
- Auto-dismiss after viewing
- Sets `hasCompletedOnboarding` flag

**Dependencies**: `settingsSlice`, Framer Motion

---

## 💑 Partner Interaction

### PokeKissInterface

**Location**: `src/components/PokeKissInterface/`
**Status**: ✅ Implemented

**Purpose**: Send playful interactions to partner

**Features**:

- Poke button (finger emoji)
- Kiss button (lips emoji)
- Rate limiting (30s cooldown)
- Haptic feedback (if supported)
- Animation burst on send
- Disabled state during cooldown
- Success/error toast notifications

**Dependencies**: `interactionsSlice`, `interactionService`, `interactionValidation`

---

### InteractionHistory

**Location**: `src/components/InteractionHistory/`
**Status**: ✅ Implemented

**Purpose**: View timeline of sent/received interactions

**Features**:

- Chronological list view
- Sent vs received indicators
- Timestamp formatting
- Unread badges
- Mark as read on view
- Empty state messaging

**Dependencies**: `interactionsSlice`, `interactionService`

---

## 🧭 Navigation

### BottomNavigation

**Location**: `src/components/Navigation/BottomNavigation.tsx`
**Status**: ✅ Implemented

**Purpose**: App-wide navigation bar

**Features**:

- 5 navigation tabs (Home, Photos, Mood, Settings, Admin)
- Active tab highlighting
- Badge indicators (unread count)
- Smooth transition animations
- Fixed bottom position (mobile)
- Icon + label layout

**Dependencies**: `navigationSlice`, Lucide React icons

---

## ⚙️ Settings

### Settings

**Location**: `src/components/Settings/`
**Status**: ✅ Implemented

**Files**:

- `Settings.tsx` - Main settings page
- `AnniversarySettings.tsx` - Anniversary management sub-section
- `Settings.css` - Component styles
- `index.ts` - Barrel export

**Purpose**: User preferences and app configuration

**Features**:

- Theme selector (4 themes)
- Display name editing
- Partner name editing
- Relationship start date
- Anniversary management
- Logout action
- Data export option
- App version display

**Dependencies**: `settingsSlice`, Theme definitions

---

### AnniversarySettings

**Location**: `src/components/Settings/AnniversarySettings.tsx`
**Status**: ✅ Implemented

**Purpose**: Manage important dates and anniversaries

**Features**:

- Add new anniversary
- Edit existing anniversaries
- Delete anniversaries
- Set reminder days
- Recurring vs one-time toggle
- Date picker with validation

**Dependencies**: `settingsSlice`, `countdownService`

---

## 🎯 Core Utilities

### CountdownTimer

**Location**: `src/components/CountdownTimer/`
**Status**: ✅ Implemented

**Purpose**: Display countdown to next anniversary

**Features**:

- Days/hours/minutes remaining
- Live updating (every minute)
- Multiple anniversaries support
- "Upcoming" badge
- Past event handling
- Celebration animation on zero

**Dependencies**: `settingsSlice`, `countdownService`, `dateHelpers`

---

### ErrorBoundary

**Location**: `src/components/ErrorBoundary/ErrorBoundary.tsx`
**Status**: ✅ Implemented

**Purpose**: Graceful error handling and recovery

**Features**:

- Catches React render errors
- Friendly error message display
- Retry button
- Error logging (console)
- Prevents full app crash

**Dependencies**: React Error Boundary API

---

### WelcomeButton

**Location**: `src/components/WelcomeButton/WelcomeButton.tsx`
**Status**: ✅ Implemented

**Purpose**: Initial call-to-action trigger

**Features**:

- Prominent button styling
- Pulse animation attention-grab
- Theme-aware colors
- Click triggers onboarding flow

**Dependencies**: `settingsSlice`, Theme system

---

## Animation Specifications

All interactive components use Framer Motion with these patterns:

```typescript
// Standard entrance animation
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

// Button press feedback
const tapAnimation = {
  whileTap: { scale: 0.95 },
};

// Hover state
const hoverAnimation = {
  whileHover: { scale: 1.05 },
};
```

---

## Accessibility Features

All components implement:

- **Semantic HTML**: Proper element usage (button, form, etc.)
- **ARIA Labels**: Descriptive labels for screen readers
- **Keyboard Navigation**: Tab order, arrow keys, escape key
- **Focus Management**: Visible focus rings, focus trapping in modals
- **Color Contrast**: WCAG AA compliance (4.5:1 minimum)
- **Touch Targets**: Minimum 44x44px for mobile
- **Error Messages**: Clear, actionable error descriptions

---

**Generated by BMAD document-project workflow**
**Scan Level**: Exhaustive (all 48 component files analyzed)
