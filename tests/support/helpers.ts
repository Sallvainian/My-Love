/**
 * Shared Test Helpers
 *
 * Reusable helpers for E2E tests. Import from this file
 * to avoid duplicating navigation and session setup logic.
 *
 * IMPORTANT: The scripture reading flow per-step is:
 *   verse screen → (click "Next Verse") → reflection screen → (rate + click Continue) → next verse screen
 * "Next Verse" does NOT advance the step directly — it transitions to the reflection sub-view.
 * Only submitting the reflection (rating + Continue) advances the step.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

type ScriptureEntryState = 'overview' | 'active-flow';

const AUTH_READINESS_MAX_ATTEMPTS = 5;
const AUTH_READINESS_RETRY_MS = 300;
const NETWORK_DIAGNOSTIC_TIMEOUT_MS = 12_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSupabaseAuthContext(page: Page): Promise<{
  apiUrl: string;
  anonKey: string;
  accessToken: string;
} | null> {
  const apiUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!apiUrl || !anonKey) {
    return null;
  }

  const accessToken = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.includes('auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as unknown;

        if (
          parsed &&
          typeof parsed === 'object' &&
          'access_token' in parsed &&
          typeof (parsed as { access_token?: unknown }).access_token === 'string'
        ) {
          return (parsed as { access_token: string }).access_token;
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0] as { access_token?: unknown };
          if (typeof first?.access_token === 'string') {
            return first.access_token;
          }
        }

        if (
          parsed &&
          typeof parsed === 'object' &&
          'currentSession' in parsed &&
          (parsed as { currentSession?: unknown }).currentSession &&
          typeof (parsed as { currentSession: { access_token?: unknown } }).currentSession
            .access_token === 'string'
        ) {
          return (parsed as { currentSession: { access_token: string } }).currentSession
            .access_token;
        }
      } catch {
        // Ignore malformed localStorage entries and continue searching.
      }
    }

    return null;
  });

  if (!accessToken) {
    return null;
  }

  return { apiUrl, anonKey, accessToken };
}

async function waitForAuthReadiness(page: Page): Promise<void> {
  const diagnostics: string[] = [];

  for (let attempt = 1; attempt <= AUTH_READINESS_MAX_ATTEMPTS; attempt++) {
    const authContext = await getSupabaseAuthContext(page);
    if (!authContext) {
      diagnostics.push(`attempt ${attempt}: missing auth context`);
      await sleep(AUTH_READINESS_RETRY_MS * attempt);
      continue;
    }

    const response = await page.request
      .get(`${authContext.apiUrl}/auth/v1/user`, {
        headers: {
          apikey: authContext.anonKey,
          Authorization: `Bearer ${authContext.accessToken}`,
        },
      })
      .catch(() => null);

    if (response?.ok()) {
      return;
    }

    diagnostics.push(`attempt ${attempt}: status ${response?.status() ?? 'network-error'}`);
    await sleep(AUTH_READINESS_RETRY_MS * attempt);
  }

  throw new Error(
    `[startSoloSession] Auth readiness failed after ${AUTH_READINESS_MAX_ATTEMPTS} attempts (${diagnostics.join(
      '; '
    )})`
  );
}

async function getLatestInProgressSoloSessionId(page: Page): Promise<string | null> {
  const authContext = await getSupabaseAuthContext(page);
  if (!authContext) {
    return null;
  }

  const response = await page.request.get(
    `${authContext.apiUrl}/rest/v1/scripture_sessions?select=id,status,mode,current_step_index&status=eq.in_progress&mode=eq.solo&order=started_at.desc&limit=1`,
    {
      headers: {
        apikey: authContext.anonKey,
        Authorization: `Bearer ${authContext.accessToken}`,
      },
    }
  );

  if (!response.ok()) {
    return null;
  }

  const payload = (await response.json()) as Array<{ id?: string }>;
  return typeof payload?.[0]?.id === 'string' ? payload[0].id : null;
}

async function normalizeOverviewFromActiveFlow(page: Page): Promise<void> {
  await expect(page.getByTestId('solo-reading-flow')).toBeVisible();

  await page.getByTestId('exit-button').click();
  await expect(page.getByTestId('exit-confirm-dialog')).toBeVisible();
  await page.getByTestId('save-and-exit-button').click();
  await expect(page.getByTestId('scripture-overview')).toBeVisible();

  const resumePrompt = page.getByTestId('resume-prompt');
  if (await resumePrompt.isVisible()) {
    const abandonPromise = page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/rest/v1/scripture_sessions') &&
          resp.request().method() === 'PATCH' &&
          resp.status() >= 200 &&
          resp.status() < 300,
        { timeout: NETWORK_DIAGNOSTIC_TIMEOUT_MS }
      )
      .catch(() => null);

    await page.getByTestId('resume-start-fresh').click();
    await abandonPromise;
  }

  await expect(page.getByTestId('scripture-start-button')).toBeVisible();
  await expect(page.getByTestId('scripture-start-button')).toBeEnabled();
}

/**
 * Navigate to /scripture and ensure Start button is visible.
 *
 * Uses the fresh-start query param to bypass resume prompts and
 * force the overview start state deterministically.
 *
 * @param page - Playwright page
 */
