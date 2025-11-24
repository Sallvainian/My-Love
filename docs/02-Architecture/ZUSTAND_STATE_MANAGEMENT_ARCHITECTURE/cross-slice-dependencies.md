# Cross-Slice Dependencies

## Dependency Graph

```
Settings Slice
  ├─ Calls: Messages.updateCurrentMessage()
  └─ Uses: Messages.messages (after init)

Messages Slice
  ├─ Reads: Settings.settings.relationship.startDate
  └─ No outgoing slice calls

Photos Slice
  └─ No dependencies

Mood Slice
  └─ No dependencies

Partner Slice
  └─ No dependencies

Interactions Slice
  └─ No dependencies

Navigation Slice
  └─ No dependencies
```

## Critical Dependencies

### Settings → Messages

**Where**: `initializeApp()`

```typescript
// Settings Slice
initializeApp: async () => {
  // ...
  // Load messages from IndexedDB
  await storageService.getAllMessages();

  // Update current message to compute today's message
  if (state.updateCurrentMessage) {
    state.updateCurrentMessage(); // Calls Messages.updateCurrentMessage()
  }
};
```

**Why**: Messages need to be loaded before computing today's message

### Messages → Settings

**Where**: `navigateToPreviousMessage()`, `updateCurrentMessage()`

```typescript
// Messages Slice
updateCurrentMessage: () => {
  const { messages, messageHistory, settings } = get();

  if (!settings || messages.length === 0) return;

  const availableDays = getAvailableHistoryDays(messageHistory, settings);
  // Uses settings.relationship.startDate to limit history
};
```

**Why**: History limit depends on relationship start date

## No Circular Dependencies

All dependencies are **unidirectional**:

- Settings → Messages (downward)
- Messages ← Settings (reads, no callback)

This prevents circular dependency issues.

## Optional Dependencies

Slices check if cross-slice methods exist before calling:

```typescript
// In Settings Slice
if (state.updateCurrentMessage) {
  state.updateCurrentMessage(); // Safe if method missing
}
```

This allows testing slices in isolation.

---
