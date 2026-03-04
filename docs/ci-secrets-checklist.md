# CI Secrets Checklist

## Required Secrets

The following secrets must be configured in **GitHub → Repository Settings → Secrets and variables → Actions** for the CI pipeline to function correctly.

### Currently Required

| Secret | Used By | Required? | Notes |
|--------|---------|-----------|-------|
| _(none)_ | — | — | The pipeline uses local Supabase; no external secrets needed for tests |

### Supabase Local Setup

The CI pipeline uses a **local Supabase instance** started via the `.github/actions/setup-supabase` composite action. No external Supabase credentials are needed. The action:

1. Installs Supabase CLI (pinned version)
2. Starts local Supabase (`supabase start`)
3. Resets the database (`supabase db reset`)
4. Exports credentials to `GITHUB_ENV`
5. Verifies API connectivity

### Build Secrets

For build steps (smoke tests, Lighthouse), placeholder values are used:

```yaml
env:
  VITE_SUPABASE_URL: http://localhost:54321
  VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: placeholder-for-smoke-test
```

These are sufficient because the build only needs valid environment variables to compile — it doesn't make actual API calls.

## Security Practices

- No secrets are stored in CI configuration files
- All sensitive values use GitHub's secret management
- Artifact retention is limited (7-30 days)
- `npm audit` runs on every push to catch known vulnerabilities
- `github.base_ref` and other user-controllable contexts are routed through `env:` intermediaries to prevent script injection
- Pipeline has `permissions: contents: read` (least privilege)

## Adding New Secrets

If a future feature requires external secrets:

1. Add the secret in GitHub → Settings → Secrets → Actions
2. Reference it in the workflow as `${{ secrets.SECRET_NAME }}`
3. Never echo or log secret values
4. Update this document with the new secret
