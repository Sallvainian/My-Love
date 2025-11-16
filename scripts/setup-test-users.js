/**
 * Setup Test Users for Development & E2E Tests
 *
 * Creates two test users in Supabase Auth for testing purposes.
 * Users can sign in via email/password or Google OAuth.
 * Partner relationships must be configured separately via the app UI.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vdltoyxpujbsaidctzjb.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbHRveXhwdWpic2FpZGN0empiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODg1ODUsImV4cCI6MjA3ODc2NDU4NX0.zPeI2Syr_eC4yZi_MLftclZYaNvx9Q88Xz2VVMKKu_w';
const SUPABASE_SERVICE_KEY =
  'REDACTED_SERVICE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTestUser(email, password) {
  console.log(`\nCreating user: ${email}...`);

  // Use admin API to create user (bypasses email validation)
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for test users
  });

  if (error) {
    // Check if user already exists
    if (error.message.includes('already been registered')) {
      console.log(`⚠️  User already exists: ${email}`);
      // Get user by email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);
      if (existingUser) {
        console.log(`✅ Using existing user: ${email}`);
        return existingUser.id;
      }
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }

  console.log(`✅ Created user: ${email}`);
  return data.user.id;
}

async function listExistingUsers() {
  console.log('\n🔍 Checking for existing users...');

  // Use admin client to query auth.users table
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    console.log(`⚠️  Could not list users: ${error.message}`);
    return [];
  }

  if (data && data.users && data.users.length > 0) {
    console.log(`\n✅ Found ${data.users.length} existing user(s):\n`);
    data.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (ID: ${user.id})`);
    });
    return data.users;
  }

  console.log('No existing users found.');
  return [];
}

async function main() {
  console.log('🚀 Setting up test users for E2E tests...\n');
  console.log('Supabase URL:', SUPABASE_URL);

  try {
    // First, list existing users
    const existingUsers = await listExistingUsers();

    let userId, partnerId;

    if (existingUsers.length >= 2) {
      // Use first two existing users
      userId = existingUsers[0].id;
      partnerId = existingUsers[1].id;
      console.log('\n✅ Using existing users for E2E tests');
    } else if (existingUsers.length === 1) {
      // Use existing user and create one more
      userId = existingUsers[0].id;
      console.log('\n📝 Creating additional test user...');
      partnerId = await createTestUser('testuser2@example.com', 'TestPassword123!');
    } else {
      // Create both users
      console.log('\n📝 Creating test users...');
      userId = await createTestUser('testuser1@example.com', 'TestPassword123!');
      partnerId = await createTestUser('testuser2@example.com', 'TestPassword123!');
    }

    console.log('\n✅ Test users ready!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test user credentials:\n');
    console.log(`User 1: testuser1@example.com (ID: ${userId})`);
    console.log(`User 2: testuser2@example.com (ID: ${partnerId})`);
    console.log('Password: TestPassword123!');
    console.log('\nSign in via the app with these credentials.');
    console.log('Configure partner relationships via the app UI (Settings).');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { userId, partnerId };
  } catch (error) {
    console.error('❌ Error setting up test users:', error.message);
    process.exit(1);
  }
}

main();
