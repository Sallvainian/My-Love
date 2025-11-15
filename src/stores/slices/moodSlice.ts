/**
 * Mood Slice
 *
 * Manages all mood tracking state and actions including:
 * - Mood entries (daily mood tracking)
 * - Mood entry retrieval by date
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - moods: Persisted to LocalStorage for offline tracking
 * - Will sync to backend in Epic 6
 */

import type { StateCreator } from 'zustand';
import type { MoodEntry } from '../../types';

export interface MoodSlice {
  // State
  moods: MoodEntry[];

  // Actions
  addMoodEntry: (mood: MoodEntry['mood'], note?: string) => void;
  getMoodForDate: (date: string) => MoodEntry | undefined;
}

export const createMoodSlice: StateCreator<
  MoodSlice,
  [],
  [],
  MoodSlice
> = (set, get) => ({
  // Initial state
  moods: [],

  // Actions
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
});
