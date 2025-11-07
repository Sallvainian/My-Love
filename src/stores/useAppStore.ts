import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Settings,
  MessageHistory,
  Message,
  MoodEntry,
  ThemeName,
  Anniversary,
  CustomMessage,
  CreateMessageInput,
  UpdateMessageInput,
  MessageFilter,
} from '../types';
import { storageService } from '../services/storage';
import { customMessageService } from '../services/customMessageService';
import defaultMessages from '../data/defaultMessages';
import {
  getDailyMessage,
  formatDate,
  getAvailableHistoryDays,
} from '../utils/messageRotation';
import { APP_CONFIG } from '../config/constants';

interface AppState {
  // Settings
  settings: Settings | null;
  isOnboarded: boolean;

  // Message state
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;

  // Navigation state (Story 3.2)
  currentDayOffset: number; // 0 = today, 1 = yesterday, 2 = 2 days ago, etc.

  // Custom message state (Story 3.4)
  customMessages: CustomMessage[];
  customMessagesLoaded: boolean;

  // Mood tracking
  moods: MoodEntry[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeApp: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setOnboarded: (onboarded: boolean) => void;

  // Message actions
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: Message['category']) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;

  // Navigation actions (Story 3.2)
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;

  // Custom message actions (Story 3.5: Async with IndexedDB)
  loadCustomMessages: () => Promise<void>;
  createCustomMessage: (input: CreateMessageInput) => Promise<void>;
  updateCustomMessage: (input: UpdateMessageInput) => Promise<void>;
  deleteCustomMessage: (id: number) => Promise<void>;
  getCustomMessages: (filter?: MessageFilter) => CustomMessage[];
  exportCustomMessages: () => Promise<void>;
  importCustomMessages: (file: File) => Promise<{ imported: number; skipped: number }>;

  // Mood actions
  addMoodEntry: (mood: MoodEntry['mood'], note?: string) => void;
  getMoodForDate: (date: string) => MoodEntry | undefined;

  // Anniversary actions
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void;
  removeAnniversary: (id: number) => void;

  // Theme actions
  setTheme: (theme: ThemeName) => void;
}

// Initialization guards to prevent concurrent/duplicate initialization (StrictMode protection)
let isInitializing = false;
let isInitialized = false;
let isHydrated = false; // Track if Zustand persist hydration has completed

