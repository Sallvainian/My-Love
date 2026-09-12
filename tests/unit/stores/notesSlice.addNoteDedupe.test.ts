/**
 * notesSlice.addNote — a note that arrives twice is stored once
 *
 * `useRealtimeMessages` is the only caller that feeds `addNote` from the wire,
 * and a broadcast can legitimately arrive more than once: a reconnect replays,
 * and `sendEphemeralBroadcast`'s queue can retry a topic. Deduplication is what
 * keeps the chat from showing the same note twice, and it is the last step of
 * the receive path — `parseLoveNoteBroadcast` deliberately does NOT dedupe,
 * because a parser that remembered what it had seen would be stateful in a way
 * nothing else on that path is.
 *
 * That contract had no test of its own: before this file, `addNote` was only
 * ever reached through mocked stores, so the real dedupe never executed.
 *
 * The slice is created bare, with no backend fake, because `addNote` is a pure
 * `set()` over the notes array and touches neither Supabase nor Storage.
 */
import { describe, it, expect, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';
import type { LoveNote } from '../../../src/types/models';

const USER_ID = '00000000-0000-4000-8000-0000000000a0';
const PARTNER_ID = '00000000-0000-4000-8000-0000000000b0';
const NOTE_ID = '00000000-0000-4000-8000-0000000000c0';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {},
  getPartnerId: vi.fn(async () => PARTNER_ID),
}));

import { createNotesSlice, type NotesSlice } from '../../../src/stores/slices/notesSlice';

type TestStore = NotesSlice & { userId: string | null };

function createTestStore() {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_ID });
  return store;
}

function note(overrides: Partial<LoveNote> = {}): LoveNote {
  return {
    id: NOTE_ID,
    from_user_id: PARTNER_ID,
    to_user_id: USER_ID,
    content: 'hello',
    created_at: '2026-09-12T10:00:00.000Z',
    ...overrides,
  };
}

describe('notesSlice.addNote deduplication', () => {
  it('stores one note when the same id arrives twice', () => {
    const store = createTestStore();

    store.getState().addNote(note());
    store.getState().addNote(note());

    expect(store.getState().notes).toHaveLength(1);
  });

  it('keeps the first copy rather than replacing it with the second', () => {
    // A replay is not an edit: the second arrival must not overwrite what the
    // chat is already showing.
    const store = createTestStore();

    store.getState().addNote(note({ content: 'the real note' }));
    store.getState().addNote(note({ content: 'a later forgery under the same id' }));

    expect(store.getState().notes).toHaveLength(1);
    expect(store.getState().notes[0].content).toBe('the real note');
  });

  it('still stores two notes that differ only by id', () => {
    // The guard keys on id alone, so identical text from the same sender is two
    // notes — which is what a partner sending "hi" twice actually is.
    const store = createTestStore();

    store.getState().addNote(note());
    store.getState().addNote(note({ id: '00000000-0000-4000-8000-0000000000c1' }));

    expect(store.getState().notes).toHaveLength(2);
  });
});
