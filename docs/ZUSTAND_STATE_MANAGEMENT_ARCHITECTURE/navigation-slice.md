# NAVIGATION SLICE

## File

`src/stores/slices/navigationSlice.ts`

## Purpose

Manages view routing: tab/page switching with browser history integration.

## State Interface

```typescript
export type ViewType = 'home' | 'photos' | 'mood' | 'partner';

export interface NavigationSlice {
  // State
  currentView: ViewType;

  // Actions
  setView: (view: ViewType, skipHistory?: boolean) => void;
  navigateHome: () => void;
  navigatePhotos: () => void;
  navigateMood: () => void;
  navigatePartner: () => void;
}
```

## State Shape

```typescript
{
  currentView: 'home' | 'photos' | 'mood' | 'partner',
}
```

## Initial State

```typescript
currentView: 'home',
```

## Actions

### setView(view, skipHistory?)

**Type**: Sync  
**Input**: ViewType, optional skipHistory flag  
**Purpose**: Change current view with optional history update

**Process**:

1. Update `currentView` state
2. If `!skipHistory`:
   - Map ViewType to URL path
   - Call `window.history.pushState({ view }, '', path)`
   - Log navigation
3. UI re-renders automatically

**View → URL Mapping**:

```typescript
{
  home: '/',
  photos: '/photos',
  mood: '/mood',
  partner: '/partner',
}
```

**skipHistory Use Case**:

- Called during `popstate` event handler
- Prevents duplicate history entries
- URL already updated by browser back button

### navigateHome()

**Type**: Sync  
**Convenience**: `setView('home')`

### navigatePhotos()

**Type**: Sync  
**Convenience**: `setView('photos')`

### navigateMood()

**Type**: Sync  
**Convenience**: `setView('mood')`

### navigatePartner()

**Type**: Sync  
**Convenience**: `setView('partner')`

## Browser History Integration

**Problem**: Zustand state and browser history can get out of sync

**Solution**:

1. Store route in both Zustand state + URL
2. On browser back/forward:
   - Listen to `popstate` event
   - Extract view from `event.state`
   - Call `setView(view, skipHistory=true)` to sync state
   - URL is already updated by browser

**Implementation** (in component, not in slice):

```typescript
useEffect(() => {
  const handlePopstate = (event: PopStateEvent) => {
    const view = event.state?.view || 'home';
    useAppStore.setState({ currentView: view }); // Skip history to prevent duplicate
  };

  window.addEventListener('popstate', handlePopstate);
  return () => window.removeEventListener('popstate', handlePopstate);
}, []);
```

## Persistence

- **What**: NOT persisted to LocalStorage
- **Where**: Browser URL (location.pathname)
- **When**: On app mount, read URL to restore view
- **How**: Component-level logic reads `window.location.pathname`

## Dependencies

**Cross-Slice**: None (self-contained)

**External**: Browser History API

---
