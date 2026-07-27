/**
 * Shared test credentials.
 *
 * Every test user — worker pairs, legacy users, and ad-hoc outsiders — is
 * provisioned with this password by tests/support/auth/global-setup.ts.
 *
 * This constant exists because the value was previously copy-pasted into five
 * modules and one of them drifted to 'test-password-123'. That module also
 * *reset* the shared user's password to its variant, so whichever Playwright
 * project happened to run first decided whether the other project could sign
 * in at all — six RLS tests failed with "Invalid login credentials" on roughly
 * every other run. Import this; never re-declare the literal.
 */
export const TEST_USER_PASSWORD = 'testpassword123';
