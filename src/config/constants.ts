/**
 * Application Configuration Constants
 *
 * This module exposes environment variables injected at build time by Vite.
 * Environment variables prefixed with VITE_ are available via import.meta.env
 * and are statically replaced during the build process.
 *
 * Security Note:
 * - .env.production contains personal relationship data
 * - Must be explicitly added to .gitignore
 * - Never commit .env.production to version control
 *
 * Deployment:
 * 1. Copy .env.production.example to .env.production
 * 2. Fill in relationship-specific values
 * 3. Run `npm run build` to inject values into production bundle
 * 4. Deploy dist/ folder to hosting service
 */

/**
 * Application configuration object containing pre-configured relationship data.
 *
 * For single-user deployment:
 * - defaultPartnerName and defaultStartDate are injected from environment variables
 * - isPreConfigured flag indicates if env vars are present (validates configuration)
 *
 * Fallback behavior:
 * - If environment variables are missing, defaults to empty strings
 * - Store initialization will handle gracefully (log error to console)
 * - App will not crash but may not function correctly without valid values
 */
export const APP_CONFIG = {
  /**
   * Pre-configured partner name from VITE_PARTNER_NAME environment variable.
   * Used to initialize Settings.relationship.partnerName on first app load.
   */
  defaultPartnerName: import.meta.env.VITE_PARTNER_NAME || '',

  /**
   * Pre-configured relationship start date from VITE_RELATIONSHIP_START_DATE env var.
   * Expected format: ISO 8601 date string (YYYY-MM-DD) e.g., "2025-10-18"
   * Used to initialize Settings.relationship.startDate on first app load.
   */
  defaultStartDate: import.meta.env.VITE_RELATIONSHIP_START_DATE || '',

  /**
   * Flag indicating whether environment variables were provided at build time.
   * True if VITE_PARTNER_NAME is present (assumes VITE_RELATIONSHIP_START_DATE also provided).
   * Used by store initialization to determine if pre-configuration should be applied.
   */
  isPreConfigured: Boolean(import.meta.env.VITE_PARTNER_NAME && import.meta.env.VITE_RELATIONSHIP_START_DATE),
} as const;

/**
 * Type for APP_CONFIG (read-only constant object)
 */
export type AppConfig = typeof APP_CONFIG;
