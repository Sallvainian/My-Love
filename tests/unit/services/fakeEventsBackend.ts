/**
 * The in-memory `events` backend shared by the eventsService test files.
 *
 * The Supabase client is faked per file — `tests/setup.ts` installs no Supabase
 * mock — over a tiny in-memory backend, so the chained PostgREST builder is
 * exercised rather than asserted on. Each test file keeps its own
 * `vi.mock('@/api/supabaseClient')`, whose factory calls `eventsQuery()` and
 * bumps `backend.fromCalls` lazily; this module holds the backend it drives.
 */
export const USER_ID = 'USER-A-ID';
export const PARTNER_ID = 'USER-B-ID';
// Rows per window when the caller names no limit. A page reads one row past it
// to learn whether more remain.
export const PAGE_SIZE = 50; // src/services/eventsService.ts DEFAULT_EVENTS_PAGE_SIZE (module-private)

interface EventRow {
  id: string;
  user_id: string;
  label: string;
  event_date: string;
  description: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
}

interface FakePostgrestError {
  code: string;
  message: string;
  details: string;
  hint: string;
}

export const backend = {
  rows: [] as EventRow[],
  /** Injected instead of running the query — a PostgREST error object, or a
   *  plain Error standing in for a mid-flight network failure. */
  nextError: null as FakePostgrestError | Error | null,
  /** Reject the query with any thrown value, including null and undefined. */
  nextRejection: null as { reason: unknown } | null,
  /** Override a successful response, including `null`, for invalid-response tests. */
  nextData: undefined as EventRow[] | null | undefined,
  /** Which side of `getEvents`' two-window read `nextError` applies to. `null`
   *  fails every query, which is what every write test wants; naming one bound
   *  fails only the window carrying it, so each window's own error check is
   *  reachable on its own. */
  errorForBound: null as 'gte' | 'lt' | null,
  /** Every `.update()` / `.insert()` payload the service sent, in order. */
  payloads: [] as Record<string, unknown>[],
  /** Every `.eq()` the service applied, so an added user_id filter is caught.
   *  Date bounds live in `queries` instead, so this stays a pure equality log
   *  and `expect(backend.filters).toEqual([])` keeps its whole meaning. */
  filters: [] as { column: string; value: unknown }[],
  /** One entry per query actually RUN, in run order: its date bounds, its
   *  orderings and its row window. The two-sided read is asserted from here
   *  rather than from a flat order log, which cannot say which window a
   *  given `.order()` belonged to. */
  queries: [] as {
    bounds: { column: string; op: 'gte' | 'lt'; value: string }[];
    orderings: { column: string; ascending: boolean }[];
    range: { from: number; to: number } | null;
    or?: string;
  }[],
  /** Bumped on every `from()` — an offline guard must leave this at 0. */
  fromCalls: 0,
  reset() {
    this.rows = [];
    this.nextError = null;
    this.nextRejection = null;
    this.nextData = undefined;
    this.errorForBound = null;
    this.payloads = [];
    this.filters = [];
    this.queries = [];
    this.fromCalls = 0;
  },
};

export function row(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'event-1',
    user_id: USER_ID,
    label: 'Anniversary',
    event_date: '2026-09-12',
    description: null,
    icon: 'calendar',
    created_at: '2026-08-18T00:00:00.000Z',
    updated_at: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

/** PostgREST's row-level-security refusal (SQLSTATE 42501, insufficient_privilege). */
export function permissionDenied(message = 'permission denied'): FakePostgrestError {
  return { code: '42501', message, details: '', hint: '' };
}

/** Evaluate the supported PostgREST boolean grammar independently of page logic. */
function matchesExpression(candidate: EventRow, expression: string): boolean {
  const group = /^(and|or)\((.*)\)$/.exec(expression);
  if (group) {
    const clauses: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < group[2].length; i += 1) {
      const char = group[2][i];
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        clauses.push(group[2].slice(start, i));
        start = i + 1;
      }
    }
    clauses.push(group[2].slice(start));
    return group[1] === 'and'
      ? clauses.every((clause) => matchesExpression(candidate, clause))
      : clauses.some((clause) => matchesExpression(candidate, clause));
  }
  const comparison = /^(\w+)\.(eq|gt|lt)\.(.*)$/.exec(expression);
  if (!comparison) throw new Error(`Unsupported filter: ${expression}`);
  const actual = String(candidate[comparison[1] as keyof EventRow]);
  const expected = comparison[3];
  return comparison[2] === 'eq' ? actual === expected
    : comparison[2] === 'gt' ? actual > expected : actual < expected;
}

