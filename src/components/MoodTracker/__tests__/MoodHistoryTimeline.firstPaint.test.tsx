/**
 * MoodHistoryTimeline — first-commit regression coverage
 *
 * The timeline's empty-state guard is `!isLoading && moods.length === 0`, so whatever
 * useMoodHistory reports as `isLoading` on the first render decides which terminal state
 * that commit describes. When the flag started `false`, the mount commit rendered
 * "no mood history yet" — a settled, zero-result answer for a fetch that had not been
 * issued yet — and swapped to the spinner only on the next commit.
 *
 * Whether that reached the user's eye is not asserted here: the panel mounts inside an
 * AnimatePresence fade, so the offending commit may well paint at opacity 0. The commit
 * sequence is the contract under test, because it is what was measured.
 *
 * Only the network layer is mocked. The real useMoodHistory runs, so this exercises the
 * genuine mount sequence rather than a hand-built hook state the app cannot reach.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { Profiler } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/moodApi', () => ({
  moodApi: { getMoodHistory: vi.fn() },
}));

import { moodApi } from '../../../api/moodApi';
import { MoodHistoryTimeline } from '../MoodHistoryTimeline';

const mockedGetMoodHistory = vi.mocked(moodApi.getMoodHistory);

const USER_ID = '00000000-0000-4000-8000-000000000001';

/** Holds the loading window open so every commit before data arrives is observable. */
const NEVER_RESOLVES = () => new Promise<never>(() => {});

beforeEach(() => {
  mockedGetMoodHistory.mockReset();
});

/**
 * Profiler.onRender fires after a commit is applied to the DOM, so querying the
 * document from inside it reports exactly what that commit put on screen.
 */
function recordCommits(): { commits: string[]; element: React.ReactElement } {
  const commits: string[] = [];
  const element = (
    <Profiler
      id="timeline"
      onRender={() => {
        const empty = document.querySelector('[data-testid="empty-mood-history-state"]');
        const list = document.querySelector('[data-testid="mood-history-timeline"]');
        commits.push(empty ? 'empty-state' : list ? 'timeline' : 'nothing');
      }}
    >
      <MoodHistoryTimeline userId={USER_ID} />
    </Profiler>
  );
  return { commits, element };
}

describe('MoodHistoryTimeline first paint', () => {
  it('never paints the empty state while the initial load is still in flight', () => {
    mockedGetMoodHistory.mockImplementation(NEVER_RESOLVES);
    const { commits, element } = recordCommits();

    render(element);

    expect(commits).not.toContain('empty-state');
  });

  it('shows the timeline on the very first commit', () => {
    mockedGetMoodHistory.mockImplementation(NEVER_RESOLVES);
    const { commits, element } = recordCommits();

    render(element);

    expect(commits[0]).toBe('timeline');
  });

  // The guard above only suppresses the empty state while a load is outstanding. Without
  // this case, a regression that left isLoading permanently true would show an endless
  // spinner to every user who has no moods, and the two tests above would still pass.
  it('still reaches the empty state once a load resolves with no moods', async () => {
    mockedGetMoodHistory.mockResolvedValue([]);

    render(<MoodHistoryTimeline userId={USER_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-mood-history-state')).toBeInTheDocument();
    });
  });
});
