import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMessagesSlice, type MessagesSlice } from './slices/messagesSlice';
import { createPhotosSlice, type PhotosSlice } from './slices/photosSlice';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createNavigationSlice, type NavigationSlice } from './slices/navigationSlice';
import { createMoodSlice, type MoodSlice } from './slices/moodSlice';
import { createInteractionsSlice, type InteractionsSlice } from './slices/interactionsSlice';
import { createPartnerSlice, type PartnerSlice } from './slices/partnerSlice';
import { createNotesSlice, type NotesSlice } from './slices/notesSlice';

// Composed AppState from all slices
export interface AppState
  extends MessagesSlice,
    PhotosSlice,
    SettingsSlice,
    NavigationSlice,
    MoodSlice,
    InteractionsSlice,
    PartnerSlice,
    NotesSlice {
  // Shared/Core state
  isLoading: boolean;
  error: string | null;

  // Internal flag for hydration tracking (not exposed to components)
  __isHydrated?: boolean;
}

// State validation helper
function validateHydratedState(state: Partial<AppState> | undefined): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!state) {
    errors.push('State is undefined');
    return { isValid: false, errors };
  }

  // Validate settings structure (only if settings exists - can be missing for fresh install)
  if (state.settings) {
    if (!state.settings.themeName) errors.push('Missing themeName');
    if (!state.settings.relationship) errors.push('Missing relationship data');
  }

  // Validate messageHistory structure (only if it exists - it's hydrated separately)
  if (state.messageHistory) {
    // BEFORE deserialization: shownMessages should be an array (serialized form)
    // AFTER deserialization: shownMessages should be a Map (via onRehydrateStorage)
    // This validation runs BEFORE deserialization, so it should be an array or undefined
    if (
      state.messageHistory.shownMessages !== undefined &&
      !Array.isArray(state.messageHistory.shownMessages) &&
      !(state.messageHistory.shownMessages instanceof Map)
    ) {
      errors.push('shownMessages is not an array or Map instance');
    }
    if (
      state.messageHistory.currentIndex !== undefined &&
      typeof state.messageHistory.currentIndex !== 'number'
    ) {
      errors.push('currentIndex is not a number');
    }
  }

  // Only fail validation if we have CRITICAL errors
  // Missing fields are OK - they'll use defaults
  const hasCriticalErrors = errors.some(
    (err) => err.includes('not an array or Map instance') || err.includes('not a number')
  );

  return { isValid: !hasCriticalErrors, errors };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // Compose all slices using spread operator
      ...createMessagesSlice(set as any, get as any, api as any),
      ...createPhotosSlice(set as any, get as any, api as any),
      ...createSettingsSlice(set as any, get as any, api as any),
      ...createNavigationSlice(set as any, get as any, api as any),
      ...createMoodSlice(set as any, get as any, api as any),
      ...createInteractionsSlice(set as any, get as any, api as any),
      ...createPartnerSlice(set as any, get as any, api as any),
      ...createNotesSlice(set as any, get as any, api as any),

      // Shared/Core state (minimal - initialization, loading, error)
      isLoading: false,
      error: null,
      __isHydrated: false,
    }),
    {
      name: 'my-love-storage',
      version: 0, // State schema version (matches test fixtures)
      // Custom storage with pre-hydration validation using createJSONStorage
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          try {
            // Parse and validate BEFORE returning to Zustand
            const data = JSON.parse(str);

            // Validate state structure
            const validation = validateHydratedState(data.state);
            if (!validation.isValid) {
              console.error('[Storage] Pre-hydration validation failed:', validation.errors);
              console.warn('[Storage] Clearing corrupted state - app will use defaults');

              // Clear corrupted state immediately
              localStorage.removeItem(name);

              // Return null so Zustand uses initial state defaults
              return null;
            }

            // Validation passed - return data for Zustand to deserialize
            return str;
          } catch (parseError) {
            console.error('[Storage] Failed to parse localStorage data:', parseError);
            localStorage.removeItem(name);
            return null;
          }
        },
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        // Only persist small, critical state to LocalStorage
        // Large data (messages, photos, custom messages) is stored in IndexedDB
        settings: state.settings,
        isOnboarded: state.isOnboarded,
        // Story 3.3: Serialize Map to Array for JSON storage
        messageHistory: {
          ...state.messageHistory,
          shownMessages:
            state.messageHistory?.shownMessages instanceof Map
              ? Array.from(state.messageHistory.shownMessages.entries())
              : [],
        },
        moods: state.moods,
        // Story 3.5: Custom messages now in IndexedDB (not LocalStorage)
        // customMessages: NOT persisted (loaded from IndexedDB via loadCustomMessages)
        // customMessagesLoaded: NOT persisted (runtime state)
        // NOT persisted (computed or transient):
        // - messages: Loaded from IndexedDB on init
        // - currentMessage: Computed from messages + messageHistory
        // - customMessages: Loaded from IndexedDB via customMessageService
        // - isLoading, error: Runtime UI state only
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[Zustand Persist] Failed to rehydrate state from LocalStorage:', error);

          // Attempt to recover: clear corrupted state
          try {
            localStorage.removeItem('my-love-storage');
            console.warn(
              '[Zustand Persist] Corrupted state cleared. App will reinitialize with defaults.'
            );
          } catch (clearError) {
            console.error('[Zustand Persist] Failed to clear corrupted state:', clearError);
          }

          // App will continue with default initial state
          return;
        }

        // Story 3.3: Deserialize Array back to Map with validation
        // Handle null/undefined messageHistory gracefully
        if (state?.messageHistory) {
          try {
            const shownMessagesArray = state.messageHistory.shownMessages as any;

            // If shownMessages is null or undefined, create empty Map
            if (!shownMessagesArray) {
              console.warn(
                '[Zustand Persist] shownMessages is null/undefined - creating empty Map'
              );
              state.messageHistory.shownMessages = new Map();
            } else if (Array.isArray(shownMessagesArray)) {
              // Validate array structure before converting to Map
              const isValidArray = shownMessagesArray.every(
                (item) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
              );

              if (isValidArray) {
                state.messageHistory.shownMessages = new Map(shownMessagesArray);
                console.log(
                  '[Zustand Persist] Message history Map deserialized successfully:',
                  `${shownMessagesArray.length} entries`
                );
              } else {
                console.error(
                  '[Zustand Persist] Invalid shownMessages array structure - resetting to empty Map'
                );
                state.messageHistory.shownMessages = new Map();

                // Mark state as potentially corrupted
                console.warn('[Zustand Persist] Message history was corrupted and has been reset');
              }
            } else {
              console.error(
                '[Zustand Persist] shownMessages is not an array - resetting to empty Map'
              );
              state.messageHistory.shownMessages = new Map();
            }
          } catch (deserializationError) {
            console.error(
              '[Zustand Persist] Failed to deserialize shownMessages Map:',
              deserializationError
            );
            state.messageHistory.shownMessages = new Map();

            // Mark for potential full state reset
            console.error(
              '[Zustand Persist] CRITICAL: Map deserialization failed - state may be corrupted'
            );
          }
        } else if (state) {
          // messageHistory is null/undefined - create default structure
          console.warn('[Zustand Persist] messageHistory is null - creating default structure');
          state.messageHistory = {
            currentIndex: 0,
            shownMessages: new Map(),
            maxHistoryDays: 30,
            favoriteIds: [],
            lastShownDate: '',
            lastMessageId: 0,
            viewedIds: [],
          };
        }

        // Handle null/undefined settings gracefully
        if (state && !state.settings) {
          console.warn(
            '[Zustand Persist] settings is null - app will use defaults from initial state'
          );
          // Don't create default settings here - let the store's initial state handle it
        }

        // Validate hydrated state integrity
        const validation = validateHydratedState(state);
        if (!validation.isValid) {
          console.error('[Zustand Persist] State validation failed:', validation.errors);
          console.warn('[Zustand Persist] Clearing corrupted state - app will use defaults');

          // Clear corrupted state
          try {
            localStorage.removeItem('my-love-storage');
          } catch (clearError) {
            console.error('[Zustand Persist] Failed to clear corrupted state:', clearError);
          }

          // IMPORTANT: Don't use the corrupted state object
          // Return undefined/null to signal that defaults should be used
          // Zustand will then use the initial state defined in the store
        }

        // Log hydration result
        if (state && state.settings) {
          console.log(
            '[Zustand Persist] State successfully rehydrated from LocalStorage',
            `with settings (theme: ${state.settings.themeName})`
          );
        } else {
          console.log('[Zustand Persist] No persisted state found - using initial defaults');
        }

        // Set internal hydration flag in state
        if (state) {
          state.__isHydrated = true;
        }
      },
    }
  )
);

// Expose store to window object for E2E testing
if (typeof window !== 'undefined') {
  (window as any).__APP_STORE__ = useAppStore;
}
