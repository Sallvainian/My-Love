/**
 * Auth System Initialization
 *
 * Registers the Supabase auth provider with the auth-session library.
 * Must be called before any auth operations since the library calls
 * getAuthProvider() internally.
 *
 * We skip configureAuthSession() — the library creates storage dirs/files
 * on demand when getAuthToken() or authStorageInit() runs. Calling it
 * explicitly just triggers noisy console.log + dotenv spam from the
 * library's auth-configure module.
 *
 * Idempotent — safe to call multiple times.
 */
import { setAuthProvider } from '@seontechnologies/playwright-utils/auth-session';
import { SupabaseAuthProvider } from './supabase-auth-provider';

let initialized = false;

export function initializeAuthSystem(): void {
  if (initialized) return;

  setAuthProvider(new SupabaseAuthProvider());

  initialized = true;
}
