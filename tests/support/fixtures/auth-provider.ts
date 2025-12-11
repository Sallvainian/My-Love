/**
 * Supabase Auth Provider for playwright-utils auth-session
 *
 * Integrates Supabase authentication with @seontechnologies/playwright-utils
 * auth-session pattern for token persistence and multi-user support.
 *
 * Features:
 * - Token persistence across test runs
 * - Multi-user support (test user, partner)
 * - Automatic token refresh
 * - Partner relationship setup
 *
 * @see .bmad/bmm/testarch/knowledge/auth-session.md
 */

import type { APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Auth session types (compatible with @seontechnologies/playwright-utils/auth-session)
interface AuthOptions {
  environment?: string;
  userIdentifier?: string;
  baseURL?: string;
}

interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

interface AuthProvider {
  getEnvironment: (options: AuthOptions) => string;
  getUserIdentifier: (options: AuthOptions) => string;
  extractToken: (storageState: StorageState) => string | null;
  extractCookies: (tokenData: string) => CookieData[];
  isTokenExpired: (storageState: StorageState) => boolean;
  manageAuthToken: (request: APIRequestContext, options: AuthOptions) => Promise<StorageState>;
}

// Environment configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

// Test user credentials
const TEST_USERS: Record<string, { email: string; password: string }> = {
  default: {
    email: process.env.VITE_TEST_USER_EMAIL ?? 'test@example.com',
    password: process.env.VITE_TEST_USER_PASSWORD ?? 'testpassword123',
  },
  partner: {
    email: process.env.VITE_TEST_PARTNER_EMAIL ?? 'partner@example.com',
    password: process.env.VITE_TEST_PARTNER_PASSWORD ?? 'testpassword123',
  },
};

// Storage state shape from Playwright
interface StorageState {
  cookies: CookieData[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

// Supabase session shape
interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Extract Supabase token from storage state cookies.
 */
function extractTokenFromStorage(storageState: StorageState): string | null {
  // Supabase stores tokens in cookies named sb-*-auth-token
  const authCookie = storageState.cookies.find((c) => c.name.includes('-auth-token'));

  if (authCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(authCookie.value));
      return parsed.access_token ?? null;
    } catch {
      return authCookie.value;
    }
  }

  // Also check localStorage for Supabase auth
  for (const origin of storageState.origins) {
    const authItem = origin.localStorage.find(
      (item) => item.name.includes('supabase.auth.token') || item.name.includes('sb-')
    );
    if (authItem) {
      try {
        const parsed = JSON.parse(authItem.value);
        return parsed.access_token ?? parsed.currentSession?.access_token ?? null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Check if Supabase token is expired.
 */
function isTokenExpired(storageState: StorageState): boolean {
  // Check cookies for expiry
  const authCookie = storageState.cookies.find((c) => c.name.includes('-auth-token'));

  if (authCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(authCookie.value));
      if (parsed.expires_at) {
        // expires_at is Unix timestamp in seconds
        const expiresAt = parsed.expires_at * 1000;
        // Consider expired if less than 5 minutes remaining
        return Date.now() > expiresAt - 5 * 60 * 1000;
      }
    } catch {
      // If we can't parse, assume expired to force refresh
      return true;
    }
  }

  // Check localStorage
  for (const origin of storageState.origins) {
    const authItem = origin.localStorage.find(
      (item) => item.name.includes('supabase.auth.token') || item.name.includes('sb-')
    );
    if (authItem) {
      try {
        const parsed = JSON.parse(authItem.value);
        const expiresAt = parsed.expires_at ?? parsed.currentSession?.expires_at;
        if (expiresAt) {
          return Date.now() > expiresAt * 1000 - 5 * 60 * 1000;
        }
      } catch {
        return true;
      }
    }
  }

  // No expiry found, assume valid
  return false;
}

/**
 * Convert Supabase session to Playwright cookies.
 */
function sessionToCookies(session: SupabaseSession, domain: string): CookieData[] {
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] ?? 'local';

  return [
    {
      name: `sb-${projectRef}-auth-token`,
      value: encodeURIComponent(
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: 'bearer',
          user: session.user,
        })
      ),
      domain,
      path: '/',
      httpOnly: false,
      secure: domain !== 'localhost',
      sameSite: 'Lax' as const,
      expires: session.expires_at,
    },
  ];
}

/**
 * Perform Supabase authentication and return storage state.
 */
