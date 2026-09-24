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

/** What a refused write or read would have done: "… need a connection to <action>." */
export type NeedsConnectionAction =
  | 'save'
  | 'load'
  | 'send'
  | 'upload'
  | 'delete'
  | 'remove'
  | 'accept'
  | 'decline'
  | 'be marked as seen';

/**
 * The one wording for an up-front offline refusal:
 * "You are offline. <what> need(s) a connection to <action>."
 * `verb` is 'needs' for a singular subject ("A poke needs …").
 */
export function offlineMessage(
  what: string,
  action: NeedsConnectionAction = 'save',
  verb: 'need' | 'needs' = 'need'
): string {
  return `You are offline. ${what} ${verb} a connection to ${action}.`;
}

/**
 * Refuse a request before it is sent when the device reports no network,
 * with `offlineMessage(what, action)`: "You are offline. <what> need a
 * connection to <action>." `action` completes the sentence (default 'save').
 */
export function requireOnline(what: string, action: NeedsConnectionAction = 'save'): void {
  if (!isOnline()) {
    throw new AccountDataError('offline', offlineMessage(what, action));
  }
}

/**
 * Why a custom row without a server id refuses an edit, a delete or a
 * favorite: the server holds no row to change. The next mirror refresh
 * replaces it with the server's rows.
 */
export const NOT_SYNCED_MESSAGE =
  'This message has not been saved to your account yet. Try again in a moment.';

/**
 * How long one request to these tables may take before it is abandoned.
 *
 * Every account-data write and refresh runs in one strict queue
 * (`accountDataQueue.ts`), so a request left pending by a stalled mobile socket
 * would hold every later write. Bounding the request, not the queue, keeps the
 * queue strict: an abandoned request rejects, its task ends, and the next one
 * starts with nothing still running. Applied to every request here. Each is
 * safe to repeat after a timeout that fired once the server had committed:
 * updates and deletes are absolute, adding a favorite is ON CONFLICT DO
 * NOTHING on its own key, and both user creates are ON CONFLICT DO NOTHING on
 * a key the caller reuses across a retry (the creates read the stored row back
 * by that key).
 */
export const REQUEST_TIMEOUT_MS = 30_000;

export function requestTimeout(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
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
