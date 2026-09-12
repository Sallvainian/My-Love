/**
 * DW-57: the API precondition behind stale edit/delete Refresh events controls.
 * A creator's row is really deleted before the stale write reaches PostgREST.
 * Component lifetime itself is asserted in EventsSettings.lifetime.test.tsx.
 *
 * Existing events-write-wire-shape tests cover partner RLS filtering instead.
 * All requests below use the owning worker's auth token; coupleEvents provides
 * generated row IDs, anchored dates, and cleanup limited to that worker pair.
 * There is no events response schema; assertions cover the fields under test.
 */
import { log } from '@seontechnologies/playwright-utils';
import type { Database } from '../../src/types/database.types';
import { test, expect } from '../support/merged-fixtures';

type EventRow = Database['public']['Tables']['events']['Row'];
type EventUpdate = Database['public']['Tables']['events']['Update'];
type EventRead = Pick<EventRow, 'id' | 'user_id' | 'label' | 'event_date'>;

const READ_COLUMNS = 'id,user_id,label,event_date';

test.describe('DW-57 stale-row refresh API preconditions', () => {
  test('[P1] DW-57-API-001 creator PATCH returns zero rows after deletion and refresh retains the witness', async ({
    apiRequest,
    authToken,
    coupleEvents,
  }) => {
    await log.step('Seed an owned event and a surviving refresh witness');
    const [removed, witness] = await coupleEvents.seed([
      { label: 'DW57 API edit stale row', dayOffset: 14 },
      { label: 'DW57 API edit surviving row', dayOffset: 21 },
    ]);
    const headers = {
      Authorization: `Bearer ${authToken}`,
      Prefer: 'return=representation',
    };
    const writePath = `/rest/v1/events?id=eq.${removed.id}&select=*`;
    const edit: EventUpdate = { label: 'DW57 API creator edit' };

    await log.step('Prove the creator can edit the existing row before removing it');
    const accepted = await apiRequest<EventRow[]>({
      method: 'PATCH',
      path: writePath,
      headers,
      body: edit,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual([
      expect.objectContaining({ id: removed.id, user_id: coupleEvents.userId, label: edit.label }),
    ]);

    const deletion = await apiRequest<EventRow[]>({
      method: 'DELETE',
      path: writePath,
      headers,
    });
    expect(deletion.status).toBe(200);
    expect(deletion.body).toEqual([
      expect.objectContaining({ id: removed.id, user_id: coupleEvents.userId }),
    ]);

    await log.step('Submit a stale creator edit after the successful deletion');
    const staleEdit = await apiRequest<EventRow[]>({
      method: 'PATCH',
      path: writePath,
      headers,
      body: { label: 'DW57 API stale edit must not reappear' } satisfies EventUpdate,
    });
    expect(staleEdit.status).toBe(200);
    expect(staleEdit.body).toEqual([]);

    await log.step('Refresh as the creator and observe only the unchanged witness');
    const refreshed = await apiRequest<EventRead[]>({
      method: 'GET',
      path: `/rest/v1/events?select=${READ_COLUMNS}&id=in.(${removed.id},${witness.id})`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body).toEqual([{
      id: witness.id,
      user_id: coupleEvents.userId,
      label: witness.label,
      event_date: witness.eventDate,
    }]);
  });

  test('[P1] DW-57-API-002 creator DELETE returns zero rows after deletion and refresh retains the witness', async ({
    apiRequest,
    authToken,
    coupleEvents,
  }) => {
    await log.step('Seed an owned event and a surviving refresh witness');
    const [removed, witness] = await coupleEvents.seed([
      { label: 'DW57 API delete stale row', dayOffset: 14 },
      { label: 'DW57 API delete surviving row', dayOffset: 21 },
    ]);
    const headers = {
      Authorization: `Bearer ${authToken}`,
      Prefer: 'return=representation',
    };
    const writePath = `/rest/v1/events?id=eq.${removed.id}&select=*`;

    await log.step('Delete the owned row and confirm the creator affected exactly that row');
    const deletion = await apiRequest<EventRow[]>({
      method: 'DELETE',
      path: writePath,
      headers,
    });
    expect(deletion.status).toBe(200);
    expect(deletion.body).toEqual([
      expect.objectContaining({ id: removed.id, user_id: coupleEvents.userId }),
    ]);

    await log.step('Submit a stale creator delete against the now missing row');
    const staleDelete = await apiRequest<EventRow[]>({
      method: 'DELETE',
      path: writePath,
      headers,
    });
    expect(staleDelete.status).toBe(200);
    expect(staleDelete.body).toEqual([]);

    await log.step('Refresh as the creator and observe only the unchanged witness');
    const refreshed = await apiRequest<EventRead[]>({
      method: 'GET',
      path: `/rest/v1/events?select=${READ_COLUMNS}&id=in.(${removed.id},${witness.id})`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body).toEqual([{
      id: witness.id,
      user_id: coupleEvents.userId,
      label: witness.label,
      event_date: witness.eventDate,
    }]);
  });
});