async function authenticateSupabase(
  userIdentifier: string,
  baseURL: string
): Promise<StorageState> {
  const user = TEST_USERS[userIdentifier] ?? TEST_USERS.default;

  if (!user.email || !user.password) {
    throw new Error(
      `No credentials found for user "${userIdentifier}". ` +
        'Set VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD environment variables.'
    );
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase configuration missing. ' +
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error || !data.session) {
    throw new Error(`Supabase authentication failed for ${user.email}: ${error?.message ?? 'No session'}`);
  }

  const domain = new URL(baseURL).hostname;
  const cookies = sessionToCookies(data.session, domain);

  return {
    cookies,
    origins: [
      {
        origin: baseURL,
        localStorage: [
          {
            name: `sb-${SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] ?? 'local'}-auth-token`,
            value: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
              user: data.session.user,
            }),
          },
        ],
      },
    ],
  };
}

/**
 * Ensure partner relationship exists between test users.
 * Called during global setup.
 */
export async function ensurePartnerRelationship(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('   ⚠️ Partner setup skipped - missing SUPABASE_SERVICE_KEY');
    return;
  }

  const testUser = TEST_USERS.default;
  const partnerUser = TEST_USERS.partner;

  if (!testUser.email || !partnerUser.email) {
    console.log('   ⚠️ Partner setup skipped - missing user emails');
    return;
  }

  console.log('   Setting up partner relationship...');

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const testUserRecord = users?.users?.find((u) => u.email === testUser.email);
    const partnerUserRecord = users?.users?.find((u) => u.email === partnerUser.email);

    if (!testUserRecord || !partnerUserRecord) {
      console.log('   ⚠️ Could not find test users in auth');
      return;
    }

    // Check if already configured
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('partner_id')
      .eq('id', testUserRecord.id)
      .single();

    if (existingUser?.partner_id === partnerUserRecord.id) {
      console.log('   Partner already configured ✓');
      return;
    }

    // Set bidirectional partner relationship
    await supabaseAdmin
      .from('users')
      .update({ partner_id: partnerUserRecord.id })
      .eq('id', testUserRecord.id);

    await supabaseAdmin
      .from('users')
      .update({ partner_id: testUserRecord.id })
      .eq('id', partnerUserRecord.id);

    console.log('   Partner relationship configured ✓');
  } catch (error) {
    console.log(`   ⚠️ Partner setup error: ${error}`);
  }
}

/**
 * Supabase auth provider for playwright-utils auth-session.
 *
 * Implements the AuthProvider interface to integrate Supabase
 * authentication with the playwright-utils token persistence system.
 */
export const supabaseAuthProvider: AuthProvider = {
  /**
   * Get environment identifier (e.g., 'local', 'staging', 'production').
   */
  getEnvironment: (options: AuthOptions): string => {
    return options.environment ?? 'local';
  },

  /**
   * Get user identifier for this authentication.
   */
  getUserIdentifier: (options: AuthOptions): string => {
    return options.userIdentifier ?? 'default';
  },

  /**
   * Extract access token from storage state.
   */
  extractToken: (storageState: StorageState): string | null => {
    return extractTokenFromStorage(storageState);
  },

  /**
   * Convert token data to browser cookies.
   */
  extractCookies: (tokenData: string): CookieData[] => {
    // tokenData is JSON string of session
    try {
      const session = JSON.parse(tokenData) as SupabaseSession;
      return sessionToCookies(session, 'localhost');
    } catch {
      return [];
    }
  },

  /**
   * Check if token is expired.
   */
  isTokenExpired: (storageState: StorageState): boolean => {
    return isTokenExpired(storageState);
  },

  /**
   * Main authentication flow - returns storage state with auth data.
   */
  manageAuthToken: async (
    _request: APIRequestContext,
    options: AuthOptions
  ): Promise<StorageState> => {
    const userIdentifier = options.userIdentifier ?? 'default';
    const baseURL = options.baseURL ?? 'http://localhost:5173';

    console.log(`🔐 Authenticating user: ${userIdentifier}`);

    const storageState = await authenticateSupabase(userIdentifier, baseURL);

    console.log(`   ✅ Authentication successful for ${userIdentifier}`);

    return storageState;
  },
};

/**
 * Get the auth storage path for a given environment and user.
 *
 * @param environment - Environment name (local, staging, production)
 * @param userIdentifier - User identifier (default, partner)
 * @returns Full path to storage state file
 */
export function getAuthStoragePath(environment: string, userIdentifier: string): string {
  const baseDir = path.join(process.cwd(), 'tests', 'e2e', '.auth');
  return path.join(baseDir, environment, userIdentifier, 'storage-state.json');
}

/**
 * Ensure auth storage directories exist.
 */
export function initAuthStorage(): void {
  const baseDir = path.join(process.cwd(), 'tests', 'e2e', '.auth');

  // Create directories for each environment/user combination
  const environments = ['local', 'staging', 'production'];
  const users = Object.keys(TEST_USERS);

  for (const env of environments) {
    for (const user of users) {
      const dir = path.join(baseDir, env, user);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
}

export default supabaseAuthProvider;
