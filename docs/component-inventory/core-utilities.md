# 🎯 Core Utilities

## CountdownTimer

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

## ErrorBoundary

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

## WelcomeButton

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
