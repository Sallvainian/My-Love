/**
 * Wire validation for the two couple broadcast topics
 *
 * RLS on `realtime.messages` decides who may join `love-notes:<uuid>` and
 * `mood-updates:<uuid>` and who may send there. It says nothing about what a
 * permitted sender puts in the body, and it is evaluated at join and cached
 * until the JWT refreshes — so the receiver-side contract is this module, and
 * this file is the row-by-row proof of it.
 *
 * Every case below is a row of the story's I/O matrix.
 */
import { describe, expect, it } from 'vitest';
import { parseLoveNoteBroadcast, parseMoodBroadcast } from '@/api/validation/broadcastSchemas';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const OUTSIDER = '33333333-3333-4333-8333-333333333333';
const NOTE_ID = '44444444-4444-4444-8444-444444444444';
const MOOD_ID = '55555555-5555-4555-8555-555555555555';

const identity = { currentUserId: ME, partnerId: PARTNER };

function note(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    from_user_id: PARTNER,
    to_user_id: ME,
    content: 'thinking of you',
    created_at: '2026-09-12T10:00:00.000Z',
    ...overrides,
  };
}

function mood(overrides: Record<string, unknown> = {}) {
  return {
    id: MOOD_ID,
    user_id: PARTNER,
    mood_type: 'happy',
    mood_types: ['happy'],
    note: null,
    created_at: '2026-09-12T10:00:00.000Z',
    ...overrides,
  };
}

describe('parseLoveNoteBroadcast', () => {
  it('accepts content at both ends of the DB range', () => {
    expect(parseLoveNoteBroadcast(note({ content: 'x' }), identity)).toMatchObject({
      id: NOTE_ID,
      content: 'x',
    });
    expect(parseLoveNoteBroadcast(note({ content: 'x'.repeat(1000) }), identity)).toMatchObject({
      id: NOTE_ID,
      content: 'x'.repeat(1000),
    });
  });

  it('accepts a well-formed note from the partner', () => {
    expect(parseLoveNoteBroadcast(note(), identity)).toMatchObject({
      id: NOTE_ID,
      from_user_id: PARTNER,
      to_user_id: ME,
      content: 'thinking of you',
    });
  });

  it('keeps the server-side image_url and idempotency_key', () => {
    const parsed = parseLoveNoteBroadcast(
      note({ image_url: 'love-notes/abc.jpg', idempotency_key: 'key-1' }),
      identity
    );

    // image_url is a Storage PATH the receiver signs itself, not a URL it
    // fetches — unlike imagePreviewUrl below.
    expect(parsed).toMatchObject({ image_url: 'love-notes/abc.jpg', idempotency_key: 'key-1' });
  });

  it('keeps written_at, and still accepts a note from a client that sends none', () => {
    const written = '2026-09-12T08:00:00.000000+00:00';
    expect(parseLoveNoteBroadcast(note({ written_at: written }), identity)).toMatchObject({
      written_at: written,
    });
    expect(parseLoveNoteBroadcast(note({ written_at: null }), identity)).toMatchObject({
      written_at: null,
    });
    const older = parseLoveNoteBroadcast(note(), identity);
    expect(older).not.toBeNull();
    expect(older).not.toHaveProperty('written_at');
  });

  it('drops a note whose written_at is not a timestamp', () => {
    expect(parseLoveNoteBroadcast(note({ written_at: 'yesterday' }), identity)).toBeNull();
  });

  it('strips a forged imagePreviewUrl', () => {
    const parsed = parseLoveNoteBroadcast(
      note({ imagePreviewUrl: 'https://attacker.example/x.png' }),
      identity
    );

    // LoveNoteMessage.tsx:126-128 prefers imagePreviewUrl over the signed
    // Storage URL and lands it in an <img src>, so surviving the wire means the
    // victim's browser fetches the attacker's host.
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('imagePreviewUrl');
    expect(Object.keys(parsed!)).not.toContain('imagePreviewUrl');
  });

  it('strips every other client-only optimistic-update field', () => {
    const parsed = parseLoveNoteBroadcast(
      note({
        sending: true,
        error: true,
        tempId: 'temp-1',
        imageUploading: true,
        imageBlob: 'not really a blob',
      }),
      identity
    );

    expect(Object.keys(parsed!).sort()).toEqual(
      ['content', 'created_at', 'from_user_id', 'id', 'to_user_id'].sort()
    );
  });

  it('drops a note whose sender is not the partner', () => {
    expect(parseLoveNoteBroadcast(note({ from_user_id: OUTSIDER }), identity)).toBeNull();
  });

  it('drops a note addressed to somebody else', () => {
    expect(parseLoveNoteBroadcast(note({ to_user_id: OUTSIDER }), identity)).toBeNull();
  });

  it('drops a note when no partner is known yet', () => {
    // The join is in flight, or the account is unlinked. Nothing to check
    // against means nothing can be trusted.
    expect(parseLoveNoteBroadcast(note(), { currentUserId: ME, partnerId: null })).toBeNull();
  });

  it('drops a note when the session is gone', () => {
    expect(parseLoveNoteBroadcast(note(), { currentUserId: null, partnerId: PARTNER })).toBeNull();
  });

  it.each([
    ['missing id', note({ id: undefined })],
    ['non-string content', note({ content: 42 })],
    ['missing created_at', note({ created_at: undefined })],
    ['non-UUID id', note({ id: 'msg-1' })],
    ['unparseable created_at', note({ created_at: 'yesterday' })],
    // love_notes_content_check is `char_length(content) between 1 and 1000`, so
    // neither of these can be a real row.
    ['empty content', note({ content: '' })],
    ['content past the 1000-char DB limit', note({ content: 'x'.repeat(1001) })],
  ])('drops a malformed note (%s)', (_label, raw) => {
    expect(parseLoveNoteBroadcast(raw, identity)).toBeNull();
  });

  it.each([['a string', 'hello'], ['a number', 7], ['null', null], ['undefined', undefined], ['an array', []]])(
    'drops a non-object payload (%s)',
    (_label, raw) => {
      expect(parseLoveNoteBroadcast(raw, identity)).toBeNull();
    }
  );

  it('is pure: the same note parses the same way twice', () => {
    // The store's own dedupe is what makes a duplicate id harmless; the parser
    // must not be stateful about it.
    expect(parseLoveNoteBroadcast(note(), identity)).toEqual(
      parseLoveNoteBroadcast(note(), identity)
    );
  });
});

