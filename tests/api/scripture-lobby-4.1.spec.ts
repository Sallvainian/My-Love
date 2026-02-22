/**
 * P1 API: Scripture Lobby — Role Selection, Ready State & Solo Conversion
 *
 * Story 4.1: Lobby, Role Selection & Countdown
 * Tests role selection persistence, dual-ready countdown trigger, and solo conversion.
 *
 * Test IDs: 4.1-API-001 (P1), 4.1-API-002 (P1), 4.1-API-003 (P1)
 * Risk Links: Role assignment must be server-authoritative; countdown start must be atomic
 *
 * TDD Phase: GREEN — implementation complete (migration 20260220000001)
 */
import { test, expect } from '../support/merged-fixtures';
import {
  createTestSession,
  cleanupTestSession,
  linkTestPartners,
  unlinkTestPartners,
} from '../support/factories';
import { getUserAccessToken } from '../support/helpers/supabase';

// Type cast helper for new lobby columns not yet in database.types.ts
// Remove after running: supabase gen types typescript --local > src/types/database.types.ts
interface ScriptureSessionLobbyRow {
  user1_role: 'reader' | 'responder' | null;
  user2_role: 'reader' | 'responder' | null;
  user1_ready: boolean;
  user2_ready: boolean;
  countdown_started_at: string | null;
  current_phase: string;
  mode: string;
}

