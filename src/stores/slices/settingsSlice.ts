/**
 * Settings Slice
 *
 * Manages all settings-related state and actions including:
 * - User settings and preferences
 * - Onboarding state
 * - Theme management
 * - Anniversary management
 * - App initialization
 *
 * Cross-slice dependencies:
 * - initializeApp coordinates with Messages slice (loadMessages, updateCurrentMessage)
 *
 * Persistence:
 * - settings: Persisted to LocalStorage
 * - isOnboarded: Persisted to LocalStorage
 */

import type { StateCreator } from 'zustand';
import type { Settings, ThemeName, Anniversary, Message } from '../../types';
import { storageService } from '../../services/storage';
import defaultMessages from '../../data/defaultMessages';
import { APP_CONFIG } from '../../config/constants';
import { SettingsSchema } from '../../validation/schemas';
import { createValidationError, isZodError } from '../../validation/errorMessages';
import { ZodError } from 'zod';

export interface SettingsSlice {
  // State
  settings: Settings | null;
  isOnboarded: boolean;

  // Actions
  initializeApp: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setOnboarded: (onboarded: boolean) => void;

  // Anniversary actions
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void;
  removeAnniversary: (id: number) => void;

  // Theme actions
  setTheme: (theme: ThemeName) => void;
}

// Initialization guards to prevent concurrent/duplicate initialization (StrictMode protection)
let isInitializing = false;
let isInitialized = false;

export const createSettingsSlice: StateCreator<
  SettingsSlice & {
    messages?: Message[];
    updateCurrentMessage?: () => void;
    isLoading?: boolean;
    error?: string | null;
    __isHydrated?: boolean;
  },
  [],
  [],
  SettingsSlice
> = (set, get) => ({
  // Initial state - use defaults that will be overridden by persist if data exists
  // Story 1.4: Pre-configured settings for single-user deployment
  settings: {
    themeName: 'sunset' as ThemeName,
    notificationTime: '09:00',
    relationship: {
      startDate: APP_CONFIG.defaultStartDate,
      partnerName: APP_CONFIG.defaultPartnerName,
      anniversaries: [],
    },
    customization: {
      accentColor: '#ff6b9d',
      fontFamily: 'system-ui',
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
      console.log('[App Init] Skipping - initialization already in progress');
      return;
    }
    if (isInitialized) {
      console.log('[App Init] Skipping - app already initialized');
      return;
    }

    isInitializing = true;

    const state = get();

    // Set loading state in parent store (if available)
    if (state.isLoading !== undefined) {
      set({ isLoading: true, error: null } as any);
    }

    try {
      // CRITICAL: Check Zustand persist hydration status
      // Hydration completes synchronously during store creation (before initializeApp is called)
      // Access isHydrated from parent context
      const isHydrated = state.__isHydrated !== false;

      if (!isHydrated) {
        console.error('[App Init] CRITICAL: Hydration failed or did not complete');
        console.error('[App Init] This indicates corrupted localStorage data');

        if (state.error !== undefined) {
          set({
            error: 'Failed to load saved settings. App will reinitialize with defaults.',
            isLoading: false
          } as any);
        }

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

      console.log('[App Init] Hydration verified - proceeding with IndexedDB initialization');

      // Initialize IndexedDB
      await storageService.init();

      // Load messages from IndexedDB
      const storedMessages = await storageService.getAllMessages();

      // If no messages exist, populate with default messages
      if (storedMessages.length === 0) {
        const messagesToAdd = defaultMessages.map((msg) => ({
          ...msg,
          // Remove explicit ID - let IndexedDB autoIncrement generate IDs
          createdAt: new Date(),
          isCustom: false,
        }));

        await storageService.addMessages(messagesToAdd);

        // Reload messages from IndexedDB to get auto-generated IDs
        const messagesWithIds = await storageService.getAllMessages();

        // Update messages in parent store
        if (state.messages !== undefined) {
          set({ messages: messagesWithIds } as any);
        }
      } else {
        // Update messages in parent store
        if (state.messages !== undefined) {
          set({ messages: storedMessages } as any);
        }
      }

      // Update current message if needed (call parent store's method)
      if (state.updateCurrentMessage) {
        state.updateCurrentMessage();
      }

      if (state.isLoading !== undefined) {
        set({ isLoading: false } as any);
      }

      isInitialized = true;
      console.log('[App Init] Initialization completed successfully');
    } catch (error) {
      console.error('Error initializing app:', error);

      const currentState = get();
      if (currentState.error !== undefined) {
        set({ error: 'Failed to initialize app', isLoading: false } as any);
      }
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
        console.error('[Settings] Validation failed:', createValidationError(error as ZodError).message);
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
          console.error('[Settings] Validation failed:', createValidationError(error as ZodError).message);
          throw createValidationError(error as ZodError);
        }
        throw error;
      }
    }
  },

  setOnboarded: (onboarded) => {
    set({ isOnboarded: onboarded });
  },

  // Anniversary actions
  addAnniversary: (anniversary) => {
    const { settings } = get();
    if (settings) {
      const newId =
        Math.max(0, ...settings.relationship.anniversaries.map((a) => a.id)) + 1;
      const newAnniversary: Anniversary = { ...anniversary, id: newId };

      set({
        settings: {
          ...settings,
          relationship: {
            ...settings.relationship,
            anniversaries: [...settings.relationship.anniversaries, newAnniversary],
          },
        },
      });
    }
  },

  removeAnniversary: (id) => {
    const { settings } = get();
    if (settings) {
      set({
        settings: {
          ...settings,
          relationship: {
            ...settings.relationship,
            anniversaries: settings.relationship.anniversaries.filter(
              (a) => a.id !== id
            ),
          },
        },
      });
    }
  },

  // Theme actions
  setTheme: (theme) => {
    const { settings } = get();
    if (settings) {
      set({
        settings: {
          ...settings,
          themeName: theme,
        },
      });
    }
  },
});

// Export initialization guards for use in main store
export { isInitializing, isInitialized };
