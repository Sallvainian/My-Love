/**
 * Settings Slice
 *
 * Manages start-up, the device settings and onboarding:
 * - User settings and preferences (`settings`, persisted)
 * - Onboarding state
 * - App initialization
 *
 * The account-data domains that used to live here have their own slices:
 * anniversaries, couple settings and countdown marks in `datesSlice`, the
 * account's own profile in `profileSlice`, push preferences in
 * `notificationsSlice`. `settings.relationship.anniversaries` stays inside the
 * `settings` object this slice owns — it is the in-memory mirror of the
 * anniversaries, written by `datesSlice` actions and NOT persisted with
 * `settings` (`partialize` writes `[]`; its saved copy is the local copy of
 * kind `anniversaries`).
 *
 * Cross-slice dependencies:
 * - initializeApp coordinates with Messages slice (loadMessages, updateCurrentMessage)
 *
 * Persistence:
 * - settings: Persisted to LocalStorage
 * - isOnboarded: Persisted to LocalStorage
 */

import { ZodError } from 'zod/v4';
import { loadDefaultMessages } from '../../data/defaultMessagesLoader';
import { readMessageData } from '../../services/customMessageService';
import { projectMessageFavorites } from '../../services/messageFavorites';
import { storageService } from '../../services/storage';
import type { Settings } from '../../types';
import { logger } from '../../utils/logger';
import { createValidationError, isZodError } from '../../validation/errorMessages';
import { SettingsSchema } from '../../validation/schemas';
import type { AppStateCreator } from '../types';

export interface SettingsSlice {
  // State
  settings: Settings | null;
  isOnboarded: boolean;

  // Actions
  initializeApp: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setOnboarded: (onboarded: boolean) => void;
}

// Initialization guards to prevent concurrent/duplicate initialization (StrictMode protection)
let isInitializing = false;
let isInitialized = false;

export const createSettingsSlice: AppStateCreator<SettingsSlice> = (set, get, _api) => {
  return {
    // Initial state - use defaults that will be overridden by persist if data exists
    // Story 1.4: Pre-configured settings for single-user deployment
    settings: {
      relationship: {
        anniversaries: [],
      },
    },
    isOnboarded: true,

    // Initialize app
    initializeApp: async () => {
      // Guard: Prevent concurrent/duplicate initialization (StrictMode protection)
      if (isInitializing) {
        logger.info('[App Init] Skipping - initialization already in progress');
        return;
      }
      if (isInitialized) {
        logger.info('[App Init] Skipping - app already initialized');
        return;
      }

      isInitializing = true;

      // AppSlice owns loading/error - no more "if exists" guards
      get().setLoading(true);
      get().setError(null);

      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const stillCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      try {
        // CRITICAL: Check Zustand persist hydration status
        // Hydration completes synchronously during store creation (before initializeApp is called)
        // __isHydrated is now a required boolean on AppSlice
        const isHydrated = get().__isHydrated;

        if (!isHydrated) {
          console.error('[App Init] CRITICAL: Hydration failed or did not complete');
          console.error('[App Init] This indicates corrupted localStorage data');

          get().setError('Failed to load saved settings. App will reinitialize with defaults.');
          get().setLoading(false);

          // Clear corrupted state to prevent repeated failures
          try {
            localStorage.removeItem('my-love-storage');
            console.warn('[App Init] Cleared corrupted localStorage - please refresh the page');
          } catch (clearError) {
            console.error('[App Init] Failed to clear corrupted state:', clearError);
          }

          isInitializing = false;
          return;
        }

        logger.info('[App Init] Hydration verified - proceeding with IndexedDB initialization');

        // Initialize IndexedDB
        await storageService.init();

        // The bundled daily rows are shared, so their absence is what marks an
        // unseeded database; the store holds nothing else (custom messages and
        // favorites live in each account's `message-data` local copy).
        let bundled = await storageService.getAllMessages();

        // If no messages exist, populate with default messages
        if (bundled.length === 0) {
          const defaultMessages = await loadDefaultMessages();
          const messagesToAdd = defaultMessages.map((msg) => ({
            ...msg,
            // Remove explicit ID - let IndexedDB autoIncrement generate IDs
            createdAt: new Date(),
            isCustom: false,
          }));

          await storageService.addMessages(messagesToAdd);

          // Reload messages from IndexedDB to get auto-generated IDs
          bundled = await storageService.getAllMessages();
        }

        // The rotation pool: the bundled rows plus this account's saved copy,
        // so a signed-in start shows its custom messages and favorites offline.
        const copy = requestedBy && stillCurrent() ? await readMessageData(requestedBy) : null;

        if (stillCurrent()) {
          const pool = projectMessageFavorites(bundled, copy);
          set((state) => ({
            messages: pool,
            messageHistory: {
              ...state.messageHistory,
              favoriteIds: pool.filter((message) => message.isFavorite).map((message) => message.id),
            },
          }));
        }

        if (stillCurrent()) {
          get().updateCurrentMessage();
        } else {
          // `reloadRotationPool` returns early on an empty pool, which is the
          // cold-boot state this path leaves behind, so the same two lines are
          // inlined here rather than routed through it.
          const { userId, authSessionVersion } = get();
          void get()
            .loadMessages()
            .then(() => {
              if (get().userId !== userId || get().authSessionVersion !== authSessionVersion) return;
              get().updateCurrentMessage();
            })
            // `loadMessages` swallows its own errors, but `updateCurrentMessage` runs
            // inside the callback above and nothing is awaiting this chain — a throw
            // there would surface as an unhandled rejection on the init path, with no
            // caller to report it.
            .catch((error) => {
              console.error('[App Init] Failed to reload the rotation pool:', error);
            });
        }

        get().setLoading(false);

        isInitialized = true;
        logger.info('[App Init] Initialization completed successfully');
      } catch (error) {
        console.error('Error initializing app:', error);

        get().setError('Failed to initialize app');
        get().setLoading(false);
      } finally {
        isInitializing = false;
      }
    },

    // Settings actions
    setSettings: (settings) => {
      try {
        // Story 5.5: Validate settings before updating state
        const validated = SettingsSchema.parse(settings);
        set({ settings: validated });
      } catch (error) {
        // Transform Zod validation errors into user-friendly messages
        if (isZodError(error)) {
          console.error(
            '[Settings] Validation failed:',
            createValidationError(error as ZodError).message
          );
          throw createValidationError(error as ZodError);
        }
        throw error;
      }
    },

    updateSettings: (updates) => {
      const { settings } = get();
      if (settings) {
        try {
          // Story 5.5: Validate merged settings before updating state
          const merged = { ...settings, ...updates };
          const validated = SettingsSchema.parse(merged);
          set({ settings: validated });
        } catch (error) {
          // Transform Zod validation errors into user-friendly messages
          if (isZodError(error)) {
            console.error(
              '[Settings] Validation failed:',
              createValidationError(error as ZodError).message
            );
            throw createValidationError(error as ZodError);
          }
          throw error;
        }
      }
    },

    setOnboarded: (onboarded) => {
      set({ isOnboarded: onboarded });
    },
  };
};

// Export initialization guards for use in main store
export { isInitialized, isInitializing };
