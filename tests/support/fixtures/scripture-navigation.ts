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
} from '../helpers';
import type { InterceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures';
import type { Page } from '@playwright/test';

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
   * Advance one full step (verse → reflection → next verse).
   * @param rating - Rating to select (1-5), defaults to 3
   */
  advanceOneStep: (rating?: number) => Promise<void>;

  /**
   * Complete all 17 steps to reach reflection summary.
   * @param bookmarkSteps - Set of step indices (0-16) to bookmark
   * @returns Session ID
   */
  completeAllSteps: (bookmarkSteps?: Set<number>) => Promise<string>;

  /**
   * Submit the reflection summary form.
   */
  submitSummary: () => Promise<void>;
};

type ScriptureNavFixtures = {
  scriptureNav: ScriptureNavFixture;
};

/**
 * Scripture navigation fixture.
 * Requires page and interceptNetworkCall fixtures.
 */
export const test = base.extend<ScriptureNavFixtures>({
  scriptureNav: async ({ page, interceptNetworkCall }, use) => {
    const fixture: ScriptureNavFixture = {
      ensureOverview: async () => ensureScriptureOverview(page),
      startSoloSession: async () => startSoloSession(page, interceptNetworkCall),
      advanceOneStep: async (rating = 3) => advanceOneStep(page, interceptNetworkCall, rating),
      completeAllSteps: async (bookmarkSteps = new Set([0, 5, 12])) =>
        completeAllStepsToReflectionSummary(page, interceptNetworkCall, bookmarkSteps),
      submitSummary: async () => submitReflectionSummary(page, interceptNetworkCall),
    };

    await use(fixture);
  },
});
