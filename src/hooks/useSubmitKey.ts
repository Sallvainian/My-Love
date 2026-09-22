import { useCallback, useRef } from 'react';

/**
 * One idempotency key per submit, reused when the user retries the SAME submit.
 *
 * A create whose response was lost after the server committed surfaces as an
 * error; the user presses Save again. Sending the same key lets the server
 * resolve that retry to the row it already stored (ON CONFLICT DO NOTHING on
 * `UNIQUE (user_id, client_key)`) instead of storing a second one.
 *
 * The key is bound to the payload: if the user changes anything before
 * retrying, a new key is minted. Reusing a key across different content would
 * make the server hand back the FIRST row and silently drop the edit.
 *
 * Call `reset()` after a successful save so the next submit starts fresh.
 */
export function useSubmitKey(): { keyFor: (payload: unknown) => string; reset: () => void } {
  const current = useRef<{ fingerprint: string; key: string } | null>(null);

  const keyFor = useCallback((payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    if (!current.current || current.current.fingerprint !== fingerprint) {
      current.current = { fingerprint, key: crypto.randomUUID() };
    }
    return current.current.key;
  }, []);

  const reset = useCallback(() => {
    current.current = null;
  }, []);

  return { keyFor, reset };
}
