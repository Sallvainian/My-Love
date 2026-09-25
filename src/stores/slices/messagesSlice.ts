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
 * - Depends on Settings: `coupleSettings.relationshipStart` bounds how far back
 *   history can be browsed (`canNavigateBack`); the rotation itself ignores it
 * - authSlice: custom messages belong to one account. Every action captures
 *   `{ userId, authSessionVersion }` at entry, passes the captured id to the
 *   services, and rechecks the pair before every post-await `set()` and before
 *   saving the local copy — the `photosSlice`/`eventsSlice` idiom.
 *   `authSessionVersion` is paired with `userId` rather than compared alone so
 *   that A → signed out → A again is distinguishable from an uninterrupted A:
 *   `clearAuth` bumps it on every sign-out, and an id-only compare would let a
 *   request raised in the dead session write as if it were live.
 *
 * Where the data lives:
 * - The bundled daily messages are the `messages` IndexedDB store, shared by
 *   every account (`storageService`).
 * - Custom messages and favorites are Supabase data (`customMessagesApi`,
 *   `messageFavoritesApi`). The device keeps them in the account's shared local
 *   copy (`services/localCopy.ts`, kind `message-data`, value
 *   `MessageDataCopy`): the custom rows with their local ids, the favorited
 *   bundled ids, and the next free id. `loadMessages` and `loadCustomMessages`
 *   render from that copy, so Home and the Admin panel work offline.
 * - `loadMessageDataFromServer` is the kind's refresher (signed-in start,
 *   reconnect, on demand): it shows the saved copy, then replaces the copy with
 *   the server's rows. It waits until the bundled rows are seeded (`messages`
 *   non-empty), because bundled favorites are matched to their local ids by
 *   hashing the seeded texts; App.tsx triggers it when seeding completes.
 * - Every write needs a connection (`customMessagesApi` and
 *   `messageFavoritesApi` refuse offline) and goes to the server first. Only a
 *   confirmed write updates the copy, inside the account-data queue
 *   (`accountDataQueue.ts`) so a refresh cannot erase it mid-flight.
 * - Sign-out deletes the outgoing account's copy with every other kind
 *   (`deleteAccountCopies`, `authSlice.ts`).
 */

import { serializeAccountDataWrite } from '../../services/accountDataQueue';
import { customMessagesApi } from '../../services/customMessagesApi';
import {
  customMessageService,
  emptyMessageData,
  MESSAGE_DATA_COPY_KIND,
  type MessageDataCopy,
  readMessageData,
  writeMessageData,
} from '../../services/customMessageService';
import { registerLocalCopy } from '../../services/localCopy';
import { messageFavoritesApi } from '../../services/messageFavoritesApi';
import { projectMessageFavorites } from '../../services/messageFavorites';
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
import { isOnline } from '../../utils/offlineErrorHandler';
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
  /** Why the last favorite toggle failed (offline included); null after a success. */
  favoriteError: string | null;

  // Actions
  /** Rebuild the rotation pool: the bundled rows plus the account's saved copy. */
  loadMessages: () => Promise<void>;
  /** The `message-data` refresher: replace the saved copy with the server's rows. */
  loadMessageDataFromServer: () => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;

  // Navigation actions
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;

  // Custom message actions
  loadCustomMessages: () => Promise<void>;
  /** `clientKey`: minted once per submit and reused on its retry (useSubmitKey). */
  createCustomMessage: (input: CreateMessageInput, clientKey?: string) => Promise<void>;
  updateCustomMessage: (input: UpdateMessageInput) => Promise<void>;
  deleteCustomMessage: (id: number) => Promise<void>;
  getCustomMessages: (filter?: MessageFilter) => CustomMessage[];
  exportCustomMessages: () => Promise<void>;
  importCustomMessages: (file: File) => Promise<{ imported: number; skipped: number }>;
}

/** Local-copy kind for the account's custom messages and favorites. */
export { MESSAGE_DATA_COPY_KIND };

/** The lowest id a new custom row may take: above every bundled id. */
function minNewCustomId(bundled: Message[]): number {
  return Math.max(0, ...bundled.map((message) => message.id)) + 1;
}

function toCustomMessage(m: Message): CustomMessage {
  return {
    id: m.id,
    text: m.text,
    category: m.category,
    isCustom: true,
    active: m.active ?? true,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt?.toISOString(),
    tags: m.tags,
  };
}

/**
 * A server write succeeded and the copy could not be saved. Saying "failed"
 * would invite a retry that repeats it; the next refresh brings the copy back
 * in line with the server.
 */
function copyNotSaved(cause: unknown): Error {
  console.error('[Messages] Saved to the account, but the local copy was not:', cause);
  return new Error(
    'Your change was saved to your account, but this device could not store its copy. Reload to see it.',
    { cause }
  );
}