// State validation helper
function validateHydratedState(state: Partial<AppState> | undefined): { isValid: boolean; errors: string[] } {
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
    // After deserialization, shownMessages should be a Map
    // This validation runs AFTER deserialization, so it must be a Map by now
    if (state.messageHistory.shownMessages && !(state.messageHistory.shownMessages instanceof Map)) {
      errors.push('shownMessages is not a Map instance after deserialization');
    }
    if (state.messageHistory.currentIndex !== undefined && typeof state.messageHistory.currentIndex !== 'number') {
      errors.push('currentIndex is not a number');
    }
  }

  // Only fail validation if we have CRITICAL errors
  // Missing fields are OK - they'll use defaults
  const hasCriticalErrors = errors.some(err =>
    err.includes('not a Map instance') ||
    err.includes('not a number')
  );

  return { isValid: !hasCriticalErrors, errors };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
      messages: [],
      messageHistory: {
        currentIndex: 0,           // Story 3.3: 0 = today, 1 = yesterday, etc.
        shownMessages: new Map(),  // Story 3.3: Date → Message ID mapping
        maxHistoryDays: 30,        // Story 3.3: History limit
        favoriteIds: [],           // Keep for legacy favorite tracking
        // Deprecated fields (migration):
        lastShownDate: '',
        lastMessageId: 0,
        viewedIds: [],
      },
      currentMessage: null,
      currentDayOffset: 0, // @deprecated Story 3.3: Use messageHistory.currentIndex instead
      customMessages: [],
      customMessagesLoaded: false,
      moods: [],
      isLoading: false,
      error: null,

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
        set({ isLoading: true, error: null });

        try {
          // CRITICAL: Check Zustand persist hydration status
          // Hydration completes synchronously during store creation (before initializeApp is called)
          // If isHydrated is false at this point, hydration FAILED
          if (!isHydrated) {
            console.error('[App Init] CRITICAL: Hydration failed or did not complete');
            console.error('[App Init] This indicates corrupted localStorage data');
            set({
              error: 'Failed to load saved settings. App will reinitialize with defaults.',
              isLoading: false
            });

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
            set({ messages: messagesWithIds });
          } else {
            set({ messages: storedMessages });
          }

          // Update current message if needed
          get().updateCurrentMessage();

          set({ isLoading: false });
          isInitialized = true;
          console.log('[App Init] Initialization completed successfully');
        } catch (error) {
          console.error('Error initializing app:', error);
          set({ error: 'Failed to initialize app', isLoading: false });
        } finally {
          isInitializing = false;
        }
      },

      // Settings actions
      setSettings: (settings) => {
        set({ settings });
      },

      updateSettings: (updates) => {
        const { settings } = get();
        if (settings) {
          set({ settings: { ...settings, ...updates } });
        }
      },

      setOnboarded: (onboarded) => {
        set({ isOnboarded: onboarded });
      },

      // Message actions
      loadMessages: async () => {
        try {
          const messages = await storageService.getAllMessages();
          set({ messages });
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      },

      addMessage: async (text, category) => {
        try {
          const newMessage: Omit<Message, 'id'> = {
            text,
            category,
            isCustom: true,
            createdAt: new Date(),
            isFavorite: false,
          };

          const id = await storageService.addMessage(newMessage);
          const messageWithId = { ...newMessage, id };

          set((state) => ({
            messages: [...state.messages, messageWithId],
          }));
        } catch (error) {
          console.error('Error adding message:', error);
        }
      },

      toggleFavorite: async (messageId) => {
        try {
          await storageService.toggleFavorite(messageId);

          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === messageId ? { ...msg, isFavorite: !msg.isFavorite } : msg
            ),
            messageHistory: {
              ...state.messageHistory,
              favoriteIds: state.messages.find((m) => m.id === messageId)?.isFavorite
                ? state.messageHistory.favoriteIds.filter((id) => id !== messageId)
                : [...state.messageHistory.favoriteIds, messageId],
            },
          }));

          // Update current message if it's the one being favorited
          get().updateCurrentMessage();
        } catch (error) {
          console.error('Error toggling favorite:', error);
        }
      },

      updateCurrentMessage: () => {
        const { messages, messageHistory } = get();

        if (messages.length === 0) {
          console.warn('[MessageHistory] No messages loaded yet');
          return;
        }

        // Story 3.5: Filter out inactive custom messages from rotation pool
        // Keep default messages + only active custom messages
        const rotationPool = messages.filter(m => !m.isCustom || m.active !== false);

        if (rotationPool.length === 0) {
          console.error('[MessageHistory] No active messages available for rotation');
          return;
        }

        // Get today's date
        const today = new Date();
        const dateString = formatDate(today);

        // Check if today's message is already cached
        let messageId = messageHistory.shownMessages.get(dateString);

        if (!messageId) {
          // Calculate today's message using rotation algorithm with filtered pool
          const todayMessage = getDailyMessage(rotationPool, today);
          messageId = todayMessage.id;

          // Cache it
          const updatedShownMessages = new Map(messageHistory.shownMessages);
          updatedShownMessages.set(dateString, messageId);

          set({
            messageHistory: {
              ...messageHistory,
              shownMessages: updatedShownMessages,
              currentIndex: 0, // Reset to today
            },
          });

          if (import.meta.env.DEV) {
            console.log(`[MessageRotation] New day! Today's message ID: ${messageId}`);
          }
        } else {
          // Story 3.3 Fix: Always reset to today on app initialization
          // Even if message is cached, ensure currentIndex = 0 for new session
          if (messageHistory.currentIndex !== 0) {
            set({
              messageHistory: {
                ...messageHistory,
                currentIndex: 0, // Reset to today
              },
            });
            if (import.meta.env.DEV) {
              console.log(`[MessageRotation] Reset to today (index 0) from index ${messageHistory.currentIndex}`);
            }
          }
        }

        // Load the message object
        const currentMessage = messages.find((m) => m.id === messageId);
        set({ currentMessage });
      },

      // Navigation actions (Story 3.3)
      navigateToPreviousMessage: () => {
        const { messageHistory, messages, settings, currentMessage } = get();

        if (!settings || messages.length === 0) return;

        // Story 3.5: Filter rotation pool (exclude inactive custom messages)
        const rotationPool = messages.filter(m => !m.isCustom || m.active !== false);

        if (rotationPool.length === 0) {
          console.error('[MessageHistory] No active messages available for rotation');
          return;
        }

        // Check if can navigate back
        if (!get().canNavigateBack()) {
          console.warn('[MessageHistory] Cannot navigate back - at history limit');
          return;
        }

        // Cache current date before navigating away (prevents missing cache entries)
        const today = new Date();
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() - messageHistory.currentIndex);
        const currentDateString = formatDate(currentDate);

        let updatedShownMessages = new Map(messageHistory.shownMessages);
        if (!updatedShownMessages.has(currentDateString) && currentMessage) {
          updatedShownMessages.set(currentDateString, currentMessage.id);
          if (import.meta.env.DEV) {
            console.log(`[MessageHistory] Cached current date ${currentDateString} before navigating`);
          }
        }

        // Increment index (0 → 1 = today → yesterday)
        const newIndex = messageHistory.currentIndex + 1;

        // Calculate target date
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - newIndex);
        const dateString = formatDate(targetDate);

        // Check if message for target date is cached
        let messageId = updatedShownMessages.get(dateString);

        // If not cached, calculate and cache it (use filtered pool)
        if (!messageId) {
          const message = getDailyMessage(rotationPool, targetDate);
          messageId = message.id;
          updatedShownMessages.set(dateString, messageId);
        }

        // Update state with both current and target cached
        set({
          messageHistory: {
            ...messageHistory,
            currentIndex: newIndex,
            shownMessages: updatedShownMessages,
          },
          currentDayOffset: newIndex, // Keep for backward compatibility
        });

        // Update currentMessage to trigger UI re-render
        const targetMessage = messages.find((m) => m.id === messageId);
        if (targetMessage) {
          set({ currentMessage: targetMessage });
        }

        if (import.meta.env.DEV) {
          console.log(`[MessageHistory] Navigated to ${dateString}, message ID: ${messageId}`);
        }
      },

      navigateToNextMessage: () => {
        const { messageHistory, messages } = get();

        if (messages.length === 0) return;

        // Story 3.5: Filter rotation pool (exclude inactive custom messages)
        const rotationPool = messages.filter(m => !m.isCustom || m.active !== false);

        if (rotationPool.length === 0) {
          console.error('[MessageHistory] No active messages available for rotation');
          return;
        }

        // Check if can navigate forward
        if (!get().canNavigateForward()) {
          console.warn('[MessageHistory] Cannot navigate forward - already at today');
          return;
        }

        // Decrement index (1 → 0 = yesterday → today)
        const newIndex = messageHistory.currentIndex - 1;

        // Calculate target date
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - newIndex);
        const dateString = formatDate(targetDate);

        // Load message for target date (should be cached)
        const messageId = messageHistory.shownMessages.get(dateString);
        const targetMessage = messages.find((m) => m.id === messageId);

        // Update state
        set({
          messageHistory: {
            ...messageHistory,
            currentIndex: newIndex,
          },
          currentDayOffset: newIndex, // Keep for backward compatibility
          currentMessage: targetMessage || null,
        });

        if (import.meta.env.DEV) {
          console.log(`[MessageHistory] Navigated to ${dateString}, message ID: ${messageId}`);
        }
      },

      canNavigateBack: () => {
        const { messageHistory, settings } = get();
        if (!settings) return false;

        const availableDays = getAvailableHistoryDays(messageHistory, settings);
        return messageHistory.currentIndex < availableDays;
      },

      canNavigateForward: () => {
        const { messageHistory } = get();
        // Can navigate forward if not at today (currentIndex > 0)
        return messageHistory.currentIndex > 0;
      },

      // Custom message actions (Story 3.5: Migrated to IndexedDB)
      loadCustomMessages: async () => {
        try {
          const customMessagesFromDB = await customMessageService.getAll({ isCustom: true });

          // Convert Date objects to ISO strings for CustomMessage interface
          const customMessages: CustomMessage[] = customMessagesFromDB.map(m => ({
            id: m.id,
            text: m.text,
            category: m.category,
            isCustom: m.isCustom,
            active: m.active ?? true,
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt?.toISOString(),
            tags: m.tags,
          }));

          set({ customMessages, customMessagesLoaded: true });
          if (import.meta.env.DEV) {
            console.log(`[AdminPanel] Loaded ${customMessages.length} custom messages from IndexedDB`);
          }
        } catch (error) {
          console.error('[AdminPanel] Error loading custom messages from IndexedDB:', error);
          set({ customMessages: [], customMessagesLoaded: true });
        }
      },

      createCustomMessage: async (input: CreateMessageInput) => {
        try {
          // Story 3.5: Save to IndexedDB via customMessageService
          const message = await customMessageService.create(input);

          // Convert to CustomMessage format for state
          const newCustomMessage: CustomMessage = {
            id: message.id,
            text: message.text,
            category: message.category,
            isCustom: true,
            active: message.active ?? true,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt?.toISOString(),
            tags: message.tags,
          };

          // Update state (optimistic UI update)
          set(state => ({
            customMessages: [...state.customMessages, newCustomMessage],
          }));

          // Also update main messages array for rotation
          await get().loadMessages();

          if (import.meta.env.DEV) {
            console.log(`[AdminPanel] Created custom message ID: ${message.id}, category: ${input.category}`);
          }
        } catch (error) {
          console.error('[AdminPanel] Failed to create custom message:', error);
          throw error; // Re-throw for UI error handling
        }
      },

      updateCustomMessage: async (input: UpdateMessageInput) => {
        try {
          // Story 3.5: Update in IndexedDB via customMessageService
          await customMessageService.update(input);

          // Update state (optimistic UI update)
          set(state => ({
            customMessages: state.customMessages.map(msg => {
              if (msg.id === input.id) {
                return {
                  ...msg,
                  ...(input.text !== undefined && { text: input.text }),
                  ...(input.category !== undefined && { category: input.category }),
                  ...(input.active !== undefined && { active: input.active }),
                  ...(input.tags !== undefined && { tags: input.tags }),
                  updatedAt: new Date().toISOString(),
                };
              }
              return msg;
            }),
          }));

          // Reload messages to update rotation pool
          await get().loadMessages();

          if (import.meta.env.DEV) {
            console.log(`[AdminPanel] Updated custom message ID: ${input.id}`);
          }
        } catch (error) {
          console.error('[AdminPanel] Failed to update custom message:', error);
          throw error; // Re-throw for UI error handling
        }
      },

      deleteCustomMessage: async (id: number) => {
        try {
          // Story 3.5: Delete from IndexedDB via customMessageService
          await customMessageService.delete(id);

          // Update state (optimistic UI update)
          set(state => ({
            customMessages: state.customMessages.filter(msg => msg.id !== id),
          }));

          // Reload messages to update rotation pool
          await get().loadMessages();

          if (import.meta.env.DEV) {
            console.log(`[AdminPanel] Deleted custom message ID: ${id}`);
          }
        } catch (error) {
          console.error('[AdminPanel] Failed to delete custom message:', error);
          throw error; // Re-throw for UI error handling
        }
      },

      getCustomMessages: (filter?: MessageFilter) => {
        const { customMessages } = get();

        if (!filter) {
          return customMessages;
        }

        let filtered = customMessages;

        // Filter by category
        if (filter.category && filter.category !== 'all') {
          filtered = filtered.filter(msg => msg.category === filter.category);
        }

        // Filter by active status
        if (filter.active !== undefined) {
          filtered = filtered.filter(msg => msg.active === filter.active);
        }

        // Filter by search term
        if (filter.searchTerm) {
          const searchLower = filter.searchTerm.toLowerCase();
          filtered = filtered.filter(msg =>
            msg.text.toLowerCase().includes(searchLower)
          );
        }

        // Filter by tags
        if (filter.tags && filter.tags.length > 0) {
          filtered = filtered.filter(msg =>
            msg.tags && msg.tags.some(tag => filter.tags!.includes(tag))
          );
        }

        return filtered;
      },

      // Export custom messages to JSON file (Story 3.5 AC-3.5.6)
      exportCustomMessages: async () => {
        try {
          const exportData = await customMessageService.exportMessages();

          // Generate filename with current date
          const dateStr = new Date().toISOString().split('T')[0];
          const filename = `my-love-custom-messages-${dateStr}.json`;

          // Create blob and trigger download
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          if (import.meta.env.DEV) {
            console.log(`[AdminPanel] Exported ${exportData.messageCount} custom messages to ${filename}`);
          }
        } catch (error) {
          console.error('[AdminPanel] Failed to export custom messages:', error);
          throw error;
        }
      },

      // Import custom messages from JSON file (Story 3.5 AC-3.5.6)
      importCustomMessages: async (file: File) => {
        try {
          // Read file content
          const text = await file.text();
          const exportData = JSON.parse(text);

          // Import via service
          const result = await customMessageService.importMessages(exportData);

          // Reload custom messages and main messages
          await get().loadCustomMessages();
          await get().loadMessages();

          if (import.meta.env.DEV) {
            console.log(
              `[AdminPanel] Import complete: ${result.imported} imported, ${result.skipped} duplicates skipped`
            );
          }

          // Return result for UI feedback
          return result;
        } catch (error) {
          console.error('[AdminPanel] Failed to import custom messages:', error);
          throw error;
        }
      },

      // Mood actions
      addMoodEntry: (mood, note) => {
        const today = new Date().toISOString().split('T')[0];
        const newMood: MoodEntry = {
          date: today,
          mood,
          note,
        };

        set((state) => ({
          moods: [...state.moods.filter((m) => m.date !== today), newMood],
        }));
      },

      getMoodForDate: (date) => {
        return get().moods.find((m) => m.date === date);
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
          shownMessages: state.messageHistory?.shownMessages instanceof Map
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
          console.error(
            '[Zustand Persist] Failed to rehydrate state from LocalStorage:',
            error
          );

          // Attempt to recover: clear corrupted state
          try {
            localStorage.removeItem('my-love-storage');
            console.warn(
              '[Zustand Persist] Corrupted state cleared. App will reinitialize with defaults.'
            );
          } catch (clearError) {
            console.error('[Zustand Persist] Failed to clear corrupted state:', clearError);
          }

          // CRITICAL: Mark hydration as complete even if error occurred
          // This allows app initialization to proceed with defaults
          isHydrated = true;

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
              console.warn('[Zustand Persist] shownMessages is null/undefined - creating empty Map');
              state.messageHistory.shownMessages = new Map();
            } else if (Array.isArray(shownMessagesArray)) {
              // Validate array structure before converting to Map
              const isValidArray = shownMessagesArray.every(
                item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
              );

              if (isValidArray) {
                state.messageHistory.shownMessages = new Map(shownMessagesArray);
                console.log(
                  '[Zustand Persist] Message history Map deserialized successfully:',
                  `${shownMessagesArray.length} entries`
                );
              } else {
                console.error('[Zustand Persist] Invalid shownMessages array structure - resetting to empty Map');
                state.messageHistory.shownMessages = new Map();

                // Mark state as potentially corrupted
                console.warn('[Zustand Persist] Message history was corrupted and has been reset');
              }
            } else {
              console.error('[Zustand Persist] shownMessages is not an array - resetting to empty Map');
              state.messageHistory.shownMessages = new Map();
            }
          } catch (deserializationError) {
            console.error('[Zustand Persist] Failed to deserialize shownMessages Map:', deserializationError);
            state.messageHistory.shownMessages = new Map();

            // Mark for potential full state reset
            console.error('[Zustand Persist] CRITICAL: Map deserialization failed - state may be corrupted');
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
          console.warn('[Zustand Persist] settings is null - app will use defaults from initial state');
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

        // Mark hydration as complete (even if validation failed - app uses defaults)
        isHydrated = true;
      },
    }
  )
);

// Expose store to window object for E2E testing
if (typeof window !== 'undefined') {
  (window as any).__APP_STORE__ = useAppStore;
}
