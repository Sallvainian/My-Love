/**
 * The kit dialog pieces, as the centred dialogs render them.
 *
 * The scrim pads clear of every safe-area inset (`viewport-fit=cover` lets the
 * page draw under them): the notch, the home indicator and, on the iPhone Duo,
 * the side column with its status capsule; and the panel is capped at the scrim's
 * padded height and scrolls, so no dialog runs off a short screen with its
 * buttons out of reach. A dialog that opens over another overlay (the note
 * removal over the chat) keeps its own layer: a second z utility in the same
 * class list would be resolved by CSS order, not by string order, so each
 * dialog asserts it carries exactly one.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/supabaseClient', () => ({
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../api/auth/sessionService', () => ({ getUser: vi.fn() }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => {
  const div = ({ children, ...props }: MotionDivProps) => {
    const { initial: _i, animate: _a, exit: _e, ...rest } = props as Record<string, unknown>;
    return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return {
    m: { div },
    motion: { div },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

import type { LoveNote } from '../../../types/models';
import { DisplayNameSetup } from '../../DisplayNameSetup';
import { NoteRemoveConfirmation } from '../../love-notes/NoteRemoveConfirmation';
import { ConfirmDialog } from '../../Settings/ConfirmDialog';
import { DIALOG_BACKDROP, DIALOG_PANEL } from '../kitClasses';

const SAFE_TOP = 'pt-[calc(1rem+env(safe-area-inset-top))]';
const SAFE_BOTTOM = 'pb-[calc(1rem+env(safe-area-inset-bottom))]';
const SAFE_LEFT = 'pl-[calc(1rem+env(safe-area-inset-left))]';
const SAFE_RIGHT = 'pr-[calc(1rem+env(safe-area-inset-right))]';

const note: LoveNote = {
  id: '11111111-1111-4111-8111-111111111111',
  from_user_id: 'user-a',
  to_user_id: 'user-b',
  content: 'i love you',
  created_at: '2026-08-17T10:00:00.000Z',
};

/** Every z utility on an element, so a second, conflicting one shows up. */
function zClasses(element: HTMLElement): string[] {
  return [...element.classList].filter((name) => /^z-/.test(name));
}

/** The scrim contract: safe-area padding on all four sides, and no plain `p-4` or `px-4`. */
function expectSafeScrim(scrim: HTMLElement) {
  expect(scrim).toHaveClass('fixed', 'inset-0', 'bg-black/50', SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT);
  expect(scrim).not.toHaveClass('p-4');
  expect(scrim).not.toHaveClass('px-4');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});

describe('kit dialog class strings', () => {
  it('pads the default scrim clear of the safe areas, on the default layer', () => {
    const classes = DIALOG_BACKDROP.split(' ');
    expect(classes).toEqual(expect.arrayContaining([SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT, 'z-50']));
    expect(classes).not.toContain('p-4');
    expect(classes).not.toContain('px-4');
  });

  it('caps the panel at the scrim height and lets it scroll', () => {
    expect(DIALOG_PANEL.split(' ')).toEqual(
      expect.arrayContaining(['max-h-full', 'overflow-y-auto', 'p-5'])
    );
  });
});

describe('the confirmation and removal dialogs scroll on a short screen', () => {
  it('the Settings confirmation dialog panel', () => {
    render(
      <ConfirmDialog
        question="Delete this event?"
        confirmLabel="Delete"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        testId="settings-confirmation"
      />
    );

    const scrim = screen.getByRole('dialog', { name: 'Delete this event?' });
    const panel = screen.getByRole('heading', { name: 'Delete this event?' }).parentElement!;
    expect(scrim).toContainElement(panel);
    expect(panel).toHaveClass('max-h-full', 'overflow-y-auto', 'max-w-sm');
    expectSafeScrim(scrim);
  });

  it('the note removal panel, on the layer above the chat', () => {
    render(
      <NoteRemoveConfirmation
        note={note}
        onClose={vi.fn()}
        onConfirmRemove={vi.fn()}
        fallbackFocusRef={{ current: null }}
      />
    );

    const scrim = screen.getByTestId('note-remove-confirmation');
    expectSafeScrim(scrim);
    expect(zClasses(scrim)).toEqual(['z-70']);
    const panel = screen.getByTestId('note-remove-panel');
    expect(scrim).toContainElement(panel);
    expect(panel).toHaveClass('max-h-full', 'overflow-y-auto', 'max-w-md');
    expect(panel).not.toHaveClass('p-5');
  });
});

describe('the other centred dialogs', () => {
  it('the display-name dialog scrolls and pads clear of the safe areas', () => {
    render(<DisplayNameSetup isOpen onComplete={vi.fn()} />);

    const scrim = screen.getByTestId('display-name-setup');
    expectSafeScrim(scrim);
    expect(zClasses(scrim)).toEqual(['z-50']);
    expect(screen.getByTestId('display-name-modal')).toHaveClass(
      'max-h-full',
      'overflow-y-auto',
      'max-w-md'
    );
  });
});
