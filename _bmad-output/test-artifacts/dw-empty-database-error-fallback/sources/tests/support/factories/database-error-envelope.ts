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

export function createDatabaseErrorEnvelope(
  overrides: Partial<DatabaseErrorEnvelope> = {}
): DatabaseErrorEnvelope {
  return {
    code: 'XX000',
    message: ' \t\n',
    details: null,
    hint: null,
    ...overrides,
  };
}
