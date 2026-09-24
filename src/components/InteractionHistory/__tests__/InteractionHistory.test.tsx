import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Interaction } from '../../../api/interactionService';

const storeMocks = vi.hoisted(() => ({
  // Never resolves: the sheet stays in its loading phase for the whole test.
  loadInteractionHistory: vi.fn(() => new Promise<void>(() => {})),
  getInteractionHistory: vi.fn((): Interaction[] => []),
}));

const USER_ID = 'USER-A-ID';

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (state: { userId: string }) => unknown) =>
    selector ? selector({ userId: USER_ID }) : storeMocks,
}));

import { InteractionHistory } from '../InteractionHistory';

describe('InteractionHistory loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the shown list on screen while the refresh is in flight', () => {
    storeMocks.getInteractionHistory.mockReturnValue([
      {
        id: 'recent-1',
        type: 'poke',
        fromUserId: 'PARTNER-ID',
        toUserId: USER_ID,
        viewed: false,
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);

    render(<InteractionHistory isOpen onClose={() => {}} />);

    expect(storeMocks.loadInteractionHistory).toHaveBeenCalledWith(100);
    expect(screen.getByTestId('interaction-recent-1')).toBeInTheDocument();
    expect(screen.queryByText('Loading interactions...')).not.toBeInTheDocument();
  });

  it('shows the loading state while the refresh is in flight with an empty list', () => {
    storeMocks.getInteractionHistory.mockReturnValue([]);

    render(<InteractionHistory isOpen onClose={() => {}} />);

    expect(screen.getByText('Loading interactions...')).toBeInTheDocument();
    expect(screen.queryByText('No interactions yet')).not.toBeInTheDocument();
  });
});
