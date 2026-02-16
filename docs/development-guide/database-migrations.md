# Database Migrations

## Local Supabase Setup

Start the local Supabase stack (requires Docker):

```bash
supabase start
```

This starts Postgres 17, Auth, Storage, Realtime, Studio, and Inbucket (email). Default ports:

| Service | Port |
|---|---|
| API | 54321 |
| Database | 54322 |
| Shadow Database | 54320 |
| Studio | 54323 |
| Inbucket (email) | 54324 |
| Analytics | 54327 |

Check status:

```bash
supabase status
```

Stop local Supabase:

```bash
supabase stop            # With backup
supabase stop --no-backup # Without backup (faster, used in CI)
```

## Creating Migrations

### Generate a New Migration File

```bash
supabase migration new create_reflections_table
```

This creates a timestamped file in `supabase/migrations/`:

```
supabase/migrations/20260209143045_create_reflections_table.sql
```

### Migration File Naming Convention

Files must follow the format `YYYYMMDDHHmmss_short_description.sql` in UTC time:

- `YYYY` -- Four-digit year
- `MM` -- Two-digit month (01-12)
- `DD` -- Two-digit day (01-31)
- `HH` -- Two-digit hour in 24-hour format (00-23)
- `mm` -- Two-digit minute (00-59)
- `ss` -- Two-digit second (00-59)

### Writing Migration SQL

Follow the project's SQL style guide (`.claude/rules/postgres-sql-style-guide.md`):

- Use lowercase for SQL reserved words
- Use snake_case for table and column names
- Prefer plurals for table names, singular for column names
- Always add `id` column as `bigint generated always as identity primary key`
- Always enable Row Level Security (RLS) on new tables
- Add table comments describing purpose
- Create separate RLS policies for select, insert, update, delete
- Create separate policies per role (`anon`, `authenticated`)

Example:

```sql
-- Create reflections table for per-step scripture reading reflections
create table public.reflections (
  id bigint generated always as identity primary key,
  session_id bigint references public.reading_sessions (id) on delete cascade,
  step_index smallint not null,
  rating smallint not null check (rating between 1 and 5),
  notes text,
  user_id uuid references auth.users (id) on delete cascade not null,
  created_at timestamptz default now() not null
);

comment on table public.reflections is 'Per-step reflections during scripture reading sessions with 1-5 rating and optional notes.';

-- Enable RLS
alter table public.reflections enable row level security;

-- RLS policies
create policy "Users can view their own reflections"
on public.reflections for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own reflections"
on public.reflections for insert to authenticated
with check ((select auth.uid()) = user_id);

-- Index for RLS performance
create index idx_reflections_user_id on public.reflections using btree (user_id);
```

## Applying Migrations

### Locally

```bash
supabase db reset    # Drop all data, re-run all migrations, re-seed
```

This is the recommended approach during development. It ensures a clean slate with all migrations applied in order, followed by `seed.sql`.

### To Remote Supabase

```bash
supabase db push
```

Pushes all local migrations to the linked remote Supabase project. Only applies migrations that have not yet been applied remotely.

## Generating TypeScript Types

After any schema change, regenerate the TypeScript types:

### From Local Database

```bash
supabase gen types typescript --local > src/types/database.types.ts
```

### From Remote Database

```bash
supabase gen types typescript --project-id xojempkrugifnaveqtqc > src/types/database.types.ts
```

This requires the `SUPABASE_ACCESS_TOKEN` environment variable to be set.

The generated file (`src/types/database.types.ts`) is auto-generated and should not be edited manually. It is excluded from ESLint via the `ignores` configuration.

### CI Type Generation

In the deploy workflow (`deploy.yml`), types are generated from the remote schema before building:

```yaml
- name: Generate TypeScript types from Supabase
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  run: |
    npx supabase gen types typescript \
      --project-id xojempkrugifnaveqtqc \
      > src/types/database.types.ts
```

## CI Migration Validation

The `supabase-migrations.yml` workflow runs on PRs that modify files under the `supabase/` directory:

1. Checks out the PR code
2. Sets up local Supabase via the composite action (`.github/actions/setup-supabase/`)
3. Applies all migrations via `supabase db reset`
4. Validates that all migrations apply cleanly

The composite action (`setup-supabase`) handles:

1. Installing the Supabase CLI
2. Starting local Supabase
3. Running `supabase db reset` to apply all migrations
4. Exporting Supabase connection credentials as environment variables
5. Verifying database connectivity

## Database Tests

pgTAP tests validate database constraints, RLS policies, triggers, and functions:

```bash
npm run test:db    # Runs supabase test db
```

Test files are in `supabase/tests/database/`. They run against the local Supabase Postgres instance and require `supabase start`.

## Seed Data

`supabase/seed.sql` contains seed data for local development. It runs automatically during `supabase db reset` and when the seed configuration is enabled in `config.toml`:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

## Supabase Configuration (`config.toml`)

Key configuration settings in `supabase/config.toml`:

| Section | Setting | Value |
|---|---|---|
| `[db]` | `major_version` | 17 |
| `[db.migrations]` | `enabled` | true |
| `[auth]` | `enable_signup` | true |
| `[auth]` | `enable_anonymous_sign_ins` | false |
| `[auth.email]` | `enable_signup` | true |
| `[auth.email]` | `enable_confirmations` | false |
| `[realtime]` | `enabled` | true |
| `[storage]` | `file_size_limit` | "50MiB" |
| `[edge_runtime]` | `enabled` | true |
| `[edge_runtime]` | `deno_version` | 2 |
