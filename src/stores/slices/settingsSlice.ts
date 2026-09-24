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
 * `settings.relationship.anniversaries` is its in-memory mirror. They are NOT
 * persisted with `settings` (`partialize` writes `[]`): the saved copy lives in
 * the shared per-account local copy (`services/localCopy.ts`, kind
 * `anniversaries`), so Home still renders the countdowns offline and no other
 * account on the device can read them. `loadAnniversariesFromServer` is the
 * kind's refresher (signed-in start, reconnect, on demand): it shows the saved
 * copy at once, then replaces mirror and copy with the server's rows. Every
 * write goes to the server first and to the mirror and copy only after it
 * succeeded, with the usual `{ userId, authSessionVersion }` capture-and-recheck
 * around the await. Writes throw, so the Settings form can show the reason
 * (offline included).
 *
 * Couple settings: `public.couple_settings` holds one row per linked couple
 * (today the relationship start date, a date and time). `coupleSettings` is its
 * in-memory state and is NOT persisted with `settings`: its saved copy is the
 * local copy of kind `couple-settings`, filled only from server reads and
 * confirmed writes, so Home's "Together for" card and the history limit work
 * offline. `loadCoupleSettings` is the kind's refresher; it resolves the
 * partner with `lookupPartnerId()` and treats a failed lookup as "keep what is
 * shown", never as unlinked. `setRelationshipStart` needs a connection and
 * throws `AccountDataError('offline')` without one. Last write wins.
 */

import { ZodError } from 'zod/v4';
import { lookupPartnerId } from '../../api/supabaseClient';
import { loadDefaultMessages } from '../../data/defaultMessagesLoader';
import { AccountDataError, requireOnline } from '../../services/accountDataError';
import { serializeAccountDataWrite } from '../../services/accountDataQueue';
import {
  anniversariesService,
  type AnniversaryInput,
  type ServerAnniversary,
} from '../../services/anniversariesService';
import { coupleSettingsService } from '../../services/coupleSettingsService';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
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
  /**
   * The couple's shared settings, from `public.couple_settings` via its local
   * copy. `null` until the saved copy or the server has answered — screens
   * show nothing for it then, rather than a placeholder that may be wrong.
   */
  coupleSettings: CoupleSettings | null;

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
  /**
   * The anniversaries local-copy refresher: show the saved copy, then replace
   * the mirror and the copy with the server's rows. Never throws.
   */
  loadAnniversariesFromServer: () => Promise<void>;

  /**
   * The couple-settings local-copy refresher: show the saved copy, then — when
   * online and the partner lookup answers — replace state and copy with the
   * server's. Never throws.
   */
  loadCoupleSettings: () => Promise<void>;
  /**
   * Set the couple's relationship start (an ISO timestamp). Server first, then
   * state and copy. Throws: `AccountDataError('offline')` without a connection,
   * and an error when no partner is linked or the lookup fails.
   */
  setRelationshipStart: (relationshipStart: string) => Promise<void>;
}

/**
 * What the couple-settings kind holds. Only a server answer is ever stored, so
 * `unlinked` means the partner lookup said so — never a failed read.
 */
export type CoupleSettings =
  | { status: 'linked'; partnerId: string; relationshipStart: string | null }
  | { status: 'unlinked' };

/** Local-copy kind for the couple's shared settings (`CoupleSettings`). */
export const COUPLE_SETTINGS_COPY_KIND = 'couple-settings';

/**
 * Same role as `anniversariesFreshFor`, for the couple-settings kind: once this
 * session has a server answer or a confirmed write, a late copy read is ignored.
 */
let coupleSettingsFreshFor: { userId: string; authSessionVersion: number } | null = null;

function isCoupleSettingsFresh(userId: string, authSessionVersion: number): boolean {
  return (
    coupleSettingsFreshFor?.userId === userId &&
    coupleSettingsFreshFor.authSessionVersion === authSessionVersion
  );
}

/** A saved copy in a shape the screens can use; anything else is ignored. */
function parseSavedCoupleSettings(value: unknown): CoupleSettings | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.status === 'unlinked') return { status: 'unlinked' };
  if (v.status !== 'linked' || typeof v.partnerId !== 'string') return null;
  const start = v.relationshipStart;
  if (start !== null && (typeof start !== 'string' || Number.isNaN(new Date(start).getTime()))) {
    return null;
  }
  return { status: 'linked', partnerId: v.partnerId, relationshipStart: start };
}

