# Component Inventory - My-Love PWA

> Exhaustive component inventory for the My-Love React 19 Progressive Web Application.
> Generated from complete source code analysis of all component files.

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Exported Components | 73 |
| Total Internal/Sub-Components | 21 |
| Feature Groups | 16 |
| Shared/Utility Components | 4 (NetworkStatusIndicator, NetworkStatusDot, SyncToast, charCounter) |
| Barrel Export Files (index.ts) | 9 |
| Class Components | 2 (ErrorBoundary, ViewErrorBoundary) |
| Memoized Components (React.memo) | 5 (CalendarDay, MoodCard, LoveNoteMessage, FullScreenImageViewer, ImagePreview) |
| Lazy-Loaded Components | 9 |
| Virtualized Lists (react-window) | 2 (MessageList, MoodHistoryTimeline) |

## Tech Stack

- **React** 19.2.4 with TypeScript 5.9
- **State Management**: Zustand 5.0.11 (`useAppStore`) with `useShallow` selector
- **Animations**: Framer Motion (imported as `m as motion` for tree-shaking; `LazyMotion` in scripture)
- **Icons**: Lucide React (Heart, Camera, Upload, X, Sparkles, Calendar, Bookmark, etc.)
- **Virtualization**: react-window v2 (`List`, `useListRef`) + react-window-infinite-loader (`useInfiniteLoader`)
- **Backend**: Supabase (Auth with email/password + Google OAuth, Database, Realtime Broadcast)
- **Styling**: Tailwind CSS 4.1 (utility-first, dark mode via class)
- **Sanitization**: DOMPurify (XSS prevention in LoveNoteMessage)
- **Image Processing**: imageCompressionService (client-side compression before upload)

## Documentation Files

| File | Description |
|------|-------------|
| [Table of Contents](./table-of-contents.md) | Full navigation index |
| [Component Hierarchy](./component-hierarchy.md) | Visual component tree with parent-child relationships |
| [Component Inventory Table](./component-inventory-table.md) | Every component with path, props, store connections, features |
| [Feature Components](./feature-components.md) | Detailed documentation per feature group |
| [Shared & Utility Components](./shared-and-utility-components.md) | Cross-cutting shared components |
| [Design Patterns](./design-patterns.md) | Patterns found across the codebase |
| [State Connections](./state-connections.md) | Zustand store slice usage matrix |
| [Component Statistics](./component-statistics.md) | Total counts, LOC, categories |
