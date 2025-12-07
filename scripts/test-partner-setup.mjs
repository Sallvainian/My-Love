import { createClient } from '@supabase/supabase-js';
import { config } from '@dotenvx/dotenvx';

config();
config({ path: '.env.test', override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL;
const PARTNER_EMAIL = process.env.VITE_TEST_PARTNER_EMAIL;

console.log('SUPABASE_URL:', SUPABASE_URL ? 'set' : 'missing');
console.log('SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'set' : 'missing');
console.log('TEST_EMAIL:', TEST_EMAIL);
console.log('PARTNER_EMAIL:', PARTNER_EMAIL);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const testUser = users?.users?.find((u) => u.email === TEST_EMAIL);
  const partnerUser = users?.users?.find((u) => u.email === PARTNER_EMAIL);

  console.log('Test user ID:', testUser?.id);
  console.log('Partner user ID:', partnerUser?.id);

  if (testUser && partnerUser) {
    // Check current state
    const { data: userRow, error: selectError } = await supabaseAdmin
      .from('users')
      .select('id, partner_id')
      .eq('id', testUser.id)
      .single();
    console.log('Current user row:', userRow, selectError);

    // Update partner
    const { error } = await supabaseAdmin
      .from('users')
      .update({ partner_id: partnerUser.id })
      .eq('id', testUser.id);
    console.log('Update result:', error || 'success');

    // Also update partner's partner_id
    const { error: error2 } = await supabaseAdmin
      .from('users')
      .update({ partner_id: testUser.id })
      .eq('id', partnerUser.id);
    console.log('Partner update result:', error2 || 'success');

    // Check after update
    const { data: afterUpdate } = await supabaseAdmin
      .from('users')
      .select('id, partner_id')
      .eq('id', testUser.id)
      .single();
    console.log('After update:', afterUpdate);
  }
}

main().catch(console.error);
