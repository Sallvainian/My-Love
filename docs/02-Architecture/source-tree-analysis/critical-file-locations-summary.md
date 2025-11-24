# Critical File Locations Summary

## Must-Know Files for Development

| Category       | Files                                 | Purpose                 |
| -------------- | ------------------------------------- | ----------------------- |
| **Entry**      | `main.tsx`, `App.tsx`                 | Application bootstrap   |
| **State**      | `useAppStore.ts`, `slices/*`          | Global state management |
| **Types**      | `types/index.ts`, `database.types.ts` | Type definitions        |
| **API**        | `supabaseClient.ts`, `*Service.ts`    | Backend communication   |
| **Storage**    | `BaseIndexedDBService.ts`             | Local persistence       |
| **Config**     | `constants.ts`, `themes.ts`           | App configuration       |
| **Validation** | `validation/schemas.ts`               | Input validation        |

## Hot Paths (Most Frequently Modified)

1. `src/components/` - UI changes
2. `src/stores/slices/` - State logic changes
3. `src/api/` - Backend integration
4. `src/types/index.ts` - Type additions
5. `src/services/` - Business logic