/** Local-copy kind for the account's anniversaries (`Anniversary[]`). */
export const ANNIVERSARIES_COPY_KIND = 'anniversaries';

/**
 * The auth lifetime whose anniversaries already came from the server or from a
 * confirmed write. The saved copy is applied only before that, so a copy read
 * that lands late can never replace a newer answer in the same session.
 * Keyed by `{ userId, authSessionVersion }`, so a new session starts unfresh.
 */
let anniversariesFreshFor: { userId: string; authSessionVersion: number } | null = null;

function isFresh(userId: string, authSessionVersion: number): boolean {
  return (
    anniversariesFreshFor?.userId === userId &&
    anniversariesFreshFor.authSessionVersion === authSessionVersion
  );
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

/** The saved copy's valid entries; anything malformed is dropped, not shown. */
function parseSavedAnniversaries(value: unknown): Anniversary[] | null {
  if (!Array.isArray(value)) return null;
  const valid: Anniversary[] = [];
  for (const item of value) {
    const result = AnniversarySchema.safeParse(item);
    if (result.success) valid.push(result.data);
  }
  return valid;
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

export const createSettingsSlice: AppStateCreator<SettingsSlice> = (set, get, _api) => {
  // The anniversaries kind's refresher for signed-in start, reconnect and
  // on-demand refreshes. Re-registering (a second store in tests) replaces it.
  registerLocalCopy(ANNIVERSARIES_COPY_KIND, () => get().loadAnniversariesFromServer());
  registerLocalCopy(COUPLE_SETTINGS_COPY_KIND, () => get().loadCoupleSettings());

  /**
   * After a confirmed server answer for `userId` in `authSessionVersion` (the
   * caller has just re-checked both and set the state): mark the session fresh
   * and save the answer as the copy. A failed save is logged.
   */
  const saveCoupleSettingsCopy = async (
    userId: string,
    authSessionVersion: number,
    value: CoupleSettings
  ) => {
    coupleSettingsFreshFor = { userId, authSessionVersion };
    try {
      await writeLocalCopy(userId, COUPLE_SETTINGS_COPY_KIND, value);
    } catch (error) {
      console.error('[Settings] Failed to save the couple settings copy:', error);
    }
  };

  /**
   * After a confirmed server answer for `userId` in `authSessionVersion` (the
   * caller has just re-checked both): mark the session fresh and save the
   * mirror as the copy. A failed save is logged — the server write stands.
   */
  const saveAnniversariesCopy = async (userId: string, authSessionVersion: number) => {
    anniversariesFreshFor = { userId, authSessionVersion };
    const list = get().settings?.relationship.anniversaries;
    if (!list) return;
    try {
      await writeLocalCopy(userId, ANNIVERSARIES_COPY_KIND, list);
    } catch (error) {
      console.error('[Settings] Failed to save the anniversaries copy:', error);
    }
  };

  return {
    // Initial state - use defaults that will be overridden by persist if data exists
    // Story 1.4: Pre-configured settings for single-user deployment
    settings: {
      relationship: {
        anniversaries: [],
      },
    },
    isOnboarded: true,
    coupleSettings: null,

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
        await saveAnniversariesCopy(requestedBy, requestedInSession);
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
        await saveAnniversariesCopy(requestedBy, requestedInSession);
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
        await saveAnniversariesCopy(requestedBy, requestedInSession);
      });
    },

    loadAnniversariesFromServer: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // 1. The saved copy, at once — online or offline. Outside the account-data
      // queue, so a queued write cannot hold the countdowns back; skipped once
      // this session has a server answer or a confirmed write, which is newer.
      if (!isFresh(requestedBy, requestedInSession)) {
        const saved = parseSavedAnniversaries(
          await readLocalCopy<unknown>(requestedBy, ANNIVERSARIES_COPY_KIND)
        );
        if (!isCurrent()) return;
        if (saved && !isFresh(requestedBy, requestedInSession)) {
          set((state) =>
            state.settings ? { settings: withAnniversaries(state.settings, saved) } : {}
          );
        }
      }

      // 2. Offline there is nothing to ask; the copy (or nothing) stays shown.
      if (!isOnline()) return;

      // 3. The server's rows replace the mirror and the copy — only on success.
      try {
        await serializeAccountDataWrite(async () => {
          const rows = await anniversariesService.fetchAnniversaries(requestedBy);
          if (!isCurrent()) return;
          set((state) => {
            if (!state.settings) return {};
            return {
              settings: withAnniversaries(
                state.settings,
                mirrorAnniversaries(state.settings.relationship.anniversaries, rows)
              ),
            };
          });
          await saveAnniversariesCopy(requestedBy, requestedInSession);
        });
      } catch (error) {
        // The mirror and the copy stay as they were, so Home keeps its countdowns.
        console.error('[Settings] Failed to load anniversaries from the server:', error);
      }
    },

    loadCoupleSettings: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // 1. The saved copy, at once — online or offline. Skipped once this
      // session has a server answer or a confirmed write, which is newer.
      if (!isCoupleSettingsFresh(requestedBy, requestedInSession)) {
        const saved = parseSavedCoupleSettings(
          await readLocalCopy<unknown>(requestedBy, COUPLE_SETTINGS_COPY_KIND)
        );
        if (!isCurrent()) return;
        if (saved && !isCoupleSettingsFresh(requestedBy, requestedInSession)) {
          set({ coupleSettings: saved });
        }
      }

      // 2. Offline there is nothing to ask; the copy (or nothing) stays shown.
      if (!isOnline()) return;

      // 3. Who the partner is. A failed lookup is NOT "unlinked": what is shown
      // stays, and so does the copy. Outside the account-data queue because
      // the lookup has no request timeout and must not hold the queue.
      const lookup = await lookupPartnerId();
      if (!isCurrent()) return;
      if (lookup.status === 'error') {
        console.error('[Settings] Partner lookup failed; keeping couple settings:', lookup.reason);
        return;
      }
      if (lookup.status === 'unlinked') {
        const next: CoupleSettings = { status: 'unlinked' };
        set({ coupleSettings: next });
        await saveCoupleSettingsCopy(requestedBy, requestedInSession, next);
        return;
      }

      // 4. The server's row replaces state and copy — only on success. In the
      // account-data queue, so it cannot read before a start-date write and
      // land after it.
      try {
        await serializeAccountDataWrite(async () => {
          const row = await coupleSettingsService.fetchCoupleSettings(
            requestedBy,
            lookup.partnerId
          );
          if (!isCurrent()) return;
          const next: CoupleSettings = {
            status: 'linked',
            partnerId: lookup.partnerId,
            relationshipStart: row.relationshipStart,
          };
          set({ coupleSettings: next });
          await saveCoupleSettingsCopy(requestedBy, requestedInSession, next);
        });
      } catch (error) {
        // State and copy stay as they were, so Home keeps its counter.
        console.error('[Settings] Failed to load couple settings from the server:', error);
      }
    },

    setRelationshipStart: async (relationshipStart) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) throw new Error('You must be signed in to set your start date');
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // Refused before any request, so an offline edit changes nothing.
      requireOnline('Couple settings');

      const lookup = await lookupPartnerId();
      if (lookup.status === 'error') {
        throw new AccountDataError(
          'transport',
          'Could not reach your account to save the start date. Try again in a moment.'
        );
      }
      if (lookup.status === 'unlinked') {
        throw new Error('Link a partner first to set your start date');
      }
      if (!isCurrent()) return;

      await serializeAccountDataWrite(async () => {
        const saved = await coupleSettingsService.saveStartDate(
          requestedBy,
          lookup.partnerId,
          relationshipStart
        );
        if (!isCurrent()) return;
        const next: CoupleSettings = {
          status: 'linked',
          partnerId: lookup.partnerId,
          relationshipStart: saved.relationshipStart,
        };
        set({ coupleSettings: next });
        await saveCoupleSettingsCopy(requestedBy, requestedInSession, next);
      });
    },
  };
};

// Export initialization guards for use in main store
export { isInitialized, isInitializing };
