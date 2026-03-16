# Navigation Slice

**File:** `src/stores/slices/navigationSlice.ts`
**Interface:** `NavigationSlice`

## Purpose

Manages view-based routing using a `ViewType` union and integrates with browser history for back/forward navigation support.

## State

| Field         | Type       | Default  | Persisted | Description           |
| ------------- | ---------- | -------- | --------- | --------------------- |
| `currentView` | `ViewType` | `'home'` | No        | Currently active view |

## ViewType Union

```typescript
type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';
```

## Actions

| Action              | Signature                                         | Description                                      |
| ------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `setView`           | `(view: ViewType, skipHistory?: boolean) => void` | Sets `currentView` and pushes to browser history |
| `navigateHome`      | `() => void`                                      | Convenience: sets view to `'home'`               |
| `navigatePhotos`    | `() => void`                                      | Convenience: sets view to `'photos'`             |
| `navigateMood`      | `() => void`                                      | Convenience: sets view to `'mood'`               |
| `navigatePartner`   | `() => void`                                      | Convenience: sets view to `'partner'`            |
| `navigateNotes`     | `() => void`                                      | Convenience: sets view to `'notes'`              |
| `navigateScripture` | `() => void`                                      | Convenience: sets view to `'scripture'`          |

## Browser History Integration

When `setView` is called (with `skipHistory = false`):

1. Updates `currentView` in Zustand state
2. Builds URL path respecting `BASE_URL` for GitHub Pages (e.g., `/My-Love/photos`)
3. Pushes to `window.history.pushState({ view }, '', fullPath)`

The `skipHistory` parameter prevents loops during `popstate` handling and initial route detection.

A `popstate` event listener in App.tsx handles browser back/forward buttons by parsing the pathname.

## Notes

- No persistence -- `currentView` is restored from URL on mount via App.tsx route detection.
- No cross-slice dependencies.
- Used by `BottomNavigation` component for tab switching and by components like `ScriptureOverview` for partner setup navigation (`setView('partner')`).
