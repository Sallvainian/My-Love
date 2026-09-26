import 'fake-indexeddb/auto';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { domAnimation, LazyMotion } from 'motion/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { deleteDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPanel } from '../../../src/components/AdminPanel/AdminPanel';
import { DeleteConfirmDialog } from '../../../src/components/AdminPanel/DeleteConfirmDialog';
import { AccountDataError, requireOnline } from '../../../src/services/accountDataError';
import {
  customMessageService,
  readMessageData,
  writeMessageData,
} from '../../../src/services/customMessageService';
import { DB_NAME } from '../../../src/services/dbSchema';
import { storageService } from '../../../src/services/storage';
import { CustomMessagesImportError } from '../../../src/stores/slices/messagesSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { CustomMessage, Message } from '../../../src/types';

// The server half of custom messages and favorites; these tests drive the
// message-data local copy, which is written only after the server accepted a write.
vi.mock('../../../src/services/customMessagesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/customMessagesApi')>()),
  customMessagesApi: (await import('../helpers/fakeAccountDataApis')).fakeCustomMessagesApi,
}));
vi.mock('../../../src/services/messageFavoritesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/messageFavoritesApi')>()),
  messageFavoritesApi: (await import('../helpers/fakeAccountDataApis')).fakeMessageFavoritesApi,
}));

