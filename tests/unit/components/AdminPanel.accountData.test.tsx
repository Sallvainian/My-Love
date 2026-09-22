import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { domAnimation, LazyMotion } from 'framer-motion';
import type { HTMLAttributes, ReactNode } from 'react';
import { deleteDB, openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPanel } from '../../../src/components/AdminPanel/AdminPanel';
import { DeleteConfirmDialog } from '../../../src/components/AdminPanel/DeleteConfirmDialog';
import { customMessageService } from '../../../src/services/customMessageService';
import { DB_NAME, DB_VERSION, type MyLoveDBSchema } from '../../../src/services/dbSchema';
import { storageService } from '../../../src/services/storage';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { CustomMessage } from '../../../src/types';

// The server half of custom messages and favorites; these tests drive the
// IndexedDB mirror, which is written only after the server accepted a write.
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
vi.mock('framer-motion', () => ({
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

async function diskRow(id: number) {
  const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
  try { return await db.get('messages', id); } finally { db.close(); }
}

function row(text: string) {
  return screen.getByText(text).closest('tr')!;
}

beforeEach(async () => {
  localStorage.clear();
  useAppStore.setState(useAppStore.getInitialState(), true);
  await storageService.init();
  await storageService.addMessage({ text: 'Shared daily', category: 'reason', isCustom: false, createdAt: new Date() });
  aId = (await customMessageService.create(A, { text: 'Account A message', category: 'custom' })).id;
  bId = (await customMessageService.create(B, { text: 'Account B message', category: 'custom' })).id;
  await switchAccount(A);
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  for (const service of [storageService, customMessageService]) {
    const holder = service as unknown as { db: { close(): void } | null };
    holder.db?.close();
    holder.db = null;
  }
  await deleteDB(DB_NAME);
});

describe('AdminPanel with real IndexedDB and store', () => {
  it.each(['edit', 'delete'] as const)('isolates A/B/A lists and removes the outgoing %s preview', async (dialog) => {
    panel();
    expect(screen.getAllByText('Account A message')).toHaveLength(1);
    fireEvent.click(within(row('Account A message')).getByTestId(`message-row-${dialog}-button`));
    expect(screen.getByTestId(dialog === 'edit' ? 'admin-edit-form' : 'admin-delete-dialog')).toBeInTheDocument();
    await switchAccount(B);
    expect(screen.queryByText('Account A message')).toBeNull();
    expect(screen.queryByTestId('admin-edit-form')).toBeNull();
    expect(screen.queryByTestId('admin-delete-dialog')).toBeNull();
    expect(screen.getByText('Account B message')).toBeInTheDocument();
    await switchAccount(A);
    expect(screen.getAllByText('Account A message')).toHaveLength(1);
    expect(screen.queryByText('Account B message')).toBeNull();
    expect(await diskRow(aId)).toBeDefined();
    expect(await diskRow(bId)).toBeDefined();
  });

  it('keeps deletion pending, prevents dismissal and duplicate submits, then closes after persisted success', async () => {
    panel();
    act(() => { useAppStore.setState({ currentMessage: useAppStore.getState().messages.find((message) => message.id === aId)! }); });
    const gate = deferred();
    const realDelete = customMessageService.deleteForUser.bind(customMessageService);
    const remove = vi.spyOn(customMessageService, 'deleteForUser').mockImplementation(async (...args) => {
      await gate.promise;
      return realDelete(...args);
    });
    fireEvent.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    fireEvent.click(screen.getByTestId('admin-delete-dialog-confirm'));
    fireEvent.click(screen.getByTestId('admin-delete-dialog-confirm'));
    fireEvent.click(screen.getByTestId('admin-delete-dialog-cancel'));
    fireEvent.click(screen.getByTestId('admin-delete-dialog-backdrop'));
    expect(remove).toHaveBeenCalledTimes(1);
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
    panel();
    const remove = vi.spyOn(customMessageService, 'deleteForUser').mockRejectedValueOnce(new Error('disk unavailable'));
    fireEvent.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    fireEvent.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await screen.findByRole('alert');
    expect(screen.getByTestId('admin-delete-dialog-cancel')).toBeEnabled();
    expect(await diskRow(aId)).toBeDefined();
    expect(useAppStore.getState().customMessages.some((message) => message.id === aId)).toBe(true);
    fireEvent.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await waitFor(() => expect(screen.queryByTestId('admin-delete-dialog')).toBeNull());
    expect(remove).toHaveBeenCalledTimes(2);
    expect(await diskRow(aId)).toBeUndefined();
  });

  it('allows cancellation after a failed delete without removing the row', async () => {
    panel();
    vi.spyOn(customMessageService, 'deleteForUser').mockRejectedValueOnce(new Error('disk unavailable'));
    fireEvent.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    fireEvent.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByTestId('admin-delete-dialog-cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await diskRow(aId)).toBeDefined();
  });

  it('does not let an old completion close the new account’s dialog', async () => {
    panel();
    const gate = deferred();
    const realDelete = customMessageService.deleteForUser.bind(customMessageService);
    vi.spyOn(customMessageService, 'deleteForUser').mockImplementationOnce(async (...args) => {
      await gate.promise;
      return realDelete(...args);
    });
    fireEvent.click(within(row('Account A message')).getByTestId('message-row-delete-button'));
    fireEvent.click(screen.getByTestId('admin-delete-dialog-confirm'));
    await switchAccount(B);
    fireEvent.click(within(row('Account B message')).getByTestId('message-row-delete-button'));
    await act(async () => { gate.resolve(); });
    await waitFor(async () => expect(await diskRow(aId)).toBeUndefined());
    expect(within(screen.getByRole('dialog')).getByText('Account B message')).toBeInTheDocument();
    expect(await diskRow(bId)).toBeDefined();
    expect(useAppStore.getState().customMessages.map((message) => message.id)).toEqual([bId]);
  });

  it('does not call success after a same-account session was replaced', async () => {
    const gate = deferred();
    vi.spyOn(customMessageService, 'deleteForUser').mockReturnValueOnce(gate.promise);
    const onConfirm = vi.fn();
    const preview: CustomMessage = { id: aId, text: 'Preview', category: 'custom', isCustom: true, active: true, createdAt: new Date().toISOString() };
    render(<LazyMotion features={domAnimation}><DeleteConfirmDialog message={preview} isOpen onConfirm={onConfirm} onCancel={() => {}} /></LazyMotion>);
    fireEvent.click(screen.getByTestId('admin-delete-dialog-confirm'));
    act(() => { useAppStore.setState({ authSessionVersion: useAppStore.getState().authSessionVersion + 1 }); });
    await act(async () => { gate.resolve(); });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
