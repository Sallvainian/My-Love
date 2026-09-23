/**
 * Settings Slice
 *
 * Manages all settings-related state and actions including:
 * - User settings and preferences
 * - Onboarding state
 * - Anniversary management
 * - App initialization
 *
 * Cross-slice dependencies:
 * - initializeApp coordinates with Messages slice (loadMessages, updateCurrentMessage)
 *
 * Persistence:
 * - settings: Persisted to LocalStorage
 * - isOnboarded: Persisted to LocalStorage
 *
 * Anniversaries: `public.anniversaries` is the source of truth, and
 * `settings.relationship.anniversaries` is its read mirror — so Home still
 * renders the countdowns offline. Every write goes to the server first and to
 * the mirror only after it succeeded, with the usual `{ userId,
 * authSessionVersion }` capture-and-recheck around the await. Writes throw, so
 * the Settings form can show the reason (offline included).
 */

import { ZodError } from 'zod/v4';
import { APP_CONFIG } from '../../config/constants';
import { loadDefaultMessages } from '../../data/defaultMessagesLoader';
import { AccountDataError } from '../../services/accountDataError';
import { serializeAccountDataWrite } from '../../services/accountDataQueue';
import {
  anniversariesService,
  type AnniversaryInput,
  type ServerAnniversary,
} from '../../services/anniversariesService';
import { hasCompletedLocalUpload } from '../../services/localDataUpload';
import { storageService } from '../../services/storage';
import type { Anniversary, Settings } from '../../types';
import { logger } from '../../utils/logger';
import { createValidationError, isZodError } from '../../validation/errorMessages';
import { AnniversarySchema, SettingsSchema } from '../../validation/schemas';
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

  // Anniversary actions — server first, then the settings mirror. Writes throw.
  /** `clientKey`: minted once per submit and reused on its retry (useSubmitKey). */
  addAnniversary: (anniversary: AnniversaryInput, clientKey?: string) => Promise<void>;
  updateAnniversary: (id: number, anniversary: AnniversaryInput) => Promise<void>;
  removeAnniversary: (id: number) => Promise<void>;
  /** Replace the mirror with the server's rows, once this device's upload is done. */
  loadAnniversariesFromServer: () => Promise<void>;
}

const AnniversaryInputSchema = AnniversarySchema.omit({ id: true, serverId: true });

/** Validate a form's anniversary before it is sent, with the form's error shape. */
function parseAnniversaryInput(input: AnniversaryInput): AnniversaryInput {
  try {
    return AnniversaryInputSchema.parse(input);
  } catch (error) {
    if (isZodError(error)) throw createValidationError(error as ZodError);
    throw error;
  }
}

function toMirrored(id: number, row: ServerAnniversary): Anniversary {
  return {
    id,
    date: row.date,
    label: row.label,
    ...(row.description ? { description: row.description } : {}),
    serverId: row.serverId,
  };
}

/**
 * The server's list in mirror form. An entry already mirrored keeps its local
 * id — an open edit form and the countdown keys refer to it — and a new one
 * takes the next free id.
 */
function mirrorAnniversaries(current: Anniversary[], rows: ServerAnniversary[]): Anniversary[] {
  const idByServerId = new Map(
    current.filter((a) => a.serverId).map((a) => [a.serverId as string, a.id])
  );
  let nextId = Math.max(0, ...current.map((a) => a.id));
  return rows.map((row) => toMirrored(idByServerId.get(row.serverId) ?? ++nextId, row));
}

function withAnniversaries(settings: Settings, anniversaries: Anniversary[]): Settings {
  return { ...settings, relationship: { ...settings.relationship, anniversaries } };
}

function notSynced(): AccountDataError {
  return new AccountDataError(
    'not-synced',
    'This anniversary has not been saved to your account yet. Try again in a moment.'
  );
}

// Initialization guards to prevent concurrent/duplicate initialization (StrictMode protection)
let isInitializing = false;
let isInitialized = false;

