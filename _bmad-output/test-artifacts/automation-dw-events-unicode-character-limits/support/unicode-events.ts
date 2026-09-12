import { z } from 'zod';
import type { Database } from '../../../../src/types/database.types';

export type EventRow = Database['public']['Tables']['events']['Row'];

// Structural validation only. Zod string.max measures UTF-16 units, so it
// cannot describe PostgreSQL char_length. Actual writes test the SQL limits.
export const EventRowSchema = z.strictObject({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  label: z.string(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().nullable(),
  icon: z.enum(['ring', 'plane', 'calendar']),
  created_at: z.string(),
  updated_at: z.string(),
});

export const EventRowsSchema = z.array(EventRowSchema);
export const PostgrestErrorSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  details: z.string().nullable(),
  hint: z.string().nullable(),
});

// Literal product boundaries are intentionally independent of production
// constants. Do not prefix these strings for uniqueness: that changes length.
// Row UUIDs and the existing worker-pair fixture provide isolation instead.
export const unicodeCases = [
  {
    key: 'emoji',
    atLimit: { label: '💖'.repeat(100), description: '💖'.repeat(500) },
    overLimit: { label: '💖'.repeat(101), description: '💖'.repeat(501) },
  },
  {
    key: 'decomposed',
    atLimit: { label: 'e\u0301'.repeat(50), description: 'e\u0301'.repeat(250) },
    overLimit: {
      label: 'e\u0301'.repeat(50) + '\u0301',
      description: 'e\u0301'.repeat(250) + '\u0301',
    },
  },
] as const;

// Seven code points per group: A, heart, e, combining acute, woman, ZWJ, laptop.
// 14 * 7 + 2 = 100; 71 * 7 + 3 = 500. No normalization or grapheme segmentation.
const mixedGroup = 'A💖e\u0301👩\u200D💻';
export const mixedUnicodeEvent = {
  label: mixedGroup.repeat(14) + 'ab',
  description: mixedGroup.repeat(71) + 'abc',
};

/** Padding belongs at the form boundary; PostgreSQL stores literal text. */
export function padForForm(value: string): string {
  return `\u00A0 ${value} \u00A0`;
}
