/**
 * Story 3.8: opening Love Notes writes the account's read marker on the server,
 * and the push badge counts only the partner notes that arrive after it.
 *
 * The badge itself is computed by `unread_love_note_count`, which the sender
 * calls and puts in `aps.badge`. This project has no edge runtime, so the spec
 * reads the same SQL function the sender reads, as service_role, in place of a
 * push: the count the next partner note would carry. `tests/api/
 * push-love-note-trigger.spec.ts` ("Badge") proves the sender end of it.
 *
 * The website writes the marker too (the RPC runs on every surface); only the
 * badge clear is native, so there is nothing to assert about it here.
 *
 * Identities are this worker's own pair. Teardown deletes only the two notes
 * this test inserted (by their unique content) and the user's marker row.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import { recurseUntil } from '../../support/helpers/recurse';
import { LOVE_NOTES_READ } from '../../support/helpers/reads';

test.describe('Love Notes read marker', () => {
  test('[P1] 3.8-E2E-001 opening Love Notes writes the marker, and the next partner note counts as one', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const runId = randomUUID();
    const firstText = `3.8 unread before opening ${runId}`;
    const secondText = `3.8 unread after opening ${runId}`;
    cleanup.defer('remove this test\'s notes and the user\'s marker', async () => {
      await supabaseAdmin
        .from('love_notes')
        .delete()
        .in('content', [firstText, secondText])
        .in('from_user_id', [userId, partnerId]);
      await supabaseAdmin.from('love_notes_read_markers').delete().eq('user_id', userId);
    });

    const insertPartnerNote = async (content: string) => {
      const { data, error } = await supabaseAdmin
        .from('love_notes')
        .insert({ from_user_id: partnerId, to_user_id: userId, content, idempotency_key: randomUUID() })
        .select('id, created_at')
        .single();
      expect(error).toBeNull();
      return data!;
    };
    const readMarker = async () => {
      const { data, error } = await supabaseAdmin
        .from('love_notes_read_markers')
        .select('last_opened_at')
        .eq('user_id', userId)
        .maybeSingle();
      expect(error).toBeNull();
      return data?.last_opened_at ?? null;
    };

    // GIVEN: the partner has sent a note the user has not opened, and there is no marker yet.
    await supabaseAdmin.from('love_notes_read_markers').delete().eq('user_id', userId);
    const first = await insertPartnerNote(firstText);
    const unread = await supabaseAdmin.rpc('unread_love_note_count', { p_user_id: userId });
    expect(unread.error).toBeNull();
    expect(unread.data).toBeGreaterThanOrEqual(1);

    // WHEN: the user opens Love Notes on the website.
    const thread = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
    await page.goto('/notes');
    await thread;
    await expect(page.getByTestId('love-note-message').getByText(firstText)).toBeVisible();

    // THEN: the server holds a marker later than that note.
    await recurseUntil(readMarker, (marker) => {
      expect(marker, 'the marker is written after the note was delivered').not.toBeNull();
      expect(new Date(marker!).getTime()).toBeGreaterThan(new Date(first.created_at).getTime());
    });

    // Leave the screen, and let any mark still in flight land, so a late one
    // cannot move the marker past the note inserted next.
    await navigateTo(page, 'home');
    await page.waitForLoadState('networkidle');

    // AND: the next partner note is the only unread one, the count the sender would put in aps.badge.
    await insertPartnerNote(secondText);
    const afterwards = await supabaseAdmin.rpc('unread_love_note_count', { p_user_id: userId });
    expect(afterwards.error).toBeNull();
    expect(afterwards.data).toBe(1);
  });
});