export const createSettingsSlice: AppStateCreator<SettingsSlice> = (set, get, _api) => ({
  // Initial state - use defaults that will be overridden by persist if data exists
  // Story 1.4: Pre-configured settings for single-user deployment
  settings: {
    notificationTime: '09:00',
    relationship: {
      startDate: APP_CONFIG.defaultStartDate,
      partnerName: APP_CONFIG.defaultPartnerName,
      anniversaries: [],
    },
    notifications: {
      enabled: true,
      time: '09:00',
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

      // Load messages from IndexedDB — shared daily rows plus this account's
      // own custom rows. The seeding decision below reads the same list, and
      // still works when nobody is signed in: the daily rows are shared, so
      // their absence is what marks an unseeded database.
      const storedMessages = await storageService.getAllMessages(requestedBy);

      // If no messages exist, populate with default messages
      if (storedMessages.length === 0) {
        const defaultMessages = await loadDefaultMessages();
        const messagesToAdd = defaultMessages.map((msg) => ({
          ...msg,
          // Remove explicit ID - let IndexedDB autoIncrement generate IDs
          createdAt: new Date(),
          isCustom: false,
        }));

        await storageService.addMessages(messagesToAdd);

        // Reload messages from IndexedDB to get auto-generated IDs
        const messagesWithIds = await storageService.getAllMessages(requestedBy);

        if (stillCurrent()) {
          set((state) => ({
            messages: messagesWithIds,
            messageHistory: {
              ...state.messageHistory,
              favoriteIds: messagesWithIds
                .filter((message) => message.isFavorite)
                .map((message) => message.id),
            },
          }));
        }
      } else if (stillCurrent()) {
        set((state) => ({
          messages: storedMessages,
          messageHistory: {
            ...state.messageHistory,
            favoriteIds: storedMessages
              .filter((message) => message.isFavorite)
              .map((message) => message.id),
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

  // Anniversary actions. Each runs in the account-data queue, so the mirror
  // refresh cannot read the server before a write and replace the list after it.
  addAnniversary: async (anniversary, clientKey = crypto.randomUUID()) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) throw new Error('You must be signed in to add an anniversary');
    const input = parseAnniversaryInput(anniversary);

    await serializeAccountDataWrite(async () => {
      const created = await anniversariesService.createAnniversary(requestedBy, input, clientKey);

      // The row is the requesting account's either way; only this session's
      // mirror is withheld once the account changed under the request.
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) return;
      set((state) => {
        if (!state.settings) return {};
        const current = state.settings.relationship.anniversaries;
        // A retried submit resolves to the row the first attempt stored, which
        // a refresh may already have mirrored: never list it twice.
        if (current.some((a) => a.serverId === created.serverId)) return {};
        const newId = Math.max(0, ...current.map((a) => a.id)) + 1;
        return {
          settings: withAnniversaries(state.settings, [...current, toMirrored(newId, created)]),
        };
      });
    });
  },

  updateAnniversary: async (id, anniversary) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) throw new Error('You must be signed in to edit an anniversary');
    const input = parseAnniversaryInput(anniversary);

    await serializeAccountDataWrite(async () => {
      // The queue may have held this task across an account switch; the local
      // id would then name the NEW account's row, under the new session.
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) return;
      const existing = get().settings?.relationship.anniversaries.find((a) => a.id === id);
      if (!existing) throw new AccountDataError('not-found', 'Anniversary not found');
      if (!existing.serverId) throw notSynced();

      const updated = await anniversariesService.updateAnniversary(existing.serverId, input);

      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) return;
      set((state) => {
        if (!state.settings) return {};
        return {
          settings: withAnniversaries(
            state.settings,
            state.settings.relationship.anniversaries.map((a) =>
              a.serverId === updated.serverId ? toMirrored(a.id, updated) : a
            )
          ),
        };
      });
    });
  },

  removeAnniversary: async (id) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) throw new Error('You must be signed in to delete an anniversary');

    await serializeAccountDataWrite(async () => {
      // Same re-check as updateAnniversary: a queued delete must not reach the
      // next account's row through a shared local id.
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) return;
      const existing = get().settings?.relationship.anniversaries.find((a) => a.id === id);
      if (!existing) return;
      if (!existing.serverId) throw notSynced();
      const { serverId } = existing;

      await anniversariesService.deleteAnniversary(serverId);

      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) return;
      set((state) => {
        if (!state.settings) return {};
        return {
          settings: withAnniversaries(
            state.settings,
            state.settings.relationship.anniversaries.filter((a) => a.serverId !== serverId)
          ),
        };
      });
    });
  },

  loadAnniversariesFromServer: async () => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    // Until the upload flag is set, the local list may hold items the server
    // does not, and replacing it would destroy them.
    if (!requestedBy || !hasCompletedLocalUpload(requestedBy)) return;

    try {
      await serializeAccountDataWrite(async () => {
        const rows = await anniversariesService.fetchAnniversaries(requestedBy);
        if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) return;
        set((state) => {
          if (!state.settings) return {};
          return {
            settings: withAnniversaries(
              state.settings,
              mirrorAnniversaries(state.settings.relationship.anniversaries, rows)
            ),
          };
        });
      });
    } catch (error) {
      // The mirror stays as it was, so Home keeps its countdowns offline.
      console.error('[Settings] Failed to load anniversaries from the server:', error);
    }
  },
});

// Export initialization guards for use in main store
export { isInitialized, isInitializing };
