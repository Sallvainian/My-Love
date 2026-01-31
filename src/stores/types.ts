/**
 * Store Types
 *
 * Central type definitions for Zustand store slices.
 * AppSlice interface is defined HERE (not in appSlice.ts) to avoid circular imports.
 */

import type { StateCreator } from 'zustand';

// Import slice interfaces (NOT the slice creators, NOT AppSlice)
import type { MessagesSlice } from './slices/messagesSlice';
import type { PhotosSlice } from './slices/photosSlice';
import type { SettingsSlice } from './slices/settingsSlice';
import type { NavigationSlice } from './slices/navigationSlice';
import type { MoodSlice } from './slices/moodSlice';
import type { InteractionsSlice } from './slices/interactionsSlice';
import type { PartnerSlice } from './slices/partnerSlice';
import type { NotesSlice } from './slices/notesSlice';
import type { ScriptureSlice } from './slices/scriptureReadingSlice';

/**
 * AppSlice interface - DEFINED HERE to avoid circular imports.
 * Owns core app state that was previously "root" fields.
 */
export interface AppSlice {
  isLoading: boolean;
  error: string | null;
  __isHydrated: boolean;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
}

/**
 * Middleware tuple - single source of truth.
 * Must match actual middleware in useAppStore.ts (persist only).
 * If store adds devtools/immer/etc, update HERE ONLY.
 */
export type AppMiddleware = [['zustand/persist', unknown]];

/**
 * Composed AppState from ALL slices including AppSlice.
 */
export interface AppState
  extends AppSlice,
    MessagesSlice,
    PhotosSlice,
    SettingsSlice,
    NavigationSlice,
    MoodSlice,
    InteractionsSlice,
    PartnerSlice,
    NotesSlice,
    ScriptureSlice {}

/**
 * Type-safe slice creator for Zustand with persist middleware.
 * Uses AppMiddleware tuple - change middleware in one place if needed.
 */
export type AppStateCreator<Slice> = StateCreator<AppState, AppMiddleware, [], Slice>;
