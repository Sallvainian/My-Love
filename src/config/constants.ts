/**
 * Application Configuration Constants
 *
 * Hardcoded relationship configuration for single-user PWA deployment.
 * Edit these values directly to configure your app with your relationship data.
 */

/**
 * Application configuration object containing relationship data.
 *
 * Setup Instructions:
 * 1. Edit defaultPartnerName below with your partner's name
 * 2. Edit defaultStartDate below with your relationship start date (YYYY-MM-DD format)
 * 3. Run `npm run build` to create production bundle
 * 4. Run `npm run deploy` to deploy to GitHub Pages
 */
export const APP_CONFIG = {
  /**
   * Partner name displayed throughout the app.
   */
  defaultPartnerName: 'Gracie',

  /**
   * Relationship start date for duration counter.
   * Format: ISO 8601 date string (YYYY-MM-DD)
   */
  defaultStartDate: '2025-10-18',

  /**
   * Flag indicating configuration is present.
   * Always true since values are hardcoded in this file.
   */
  isPreConfigured: true,
} as const;

/**
 * Type for APP_CONFIG (read-only constant object)
 */
export type AppConfig = typeof APP_CONFIG;

/**
 * Single-user ID for IndexedDB entries (Epic 6)
 * Hardcoded since this is a single-user PWA
 */
export const USER_ID = 'default-user' as const;

/**
 * Partner name (exported for backward compatibility)
 */
export const PARTNER_NAME = APP_CONFIG.defaultPartnerName;
