/**
 * In-memory stand-in for `public.moods` plus the slice of the Supabase query
 * builder that `src/api/moodApi.ts` uses.
 *
 * Two behaviours matter for the duplicate-mood spec and are modelled faithfully:
 *
 * 1. `(user_id, created_at)` is UNIQUE, and the index is modelled rather than
 *    assumed: `.insert()` of an existing key returns 23505, and `.upsert()`
 *    naming a conflict target the index does not cover returns 42P10 — the
 *    error production raises when the migration has not been applied.
 *    `.upsert(values, { onConflict: 'user_id,created_at' })` resolves to the
 *    existing row, overwriting its columns with `excluded.*` semantics.
 * 2. Rows tied on every ORDER BY key come back in an arbitrary order in
 *    Postgres, and that order may differ between two queries. `selectScramble`
 *    alternates the pre-sort order between queries so a page boundary that
 *    lands on a tie is unstable unless the query pins the order itself.
 */

export interface FakeMoodRow {
  id: string;
  user_id: string;
  mood_type: string;
  mood_types: string[] | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Deterministic, schema-valid v4 UUIDs */
export function fakeUuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
}

type Operation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

export class FakeMoodsBackend {
  rows: FakeMoodRow[] = [];
  /** Every terminal operation the code under test issued, in order */
  operations: Array<{ op: Operation; onConflict?: string; orders?: OrderSpec[] }> = [];
  /**
   * Reproduce vector 1: the next write commits its row but comes back with a
   * response the client cannot parse. The stored row is untouched — only the
   * returned representation is corrupted — so the caller sees a failure after
   * the database already accepted the write.
   */
  corruptNextWriteResponse = false;

  private nextRowNumber = 1;
  private selectCount = 0;

  reset(): void {
    this.rows = [];
    this.operations = [];
    this.corruptNextWriteResponse = false;
    this.nextRowNumber = 1;
    this.selectCount = 0;
  }

  /** Seed a row directly, bypassing the API under test */
  seed(row: Partial<FakeMoodRow> & Pick<FakeMoodRow, 'user_id' | 'created_at'>): FakeMoodRow {
    const seeded: FakeMoodRow = {
      id: row.id ?? fakeUuid(this.nextRowNumber++),
      user_id: row.user_id,
      mood_type: row.mood_type ?? 'happy',
      mood_types: row.mood_types ?? null,
      note: row.note ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at ?? null,
    };
    this.rows.push(seeded);
    return seeded;
  }

  /** The Supabase client surface moodApi consumes */
  client(): { from: (table: string) => FakeQuery } {
    return {
      from: (table: string) => new FakeQuery(this, table),
    };
  }

  allocateId(): string {
    return fakeUuid(this.nextRowNumber++);
  }

