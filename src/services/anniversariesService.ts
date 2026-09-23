/**
 * Anniversaries Service — the signed-in user's anniversary countdowns
 * (`public.anniversaries`)
 *
 * Supabase is the source of truth; `settings.relationship.anniversaries` is a
 * read mirror that `settingsSlice` keeps in step after every successful write
 * and replaces wholesale from `fetchAnniversaries` on every signed-in start.
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
import { AccountDataError, requestTimeout, requireOnline, toAccountDataError } from './accountDataError';
import { parseEventDate } from './eventsService';

export type SupabaseAnniversaryRecord = Database['public']['Tables']['anniversaries']['Row'];

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
        .order('id', { ascending: true })
        .abortSignal(requestTimeout());
      if (error) throw error;
      // An unreadable date is dropped rather than poisoning the mirror.
      return (data ?? []).filter((row) => parseEventDate(row.event_date)).map(toServerAnniversary);
    } catch (error) {
      throw toAccountDataError('AnniversariesService.fetchAnniversaries', error);
    }
  },

  /**
   * Retry-safe create. `clientKey` is minted once per submit by the caller and
   * reused when the user retries the same submit, so a response lost after the
   * server committed resolves to the stored row instead of a second one:
   * ON CONFLICT DO NOTHING on `UNIQUE (user_id, client_key)`, then a read-back
   * by key when the conflict returns no row (the notesSlice pattern). That is
   * also what makes the request timeout safe here.
   */
  async createAnniversary(
    userId: string,
    input: AnniversaryInput,
    clientKey: string
  ): Promise<ServerAnniversary> {
    requireOnline(WHAT);
    requireCalendarDate(input.date);
    try {
      const { data, error } = await supabase
        .from('anniversaries')
        .upsert(
          {
            user_id: userId,
            event_date: input.date,
            label: input.label,
            description: input.description ?? null,
            client_key: clientKey,
          },
          { onConflict: 'user_id,client_key', ignoreDuplicates: true }
        )
        .select()
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;

      let stored = data;
      if (!stored) {
        const existing = await supabase
          .from('anniversaries')
          .select()
          .eq('user_id', userId)
          .eq('client_key', clientKey)
          .abortSignal(requestTimeout())
          .maybeSingle();
        if (existing.error) throw existing.error;
        stored = existing.data;
      }
      if (!stored) throw new AccountDataError('invalid-response', 'The anniversary was not created');
      logger.debug('[AnniversariesService] Created anniversary:', stored.id);
      return toServerAnniversary(stored);
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
        .select()
        .abortSignal(requestTimeout());
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
      const { error } = await supabase
        .from('anniversaries')
        .delete()
        .eq('id', serverId)
        .abortSignal(requestTimeout());
      if (error) throw error;
    } catch (error) {
      throw toAccountDataError('AnniversariesService.deleteAnniversary', error);
    }
  },
};
