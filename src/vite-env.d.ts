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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
