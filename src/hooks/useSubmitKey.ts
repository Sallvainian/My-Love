import { useCallback, useRef } from 'react';

/**
 * One idempotency key per submit, reused when the user retries the SAME submit.
 *
 * A create whose response was lost after the server committed surfaces as an
 * error; the user presses Save again. Sending the same key lets the server
 * resolve that retry to the row it already stored (ON CONFLICT DO NOTHING on
 * `UNIQUE (user_id, client_key)`) instead of storing a second one.
 *
 * The key is bound to the payload: different content gets a different key.
 * Reusing a key across different content would make the server hand back the
 * FIRST row and silently drop the edit. Every payload tried since the last
 * success keeps its key, so going back to an earlier version (X, then Y, then
 * X again) still resolves to X's row if X's first attempt had committed.
 *
 * Call `reset()` after a successful save so the next submit starts fresh.
 */
export function useSubmitKey(): { keyFor: (payload: unknown) => string; reset: () => void } {
  const keys = useRef(new Map<string, string>());

  const keyFor = useCallback((payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    return key;
  }, []);

  const reset = useCallback(() => {
    keys.current.clear();
  }, []);

  return { keyFor, reset };
}
