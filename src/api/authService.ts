/**
 * Authentication Service Facade
 *
 * Composes session and action services to preserve the existing auth API
 * while allowing hot paths to import only the narrow surface they need.
 *
 * @module api/authService
 */

import {
  getAuthStatus,
  getCurrentUserId,
  getCurrentUserIdOfflineSafe,
  getSession,
  getUser,
  onAuthStateChange,
  sessionService,
} from './auth/sessionService';
import {
  resetPassword,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  actionService,
} from './auth/actionService';

export type { AuthCredentials, AuthResult, AuthStatus } from './auth/types';

export {
  actionService,
  getAuthStatus,
  getCurrentUserId,
  getCurrentUserIdOfflineSafe,
  getSession,
  getUser,
  onAuthStateChange,
  resetPassword,
  sessionService,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
};

export const authService = {
  signIn,
  signUp,
  signOut,
  getSession,
  getUser,
  getCurrentUserId,
  getCurrentUserIdOfflineSafe,
  getAuthStatus,
  onAuthStateChange,
  resetPassword,
  signInWithGoogle,
};

export default authService;
