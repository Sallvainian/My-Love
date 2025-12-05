import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PartnerMoodDisplay } from '@/components/MoodTracker/PartnerMoodDisplay';
import { usePartnerMood } from '@/hooks/usePartnerMood';

// Mock the supabaseClient to avoid initialization errors
vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
  getPartnerId: vi.fn().mockResolvedValue('partner-123'),
}));

// Mock the usePartnerMood hook
vi.mock('@/hooks/usePartnerMood');

describe('PartnerMoodDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(usePartnerMood).mockReturnValue({
      partnerMood: null,
      isLoading: true,
      connectionStatus: 'connecting',
    });

    render(<PartnerMoodDisplay partnerId="partner-123" />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('displays partner mood with all required elements', () => {
    vi.mocked(usePartnerMood).mockReturnValue({
      partnerMood: {
        id: '1',
        user_id: 'partner-123',
        mood_type: 'happy',
        note: 'Feeling great today!',
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
        updated_at: new Date().toISOString(),
      },
      isLoading: false,
      connectionStatus: 'connected',
    });

    render(<PartnerMoodDisplay partnerId="partner-123" />);

    expect(screen.getByTestId('partner-mood-display')).toBeInTheDocument();
    expect(screen.getByTestId('partner-mood-emoji')).toHaveTextContent('😊');
    expect(screen.getByTestId('partner-mood-label')).toHaveTextContent('happy');
    expect(screen.getByTestId('partner-mood-timestamp')).toHaveTextContent('2h ago');
    expect(screen.getByTestId('partner-mood-note')).toHaveTextContent('Feeling great today!');
  });

  it('shows "Just now" badge for recent moods', () => {
    vi.mocked(usePartnerMood).mockReturnValue({
      partnerMood: {
        id: '1',
        user_id: 'partner-123',
        mood_type: 'excited',
        note: null,
        created_at: new Date(Date.now() - 2 * 60000).toISOString(), // 2 minutes ago
        updated_at: new Date().toISOString(),
      },
      isLoading: false,
      connectionStatus: 'connected',
    });

    render(<PartnerMoodDisplay partnerId="partner-123" />);
    expect(screen.getByTestId('partner-mood-just-now-badge')).toBeInTheDocument();
    expect(screen.getByTestId('partner-mood-just-now-badge')).toHaveTextContent('Just now');
  });

  it('does not show "Just now" badge for older moods', () => {
    vi.mocked(usePartnerMood).mockReturnValue({
      partnerMood: {
        id: '1',
        user_id: 'partner-123',
        mood_type: 'happy',
        note: null,
        created_at: new Date(Date.now() - 10 * 60000).toISOString(), // 10 minutes ago
        updated_at: new Date().toISOString(),
      },
      isLoading: false,
      connectionStatus: 'connected',
    });

    render(<PartnerMoodDisplay partnerId="partner-123" />);
    expect(screen.queryByTestId('partner-mood-just-now-badge')).not.toBeInTheDocument();
  });

  it('shows no mood logged state when partner has no moods', () => {
    vi.mocked(usePartnerMood).mockReturnValue({
      partnerMood: null,
      isLoading: false,
      connectionStatus: 'connected',
    });

    render(<PartnerMoodDisplay partnerId="partner-123" />);
    expect(screen.getByTestId('no-mood-logged-state')).toBeInTheDocument();
    expect(screen.getByText('No mood logged yet')).toBeInTheDocument();
  });

  it('does not display note when partner mood has no note', () => {
    vi.mocked(usePartnerMood).mockReturnValue({
      partnerMood: {
        id: '1',
        user_id: 'partner-123',
        mood_type: 'happy',
        note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      isLoading: false,
      connectionStatus: 'connected',
    });

    render(<PartnerMoodDisplay partnerId="partner-123" />);
    expect(screen.queryByTestId('partner-mood-note')).not.toBeInTheDocument();
  });

  it('displays correct emoji for each mood type', () => {
    const testCases = [
      { moodType: 'loved' as const, emoji: '❤️' },
      { moodType: 'happy' as const, emoji: '😊' },
      { moodType: 'sad' as const, emoji: '😢' },
      { moodType: 'anxious' as const, emoji: '😰' },
    ];

    testCases.forEach(({ moodType, emoji }) => {
      vi.mocked(usePartnerMood).mockReturnValue({
        partnerMood: {
          id: '1',
          user_id: 'partner-123',
          mood_type: moodType,
          note: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        isLoading: false,
        connectionStatus: 'connected',
      });

      const { unmount } = render(<PartnerMoodDisplay partnerId="partner-123" />);
      expect(screen.getByTestId('partner-mood-emoji')).toHaveTextContent(emoji);
      unmount();
    });
  });
});
