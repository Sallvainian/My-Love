/**
 * Errors shared by the three account-data services that moved off the device
 * (`anniversariesService`, `customMessagesApi`, `messageFavoritesApi`).
 *
 * Same convention as `eventsService`: these services THROW, with a stable code
 * beside the message, and never route through `handleNetworkError` — its text
 * promises a sync ("will be synced when you're back online"), and there is no
 * offline write queue for any of these features. An offline write fails, and
 * the user is told so.
 *
 * @module services/accountDataError
 */

import { handleSupabaseError, isOnline, isPostgrestError, logSupabaseError } from '../api/errorHandlers';

export type AccountDataErrorCode =
  | 'offline'
  | 'not-synced'
  | 'not-found'
  | 'invalid-response'
  | 'transport';

export class AccountDataError extends Error {
  constructor(
    public readonly code: AccountDataErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AccountDataError';
  }
}

/**
 * Refuse a request before it is sent when the device reports no network.
 * `what` completes "… need a connection to save." in the user-facing message.
 */
export function requireOnline(what: string, action: 'save' | 'load' = 'save'): void {
  if (!isOnline()) {
    throw new AccountDataError('offline', `You are offline. ${what} need a connection to ${action}.`);
  }
}

/**
 * Catch tail for every request in these services: an `AccountDataError` passes
 * through untouched, a PostgREST error keeps its friendly mapped message, and
 * anything else is a transport failure with a truthful message.
 */
export function toAccountDataError(context: string, error: unknown): AccountDataError {
  if (error instanceof AccountDataError) return error;
  logSupabaseError(context, error);
  if (isPostgrestError(error)) {
    const mapped = handleSupabaseError(error, context);
    return new AccountDataError('transport', mapped.message, { cause: mapped });
  }
  const detail = error instanceof Error ? error.message : 'Unknown network error';
  return new AccountDataError(
    'transport',
    `[${context}] Network error: ${detail}. Check your internet connection.`,
    { cause: error }
  );
}
