# ⚙️ Settings

## Settings

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

## AnniversarySettings

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
