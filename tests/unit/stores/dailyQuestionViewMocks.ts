/**
 * The module mocks the DailyQuestion view's test files share. Each file still
 * calls `vi.mock` itself (Vitest hoists those per file) and loads its factory
 * body from here with a dynamic import. This module imports nothing from the
 * app, so a factory that loads it cannot loop back into a module being mocked.
 */
import { vi } from 'vitest';

export const fetchDailyDay = vi.fn();
export const submitDailyPickRequest = vi.fn();
export const fetchCoupleStreak = vi.fn();
/** The partner-event subscription has its own test; here it is only mounted. */
export const useDailyPickListener = vi.fn();

export function supabaseClientMock() {
  return {
    supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
    getPartnerId: vi.fn(),
    lookupPartnerId: vi.fn(),
    isSeedFallbackName: () => false,
  };
}

export function dailyPickListenerMock() {
  return { useDailyPickListener: () => useDailyPickListener() };
}

export function dailyQuestionApiMock<T extends object>(original: T) {
  return {
    ...original,
    fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
    fetchCoupleStreak: (...args: unknown[]) => fetchCoupleStreak(...args),
    announceDailyPick: vi.fn(async () => {}),
    submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
  };
}

/** The mock resets every file's `beforeEach` starts with. */
export function resetDailyQuestionMocks() {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  submitDailyPickRequest.mockReset();
  fetchCoupleStreak.mockReset();
  fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });
}
