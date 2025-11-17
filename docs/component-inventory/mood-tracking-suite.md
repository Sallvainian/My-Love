# 😊 Mood Tracking Suite

## MoodTracker

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

## MoodHistory

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

## PartnerMoodView

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
