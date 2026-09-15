/**
 * Messages Slice
 *
 * Manages all message-related state and actions including:
 * - Message loading and CRUD operations
 * - Message history and navigation
 * - Custom messages management
 * - Import/export functionality
 *
 * Cross-slice dependencies:
 * - Depends on Settings (uses settings.relationship.startDate for message rotation)
 * - authSlice: custom messages belong to one account. Every action that reaches
 *   IndexedDB captures `{ userId, authSessionVersion }` at entry, passes the
 *   captured id to the service, and rechecks the pair before every post-await
 *   `set()` — the `photosSlice`/`eventsSlice` idiom. `authSessionVersion` is
 *   paired with `userId` rather than compared alone so that A → signed out → A
 *   again is distinguishable from an uninterrupted A: `clearAuth` bumps it on
 *   every sign-out, and an id-only compare would let a request raised in the
 *   dead session write as if it were live.
 */

import { customMessageService } from '../../services/customMessageService';
import { storageService } from '../../services/storage';
import type {
  CreateMessageInput,
  CustomMessage,
  Message,
  MessageFilter,
  MessageHistory,
  UpdateMessageInput,
} from '../../types';
import { formatDateISO } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import { getAvailableHistoryDays, getDailyMessage } from '../../utils/messageRotation';
import type { AppStateCreator } from '../types';

export interface MessagesSlice {
  // State
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;
  currentDayOffset: number; // @deprecated Story 3.3: Use messageHistory.currentIndex instead
  customMessages: CustomMessage[];
  customMessagesLoaded: boolean;

  // Actions
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: Message['category']) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;

  // Navigation actions
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;

  // Custom message actions
  loadCustomMessages: () => Promise<void>;
  createCustomMessage: (input: CreateMessageInput) => Promise<void>;
  updateCustomMessage: (input: UpdateMessageInput) => Promise<void>;
  deleteCustomMessage: (id: number) => Promise<void>;
  getCustomMessages: (filter?: MessageFilter) => CustomMessage[];
  exportCustomMessages: () => Promise<void>;
  importCustomMessages: (file: File) => Promise<{ imported: number; skipped: number }>;
}

