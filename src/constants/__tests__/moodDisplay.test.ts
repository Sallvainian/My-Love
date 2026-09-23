import { describe, expect, it } from 'vitest';
import { MOOD_TYPES } from '../../types/moods';
import { CHALLENGING_MOODS, MOOD_DISPLAY, MOOD_TONE, POSITIVE_MOODS } from '../moodDisplay';

describe('MOOD_DISPLAY', () => {
  it.each(MOOD_TYPES)('gives %s an icon and a label', (mood) => {
    const display = MOOD_DISPLAY[mood];

    expect(display).toBeDefined();
    // lucide icons are forwardRef components (objects), not plain functions.
    expect(display.icon).toBeTruthy();
    expect(display.label).toMatch(/^[A-Z][a-z]+$/);
  });

  it('has no entry beyond MOOD_TYPES', () => {
    expect(Object.keys(MOOD_DISPLAY).sort()).toEqual([...MOOD_TYPES].sort());
  });

  it('keeps every label distinct', () => {
    const labels = MOOD_TYPES.map((mood) => MOOD_DISPLAY[mood].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('POSITIVE_MOODS / CHALLENGING_MOODS', () => {
  it('lists the positive moods by name', () => {
    expect(POSITIVE_MOODS).toEqual([
      'loved',
      'happy',
      'content',
      'excited',
      'thoughtful',
      'grateful',
    ]);
  });

  it('lists the challenging moods by name', () => {
    expect(CHALLENGING_MOODS).toEqual(['sad', 'anxious', 'frustrated', 'angry', 'lonely', 'tired']);
  });

  it('cover every MOOD_TYPES entry between them', () => {
    expect([...POSITIVE_MOODS, ...CHALLENGING_MOODS].sort()).toEqual([...MOOD_TYPES].sort());
  });

  it('share no mood', () => {
    const overlap = POSITIVE_MOODS.filter((mood) => CHALLENGING_MOODS.includes(mood));
    expect(overlap).toEqual([]);
  });
});

describe('MOOD_TONE', () => {
  it('colours by owner with kit tokens only', () => {
    expect(MOOD_TONE).toEqual({
      you: 'bg-tint text-accent',
      partner: 'bg-ptint text-partner',
    });
  });
});
