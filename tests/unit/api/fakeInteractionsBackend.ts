/**
 * In-memory stand-in for `public.interactions` plus the slice of the Supabase
 * query builder that `src/api/interactionService.ts` uses.
 *
 * Extracted from the inline fake that lived in `interactionService.test.ts`,
 * for the same reason `fakeMoodsBackend.ts` exists: a boundary model that more
 * than one spec depends on should be correctable in one place.
 *
 * Three behaviours matter and are modelled rather than assumed:
 *
 * 1. **`.single()` is an Accept header, not an array index.** `single()` sets
 *    `Accept: application/vnd.pgrst.object+json`
 *    (`@supabase/postgrest-js@2.112.3 dist/index.mjs:1162`), and PostgREST
 *    coerces the response under that header: anything other than exactly one
 *    row comes back as 406 / `PGRST116`. The previous fake returned
 *    `{ data: null, error: null }` for every zero-row result, which conflated
 *    that outcome with a different and much rarer one (below) and left the
 *    reachable path untested. Measured against this repo's local PostgREST:
 *
 *      curl -i '.../rest/v1/interactions?select=*&id=eq.<no-such-id>' \
 *        -H 'Accept: application/vnd.pgrst.object+json'
 *      HTTP/1.1 406 Not Acceptable
 *      {"code":"PGRST116","details":"The result contains 0 rows","hint":null,
 *       "message":"Cannot coerce the result to a single JSON object"}
 *
 * 2. **`{ data: null, error: null }` is producible, but only one way.**
 *    `PostgrestBuilder`'s handler contains `if (body === "")` on the `res.ok`
 *    path, so a 2xx with an empty body yields that shape. With
 *    `Prefer: return=representation` — which `.select()` adds — reaching it
 *    needs an intermediary or a server that drops the representation. It is
 *    defensive, not the common case, so it gets its own switch
 *    (`insertReturnsEmptyBody`) instead of standing in for both.
 *
 * 3. **`.or()`, `.order()` and `.range()` are the history read's predicate.**
 *    The previous fake no-op'd all three, so `getInteractionHistory` could
 *    return the wrong rows in the wrong order and every test still passed.
 *
 * `.or()` models only the `column.eq.value` term the service actually sends;
 * anything else throws rather than silently matching everything.
 */

export interface FakeInteractionRow {
  id: string;
  type: string;
  from_user_id: string;
  to_user_id: string;
  viewed: boolean | null;
  created_at: string | null;
}

/**
 * The PostgREST error envelope. `details` and `hint` are nullable because
 * PostgREST sends them as `null` — both measured responses quoted in this file
 * carry `"hint":null`, and the RLS rejection carries `"details":null` too. The
 * shape matters: `isPostgrestError` (`src/api/errorHandlers.ts:109-117`) keys
 * on the *presence* of `code`, `message` and `details`, so a fake that omits
 * `details` routes every rejection down the network branch instead.
 */
export interface FakePostgrestError {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}

/**
 * What PostgREST returns when `Accept: application/vnd.pgrst.object+json` gets
 * a row count it cannot coerce. The zero-row form is measured (see header); the
 * count is interpolated the way PostgREST interpolates it.
 */
export function objectCoercionError(rowCount: number): FakePostgrestError {
  return {
    code: 'PGRST116',
    details: `The result contains ${rowCount} rows`,
    hint: null,
    message: 'Cannot coerce the result to a single JSON object',
  };
}

/**
 * A row-level-security rejection, measured against local PostgREST by POSTing
 * to `/rest/v1/interactions` with the publishable key and no session.
 */
export const RLS_DENIED: FakePostgrestError = {
  code: '42501',
  details: null,
  hint: null,
  message: 'new row violates row-level security policy for table "interactions"',
};

type Operation = 'select' | 'insert' | 'update';

export class FakeInteractionsBackend {
  rows: FakeInteractionRow[] = [];

  /**
   * Injected instead of running the query — a PostgREST error envelope, an
   * Error standing in for a mid-flight failure, or a bare string for a
   * rejection that is neither.
   */
  nextError: FakePostgrestError | Error | string | null = null;

  /** 2xx with an empty body: `{ data: null, error: null }`. See header note 2. */
  insertReturnsEmptyBody = false;

  /** The insert created no visible row, so `.single()` coerces to `PGRST116`. */
  insertMatchesNoRow = false;

  /** Every `.insert()` / `.update()` payload the service sent, in order. */
  payloads: Record<string, unknown>[] = [];

  /** Bumped on every `from()` — an offline guard must leave this at 0. */
  fromCalls = 0;

  private nextRowNumber = 1;

  reset(): void {
    this.rows = [];
    this.nextError = null;
    this.insertReturnsEmptyBody = false;
    this.insertMatchesNoRow = false;
    this.payloads = [];
    this.fromCalls = 0;
    this.nextRowNumber = 1;
  }

  /** Seed a row directly, bypassing the service under test */
  seed(overrides: Partial<FakeInteractionRow> = {}): FakeInteractionRow {
    const seeded: FakeInteractionRow = {
      id: `interaction-${this.nextRowNumber++}`,
      type: 'poke',
      from_user_id: 'seeded-sender',
      to_user_id: 'seeded-recipient',
      viewed: false,
      created_at: '2026-08-18T00:00:00.000Z',
      ...overrides,
    };
    this.rows.push(seeded);
    return seeded;
  }

