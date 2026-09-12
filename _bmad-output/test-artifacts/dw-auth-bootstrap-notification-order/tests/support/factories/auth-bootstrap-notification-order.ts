import type { Session } from '@supabase/supabase-js';
import type { CoupleEvent } from '../../../src/services/eventsService';

type SessionOptions = {
  userId?: string;
  email?: string;
  displayName?: string | null;
  accessToken?: string;
};

/** Local SDK inputs only; these tokens are never used to authenticate an HTTP request. */
export function createAuthBootstrapSession(options: SessionOptions = {}): Session {
  const userId = options.userId ?? crypto.randomUUID();
  return {
    access_token: options.accessToken ?? 'bootstrap-test-' + crypto.randomUUID(),
    refresh_token: 'bootstrap-refresh-' + crypto.randomUUID(),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: userId,
      email: options.email ?? userId + '@example.test',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: options.displayName === null
        ? {}
        : { display_name: options.displayName ?? 'Bootstrap User' },
      aud: 'authenticated',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  };
}

export type AuthBootstrapEventInput = {
  userId: string;
  label: string;
};

/** Builds the Date-bearing service result consumed by the real events slice. */
export function createAuthBootstrapEvent(input: AuthBootstrapEventInput): CoupleEvent {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(12, 0, 0, 0);
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    label: input.label,
    date,
    description: null,
    icon: 'calendar',
    createdAt: new Date(),
  };
}
