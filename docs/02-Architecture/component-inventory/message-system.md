# 💬 Message System

## DailyMessage

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

## AdminPanel

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
