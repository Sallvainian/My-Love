/**
 * UpdateConfirmDialog: "Update now?", opened through nativeUpdates' confirm
 * store. The store is the real one; `applyUpdate` is stubbed per test.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const applyUpdate = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock('../../../services/nativeUpdates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/nativeUpdates')>()),
  applyUpdate,
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => {
  const div = ({ children, ...props }: MotionDivProps) => {
    const { initial: _i, animate: _a, exit: _e, ...rest } = props as Record<string, unknown>;
    return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return {
    m: { div },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

import {
  closeUpdateConfirm,
  getUpdateConfirmOpen,
  openUpdateConfirm,
} from '../../../services/nativeUpdates';
import { UpdateConfirmDialog } from '../UpdateConfirmDialog';

function renderOpen() {
  const utils = render(<UpdateConfirmDialog />);
  act(() => openUpdateConfirm());
  return utils;
}

beforeEach(() => {
  closeUpdateConfirm();
  applyUpdate.mockReset();
});

afterEach(() => {
  cleanup();
  closeUpdateConfirm();
});

describe('UpdateConfirmDialog', () => {
  it('renders nothing until the confirm store opens it', () => {
    render(<UpdateConfirmDialog />);

    expect(screen.queryByTestId('update-confirm')).not.toBeInTheDocument();
  });

  it('asks "Update now?" with its body and No before Yes, focus on No', () => {
    renderOpen();

    const dialog = screen.getByRole('dialog', { name: 'Update now?' });
    expect(dialog).toBeVisible();
    expect(screen.getByText("You may lose what you're doing.")).toHaveClass('text-muted');
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['No', 'Yes']);
    expect(screen.getByRole('button', { name: 'No' })).toHaveFocus();
  });

  it('paints Yes solid red and No neutral, so the two do not read alike', () => {
    renderOpen();

    expect(screen.getByTestId('update-confirm-yes')).toHaveClass('bg-danger', 'text-card');
    expect(screen.getByTestId('update-confirm-no')).toHaveClass('bg-card2', 'text-ink', 'border-line-strong');
    expect(screen.getByTestId('update-confirm-no')).not.toHaveClass('bg-tint', 'text-accent');
  });

  it('paints above every other overlay, the toast (z-100) and the drop-down (z-110)', () => {
    renderOpen();

    const layer = screen.getByTestId('update-confirm-layer');
    // A positioned element with a z-index forms the stacking context the
    // kit scrim (z-50) paints inside, so the layer's z is what counts.
    expect(layer).toHaveClass('relative', 'z-120');
    expect(layer).toContainElement(screen.getByTestId('update-confirm'));
    expect([...layer.classList].filter((name) => /^z-/.test(name))).toEqual(['z-120']);
  });

  it('closes on No without applying the update', async () => {
    renderOpen();

    await userEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(screen.queryByTestId('update-confirm')).not.toBeInTheDocument();
    expect(getUpdateConfirmOpen()).toBe(false);
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('closes on a tap on the scrim without applying the update', async () => {
    renderOpen();

    await userEvent.click(screen.getByTestId('update-confirm'));

    expect(screen.queryByTestId('update-confirm')).not.toBeInTheDocument();
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('disables both buttons and applies the update on Yes', async () => {
    // A successful restart never resolves in the shell: the web view reloads.
    applyUpdate.mockReturnValue(new Promise<boolean>(() => {}));
    renderOpen();

    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(applyUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled();
  });

  it('ignores the scrim and Escape while the restart runs', async () => {
    applyUpdate.mockReturnValue(new Promise<boolean>(() => {}));
    renderOpen();

    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await userEvent.click(screen.getByTestId('update-confirm'));
    await userEvent.keyboard('{Escape}');

    expect(screen.getByTestId('update-confirm')).toBeInTheDocument();
    expect(getUpdateConfirmOpen()).toBe(true);
  });

  it('closes when the restart fails, so the update stays waiting', async () => {
    applyUpdate.mockResolvedValue(false);
    renderOpen();

    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(applyUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('update-confirm')).not.toBeInTheDocument();
    expect(getUpdateConfirmOpen()).toBe(false);
  });
});
