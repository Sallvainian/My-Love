/**
 * The kit dialog pieces, as the centred dialogs render them.
 *
 * The scrim pads clear of the notch and home indicator (`viewport-fit=cover`
 * lets the page draw under both), and the panel is capped at the scrim's
 * padded height and scrolls, so no dialog runs off a short screen with its
 * buttons out of reach. The dialogs that open over another overlay (the photo
 * pair over the carousel, the note removal over the chat) keep their own
 * layer: a second z utility in the same class list would be resolved by CSS
 * order, not by string order, so each asserts it carries exactly one.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('framer-motion', () => {
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

import type { PhotoWithUrls } from '../../../services/photoService';
import type { AppState } from '../../../stores/types';
import { useAppStore } from '../../../stores/useAppStore';
import type { LoveNote } from '../../../types/models';
import { DisplayNameSetup } from '../../DisplayNameSetup';
import { NoteRemoveConfirmation } from '../../love-notes/NoteRemoveConfirmation';
import { PhotoDeleteConfirmation } from '../../PhotoDeleteConfirmation/PhotoDeleteConfirmation';
import { PhotoEditModal } from '../../PhotoEditModal/PhotoEditModal';
import { AnniversarySettings } from '../../Settings/AnniversarySettings';
import { DIALOG_BACKDROP, DIALOG_PANEL } from '../kitClasses';

const SAFE_TOP = 'pt-[calc(1rem+env(safe-area-inset-top))]';
const SAFE_BOTTOM = 'pb-[calc(1rem+env(safe-area-inset-bottom))]';

const photo = {
  id: 'photo-1',
  caption: 'Beach day',
  signedUrl: 'https://example.test/photo.jpg',
} as unknown as PhotoWithUrls;

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

/** The scrim contract: safe-area padding and no plain all-round `p-4`. */
function expectSafeScrim(scrim: HTMLElement) {
  expect(scrim).toHaveClass('fixed', 'inset-0', 'bg-black/50', 'px-4', SAFE_TOP, SAFE_BOTTOM);
  expect(scrim).not.toHaveClass('p-4');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('kit dialog class strings', () => {
  it('pads the default scrim clear of the safe areas, on the default layer', () => {
    const classes = DIALOG_BACKDROP.split(' ');
    expect(classes).toEqual(expect.arrayContaining([SAFE_TOP, SAFE_BOTTOM, 'px-4', 'z-50']));
    expect(classes).not.toContain('p-4');
  });

  it('caps the panel at the scrim height and lets it scroll', () => {
    expect(DIALOG_PANEL.split(' ')).toEqual(
      expect.arrayContaining(['max-h-full', 'overflow-y-auto', 'p-5'])
    );
  });
});

describe('the delete dialogs scroll on a short screen', () => {
  it('the anniversary delete panel', () => {
    const settings = useAppStore.getState().settings!;
    useAppStore.setState({
      settings: {
        ...settings,
        relationship: {
          ...settings.relationship,
          anniversaries: [{ id: 7, date: '2024-02-14', label: 'First date', serverId: 'ann-7' }],
        },
      },
    } as Partial<AppState>);
    render(<AnniversarySettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete anniversary' }));

    const panel = screen.getByRole('heading', { name: 'Delete Anniversary?' }).parentElement!;
    expect(panel).toHaveClass('max-h-full', 'overflow-y-auto', 'max-w-sm');
    expectSafeScrim(panel.parentElement!);
  });

  it('the photo delete panel, on the layer above the edit modal', () => {
    render(<PhotoDeleteConfirmation photo={photo} onClose={vi.fn()} onConfirmDelete={vi.fn()} />);

    const scrim = screen.getByTestId('photo-delete-confirmation');
    expectSafeScrim(scrim);
    expect(zClasses(scrim)).toEqual(['z-[70]']);
    const panel = scrim.firstElementChild as HTMLElement;
    expect(panel).toHaveClass('max-h-full', 'overflow-y-auto', 'max-w-md');
    // The bordered header runs edge to edge, so the panel itself is unpadded.
    expect(panel).not.toHaveClass('p-5');
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
    expect(zClasses(scrim)).toEqual(['z-[70]']);
    const panel = scrim.firstElementChild as HTMLElement;
    expect(panel).toHaveClass('max-h-full', 'overflow-y-auto', 'max-w-md');
    expect(panel).not.toHaveClass('p-5');
  });
});

describe('the other centred dialogs', () => {
  it('the photo edit modal keeps its layer and scrolls within the padded scrim', () => {
    render(<PhotoEditModal photo={photo} onClose={vi.fn()} onSave={vi.fn()} />);

    const scrim = screen.getByTestId('photo-edit-modal');
    expectSafeScrim(scrim);
    expect(zClasses(scrim)).toEqual(['z-[60]']);
    const panel = scrim.firstElementChild as HTMLElement;
    expect(panel).toHaveClass('max-h-full', 'overflow-y-auto', 'max-w-2xl');
    expect(panel).not.toHaveClass('p-5');
    expect(screen.getByTestId('photo-edit-modal-caption-input')).toHaveClass(
      'bg-field',
      'resize-none',
      'ring-line'
    );
    expect(screen.getByTestId('photo-edit-modal-tags-input')).toHaveClass('bg-field', 'h-12');
  });

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
