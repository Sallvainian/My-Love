/**
 * Non-array `mood_types` must not reach the mood lookup
 *
 * Both of these components read `mood_types` with a truthy-plus-length check
 * and fall back to the legacy single `mood_type` otherwise. A mood record can
 * now arrive over a Realtime broadcast, and a truthy check cannot tell an array
 * from a string: `'happy'` is truthy AND has a length, so the fallback was
 * skipped and the value mapped one character at a time.
 *
 * These render the two components with `mood_types` set to a string and to a
 * number and assert the legacy path is taken instead.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseMood } from '../../../api/validation/supabaseSchemas';

vi.mock('../../../hooks/usePartnerMood', () => ({
  usePartnerMood: vi.fn(),
}));

import { usePartnerMood } from '../../../hooks/usePartnerMood';
import { MoodHistoryItem } from '../MoodHistoryItem';
import { PartnerMoodDisplay } from '../PartnerMoodDisplay';

const mockedUsePartnerMood = vi.mocked(usePartnerMood);

const PARTNER_ID = '00000000-0000-4000-8000-000000000002';

function moodRecord(moodTypes: unknown): SupabaseMood {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    user_id: PARTNER_ID,
    mood_type: 'happy',
    // Deliberately lying to the type system: the whole point is what happens
    // when a value that is not an array reaches a component that assumes one.
    mood_types: moodTypes as SupabaseMood['mood_types'],
    note: null,
    created_at: '2026-09-12T10:00:00.000Z',
    updated_at: '2026-09-12T10:00:00.000Z',
  };
}

/** 😊 — what getMoodEmoji returns for 'happy' */
const HAPPY_EMOJI = '😊';
/** 😴 — 'tired' */
const TIRED_EMOJI = '😴';

describe('MoodHistoryItem mood_types guard', () => {
  it.each([
    ['a string', 'happy'],
    ['a number', 7],
    ['an object', { 0: 'happy', length: 1 }],
  ])('falls back to the single mood when mood_types is %s', (_label, value) => {
    expect(() => render(<MoodHistoryItem mood={moodRecord(value)} />)).not.toThrow();

    expect(screen.getByTestId('mood-emoji')).toHaveTextContent(HAPPY_EMOJI);
  });

  it('still renders every mood of a genuine multi-mood entry', () => {
    render(<MoodHistoryItem mood={moodRecord(['happy', 'tired'])} />);

    const emojis = screen.getByTestId('mood-emoji');
    expect(emojis).toHaveTextContent(HAPPY_EMOJI);
    expect(emojis).toHaveTextContent(TIRED_EMOJI);
  });
});

describe('PartnerMoodDisplay mood_types guard', () => {
  function renderWith(moodTypes: unknown) {
    mockedUsePartnerMood.mockReturnValue({
      partnerMood: moodRecord(moodTypes),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePartnerMood>);

    return render(<PartnerMoodDisplay partnerId={PARTNER_ID} />);
  }

  it.each([
    ['a string', 'happy'],
    ['a number', 7],
  ])('falls back to the single mood when mood_types is %s', (_label, value) => {
    expect(() => renderWith(value)).not.toThrow();

    expect(screen.getByTestId('partner-mood-display')).toHaveTextContent(HAPPY_EMOJI);
  });

  it('still renders every mood of a genuine multi-mood entry', () => {
    renderWith(['happy', 'tired']);

    const display = screen.getByTestId('partner-mood-display');
    expect(display).toHaveTextContent(HAPPY_EMOJI);
    expect(display).toHaveTextContent(TIRED_EMOJI);
  });
});
