import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { logger } from '../utils/logger';
import { SettingsSchema } from '../validation/schemas';
import { createAppSlice } from './slices/appSlice';
import { ACCOUNT_OWNER_STORAGE_KEY, createAuthSlice } from './slices/authSlice';
import { createEventsSlice } from './slices/eventsSlice';
import { createInteractionsSlice } from './slices/interactionsSlice';
import { createMessagesSlice } from './slices/messagesSlice';
import { createMoodSlice } from './slices/moodSlice';
import { createNavigationSlice } from './slices/navigationSlice';
import { createNotesSlice } from './slices/notesSlice';
import { createPartnerSlice } from './slices/partnerSlice';
import { createPhotosSlice } from './slices/photosSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import type { AppState } from './types';

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

/**
 * Keys a persisted blob may still carry that must never reach store state.
 *
 * Every one of them is account- or couple-scoped and none is in `partialize`,
 * so this list only ever shrinks the blob on the way in — the write side
 * already omits them. The next slice that needs the same protection extends
 * this array rather than adding a second branch in `getItem`.
 */
const STALE_PERSISTED_KEYS = [
  'moods', 'events', 'eventsIsLoading', 'eventsError',
  'eventsPagination', 'eventsIsLoadingMore', 'eventsHistoryError',
] as const;

/**
 * Keys inside `settings` that nothing reads any more: the removed pre-kit theme
 * system (`themeName`, `customization`) and the never-used reminder settings
 * (`notificationTime`, `notifications`).
 *
 * `SettingsSchema` is not strict and Zustand replaces `settings` whole from the
 * blob, so a device that saved them would carry them forward on every write.
 * Dropping them here lets the next write leave them out.
 */
const STALE_PERSISTED_SETTINGS_KEYS = [
  'themeName',
  'customization',
  'notificationTime',
  'notifications',
] as const;

/**
 * Keys inside `settings.relationship` that no longer belong on the device. The
 * start date is couple data on the server now (`coupleSettings`), and the
 * partner is named from `partner.displayName`; both were hard-coded defaults.
 */
const STALE_PERSISTED_RELATIONSHIP_KEYS = ['startDate', 'partnerName'] as const;

/**
 * The retired anniversary vault's two localStorage keys. The vault stashed each
 * signed-out account's anniversaries under a device-global key, readable by
 * whoever used the device next; anniversaries now live in the per-account local
 * copy instead. Both keys are removed on load. The old owner marker named the
 * same account the new one does, so it seeds `ACCOUNT_OWNER_STORAGE_KEY` when
 * that is unset — a no-session boot right after the upgrade still knows whose
 * saved data to delete.
 */
const RETIRED_VAULT_KEYS = {
  vault: 'my-love-anniversary-vault',
  owner: 'my-love-anniversary-owner',
} as const;

function retireAnniversaryVault(): void {
  try {
    const owner = localStorage.getItem(RETIRED_VAULT_KEYS.owner);
    if (owner && !localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY)) {
      localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, owner);
    }
    localStorage.removeItem(RETIRED_VAULT_KEYS.vault);
    localStorage.removeItem(RETIRED_VAULT_KEYS.owner);
  } catch (error) {
    console.error('[Storage] Failed to remove the retired anniversary vault:', error);
  }
}

