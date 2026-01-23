---
paths:
  - "src/api/**/*.ts"
  - "src/services/**/*.ts"
---

# API & Service Layer

## Three-Tier Architecture
1. **Supabase API** - Remote data operations
2. **IndexedDB Services** - Local data persistence
3. **Sync Orchestration** - Bidirectional sync

## Zod Validation (MANDATORY)
```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

const result = UserSchema.safeParse(apiResponse);
if (!result.success) {
  // Handle validation error
}
```

## Error Handling Strategy
- **Read operations**: Graceful degradation (return empty/null)
- **Write operations**: Throw on error (explicit handling required)
- Retry with exponential backoff for network errors

## Broadcast API
- Use for real-time updates (RLS workaround)
- Subscribe to channels for live data sync

## Offline-First Pattern
1. Write to IndexedDB immediately
2. Queue remote sync operation
3. Retry failed syncs on reconnection
