/**
 * LobbyContainer Component Tests
 *
 * Story 4.1: Lobby, Role Selection & Countdown
 * Unit tests for the LobbyContainer component.
 *
 * Tests:
 * - Phase A: role selection screen renders when myRole=null
 * - Phase B: lobby waiting screen renders when myRole is set
 * - Partner presence indicators
 * - Ready toggle interactions
 * - Continue solo action
 * - Phase C: Countdown renders when countdownStartedAt is set
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LobbyContainer } from '../containers/LobbyContainer';

// Mock framer-motion (project pattern)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children as React.ReactNode}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useMotionConfig (project pattern)
vi.mock('../../../hooks/useMotionConfig', () => ({
  useMotionConfig: () => ({
    shouldReduceMotion: false,
    crossfade: { duration: 0 },
    slide: { duration: 0 },
  }),
}));

// Mock useScriptureBroadcast — side-effect-only hook
vi.mock('../../../hooks/useScriptureBroadcast', () => ({
  useScriptureBroadcast: vi.fn(),
}));

// Mock Countdown to avoid timer setup in unit tests
vi.mock('../session/Countdown', () => ({
  Countdown: ({ onComplete }: { startedAt: number; onComplete: () => void }) => (
    <div data-testid="countdown-container">
      <button onClick={onComplete} data-testid="countdown-complete">
        Done
      </button>
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-bookopen" />,
  MessageCircle: () => <span data-testid="icon-messagecircle" />,
}));

// ============================================
// Mocked Zustand store
// ============================================
const mockSelectRole = vi.fn().mockResolvedValue(undefined);
const mockToggleReady = vi.fn().mockResolvedValue(undefined);
const mockConvertToSolo = vi.fn().mockResolvedValue(undefined);
const mockUpdatePhase = vi.fn();

const mockStoreState = {
  session: {
    id: 'session-001',
    mode: 'together' as const,
    currentPhase: 'lobby' as const,
    currentStepIndex: 0,
    version: 1,
    userId: 'user-1',
    partnerId: 'user-2',
    status: 'in_progress' as const,
    startedAt: new Date(),
  },
  myRole: null as 'reader' | 'responder' | null,
  partnerJoined: false,
  myReady: false,
  partnerReady: false,
  countdownStartedAt: null as number | null,
  scriptureLoading: false,
  selectRole: mockSelectRole,
  toggleReady: mockToggleReady,
  convertToSolo: mockConvertToSolo,
  updatePhase: mockUpdatePhase,
  partner: { id: 'user-2', displayName: 'Alex' } as { id: string; displayName: string } | null,
};

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState)
  ),
}));

// ============================================
// Tests
// ============================================

describe('LobbyContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.session = {
      id: 'session-001',
      mode: 'together',
      currentPhase: 'lobby',
      currentStepIndex: 0,
      version: 1,
      userId: 'user-1',
      partnerId: 'user-2',
      status: 'in_progress',
      startedAt: new Date(),
    };
    mockStoreState.myRole = null;
    mockStoreState.partnerJoined = false;
    mockStoreState.myReady = false;
    mockStoreState.partnerReady = false;
    mockStoreState.countdownStartedAt = null;
    mockStoreState.scriptureLoading = false;
    mockStoreState.partner = { id: 'user-2', displayName: 'Alex' };
  });

  describe('Phase A: Role Selection (myRole=null)', () => {
    test('[P1] renders role selection screen when myRole is null', () => {
      render(<LobbyContainer />);
      expect(screen.getByTestId('lobby-role-selection')).toBeInTheDocument();
    });

    test('[P1] Reader card click calls selectRole with reader', () => {
      render(<LobbyContainer />);
      fireEvent.click(screen.getByTestId('lobby-role-reader'));
      expect(mockSelectRole).toHaveBeenCalledWith('reader');
    });

    test('[P1] Responder card click calls selectRole with responder', () => {
      render(<LobbyContainer />);
      fireEvent.click(screen.getByTestId('lobby-role-responder'));
      expect(mockSelectRole).toHaveBeenCalledWith('responder');
    });

    test('[P1] cards are disabled when scriptureLoading is true', () => {
      mockStoreState.scriptureLoading = true;
      render(<LobbyContainer />);
      expect(screen.getByTestId('lobby-role-reader')).toBeDisabled();
      expect(screen.getByTestId('lobby-role-responder')).toBeDisabled();
    });

    test('[P1] continue solo button is present in role selection', () => {
      render(<LobbyContainer />);
      expect(screen.getByTestId('lobby-continue-solo')).toBeInTheDocument();
    });

    test('[P1] continue solo in role selection calls convertToSolo', () => {
      render(<LobbyContainer />);
      fireEvent.click(screen.getByTestId('lobby-continue-solo'));
      expect(mockConvertToSolo).toHaveBeenCalledTimes(1);
    });
  });

  describe('Phase B: Lobby Waiting (myRole set, countdownStartedAt=null)', () => {
    beforeEach(() => {
      mockStoreState.myRole = 'reader';
    });

    test('[P1] shows lobby waiting screen when myRole is set', () => {
      render(<LobbyContainer />);
      expect(screen.getByTestId('lobby-waiting')).toBeInTheDocument();
    });

    test('[P1] shows waiting for partner message when partnerJoined is false', () => {
      mockStoreState.partnerJoined = false;
      render(<LobbyContainer />);
      const partnerStatus = screen.getByTestId('lobby-partner-status');
      expect(partnerStatus).toHaveTextContent(/Waiting for Alex/);
    });

    test('[P1] shows partner joined message when partnerJoined is true', () => {
      mockStoreState.partnerJoined = true;
      render(<LobbyContainer />);
      const partnerStatus = screen.getByTestId('lobby-partner-status');
      expect(partnerStatus).toHaveTextContent(/Alex has joined/);
    });

    test('[P1] ready button calls toggleReady(true) when not ready', () => {
      mockStoreState.myReady = false;
      render(<LobbyContainer />);
      fireEvent.click(screen.getByTestId('lobby-ready-button'));
      expect(mockToggleReady).toHaveBeenCalledWith(true);
    });

    test('[P1] ready button calls toggleReady(false) when already ready', () => {
      mockStoreState.myReady = true;
      render(<LobbyContainer />);
      fireEvent.click(screen.getByTestId('lobby-ready-button'));
      expect(mockToggleReady).toHaveBeenCalledWith(false);
    });

    test('[P1] partner joined status region has aria-live polite', () => {
      render(<LobbyContainer />);
      const liveRegion = screen.getByTestId('lobby-partner-status').closest('[aria-live]');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    test('[P1] partner ready indicator shows when partnerJoined is true', () => {
      mockStoreState.partnerJoined = true;
      mockStoreState.partnerReady = true;
      render(<LobbyContainer />);
      expect(screen.getByTestId('lobby-partner-ready')).toHaveTextContent(/Alex is ready/);
    });

    test('[P1] partner not ready message when partner not yet ready', () => {
      mockStoreState.partnerJoined = true;
      mockStoreState.partnerReady = false;
      render(<LobbyContainer />);
      expect(screen.getByTestId('lobby-partner-ready')).toHaveTextContent(/not ready yet/);
    });

    test('[P1] continue solo button calls convertToSolo', () => {
      render(<LobbyContainer />);
      fireEvent.click(screen.getByTestId('lobby-continue-solo'));
      expect(mockConvertToSolo).toHaveBeenCalledTimes(1);
    });
  });

  describe('Phase C: Countdown', () => {
    test('[P1] renders Countdown when countdownStartedAt is set', () => {
      mockStoreState.myRole = 'reader';
      mockStoreState.countdownStartedAt = Date.now() - 500;
      render(<LobbyContainer />);
      expect(screen.getByTestId('countdown-container')).toBeInTheDocument();
    });

    test('[P1] calls updatePhase with reading when countdown completes', () => {
      mockStoreState.myRole = 'reader';
      mockStoreState.countdownStartedAt = Date.now() - 500;
      render(<LobbyContainer />);
      fireEvent.click(screen.getByTestId('countdown-complete'));
      expect(mockUpdatePhase).toHaveBeenCalledWith('reading');
    });
  });
});
