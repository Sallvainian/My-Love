# Store Architecture

## Main Store Composition

```typescript
// src/stores/useAppStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createSettingsSlice } from './slices/settingsSlice';
import { createMessagesSlice } from './slices/messagesSlice';
import { createPhotosSlice } from './slices/photosSlice';
import { createMoodSlice } from './slices/moodSlice';
import { createPartnerSlice } from './slices/partnerSlice';
import { createInteractionsSlice } from './slices/interactionsSlice';
import { createNavigationSlice } from './slices/navigationSlice';

export const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createSettingsSlice(...args),
      ...createMessagesSlice(...args),
      ...createPhotosSlice(...args),
      ...createMoodSlice(...args),
      ...createPartnerSlice(...args),
      ...createInteractionsSlice(...args),
      ...createNavigationSlice(...args),
    }),
    {
      name: 'my-love-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential data, not UI state
        settings: {
          displayName: state.displayName,
          theme: state.theme,
          partnerName: state.partnerName,
          relationshipStartDate: state.relationshipStartDate,
          anniversaries: state.anniversaries,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
        },
        messages: {
          currentDayNumber: state.currentDayNumber,
          favorites: state.favorites,
          customMessages: state.customMessages,
          shownMessageIds: Array.from(state.shownMessageIds),
        },
        photos: {
          // Photos stored in IndexedDB, not LocalStorage
        },
        mood: {
          // Mood history synced to Supabase
          moodHistory: state.moodHistory,
        },
      }),
    }
  )
);
```
