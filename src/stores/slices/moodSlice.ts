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
import { MoodEntrySchema } from '../../validation/schemas';
import { createValidationError, isZodError } from '../../validation/errorMessages';
import { ZodError } from 'zod';

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
    try {
      const today = new Date().toISOString().split('T')[0];
      const newMood: MoodEntry = {
        date: today,
        mood,
        note,
      };

      // Story 5.5: Validate mood entry before adding to state
      const validated = MoodEntrySchema.parse(newMood);

      set((state) => ({
        moods: [...state.moods.filter((m) => m.date !== today), validated],
      }));
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        throw createValidationError(error as ZodError);
      }
      throw error;
    }
  },

  getMoodForDate: (date) => {
    return get().moods.find((m) => m.date === date);
  },
});
