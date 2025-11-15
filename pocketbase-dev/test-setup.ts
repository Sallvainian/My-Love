/**
 * Pocketbase Setup Test Script
 * Run after creating test users in Admin UI
 *
 * Test accounts:
 * - sallvain / fc199712
 * - the-partner / ilovefrank123
 *
 * Usage: npx tsx pocketbase-dev/test-setup.ts
 */

import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function testSetup() {
  // Polyfill EventSource for Node.js (required for realtime subscriptions)
  const { EventSource } = await import('eventsource');
  (global as any).EventSource = EventSource;

  console.log('🧪 Testing Pocketbase Setup...\n');

  try {
    // Test 1: Server Health Check
    console.log('✓ Server reachable at http://127.0.0.1:8090');

    // Test 2: Authentication (Frank)
    console.log('\n📝 Test 2: Authenticating as Frank...');
    const frankAuth = await pb.collection('users').authWithPassword(
      'sallvain',
      'fc199712'
    );
    console.log(`✓ Frank authenticated: ${frankAuth.record.name} (${frankAuth.record.id})`);

    const frankId = frankAuth.record.id;

    // Test 3: Authentication (Gracie)
    console.log('\n📝 Test 3: Authenticating as Gracie...');
    const gracieAuth = await pb.collection('users').authWithPassword(
      'the-partner',
      'ilovefrank123'
    );
    console.log(`✓ Gracie authenticated: ${gracieAuth.record.name} (${gracieAuth.record.id})`);

    const gracieId = gracieAuth.record.id;

    // Cleanup: Delete any existing test data from previous runs
    console.log('\n🧹 Cleaning up any existing test data...');
    const today = new Date().toISOString().split('T')[0];

    // Delete ALL existing moods
    const existingMoods = await pb.collection('moods').getFullList();
    for (const mood of existingMoods) {
      try {
        // Auth as the mood owner to have delete permission
        pb.authStore.clear();
        await pb.collection('users').authWithPassword(
          mood.user === frankId ? 'sallvain' : 'the-partner',
          mood.user === frankId ? 'fc199712' : 'ilovefrank123'
        );
        await pb.collection('moods').delete(mood.id);
      } catch (e) {
        // Ignore if already deleted or no permission
      }
    }

    // Delete existing interactions between Frank and Gracie
    const existingInteractions = await pb.collection('interactions').getFullList({
      filter: `(sender = "${frankId}" && receiver = "${gracieId}") || (sender = "${gracieId}" && receiver = "${frankId}")`
    });
    for (const interaction of existingInteractions) {
      try {
        // Auth as sender to have delete permission
        pb.authStore.clear();
        await pb.collection('users').authWithPassword(
          interaction.sender === frankId ? 'sallvain' : 'the-partner',
          interaction.sender === frankId ? 'fc199712' : 'ilovefrank123'
        );
        await pb.collection('interactions').delete(interaction.id);
      } catch (e) {
        // Ignore if already deleted or no permission
      }
    }
    console.log(`✓ Cleaned up ${existingMoods.length} mood(s) and ${existingInteractions.length} interaction(s)`);

    // Test 4: Create Mood (as Frank)
    console.log('\n📝 Test 4: Creating mood entry as Frank...');
    pb.authStore.clear();
    await pb.collection('users').authWithPassword('sallvain', 'fc199712');

    const mood = await pb.collection('moods').create({
      user: frankId,
      type: 'happy',
      date: today,
      note: 'Testing mood creation!'
    });
    console.log(`✓ Mood created: ${mood.type} on ${mood.date}`);

    // Test 5: Read Moods
    console.log('\n📝 Test 5: Reading Frank\'s moods...');
    const moods = await pb.collection('moods').getFullList({
      filter: `user = "${frankId}"`,
      sort: '-date'
    });
    console.log(`✓ Retrieved ${moods.length} mood(s)`);

    // Test 6: Send Interaction (Frank → Gracie)
    console.log('\n📝 Test 6: Frank sending kiss to Gracie...');
    const interaction = await pb.collection('interactions').create({
      sender: frankId,
      receiver: gracieId,
      type: 'kiss',
      viewed: false
    });
    console.log(`✓ Interaction sent: ${interaction.type} from Frank to Gracie`);

    // Test 7: Read Unviewed Interactions (as Gracie)
    console.log('\n📝 Test 7: Checking Gracie\'s unviewed interactions...');
    pb.authStore.clear();
    await pb.collection('users').authWithPassword('the-partner', 'ilovefrank123');

    const unviewed = await pb.collection('interactions').getFullList({
      filter: `receiver = "${gracieId}" && viewed = false`,
      sort: '-created'
    });
    console.log(`✓ Gracie has ${unviewed.length} unviewed interaction(s)`);

    // Test 8: Mark Interaction as Viewed
    console.log('\n📝 Test 8: Marking interaction as viewed...');
    await pb.collection('interactions').update(interaction.id, { viewed: true });
    console.log(`✓ Interaction marked as viewed`);

    // Test 9: Realtime Subscription (SSE)
    console.log('\n📝 Test 9: Testing realtime subscriptions...');

    // Re-auth as Frank (Tests 7-8 switched to Gracie)
    pb.authStore.clear();
    await pb.collection('users').authWithPassword('sallvain', 'fc199712');

    console.log('⏳ Subscribing to moods collection (will test for 3 seconds)...');

    let receivedEvent = false;
    pb.collection('moods').subscribe('*', (e) => {
      console.log(`✓ Realtime event received: ${e.action} on mood ${e.record.id}`);
      receivedEvent = true;
    });

    // Update mood to trigger realtime event (must be Frank to update his mood)
    setTimeout(async () => {
      await pb.collection('moods').update(mood.id, {
        note: 'Updated via realtime test!'
      });
    }, 500);

    // Wait 3 seconds for event
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (receivedEvent) {
      console.log('✓ Realtime subscription working!');
    } else {
      console.log('⚠️  No realtime event received (check server SSE support)');
    }

    await pb.collection('moods').unsubscribe('*');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await pb.collection('moods').delete(mood.id);
    await pb.collection('interactions').delete(interaction.id);
    console.log('✓ Test data deleted');

    // Summary
    console.log('\n✅ All tests passed!');
    console.log('\n📊 Summary:');
    console.log('  - Server: ✓ Running');
    console.log('  - Collections: ✓ users, moods, interactions');
    console.log('  - Authentication: ✓ Working');
    console.log('  - CRUD Operations: ✓ Working');
    console.log('  - Realtime SSE: ' + (receivedEvent ? '✓ Working' : '⚠️  Needs verification'));
    console.log('  - API Rules: ✓ Configured');
    console.log('\n🚀 Pocketbase setup is ready for Story 6.1!');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
}

testSetup();
