/**
 * MoodCard must survive a non-array `moods`
 *
 * `MoodCard` read `moodEntry.moods` with a truthy-plus-length check and then
 * dereferenced its mood-config `[allMoods[0]].icon` unconditionally. A string
 * `moods` passes the truthy check, yields a single character, and the config
 * lookup returns undefined — so the whole 711-line Partner view threw on a
 * field that arrives, indirectly, from a partner's broadcast.
 *
 * The component is exported for this file alone; `index.ts` still exports only
 * `PartnerMoodView`, so nothing else can start depending on it.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MoodEntry } from '../../../types';
import { MoodCard } from '../PartnerMoodView';

function entry(moods: unknown): MoodEntry {
  return {
    userId: '00000000-0000-4000-8000-000000000002',
    mood: 'happy',
    // Deliberately not an array in most cases below — that is the defect.
    moods: moods as MoodEntry['moods'],
    note: 'a note',
    date: '2026-09-12',
    timestamp: new Date('2026-09-12T10:00:00.000Z'),
    synced: true,
  };
}

const formatDate = (date: string) => date;

describe('MoodCard moods guard', () => {
  it.each([
    ['a string', 'happy'],
    ['a number', 7],
    ['an object', { 0: 'happy', length: 1 }],
  ])('falls back to the single mood when moods is %s', (_label, value) => {
    expect(() =>
      render(<MoodCard moodEntry={entry(value)} formatDate={formatDate} />)
    ).not.toThrow();

    expect(screen.getByTestId('partner-mood-card')).toHaveTextContent('Happy');
  });

  it('still renders every label of a genuine multi-mood entry', () => {
    render(<MoodCard moodEntry={entry(['happy', 'tired'])} formatDate={formatDate} />);

    expect(screen.getByTestId('partner-mood-card')).toHaveTextContent('Happy, Tired');
  });
  it('recovers mixed values without reordering or deduplicating them', () => {
    render(<MoodCard moodEntry={{ ...entry(['sad', null, 'tired', 'sad']), mood: 'unknown' } as unknown as MoodEntry} formatDate={formatDate} />);
    expect(screen.getByTestId('partner-mood-card')).toHaveTextContent('Sad, Tired, Sad');
  });

  it('omits an entirely invalid mood', () => {
    render(<MoodCard moodEntry={{ ...entry([null]), mood: 'unknown' } as unknown as MoodEntry} formatDate={formatDate} />);
    expect(screen.queryByTestId('partner-mood-card')).toBeNull();
  });

});
