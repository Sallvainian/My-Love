# My-Love Coding Standards

Standards and conventions for the My-Love relationship app codebase.

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| React Components | PascalCase.tsx | `MoodTracker.tsx`, `PhotoGallery.tsx` |
| Hooks | use[Name].ts | `useAppStore.ts`, `usePhotos.ts` |
| Services | [Name]Service.ts | `PhotoService.ts`, `MoodService.ts` |
| Slices | [name]Slice.ts | `settingsSlice.ts`, `photosSlice.ts` |
| Utilities | camelCase.ts | `haptics.ts`, `permissions.ts` |
| Types | index.ts in types/ | `src/types/index.ts` |
| Schemas | schemas.ts in validation/ | `src/validation/schemas.ts` |
| Tests | [file].test.ts | `haptics.test.ts`, `MoodTracker.test.tsx` |

---

## TypeScript Standards

### Strict Mode
- `strict: true` enabled in tsconfig.json
- `noUncheckedIndexedAccess: true` for safer array/object access
- `noUnusedLocals: true`, `noUnusedParameters: true`

### Type Definitions
```typescript
// Prefer interfaces for object shapes
interface MoodEntry {
  id: string;
  date: string;
  mood: MoodType;
  note?: string;
}

// Use types for unions, primitives, complex types
type MoodType = 'happy' | 'content' | 'neutral' | 'sad' | 'stressed';
type ColorTheme = 'sunset' | 'ocean' | 'lavender' | 'rose';

// Never use `any` - use `unknown` and narrow
function parseData(data: unknown): MoodEntry {
  // Validate and narrow type
}
```

### Unused Variables
Prefix with underscore to indicate intentionally unused:
```typescript
// ESLint pattern: "^_" allowed for unused vars
function handler(_event: Event) {
  // Event intentionally unused
}
```

---

## React Patterns

### Functional Components Only
```typescript
// Always functional components with hooks
export function MoodTracker() {
  const [mood, setMood] = useState<MoodType>('neutral');

  return (/* JSX */);
}

// Named exports preferred over default exports
export function PhotoGallery() { }
```

### Hook Patterns
```typescript
// Custom hooks for reusable logic
function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### Event Handlers
```typescript
// Inline handlers for simple actions
<button onClick={() => setOpen(true)}>Open</button>

// Named handlers for complex logic
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  await saveMood(mood);
};
<form onSubmit={handleSubmit}>
```

---

## State Management (Zustand)

### Slice Pattern
```typescript
import { StateCreator } from 'zustand';
import { AppState } from '../useAppStore';

export interface SettingsSlice {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  updateSettings: (partial: Partial<Settings>) => void;
}

export const createSettingsSlice: StateCreator<
  AppState,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settings: defaultSettings,

  setSettings: (settings) => {
    const validated = SettingsSchema.parse(settings);
    set({ settings: validated });
  },

  updateSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial }
  })),
});
```

### Store Composition
```typescript
// useAppStore.ts - combine all slices
export const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createSettingsSlice(...args),
      ...createPhotosSlice(...args),
      ...createMoodsSlice(...args),
    }),
    {
      name: 'my-love-storage',
      partialize: (state) => ({
        settings: state.settings,
        // Only persist specific slices
      }),
    }
  )
);
```

---

## Validation (Zod)

### Schema Definitions
```typescript
// src/validation/schemas.ts
import { z } from 'zod';

export const MoodEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().datetime(),
  mood: z.enum(['happy', 'content', 'neutral', 'sad', 'stressed']),
  note: z.string().max(500).optional(),
});

export type MoodEntry = z.infer<typeof MoodEntrySchema>;
```

### Validation at Boundaries
```typescript
// Validate at service layer, not component layer
class MoodService extends BaseIndexedDBService<MoodEntry> {
  async add(entry: MoodEntry): Promise<string> {
    const validated = MoodEntrySchema.parse(entry);
    return super.add(validated);
  }
}
```

---

## Animation (Framer Motion)

### Standard Patterns
```typescript
import { motion, AnimatePresence } from 'framer-motion';

// Fade in animation
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>

// Scale animation
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>

// AnimatePresence for conditional renders
<AnimatePresence mode="wait">
  {isVisible && <motion.div key="modal">...</motion.div>}
</AnimatePresence>
```

### Custom Animations (Tailwind)
```css
/* Defined in tailwind.config.js */
animation: {
  'float': 'float 3s ease-in-out infinite',
  'fade-in': 'fadeIn 0.3s ease-out',
  'scale-in': 'scaleIn 0.2s ease-out',
  'heart-beat': 'heartBeat 1.5s ease-in-out infinite',
}
```

---

## Styling (Tailwind CSS)

### Class Organization
```html
<!-- Order: layout → spacing → sizing → visual → interactive -->
<div class="flex flex-col gap-4 p-6 w-full bg-white rounded-lg shadow-lg hover:shadow-xl">
```

### Responsive Design
```html
<!-- Mobile-first with responsive prefixes -->
<div class="w-full md:w-1/2 lg:w-1/3">
<div class="text-sm md:text-base lg:text-lg">
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### State Variants
```html
<button class="
  bg-blue-500
  hover:bg-blue-600
  focus:ring-2 focus:ring-blue-300
  active:bg-blue-700
  disabled:opacity-50 disabled:cursor-not-allowed
">
```

### Custom Theme Colors
```javascript
// Use project theme colors
colors: {
  sunset: { 50-950 },
  ocean: { 50-950 },
  lavender: { 50-950 },
  rose: { 50-950 },
}
```

---

## Error Handling

### Service Layer
```typescript
// Read operations fail gracefully
async getAll(): Promise<T[]> {
  try {
    return await this.db.getAll();
  } catch (error) {
    console.error('Failed to fetch:', error);
    return []; // Graceful fallback
  }
}

// Write operations throw
async add(item: T): Promise<string> {
  try {
    return await this.db.add(item);
  } catch (error) {
    throw new Error(`Failed to save: ${error.message}`);
  }
}
```

### Component Layer
```typescript
// Use error boundaries for component errors
// Show user-friendly messages
// Log to console for debugging
const [error, setError] = useState<string | null>(null);

try {
  await saveData();
} catch (err) {
  setError('Failed to save. Please try again.');
  console.error('Save error:', err);
}
```

---

## ESLint Rules

```javascript
// Key rules from eslint.config.js
rules: {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', {
    argsIgnorePattern: '^_',      // _event, _unused
    varsIgnorePattern: '^_',       // _temp
  }],
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
}
```

---

## Import Organization

```typescript
// 1. React/External libraries
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';

// 2. Internal modules (absolute imports with @/)
import { useAppStore } from '@/stores/useAppStore';
import { MoodService } from '@/services/MoodService';
import { MoodEntrySchema } from '@/validation/schemas';

// 3. Types
import type { MoodEntry, Settings } from '@/types';

// 4. Assets/Styles (if any)
import './MoodTracker.css';
```

---

## Testing Standards

See DEVELOPMENT_PRACTICES.md for full testing guidelines.

Quick reference:
- Co-locate tests in `__tests__` directories
- Use Vitest with `describe/it/expect` pattern
- Mock external dependencies with `vi.mock()`
- Clear mocks between tests with `vi.clearAllMocks()`
