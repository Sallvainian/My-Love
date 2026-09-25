import {
  Angry,
  Battery,
  CircleAlert,
  FaceSlightlySmiling,
  Flame,
  Frown,
  Heart,
  Meh,
  MessageCircle,
  Sparkles,
  UserMinus,
  Zap,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { MOOD_TYPES } from '../../types/moods';
import { CHALLENGING_MOODS, MOOD_DISPLAY, MOOD_TONE, POSITIVE_MOODS } from '../moodDisplay';

describe('MOOD_DISPLAY', () => {
  it.each([
    ['loved', Heart, 'Loved'],
    ['happy', FaceSlightlySmiling, 'Happy'],
    ['content', Meh, 'Content'],
    ['excited', Zap, 'Excited'],
    ['thoughtful', MessageCircle, 'Thoughtful'],
    ['grateful', Sparkles, 'Grateful'],
    ['sad', Frown, 'Sad'],
    ['anxious', CircleAlert, 'Anxious'],
    ['frustrated', Angry, 'Frustrated'],
    ['angry', Flame, 'Angry'],
    ['lonely', UserMinus, 'Lonely'],
    ['tired', Battery, 'Tired'],
  ] as const)('gives %s an icon and a label', (mood, icon, label) => {
    expect(MOOD_DISPLAY[mood]).toEqual({ icon, label });
  });

  it('has no entry beyond MOOD_TYPES', () => {
    expect(Object.keys(MOOD_DISPLAY).sort()).toEqual([...MOOD_TYPES].sort());
  });

  it('keeps every label distinct', () => {
    const labels = MOOD_TYPES.map((mood) => MOOD_DISPLAY[mood].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every mood its own icon', () => {
    // Colour no longer tells moods apart, so icon-only surfaces (calendar
    // cells, the timeline strip) need a distinct icon per mood.
    const icons = MOOD_TYPES.map((mood) => MOOD_DISPLAY[mood].icon);
    expect(new Set(icons).size).toBe(icons.length);
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
