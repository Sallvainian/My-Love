/**
 * Typed Supabase client for tests.
 *
 * Playwright fixtures and helpers import `TypedSupabaseClient` from here so
 * table/RPC names typecheck against `database.types.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.types';

/**
 * Typed Supabase client with project schema for compile-time table/RPC validation
 */
export type TypedSupabaseClient = SupabaseClient<Database>;
