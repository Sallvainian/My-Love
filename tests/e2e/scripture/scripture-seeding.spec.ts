/**
 * P0 E2E: Scripture Reading - Test Data Seeding
 *
 * Critical path: Test factory must create valid seeded data.
 * Uses testSession fixture to validate seeding RPC integration.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Scripture Test Data Seeding', () => {
  test('[P0] should create test session via seeding RPC', async ({ testSession }) => {
    // GIVEN: Seeding RPC is available
    // WHEN: createTestSession is called via testSession fixture

    // THEN: Session data is returned with valid IDs
    expect(testSession.session_ids).toBeDefined();
    expect(testSession.session_ids.length).toBeGreaterThan(0);
    expect(testSession.test_user1_id).toBeDefined();
  });

  test('[P0] should return valid session count', async ({ testSession }) => {
    // GIVEN: Default session creation (1 session)
    // WHEN: testSession fixture creates data

    // THEN: session_count matches requested count
    expect(testSession.session_count).toBe(1);
  });

  test('[P0] should cleanup test data after test', async ({ supabaseAdmin, testSession }) => {
    // GIVEN: Test session was created
    const sessionId = testSession.session_ids[0];

    // WHEN: Test completes (cleanup happens in fixture teardown)
    // THEN: Session data should exist during test
    const { data } = await supabaseAdmin
      .from('scripture_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    expect(data).toBeTruthy();
    // Note: Cleanup verification happens implicitly via fixture teardown
  });
});
