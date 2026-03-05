/**
 * Integration Test Example: Supabase RPC Business Logic
 *
 * Integration tests validate server-side business logic (RPCs, RLS policies,
 * cross-table operations) without browser overhead. They hit a real local
 * Supabase instance but don't render any UI.
 *
 * Import from merged-fixtures to access supabaseAdmin, apiRequest, and all
 * composed fixtures. Do NOT import from bare '@playwright/test'.
 *
 * @see _bmad/bmm/testarch/knowledge/test-levels-framework.md
 * @see _bmad/bmm/testarch/knowledge/api-testing-patterns.md
 */
import { test, expect } from '../support/merged-fixtures';
import { createTestSession, cleanupTestSession } from '../support/factories';

test.describe('Integration: Scripture Session Lifecycle', () => {
  test('scripture_seed_test_data RPC creates session with correct structure', async ({
    supabaseAdmin,
  }) => {
    // GIVEN: A clean test environment
    // WHEN: We seed a test session via RPC
    const result = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });

    try {
      // THEN: Seed result contains expected structure
      expect(result.session_ids).toHaveLength(1);
      expect(result.session_count).toBe(1);
      expect(result.preset).toBe('mid_session');
      expect(result.test_user1_id).toBeTruthy();

      // AND: Session exists in database with correct state
      const { data: session, error } = await supabaseAdmin
        .from('scripture_sessions')
        .select('*')
        .eq('id', result.session_ids[0])
        .single();

      expect(error).toBeNull();
      expect(session).toBeTruthy();
      expect(session!.user1_id).toBe(result.test_user1_id);
    } finally {
      await cleanupTestSession(supabaseAdmin, result.session_ids);
    }
  });

  test('cleanup removes all related data in FK order', async ({ supabaseAdmin }) => {
    // GIVEN: A seeded session with reflections and messages
    const result = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      includeReflections: true,
      includeMessages: true,
    });

    const sessionId = result.session_ids[0];

    // WHEN: We clean up the session
    await cleanupTestSession(supabaseAdmin, result.session_ids);

    // THEN: Session no longer exists
    const { data: session } = await supabaseAdmin
      .from('scripture_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    expect(session).toBeNull();

    // AND: Related step states are also cleaned up
    const { data: steps } = await supabaseAdmin
      .from('scripture_step_states')
      .select('id')
      .eq('session_id', sessionId);

    expect(steps).toHaveLength(0);
  });
});
