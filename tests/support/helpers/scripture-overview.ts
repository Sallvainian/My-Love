/**
 * Scripture Overview Test Helpers
 *
 * Shared utilities for scripture overview E2E tests.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { startSoloSession, advanceOneStep } from '../helpers';
import { clearClientScriptureCache } from './scripture-cache';
import type { TypedSupabaseClient } from '../factories';

/**
 * Create a solo session, advance to a given step, then save and exit.
 * Returns the session ID.
 */
export async function saveSoloSessionAtStep(page: Page, step: number): Promise<string> {
  const sessionId = await startSoloSession(page);

  for (let i = 1; i < step; i++) {
    await advanceOneStep(page);
  }

  await page.getByTestId('exit-button').click();
  await expect(page.getByTestId('exit-confirm-dialog')).toBeVisible();
  await page.getByTestId('save-and-exit-button').click();
  await expect(page.getByTestId('scripture-overview')).toBeVisible();

  return sessionId;
}

/**
 * Get the logged-in browser user's Supabase UUID from the page's auth token.
 * Requires the page to have navigated to the app domain.
 */
async function getBrowserUserId(page: Page): Promise<string> {
  const userId = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) {
        try {
          const session = JSON.parse(localStorage.getItem(key)!);
          return session?.user?.id ?? null;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  if (!userId) throw new Error('Could not extract browser user ID from localStorage auth token');
  return userId;
}

/**
 * Re-assign an API-seeded session to the browser's logged-in user.
 * The seeding RPC uses `auth.users ORDER BY created_at LIMIT 1` which may
 * not match the worker-specific user the browser is authenticated as.
 */
export async function adoptSessionForBrowserUser(params: {
  supabaseAdmin: TypedSupabaseClient;
  sessionId: string;
  page: Page;
}): Promise<void> {
  const { supabaseAdmin, sessionId, page } = params;

  // Ensure page is on app domain so we can read localStorage
  const currentUrl = page.url();
  if (currentUrl === 'about:blank' || currentUrl === '') {
    await page.goto('/');
  }

  const browserUserId = await getBrowserUserId(page);

  // Update session owner
  const { error: sessionError } = await supabaseAdmin
    .from('scripture_sessions')
    .update({ user1_id: browserUserId })
    .eq('id', sessionId);
  expect(sessionError).toBeNull();

  // Update bookmark owner (if any)
  const { error: bookmarkError } = await supabaseAdmin
    .from('scripture_bookmarks')
    .update({ user_id: browserUserId })
    .eq('session_id', sessionId);
  expect(bookmarkError).toBeNull();
}

/**
 * Full flow: adopt an API-seeded session, isolate it, navigate to /scripture,
 * and click "Continue" on the resume prompt to enter the active session.
 * Returns when the session's current phase screen is visible.
 */
export async function resumeApiSeededSession(params: {
  supabaseAdmin: TypedSupabaseClient;
  sessionId: string;
  page: Page;
}): Promise<void> {
  const { supabaseAdmin, sessionId, page } = params;
  await adoptSessionForBrowserUser({ supabaseAdmin, sessionId, page });
  await isolateSessionForResume({ supabaseAdmin, sessionId, page });
  await page.goto('/scripture');
  await expect(page.getByTestId('resume-prompt')).toBeVisible();
  await page.getByTestId('resume-continue').click();
}

/**
 * Seed a session at reflection phase, adopt it for the browser user, isolate, and resume.
 * One-call convenience for reflection tests that need API-seeded setup.
 * Returns the session ID and seed result for cleanup.
 */
export async function seedAndResumeAtReflection(params: {
  supabaseAdmin: TypedSupabaseClient;
  page: Page;
  bookmarkSteps: number[];
}): Promise<{ sessionId: string; sessionIds: string[] }> {
  const { createTestSession } = await import('../factories');
  const seedResult = await createTestSession(params.supabaseAdmin, {
    preset: 'at_reflection',
    bookmarkSteps: params.bookmarkSteps,
  });
  const sessionId = seedResult.session_ids[0];
  await resumeApiSeededSession({
    supabaseAdmin: params.supabaseAdmin,
    sessionId,
    page: params.page,
  });
  return { sessionId, sessionIds: seedResult.session_ids };
}

/**
 * Isolate a specific session as the only resumable candidate for the worker user.
 * 3-step pattern: (1) abandon competing sessions, (2) prioritize via started_at,
 * (3) clear client cache.
 *
 * For API-seeded sessions, call `adoptSessionForBrowserUser` first.
 */
export async function isolateSessionForResume(params: {
  supabaseAdmin: TypedSupabaseClient;
  sessionId: string;
  page: Page;
}): Promise<void> {
  const { supabaseAdmin, sessionId, page } = params;

  // Look up the owning user
  const { data: targetSession, error: targetSessionError } = await supabaseAdmin
    .from('scripture_sessions')
    .select('user1_id')
    .eq('id', sessionId)
    .single();
  expect(targetSessionError).toBeNull();

  // Abandon competing in_progress solo sessions for this user
  const { error: isolateSessionError } = await supabaseAdmin
    .from('scripture_sessions')
    .update({ status: 'abandoned' })
    .eq('user1_id', targetSession!.user1_id)
    .eq('mode', 'solo')
    .eq('status', 'in_progress')
    .neq('id', sessionId);
  expect(isolateSessionError).toBeNull();

  // Make this session the newest candidate for resume lookup
  const { error: prioritizeSessionError } = await supabaseAdmin
    .from('scripture_sessions')
    .update({ started_at: '2099-01-01T00:00:00.000Z' })
    .eq('id', sessionId);
  expect(prioritizeSessionError).toBeNull();

  // Ensure the page is on the app domain before clearing localStorage/IndexedDB.
  // API-seeded tests may still be on about:blank at this point.
  const currentUrl = page.url();
  if (currentUrl === 'about:blank' || currentUrl === '') {
    await page.goto('/');
  }

  // Clear client-side cache so active-session lookup re-reads from server
  await clearClientScriptureCache(page);
}