  allocateId(): string {
    return `interaction-${this.nextRowNumber++}`;
  }

  /** The Supabase client surface interactionService consumes */
  client(): { from: (table: string) => FakeInteractionsQuery } {
    return {
      from: (table: string) => {
        this.fromCalls += 1;
        return new FakeInteractionsQuery(this, table);
      },
    };
  }
}

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface Term {
  column: string;
  value: unknown;
}

class FakeInteractionsQuery implements PromiseLike<QueryResult> {
  private op: Operation = 'select';
  private payload: Record<string, unknown> = {};
  private filters: Term[] = [];
  private orTerms: Term[] | null = null;
  private orders: { column: string; ascending: boolean }[] = [];
  private rangeSpec: { from: number; to: number } | null = null;
  private wantsSingle = false;

  constructor(
    private backend: FakeInteractionsBackend,
    private table: string
  ) {}

  select(): this {
    return this;
  }

  insert(values: Record<string, unknown>): this {
    this.op = 'insert';
    this.payload = values;
    this.backend.payloads.push(values);
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.op = 'update';
    this.payload = values;
    this.backend.payloads.push(values);
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  /**
   * `.or('from_user_id.eq.X,to_user_id.eq.X')` — the disjunction the history
   * read uses to mean "sent by me or to me". Only the `.eq.` operator is
   * modelled; anything else throws, because silently matching every row is how
   * a no-op fake lets a broken predicate ship green.
   */
  or(filter: string): this {
    this.orTerms = filter.split(',').map((term) => {
      const [column, operator, ...rest] = term.split('.');
      if (operator !== 'eq') {
        throw new Error(`FakeInteractionsBackend does not model .or() operator "${operator}"`);
      }
      return { column, value: rest.join('.') };
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  range(from: number, to: number): this {
    this.rangeSpec = { from, to };
    return this;
  }

  single(): this {
    this.wantsSingle = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    if (this.table !== 'interactions') {
      throw new Error(`FakeInteractionsBackend does not model table "${this.table}"`);
    }

    if (this.backend.nextError) {
      return { data: null, error: this.backend.nextError };
    }

    switch (this.op) {
      case 'insert':
        return this.wrap(this.insertRow());
      case 'update':
        return this.wrap(this.updateRows());
      default:
        return this.wrap(this.selectRows());
    }
  }

  private wrap(matched: FakeInteractionRow[]): QueryResult {
    if (!this.wantsSingle) {
      return { data: matched, error: null };
    }

    // A 2xx whose body is empty never reaches PostgREST's coercion — the
    // client short-circuits on `if (body === "")`. See header note 2.
    if (this.backend.insertReturnsEmptyBody) {
      return { data: null, error: null };
    }

    if (matched.length !== 1) {
      return { data: null, error: objectCoercionError(matched.length) };
    }

    return { data: matched[0], error: null };
  }

  private insertRow(): FakeInteractionRow[] {
    if (this.backend.insertReturnsEmptyBody || this.backend.insertMatchesNoRow) {
      return [];
    }

    const inserted: FakeInteractionRow = {
      id: this.backend.allocateId(),
      type: this.payload.type as string,
      from_user_id: this.payload.from_user_id as string,
      to_user_id: this.payload.to_user_id as string,
      viewed: (this.payload.viewed as boolean | null | undefined) ?? false,
      created_at: (this.payload.created_at as string | undefined) ?? '2026-08-18T00:00:00.000Z',
    };
    this.backend.rows.push(inserted);
    return [inserted];
  }

  private updateRows(): FakeInteractionRow[] {
    const matched = this.applyPredicate(this.backend.rows);
    matched.forEach((row) => {
      Object.entries(this.payload).forEach(([key, value]) => {
        (row as unknown as Record<string, unknown>)[key] = value;
      });
    });
    return matched;
  }

  private selectRows(): FakeInteractionRow[] {
    const sorted = [...this.applyPredicate(this.backend.rows)].sort((a, b) => this.compare(a, b));

    if (this.rangeSpec) {
      return sorted.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    }
    return sorted;
  }

  private applyPredicate(rows: FakeInteractionRow[]): FakeInteractionRow[] {
    return rows.filter((row) => {
      const columns = row as unknown as Record<string, unknown>;
      const passesFilters = this.filters.every((term) => columns[term.column] === term.value);
      const passesOr =
        this.orTerms === null || this.orTerms.some((term) => columns[term.column] === term.value);
      return passesFilters && passesOr;
    });
  }

  private compare(a: FakeInteractionRow, b: FakeInteractionRow): number {
    for (const { column, ascending } of this.orders) {
      const left = (a as unknown as Record<string, unknown>)[column];
      const right = (b as unknown as Record<string, unknown>)[column];
      if (left === right) continue;
      const direction = (left as never) > (right as never) ? 1 : -1;
      return ascending ? direction : -direction;
    }
    return 0;
  }
}