if (typeof localStorage !== 'undefined') retireAnniversaryVault();

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // AppSlice FIRST - owns core state (isLoading, error, __isHydrated)
      ...createAppSlice(set, get, api),
      // AuthSlice - single source of truth for user identity
      ...createAuthSlice(set, get, api),
      // Compose all other slices
      ...createMessagesSlice(set, get, api),
      ...createPhotosSlice(set, get, api),
      ...createSettingsSlice(set, get, api),
      ...createNavigationSlice(set, get, api),
      ...createMoodSlice(set, get, api),
      ...createInteractionsSlice(set, get, api),
      ...createPartnerSlice(set, get, api),
      ...createNotesSlice(set, get, api),
      ...createEventsSlice(set, get, api),
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

            // Drop any stale keys the blob still carries.
            //
            // `partialize` stops NEW writes, but it does not govern reads: a
            // blob already on disk still carries these arrays, and Zustand
            // merges whatever it finds. `moods` is the key with an installed
            // base -- the first load after upgrading rehydrated the previous
            // account's entries, and MoodTracker's mount effect pre-filled that
            // note into the textarea before loadMoods() could replace the
            // array. `events` is the same data class one step earlier:
            // couple-scoped and Supabase-only, so on a shared device a blob
            // carrying it would put one couple's countdown dates in front of
            // the next account -- and since JSON has no Date, it would hand
            // EventCountdown a string where it calls date.getFullYear().
            // Stripping here rather than bumping the persist version keeps
            // `version: 0`, which the E2E auth fixtures pin.
            let mutated = false;
            if (data.state) {
              for (const key of STALE_PERSISTED_KEYS) {
                if (key in data.state) {
                  delete data.state[key];
                  mutated = true;
                }
              }
            }

            if (data.state?.messageHistory && 'favoriteIds' in data.state.messageHistory) {
              delete data.state.messageHistory.favoriteIds;
              mutated = true;
            }

            // A non-object `settings` would make `in` throw and the catch below
            // would discard the whole blob; leave it for the schema check to drop.
            if (data.state?.settings && typeof data.state.settings === 'object') {
              for (const key of STALE_PERSISTED_SETTINGS_KEYS) {
                if (key in data.state.settings) {
                  delete data.state.settings[key];
                  mutated = true;
                }
              }
            }

            // Anniversaries are account data kept in the per-account local copy,
            // never in this device-global blob. A blob written before that move
            // still carries the last account's list; blank it so it never shows.
            const relationship = data.state?.settings?.relationship;
            if (
              relationship &&
              typeof relationship === 'object' &&
              Array.isArray(relationship.anniversaries) &&
              relationship.anniversaries.length > 0
            ) {
              relationship.anniversaries = [];
              mutated = true;
            }

            if (relationship && typeof relationship === 'object') {
              for (const key of STALE_PERSISTED_RELATIONSHIP_KEYS) {
                if (key in relationship) {
                  delete relationship[key];
                  mutated = true;
                }
              }
            }

            // Schema-validate persisted settings; drop just `settings` on failure
            // so Zustand's shallow merge falls back to the settingsSlice defaults.
            if (data.state?.settings) {
              const settingsResult = SettingsSchema.safeParse(data.state.settings);
              if (!settingsResult.success) {
                console.error(
                  '[Storage] Persisted settings failed schema validation:',
                  settingsResult.error.issues
                );
                console.warn('[Storage] Dropping persisted settings - defaults will be used');
                delete data.state.settings;
                mutated = true;
              }
            }

            // Validation passed - return data for Zustand to deserialize
            return mutated ? JSON.stringify(data) : str;
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
        // Anniversaries are written as `[]`: they are account data, kept in the
        // per-account local copy (settingsSlice), not in this device-global blob.
        settings: state.settings
          ? {
              ...state.settings,
              relationship: { ...state.settings.relationship, anniversaries: [] },
            }
          : state.settings,
        isOnboarded: state.isOnboarded,
        // Story 3.3: Serialize Map to Array for JSON storage
        messageHistory: {
          ...state.messageHistory,
          favoriteIds: undefined,
          shownMessages:
            state.messageHistory?.shownMessages instanceof Map
              ? Array.from(state.messageHistory.shownMessages.entries())
              : [],
        },
        // moods: NOT persisted. IndexedDB is the source of truth and
        // loadMoods() repopulates from it on every start. Persisting the array
        // under this single global key meant one account's mood notes were
        // rehydrated into the next account's session on a shared device,
        // before any fetch could correct them.
        // Custom messages live in the account's message-data local copy
        // customMessages: NOT persisted (loaded from that copy via loadCustomMessages)
        // customMessagesLoaded: NOT persisted (runtime state)
        // NOT persisted (computed or transient):
        // - messages: Loaded from IndexedDB on init
        // - currentMessage: Computed from messages + messageHistory
        // - customMessages: Loaded from the message-data local copy
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
          state.messageHistory.favoriteIds = [];
          try {
            // Use unknown + type guards instead of any for proper narrowing
            const raw = state.messageHistory.shownMessages as unknown;

            // If shownMessages is null or undefined, create empty Map
            if (!raw) {
              console.warn(
                '[Zustand Persist] shownMessages is null/undefined - creating empty Map'
              );
              state.messageHistory.shownMessages = new Map();
            } else if (raw instanceof Map) {
              // Already a Map, OK (shouldn't happen but handle gracefully)
              logger.info('[Zustand Persist] shownMessages is already a Map');
            } else if (Array.isArray(raw)) {
              // Validate array structure before converting to Map
              const isValidArray = raw.every(
                (item): item is [string, unknown] =>
                  Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
              );

              if (isValidArray) {
                state.messageHistory.shownMessages = new Map(raw) as Map<string, number>;
                logger.info(
                  '[Zustand Persist] Message history Map deserialized successfully:',
                  `${raw.length} entries`
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
          logger.info(
            '[Zustand Persist] State successfully rehydrated from LocalStorage with settings'
          );
        } else {
          logger.info('[Zustand Persist] No persisted state found - using initial defaults');
        }

        // Set internal hydration flag in state
        // NOTE: In onRehydrateStorage, `state` is the raw state object, not the store.
        // Actions don't exist here, so we must use direct property assignment.
        if (state) {
          state.__isHydrated = true;
        }
      },
    }
  )
);

// Declare global window interface for E2E testing
declare global {
  interface Window {
    __APP_STORE__?: typeof useAppStore;
  }
}

// Expose store to window object for E2E testing
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'production') {
  window.__APP_STORE__ = useAppStore;
}
