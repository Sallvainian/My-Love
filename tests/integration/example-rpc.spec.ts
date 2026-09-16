/**
 * Integration Test Example: Supabase table write/read without browser overhead.
 *
 * Hits a real local Supabase instance. Import from merged-fixtures to access
 * supabaseAdmin and composed fixtures. Do NOT import from bare '@playwright/test'.
 *
 * @see _bmad/bmm/testarch/knowledge/test-levels-framework.md
 * @see _bmad/bmm/testarch/knowledge/api-testing-patterns.md
 */
import { test, expect } from '../support/merged-fixtures';

test.describe('Integration: Events table lifecycle', () => {
  test('[P2] [INT-001] events insert creates a row with the requested structure', async ({
    coupleEvents,
    supabaseAdmin,
  }) => {
    const [seeded] = await coupleEvents.seed([
      { dayOffset: 7, label: 'int-001 anniversary', icon: 'ring' },
    ]);

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', seeded.id)
      .single();

    expect(error).toBeNull();
    expect(event).toBeTruthy();
    expect(event!.user_id).toBe(coupleEvents.userId);
    expect(event!.label).toBe('int-001 anniversary');
    expect(event!.icon).toBe('ring');
    expect(event!.event_date).toBe(seeded.eventDate);
  });

  test('[P2] [INT-002] deleting an event removes the row', async ({
    coupleEvents,
    supabaseAdmin,
  }) => {
    const [seeded] = await coupleEvents.seed([
      { dayOffset: 3, label: 'int-002 to-delete', icon: 'calendar' },
    ]);

    const { error: deleteError } = await supabaseAdmin.from('events').delete().eq('id', seeded.id);
    expect(deleteError).toBeNull();

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', seeded.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(event).toBeNull();
  });
});
