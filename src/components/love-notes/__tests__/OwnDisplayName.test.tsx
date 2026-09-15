/**
 * Whose name the chat puts on your own messages.
 *
 * It used to come from `auth.updateUser`'s `user_metadata.display_name`, which
 * `sync_user_profile()` then copied over `public.users.display_name` on every
 * auth update — so the partner's name (always read from the profile row) and
 * your own name (read from the token) could disagree about the same person, and
 * a reload was enough to change which one you saw. Story 8 moved the name into
 * the profile row alone; this pins that the component asks for it there and
 * keeps the email-prefix fallback for a profile that still carries only the
 * trigger's seed.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getOwnDisplayName: vi.fn(),
  getPartnerDisplayName: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  getOwnDisplayName: api.getOwnDisplayName,
  getPartnerDisplayName: api.getPartnerDisplayName,
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: api.getUser },
}));
vi.mock('../../../hooks/useLoveNotes', () => ({
  useLoveNotes: () => ({
    notes: [],
    isLoading: false,
    error: null,
    hasMore: false,
    fetchOlderNotes: vi.fn(),
    clearError: vi.fn(),
    retryFailedMessage: vi.fn(),
  }),
}));

const storeState = {
  navigateHome: vi.fn(),
  userId: 'user-a',
  removeNote: vi.fn(),
};
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

// The names are props on MessageList, and MessageList only paints a sender name
// when there is a note to attach it to. Render them directly instead of seeding
// a conversation: what is under test is which value LoveNotes resolves, not how
// MessageList lays a bubble out.
vi.mock('../MessageList', () => ({
  MessageList: ({ userName, partnerName }: { userName: string; partnerName: string }) => (
    <div>
      <span data-testid="own-name">{userName}</span>
      <span data-testid="partner-name">{partnerName}</span>
    </div>
  ),
}));
vi.mock('../MessageInput', () => ({ MessageInput: () => null }));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { LoveNotes } from '../LoveNotes';

/** Mount the chat and wait for the name effect to settle on `expected`. */
async function expectOwnName(expected: string): Promise<void> {
  render(<LoveNotes />);
  await waitFor(() => {
    // textContent, not toHaveTextContent: that matcher is a substring match, so
    // 'You' would pass against the very fallbacks these cases distinguish.
    expect(screen.getByTestId('own-name').textContent).toBe(expected);
  });
}

describe('own display name in the chat', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.getPartnerDisplayName.mockResolvedValue('Partner Name');
    api.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
  });

  it('shows the chosen profile name', async () => {
    api.getOwnDisplayName.mockResolvedValue('Jessie');
    await expectOwnName('Jessie');
  });

  it('falls back to the email prefix when the profile carries only the seed', async () => {
    api.getOwnDisplayName.mockResolvedValue(null);
    await expectOwnName('person');
  });

  it('falls back to the email prefix when the profile read fails', async () => {
    // `getOwnDisplayName` collapses a failed read to null, and a rendered name
    // has nothing better to do with that than the seed case does.
    api.getOwnDisplayName.mockResolvedValue(null);
    api.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    await expectOwnName('person');
  });

  it('keeps the default when there is no name and no email to fall back to', async () => {
    api.getOwnDisplayName.mockResolvedValue(null);
    api.getUser.mockResolvedValue({ id: 'user-a', email: null });
    await expectOwnName('You');
  });

  it('never reads the name off auth user_metadata', async () => {
    // The old path. A regression that restored it would pass every assertion
    // above while reintroducing the disagreement this story removed.
    api.getOwnDisplayName.mockResolvedValue(null);
    api.getUser.mockResolvedValue({
      id: 'user-a',
      email: 'person@example.com',
      user_metadata: { display_name: 'Stale Metadata Name' },
    });
    await expectOwnName('person');
  });

  it('still reads the partner name from the profile row', async () => {
    api.getOwnDisplayName.mockResolvedValue('Jessie');
    render(<LoveNotes />);
    await waitFor(() => expect(screen.getByTestId('partner-name')).toHaveTextContent('Partner Name'));
  });

  /**
   * DW-104, the other half. `getPartnerDisplayName` used to return the stored
   * column verbatim, so a partner who had never chosen a name — whose row still
   * carried the trigger's email seed — was rendered on every note as their full
   * email address, while the same person's own view of themselves showed the
   * email PREFIX. The seed rule now lives in one predicate that both readers
   * share, and a seeded partner row answers `null`.
   *
   * What is pinned HERE is only what this component decides: that a `null`
   * answer leaves the `'Partner'` default at `LoveNotes.tsx:59` standing, and
   * that the own-name fallback is not borrowed for it. Which partner rows
   * actually produce that `null` — a seed, a failed read, no partner at all —
   * is the lookup's contract, and it is pinned against the REAL function in
   * tests/unit/api/partnerDisplayNameContract.test.ts. Splitting those three
   * across cases here would be a lie: the mock collapses them into one value
   * before the component ever sees them, so the cases would differ only in
   * their names.
   */
  describe('the partner-side fallback', () => {
    it("falls back to 'Partner', never to an address, when the lookup answers null", async () => {
      api.getOwnDisplayName.mockResolvedValue('Jessie');
      api.getPartnerDisplayName.mockResolvedValue(null);

      render(<LoveNotes />);

      await waitFor(() => {
        expect(screen.getByTestId('partner-name').textContent).toBe('Partner');
      });
      // The user-visible shape of the bug, asserted directly: whatever the
      // fallback is, it must not be an address or a fragment of one.
      const rendered = screen.getByTestId('partner-name').textContent ?? '';
      expect(rendered).not.toContain('@');
      expect(rendered).not.toContain('example.com');
    });

    it('does not borrow the own-name fallback for the partner', async () => {
      // Both sides are unnamed here. The email in play is the CALLER's, so
      // reusing the own-name fallback would print the caller's prefix as their
      // partner's name — the wrong person, not merely the wrong string.
      api.getOwnDisplayName.mockResolvedValue(null);
      api.getPartnerDisplayName.mockResolvedValue(null);
      api.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });

      render(<LoveNotes />);

      await waitFor(() => expect(screen.getByTestId('own-name').textContent).toBe('person'));
      expect(screen.getByTestId('partner-name').textContent).toBe('Partner');
    });
  });
});