export async function ensureScriptureOverview(page: Page): Promise<ScriptureEntryState> {
  // Defensive reset: a prior test may have toggled context offline.
  await page.context().setOffline(false);

  await page.goto('/scripture?fresh=true');

  const startButton = page.getByTestId('scripture-start-button');
  const readingFlow = page.getByTestId('solo-reading-flow');

  try {
    const state = await Promise.any<ScriptureEntryState>([
      startButton
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'overview' as const),
      readingFlow
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'active-flow' as const),
    ]);

    if (state === 'overview') {
      await expect(startButton).toBeEnabled();
    } else {
      await expect(readingFlow).toBeVisible();
    }

    return state;
  } catch {
    const diagnostics = {
      startButtonVisible: await startButton.isVisible(),
      readingFlowVisible: await readingFlow.isVisible(),
      overviewVisible: await page.getByTestId('scripture-overview').isVisible(),
      resumePromptVisible: await page.getByTestId('resume-prompt').isVisible(),
      sessionLoadingVisible: await page.getByTestId('session-loading').isVisible(),
    };

    throw new Error(
      `[ensureScriptureOverview] Could not resolve scripture entry state after /scripture?fresh=true: ${JSON.stringify(
        diagnostics
      )}`
    );
  }
}

/**
 * Start a solo scripture session from the overview.
 *
 * Navigates to /scripture, handles stale sessions, clicks Start → Solo,
 * and waits for the session creation API to complete.
 *
 * @param page - Playwright page
 */
export async function startSoloSession(page: Page): Promise<string> {
  const entryState = await ensureScriptureOverview(page);

  if (entryState === 'active-flow') {
    await normalizeOverviewFromActiveFlow(page);
  }

  await waitForAuthReadiness(page);

  const responsePromise = page
    .waitForResponse(
      (resp) => resp.url().includes('/rest/v1/rpc/scripture_create_session'),
      { timeout: NETWORK_DIAGNOSTIC_TIMEOUT_MS }
    )
    .catch(() => null);

  await expect(page.getByTestId('scripture-start-button')).toBeEnabled();
  await page.getByTestId('scripture-start-button').click();
  await expect(page.getByTestId('scripture-mode-solo')).toBeVisible();
  await expect(page.getByTestId('scripture-mode-solo')).toBeEnabled();
  await page.getByTestId('scripture-mode-solo').click();

  // Primary success signal: deterministic UI readiness.
  await expect(page.getByTestId('solo-reading-flow')).toBeVisible();

  const response = await responsePromise;
  if (response) {
    if (response.ok()) {
      const data = (await response.json()) as { id?: string };
      if (typeof data?.id === 'string') {
        return data.id;
      }
    } else {
      console.warn(
        `[startSoloSession] scripture_create_session returned ${response.status()} (${response.statusText()})`
      );
    }
  } else {
    console.warn(
      '[startSoloSession] scripture_create_session response was not observed within diagnostic timeout'
    );
  }

  const fallbackSessionId = await getLatestInProgressSoloSessionId(page);
  if (fallbackSessionId) {
    return fallbackSessionId;
  }

  throw new Error(
    '[startSoloSession] solo-reading-flow became visible, but session id could not be resolved from network response or fallback lookup'
  );
}

