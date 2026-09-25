/**
 * CreateMessageForm hands the store one idempotency key per submit and reuses
 * it when the same submit is retried, so a save whose response was lost after
 * the server committed resolves to the stored message instead of a duplicate.
 * Changing the message mints a new key: reusing one across different content
 * would make the server return the first row and drop the edit.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => ({
  m: {
    div: ({ children, ...props }: MotionDivProps) => {
      const { initial: _i, animate: _a, exit: _e, ...rest } = props as Record<string, unknown>;
      return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { CreateMessageForm } from '../../../src/components/AdminPanel/CreateMessageForm';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { AppState } from '../../../src/stores/types';

const createCustomMessage = vi.fn();

beforeEach(() => {
  createCustomMessage.mockReset();
  useAppStore.setState({ createCustomMessage } as Partial<AppState>);
});

afterEach(() => {
  cleanup();
});

function type(text: string) {
  fireEvent.change(screen.getByTestId('admin-create-form-text'), { target: { value: text } });
}

function save() {
  fireEvent.click(screen.getByTestId('admin-create-form-save'));
}

describe('CreateMessageForm submit key', () => {
  it('reuses the key on a retry of the same message and mints a new one after an edit', async () => {
    createCustomMessage.mockRejectedValue(new Error('Network error'));
    render(<CreateMessageForm isOpen onClose={() => {}} />);

    type('You make every day better');
    save();
    await waitFor(() => expect(createCustomMessage).toHaveBeenCalledTimes(1));
    save();
    await waitFor(() => expect(createCustomMessage).toHaveBeenCalledTimes(2));
    type('You make every day brighter');
    save();
    await waitFor(() => expect(createCustomMessage).toHaveBeenCalledTimes(3));

    const keys = createCustomMessage.mock.calls.map((call) => call[1]);
    expect(typeof keys[0]).toBe('string');
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('going back to an earlier version reuses that version’s key', async () => {
    createCustomMessage.mockRejectedValue(new Error('Network error'));
    render(<CreateMessageForm isOpen onClose={() => {}} />);

    for (const [index, text] of ['Version X', 'Version Y', 'Version X'].entries()) {
      type(text);
      save();
      await waitFor(() => expect(createCustomMessage).toHaveBeenCalledTimes(index + 1));
    }

    const keys = createCustomMessage.mock.calls.map((call) => call[1]);
    // X may have committed before its response was lost; retrying X must
    // resolve to that row, even after a failed Y in between.
    expect(keys[2]).toBe(keys[0]);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('starts a fresh key after a successful save', async () => {
    createCustomMessage.mockResolvedValue(undefined);
    render(<CreateMessageForm isOpen onClose={() => {}} />);

    type('Same words');
    save();
    await waitFor(() => expect(createCustomMessage).toHaveBeenCalledTimes(1));
    type('Same words');
    save();
    await waitFor(() => expect(createCustomMessage).toHaveBeenCalledTimes(2));

    const keys = createCustomMessage.mock.calls.map((call) => call[1]);
    // A second, deliberate message with the same text is a new row.
    expect(keys[1]).not.toBe(keys[0]);
  });
});
