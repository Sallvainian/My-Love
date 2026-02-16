import type { AuthError, Session, User } from '@supabase/supabase-js';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}
