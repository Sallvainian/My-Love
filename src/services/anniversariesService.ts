/**
 * Anniversaries Service — the signed-in user's anniversary countdowns
 * (`public.anniversaries`)
 *
 * Supabase is the source of truth; `settings.relationship.anniversaries` is a
 * read mirror that `settingsSlice` keeps in step after every successful write
 * and replaces wholesale from `fetchAnniversaries` once this device's one-time
 * upload has completed (`localDataUpload.ts`).
 *
 * Private to the author: the table's RLS admits the owner only, so nothing here
 * filters for a partner. Writes are server-first and throw — see
 * `accountDataError.ts` for the error convention, which follows `eventsService`.
 *
 * `event_date` is a Postgres `date` and comes back as a bare `"YYYY-MM-DD"`,
 * which is exactly the shape `Anniversary.date` already carries, so it is
 * passed through as a string and never through `new Date(...)`.
 *
 * @module services/anniversariesService
 */

import type { Database } from '../api/supabaseClient';
import { supabase } from '../api/supabaseClient';
import { logger } from '../utils/logger';
import { AccountDataError, requireOnline, toAccountDataError } from './accountDataError';
import { parseEventDate } from './eventsService';

export type SupabaseAnniversaryRecord = Database['public']['Tables']['anniversaries']['Row'];
export type AnniversaryInsert = Database['public']['Tables']['anniversaries']['Insert'];

/** What a caller writes. `date` is a bare `"YYYY-MM-DD"`. */
export interface AnniversaryInput {
  date: string;
  label: string;
  description?: string;
}

/** A server row in the app's shape. */
export interface ServerAnniversary {
  serverId: string;
  date: string;
  label: string;
  description?: string;
}

const WHAT = 'Anniversaries';

function toServerAnniversary(row: SupabaseAnniversaryRecord): ServerAnniversary {
  return {
    serverId: row.id,
    date: row.event_date,
    label: row.label,
    ...(row.description ? { description: row.description } : {}),
  };
}

function requireCalendarDate(date: string): void {
  // A `date` column accepts `infinity`; the mirror's schema would then drop the
  // whole settings blob on the next load, so the value is refused here.
  if (!parseEventDate(date)) {
    throw new AccountDataError('invalid-response', `Not a valid calendar date: ${date}`);
  }
}

export const anniversariesService = {
  /** Every anniversary the user owns, soonest calendar date first. */
  async fetchAnniversaries(userId: string): Promise<ServerAnniversary[]> {
    requireOnline(WHAT, 'load');
    try {
      const { data, error } = await supabase
        .from('anniversaries')
        .select('*')
        .eq('user_id', userId)
        .order('event_date', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      // An unreadable date is dropped rather than poisoning the mirror.
      return (data ?? []).filter((row) => parseEventDate(row.event_date)).map(toServerAnniversary);
    } catch (error) {
      throw toAccountDataError('AnniversariesService.fetchAnniversaries', error);
    }
  },

  async createAnniversary(userId: string, input: AnniversaryInput): Promise<ServerAnniversary> {
    requireOnline(WHAT);
    requireCalendarDate(input.date);
    try {
      const { data, error } = await supabase
        .from('anniversaries')
        .insert({
          user_id: userId,
          event_date: input.date,
          label: input.label,
          description: input.description ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new AccountDataError('invalid-response', 'The anniversary was not created');
      logger.debug('[AnniversariesService] Created anniversary:', data.id);
      return toServerAnniversary(data);
    } catch (error) {
      throw toAccountDataError('AnniversariesService.createAnniversary', error);
    }
  },

  /** Zero rows means missing or not the caller's, which RLS does not report. */
  async updateAnniversary(serverId: string, input: AnniversaryInput): Promise<ServerAnniversary> {
    requireOnline(WHAT);
    requireCalendarDate(input.date);
    try {
      const { data, error } = await supabase
        .from('anniversaries')
        .update({
          event_date: input.date,
          label: input.label,
          description: input.description ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', serverId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new AccountDataError('not-found', 'Anniversary not found');
      }
      return toServerAnniversary(data[0]);
    } catch (error) {
      throw toAccountDataError('AnniversariesService.updateAnniversary', error);
    }
  },

  /**
   * Zero rows is success: the row is already gone (deleted from another
   * device), which is the state the caller asked for.
   */
  async deleteAnniversary(serverId: string): Promise<void> {
    requireOnline(WHAT);
    try {
      const { error } = await supabase.from('anniversaries').delete().eq('id', serverId);
      if (error) throw error;
    } catch (error) {
      throw toAccountDataError('AnniversariesService.deleteAnniversary', error);
    }
  },

  /**
   * Insert-only upload of rows that each carry a deterministic `client_key`.
   * A key already stored is ignored (ON CONFLICT DO NOTHING), so a re-run never
   * duplicates and never touches a server row.
   */
  async insertAnniversariesOnce(rows: AnniversaryInsert[]): Promise<void> {
    if (rows.length === 0) return;
    requireOnline(WHAT);
    try {
      const { error } = await supabase
        .from('anniversaries')
        .upsert(rows, { onConflict: 'user_id,client_key', ignoreDuplicates: true });
      if (error) throw error;
    } catch (error) {
      throw toAccountDataError('AnniversariesService.insertAnniversariesOnce', error);
    }
  },
};
