/**
 * Authentication Service Facade
 *
 * Composes session and action services to preserve the existing auth API
 * while allowing hot paths to import only the narrow surface they need.
 *
 * @module api/authService
 */

import { resetPassword, signIn, signInWithGoogle, signOut, signUp } from './auth/actionService';
import {
  getAuthStatus,
  getCurrentUserId,
  getCurrentUserIdOfflineSafe,
  getSession,
  getUser,
  onAuthStateChange,
} from './auth/sessionService';

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
