# Database Migrations

Supabase SQL migrations live in `supabase/migrations/`. Each migration file is timestamped and describes its purpose.

## Applying Migrations

```bash
# Push migrations to your Supabase project
npx supabase db push
```

## Generating TypeScript Types

After schema changes, regenerate the TypeScript types:

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  > src/types/database.types.ts
```

This step runs automatically during CI deployment.

---
