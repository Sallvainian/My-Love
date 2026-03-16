# Table of Contents

1. [Component Hierarchy](./component-hierarchy.md)
   - App root tree
   - Lazy-loaded view branches
   - Auth flow gates
   - Together mode phase routing

2. [Component Inventory Table](./component-inventory-table.md)
   - All components organized by directory
   - Props interfaces
   - Store connections
   - Key features per component

3. [Feature Components](./feature-components.md)
   - Home View (DailyMessage, CountdownTimer, RelationshipTimers, WelcomeSplash)
   - Auth (LoginScreen, DisplayNameSetup)
   - Photos (PhotoGallery, PhotoUpload, PhotoCarousel, PhotoViewer, PhotoEditModal)
   - Mood (MoodTracker, MoodHistoryTimeline, MoodHistoryCalendar, PartnerMoodDisplay)
   - Partner (PartnerMoodView, PokeKissInterface, InteractionHistory)
   - Notes (LoveNotes, MessageList, MessageInput, LoveNoteMessage, ImagePreview, FullScreenImageViewer)
   - Scripture Reading (ScriptureOverview, SoloReadingFlow, LobbyContainer, ReadingContainer, + 10 presentational)
   - Admin (AdminPanel, MessageList, CreateMessageForm, EditMessageForm, DeleteConfirmDialog)

4. [Shared & Utility Components](./shared-and-utility-components.md)
   - NetworkStatusIndicator / NetworkStatusDot
   - SyncToast
   - ErrorBoundary / ViewErrorBoundary

5. [Design Patterns](./design-patterns.md)
   - Container/Presentational pattern
   - Lazy loading with Suspense
   - React.memo for performance
   - Class-based ErrorBoundary
   - Optimistic UI updates
   - Virtualized lists
   - Focus management and accessibility
   - Realtime subscriptions

6. [State Connections](./state-connections.md)
   - Zustand slice usage per component
   - useShallow selector pattern
   - Custom hooks as store wrappers

7. [Component Statistics](./component-statistics.md)
   - Per-directory component counts
   - LOC breakdown by feature
   - Pattern frequency analysis