/**
 * The auth lifetime whose copy already came from the server. The saved copy is
 * shown first only before that (`loadMessageDataFromServer` step 1). Keyed by
 * `{ userId, authSessionVersion }`, so a new session starts unfresh.
 */
let messageDataFreshFor: { userId: string; authSessionVersion: number } | null = null;

function isFresh(userId: string, authSessionVersion: number): boolean {
  return (
    messageDataFreshFor?.userId === userId &&
    messageDataFreshFor.authSessionVersion === authSessionVersion
  );
}

export const createMessagesSlice: AppStateCreator<MessagesSlice> = (set, get, _api) => {
  // No-op until the bundled rows are seeded (see the header); App.tsx's seeded
  // effect triggers the first run. Re-registering replaces the refresher.
  registerLocalCopy(MESSAGE_DATA_COPY_KIND, async () => {
    if ((get().messages?.length ?? 0) === 0) return;
    await get().loadMessageDataFromServer();
  });

  const isSession = (userId: string | null, authSessionVersion: number) =>
    get().userId === userId && get().authSessionVersion === authSessionVersion;

  /**
   * The copy a write starts from. A copy that cannot be read (or was never
   * saved) is rebuilt from what this session shows, which came from the same
   * copy or the server — never an empty list that would drop the other rows.
   * Only while that session is still on screen: what is shown then belongs to
   * whoever signed in next.
   */
  const readCopyForWrite = async (
    userId: string,
    authSessionVersion: number,
    bundled: Message[]
  ): Promise<MessageDataCopy> => {
    const saved = await readMessageData(userId);
    if (saved) return saved;
    if (!isSession(userId, authSessionVersion)) return emptyMessageData(minNewCustomId(bundled));
    const shown = (get().messages ?? []) as Message[];
    const custom = shown.filter((message) => message.isCustom);
    return {
      ...emptyMessageData(minNewCustomId(bundled)),
      custom,
      bundledFavoriteIds: shown
        .filter((message) => !message.isCustom && message.isFavorite)
        .map((message) => message.id),
      nextCustomId: Math.max(
        minNewCustomId(bundled),
        ...custom.map((message) => message.id + 1)
      ),
    };
  };

  /**
   * One queued custom-message write for `requestedBy` in `requestedInSession`:
   * read the copy, run `send` (the server write, returning the new copy), then —
   * only if the session is unchanged — save it. Resolves `null` when the
   * session ended before the save; the server write stands either way, and the
   * next sign-in's refresh brings it onto this device.
   *
   * `sendAfterSwitch`: a create is still sent for the account that asked when
   * the queue held it across an account switch, as `addAnniversary` does. An
   * edit, delete or favorite is not — its local id was chosen on a screen that
   * has since been replaced.
   */
  const writeThroughCopy = <R>(
    requestedBy: string,
    requestedInSession: number,
    send: (copy: MessageDataCopy, bundled: Message[]) => Promise<{ copy: MessageDataCopy; result: R }>,
    { sendAfterSwitch = false }: { sendAfterSwitch?: boolean } = {}
  ): Promise<R | null> =>
    serializeAccountDataWrite(async () => {
      if (!sendAfterSwitch && !isSession(requestedBy, requestedInSession)) return null;
      const bundled = await storageService.getAllMessages();
      const copy = await readCopyForWrite(requestedBy, requestedInSession, bundled);
      if (!sendAfterSwitch && !isSession(requestedBy, requestedInSession)) return null;

      const { copy: next, result } = await send(copy, bundled);

      if (!isSession(requestedBy, requestedInSession)) return null;
      if (next !== copy) {
        try {
          await writeMessageData(requestedBy, next);
        } catch (error) {
          throw copyNotSaved(error);
        }
      }
      return result;
    });

  /** Create one row on the server and in the copy; see `writeThroughCopy`. */
  const createCustomRow = (
    requestedBy: string | null,
    requestedInSession: number,
    input: CreateMessageInput,
    clientKey: string
  ): Promise<Message | null> => {
    // Signed out: createRemote's owner check rejects before anything is sent.
    if (!requestedBy) {
      return customMessageService.createRemote(null, input, clientKey).then(() => null);
    }
    return writeThroughCopy(
      requestedBy,
      requestedInSession,
      async (copy, bundled) => {
        const remote = await customMessageService.createRemote(requestedBy, input, clientKey);
        const { copy: next, message } = customMessageService.withCreatedRow(
          copy,
          remote,
          requestedBy,
          minNewCustomId(bundled)
        );
        return { copy: next, result: message };
      },
      { sendAfterSwitch: true }
    );
  };

  return {
    // Initial state
    messages: [],
    messageHistory: {
      currentIndex: 0, // Story 3.3: 0 = today, 1 = yesterday, etc.
      shownMessages: new Map(), // Story 3.3: Date → Message ID mapping
      maxHistoryDays: 30, // Story 3.3: History limit
      favoriteIds: [], // Account-specific projection of the message-data copy
      // Deprecated fields (migration):
      lastShownDate: '',
      lastMessageId: 0,
      viewedIds: [],
    },
    currentMessage: null,
    currentDayOffset: 0, // @deprecated Story 3.3: Use messageHistory.currentIndex instead
    customMessages: [],
    customMessagesLoaded: false,
    favoriteError: null,

    // Actions
    loadMessages: async () => {
      // Rotation pool: shared daily rows plus this account's own custom rows.
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      try {
        const [bundled, copy] = await Promise.all([
          storageService.getAllMessages(),
          requestedBy ? readMessageData(requestedBy) : Promise.resolve(null),
        ]);
        if (!stillCurrent()) return;
        const messages = projectMessageFavorites(bundled, copy);
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

    loadMessageDataFromServer: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      // 1. The saved copy, at once — online or offline. Skipped once this
      // session has a server answer, which is newer.
      if (!isFresh(requestedBy, requestedInSession)) {
        await get().loadMessages();
        if (!stillCurrent()) return;
      }

      // 2. Offline there is nothing to ask; the copy (or nothing) stays shown.
      if (!isOnline()) return;

      // 3. The server's rows replace the copy — only on success. Read and save
      // run as one queued step, so a favorite or custom-message write cannot
      // land between them and be erased (accountDataQueue.ts).
      let saved: boolean;
      try {
        saved = await serializeAccountDataWrite(async () => {
          const [customRows, favoriteKeys] = await Promise.all([
            customMessagesApi.fetchCustomMessages(requestedBy),
            messageFavoritesApi.fetchFavoriteKeys(requestedBy),
          ]);
          if (!stillCurrent()) return false;
          const bundled = await storageService.getAllMessages();
          // Unseeded: bundled favorites could not be matched, and saving would
          // erase the saved ones.
          if (bundled.length === 0) return false;
          const [copy, bundledFavoriteIds] = await Promise.all([
            readCopyForWrite(requestedBy, requestedInSession, bundled),
            storageService.bundledFavoriteIds(bundled, favoriteKeys),
          ]);
          // Not saved once the session has ended: sign-out deletes the
          // outgoing account's copy, and a read that lands afterwards must not
          // put it back.
          if (!stillCurrent()) return false;
          const next = customMessageService.withServerRows(
            copy,
            customRows,
            requestedBy,
            bundledFavoriteIds,
            minNewCustomId(bundled)
          );
          await writeMessageData(requestedBy, next);
          messageDataFreshFor = { userId: requestedBy, authSessionVersion: requestedInSession };
          return true;
        });
      } catch (error) {
        // The copy stays as it was, so Home still renders offline.
        console.error('[Messages] Failed to load messages data from the server:', error);
        return;
      }

      if (!saved || !stillCurrent()) return;
      await get().loadMessages();
      if (stillCurrent() && get().customMessagesLoaded) await get().loadCustomMessages();
    },

    toggleFavorite: async (messageId) => {
      // Persist under the captured owner, then project the committed value only
      // if the same account session still owns the UI.
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      set({ favoriteError: null });

      try {
        if (!requestedBy) throw new Error('Favorites require a signed-in user');
        const isFavorite = await writeThroughCopy(
          requestedBy,
          requestedInSession,
          async (copy) => {
            const message =
              copy.custom.find((row) => row.id === messageId) ??
              (await storageService.getMessage(messageId));
            if (!message) throw new Error('Message not found for this user');
            const toggled = await storageService.toggleFavorite(requestedBy, message, copy);
            return { copy: toggled.copy, result: toggled.isFavorite };
          }
        );

        if (isFavorite === null || !stillCurrent()) return;

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
        if (!stillCurrent()) return;
        set({
          favoriteError: error instanceof Error ? error.message : 'Could not save this favorite.',
        });
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

      // Load the message object. A favorite error named the message that was on
      // screen, so it goes when the shown message is recomputed.
      const currentMessage = messages.find((m) => m.id === messageId);
      set({ currentMessage, favoriteError: null });
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
        set({ currentMessage: targetMessage, favoriteError: null });
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
        set({ currentMessage: targetMessage, favoriteError: null });
      }

      logger.debug(`[MessageHistory] Navigated to ${dateString}, message ID: ${messageId}`);
    },

    canNavigateBack: () => {
      const { messageHistory, coupleSettings } = get();

      const relationshipStart =
        coupleSettings?.status === 'linked' ? coupleSettings.relationshipStart : null;
      const availableDays = getAvailableHistoryDays(messageHistory, relationshipStart);
      return messageHistory.currentIndex < availableDays;
    },

    canNavigateForward: () => {
      const { messageHistory } = get();
      // Can navigate forward if not at today (currentIndex > 0)
      return messageHistory.currentIndex > 0;
    },

    // Custom message actions (Story 3.5), rendered from the message-data copy
    loadCustomMessages: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      try {
        // Signed out this is empty, so the AdminPanel list empties rather than
        // showing whatever the last account left on disk.
        const copy = requestedBy ? await readMessageData(requestedBy) : null;
        const customMessages = (copy?.custom ?? []).map(toCustomMessage);

        if (!stillCurrent()) return;
        set({ customMessages, customMessagesLoaded: true });
        logger.debug(`[AdminPanel] Loaded ${customMessages.length} custom messages from the local copy`);
      } catch (error) {
        console.error('[AdminPanel] Error loading custom messages from the local copy:', error);
        // The `loaded` flag is half the guard: AdminPanel re-fires this effect
        // while it is false, so an early return that skipped it would spin.
        if (!stillCurrent()) return;
        set({ customMessages: [], customMessagesLoaded: true });
      }
    },

    createCustomMessage: async (input: CreateMessageInput, clientKey = crypto.randomUUID()) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      try {
        // Server first; throws when signed out, invalid or offline.
        const message = await createCustomRow(requestedBy, requestedInSession, input, clientKey);

        // The row is the requesting account's either way; only this session's
        // copy and screen are withheld once the account changed under it.
        if (!message || !stillCurrent()) return;

        const newCustomMessage = toCustomMessage(message);
        // A retried submit can resolve to a row already listed (see
        // customMessageService.withCreatedRow); never list it twice.
        set((state) =>
          state.customMessages.some((existing) => existing.id === newCustomMessage.id)
            ? {}
            : { customMessages: [...state.customMessages, newCustomMessage] }
        );

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
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      try {
        if (!requestedBy) {
          throw new Error(
            '[CustomMessageService] updateMessage requires a signed-in user — refusing to write an unowned custom message'
          );
        }
        const fields = customMessageService.validateUpdate(input);

        // Throws when the row is not in this account's copy, so a stale id from
        // another account's list cannot change their message.
        const updated = await writeThroughCopy(requestedBy, requestedInSession, async (copy) => {
          const row = copy.custom.find((message) => message.id === fields.id);
          if (!row) throw new Error(`Custom message ${fields.id} not found for this user`);
          const remote = await customMessageService.updateRemote(row, fields);
          return {
            copy: customMessageService.withUpdatedRow(copy, row.id, remote, requestedBy),
            result: true,
          };
        });

        if (!updated || !stillCurrent()) return;

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
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      try {
        if (!requestedBy) {
          throw new Error(
            '[CustomMessageService] deleteForUser requires a signed-in user — refusing to write an unowned custom message'
          );
        }
        // Absent rows are a no-op, so a delete that lands twice does not fail.
        const deleted = await writeThroughCopy(requestedBy, requestedInSession, async (copy) => {
          const row = copy.custom.find((message) => message.id === id);
          if (!row) return { copy, result: true };
          await customMessageService.deleteRemote(row);
          return { copy: customMessageService.withoutRow(copy, id), result: true };
        });

        if (!deleted || !stillCurrent()) return;

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
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      try {
        const copy = requestedBy ? await readMessageData(requestedBy) : null;
        const exportData = customMessageService.exportMessages(copy?.custom ?? []);

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
      const stillCurrent = () => isSession(requestedBy, requestedInSession);

      try {
        if (!requestedBy) {
          throw new Error(
            '[CustomMessageService] importMessages requires a signed-in user — refusing to write an unowned custom message'
          );
        }
        // Read file content
        const text = await file.text();
        const exportData = JSON.parse(text);

        // Duplicates are judged against THIS account's rows only: comparing
        // against another account's would skip a sentence they happen to share,
        // losing the import and disclosing that their row exists.
        const copy = await readMessageData(requestedBy);
        const { toCreate, skipped } = customMessageService.planImport(
          copy?.custom ?? [],
          exportData
        );

        // Rows are created for the id captured at entry, so an import that
        // settles after a switch still belongs to the account that started it.
        // A fresh key per row, deliberately not one derived from the text: an
        // imported message edited since would own that key, and a re-import
        // would get the edited row back and store nothing.
        for (const input of toCreate) {
          await createCustomRow(requestedBy, requestedInSession, input, crypto.randomUUID());
        }
        const result = { imported: toCreate.length, skipped };

        // The rows are A's and stay A's; B's copy is simply not touched.
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
  };
};
