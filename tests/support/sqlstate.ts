/**
 * The Postgres SQLSTATE codes the tests name, in one place, so a test reads
 * `INSUFFICIENT_PRIVILEGE` instead of a bare `'42501'` and no file declares
 * its own copy. Production code keeps its own literals (`src/api/errorHandlers.ts`).
 * Vitest and Playwright specs both import it, so it has no imports of its own.
 */

/** `check_violation`: a row broke a CHECK constraint. */
export const CHECK_VIOLATION_CODE = '23514';

/** `not_null_violation`: a NOT NULL column was given null. */
export const NOT_NULL_VIOLATION = '23502';

/** `insufficient_privilege`: an RLS policy or grant refused the statement. */
export const INSUFFICIENT_PRIVILEGE = '42501';

/** `connection_failure`: the database connection dropped mid-request. */
export const CONNECTION_FAILURE = '08006';