  /**
   * Model Postgres's freedom to return ORDER BY ties in any order: alternate
   * the pre-sort order so consecutive page queries disagree on tied rows.
   */
  scrambleForSelect(rows: FakeMoodRow[]): FakeMoodRow[] {
    const flip = this.selectCount % 2 === 1;
    this.selectCount += 1;
    return flip ? [...rows].reverse() : [...rows];
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private op: Operation = 'select';
  private payload: Record<string, unknown> | null = null;
  private onConflict: string | undefined;
  private filters: Array<{ column: string; value: unknown }> = [];
  private orders: OrderSpec[] = [];
  private rangeSpec: { from: number; to: number } | null = null;
  private limitSpec: number | null = null;
  private wantsSingle = false;

  constructor(
    private backend: FakeMoodsBackend,
    private table: string
  ) {}

  select(): this {
    return this;
  }

  insert(values: Record<string, unknown>): this {
    this.op = 'insert';
    this.payload = values;
    return this;
  }

  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): this {
    this.op = 'upsert';
    this.payload = values;
    this.onConflict = options?.onConflict;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  gte(): this {
    return this;
  }

  lte(): this {
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

  limit(count: number): this {
    this.limitSpec = count;
    return this;
  }

  single(): this {
    this.wantsSingle = true;
    return this;
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: unknown } {
    if (this.table !== 'moods') {
      throw new Error(`FakeMoodsBackend does not model table "${this.table}"`);
    }

    switch (this.op) {
      case 'insert': {
        // The unique index is modelled, so a plain insert of an existing key
        // fails the way Postgres fails it rather than silently appending.
        if (this.findConflict()) {
          return this.fail({
            code: '23505',
            message:
              'duplicate key value violates unique constraint "moods_user_id_created_at_key"',
          });
        }
        return this.wrap([this.appendRow()]);
      }
      case 'upsert': {
        // ON CONFLICT naming columns no index covers is a hard error in
        // Postgres, not a silent success — this is what production returns if
        // the migration has not been applied.
        if (this.onConflict !== 'user_id,created_at') {
          return this.fail({
            code: '42P10',
            message:
              'there is no unique or exclusion constraint matching the ON CONFLICT specification',
          });
        }
        return this.wrap([this.upsertRow()]);
      }
      case 'update':
        return this.wrap(this.updateRows());
      case 'delete':
        return this.wrap(this.deleteRows());
      default:
        return this.wrap(this.selectRows());
    }
  }

  /** The row this write would collide with under the modelled unique index */
  private findConflict(): FakeMoodRow | undefined {
    const values = this.payload ?? {};
    return this.backend.rows.find(
      (row) => row.user_id === values.user_id && row.created_at === values.created_at
    );
  }

  /** Record the operation, then return a Postgres-shaped error */
  private fail(error: { code: string; message: string }): { data: unknown; error: unknown } {
    this.backend.operations.push({
      op: this.op,
      onConflict: this.onConflict,
      orders: this.orders,
    });
    return { data: null, error };
  }

  private wrap(matched: FakeMoodRow[]): { data: unknown; error: unknown } {
    this.backend.operations.push({
      op: this.op,
      onConflict: this.onConflict,
      orders: this.orders,
    });

    const isWrite = this.op === 'insert' || this.op === 'upsert' || this.op === 'update';
    if (isWrite && this.backend.corruptNextWriteResponse && matched.length > 0) {
      this.backend.corruptNextWriteResponse = false;
      const corrupted = { ...matched[0], mood_type: 'not-a-real-mood' };
      return { data: this.wantsSingle ? corrupted : [corrupted], error: null };
    }

    if (this.wantsSingle) {
      if (matched.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
      }
      return { data: matched[0], error: null };
    }

    return { data: matched, error: null };
  }

  private newRowFromPayload(): FakeMoodRow {
    const values = this.payload ?? {};
    return {
      id: this.backend.allocateId(),
      user_id: values.user_id as string,
      mood_type: values.mood_type as string,
      mood_types: (values.mood_types as string[] | undefined) ?? null,
      note: (values.note as string | null | undefined) ?? null,
      created_at: (values.created_at as string | undefined) ?? null,
      updated_at: (values.updated_at as string | undefined) ?? null,
    };
  }

  private appendRow(): FakeMoodRow {
    const row = this.newRowFromPayload();
    this.backend.rows.push(row);
    return row;
  }

  private upsertRow(): FakeMoodRow {
    const values = this.payload ?? {};
    const existing = this.findConflict();

    if (!existing) {
      return this.appendRow();
    }

    // ON CONFLICT DO UPDATE SET col = excluded.col — the conflicting row takes
    // the incoming values wholesale and keeps only its id and created_at.
    // This OVERWRITES with null rather than preserving, which is what Postgres
    // does; merging instead would hide a real note-loss path from every test.
    Object.assign(existing, {
      mood_type: values.mood_type as string,
      mood_types: (values.mood_types as string[] | undefined) ?? null,
      note: (values.note as string | null | undefined) ?? null,
    });
    return existing;
  }

  private updateRows(): FakeMoodRow[] {
    const values = this.payload ?? {};
    const matched = this.applyFilters(this.backend.rows);

    matched.forEach((row) => {
      Object.entries(values).forEach(([key, value]) => {
        if (key === 'user_id' || key === 'created_at' || key === 'id') {
          throw new Error(`FakeMoodsBackend: refusing to update immutable column "${key}"`);
        }
        (row as unknown as Record<string, unknown>)[key] = value;
      });
    });

    return matched;
  }

  private deleteRows(): FakeMoodRow[] {
    const matched = this.applyFilters(this.backend.rows);
    this.backend.rows = this.backend.rows.filter((row) => !matched.includes(row));
    return matched;
  }

  private selectRows(): FakeMoodRow[] {
    const matched = this.applyFilters(this.backend.rows);
    const scrambled = this.backend.scrambleForSelect(matched);
    const sorted = [...scrambled].sort((a, b) => this.compare(a, b));

    if (this.rangeSpec) {
      return sorted.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    }
    if (this.limitSpec !== null) {
      return sorted.slice(0, this.limitSpec);
    }
    return sorted;
  }

  private applyFilters(rows: FakeMoodRow[]): FakeMoodRow[] {
    return rows.filter((row) =>
      this.filters.every(
        ({ column, value }) => (row as unknown as Record<string, unknown>)[column] === value
      )
    );
  }

  private compare(a: FakeMoodRow, b: FakeMoodRow): number {
    for (const { column, ascending } of this.orders) {
      const left = String((a as unknown as Record<string, unknown>)[column] ?? '');
      const right = String((b as unknown as Record<string, unknown>)[column] ?? '');
      if (left === right) continue;
      const direction = left < right ? -1 : 1;
      return ascending ? direction : -direction;
    }
    return 0;
  }
}
