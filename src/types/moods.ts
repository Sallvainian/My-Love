/** Canonical vocabulary shared by UI, validation and the service worker. */
export const MOOD_TYPES = [
  'loved',
  'happy',
  'content',
  'excited',
  'thoughtful',
  'grateful',
  'sad',
  'anxious',
  'frustrated',
  'angry',
  'lonely',
  'tired',
] as const;

export type MoodType = (typeof MOOD_TYPES)[number];
const recognized = new Set<string>(MOOD_TYPES);

export function isMoodType(value: unknown): value is MoodType {
  return typeof value === 'string' && recognized.has(value);
}

/** Recover recognized values without coercion, reordering or deduplication. */
export function normalizeMoodValues(mood: unknown, moods: unknown): {
  mood: MoodType;
  moods: MoodType[];
} | null {
  const valid = Array.isArray(moods) ? moods.filter(isMoodType) : [];
  if (valid.length === 0 && isMoodType(mood)) valid.push(mood);
  if (valid.length === 0) return null;
  return { mood: isMoodType(mood) ? mood : valid[0], moods: valid };
}

/** Display-only copy. Raw saved rows and pending queues remain untouched. */
export function normalizeMoodEntry<T extends { mood?: unknown; moods?: unknown }>(
  entry: T
): (T & { mood: MoodType; moods: MoodType[] }) | null {
  const normalized = normalizeMoodValues(entry.mood, entry.moods);
  return normalized ? { ...entry, ...normalized } : null;
}
