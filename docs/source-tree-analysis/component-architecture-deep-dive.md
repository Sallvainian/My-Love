# Component Architecture Deep Dive

## Feature Component Breakdown

### 📸 Photo Management Suite (6 components)

```
PhotoUpload/
└── PhotoUpload.tsx              # 📥 File selection, compression, IndexedDB storage
    ├── Handles: file input, drag-drop
    ├── Integrates: imageCompressionService
    └── Dispatches: addPhoto action

PhotoGallery/
├── PhotoGallery.tsx             # 📊 Grid layout container
├── PhotoGridItem.tsx            # 🖼️ Individual photo thumbnail
└── PhotoGridSkeleton.tsx        # 💀 Loading placeholder

PhotoCarousel/
├── PhotoCarousel.tsx            # 🎠 Full-screen viewer
└── PhotoCarouselControls.tsx    # ⏩ Navigation controls

PhotoEditModal/
└── PhotoEditModal.tsx           # ✏️ Caption/date editing

PhotoDeleteConfirmation/
└── PhotoDeleteConfirmation.tsx  # 🗑️ Confirmation dialog
```

### 😊 Mood Tracking Suite (4 components)

```
MoodTracker/
├── MoodTracker.tsx              # 🎯 Main mood selection interface
└── MoodButton.tsx               # 🔘 Individual emotion button

MoodHistory/
├── MoodHistoryCalendar.tsx      # 📅 Calendar grid view
├── CalendarDay.tsx              # 📆 Single day cell
├── MoodDetailModal.tsx          # 🔍 Detailed mood view
└── index.ts                     # Barrel export

PartnerMoodView/
├── PartnerMoodView.tsx          # 👥 Partner's current mood display
└── index.ts
```

### 💬 Message Management (7 components)

```
DailyMessage/
└── DailyMessage.tsx             # 💕 Primary message display
    ├── Features: favorites, swipe navigation
    ├── Uses: messageRotation utility
    └── State: messagesSlice

AdminPanel/
├── AdminPanel.tsx               # 🎛️ Main admin container
├── MessageList.tsx              # 📋 Paginated message list
├── MessageRow.tsx               # 📝 Individual message row
├── CreateMessageForm.tsx        # ➕ New message creation
├── EditMessageForm.tsx          # ✏️ Message editing
└── DeleteConfirmDialog.tsx      # 🗑️ Delete confirmation
```

### 🔐 Authentication Flow (3 components)

```
LoginScreen/
├── LoginScreen.tsx              # 🔑 Email/password form
├── LoginScreen.css              # Styling
└── index.ts

DisplayNameSetup/
├── DisplayNameSetup.tsx         # 👤 Post-login name setup
├── DisplayNameSetup.css
└── index.ts

WelcomeSplash/
└── WelcomeSplash.tsx            # 🎉 First-time experience
```

### 💑 Partner Interaction (2 components)

```
PokeKissInterface/
├── PokeKissInterface.tsx        # 👆💋 Poke/Kiss buttons
└── index.ts                     # Rate limiting, animations

InteractionHistory/
├── InteractionHistory.tsx       # 📜 History timeline
└── index.ts
```
