/**
 * Custom Messages API — the signed-in user's custom daily messages
 * (`public.custom_messages`)
 *
 * Supabase is the source of truth. The IndexedDB `messages` store keeps a read
 * mirror of these rows (`isCustom: true`, `userId`, `serverId`) so the daily
 * rotation and the Admin panel still render offline; `customMessageService`
 * writes here first and to that mirror second.
 *
 * A custom message's favorite flag is a column on its own row. Favorites of the
 * bundled messages live in `message_favorites` (`messageFavoritesApi.ts`).
 *
 * Private to the author (owner-only RLS). Error convention: `accountDataError.ts`.
 *
 * @module services/customMessagesApi
 */

import type { Database } from '../api/supabaseClient';
import { supabase } from '../api/supabaseClient';
import type { MessageCategory } from '../types';
import { logger } from '../utils/logger';
import { AccountDataError, requestTimeout, requireOnline, toAccountDataError } from './accountDataError';

export type SupabaseCustomMessageRecord = Database['public']['Tables']['custom_messages']['Row'];

/** A server row in the app's shape. */
export interface ServerCustomMessage {
  serverId: string;
  text: string;
  category: MessageCategory;
  active: boolean;
  isFavorite: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomMessageFields {
  text: string;
  category: MessageCategory;
  active: boolean;
  tags: string[];
}

const WHAT = 'Custom messages';

const CATEGORIES: readonly MessageCategory[] = ['reason', 'memory', 'affirmation', 'future', 'custom'];

/** Narrow the `category` column (typed `string` by the generated types). */
export function isMessageCategory(value: string): value is MessageCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

function toServerCustomMessage(row: SupabaseCustomMessageRecord): ServerCustomMessage {
  return {
    serverId: row.id,
    text: row.text,
    category: isMessageCategory(row.category) ? row.category : 'custom',
    active: row.active,
    isFavorite: row.is_favorite,
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export const customMessagesApi = {
  async fetchCustomMessages(userId: string): Promise<ServerCustomMessage[]> {
    requireOnline(WHAT, 'load');
    try {
      const { data, error } = await supabase
        .from('custom_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .abortSignal(requestTimeout());
      if (error) throw error;
      return (data ?? []).map(toServerCustomMessage);
    } catch (error) {
      throw toAccountDataError('CustomMessagesApi.fetchCustomMessages', error);
    }
  },

  /**
   * Retry-safe create: `clientKey` is minted once per submit and reused on a
   * retry of the same submit, so a lost response resolves to the stored row
   * rather than a duplicate (ON CONFLICT DO NOTHING, then a read-back by key —
   * the notesSlice pattern). Same contract as `anniversariesService`.
   */
  async createCustomMessage(
    userId: string,
    fields: CustomMessageFields,
    clientKey: string
  ): Promise<ServerCustomMessage> {
    requireOnline(WHAT);
    try {
      const { data, error } = await supabase
        .from('custom_messages')
        .upsert(
          { user_id: userId, ...fields, client_key: clientKey },
          { onConflict: 'user_id,client_key', ignoreDuplicates: true }
        )
        .select()
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;

      let stored = data;
      if (!stored) {
        const existing = await supabase
          .from('custom_messages')
          .select()
          .eq('user_id', userId)
          .eq('client_key', clientKey)
          .abortSignal(requestTimeout())
          .maybeSingle();
        if (existing.error) throw existing.error;
        stored = existing.data;
      }
      if (!stored) throw new AccountDataError('invalid-response', 'The message was not created');
      logger.debug('[CustomMessagesApi] Created custom message:', stored.id);
      return toServerCustomMessage(stored);
    } catch (error) {
      throw toAccountDataError('CustomMessagesApi.createCustomMessage', error);
    }
  },

  /** Zero rows means missing or not the caller's, which RLS does not report. */
  async updateCustomMessage(
    serverId: string,
    updates: Partial<CustomMessageFields> & { isFavorite?: boolean }
  ): Promise<ServerCustomMessage> {
    requireOnline(WHAT);
    try {
      const payload: Database['public']['Tables']['custom_messages']['Update'] = {
        updated_at: new Date().toISOString(),
      };
      if (updates.text !== undefined) payload.text = updates.text;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.active !== undefined) payload.active = updates.active;
      if (updates.tags !== undefined) payload.tags = updates.tags;
      if (updates.isFavorite !== undefined) payload.is_favorite = updates.isFavorite;

      const { data, error } = await supabase
        .from('custom_messages')
        .update(payload)
        .eq('id', serverId)
        .select()
        .abortSignal(requestTimeout());
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new AccountDataError('not-found', 'Custom message not found');
      }
      return toServerCustomMessage(data[0]);
    } catch (error) {
      throw toAccountDataError('CustomMessagesApi.updateCustomMessage', error);
    }
  },

  /** Zero rows is success: the row is already gone, as the caller asked. */
  async deleteCustomMessage(serverId: string): Promise<void> {
    requireOnline(WHAT);
    try {
      const { error } = await supabase
        .from('custom_messages')
        .delete()
        .eq('id', serverId)
        .abortSignal(requestTimeout());
      if (error) throw error;
    } catch (error) {
      throw toAccountDataError('CustomMessagesApi.deleteCustomMessage', error);
    }
  },
};
