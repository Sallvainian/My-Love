# Performance Optimizations

## Selector Memoization

```typescript
// Derive computed values efficiently
const selectFavoriteCount = (state: AppState) => state.favorites.length;
const selectUnreadInteractions = (state: AppState) => state.unreadCount;

// Composed selector
const selectNotificationData = (state: AppState) => ({
  favoriteCount: state.favorites.length,
  unreadCount: state.unreadCount,
  hasNotifications: state.favorites.length > 0 || state.unreadCount > 0,
});
```

## Avoiding Unnecessary Renders

```typescript
// ❌ Bad: Creates new array on every render
const Component = () => {
  const messages = useAppStore((state) => [...state.messageHistory].reverse());
  // ...
};

// ✅ Good: Selector returns stable reference
const selectReversedHistory = (state: AppState) => {
  // Only recalculated when messageHistory changes
  return state.messageHistory.slice().reverse();
};

const Component = () => {
  const messages = useAppStore(selectReversedHistory);
  // ...
};
```

## Subscription Splitting

```typescript
// Split subscriptions for independent updates
const Header = () => {
  // Only re-renders when displayName changes
  const displayName = useAppStore((state) => state.displayName);
  return <h1>Welcome, {displayName}</h1>;
};

const ThemeToggle = () => {
  // Only re-renders when theme changes
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  return <button onClick={() => setTheme(nextTheme(theme))}>{theme}</button>;
};
```