test.describe('Scripture Lobby API - Story 4.1', () => {
  // ============================================
  // 4.1-API-001: Role selection stored on session
  // Priority: P1
  // ============================================
  test.describe('[4.1-API-001] Role selection stored on session', () => {
    test('[P1] calling scripture_select_role as user1 persists user1_role in scripture_sessions', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      // GIVEN: A session and two linked partners exist
      const seedResult = await createTestSession(supabaseAdmin, { sessionCount: 1 });
      const sessionId = seedResult.session_ids[0];
      const user1Id = seedResult.test_user1_id;
      const user2Id = seedResult.test_user2_id!;

      await linkTestPartners(supabaseAdmin, user1Id, user2Id);

      const user1Token = await getUserAccessToken(supabaseAdmin, user1Id);
      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User1 calls scripture_select_role with role='reader'
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_select_role',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_role: 'reader',
          },
        });

        // THEN: RPC returns 200 with a session snapshot
        expect(response.status).toBe(200);
        expect(response.body).toBeTruthy();

        // AND: user1_role is persisted as 'reader' in the database
        // Cast via unknown — new columns not yet in database.types.ts (pending supabase gen types)
        const roleResult = await supabaseAdmin
          .from('scripture_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        const dbRow = roleResult.data as unknown as ScriptureSessionLobbyRow | null;
        const queryError = roleResult.error;

        expect(queryError).toBeNull();
        expect(dbRow).toBeTruthy();
        expect(dbRow!.user1_role).toBe('reader');

        // AND: user2_role is not affected by this call
        expect(dbRow!.user2_role).toBeNull();
      } finally {
        await unlinkTestPartners(supabaseAdmin, user1Id, user2Id);
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });

    test('[P1] calling scripture_select_role with role=responder persists correct role enum value', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      // GIVEN: A session and two linked partners exist
      const seedResult = await createTestSession(supabaseAdmin, { sessionCount: 1 });
      const sessionId = seedResult.session_ids[0];
      const user1Id = seedResult.test_user1_id;
      const user2Id = seedResult.test_user2_id!;

      await linkTestPartners(supabaseAdmin, user1Id, user2Id);

      const user1Token = await getUserAccessToken(supabaseAdmin, user1Id);
      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User1 selects role 'responder'
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_select_role',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_role: 'responder',
          },
        });

        // THEN: RPC call succeeds
        expect(response.status).toBe(200);

        // AND: user1_role is persisted as 'responder'
        const responderResult = await supabaseAdmin
          .from('scripture_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        const dbRow = responderResult.data as unknown as ScriptureSessionLobbyRow | null;
        const queryError = responderResult.error;

        expect(queryError).toBeNull();
        expect(dbRow).toBeTruthy();
        expect(dbRow!.user1_role).toBe('responder');
      } finally {
        await unlinkTestPartners(supabaseAdmin, user1Id, user2Id);
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });

    test('[P1] user2 calling scripture_select_role sets user2_role and leaves user1_role null', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      // GIVEN: A session and two linked partners exist
      const seedResult = await createTestSession(supabaseAdmin, { sessionCount: 1 });
      const sessionId = seedResult.session_ids[0];
      const user1Id = seedResult.test_user1_id;
      const user2Id = seedResult.test_user2_id!;

      await linkTestPartners(supabaseAdmin, user1Id, user2Id);

      // Use user2's token — exercises the user2_id code path in the RPC
      const user2Token = await getUserAccessToken(supabaseAdmin, user2Id);
      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User2 calls scripture_select_role with role='responder'
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_select_role',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${user2Token}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_role: 'responder',
          },
        });

        // THEN: RPC returns 200
        expect(response.status).toBe(200);

        // AND: user2_role is persisted as 'responder'
        const roleResult = await supabaseAdmin
          .from('scripture_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        const dbRow = roleResult.data as unknown as ScriptureSessionLobbyRow | null;
        const queryError = roleResult.error;

        expect(queryError).toBeNull();
        expect(dbRow).toBeTruthy();
        expect(dbRow!.user2_role).toBe('responder');

        // AND: user1_role is not affected by this call
        expect(dbRow!.user1_role).toBeNull();
      } finally {
        await unlinkTestPartners(supabaseAdmin, user1Id, user2Id);
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });

  // ============================================
  // 4.1-API-002: Both-ready triggers countdown
  // Priority: P1
  // ============================================
  test.describe('[4.1-API-002] Both-ready state triggers countdown phase', () => {
    test('[P1] when both users toggle ready, countdown_started_at is set and phase becomes countdown', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      test.setTimeout(30_000);

      // GIVEN: A session and two linked partners exist
      const seedResult = await createTestSession(supabaseAdmin, { sessionCount: 1 });
      const sessionId = seedResult.session_ids[0];
      const user1Id = seedResult.test_user1_id;
      const user2Id = seedResult.test_user2_id!;

      await linkTestPartners(supabaseAdmin, user1Id, user2Id);

      const user1Token = await getUserAccessToken(supabaseAdmin, user1Id);
      const user2Token = await getUserAccessToken(supabaseAdmin, user2Id);
      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User1 toggles ready = true
        const user1ReadyResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_toggle_ready',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_is_ready: true,
          },
        });

        // THEN: First ready call succeeds
        expect(user1ReadyResponse.status).toBe(200);

        // AND: Countdown has NOT started yet (only one user is ready)
        const afterUser1Result = await supabaseAdmin
          .from('scripture_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        const afterUser1 = afterUser1Result.data as unknown as ScriptureSessionLobbyRow | null;
        const afterUser1Error = afterUser1Result.error;

        expect(afterUser1Error).toBeNull();
        expect(afterUser1!.user1_ready).toBe(true);
        expect(afterUser1!.user2_ready).toBe(false);
        expect(afterUser1!.countdown_started_at).toBeNull();

        // WHEN: User2 also toggles ready = true
        const beforeCountdown = new Date();
        const user2ReadyResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_toggle_ready',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${user2Token}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_is_ready: true,
          },
        });

        // THEN: Second ready call succeeds
        expect(user2ReadyResponse.status).toBe(200);

        // AND: countdown_started_at is now set (server-authoritative timestamp)
        const afterBothResult = await supabaseAdmin
          .from('scripture_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        const afterBothReady = afterBothResult.data as unknown as ScriptureSessionLobbyRow | null;
        const afterBothReadyError = afterBothResult.error;

        expect(afterBothReadyError).toBeNull();
        expect(afterBothReady!.user1_ready).toBe(true);
        expect(afterBothReady!.user2_ready).toBe(true);
        expect(afterBothReady!.countdown_started_at).not.toBeNull();
        expect(afterBothReady!.current_phase).toBe('countdown');

        // AND: countdown_started_at is a recent timestamp (set during this test)
        const countdownTs = new Date(afterBothReady!.countdown_started_at!);
        expect(countdownTs.getTime()).toBeGreaterThanOrEqual(beforeCountdown.getTime() - 1000);
        expect(countdownTs.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      } finally {
        await unlinkTestPartners(supabaseAdmin, user1Id, user2Id);
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });

  // ============================================
  // 4.1-API-003: Solo conversion
  // Priority: P1
  // ============================================
  test.describe('[4.1-API-003] Solo conversion clears partner state', () => {
    test('[P1] scripture_convert_to_solo sets mode=solo and phase=reading', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      // GIVEN: A session exists (no partner required for solo conversion)
      const seedResult = await createTestSession(supabaseAdmin, { sessionCount: 1 });
      const sessionId = seedResult.session_ids[0];
      const user1Id = seedResult.test_user1_id;

      const user1Token = await getUserAccessToken(supabaseAdmin, user1Id);
      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User1 calls scripture_convert_to_solo
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_convert_to_solo',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
          },
        });

        // THEN: RPC returns success
        expect(response.status).toBe(200);

        // AND: mode is set to 'solo' in the database
        const soloResult = await supabaseAdmin
          .from('scripture_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        const dbRow = soloResult.data as unknown as ScriptureSessionLobbyRow | null;
        const queryError = soloResult.error;

        expect(queryError).toBeNull();
        expect(dbRow).toBeTruthy();
        expect(dbRow!.mode).toBe('solo');

        // AND: current_phase is 'reading' (skips lobby)
        expect(dbRow!.current_phase).toBe('reading');

        // AND: partner state is cleared
        expect(dbRow!.user2_role).toBeNull();
        expect(dbRow!.user2_ready).toBe(false);
      } finally {
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });
});