/**
 * Advance one full step in the scripture reading flow.
 *
 * The flow is: verse → (click Next Verse) → reflection → (rate + Continue) → next verse.
 * This helper completes one full cycle: clicks Next Verse, rates, and submits.
 *
 * @param page - Playwright page
 * @param rating - Rating to select (1-5), defaults to 3
 */
export async function advanceOneStep(page: Page, rating: number = 3) {
  // Click Next Verse → transitions to reflection sub-view
  await page.getByTestId('scripture-next-verse-button').click();

  // Wait for reflection screen
  await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

  // Select rating
  await page.getByTestId(`scripture-rating-${rating}`).click();

  // Wait for reflection submission to complete
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/rpc/scripture_submit_reflection') && resp.status() === 200
  );

  await page.getByTestId('scripture-reflection-continue').click();

  await responsePromise;

  // Wait for next verse screen to appear
  await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
}

/**
 * Complete all 17 scripture steps to reach the reflection summary screen.
 *
 * Navigates through start → solo → 17 verse/reflection cycles.
 * Optionally bookmarks specific steps along the way.
 *
 * @param page - Playwright page
 * @param bookmarkSteps - Set of step indices (0-16) to bookmark during navigation
 * @returns Session ID
 */
export async function completeAllStepsToReflectionSummary(
  page: Page,
  bookmarkSteps: Set<number> = new Set([0, 5, 12])
): Promise<string> {
  // Start solo session (handles stale sessions from previous runs)
  const sessionId = await startSoloSession(page);

  // Complete all 17 steps (indices 0-16)
  for (let step = 0; step < 17; step++) {
    // Wait for verse screen
    await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

    // Optionally bookmark this verse
    if (bookmarkSteps.has(step)) {
      await page.getByTestId('scripture-bookmark-button').click();
      await expect(page.getByTestId('scripture-bookmark-button')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    }

    // Advance to reflection screen
    await page.getByTestId('scripture-next-verse-button').click();
    await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

    // Select a rating and submit reflection
    await page.getByTestId('scripture-rating-3').click();

    // Wait for reflection submission to complete
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/rest/v1/rpc/scripture_submit_reflection') && resp.status() === 200
    );

    await page.getByTestId('scripture-reflection-continue').click();

    await responsePromise;
  }

  // After step 17 (index 16) reflection, the reflection summary should appear
  return sessionId;
}

/**
 * Submit the reflection summary form to advance past it.
 *
 * Selects a standout verse, a session rating, and clicks Continue
 * with a network-first wait pattern. Used by Story 2.3 tests that
 * need to reach the report phase (post-reflection-summary).
 *
 * @param page - Playwright page
 */
export async function submitReflectionSummary(page: Page): Promise<void> {
  await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();

  // Select a standout verse (step 0)
  await page.getByTestId('scripture-standout-verse-0').click();
  await expect(page.getByTestId('scripture-standout-verse-0')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // Select session rating 4
  await page.getByTestId('scripture-session-rating-4').click();
  await expect(page.getByTestId('scripture-session-rating-4')).toHaveAttribute(
    'aria-checked',
    'true'
  );

  // Submit the reflection summary — wait for server response
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/rpc/scripture_submit_reflection') && resp.status() === 200
  );

  await page.getByTestId('scripture-reflection-summary-continue').click();

  await responsePromise;
}
