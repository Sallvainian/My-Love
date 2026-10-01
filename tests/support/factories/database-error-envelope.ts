/**
 * Controlled DW-39 error payloads, not claims about live PostgREST output.
 * Keep message present so callers' existing classifier accepts the envelope.
 * The direct handler unit suite owns omitted/undefined-property coverage.
 */
export interface DatabaseErrorEnvelope {
  code: string;
  message: string | number | null;
  details: string | null;
  hint: string | null;
}

/**
 * Postgres `internal_error` SQLSTATE: the envelope's default code, and one the
 * `23514` CHECK mapping does not claim, so the generic database fallback runs.
 */
export const UNMAPPED_SQLSTATE = 'XX000';

export function createDatabaseErrorEnvelope(
  overrides: Partial<DatabaseErrorEnvelope> = {}
): DatabaseErrorEnvelope {
  return {
    code: UNMAPPED_SQLSTATE,
    message: ' \t\n',
    details: null,
    hint: null,
    ...overrides,
  };
}
