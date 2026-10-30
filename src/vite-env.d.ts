/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Type definitions for environment variables
 * Enables TypeScript autocomplete and type checking for import.meta.env
 *
 * Story 0.2: Environment Variables & Secrets Management
 */
interface ImportMetaEnv {
  /**
   * Supabase Project URL
   * Format: https://[project-id].supabase.co
   * Get from: Supabase Dashboard → Project Settings → API
   */
  readonly VITE_SUPABASE_URL: string;

  /**
   * Supabase Anonymous/Public Key
   * Safe for public exposure - Row Level Security (RLS) protects data access
   * Get from: Supabase Dashboard → Project Settings → API → anon/public key
   */
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;

  /**
   * Test user email for E2E tests (optional - only needed for E2E testing)
   */
  readonly VITE_TEST_USER_EMAIL?: string;

  /**
   * Test user password for E2E tests (optional - only needed for E2E testing)
   */
  readonly VITE_TEST_USER_PASSWORD?: string;

  /**
   * Partner test user email for multi-user E2E tests (optional)
   */
  readonly VITE_TEST_PARTNER_EMAIL?: string;

  /**
   * Partner test user password for multi-user E2E tests (optional)
   */
  readonly VITE_TEST_PARTNER_PASSWORD?: string;

  /**
   * Where the native shell checks for live updates (optional). Defaults to the
   * production site's updates/latest.json; point it at `wrangler dev` to test
   * an update locally.
   */
  readonly VITE_LIVE_UPDATE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** `package.json` version, injected by the `define` in vite.config.ts and vitest.config.ts. */
declare const __APP_VERSION__: string;

/** The build's live-update id, injected by the `define` in vite.config.ts and vitest.config.ts. */
declare const __BUILD_ID__: string;
