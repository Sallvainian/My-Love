/**
 * Mood Emoji Mappings
 *
 * Maps mood types to their corresponding emoji representations.
 * Used for displaying mood entries in a visually appealing way.
 *
 * Story 5.3: Partner Mood Viewing & Transparency
 */

import type { MoodType } from '../types';

/**
 * Mood to emoji mapping
 * Matches the 12 mood types defined in MoodType with visual emojis
 */
const MOOD_EMOJIS: Record<MoodType, string> = {
  // Positive emotions
  loved: '❤️',
  happy: '😊',
  content: '😌',
  excited: '⚡',
  thoughtful: '💭',
  grateful: '✨',

  // Challenging emotions
  sad: '😢',
  anxious: '😰',
  frustrated: '😤',
  angry: '😠',
  lonely: '😔',
  tired: '😴',
};

/**
 * Get emoji for a mood type
 *
 * @param moodType - The mood type
 * @returns Emoji string representing the mood
 *
 * @example
 * ```typescript
 * const emoji = getMoodEmoji('happy'); // Returns '😊'
 * ```
 */
export function getMoodEmoji(moodType: MoodType): string {
  return MOOD_EMOJIS[moodType];
}
