/**
 * Love Note Factory
 *
 * Factory for creating test love notes with automatic cleanup.
 * Uses Supabase admin client to seed data directly, bypassing UI.
 *
 * Usage in fixture:
 * ```typescript
 * import { LoveNoteFactory } from './factories/love-note-factory';
 *
 * export const test = base.extend<{ loveNoteFactory: LoveNoteFactory }>({
 *   loveNoteFactory: async ({}, use) => {
 *     const factory = new LoveNoteFactory();
 *     await use(factory);
 *     await factory.cleanup();
 *   },
 * });
 * ```
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface LoveNote {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export interface CreateLoveNoteParams {
  senderId?: string;
  recipientId?: string;
  content?: string;
  readAt?: string | null;
}

export class LoveNoteFactory {
  private supabase: SupabaseClient | null = null;
  private createdNoteIds: string[] = [];

  constructor() {
    const url = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (url && serviceKey) {
      this.supabase = createClient(url, serviceKey);
    }
  }

  /**
   * Create a love note with optional overrides.
   * Returns the created note with all fields populated.
   */
  async createNote(params: CreateLoveNoteParams = {}): Promise<LoveNote> {
    if (!this.supabase) {
      throw new Error(
        'LoveNoteFactory requires VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables'
      );
    }

    const defaultContent = `Test love note created at ${new Date().toISOString()}`;

    const noteData = {
      sender_id: params.senderId ?? process.env.VITE_TEST_USER_ID,
      recipient_id: params.recipientId ?? process.env.VITE_TEST_PARTNER_ID,
      content: params.content ?? defaultContent,
      read_at: params.readAt ?? null,
    };

    const { data, error } = await this.supabase
      .from('love_notes')
      .insert(noteData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create love note: ${error.message}`);
    }

    this.createdNoteIds.push(data.id);
    return data as LoveNote;
  }

  /**
   * Create multiple love notes at once.
   * Useful for testing pagination or message history.
   */
  async createNotes(count: number, params: CreateLoveNoteParams = {}): Promise<LoveNote[]> {
    const notes: LoveNote[] = [];
    for (let i = 0; i < count; i++) {
      const note = await this.createNote({
        ...params,
        content: params.content ?? `Test note ${i + 1} of ${count}`,
      });
      notes.push(note);
    }
    return notes;
  }

  /**
   * Mark a note as read.
   */
  async markAsRead(noteId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await this.supabase
      .from('love_notes')
      .update({ read_at: new Date().toISOString() })
      .eq('id', noteId);

    if (error) {
      throw new Error(`Failed to mark note as read: ${error.message}`);
    }
  }

  /**
   * Get all notes created by this factory instance.
   */
  getCreatedNoteIds(): string[] {
    return [...this.createdNoteIds];
  }

  /**
   * Delete all notes created by this factory.
   * Called automatically by fixture teardown.
   */
  async cleanup(): Promise<void> {
    if (!this.supabase || this.createdNoteIds.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .from('love_notes')
      .delete()
      .in('id', this.createdNoteIds);

    if (error) {
      console.error(`[LoveNoteFactory] Cleanup failed: ${error.message}`);
    }

    this.createdNoteIds = [];
  }
}

/**
 * Create a standalone factory instance.
 * Prefer using the fixture for automatic cleanup.
 */
export function createLoveNoteFactory(): LoveNoteFactory {
  return new LoveNoteFactory();
}