// Animation timing/WAAPI is outside this boundary; all data/store/UI handlers
// below remain real. happy-dom's canceled WAAPI promises otherwise reject.
type MotionProps = HTMLAttributes<HTMLElement> & {
  initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown; whileHover?: unknown;
};
vi.mock('motion/react', () => ({
  domAnimation: {},
  LazyMotion: ({ children }: { children: ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  m: {
    div: ({ initial: _i, animate: _a, exit: _e, transition: _t, whileHover: _h, ...props }: MotionProps) => <div {...props} />,
    tr: ({ initial: _i, animate: _a, exit: _e, transition: _t, whileHover: _h, ...props }: MotionProps) => <tr {...props} />,
  },
}));

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
let aId: number;
let bId: number;
let aServerId: string;

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function panel() {
  return render(<LazyMotion features={domAnimation}><AdminPanel /></LazyMotion>);
}

async function switchAccount(userId: string) {
  await act(async () => {
    useAppStore.getState().setAuthUser(userId);
    await useAppStore.getState().loadMessages();
    await useAppStore.getState().loadCustomMessages();
  });
}

/** Row `id` in `userId`'s saved copy (A's unless named), or undefined. */
async function diskRow(id: number, userId = A) {
  return (await readMessageData(userId))?.custom.find((message) => message.id === id);
}

function savedRow(id: number, userId: string, serverId: string, text: string): Message {
  return {
    id, text, category: 'custom', isCustom: true, userId, serverId,
    active: true, isFavorite: false, createdAt: new Date(), updatedAt: new Date(), tags: [],
  };
}

function row(text: string) {
  return screen.getByText(text).closest('tr')!;
}

beforeEach(async () => {
  localStorage.clear();
  useAppStore.setState(useAppStore.getInitialState(), true);
  await storageService.init();
  await storageService.addMessage({ text: 'Shared daily', category: 'reason', isCustom: false, createdAt: new Date() });
  aId = 1000;
  bId = 2000;
  aServerId = 'srv-account-a';
  await writeMessageData(A, {
    custom: [savedRow(aId, A, aServerId, 'Account A message')],
    bundledFavoriteIds: [],
    nextCustomId: aId + 1,
  });
  await writeMessageData(B, {
    custom: [savedRow(bId, B, 'srv-account-b', 'Account B message')],
    bundledFavoriteIds: [],
    nextCustomId: bId + 1,
  });
  await switchAccount(A);
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  const holder = storageService as unknown as { db: { close(): void } | null };
  holder.db?.close();
  holder.db = null;
  await deleteDB(DB_NAME);
});

describe('AdminPanel with the real local copy and store', () => {
  it.each([
    ['edit', 'admin-edit-form'],
    ['delete', 'admin-delete-dialog'],
  ] as const)('isolates A/B/A lists and removes the outgoing %s preview', async (dialog, previewTestId) => {
    const user = userEvent.setup();
    panel();
    expect(screen.getAllByText('Account A message')).toHaveLength(1);
    await user.click(within(row('Account A message')).getByTestId(`message-row-${dialog}-button`));
    expect(screen.getByTestId(previewTestId)).toBeInTheDocument();
    await switchAccount(B);
    expect(screen.queryByText('Account A message')).toBeNull();
    expect(screen.queryByTestId('admin-edit-form')).toBeNull();
    expect(screen.queryByTestId('admin-delete-dialog')).toBeNull();
    expect(screen.getByText('Account B message')).toBeInTheDocument();
    // A's copy left the device with A's session (CAP-7); B's stays.
    await waitFor(async () => expect(await readMessageData(A)).toBeNull());
    expect(await diskRow(bId, B)).toBeDefined();
    await switchAccount(A);
    expect(screen.queryByText('Account B message')).toBeNull();
    await waitFor(async () => expect(await readMessageData(B)).toBeNull());
    // A's own rows come back from the server on A's refresh, listed once.
    const { fakeCustomMessagesApi } = await import('../helpers/fakeAccountDataApis');
    fakeCustomMessagesApi.fetchCustomMessages.mockResolvedValueOnce([
      {
        serverId: aServerId, text: 'Account A message', category: 'custom', active: true,
        isFavorite: false, tags: [], createdAt: new Date(), updatedAt: new Date(),
      },
    ]);
    await act(async () => {
      await useAppStore.getState().loadMessageDataFromServer();
      await useAppStore.getState().loadCustomMessages();
    });
    expect(screen.getAllByText('Account A message')).toHaveLength(1);
  });

  it('keeps deletion pending, prevents dismissal and duplicate submits, then closes after persisted success', async () => {
    const user = userEvent.setup();
    panel();
    act(() => { useAppStore.setState({ currentMessage: useAppStore.getState().messages.find((message) => message.id === aId)! }); });
    const gate = deferred();
    const realDelete = customMessageService.deleteRemote.bind(customMessageService);
    const remove = vi.spyOn(customMessageService, 'deleteRemote').mockImplementation(async (...args) => {
      await gate.promise;
      return realDelete(...args);
    });
    await user.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await user.click(screen.getByTestId('admin-delete-dialog-cancel'));
    await user.click(screen.getByTestId('admin-delete-dialog-backdrop'));
    // The server call follows a read of the saved copy, so it lands a moment later.
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('admin-delete-dialog-cancel')).toBeDisabled();
    expect(await diskRow(aId)).toBeDefined();
    await act(async () => { gate.resolve(); });
    await waitFor(() => expect(screen.queryByTestId('admin-delete-dialog')).toBeNull());
    expect(await diskRow(aId)).toBeUndefined();
    expect(useAppStore.getState().customMessages.some((message) => message.id === aId)).toBe(false);
    expect(screen.queryByText('Account A message')).toBeNull();
    expect(useAppStore.getState().currentMessage?.text).toBe('Shared daily');
  });

  it('reports failure accessibly, permits cancel, and retries a real delete', async () => {
    const user = userEvent.setup();
    panel();
    const remove = vi.spyOn(customMessageService, 'deleteRemote').mockRejectedValueOnce(new Error('disk unavailable'));
    await user.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await screen.findByRole('alert');
    expect(screen.getByTestId('admin-delete-dialog-cancel')).toBeEnabled();
    expect(await diskRow(aId)).toBeDefined();
    expect(useAppStore.getState().customMessages.some((message) => message.id === aId)).toBe(true);
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await waitFor(() => expect(screen.queryByTestId('admin-delete-dialog')).toBeNull());
    expect(remove).toHaveBeenCalledTimes(2);
    expect(await diskRow(aId)).toBeUndefined();
  });

  it('allows cancellation after a failed delete without removing the row', async () => {
    const user = userEvent.setup();
    panel();
    vi.spyOn(customMessageService, 'deleteRemote').mockRejectedValueOnce(new Error('disk unavailable'));
    await user.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await screen.findByRole('alert');
    await user.click(screen.getByTestId('admin-delete-dialog-cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await diskRow(aId)).toMatchObject({
      id: 1000, text: 'Account A message', serverId: 'srv-account-a', userId: A, category: 'custom',
    });
  });

  it('does not let an old completion close the new account’s dialog', async () => {
    const user = userEvent.setup();
    panel();
    const gate = deferred();
    const realDelete = customMessageService.deleteRemote.bind(customMessageService);
    vi.spyOn(customMessageService, 'deleteRemote').mockImplementationOnce(async (...args) => {
      await gate.promise;
      return realDelete(...args);
    });
    await user.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await switchAccount(B);
    await user.click(within(row('Account B message')).getByTestId('message-row-delete-button'));
    await act(async () => { gate.resolve(); });
    await waitFor(async () => expect(await readMessageData(A)).toBeNull());
    expect(within(screen.getByRole('dialog')).getByText('Account B message')).toBeInTheDocument();
    expect(await diskRow(bId, B)).toBeDefined();
    expect(useAppStore.getState().customMessages.map((message) => message.id)).toEqual([bId]);
  });

  it('does not call success after a same-account session was replaced', async () => {
    const user = userEvent.setup();
    const gate = deferred();
    vi.spyOn(customMessageService, 'deleteRemote').mockReturnValueOnce(gate.promise);
    const onConfirm = vi.fn();
    const preview: CustomMessage = { id: aId, text: 'Preview', category: 'custom', isCustom: true, active: true, createdAt: new Date().toISOString() };
    render(<LazyMotion features={domAnimation}><DeleteConfirmDialog message={preview} isOpen onConfirm={onConfirm} onCancel={() => {}} /></LazyMotion>);
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));
    act(() => { useAppStore.setState({ authSessionVersion: useAppStore.getState().authSessionVersion + 1 }); });
    await act(async () => { gate.resolve(); });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('AdminPanel offline (ticket 11)', () => {
  const OFFLINE = 'You are offline. Custom messages need a connection to save.';

  /**
   * The real API refuses with `requireOnline('Custom messages')` before any
   * request; the fakes stand in for it, so each write is given that first line.
   */
  async function refuseOffline() {
    const { fakeCustomMessagesApi } = await import('../helpers/fakeAccountDataApis');
    const refuse = async (): Promise<never> => {
      requireOnline('Custom messages');
      throw new Error('reached the request while offline');
    };
    fakeCustomMessagesApi.createCustomMessage.mockImplementationOnce(refuse);
    fakeCustomMessagesApi.updateCustomMessage.mockImplementationOnce(refuse);
    fakeCustomMessagesApi.deleteCustomMessage.mockImplementationOnce(refuse);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    return fakeCustomMessagesApi;
  }

  afterEach(async () => {
    const { fakeCustomMessagesApi } = await import('../helpers/fakeAccountDataApis');
    fakeCustomMessagesApi.createCustomMessage.mockReset();
    fakeCustomMessagesApi.updateCustomMessage.mockReset();
    fakeCustomMessagesApi.deleteCustomMessage.mockReset();
  });

  it('shows the offline indicator in the editor, and none online', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { unmount } = panel();
    expect(screen.getByTestId('network-status-indicator')).toHaveAttribute('data-status', 'offline');
    unmount();

    onLine.mockReturnValue(true);
    panel();
    expect(screen.queryByTestId('network-status-indicator')).toBeNull();
  });

  it('create: the form shows the offline reason and keeps the text; nothing is added', async () => {
    const user = userEvent.setup();
    panel();
    await refuseOffline();
    await user.click(screen.getByTestId('admin-create-button'));
    await user.type(screen.getByTestId('admin-create-form-text'), 'Not yet');
    await user.click(screen.getByTestId('admin-create-form-save'));

    expect(await screen.findByTestId('admin-create-form-error')).toHaveTextContent(OFFLINE);
    expect(screen.getByTestId('admin-create-form-text')).toHaveValue('Not yet');
    expect(screen.queryByText('Not yet', { selector: 'td' })).toBeNull();
    expect(useAppStore.getState().customMessages.map((message) => message.text)).toEqual([
      'Account A message',
    ]);
  });

  it('edit: the form shows the offline reason; the row is unchanged', async () => {
    const user = userEvent.setup();
    panel();
    await refuseOffline();
    await user.click(within(row('Account A message')).getByTestId('message-row-edit-button'));
    await user.clear(screen.getByTestId('admin-edit-form-text'));
    await user.type(screen.getByTestId('admin-edit-form-text'), 'Changed');
    await user.click(screen.getByTestId('admin-edit-form-save'));

    expect(await screen.findByTestId('admin-edit-form-error')).toHaveTextContent(OFFLINE);
    expect((await diskRow(aId))?.text).toBe('Account A message');
    expect(useAppStore.getState().customMessages[0].text).toBe('Account A message');
  });

  it('delete: the dialog shows the offline reason; the row stays', async () => {
    const user = userEvent.setup();
    panel();
    await refuseOffline();
    await user.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    await user.click(screen.getByTestId('admin-delete-dialog-confirm'));

    expect(await screen.findByRole('alert')).toHaveTextContent(OFFLINE);
    expect(screen.getByTestId('admin-delete-dialog')).toBeInTheDocument();
    expect(await diskRow(aId)).toBeDefined();
    expect(useAppStore.getState().customMessages.some((message) => message.id === aId)).toBe(true);
  });

  it('import: the alert gives the offline reason and does not blame the file', async () => {
    const user = userEvent.setup();
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    panel();
    await refuseOffline();
    const file = new File(
      [
        JSON.stringify({
          version: '1.0',
          exportDate: new Date().toISOString(),
          messageCount: 1,
          messages: [
            {
              text: 'Imported while offline',
              category: 'custom',
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ],
      'messages.json',
      { type: 'application/json' }
    );
    await user.upload(screen.getByTestId('import-file-input'), file);

    try {
      await waitFor(() => expect(alert).toHaveBeenCalledWith(OFFLINE));
      expect(useAppStore.getState().customMessages.map((message) => message.text)).toEqual([
        'Account A message',
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ['went offline', () => new AccountDataError('offline', OFFLINE), OFFLINE],
    [
      'lost the connection',
      () => new AccountDataError('transport', 'Failed to fetch'),
      'Import the same file again to add the rest.',
    ],
    [
      'hit a row it refused',
      () => new Error('Message text is required'),
      'Message text is required',
    ],
  ])(
    'import: an import that %s partway says how many were imported',
    async (_label, cause, reason) => {
      const user = userEvent.setup();
      const alert = vi.fn();
      vi.stubGlobal('alert', alert);
      useAppStore.setState({
        importCustomMessages: vi.fn(async () => {
          throw new CustomMessagesImportError(2, 5, cause());
        }),
      });
      panel();
      const file = new File(['{}'], 'messages.json', { type: 'application/json' });
      await user.upload(screen.getByTestId('import-file-input'), file);

      try {
        await waitFor(() =>
          expect(alert).toHaveBeenCalledWith(`Import stopped after 2 of 5 messages.\n${reason}`)
        );
      } finally {
        vi.unstubAllGlobals();
      }
    }
  );
});
