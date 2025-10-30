import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Settings,
  MessageHistory,
  Message,
  MoodEntry,
  ThemeName,
  Anniversary,
} from '../types';
import { storageService, localStorageHelper } from '../services/storage';
import defaultMessages from '../data/defaultMessages';
import { getTodayMessage, isNewDay } from '../utils/messageRotation';

interface AppState {
  // Settings
  settings: Settings | null;
  isOnboarded: boolean;

  // Message state
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;

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

  // Mood actions
  addMoodEntry: (mood: MoodEntry['mood'], note?: string) => void;
  getMoodForDate: (date: string) => MoodEntry | undefined;

  // Anniversary actions
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void;
  removeAnniversary: (id: number) => void;

  // Theme actions
  setTheme: (theme: ThemeName) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: null,
      isOnboarded: false,
      messages: [],
      messageHistory: {
        lastShownDate: '',
        lastMessageId: 0,
        favoriteIds: [],
        viewedIds: [],
      },
      currentMessage: null,
      moods: [],
      isLoading: false,
      error: null,

      // Initialize app
      initializeApp: async () => {
        set({ isLoading: true, error: null });

        try {
          // Initialize IndexedDB
          await storageService.init();

          // Load messages from IndexedDB
          const storedMessages = await storageService.getAllMessages();

          // If no messages exist, populate with default messages
          if (storedMessages.length === 0) {
            const messagesToAdd = defaultMessages.map((msg, index) => ({
              ...msg,
              id: index + 1,
              createdAt: new Date(),
              isCustom: false,
            }));

            await storageService.addMessages(messagesToAdd);
            set({ messages: messagesToAdd });
          } else {
            set({ messages: storedMessages });
          }

          // Update current message if needed
          get().updateCurrentMessage();

          set({ isLoading: false });
        } catch (error) {
          console.error('Error initializing app:', error);
          set({ error: 'Failed to initialize app', isLoading: false });
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
        const { messages, messageHistory, settings } = get();

        if (!settings || messages.length === 0) return;

        // Check if it's a new day
        if (isNewDay(messageHistory.lastShownDate)) {
          const startDate = new Date(settings.relationship.startDate);
          const todayMessage = getTodayMessage(
            messages,
            startDate,
            messageHistory.favoriteIds
          );

          if (todayMessage) {
            set({
              currentMessage: todayMessage,
              messageHistory: {
                ...messageHistory,
                lastShownDate: new Date().toISOString(),
                lastMessageId: todayMessage.id,
                viewedIds: [...messageHistory.viewedIds, todayMessage.id],
              },
            });
          }
        } else {
          // Same day, show the same message
          const lastMessage = messages.find((m) => m.id === messageHistory.lastMessageId);
          if (lastMessage) {
            set({ currentMessage: lastMessage });
          }
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
      partialize: (state) => ({
        settings: state.settings,
        isOnboarded: state.isOnboarded,
        messageHistory: state.messageHistory,
        moods: state.moods,
      }),
    }
  )
);