/**
 * The PostgREST builder is chainable and thenable: every method returns itself,
 * and awaiting it runs the query.
 */
export function eventsQuery() {
  let operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let payload: Record<string, unknown> = {};
  const filters: { column: string; value: unknown }[] = [];
  const orderings: { column: string; ascending: boolean }[] = [];
  const bounds: { column: string; op: 'gte' | 'lt'; value: string }[] = [];
  let range: { from: number; to: number } | null = null;
  let or: string | undefined;

  const matches = (candidate: EventRow): boolean => {
    const record = candidate as unknown as Record<string, unknown>;
    if (!filters.every((f) => record[f.column] === f.value)) return false;
    if (or && !matchesExpression(candidate, `or(${or})`)) return false;
    // `event_date` is a Postgres `date`, so its "YYYY-MM-DD" text compares the
    // same way lexicographically as it does chronologically — which is what
    // lets this stand in for a real range predicate.
    return bounds.every((b) => {
      const value = String(record[b.column]);
      return b.op === 'gte' ? value >= b.value : value < b.value;
    });
  };

  const run = (): { data: EventRow[] | null; error: FakePostgrestError | Error | null } => {
    if (backend.nextRejection) throw backend.nextRejection.reason;
    if (operation === 'select') {
      backend.queries.push({ bounds: [...bounds], orderings: [...orderings], range, ...(or ? { or } : {}) });
    }
    const errorApplies =
      backend.errorForBound === null || bounds.some((b) => b.op === backend.errorForBound);
    if (backend.nextError && errorApplies) return { data: null, error: backend.nextError };
    if (backend.nextData !== undefined) return { data: backend.nextData, error: null };

    if (operation === 'insert') {
      const inserted: EventRow = {
        ...row({ id: `event-${backend.rows.length + 1}` }),
        ...payload,
      } as EventRow;
      backend.rows.push(inserted);
      return { data: [inserted], error: null };
    }

    if (operation === 'update') {
      const hits = backend.rows.filter(matches);
      hits.forEach((hit) => Object.assign(hit, payload));
      return { data: hits, error: null };
    }

    if (operation === 'delete') {
      const hits = backend.rows.filter(matches);
      backend.rows = backend.rows.filter((candidate) => !hits.includes(candidate));
      return { data: hits, error: null };
    }

    const found = backend.rows.filter(matches);
    if (orderings.length) {
      found.sort((a, b) => {
        for (const { column, ascending } of orderings) {
          const left = String((a as unknown as Record<string, unknown>)[column]);
          const right = String((b as unknown as Record<string, unknown>)[column]);
          const cmp = ascending ? left.localeCompare(right) : right.localeCompare(left);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }
    // PostgREST's `.range(from, to)` is inclusive at both ends.
    return { data: range ? found.slice(range.from, range.to + 1) : found, error: null };
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (values: Record<string, unknown>) => {
      operation = 'insert';
      payload = values;
      backend.payloads.push(values);
      return builder;
    },
    update: (values: Record<string, unknown>) => {
      operation = 'update';
      payload = values;
      backend.payloads.push(values);
      return builder;
    },
    delete: () => {
      operation = 'delete';
      return builder;
    },
    eq: (column: string, value: unknown) => {
      filters.push({ column, value });
      backend.filters.push({ column, value });
      return builder;
    },
    gte: (column: string, value: string) => {
      bounds.push({ column, op: 'gte', value });
      return builder;
    },
    lt: (column: string, value: string) => {
      bounds.push({ column, op: 'lt', value });
      return builder;
    },
    or: (expression: string) => {
      or = expression;
      return builder;
    },
    range: (from: number, to: number) => {
      range = { from, to };
      return builder;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      const ascending = options?.ascending ?? true;
      orderings.push({ column, ascending });
      return builder;
    },
    single: async () => {
      const result = run();
      return { data: result.data?.[0] ?? null, error: result.error };
    },
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve().then(run).then(onFulfilled, onRejected),
  };
  return builder;
}

export function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}
