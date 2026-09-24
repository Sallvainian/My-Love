/**
 * Deleting a love note that failed to send (DW-213)
 *
 * A failed note shows the same trash button a sent note does and opens the
 * same confirmation. Confirming must take the note off the screen AND out of
 * the per-account note queue, or a reload brings it back; it must never go
 * through removeNote, which has no server row to point at. Cancelling keeps
 * both. A sent note still goes through removeNote.
 *
 * The screen, list, bubble and dialog are real, and so are the notes slice and
 * the note queue (on fake-indexeddb). Only Supabase, the hook's fetching and
 * realtime, and the composer are replaced.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create, useStore, type StateCreator, type StoreApi } from 'zustand';
import { enqueueNote, listQueuedNotes, removeQueuedNote } from '../../../services/noteQueue';
import { createNotesSlice, type NotesSlice } from '../../../stores/slices/notesSlice';
import type { LoveNote } from '../../../types/models';
import { LoveNotes } from '../LoveNotes';

const USER_ID = '00000000-0000-4000-8000-0000000000a0';
const PARTNER_ID = '00000000-0000-4000-8000-0000000000b0';
const TEMP_ID = 'temp-1-failed';

type TestState = NotesSlice & { userId: string | null; authSessionVersion: number };

const holder = vi.hoisted(() => ({
  store: null as unknown as StoreApi<TestState>,
  removalUpserts: [] as Array<{ user_id: string; note_id: string }>,
}));

vi.mock('../../../api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'love_note_removals') throw new Error(`unmodelled table ${table}`);
      return {
        upsert: async (values: { user_id: string; note_id: string }) => {
          holder.removalUpserts.push(values);
          return { data: null, error: null };
        },
      };
    },
  },
  getPartnerId: vi.fn(async () => PARTNER_ID),
  lookupPartnerId: vi.fn(async () => ({ status: 'linked', partnerId: PARTNER_ID })),
  getOwnDisplayName: vi.fn(async () => null),
  getPartnerDisplayName: vi.fn(async () => null),
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: vi.fn(async () => null) },
}));
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: Object.assign(
    <T,>(selector: (state: TestState) => T) => useStore(holder.store, selector),
    {
      getState: () => holder.store.getState(),
      subscribe: (listener: (state: TestState) => void) => holder.store.subscribe(listener),
    }
  ),
}));
// The hook's fetching and realtime are not under test; its notes and its
// removeFailedMessage are the real slice's.
vi.mock('../../../hooks/useLoveNotes', () => ({
  useLoveNotes: () => ({
    notes: useStore(holder.store, (state) => state.notes),
    isLoading: false,
    error: null,
    hasMore: false,
    fetchOlderNotes: vi.fn(),
    clearError: vi.fn(),
    retryFailedMessage: vi.fn(),
    removeFailedMessage: (tempId: string) => holder.store.getState().removeFailedMessage(tempId),
    realtimeStatus: 'connected',
  }),
}));
vi.mock('../MessageInput', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}));
vi.mock('../FullScreenImageViewer', () => ({
  FullScreenImageViewer: () => null,
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
          <div {...rest}>{children}</div>
        ),
    }
  ),
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const sent: LoveNote = {
  id: '11111111-1111-4111-8111-111111111111',
  from_user_id: USER_ID,
  to_user_id: PARTNER_ID,
  content: 'this one arrived',
  created_at: '2026-09-24T10:00:00.000Z',
};

const failed: LoveNote = {
  id: TEMP_ID,
  tempId: TEMP_ID,
  from_user_id: USER_ID,
  to_user_id: PARTNER_ID,
  content: 'this one was refused',
  created_at: '2026-09-24T10:01:00.000Z',
  queued: true,
  sending: false,
  error: true,
};

function bubbleWith(text: string): HTMLElement {
  const bubble = screen
    .getAllByTestId('love-note-message')
    .find((element) => element.textContent?.includes(text));
  if (!bubble) throw new Error(`no bubble shows "${text}"`);
  return bubble;
}

/**
 * Render the screen and let MessageList's first frame pass: its initial
 * scroll-to-bottom runs in a requestAnimationFrame with the row count it saw
 * at mount, so a removal inside that frame scrolls to a row that is gone.
 */
async function renderScreen() {
  render(<LoveNotes />);
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function openRemoval(text: string) {
  fireEvent.click(within(bubbleWith(text)).getByTestId('note-remove-button'));
  return screen.findByTestId('note-remove-confirmation');
}

describe('deleting a note that failed to send', () => {
  beforeEach(async () => {
    holder.removalUpserts = [];
    holder.store = create<TestState>()(createNotesSlice as unknown as StateCreator<TestState>);
    holder.store.setState({ userId: USER_ID, authSessionVersion: 1, notes: [sent, failed] });
    await enqueueNote({
      id: TEMP_ID,
      userId: USER_ID,
      toUserId: PARTNER_ID,
      content: failed.content,
      createdAt: failed.created_at,
      failed: true,
    });
  });

  afterEach(async () => {
    cleanup();
    await removeQueuedNote(TEMP_ID);
  });

  it('confirming removes the note from the screen and its row from the queue', async () => {
    await renderScreen();

    const dialog = await openRemoval('this one was refused');
    expect(within(dialog).getByText(/never sent and will be deleted from this device/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId('note-remove-confirm'));

    await waitFor(() => expect(screen.queryByTestId('note-remove-confirmation')).toBeNull());
    expect(holder.store.getState().notes.map((note) => note.id)).toEqual([sent.id]);
    expect(screen.queryByText('this one was refused')).toBeNull();
    await waitFor(async () => expect(await listQueuedNotes(USER_ID)).toEqual([]));
    // Never through removeNote: there is no server row to point at.
    expect(holder.removalUpserts).toEqual([]);
  });

  it('cancelling keeps the note and its queue row', async () => {
    await renderScreen();

    const dialog = await openRemoval('this one was refused');
    fireEvent.click(within(dialog).getByText('Cancel'));

    await waitFor(() => expect(screen.queryByTestId('note-remove-confirmation')).toBeNull());
    expect(holder.store.getState().notes.map((note) => note.id)).toEqual([sent.id, TEMP_ID]);
    expect(bubbleWith('this one was refused')).toBeInTheDocument();
    expect((await listQueuedNotes(USER_ID)).map((row) => row.id)).toEqual([TEMP_ID]);
    expect(holder.removalUpserts).toEqual([]);
  });

  it('a sent note still goes through removeNote, leaving the failed one alone', async () => {
    await renderScreen();

    const dialog = await openRemoval('this one arrived');
    expect(within(dialog).getByText(/your partner keeps their copy/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId('note-remove-confirm'));

    await waitFor(() => expect(screen.queryByTestId('note-remove-confirmation')).toBeNull());
    expect(holder.removalUpserts).toEqual([{ user_id: USER_ID, note_id: sent.id }]);
    expect(holder.store.getState().notes.map((note) => note.id)).toEqual([TEMP_ID]);
    expect((await listQueuedNotes(USER_ID)).map((row) => row.id)).toEqual([TEMP_ID]);
  });
});
