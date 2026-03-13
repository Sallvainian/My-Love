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

| Action         | Signature                  | Description                                      |
| -------------- | -------------------------- | ------------------------------------------------ |
| `setView`      | `(view: ViewType) => void` | Sets `currentView` and pushes to browser history |
| `navigateHome` | `() => void`               | Convenience action, sets view to `'home'`        |

## Browser History Integration

When `setView` is called:

1. Updates `currentView` in Zustand state
2. Pushes a new entry to `window.history` with `pushState({ view }, '', url)`
3. The URL includes a `?view=` query parameter for the non-home views

A `popstate` event listener handles browser back/forward buttons by reading the view from `history.state`.

## Notes

- No persistence -- `currentView` resets to `'home'` on page reload.
- No cross-slice dependencies.
- Used by `BottomNavigation` component for tab switching and by components like `ScriptureOverview` for partner setup navigation (`setView('partner')`).
