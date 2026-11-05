/**
 * `navigator` stubs shared by unit tests: what the browser says about the
 * connection. Free of imports, so a service test can use them without loading
 * the store. `accountDataFixtures.ts` re-exports `setOnline`.
 */

/** Sets `navigator.onLine`. */
export function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

/** Sets `navigator.connection` (the Network Information API), or removes it with `undefined`. */
export function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
}
