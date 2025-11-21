# Configuration Files

## Build & Tooling Configuration

| File                   | Purpose           | Key Settings                              |
| ---------------------- | ----------------- | ----------------------------------------- |
| `vite.config.ts`       | Build tool config | PWA plugin, React plugin, chunk splitting |
| `tsconfig.json`        | TypeScript config | Strict mode, path aliases                 |
| `tailwind.config.js`   | CSS framework     | Custom theme colors, animations           |
| `postcss.config.js`    | CSS processing    | Tailwind, autoprefixer                    |
| `eslint.config.js`     | Linting rules     | React hooks, TypeScript rules             |
| `vitest.config.ts`     | Unit testing      | Happy-DOM environment                     |
| `playwright.config.ts` | E2E testing       | Multi-browser, workers                    |

## Environment Configuration

```bash
# .env (gitignored)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env.test.example
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=test-key
```
