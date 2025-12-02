/**
 * Supabase Data Models
 *
 * TypeScript interfaces for Supabase database records.
 * Re-exports types from service modules for convenience.
 *
 * @module types/models
 */

// Photo types (Story 6.0)
export type {
  SupabasePhoto,
  PhotoWithUrls,
  StorageQuota,
  PhotoUploadInput,
} from '../services/photoService';

// Love Notes types (Story 2.1)

/**
 * LoveNote interface - represents a message in the Love Notes chat
 *
 * Maps to the `love_notes` Supabase table (Story 2.0)
 */
export interface LoveNote {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  // Client-side only fields for optimistic updates
  sending?: boolean;
  error?: boolean;
}

/**
 * LoveNotesState interface - Zustand store state shape for Love Notes
 */
export interface LoveNotesState {
  notes: LoveNote[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}
