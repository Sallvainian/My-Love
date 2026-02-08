# Validation Architecture

Zod schemas are defined in `validation/schemas.ts` and applied at service boundaries:

```
User Input -> Zod Schema Validation -> Service Layer -> IndexedDB/Supabase
                                                           |
Supabase Response -> Zod Schema Validation -> Service Layer -> Zustand State
```

**Domain schemas:**
- `MessageSchema`, `CreateMessageInputSchema`, `UpdateMessageInputSchema`
- `PhotoSchema`, `PhotoUploadInputSchema`
- `MoodEntrySchema` (supports single mood and multi-mood array)
- `SettingsSchema` (nested: relationship, customization, notifications)
- `CustomMessagesExportSchema` (import/export format)
- `SupabaseSessionSchema`, `SupabaseReflectionSchema`, `SupabaseBookmarkSchema`, `SupabaseMessageSchema`

Each schema validates against configured limits from `config/performance.ts` (message text max length, etc.).

---
