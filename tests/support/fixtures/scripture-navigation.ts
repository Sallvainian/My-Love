/**
 * Scripture Navigation Fixture
 *
 * Provides high-level navigation methods for scripture reading flow tests.
 * Wraps page helpers as fixture methods for better test composition.
 */
import { test as base } from '@playwright/test';
import {
  ensureScriptureOverview,
  startSoloSession,
  advanceOneStep,
  completeAllStepsToReflectionSummary,
  submitReflectionSummary,
  skipMessageAndCompleteSession,
} from '../helpers';

/**
 * Scripture navigation fixture providing high-level methods for scripture tests.
 */
export type ScriptureNavFixture = {
  /**
   * Navigate to /scripture and handle stale sessions.
   */
  ensureOverview: () => Promise<void>;

  /**
   * Start a solo scripture session.
   * @returns Session ID
   */
  startSoloSession: () => Promise<string>;

  /**
   * Advance to the next verse by clicking Next Verse.
   */
  advanceOneStep: () => Promise<void>;

  /**
   * Complete all 17 steps (clicking Next Verse) to reach reflection summary.
   * @param bookmarkSteps - Set of step indices (0-16) to bookmark
   * @returns Session ID
   */
  completeAllSteps: (bookmarkSteps?: Set<number>) => Promise<string>;

  /**
   * Submit the reflection summary form.
   */
  submitSummary: () => Promise<void>;

  /**
   * Submit reflection summary, skip message compose, and wait for session completion.
   */
  completeSession: () => Promise<void>;
};

type ScriptureNavFixtures = {
  scriptureNav: ScriptureNavFixture;
};

/**
 * Scripture navigation fixture.
 * Requires page and interceptNetworkCall fixtures.
 */
export const test = base.extend<ScriptureNavFixtures>({
  scriptureNav: async ({ page }, use) => {
    const fixture: ScriptureNavFixture = {
      ensureOverview: async () => {
        await ensureScriptureOverview(page);
      },
      startSoloSession: async () => startSoloSession(page),
      advanceOneStep: async () => advanceOneStep(page),
      completeAllSteps: async (bookmarkSteps = new Set([0, 5, 12])) =>
        completeAllStepsToReflectionSummary(page, bookmarkSteps),
      submitSummary: async () => submitReflectionSummary(page),
      completeSession: async () => {
        await submitReflectionSummary(page);
        await skipMessageAndCompleteSession(page);
      },
    };

    await use(fixture);
  },
});