export const createMessagesSlice: AppStateCreator<MessagesSlice> = (set, get, _api) => ({
  // Initial state
  messages: [],
  messageHistory: {
    currentIndex: 0, // Story 3.3: 0 = today, 1 = yesterday, etc.
    shownMessages: new Map(), // Story 3.3: Date → Message ID mapping
    maxHistoryDays: 30, // Story 3.3: History limit
    favoriteIds: [], // Account-specific projection loaded from IndexedDB
    // Deprecated fields (migration):
    lastShownDate: '',
    lastMessageId: 0,
    viewedIds: [],
  },
  currentMessage: null,
  currentDayOffset: 0, // @deprecated Story 3.3: Use messageHistory.currentIndex instead
  customMessages: [],
  customMessagesLoaded: false,

  // Actions
  loadMessages: async () => {
    // Rotation pool: shared daily rows plus this account's own custom rows.
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      const messages = await storageService.getAllMessages(requestedBy);
      if (!stillCurrent()) return;
      set((state) => ({
        messages,
        currentMessage: messages.find((message) => message.id === state.currentMessage?.id) ?? null,
        messageHistory: {
          ...state.messageHistory,
          favoriteIds: messages.filter((message) => message.isFavorite).map((message) => message.id),
        },
      }));
      if (stillCurrent() && !get().currentMessage) get().updateCurrentMessage();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  },

  /**
   * @deprecated Dead action: no component calls it, and it writes `isCustom:
   * true` straight through `storageService.addMessage` with no owner — which
   * would produce exactly the legacy unowned row this slice now hides.
   * Deliberately left alone (removing it is not this change), but do not wire a
   * caller to it. Use `createCustomMessage`, which stamps the owner.
   */
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
    // Persist under the captured owner, then project the committed value only
    // if the same account session still owns the UI.
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      const isFavorite = await storageService.toggleFavorite(messageId, requestedBy);

      if (!stillCurrent()) return;

      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? { ...msg, isFavorite } : msg
        ),
        currentMessage:
          state.currentMessage?.id === messageId
            ? { ...state.currentMessage, isFavorite }
            : state.currentMessage,
        messageHistory: {
          ...state.messageHistory,
          favoriteIds: isFavorite
            ? [...new Set([...state.messageHistory.favoriteIds, messageId])]
            : state.messageHistory.favoriteIds.filter((id) => id !== messageId),
        },
      }));
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
    const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);

    if (rotationPool.length === 0) {
      console.error('[MessageHistory] No active messages available for rotation');
      return;
    }

    // Get today's date
    const today = new Date();
    const dateString = formatDateISO(today);

    // Check if today's message is already cached
    let messageId = messageHistory.shownMessages.get(dateString);

    // A cached id that is no longer in `messages` must be treated as a miss, not
    // as authoritative. `shownMessages` is persisted and `messages` is not, so a
    // no-session boot runs `clearAuth()` against an empty pool and its prune
    // strips nothing — leaving the previous account's custom id for today in the
    // map. Without this membership check the lookup below returns undefined and
    // Home is stuck on "Failed to load message" for the rest of the calendar day.
    if (!messageId || !messages.some((m) => m.id === messageId)) {
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

      logger.debug(`[MessageRotation] New day! Today's message ID: ${messageId}`);
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
        logger.debug(
          `[MessageRotation] Reset to today (index 0) from index ${messageHistory.currentIndex}`
        );
      }
    }

    // Load the message object
    const currentMessage = messages.find((m) => m.id === messageId);
    set({ currentMessage });
  },

  // Navigation actions (Story 3.3)
  navigateToPreviousMessage: () => {
    const { messageHistory, messages, currentMessage, settings } = get();

    // Access settings from full AppState via get()
    if (!settings || messages.length === 0) return;

    // Story 3.5: Filter rotation pool (exclude inactive custom messages)
    const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);

    if (rotationPool.length === 0) {
      console.error('[MessageHistory] No active messages available for rotation');
      return;
    }

    // Check if can navigate back (using full AppState)
    if (!get().canNavigateBack()) {
      console.warn('[MessageHistory] Cannot navigate back - at history limit');
      return;
    }

    // Cache current date before navigating away (prevents missing cache entries)
    const today = new Date();
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - messageHistory.currentIndex);
    const currentDateString = formatDateISO(currentDate);

    const updatedShownMessages = new Map(messageHistory.shownMessages);
    if (!updatedShownMessages.has(currentDateString) && currentMessage) {
      updatedShownMessages.set(currentDateString, currentMessage.id);
      logger.debug(`[MessageHistory] Cached current date ${currentDateString} before navigating`);
    }

    // Increment index (0 → 1 = today → yesterday)
    const newIndex = messageHistory.currentIndex + 1;

    // Calculate target date
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - newIndex);
    const dateString = formatDateISO(targetDate);

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

    logger.debug(`[MessageHistory] Navigated to ${dateString}, message ID: ${messageId}`);
  },

  navigateToNextMessage: () => {
    const { messageHistory, messages } = get();

    if (messages.length === 0) return;

    // Story 3.5: Filter rotation pool (exclude inactive custom messages)
    const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);

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
    const dateString = formatDateISO(targetDate);

    // Load message for target date (compute + cache on miss, mirroring navigateToPreviousMessage)
    const updatedShownMessages = new Map(messageHistory.shownMessages);
    let messageId = updatedShownMessages.get(dateString);

    if (!messageId) {
      const message = getDailyMessage(rotationPool, targetDate);
      messageId = message.id;
      updatedShownMessages.set(dateString, messageId);
    }

    // Update state
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

    logger.debug(`[MessageHistory] Navigated to ${dateString}, message ID: ${messageId}`);
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
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      // Signed out this returns [], so the AdminPanel list empties rather than
      // showing whatever the last account left on disk.
      const customMessagesFromDB = await customMessageService.getAllForUser(requestedBy, {
        isCustom: true,
      });

      // Convert Date objects to ISO strings for CustomMessage interface
      const customMessages: CustomMessage[] = customMessagesFromDB.map((m) => ({
        id: m.id,
        text: m.text,
        category: m.category,
        isCustom: m.isCustom,
        active: m.active ?? true,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt?.toISOString(),
        tags: m.tags,
      }));

      if (!stillCurrent()) return;
      set({ customMessages, customMessagesLoaded: true });
      logger.debug(`[AdminPanel] Loaded ${customMessages.length} custom messages from IndexedDB`);
    } catch (error) {
      console.error('[AdminPanel] Error loading custom messages from IndexedDB:', error);
      // The `loaded` flag is half the guard: AdminPanel re-fires this effect
      // while it is false, so an early return that skipped it would spin.
      if (!stillCurrent()) return;
      set({ customMessages: [], customMessagesLoaded: true });
    }
  },

  createCustomMessage: async (input: CreateMessageInput) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      // Story 3.5: Save to IndexedDB via customMessageService.
      // Throws when signed out — there is no owner to stamp the row with.
      const message = await customMessageService.create(requestedBy, input);

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

      // The row is written and stamped with the id that asked for it either
      // way; it is this session's STORE that is withheld once the account has
      // changed under the request.
      if (!stillCurrent()) return;

      // Update state (optimistic UI update)
      set((state) => ({
        customMessages: [...state.customMessages, newCustomMessage],
      }));

      // Also update main messages array for rotation
      await get().loadMessages();

      logger.debug(
        `[AdminPanel] Created custom message ID: ${message.id}, category: ${input.category}`
      );
    } catch (error) {
      console.error('[AdminPanel] Failed to create custom message:', error);
      throw error; // Re-throw for UI error handling
    }
  },

  updateCustomMessage: async (input: UpdateMessageInput) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      // Story 3.5: Update in IndexedDB via customMessageService.
      // Throws when the row is not this user's, so a stale id from another
      // account's list cannot change their message.
      await customMessageService.updateMessage(requestedBy, input);

      if (!stillCurrent()) return;

      // Update state (optimistic UI update)
      set((state) => ({
        customMessages: state.customMessages.map((msg) => {
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

      logger.debug(`[AdminPanel] Updated custom message ID: ${input.id}`);
    } catch (error) {
      console.error('[AdminPanel] Failed to update custom message:', error);
      throw error; // Re-throw for UI error handling
    }
  },

  deleteCustomMessage: async (id: number) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      // Story 3.5: Delete from IndexedDB via customMessageService.
      // Throws for a row this user does not own.
      await customMessageService.deleteForUser(requestedBy, id);

      if (!stillCurrent()) return;

      // Update state (optimistic UI update)
      set((state) => ({
        customMessages: state.customMessages.filter((msg) => msg.id !== id),
      }));

      // Reload messages to update rotation pool
      await get().loadMessages();

      logger.debug(`[AdminPanel] Deleted custom message ID: ${id}`);
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
      filtered = filtered.filter((msg) => msg.category === filter.category);
    }

    // Filter by active status
    if (filter.active !== undefined) {
      filtered = filtered.filter((msg) => msg.active === filter.active);
    }

    // Filter by search term
    if (filter.searchTerm) {
      const searchLower = filter.searchTerm.toLowerCase();
      filtered = filtered.filter((msg) => msg.text.toLowerCase().includes(searchLower));
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(
        (msg) => msg.tags && msg.tags.some((tag) => filter.tags!.includes(tag))
      );
    }

    return filtered;
  },

  // Export custom messages to JSON file (Story 3.5 AC-3.5.6)
  exportCustomMessages: async () => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      const exportData = await customMessageService.exportMessages(requestedBy);

      // Guarded even though nothing here writes the store: the download itself
      // is the disclosure. A file A asked for must not land in B's Downloads
      // because the account changed while the read was in flight.
      if (!stillCurrent()) return;

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

      logger.debug(
        `[AdminPanel] Exported ${exportData.messageCount} custom messages to ${filename}`
      );
    } catch (error) {
      console.error('[AdminPanel] Failed to export custom messages:', error);
      throw error;
    }
  },

  // Import custom messages from JSON file (Story 3.5 AC-3.5.6)
  importCustomMessages: async (file: File) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    const stillCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    try {
      // Read file content
      const text = await file.text();
      const exportData = JSON.parse(text);

      // Import via service. Rows are stamped with the id captured at entry, so
      // an import that settles after a switch still belongs to the account that
      // started it — never to whoever is signed in when it lands.
      const result = await customMessageService.importMessages(requestedBy, exportData);

      // The rows are A's and stay A's; B's store is simply not touched.
      if (!stillCurrent()) return result;

      // Reload custom messages and main messages
      await get().loadCustomMessages();
      await get().loadMessages();

      logger.debug(
        `[AdminPanel] Import complete: ${result.imported} imported, ${result.skipped} duplicates skipped`
      );

      // Return result for UI feedback
      return result;
    } catch (error) {
      console.error('[AdminPanel] Failed to import custom messages:', error);
      throw error;
    }
  },
});
