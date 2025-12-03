/**
 * Partner Setup Helper for E2E Tests
 *
 * Provides utilities for setting up partner relationships programmatically
 * using the Supabase Admin API. This enables multi-user E2E tests without
 * requiring manual partner setup via the app UI.
 *
 * Usage:
 * - Call `ensurePartnerRelationship()` in test beforeAll to guarantee partnership
 * - Uses admin client to bypass RLS for test setup
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase admin client for test setup (bypasses RLS)
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get or create Supabase admin client for test operations
 */
function getAdminClient(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing required environment variables for admin client: ' +
        'VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY are required'
    );
  }

  supabaseAdmin = createClient(supabaseUrl, serviceKey);
  return supabaseAdmin;
}

/**
 * Get user ID by email address using admin API
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const admin = getAdminClient();

  const { data: users, error } = await admin.auth.admin.listUsers();

  if (error) {
    console.error('[PartnerSetup] Error listing users:', error);
    return null;
  }

  const user = users?.users?.find((u) => u.email === email);
  return user?.id || null;
}

/**
 * Check if two users are already partners
 */
export async function areUsersPartners(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('users')
    .select('partner_id')
    .eq('id', userId1)
    .single();

  if (error) {
    console.error('[PartnerSetup] Error checking partnership:', error);
    return false;
  }

  return data?.partner_id === userId2;
}

/**
 * Create partner relationship directly via database
 *
 * This function bypasses the normal request/accept flow for test setup.
 * It creates a partner request and accepts it atomically using the RPC function.
 */
export async function createPartnerRelationship(
  fromUserId: string,
  toUserId: string
): Promise<void> {
  const admin = getAdminClient();

  // First check if already partners
  if (await areUsersPartners(fromUserId, toUserId)) {
    console.log('[PartnerSetup] Users are already partners');
    return;
  }

  // Check for existing pending request
  const { data: existingRequest } = await admin
    .from('partner_requests')
    .select('id, status')
    .or(`from_user_id.eq.${fromUserId},from_user_id.eq.${toUserId}`)
    .or(`to_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}`)
    .eq('status', 'pending')
    .maybeSingle();

  let requestId: string;

  if (existingRequest) {
    requestId = existingRequest.id;
    console.log('[PartnerSetup] Using existing pending request:', requestId);
  } else {
    // Create new partner request
    const { data: newRequest, error: insertError } = await admin
      .from('partner_requests')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create partner request: ${insertError.message}`);
    }

    requestId = newRequest.id;
    console.log('[PartnerSetup] Created partner request:', requestId);
  }

  // Accept the request using the RPC function
  const { error: acceptError } = await admin.rpc('accept_partner_request', {
    p_request_id: requestId,
  });

  if (acceptError) {
    throw new Error(`Failed to accept partner request: ${acceptError.message}`);
  }

  console.log('[PartnerSetup] Partner relationship established successfully');
}

/**
 * Ensure partner relationship exists between test users
 *
 * This is the main function to call in beforeAll hooks.
 * It handles all the complexity of checking and creating partnerships.
 *
 * @param primaryEmail - Email of the primary test user
 * @param partnerEmail - Email of the partner test user
 * @returns Object with both user IDs
 */
export async function ensurePartnerRelationship(
  primaryEmail: string,
  partnerEmail: string
): Promise<{ primaryUserId: string; partnerUserId: string }> {
  console.log('[PartnerSetup] Ensuring partner relationship...');
  console.log(`  Primary: ${primaryEmail}`);
  console.log(`  Partner: ${partnerEmail}`);

  // Get user IDs
  const primaryUserId = await getUserIdByEmail(primaryEmail);
  const partnerUserId = await getUserIdByEmail(partnerEmail);

  if (!primaryUserId) {
    throw new Error(`Primary user not found: ${primaryEmail}`);
  }

  if (!partnerUserId) {
    throw new Error(`Partner user not found: ${partnerEmail}`);
  }

  // Create relationship if needed
  await createPartnerRelationship(primaryUserId, partnerUserId);

  return { primaryUserId, partnerUserId };
}

/**
 * Remove partner relationship (for cleanup in tests)
 *
 * Note: This requires careful handling as it affects both users' records.
 */
export async function removePartnerRelationship(
  userId1: string,
  userId2: string
): Promise<void> {
  const admin = getAdminClient();

  // Update both users to remove partner_id
  const { error: error1 } = await admin
    .from('users')
    .update({ partner_id: null })
    .eq('id', userId1);

  if (error1) {
    console.warn('[PartnerSetup] Error removing partner from user 1:', error1);
  }

  const { error: error2 } = await admin
    .from('users')
    .update({ partner_id: null })
    .eq('id', userId2);

  if (error2) {
    console.warn('[PartnerSetup] Error removing partner from user 2:', error2);
  }

  console.log('[PartnerSetup] Partner relationship removed');
}