describe('parseMoodBroadcast', () => {
  it('accepts a well-formed mood from the partner', () => {
    expect(parseMoodBroadcast(mood(), { partnerId: PARTNER })).toMatchObject({
      id: MOOD_ID,
      user_id: PARTNER,
      mood_type: 'happy',
    });
  });

  it('accepts a note at the DB bound and drops one past it', () => {
    // `moods_note_check` is `char_length(note) <= 500`, so a longer one cannot
    // be a real row -- and PartnerMoodDisplay renders the note unbounded.
    expect(parseMoodBroadcast(mood({ note: 'x'.repeat(500) }), { partnerId: PARTNER })).not.toBeNull();
    expect(parseMoodBroadcast(mood({ note: 'x'.repeat(501) }), { partnerId: PARTNER })).toBeNull();
  });

  it('accepts a valid multi-mood', () => {
    const parsed = parseMoodBroadcast(mood({ mood_types: ['happy', 'tired'] }), {
      partnerId: PARTNER,
    });

    expect(parsed?.mood_types).toEqual(['happy', 'tired']);
  });

  it('fills updated_at from created_at, because the wire never carries it', () => {
    expect(parseMoodBroadcast(mood(), { partnerId: PARTNER })?.updated_at).toBe(
      '2026-09-12T10:00:00.000Z'
    );
  });

  it('drops a mood whose sender is not the partner', () => {
    expect(parseMoodBroadcast(mood({ user_id: OUTSIDER }), { partnerId: PARTNER })).toBeNull();
  });

  it('drops a mood when no partner is known', () => {
    expect(parseMoodBroadcast(mood(), { partnerId: null })).toBeNull();
  });

  it.each([
    ['mood_types a string', mood({ mood_types: 'happy' })],
    ['mood_types a number', mood({ mood_types: 7 })],
    ['unknown mood_type', mood({ mood_type: 'hangry' })],
    ['missing mood_type', mood({ mood_type: undefined })],
    ['missing created_at', mood({ created_at: undefined })],
    // A null created_at is not tolerated either: PartnerMoodDisplay falls back
    // to `new Date()` and renders it as "Just now", so a forged null is a fake
    // fresh mood rather than a missing timestamp.
    ['null created_at', mood({ created_at: null })],
    ['non-UUID id', mood({ id: 'mood-1' })],
  ])('drops a malformed mood (%s)', (_label, raw) => {
    // A non-array mood_types is the render crash: PartnerMoodView indexes
    // allMoods[0] and maps over it unconditionally.
    expect(parseMoodBroadcast(raw, { partnerId: PARTNER })).toBeNull();
  });

  it.each([['a string', 'hello'], ['a number', 7], ['null', null], ['undefined', undefined]])(
    'drops a non-object mood payload (%s)',
    (_label, raw) => {
      expect(parseMoodBroadcast(raw, { partnerId: PARTNER })).toBeNull();
    }
  );

  it('tolerates a legacy record with no mood_types', () => {
    expect(parseMoodBroadcast(mood({ mood_types: null }), { partnerId: PARTNER })).toMatchObject({
      mood_type: 'happy',
      mood_types: null,
    });
  });
});
