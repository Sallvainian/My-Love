/**
 * Supabase Auth Provider for @seontechnologies/playwright-utils auth-session
 *
 * Implements the AuthProvider interface using Supabase signInWithPassword.
 * Stores auth sessions in localStorage (origins[]) rather than cookies,
 * matching Supabase's client-side session storage pattern.
 */
import type { APIRequestContext } from '@playwright/test';
import type { AuthProvider } from '@seontechnologies/playwright-utils/auth-session';
import type { AuthOptions } from '@seontechnologies/playwright-utils/auth-session';
import {
  getStorageStatePath,
  saveStorageState,
} from '@seontechnologies/playwright-utils/auth-session';
import fs from 'fs';

const TEST_USER_PASSWORD = 'testpassword123';

/**
 * Maps a user identifier to an email address.
 * - 'worker-N' → testworkerN@test.example.com
 * - 'worker-N-partner' → testworkerN-partner@test.example.com
 * - 'default' → testuser1@test.example.com
 */
function userIdentifierToEmail(userIdentifier: string): string {
  // worker-N-partner
  const partnerMatch = userIdentifier.match(/^worker-(\d+)-partner$/);
  if (partnerMatch) {
    return `testworker${partnerMatch[1]}-partner@test.example.com`;
  }

  // worker-N
  const workerMatch = userIdentifier.match(/^worker-(\d+)$/);
  if (workerMatch) {
    return `testworker${workerMatch[1]}@test.example.com`;
  }

  // Legacy/default
  return 'testuser1@test.example.com';
}

export class SupabaseAuthProvider implements AuthProvider {
  getEnvironment(options?: Partial<AuthOptions>): string {
    return options?.environment || 'local';
  }

  getUserIdentifier(options?: Partial<AuthOptions>): string {
    return options?.userIdentifier || 'default';
  }

  getBaseUrl(_options?: Partial<AuthOptions>): string | undefined {
    return process.env.BASE_URL || 'http://localhost:5173';
  }

  extractToken(tokenData: Record<string, unknown>): string | null {
    // tokenData is a Playwright storage state: { cookies: [], origins: [...] }
    const origins = tokenData.origins as
      | Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>
      | undefined;
    if (!origins?.length) return null;

    for (const origin of origins) {
      for (const item of origin.localStorage) {
        if (/^sb-.*-auth-token$/.test(item.name)) {
          try {
            const session = JSON.parse(item.value);
            return session.access_token ?? null;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  extractCookies(_tokenData: Record<string, unknown>): Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }> {
    // Supabase uses localStorage, not cookies
    return [];
  }

  isTokenExpired(rawToken: string): boolean {
    try {
      const parts = rawToken.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      const exp = payload.exp;
      if (typeof exp !== 'number') return true;

      // Expired if within 60s of expiration
      const nowSeconds = Math.floor(Date.now() / 1000);
      return nowSeconds >= exp - 60;
    } catch {
      return true;
    }
  }

  async manageAuthToken(
    _request: APIRequestContext,
    options?: Partial<AuthOptions>
  ): Promise<Record<string, unknown>> {
    const userIdentifier = this.getUserIdentifier(options);
    const email = userIdentifierToEmail(userIdentifier);

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error(
        `[SupabaseAuthProvider] Missing env vars: SUPABASE_URL=${supabaseUrl ? 'set' : 'unset'}, ` +
          `SUPABASE_ANON_KEY=${anonKey ? 'set' : 'unset'}. Ensure Supabase local is running.`
      );
    }

    // Use dynamic import to avoid bundling issues with Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: TEST_USER_PASSWORD,
    });

    if (error || !data.session) {
      throw new Error(
        `[SupabaseAuthProvider] signInWithPassword failed for ${email}: ${error?.message ?? 'missing session'}`
      );
    }

    // Build Playwright storage state with localStorage entries
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    const baseUrl = this.getBaseUrl(options) || 'http://localhost:5173';

    const storageState = {
      cookies: [],
      origins: [
        {
          origin: baseUrl,
          localStorage: [
            { name: storageKey, value: JSON.stringify(data.session) },
            { name: 'lastWelcomeView', value: Date.now().toString() },
          ],
        },
      ],
    };

    // Persist to disk so the library's context fixture can load it
    const storagePath = getStorageStatePath({
      environment: this.getEnvironment(options),
      userIdentifier,
    });
    saveStorageState(storagePath, storageState);

    return storageState;
  }

  clearToken(options?: Partial<AuthOptions>): void {
    const storagePath = getStorageStatePath({
      environment: this.getEnvironment(options),
      userIdentifier: this.getUserIdentifier(options),
    });
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
  }
}
