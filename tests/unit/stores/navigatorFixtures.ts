/**
 * `navigator` stubs shared by unit tests: what the browser says about the
 * connection. Free of imports, so a service test can use them without loading
 * the store. `accountDataFixtures.ts` and `services/fakeEventsBackend.ts`
 * re-export `setOnline`. The stub is an own property that `restoreMocks` does
 * not undo, so a file that sets it offline resets it in `beforeEach`.
 */

/** Sets `navigator.onLine`. */
export function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

/** Sets `navigator.connection` (the Network Information API), or removes it with `undefined`. */
export function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
}
