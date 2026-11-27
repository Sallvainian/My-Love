/**
 * The module mocks the DailyQuestion view's test files share. Each file still
 * calls `vi.mock` itself (Vitest hoists those per file) and loads its factory
 * body from here with a dynamic import. This module imports nothing from the
 * app, so a factory that loads it cannot loop back into a module being mocked.
 */
import { vi, type Mock } from 'vitest';

// Each export is annotated with vitest's public `Mock`. Inferred, the type
// names vitest's internal `Procedure`, which TypeScript can only write as a
// path into node_modules, and a bmad-loop worktree (no node_modules of its
// own) fails the typecheck with TS2883 on that path.
export const fetchDailyDay: Mock = vi.fn();
export const submitDailyPickRequest: Mock = vi.fn();
export const fetchCoupleStreak: Mock = vi.fn();
/** The partner-event subscription has its own test; here it is only mounted. */
export const useDailyPickListener: Mock = vi.fn();

export function supabaseClientMock(): {
  supabase: { from: Mock; auth: Record<string, never>; channel: Mock; removeChannel: Mock };
  getPartnerId: Mock;
  lookupPartnerId: Mock;
  isSeedFallbackName: () => boolean;
} {
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
